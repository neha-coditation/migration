import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerApi,createGitHubWorker} from '../server/neon/worker-api.mjs';
import {createCallbackClient} from '../scripts/neon-worker-client.mjs';
const jobId='53038615-f229-4e45-b6a0-ea1710a368af',workerId='b4b1ade3-b65d-4ac5-b2d1-039de4ccdcda';
const fence={jobId,workerId,attempt:2,runId:123};
const artifact={id:44,sha256:'a'.repeat(64),bytes:100};
const manifest={jobId,browserExecuted:true,build:'passed',status:'needs-review',checks:[{status:'review'}]};
function harness(rows=[{id:jobId,attempt:2}]) {
  const calls=[],dispatches=[],artifacts=[];
  const api=createWorkerApi({db:{query:async(sql,params)=>{calls.push({sql,params});return {rows};}},authenticateWorker:async token=>token==='service',dispatch:async value=>dispatches.push(value),verifyArtifact:async(...value)=>{artifacts.push(value);return {expiresAt:'2099-01-01T00:00:00Z'};}});
  const send=(action,body,token='service')=>api(new Request('https://example.org/api/neon/worker/'+action,{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}));
  return {calls,dispatches,artifacts,send};
}
test('dashboard and anonymous callers cannot mutate worker jobs',async()=>{
 const h=harness();
 for(const token of ['dashboard',''])assert.equal((await h.send('dispatch',{jobId},token)).status,401);
 assert.equal(h.calls.length,0);
});
test('dispatch claims a specific job and sends only fencing identifiers',async()=>{
 const h=harness();assert.equal((await h.send('dispatch',{jobId})).status,202);
 assert.match(h.calls[0].sql,/attempt=attempt\+1/);
 assert.match(h.calls[0].sql,/lease_until < now\(\)/);
 assert.match(h.calls[0].sql,/external_run_id=NULL/);
 assert.deepEqual(Object.keys(h.dispatches[0]).sort(),['attempt','jobId','workerId']);
 const empty=harness([]);assert.equal((await empty.send('dispatch',{jobId})).status,409);assert.equal(empty.dispatches.length,0);
});
test('claim, progress and completion require attempt, run and unexpired lease',async()=>{
 const h=harness([]);
 for(const [action,body] of [['claim',fence],['progress',{...fence,stage:'qa',progress:70}],['complete',{...fence,status:'failed'}]]) {
  assert.equal((await h.send(action,body)).status,409);
 }
 for(const call of h.calls.filter(c=>c.sql.includes('UPDATE'))) {
  assert.match(call.sql,/attempt=\$3/);assert.match(call.sql,/lease_owner=\$2/);assert.match(call.sql,/lease_until > now\(\)/);
 }
 assert.match(h.calls[1].sql,/external_run_id=\$4/);
 assert.equal((await h.send('progress',{...fence,attempt:undefined,stage:'qa',progress:50})).status,400);
});
test('completion refuses missing build/browser evidence and false verified status',async()=>{
 const h=harness();
 for(const patch of [{manifest:null},{manifest:{...manifest,browserExecuted:false}},{manifest:{...manifest,build:'failed'}},{artifact:null},{status:'verified',manifest:{...manifest,status:'verified'}}]) {
  assert.equal((await h.send('complete',{...fence,status:'needs-review',manifest,artifact,...patch})).status,400);
 }
 assert.equal(h.calls.length,0);
});
test('completion atomically saves provenance and metadata; retries are matched exactly',async()=>{
 const h=harness();assert.equal((await h.send('complete',{...fence,status:'needs-review',manifest,artifact})).status,200);
 assert.match(h.calls[0].sql,/WITH finished AS/);assert.match(h.calls[0].sql,/INSERT INTO migration_studio.artifacts/);
 assert.equal(h.calls[0].params[7],'github-actions/123/44');
 assert.equal(JSON.parse(h.calls[0].params[5]).artifact.expiresAt,'2099-01-01T00:00:00Z');
 const retry=harness([]);await retry.send('complete',{...fence,status:'failed'});
 assert.match(retry.calls[1].sql,/result_manifest=\$6::jsonb/);
});
test('GitHub adapter rejects cross-run, expired, wrong digest and wrong size artifacts',async()=>{
 let record={name:`neon-${jobId}-2`,workflow_run:{id:123},expires_at:'2099-01-01T00:00:00Z',expired:false,digest:'sha256:'+artifact.sha256,size_in_bytes:100};
 const adapter=createGitHubWorker({repository:'neha-coditation/migration',ref:'feature/test',token:'secret',fetcher:async()=>Response.json(record)});
 await adapter.verifyArtifact(123,artifact,{jobId,attempt:2});
 for(const patch of [{name:'other-job'},{workflow_run:{id:456}},{expired:true},{expires_at:'yesterday'},{digest:'sha256:bad'},{size_in_bytes:1}]) {
  const original=record;record={...record,...patch};await assert.rejects(()=>adapter.verifyArtifact(123,artifact,{jobId,attempt:2}));record=original;
 }
});
test('dispatch failures preserve lease for ambiguous outcomes',async()=>{
 let calls=0;
 const api=createWorkerApi({db:{query:async()=>{calls++;return {rows:[{id:jobId,attempt:1}]};}},authenticateWorker:async()=>true,dispatch:async()=>{throw Error('timeout');}});
 const response=await api(new Request('https://example.org/api/neon/worker/dispatch',{method:'POST',headers:{Authorization:'Bearer service'},body:JSON.stringify({jobId})}));
 assert.equal(response.status,502);assert.equal(calls,1);
});
test('callback client restricts dev origin and never retries fencing rejection',async()=>{
 assert.throws(()=>createCallbackClient({NEON_WORKER_API_URL:'https://production.example/'}));
 let calls=0;
 const callback=createCallbackClient({NEON_WORKER_API_URL:'https://br-quiet-hat-b5fslf7n-migrationapi.compute.c-7.us-east-2.aws.neon.tech',NEON_WORKER_TOKEN:'secret'},async()=>{calls++;return Response.json({}, {status:409});});
 await assert.rejects(()=>callback('progress'));assert.equal(calls,1);
});
