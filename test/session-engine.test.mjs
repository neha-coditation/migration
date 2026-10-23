import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runMigrationSession} from '../server/session-engine.mjs';

test('one worker session checkpoints after each page and skips finished pages on resume',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'session-'));
 const urls=['https://example.com/','https://example.com/about','https://example.com/blog'];
 const ran=[],stored=[];
 const runPage=async({url})=>{ran.push(url);return {status:'needs-review'};};
 const checkpoint=async({url})=>stored.push(url);
 try{
  let finish=false;
  const first=await runMigrationSession({urls,root,runPage,checkpoint,shouldFinish:async()=>finish,reportProgress:({stage})=>{if(stage==='checkpointed')finish=true;}});
  assert.deepEqual(ran,[urls[0]]);
  assert.equal(first.finishedEarly,true);
  assert.equal(first.completed.length,1);
  const second=await runMigrationSession({urls,root,runPage,checkpoint});
  assert.deepEqual(ran,urls);
  assert.deepEqual(stored,urls);
  assert.equal(second.completed.length,3);
  assert.equal(second.finishedEarly,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('artifact upload failure never records a completed page',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'session-failed-'));
 const urls=['https://example.com/'];
 try{
  await assert.rejects(()=>runMigrationSession({urls,root,runPage:async()=>({status:'verified'}),checkpoint:async()=>{throw Error('upload unavailable');}}),/upload unavailable/);
  const state=JSON.parse(await fs.readFile(path.join(root,'session.json'),'utf8'));
  assert.equal(state.completed.length,0);assert.equal(state.failed.length,1);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('resuming a changed page list is rejected',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'session-mismatch-'));
 try{
  await runMigrationSession({urls:['https://example.com/'],root,runPage:async()=>({status:'verified'}),checkpoint:async()=>{}});
  await assert.rejects(()=>runMigrationSession({urls:['https://example.com/new'],root,runPage:async()=>({status:'verified'}),checkpoint:async()=>{}}),/selection does not match/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
