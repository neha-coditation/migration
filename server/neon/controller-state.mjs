/**
 * Server-only project and page queue operations. Authorization must happen at
 * the HTTP boundary; ownerSubject must come from a verified session, never
 * from a browser-supplied JSON body.
 *
 * The constructor accepts a trusted parameterized PostgreSQL client.
 */
export class NeonControllerState {
  constructor(db) {
    if (!db || typeof db.query !== 'function') throw new TypeError('Postgres query client required');
    this.db = db;
  }

  async createProject({id, ownerSubject, sourceUrl, approvalMode = 'batch'}) {
    if (!id || !ownerSubject || !sourceUrl || !['batch', 'per-page'].includes(approvalMode)) {
      throw new TypeError('Invalid project fields');
    }
    const {rows} = await this.db.query(
      `INSERT INTO migration_studio.projects (id, owner_subject, source_url, approval_mode)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING RETURNING *`,
      [id, ownerSubject, sourceUrl, approvalMode]
    );
    return rows[0] ?? null;
  }

  async getProject({id, ownerSubject}) {
    if (!id || !ownerSubject) throw new TypeError('Project identity and verified owner required');
    const {rows} = await this.db.query(
      'SELECT * FROM migration_studio.projects WHERE id = $1 AND owner_subject = $2',
      [id, ownerSubject]
    );
    return rows[0] ?? null;
  }

  async queuePage({id, projectId, ownerSubject, route, sourceUrl, maxAttempts = 3}) {
    if (!id || !projectId || !ownerSubject || !route || !sourceUrl ||
        !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
      throw new TypeError('Invalid page job fields');
    }
    // The select ensures a job cannot be added to a project owned by another user.
    // A repeated route returns null, preserving the existing result and revision.
    const {rows} = await this.db.query(
      `INSERT INTO migration_studio.page_jobs
         (id, project_id, route, source_url, max_attempts)
       SELECT $1, p.id, $4, $5, $6 FROM migration_studio.projects p
       WHERE p.id = $2 AND p.owner_subject = $3
       ON CONFLICT (project_id, route) DO NOTHING
       RETURNING *`,
      [id, projectId, ownerSubject, route, sourceUrl, maxAttempts]
    );
    return rows[0] ?? null;
  }

  async listPages({projectId, ownerSubject}) {
    if (!projectId || !ownerSubject) throw new TypeError('Project and owner required');
    const {rows} = await this.db.query(
      `SELECT j.* FROM migration_studio.page_jobs j
       JOIN migration_studio.projects p ON p.id = j.project_id
       WHERE p.id = $1 AND p.owner_subject = $2
       ORDER BY j.created_at, j.id`,
      [projectId, ownerSubject]
    );
    return rows;
  }

  async recordProgress({jobId, workerId, stage, progress, externalRunId = null}) {
    if (!jobId || !workerId || typeof stage !== 'string' || stage.length > 120 ||
        !Number.isInteger(progress) || progress < 0 || progress > 100) {
      throw new TypeError('Invalid progress update');
    }
    const {rows} = await this.db.query(
      `UPDATE migration_studio.page_jobs
       SET stage = $3, progress = GREATEST(progress, $4),
           external_run_id = COALESCE($5, external_run_id), updated_at = now()
       WHERE id = $1 AND lease_owner = $2 AND status = 'running'
         AND lease_until > now()
       RETURNING *`,
      [jobId, workerId, stage, progress, externalRunId]
    );
    return rows[0] ?? null;
  }
}
