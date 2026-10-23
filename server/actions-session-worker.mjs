import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import {setTimeout as delay} from 'node:timers/promises';
import {run} from './project-build.mjs';
import {repositoryName} from './github.mjs';

/** Single GitHub Actions run for the full selection, not one per page. */
export async function migrateSessionWithActions(project,pages,{onPage,onMetadata,signal,runner=run,repository=process.env.MIGRATION_WORKER_REPOSITORY,pollMs=12000,data}={}){
 const repo=repositoryName(repository);
 if(!pages.length)throw new Error('Select pages before starting a session');
 const sessionId=project.sessionId || crypto.randomUUID();
 const cli=async(args,options={})=>{
  const result=await runner('gh',args,{timeout:options.timeout||60000});
  if(result.code!==0)throw new Error('GitHub session worker operation failed: '+args.slice(0,2).join(' '));
  return result;
 };
 const api=async endpoint=>JSON.parse((await cli(['api',endpoint])).stdout);
 let runId=project.sessionRunId||null;
 const restoredRun=runId;
 const seen=new Set();
 try{
  await onMetadata?.({sessionId,sessionRunId:runId,sessionFinished:false});
  if(!runId||project.sessionFinished||project.sessionResumeRequested){
   runId=null;
   await cli(['workflow','run','migration-session-worker.yml','--repo',repo,'--ref','main',
    '-f','session_id='+sessionId,
    '-f','selected_pages_json='+JSON.stringify(pages.map(x=>x.url)),
    '-f','visual_tolerance='+project.visualTolerance,
    ...(restoredRun?['-f','resume_run_id='+restoredRun]:[])]);
  }
  while(!signal?.aborted){
   if(!runId){
    const runs=await api(`repos/${repo}/actions/workflows/migration-session-worker.yml/runs?event=workflow_dispatch&per_page=100`);
    runId=runs.workflow_runs.find(x=>x.display_title==='Migration session '+sessionId&&x.id!==restoredRun)?.id;
    if(runId)await onMetadata?.({sessionId,sessionRunId:runId});
   }
   if(runId){
    // Poll page artifact checkpoints while the runner continues processing later pages.
    for(const sourceRun of [...new Set([...(restoredRun?[restoredRun]:[]),runId])]){
    for(let number=1;number<=Math.ceil(pages.length/100);number++){
     const listing=await api(`repos/${repo}/actions/runs/${sourceRun}/artifacts?per_page=100&page=${number}`);
     for(const item of listing.artifacts||[]){
      const m=new RegExp('^migration-session-'+sessionId+'-page-(\\d{5})$').exec(item.name);
      if(!m||seen.has(item.name)||item.expired)continue;
      const index=Number(m[1])-1;
      if(index<0||index>=pages.length)throw new Error('Unexpected session page artifact index');
      const dir=path.join(data,'session-downloads',sessionId,item.name);
      await fs.mkdir(dir,{recursive:true});
      await cli(['run','download',String(sourceRun),'--repo',repo,'--name',item.name,'--dir',dir],{timeout:180000});
      const checkpoint=JSON.parse(await fs.readFile(path.join(dir,'session-checkpoint.json'),'utf8'));
      const report=JSON.parse(await fs.readFile(path.join(dir,'report.json'),'utf8'));
      const url=pages[index].url;
      if(checkpoint.urls[index]!==url||!checkpoint.completed.some(x=>x.index===index&&x.url===url)||report.source!==url||report.build!=='passed'||report.qa?.notRun||!['verified','needs-review'].includes(report.status)){
       throw new Error('Untrusted or incomplete page checkpoint artifact');
      }
      const localId=crypto.randomUUID(),output=path.join(data,localId);
      const zip=await JSZip.loadAsync(await fs.readFile(path.join(dir,'migration.zip')));
      await fs.mkdir(output,{recursive:true});
      for(const [name,entry] of Object.entries(zip.files)){
       if(entry.dir)continue;
       if(name.includes('\\')||name.startsWith('/')||name.split('/').includes('..'))throw new Error('Unsafe path in migration ZIP');
       const target=path.resolve(output,name);
       if(!target.startsWith(output+path.sep))throw new Error('Unsafe migration ZIP entry');
       await fs.mkdir(path.dirname(target),{recursive:true});
       await fs.writeFile(target,await entry.async('nodebuffer'));
      }
      await fs.copyFile(path.join(dir,'migration.zip'),path.join(output,'migration.zip'));
      const archived=JSON.parse(await fs.readFile(path.join(output,'report.json'),'utf8'));
      if(archived.source!==report.source||archived.status!==report.status)throw new Error('Report differs from migration archive');
      await onPage?.({page:pages[index],report,jobId:localId,runId:sourceRun,artifactId:item.id});
      seen.add(item.name);
     }
    }
    }
    const current=await api(`repos/${repo}/actions/runs/${runId}`);
    if(current.status==='completed'){
     await onMetadata?.({sessionId,sessionRunId:runId,sessionFinished:true});
     if(current.conclusion!=='success')throw new Error('Session worker interrupted or failed. Completed pages were checkpointed; resume the remaining pages.');
     return {sessionId,runId,completed:seen.size};
    }
   }
   await delay(pollMs,undefined,{signal});
  }
  throw new Error('Session stopped');
 } finally {
  if(signal?.aborted&&runId)await cli(['run','cancel',String(runId),'--repo',repo]).catch(()=>{});
 }
}
export async function setSessionFinish(project,{runner=run,repository=process.env.MIGRATION_WORKER_REPOSITORY}={}){
 if(!project.sessionId||!Number.isSafeInteger(Number(project.sessionRunId))||Number(project.sessionRunId)<1)throw new Error('Wait for the Actions migration run to start before sending Finish');
 const repo=repositoryName(repository);
 const result=await runner('gh',['workflow','run','migration-session-control.yml','--repo',repo,'--ref','main',
  '-f','session_id='+project.sessionId,'-f','target_run_id='+String(project.sessionRunId)],{timeout:60000});
 if(result.code!==0)throw new Error('Could not notify the session worker to finish after the active page');
}
