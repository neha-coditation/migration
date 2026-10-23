import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createUrlPolicy,routePath} from '../server/url-policy.mjs';
import {migrate} from '../server/pipeline.mjs';
import {runMigrationSession} from '../server/session-engine.mjs';
import {launchBrowser} from '../server/browser.mjs';

const sessionId=process.env.MIGRATION_SESSION_ID;
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId||''))throw new Error('A session UUID is required');
const raw=JSON.parse(process.env.MIGRATION_SESSION_PAGES_JSON||'null');
if(!Array.isArray(raw)||!raw.length||raw.some(x=>typeof x!=='string'))throw new Error('Expected an array of source page URLs');
const urlPolicy=createUrlPolicy(),pages=[];
for(const url of raw){
 const allowed=await urlPolicy(url);
 if(pages.length&&allowed.origin!==new URL(pages[0]).origin)throw new Error('All pages must use one source origin');
 const value=allowed.href;
 if(!pages.some(x=>routePath(x)===routePath(value)))pages.push(value);
}
const root=path.resolve('worker-output',sessionId);
await fs.mkdir(root,{recursive:true});
// Runner setup occurs once. Each migration still gets independent Chromium QA.
const browser=await launchBrowser();
try{const page=await browser.newPage();await page.goto('about:blank');}
finally{await browser.close();}
const artifact=await import('@actions/artifact');
const runId=process.env.GITHUB_RUN_ID;
if(!runId)throw new Error('GitHub Actions run context required');
const idPrefix=`migration-session-${sessionId}-page-`;
const tolerance=Number(process.env.MIGRATION_VISUAL_TOLERANCE||0);
if(!Number.isFinite(tolerance)||tolerance<0||tolerance>2)throw new Error('Invalid visual tolerance');
const results=await runMigrationSession({
 urls:pages,root,
 runPage:async({url,directory,index})=>{
  const job={id:randomUUID(),url,maxPages:1,extraPaths:[],visualTolerance:tolerance,maxRepairAttempts:3};
  const controller=new AbortController();
  console.log(JSON.stringify({event:'page-start',sessionId,index,route:routePath(url)}));
  const report=await migrate(job,directory,{signal:controller.signal,update:x=>console.log(JSON.stringify({event:'progress',sessionId,index,stage:x.stage,progress:x.progress}))});
  if(report.qa?.notRun || report.build!=='passed')throw new Error('Browser QA or Astro build did not complete');
  return {status:report.status,jobId:job.id};
 },
 checkpoint:async({directory,index,state})=>{
  const manifest=path.join(directory,'session-checkpoint.json');
  await fs.writeFile(manifest,JSON.stringify({...state,runId},null,2));
  const name=idPrefix+String(index+1).padStart(5,'0');
  const resourceDir=path.join(directory,'captured','resources');
  const files=[manifest,path.join(directory,'report.json'),path.join(directory,'migration.zip')];
  async function collect(folder){
   for(const entry of await fs.readdir(folder,{withFileTypes:true})){
    const location=path.join(folder,entry.name);
    if(entry.isDirectory())await collect(location);
    else if(entry.isFile())files.push(location);
   }
  }
  await collect(resourceDir);
  const uploaded=await artifact.uploadArtifact(name,files,directory,{retentionDays:7});
  if(!uploaded.id)throw new Error('GitHub did not confirm a durable artifact ID');
  console.log(JSON.stringify({event:'page-checkpoint',sessionId,index,artifactId:uploaded.id}));
 },
 shouldFinish:async()=>{
  // A small separate workflow records the finish request. The migration worker
  // checks only between pages; it never cancels an in-progress Chromium run.
  const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPOSITORY;
  if(!token||!repo)throw new Error('Actions read access required for graceful Finish migration');
  const response=await fetch(`https://api.github.com/repos/${repo}/actions/workflows/migration-session-control.yml/runs?event=workflow_dispatch&per_page=100`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Could not check whether this migration session should finish');
  const listing=await response.json();
  return (listing.workflow_runs||[]).some(run=>run.display_title===`Finish migration ${sessionId} run ${runId}`);
 }
});
console.log(JSON.stringify({event:'session-complete',sessionId,completed:results.completed.length,selected:pages.length,finishedEarly:results.finishedEarly}));
