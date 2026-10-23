import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {createWorkerApi} from '../server/neon/worker-api.mjs';

// Only a disposable local database is accepted: never run this against Neon.
const connectionString=process.env.NEON_WORKER_TEST_DATABASE_URL;
test('Postgres: concurrent dispatch, reclaim fencing, atomic artifacts and terminal retries',{skip:!connectionString},async()=>{
 const url=new URL(connectionString);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname),'Use a disposable local PostgreSQL database');
 const db=new Pool({connectionString});
 const project=randomUUID(),jobId=randomUUID();let dispatches=[];
 const api=createWorkerApi({db,authenticateWorker:async()=>true,dispatch:async value=>dispatches.push(value),verifyArtifact:async()=>({expiresAt:'2099-01-01T00:00:00Z'})});
 const send=(action,body)=>api(new Request('https://local.test/api/neon/worker/'+action,{method:'POST',headers:{Authorization:'Bearer service'},body:JSON.stringify(body)}));
 try {
  await db.query(await fs.readFile(new URL('../server/neon/001_durable_queue.sql',import.meta.url),'utf8'));
  await db.query(`INSERT INTO migration_studio.projects(id,owner_subject,source_url) VALUES($1,'test','https://example.org')`,[project]);
  await db.query(`INSERT INTO migration_studio.page_jobs(id,project_id,route,source_url) VALUES($1,$2,'/','https://example.org')`,[jobId,project]);
  const dispatched=await Promise.all([send('dispatch',{jobId}),send('dispatch',{jobId})]);
  assert.deepEqual(dispatched.map(r=>r.status).sort(),[202,409]);assert.equal(dispatches.length,1);
  const first={...dispatches[0],runId:111};
  assert.equal((await send('claim',first)).status,200);
  assert.equal((await send('claim',{...first,runId:222})).status,409);
  assert.equal((await send('progress',{...first,stage:'qa',progress:80})).status,200);
  await send('progress',{...first,stage:'earlier',progress:20});
  assert.equal((await db.query('SELECT progress FROM migration_studio.page_jobs WHERE id=$1',[jobId])).rows[0].progress,80);
  await db.query(`UPDATE migration_studio.page_jobs SET lease_until=now()-interval '1 second' WHERE id=$1`,[jobId]);
  assert.equal((await send('progress',{...first,stage:'late',progress:90})).status,409);
  assert.equal((await send('dispatch',{jobId})).status,202);
  const second={...dispatches[1],runId:222};
  assert.equal(second.attempt,2);assert.equal((await send('claim',second)).status,200);
  const artifact={id:33,sha256:'f'.repeat(64),bytes:100};
  const manifest={jobId,browserExecuted:true,build:'passed',status:'needs-review',checks:[{status:'review'}]};
  const complete={status:'needs-review',artifact,manifest};
  assert.equal((await send('complete',{...first,...complete})).status,409);
  // Force a metadata write failure and prove the terminal update rolls back.
  await db.query(`INSERT INTO migration_studio.artifacts(id,job_id,object_key,kind,content_sha256,byte_size) VALUES($1,$2,'github-actions/222/33','other',$3,100)`,[randomUUID(),jobId,artifact.sha256]);
  assert.equal((await send('complete',{...second,...complete})).status,502);
  assert.equal((await db.query('SELECT status FROM migration_studio.page_jobs WHERE id=$1',[jobId])).rows[0].status,'running');
  await db.query('DELETE FROM migration_studio.artifacts WHERE job_id=$1',[jobId]);
  assert.equal((await send('complete',{...second,...complete})).status,200);
  assert.equal((await send('complete',{...second,...complete})).status,200);
  assert.equal((await send('complete',{...second,status:'failed'})).status,409);
  const saved=await db.query('SELECT * FROM migration_studio.artifacts WHERE job_id=$1',[jobId]);
  assert.equal(saved.rows.length,1);assert.equal(saved.rows[0].content_sha256,artifact.sha256);
  assert.equal((await send('dispatch',{jobId})).status,409);
 } finally {
  await db.query('DELETE FROM migration_studio.projects WHERE id=$1',[project]);await db.end();
 }
});
