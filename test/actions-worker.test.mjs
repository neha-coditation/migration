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
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {migrateWithActions} from '../server/actions-worker.mjs';
test('Actions worker dispatches the exact page and downloads a matching measured result',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'actions-worker-'));
 const calls=[];
 const runner=async(_command,args)=>{
  calls.push(args);
  if(args[0]==='api')return {code:0,stdout:JSON.stringify(args[1].includes('workflows/')?{workflow_runs:[{id:42,display_title:'Migration page '+job.id}]}:{status:'completed',conclusion:'success',head_sha:'commit-1',html_url:'https://github.com/example/repo/actions/runs/42'})};
  if(args[0]==='run'&&args[1]==='download'){
   await fs.writeFile(path.join(root,'worker-result.json'),JSON.stringify(result));
   await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report));
  }
  return {code:0,stdout:''};
 };
 try {
  const actual=await migrateWithActions(job,root,{signal:new AbortController().signal,update:()=>{},runner,repository:'example/repo',pollMs:1});
  assert.equal(actual.status,'needs-review');
  assert.ok(calls[0].includes('source_url='+job.url));
  assert.ok(calls.some(args=>args[0]==='run'&&args[1]==='download'));
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'worker-provenance.json'))).runId,42);
 } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('cancelled remote work cancels its exact Actions run',async()=>{
 const controller=new AbortController(),calls=[];
 const runner=async(_command,args)=>{
  calls.push(args);
  if(args[0]==='api'){
   if(args[1].includes('workflows/'))return {code:0,stdout:JSON.stringify({workflow_runs:[{id:73,display_title:'Migration page '+job.id}]})};
   controller.abort();return {code:0,stdout:JSON.stringify({status:'in_progress'})};
  }
  return {code:0,stdout:''};
 };
 await assert.rejects(()=>migrateWithActions(job,'unused',{signal:controller.signal,update:()=>{},runner,repository:'example/repo',pollMs:1}));
 assert.ok(calls.some(args=>args[0]==='run'&&args[1]==='cancel'&&args[2]==='73'));
});
