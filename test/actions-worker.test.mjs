import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWorkerResult} from '../server/actions-worker.mjs';
const job={id:'job-1',url:'https://example.com/about'};
const result={jobId:job.id,url:job.url,browserExecuted:true,status:'needs-review'};
const report={build:'passed',status:'needs-review',qa:{notRun:false,checks:[{route:'/about'}]}};
test('remote worker keeps review findings and requires actual QA and build evidence',()=>{
 assert.equal(validateWorkerResult(job,result,report).status,'needs-review');
 assert.throws(()=>validateWorkerResult(job,{...result,jobId:'other'},report),/does not belong/);
 assert.throws(()=>validateWorkerResult(job,{...result,url:'https://other.example/'},report),/does not belong/);
 assert.throws(()=>validateWorkerResult(job,result,{...report,qa:{notRun:true,checks:[]}}),/browser QA/);
 assert.throws(()=>validateWorkerResult(job,result,{...report,build:'failed'}),/completed Astro/);
 assert.throws(()=>validateWorkerResult(job,{...result,status:'verified'},report),/completed Astro/);
});
