import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/projects.mjs';

test('Finish migration allows active page to finish, skips rest and drafts only completed routes', async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'graceful-finish-'));
 let release;let started;
 const startedPromise=new Promise(resolve=>started=resolve);
 const gate=new Promise(resolve=>release=resolve);
 const visited=[],combined=[];
 const svc=new ProjectService(dir,{getJob:()=>null,runPage:async(input,created)=>{
  const id='job-'+visited.length;visited.push(input.url);
  const job={id,status:'needs-review'};await created(job);
  started();await gate;
  await fs.mkdir(path.join(dir,id),{recursive:true});
  await fs.writeFile(path.join(dir,id,'report.json'),JSON.stringify({status:'needs-review',qa:{notRun:false,checks:[{comparisons:[]}]},pages:[{}],warnings:[],failures:[]}));
  return job;
 }});
 svc.combineReviewed=async(id,routes,options)=>{combined.push({id,routes,options});const p=svc.get(id);p.combined={createdAt:new Date().toISOString(),routes,status:'needs-review'};p.status='needs-review';return p;};
 const pages=['/','/two','/three'].map(route=>({route,url:'https://example.com'+route,jobIds:[]}));
 const p={id:'test-project',url:'https://example.com/',origin:'https://example.com',status:'ready',pages};
 svc.projects.set(p.id,p);
 try {
  await svc.start(p.id,{routes:pages.map(x=>x.route),approvalMode:'batch'});
  await startedPromise;
  await svc.finish(p.id);
  assert.equal(p.finishRequested,true);
  assert.equal(p.pages[0].status,'migrating');
  release();
  for(let i=0;i<200&&svc.running.has(p.id);i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(svc.running.has(p.id),false);
  assert.deepEqual(visited,['https://example.com/']);
  assert.deepEqual(combined,[{id:p.id,routes:['/'],options:{allowUnreviewed:true}}]);
  assert.equal(p.pages[0].status,'needs-review');
  assert.equal(p.pages[1].status,'not-started');
  assert.equal(p.status,'needs-review');
 } finally {release();await fs.rm(dir,{recursive:true,force:true});}
});
