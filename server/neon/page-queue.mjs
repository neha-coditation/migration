/**
 * Durable queue adapter for a trusted backend using a parameterized Postgres client.
 * Pass a client with query(sql, params) (for example node-postgres).
 * This module is deliberately not exposed as an unauthenticated HTTP API.
 */
export class NeonPageQueue {
  constructor(db) {
    if (!db || typeof db.query !== 'function') throw new TypeError('A Postgres query client is required');
    this.db = db;
  }

  async enqueue({id, projectId, route, sourceUrl, maxAttempts = 3}) {
    if (!id || !projectId || !route || !sourceUrl) throw new TypeError('Missing page job fields');
    const {rows} = await this.db.query(
      `INSERT INTO migration_studio.page_jobs
        (id, project_id, route, source_url, max_attempts)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, route) DO NOTHING
       RETURNING *`,
      [id, projectId, route, sourceUrl, maxAttempts]
    );
    return rows[0] ?? null;
  }

  async claim(workerId, leaseSeconds = 900) {
    const {rows} = await this.db.query(
      'SELECT * FROM migration_studio.claim_page_job($1, $2)',
      [workerId, leaseSeconds]
    );
    return rows[0] ?? null;
  }

  async heartbeat(jobId, workerId, leaseSeconds = 900) {
    const {rows} = await this.db.query(
      'SELECT migration_studio.heartbeat_page_job($1, $2, $3) AS renewed',
      [jobId, workerId, leaseSeconds]
    );
    return rows[0]?.renewed === true;
  }

  async complete({jobId, workerId, status, manifest = null}) {
    if (!['verified', 'needs-review', 'qa-blocked', 'failed', 'cancelled'].includes(status)) {
      throw new TypeError('Invalid terminal status');
    }
    const {rows} = await this.db.query(
      `UPDATE migration_studio.page_jobs
       SET status=$3, result_manifest=$4::jsonb,
           lease_owner=NULL, lease_until=NULL,
           progress=100, stage='complete', updated_at=now()
       WHERE id=$1 AND lease_owner=$2 AND status='running'
         AND lease_until > now()
       RETURNING *`,
      [jobId, workerId, status, manifest === null ? null : JSON.stringify(manifest)]
    );
    return rows[0] ?? null;
  }

  async listProject(projectId) {
    const {rows} = await this.db.query(
      'SELECT * FROM migration_studio.page_jobs WHERE project_id=$1 ORDER BY created_at, id',
      [projectId]
    );
    return rows;
  }
}
