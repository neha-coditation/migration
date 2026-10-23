import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {BrowserHealth} from './browser-health.mjs';
import {ProjectService} from './projects.mjs';
import {GitHubService} from './github.mjs';
import {migrate} from './pipeline.mjs';
import {migrateWithActions} from './actions-worker.mjs';
import {createUrlPolicy} from './url-policy.mjs';
import {inside,staticResponse,writeJSON,readJSON,preview} from './files.mjs';
const ROOT=path.resolve(fileURLToPath(new URL('..',import.meta.url)));const DATA=path.resolve(process.env.MIGRATION_DATA_DIR||path.join(ROOT,'data'));await fs.mkdir(DATA,{recursive:true});if(!process.env.MIGRATION_WORKER_REPOSITORY){try{process.env.MIGRATION_WORKER_REPOSITORY=(await readJSON(path.join(DATA,'worker-config.json'))).repository||'';}catch{}}const jobs=new Map(),controllers=new Map(),previews=new Map();let active=false;const PORT=Number(process.env.PORT||4360);const policy=createUrlPolicy();
for(const name of await fs.readdir(DATA)){if(!/^[a-f\d-]{36}$/.test(name))continue;try{const job=await readJSON(path.join(DATA,name,'job.json'));if(['queued','running'].includes(job.status)){job.status='interrupted';job.message='The app stopped during this migration. Start a new job to retry.';}jobs.set(job.id,job);}catch{}}
const browserHealth=new BrowserHealth();
const waiters=new Map();
let saveChain=Promise.resolve();
function save(job){const snapshot=JSON.parse(JSON.stringify(job));saveChain=saveChain.catch(()=>{}).then(()=>writeJSON(path.join(DATA,job.id,'job.json'),snapshot));return saveChain;}
async function processQueue(){if(active)return;const job=[...jobs.values()].find(x=>x.status==='queued');if(!job)return;active=true;job.status='running';job.startedAt=new Date().toISOString();const controller=new AbortController();controllers.set(job.id,controller);const timer=setTimeout(()=>controller.abort(),45*60*1000);
 const update=delta=>{Object.assign(job,delta,{updatedAt:new Date().toISOString()});job.events.push({at:job.updatedAt,stage:job.stage,message:job.message});job.events=job.events.slice(-200);save(job).catch(()=>{});};
 try{update({stage:'discover',progress:1,message:'Starting migration'});const report=await (process.env.MIGRATION_WORKER_REPOSITORY?migrateWithActions:migrate)(job,path.join(DATA,job.id),{signal:controller.signal,update});Object.assign(job,{status:report.status,stage:'complete',progress:100,message:report.status==='verified'?'Build and measured QA checks passed':'Astro build completed. Review the QA findings.',summary:{pages:report.pages.length,resources:report.resources,failures:report.failures,warnings:report.warnings},completedAt:new Date().toISOString()});}
 catch(error){job.status=controller.signal.aborted?'cancelled':'failed';job.message=error.message.slice(0,10000);job.stage='stopped';job.completedAt=new Date().toISOString();await fs.writeFile(path.join(DATA,job.id,'failure.log'),error.stack||error.message);}
 finally{clearTimeout(timer);controllers.delete(job.id);await save(job);active=false;waiters.get(job.id)?.(job);waiters.delete(job.id);processQueue();}
}
async function createJob(input){
 const source=await policy(String(input.url||'')),maxPages=Number(input.maxPages??3);if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)throw new Error('Choose between 1 and 20 pages.');
 const extraPaths=Array.isArray(input.extraPaths)?input.extraPaths:String(input.extraPaths||'').split('\n').map(s=>s.trim()).filter(Boolean);if(extraPaths.length>30)throw new Error('At most 30 additional paths are supported.');for(const p of extraPaths)if(new URL(p,source).origin!==source.origin)throw new Error('Additional paths must use the same website origin.');
 const job={id:crypto.randomUUID(),url:source.href,maxPages,extraPaths,projectId:input.projectId,visualTolerance:input.visualTolerance??2,maxRepairAttempts:input.maxRepairAttempts??0,status:'queued',stage:'queued',progress:0,message:'Waiting to start',events:[],createdAt:new Date().toISOString()};jobs.set(job.id,job);await save(job);return job;
}
async function cancelJob(id){const job=jobs.get(id);if(!job)return;if(job.status==='queued'){job.status='cancelled';job.message='Cancelled before starting.';await save(job);waiters.get(id)?.(job);waiters.delete(id);}controllers.get(id)?.abort();}
const projects=new ProjectService(DATA,{getJob:id=>jobs.get(id),runPage:async(input,onCreated)=>{const job=await createJob(input);const done=new Promise(resolve=>waiters.set(job.id,resolve));await onCreated(job);processQueue();return done;}});await projects.init();const github=new GitHubService(projects);
async function checkingBrowserStatus(force=false){if(process.env.MIGRATION_WORKER_REPOSITORY){const auth=await github.status();return {status:auth.connected?'remote':'unavailable',message:auth.connected?'Migration and browser QA use GitHub Actions.':'Connect GitHub to run the checking worker.',action:'Worker repository: '+process.env.MIGRATION_WORKER_REPOSITORY+'. Each page keeps its actual QA result; remote setup does not approve previous unchecked pages.'};}return browserHealth.check({force});}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>4*1024*1024)throw new Error('Request body exceeds limit.');}return JSON.parse(text||'{}');}
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 try{
  const host=req.headers.host||'';if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)){json(res,403,{error:'Local access only.'});return;}
  if(req.method==='POST'&&req.headers.origin&&!['http://'+host,'http://127.0.0.1:'+PORT,'http://localhost:'+PORT].includes(req.headers.origin)){json(res,403,{error:'Cross-origin requests are not allowed.'});return;}
  if(url.pathname==='/api/jobs'&&req.method==='GET'){json(res,200,{jobs:[...jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});return;}
  if(url.pathname==='/api/jobs'&&req.method==='POST'){
   if([...jobs.values()].filter(j=>['queued','running'].includes(j.status)).length>=5){json(res,429,{error:'Five jobs are already queued or running.'});return;}
   const job=await createJob(await body(req));json(res,202,{job});processQueue();return;
  }
  if(url.pathname==='/api/browser/status'&&req.method==='GET'){json(res,200,await checkingBrowserStatus());return;}
  if(url.pathname==='/api/browser/recheck'&&req.method==='POST'){json(res,200,await checkingBrowserStatus(true));return;}
  if(url.pathname==='/api/browser/setup'&&req.method==='POST'){json(res,202,browserHealth.install());return;}
  if(url.pathname==='/api/projects'&&req.method==='GET'){json(res,200,{projects:projects.list()});return;}
  if(url.pathname==='/api/projects'&&req.method==='POST'){const input=await body(req);json(res,202,{project:projects.view(await projects.create(String(input.url||'')))});return;}
  if(url.pathname==='/api/git/status'&&req.method==='GET'){json(res,200,await github.status());return;}
  if(url.pathname==='/api/git/connect'&&req.method==='POST'){json(res,202,await github.connect());return;}
  if(url.pathname==='/api/git/repositories'&&req.method==='GET'){json(res,200,{repositories:await github.repositories()});return;}
  const pm=url.pathname.match(/^\/api\/projects\/([a-f\d-]{36})(?:\/(.*))?$/);
  if(pm){const p=projects.get(pm[1]),action=pm[2]||'';let result;
   if(!action&&req.method==='GET'){json(res,200,{project:projects.view(p)});return;}
   if(action==='download'&&req.method==='GET'){if(!p.combined)throw new Error('Combine pages first.');res.setHeader('Content-Disposition',`attachment; filename="combined-astro-${p.id.slice(0,8)}.zip"`);await staticResponse(req,res,path.join(projects.directory(p),'combined'),'/combined.zip');return;}
   if(action==='git/status'&&req.method==='GET'){json(res,200,{staging:await github.deploymentStatus(p.id)});return;}
   if(req.method==='POST'){const input=await body(req);
    if(action==='review')result=await projects.reviewPage(p.id,input);
    else if(action==='continue')result=await projects.continueReview(p.id);
    else if(action==='add-page')result=await projects.addPath(p.id,input.path);
    else if(action==='migrate')result=await projects.start(p.id,input);
    else if(action==='stop')result=await projects.stop(p.id,cancelJob);
    else if(action==='combine')result=await projects.combine(p.id,input.routes);
    else if(action==='preview'){json(res,200,{url:await projects.preview(p.id)});return;}
    else if(action==='git/prepare'){json(res,200,{staging:await github.prepare(p.id,input)});return;}
    else if(action==='git/publish'){json(res,202,{staging:await github.publish(p.id,input)});return;}
    if(result){json(res,200,{project:projects.view(result)});return;}
   }
  }
  const match=url.pathname.match(/^\/api\/jobs\/([a-f\d-]{36})(?:\/(.*))?$/);
  if(match){const job=jobs.get(match[1]);if(!job){json(res,404,{error:'Job not found.'});return;}const action=match[2]||'';
   if(action===''&&req.method==='GET'){json(res,200,{job});return;}
   if(action==='cancel'&&req.method==='POST'){await cancelJob(job.id);json(res,200,{job});return;}
   if(action==='report'&&req.method==='GET'){const report=await readJSON(path.join(DATA,job.id,'report.json')).catch(()=>null);json(res,report?200:404,report||{error:'Report is not available yet.'});return;}
   if(action==='preview'&&req.method==='POST'){if(!['verified','needs-review'].includes(job.status))throw new Error('A completed Astro build is required.');if(!previews.has(job.id))previews.set(job.id,await preview(path.join(DATA,job.id,'astro-project/dist')));json(res,200,{url:previews.get(job.id).url+new URL(job.url).pathname});return;}
   if(action==='download'&&req.method==='GET'){if(!['verified','needs-review'].includes(job.status))throw new Error('No finished archive is available.');res.setHeader('Content-Disposition',`attachment; filename="astro-migration-${job.id.slice(0,8)}.zip"`);await staticResponse(req,res,path.join(DATA,job.id),'/migration.zip');return;}
   if(action.startsWith('evidence/')&&req.method==='GET'){await staticResponse(req,res,path.join(DATA,job.id),action);return;}
  }
  if(url.pathname.startsWith('/api/')){json(res,404,{error:'Endpoint not found.'});return;}
  if(req.method!=='GET'){json(res,405,{error:'Method not allowed.'});return;}
  await staticResponse(req,res,path.join(ROOT,'public'),url.pathname==='/'?'/index.html':url.pathname);
 }catch(error){json(res,400,{error:error.message});}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Astro Migration Studio http://127.0.0.1:${PORT}`));
async function shutdown(){for(const c of controllers.values())c.abort();for(const p of previews.values())await p.close();for(const p of projects.previews.values())await p.close();for(const c of projects.discoveryControllers.values())c.abort();browserHealth.close();github.close();server.close();}
process.on('SIGINT',()=>shutdown().then(()=>process.exit()));process.on('SIGTERM',()=>shutdown().then(()=>process.exit()));
