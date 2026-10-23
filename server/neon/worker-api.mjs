import {randomUUID} from 'node:crypto';

const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
const integer = value => Number.isSafeInteger(value) && value > 0;
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});

// Separate service credential: dashboard identities cannot claim work or report results.
export function createWorkerApi({db, authenticateWorker, dispatch, verifyArtifact, requiresGitHubToken=false}) {
  return async request => {
    try {
      const token = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') || '')?.[1];
      if (!token || !await authenticateWorker(token)) return json({error:'Authentication required'},401);
      if (request.method !== 'POST') return json({error:'Not found'},404);
      const text = await request.text();
      if (Buffer.byteLength(text) > 65536) return json({error:'Request too large'},413);
      const input = JSON.parse(text || '{}');
      const action = new URL(request.url).pathname.split('/').at(-1);
      const githubToken = request.headers.get('x-github-token');
      if (action === 'dispatch') {
        if (requiresGitHubToken && !githubToken) return json({error:'GitHub dispatch credential required'},503);
        if (!uuid(input.jobId)) return json({error:'Invalid job'},400);
        const worker = randomUUID();
        const {rows} = await db.query(`UPDATE migration_studio.page_jobs SET
          status='running', attempt=attempt+1, lease_owner=$2,
          lease_until=now()+interval '15 minutes', external_run_id=NULL,
          progress=0, stage='dispatching', result_manifest=NULL, error_message=NULL, updated_at=now()
          WHERE id=$1 AND (status='queued' OR (status='running' AND lease_until < now()))
          AND attempt < max_attempts RETURNING *`, [input.jobId,worker]);
        const job = rows[0];
        if (!job) return json({error:'Job unavailable'},409);
        // Ambiguous dispatch failures keep the lease. Never immediately redispatch a
        // request which GitHub may already have accepted. Expiry permits recovery.
        await dispatch({jobId:job.id, workerId:worker, attempt:job.attempt},{githubToken});
        return json({jobId:job.id,attempt:job.attempt},202);
      }
      if (!uuid(input.jobId) || !uuid(input.workerId) || !integer(input.attempt) || !integer(input.runId)) return json({error:'Invalid fence'},400);
      const fence = [input.jobId,input.workerId,input.attempt,input.runId];
      const where = `id=$1 AND lease_owner=$2 AND attempt=$3 AND status='running'
        AND lease_until > now() AND (external_run_id IS NULL OR external_run_id=$4)`;
      if (action === 'claim') {
        const {rows} = await db.query(`UPDATE migration_studio.page_jobs SET external_run_id=$4,
          stage='claimed', lease_until=now()+interval '15 minutes', updated_at=now()
          WHERE ${where} RETURNING *`,fence);
        return rows[0] ? json({job:rows[0]}) : json({error:'Lease lost'},409);
      }
      // All later writes require a run already bound by claim.
      const bound = where + ' AND external_run_id=$4';
      if (action === 'progress') {
        if (typeof input.stage !== 'string' || !input.stage.length || input.stage.length > 120 || !Number.isInteger(input.progress) || input.progress < 0 || input.progress > 99) return json({error:'Invalid progress'},400);
        const {rows} = await db.query(`UPDATE migration_studio.page_jobs SET stage=$5,
          progress=GREATEST(progress,$6), lease_until=now()+interval '15 minutes',updated_at=now()
          WHERE ${bound} RETURNING id`,[...fence,input.stage,input.progress]);
        return rows[0] ? json({ok:true}) : json({error:'Lease lost'},409);
      }
      if (action === 'complete') {
        if (!['verified','needs-review','qa-blocked','failed','cancelled'].includes(input.status)) return json({error:'Invalid status'},400);
        const successful = ['verified','needs-review'].includes(input.status);
        const manifest = input.manifest;
        if (successful && (manifest?.jobId !== input.jobId || manifest?.browserExecuted !== true || manifest?.build !== 'passed' || manifest?.status !== input.status || !Array.isArray(manifest?.checks) || !manifest.checks.length || (input.status === 'verified' && manifest.checks.some(c => !['pass','not-applicable'].includes(c.status))))) return json({error:'Missing build or QA evidence'},400);
        let artifact = input.artifact;
        if (successful && !artifact) return json({error:'Artifact required'},400);
        if (artifact) {
          if (!integer(artifact.id) || !/^[a-f0-9]{64}$/.test(artifact.sha256 || '') || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1) return json({error:'Invalid artifact'},400);
          // GitHub API verifies repository, run association, digest and expiry;
          // callbacks cannot provide arbitrary URLs or object paths.
          artifact = {...artifact,...await verifyArtifact(input.runId,artifact,{jobId:input.jobId,attempt:input.attempt},{githubToken})};
        }
        const payload = {...manifest,workerId:input.workerId,runId:input.runId,attempt:input.attempt,artifact:artifact || null};
        const {rows} = await db.query(`WITH finished AS (
          UPDATE migration_studio.page_jobs SET status=$5,result_manifest=$6::jsonb,
            progress=CASE WHEN $5 IN ('verified','needs-review') THEN 100 ELSE progress END,
            stage=$5,lease_until=NULL,lease_owner=NULL,updated_at=now()
          WHERE ${bound} RETURNING *
        ), saved AS (
          INSERT INTO migration_studio.artifacts (id,job_id,object_key,kind,content_sha256,byte_size)
          SELECT $7::uuid,id,$8,'other',$9,$10 FROM finished WHERE $8::text IS NOT NULL RETURNING id
        ) SELECT id FROM finished`,[...fence,input.status,JSON.stringify(payload),randomUUID(),artifact ? `github-actions/${input.runId}/${artifact.id}` : null,artifact?.sha256 || null,artifact?.bytes || null]);
        if (rows[0]) return json({ok:true});
        // A lost response can be retried, but changed payloads and stale attempts cannot.
        const prior = await db.query(`SELECT id FROM migration_studio.page_jobs WHERE id=$1 AND attempt=$3
          AND external_run_id=$4 AND status=$5 AND result_manifest=$6::jsonb AND result_manifest->>'workerId'=$2`,[...fence,input.status,JSON.stringify(payload)]);
        return prior.rows[0] ? json({ok:true}) : json({error:'Lease lost'},409);
      }
      return json({error:'Not found'},404);
    } catch (error) {
      return json({error:error instanceof SyntaxError ? 'Invalid request' : 'Worker request failed'},error instanceof SyntaxError ? 400 : 502);
    }
  };
}

export function createGitHubWorker({repository,ref,token,fetcher=fetch}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !ref) throw new Error('GitHub worker configuration required');
  const api = async (path,options={},context={}) => {
    const credential = token || context.githubToken;
    if (!credential) throw new Error('GitHub request credential required');
    const response = await fetcher(`https://api.github.com/repos/${repository}/${path}`,{...options,headers:{Authorization:`Bearer ${credential}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error('GitHub request failed');
    return response.status === 204 ? null : response.json();
  };
  return {
    requiresGitHubToken:!token,
    dispatch: (input,context) => api('actions/workflows/neon-page-worker.yml/dispatches',{method:'POST',body:JSON.stringify({ref,inputs:{job_id:input.jobId,worker_id:input.workerId,attempt:String(input.attempt)}})},context),
    verifyArtifact: async (runId,artifact,identity,context) => {
      const item = await api(`actions/artifacts/${artifact.id}`,{},context);
      if (item.name !== `neon-${identity.jobId}-${identity.attempt}` || item.workflow_run?.id !== runId || item.expired || Date.parse(item.expires_at) <= Date.now() || !Number.isFinite(Date.parse(item.expires_at)) || item.digest !== `sha256:${artifact.sha256}` || item.size_in_bytes !== artifact.bytes) throw new Error('Artifact provenance mismatch');
      return {expiresAt:item.expires_at,repository};
    }
  };
}
