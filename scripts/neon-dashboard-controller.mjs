import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const REPO='neha-coditation/migration';
const WORKER='https://br-proud-hall-b5rtedf4-migrationworker.compute.c-7.us-east-2.aws.neon.tech';
export function validArchivePaths(names){return names.every(name=>!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').includes('..'));}
export function verifyArtifact(job,item){if(item.id!==job.artifact.id||item.workflow_run?.id!==Number(job.runId)||item.expired||item.digest!=='sha256:'+job.artifact.sha256||item.size_in_bytes!==job.artifact.bytes||item.name!==`neon-${job.jobId}-${job.attempt}`)throw Error('Artifact provenance mismatch');}
const command=(program,args,output)=>new Promise((resolve,reject)=>{
 const child=spawn(program,args,{stdio:['ignore',output?'pipe':'pipe','pipe']});const chunks=[],errors=[];
 child.stdout.on('data',chunk=>chunks.push(chunk));child.stderr.on('data',chunk=>errors.push(chunk));
 child.on('error',reject);child.on('close',code=>code===0?resolve(Buffer.concat(chunks)):reject(new Error('Controller command failed: '+program)));
});
export async function runController(env=process.env){
 const origin=new URL(env.STUDIO_URL);if(origin.protocol!=='https:'||origin.hostname!=='migration-studio-testing-neha.woolly-vale-7768.chatgpt.site'||origin.pathname!=='/')throw Error('Expected registered private Studio origin');
 if(!env.STUDIO_SERVICE_TOKEN||!env.STUDIO_CONTROLLER_TOKEN||!env.GH_TOKEN||!env.NEON_PROD_WORKER_TOKEN)throw Error('Controller credentials missing');
 const call=async(route,{method='POST',body={},binary}={})=>{
  const response=await fetch(new URL('/api/studio/internal/'+route,origin),{method,headers:{'OAI-Sites-Authorization':'Bearer '+env.STUDIO_SERVICE_TOKEN,'X-Controller-Token':env.STUDIO_CONTROLLER_TOKEN,'Content-Type':binary?'application/octet-stream':'application/json'},body:binary||JSON.stringify(body),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Studio sync rejected: '+response.status);return response.json();
 };
 const gh=async endpoint=>JSON.parse((await command('gh',['api',`repos/${REPO}/${endpoint}`])).toString());
 const plan=await call('plan');let failures=0;
 for(const job of plan.jobs){try{
  if(job.status==='queued'&&!job.stopRequested){
   const response=await fetch(WORKER+'/api/neon/worker/dispatch',{method:'POST',headers:{Authorization:'Bearer '+env.NEON_PROD_WORKER_TOKEN,'X-GitHub-Token':env.GH_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({jobId:job.jobId}),signal:AbortSignal.timeout(60000)});
   if(![202,409].includes(response.status))throw Error('Worker dispatch rejected: '+response.status);
   console.log(JSON.stringify({jobId:job.jobId,event:response.status===202?'dispatched':'already-claimed'}));
  }
  if(job.status==='running'&&job.stopRequested&&job.runId){
   const current=await gh(`actions/runs/${job.runId}`);
   if(current.status!=='completed')await command('gh',['api','--method','POST',`repos/${REPO}/actions/runs/${job.runId}/cancel`]);
   else if(current.conclusion==='cancelled')await call('cancelled',{body:{jobId:job.jobId,runId:Number(job.runId)}});
  }
  if(!job.needsImport)continue;
  const artifact=await gh(`actions/artifacts/${job.artifact.id}`);verifyArtifact(job,artifact);
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'studio-evidence-'));
  try{
   const archive=path.join(directory,'evidence.zip');await fs.writeFile(archive,await command('gh',['api',`repos/${REPO}/actions/artifacts/${job.artifact.id}/zip`]));
   const names=(await command('unzip',['-Z1',archive])).toString().split('\n').filter(Boolean);if(!validArchivePaths(names))throw Error('Unsafe artifact paths');
   const extracted=path.join(directory,'files');await fs.mkdir(extracted);await command('unzip',['-q',archive,'-d',extracted]);
   const files=['report.json','qa.json','worker-result.json','migration.zip',...names.filter(n=>/^evidence\/(source|local|diff)\/[a-zA-Z0-9_.-]+(?:--|-)(top|middle|bottom)\.png$/.test(n))];
   for(const name of files){const data=await fs.readFile(path.join(extracted,name));await call(`evidence/${job.jobId}/${job.runId}/${job.attempt}/${name}`,{method:'PUT',binary:data});}
   const index={jobId:job.jobId,runId:Number(job.runId),attempt:job.attempt,artifactId:job.artifact.id,artifactSha256:job.artifact.sha256,files,importedAt:new Date().toISOString()};
   await call(`evidence/${job.jobId}/${job.runId}/${job.attempt}/index.json`,{method:'PUT',binary:Buffer.from(JSON.stringify(index))});
   console.log(JSON.stringify({jobId:job.jobId,event:'evidence-synced',files:files.length}));
  }finally{await fs.rm(directory,{recursive:true,force:true});}
 }catch(error){failures++;console.error(JSON.stringify({jobId:job.jobId,event:'sync-failed',error:error.message}));}}
 if(failures)throw Error(`${failures} controller operations failed`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runController().catch(error=>{console.error(error.message);process.exitCode=1;});
