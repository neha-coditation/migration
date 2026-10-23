import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProductionWorker} from '../server/neon/production-worker.mjs';
import {createCallbackClient} from '../scripts/neon-worker-client.mjs';
import {createGitHubWorker} from '../server/neon/worker-api.mjs';
const hash=createHash('sha256').update('production-machine').digest('hex');
const release='a'.repeat(40);
const options={tokenHash:hash,ref:'production-worker-20261023',releaseCommit:release};
const request=(path,token='production-machine',body={})=>new Request('https://production.test'+path,{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)});

test('production worker rejects dashboard routes even with valid machine credentials',async()=>{
 let calls=0;const handle=createProductionWorker({...options,db:{query:async()=>{calls++;}}});
 assert.equal((await handle(request('/api/neon/projects'))).status,401);
 assert.equal((await handle(request('/api/neon/worker/dispatch','development-token'))).status,401);
 assert.equal(calls,0);
});
test('production worker fails closed without pinned release or service credential',()=>{
 const db={query:async()=>({rows:[]})};
 for(const patch of [{releaseCommit:null},{ref:''},{tokenHash:'invalid'}]) assert.throws(()=>createProductionWorker({...options,db,...patch}));
});
test('production dispatch requires a separate request-scoped GitHub credential',async()=>{
 let calls=0;const handle=createProductionWorker({...options,db:{query:async()=>{calls++;return {rows:[]};}}});
 assert.equal((await handle(request('/api/neon/worker/dispatch'))).status,503);
 assert.equal(calls,0);
});
test('worker environment profiles cannot send credentials across dev and production',async()=>{
 const production='https://br-proud-hall-b5rtedf4-migrationworker.compute.c-7.us-east-2.aws.neon.tech';
 const development='https://br-quiet-hat-b5fslf7n-migrationapi.compute.c-7.us-east-2.aws.neon.tech';
 assert.throws(()=>createCallbackClient({NEON_WORKER_API_URL:production,NEON_WORKER_TOKEN:'x'}));
 assert.throws(()=>createCallbackClient({MIGRATION_ENVIRONMENT:'production',NEON_WORKER_API_URL:development,NEON_WORKER_TOKEN:'x'}));
 assert.throws(()=>createCallbackClient({MIGRATION_ENVIRONMENT:'typo',NEON_WORKER_API_URL:production,NEON_WORKER_TOKEN:'x'}));
 const client=createCallbackClient({MIGRATION_ENVIRONMENT:'production',NEON_WORKER_API_URL:production,NEON_WORKER_TOKEN:'x'},async()=>Response.json({ok:true}));
 assert.equal((await client('claim')).ok,true);
});
test('production dispatch selects production workflow and rejects artifact from a different commit',async()=>{
 let dispatched;
 const worker=createGitHubWorker({repository:'neha-coditation/migration',ref:options.ref,workflow:'neon-production-page-worker.yml',expectedCommit:release,
  fetcher:async(url,config)=>{if(url.endsWith('/dispatches')){dispatched=url;return new Response(null,{status:204});}return Response.json({name:'neon-j-1',workflow_run:{id:3,head_sha:'b'.repeat(40)},expired:false,expires_at:'2099-01-01T00:00:00Z',digest:'sha256:'+'f'.repeat(64),size_in_bytes:1});}});
 await worker.dispatch({jobId:'j',workerId:'w',attempt:1},{githubToken:'ephemeral'});
 assert.match(dispatched,/neon-production-page-worker.yml\/dispatches$/);
 await assert.rejects(()=>worker.verifyArtifact(3,{id:1,sha256:'f'.repeat(64),bytes:1},{jobId:'j',attempt:1},{githubToken:'ephemeral'}),/provenance/);
});
