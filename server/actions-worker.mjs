import fs from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {run} from './project-build.mjs';
import {repositoryName} from './github.mjs';
export function validateWorkerResult(job,result,report){
 if(result.jobId!==job.id||result.url!==job.url)throw new Error('The worker artifact does not belong to this page.');
 if(!result.browserExecuted||report.qa?.notRun||!report.qa?.checks?.length)throw new Error('The remote worker did not execute browser QA.');
 if(report.build!=='passed'||!['verified','needs-review'].includes(report.status)||result.status!==report.status)throw new Error('The worker did not return a completed Astro build.');
 return report;
}
export async function migrateWithActions(job,root,{signal,update,runner=run,repository=process.env.MIGRATION_WORKER_REPOSITORY,pollMs=12000}={}){
 const repo=repositoryName(repository);
 const cli=async(args,{allowFailure=false,...options}={})=>{const result=await runner('gh',args,{timeout:60000,...options});if(result.code!==0&&!allowFailure)throw new Error('GitHub worker request failed. Check GitHub sign-in, Actions permissions and the workflow run.');return result;};
 const api=async endpoint=>JSON.parse((await cli(['api',endpoint])).stdout);
 let runId;
 try {
  update({stage:'worker',progress:2,message:'Starting GitHub Actions browser worker.'});
  await cli(['workflow','run','migration-page-worker.yml','--repo',repo,'--ref','main','-f','job_id='+job.id,'-f','source_url='+job.url,'-f','visual_tolerance='+job.visualTolerance]);
  while(!signal.aborted){
   if(!runId){const runs=await api(`repos/${repo}/actions/workflows/migration-page-worker.yml/runs?event=workflow_dispatch&per_page=100`);runId=runs.workflow_runs.find(r=>r.display_title==='Migration page '+job.id)?.id;}
   if(runId){const current=await api(`repos/${repo}/actions/runs/${runId}`);update({stage:'worker',progress:current.status==='queued'?3:15,message:`GitHub browser worker ${current.status}. Run: https://github.com/${repo}/actions/runs/${runId}`});if(current.status==='completed'){
    await fs.mkdir(root,{recursive:true});
    const download=await cli(['run','download',String(runId),'--repo',repo,'--name','migration-'+job.id,'--dir',root],{allowFailure:true,timeout:180000});
    if(download.code!==0)throw new Error('The GitHub worker finished without a downloadable result. Open its Actions run for details.');
    const workerError=await fs.readFile(root+'/worker-error.json','utf8').then(JSON.parse).catch(()=>null);
    if(workerError)throw new Error('GitHub browser worker failed: '+String(workerError.message).slice(0,2000));
    if(current.conclusion!=='success')throw new Error('GitHub browser worker did not finish successfully: '+current.conclusion);
    const result=JSON.parse(await fs.readFile(root+'/worker-result.json','utf8')),report=JSON.parse(await fs.readFile(root+'/report.json','utf8'));
    validateWorkerResult(job,result,report);
    await fs.writeFile(root+'/worker-provenance.json',JSON.stringify({repository:repo,runId,commit:current.head_sha,url:current.html_url}));
    return report;
   }}
   await delay(pollMs,undefined,{signal});
  }
  throw new Error('Remote migration cancelled.');
 } finally {
  if(signal.aborted&&runId)await cli(['run','cancel',String(runId),'--repo',repo],{allowFailure:true}).catch(()=>{});
 }
}
