import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/projects.mjs';

test('batch dashboard dispatches one worker session and Finish waits for current page checkpoint',async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'project-session-'));
 let release,notifyReady;
 const ready=new Promise(resolve=>notifyReady=resolve);
 const held=new Promise(resolve=>release=resolve);
 const signals=[],combinations=[],dispatches=[];
 const pages=['/','/about','/insights'].map(route=>({
  route,url:'https://example.com'+route,status:'not-started',jobIds:[]
 }));
 const service=new ProjectService(data,{
  getJob:()=>null,
  runSession:async(p,chosen,onPage,onMetadata)=>{
   dispatches.push(chosen.map(x=>x.route));
   await onMetadata({sessionId:'11111111-1111-4111-8111-111111111111',sessionRunId:123});
   notifyReady();await held;
   await onPage({
    page:chosen[0],jobId:'completed-page-id',runId:123,artifactId:456,
    report:{source:chosen[0].url,status:'needs-review',build:'passed',qa:{notRun:false,checks:[{comparisons:[]}]},pages:[{}],warnings:[],failures:[]}
   });
   return {completed:1};
  },
  requestSessionFinish:async p=>{signals.push(p.sessionRunId);},
 });
 await service.init();
 const p={id:'project-session',url:'https://example.com/',origin:'https://example.com',status:'ready',pages};
 service.projects.set(p.id,p);
 service.combineReviewed=async(id,routes,options)=>{combinations.push({routes,options});p.combined={routes,status:'needs-review'};p.status='needs-review';return p;};
 try{
  await service.start(p.id,{routes:pages.map(x=>x.route),approvalMode:'batch'});
  await ready;
  await service.finish(p.id);
  assert.deepEqual(signals,[123]);assert.equal(p.pages[0].status,'not-started');
  release();
  for(let i=0;i<100&&service.running.has(p.id);i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(service.running.has(p.id),false);
  assert.deepEqual(dispatches,[['/','/about','/insights']]);
  assert.deepEqual(combinations,[{routes:['/'],options:{allowUnreviewed:true}}]);
  assert.equal(p.pages[0].status,'needs-review');
  assert.equal(p.pages[1].status,'not-started');
  assert.equal(p.combined.status,'needs-review');
 }finally{release();await fs.rm(data,{recursive:true,force:true});}
});
