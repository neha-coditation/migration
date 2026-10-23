import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import {migrateSessionWithActions,setSessionFinish} from '../server/actions-session-worker.mjs';

test('one Actions dispatch ingests a completed page artifact with its QA evidence',async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'actions-session-test-'));
 const sessionId='11111111-1111-4111-8111-111111111111';
 const url='https://example.com/';
 const calls=[],pages=[{url,route:'/'}],seen=[];
 const report={source:url,status:'needs-review',build:'passed',qa:{notRun:false,checks:[{route:'/'}]},pages:[],resources:0,warnings:[],failures:[]};
 const zip=new JSZip();
 zip.file('report.json',JSON.stringify(report));
 zip.file('astro-project/src/data/pages.json','[]');
 zip.file('resource-map.json',JSON.stringify([{file:'css/site.css',url:'https://example.com/site.css'}]));
 const bytes=await zip.generateAsync({type:'nodebuffer'});
 const runner=async(program,args)=>{
  assert.equal(program,'gh');calls.push(args);
  if(args[0]==='workflow')return {code:0,stdout:''};
  if(args[0]==='run'&&args[1]==='download'){
   const dir=args[args.indexOf('--dir')+1];await fs.mkdir(dir,{recursive:true});
   await fs.writeFile(path.join(dir,'migration.zip'),bytes);
   await fs.mkdir(path.join(dir,'captured','resources','css'),{recursive:true});
   await fs.writeFile(path.join(dir,'captured','resources','css','site.css'),'body{margin:0}');
   await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report));
   await fs.writeFile(path.join(dir,'session-checkpoint.json'),JSON.stringify({runId:99,urls:[url],completed:[{index:0,url,status:'needs-review'}]}));
   return {code:0,stdout:''};
  }
  if(args[0]==='api'){
   if(args[1].includes('/artifacts?'))return {code:0,stdout:JSON.stringify({artifacts:[{name:'migration-session-'+sessionId+'-page-00001',id:42,workflow_run:{id:99}}]})};
   if(args[1].includes('/runs?'))return {code:0,stdout:JSON.stringify({workflow_runs:[{id:99,display_title:'Migration session '+sessionId}]})};
   if(args[1].endsWith('/runs/99'))return {code:0,stdout:JSON.stringify({status:'completed',conclusion:'success'})};
  }
  throw Error('Unexpected gh call: '+args.join(' '));
 };
 try{
  const result=await migrateSessionWithActions({sessionId,visualTolerance:0},pages,{
   data,runner,repository:'owner/repo',pollMs:1,
   onPage:async x=>seen.push(x),onMetadata:async()=>{}
  });
  assert.equal(result.completed,1);
  assert.equal(calls.filter(args=>args[0]==='workflow').length,1);
  assert.equal(seen.length,1);
  assert.equal(seen[0].page.url,url);
  assert.equal(seen[0].report.status,'needs-review');
  assert.equal(seen[0].artifactId,42);
  const saved=await fs.readFile(path.join(data,seen[0].jobId,'report.json'),'utf8');
  assert.equal(JSON.parse(saved).source,url);
  assert.equal(await fs.readFile(path.join(data,seen[0].jobId,'captured','resources','css','site.css'),'utf8'),'body{margin:0}');
 }finally{await fs.rm(data,{recursive:true,force:true});}
});
test('Finish migration dispatches a control workflow fenced to this run',async()=>{
 const calls=[];
 await setSessionFinish({sessionId:'11111111-1111-4111-8111-111111111111',sessionRunId:99},{
  repository:'owner/repo',runner:async(program,args)=>{calls.push(args);return {code:0};}
 });
 assert.deepEqual(calls,[['workflow','run','migration-session-control.yml','--repo','owner/repo','--ref','main','-f','session_id=11111111-1111-4111-8111-111111111111','-f','target_run_id=99']]);
});
