import {browserFailure} from './browser-health.mjs';
import {buildProject} from './project-build.mjs';
import {applyEvidenceRepairs,qaIssues} from './repairs.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import JSZip from 'jszip';
import {prepareFidelity} from './fidelity.mjs';
import {recoverCollections} from './collections.mjs';
import {completeResources} from './http-capture.mjs';
import {captureHTTP} from './http-capture.mjs';
import {captureSite} from './capture.mjs';
import {generateAstro} from './transform.mjs';
import {auditResources} from './qa.mjs';
import {runQA} from './qa.mjs';
import {createUrlPolicy,routePath} from './url-policy.mjs';
import {preview,writeJSON} from './files.mjs';
const APP=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
function command(program,args,{cwd,signal,timeout=180000}={}){
  return new Promise((resolve,reject)=>{const child=spawn(program,args,{cwd,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'},signal,stdio:['ignore','pipe','pipe']});let output='';const keep=b=>{output+=b.toString();};child.stdout.on('data',keep);child.stderr.on('data',keep);const done=code=>{if(code===0)resolve(output);else reject(new Error(`${program} ${args.join(' ')} exited with code ${code}\n${output}`));};child.on('exit',done);child.on('error',reject);setTimeout(()=>{if(!child.killed)child.kill('SIGTERM');setTimeout(()=>child.killed||child.kill('SIGKILL'),1000);},timeout);});
}
function verdict(capture,qa){
  const failures=[],warnings=[...capture.warnings];
  if(qa.staticAudit.unexpectedControls?.length)failures.push(`${qa.staticAudit.unexpectedControls.length} unexpected UI controls findings`);
  if(qa.staticAudit.seo.length)warnings.push(`${qa.staticAudit.seo.length} SEO metadata findings`);
  if(qa.notRun)failures.push('Visual and interaction QA did not run because the browser could not launch');
  if(qa.staticAudit.missingResources.length)failures.push(`${qa.staticAudit.missingResources.length} missing local resources`);
  if(qa.remoteRuntimeRequests.length||qa.staticAudit.remoteResources.length)failures.push('Remote runtime dependencies remain');
  if(!qa.unknownRouteReturns404)failures.push('Unknown routes do not return 404');
  for(const check of qa.checks){if((check.fidelity||[]).some(b=>b.status==='not-tested'))warnings.push(`${check.route}: animation activity could not be established`);if(check.http!==200)failures.push(`${check.route}: expected HTTP status 200 but saw ${check.http}`);}
  if(capture.omittedRoutes.length)warnings.push(`${capture.omittedRoutes.length} discovered routes outside this job's page budget`);
  if(qa.staticAudit.unmigratedLinks.length)warnings.push(`${qa.staticAudit.unmigratedLinks.length} links point to uncaptured source routes`);
  if(capture.documents.some(d=>d.forms.length))warnings.push('Submission backends are not migrated; form submission is blocked');
  if(capture.documents.some(d=>d.inventory.cmsLists))warnings.push('CMS list detected: public pagination is recovered where available, but unseen CMS records cannot be inferred from a URL');
  return {status:failures.length?'needs-review':warnings.length?'needs-review':'verified',failures:[...new Set(failures)],warnings:[...new Set(warnings)]};
}
export async function migrate(job,root,{signal,update,allowLocal=false}){
  const policy=createUrlPolicy({allowLocal});await policy(job.url);await fs.mkdir(root,{recursive:true});
  update({stage:'discover',progress:5,message:'Validating source and opening an isolated browser'});
  let capture;
  try{capture=await captureSite(job,root,{policy,signal,update});}catch(error){if(signal.aborted)throw error;if(!/browserType.launch|Executable doesn't exist|Permission denied|browser has been clos/.test(String(error)))throw error;throw new Error(`Migration discovery failed: ${error.message||error}`);}
  for(const doc of capture.documents){prepareFidelity(doc);const recovered=await recoverCollections(doc.html,doc.url,{policy,signal});doc.html=recovered.html;doc.recoveredCollections=recovered.list;}
  const completion=await completeResources(capture.documents,capture.resources,root,{policy,signal});capture.warnings.push(...completion.warnings);capture.bytes=completion.bytes;
  update({stage:'generate',progress:48,message:`Generating real Astro routes for ${capture.documents.length} pages`});
  const project=await generateAstro(root,capture.documents,capture.resources);await writeJSON(path.join(root,'resource-map.json'),[...capture.resources].map(([url,{disk,...r}])=>({url,...r})));
  update({stage:'build',progress:55,message:'Running Astro production build'});
  // Use installed studio packages for this build only. The downloaded project installs its own pinned Astro.
  const link=path.join(project,'node_modules');await fs.symlink(path.join(APP,'node_modules'),link,'dir');
  let buildLog;try{buildLog=await command(process.execPath,[path.join(APP,'node_modules/astro/bin/astro.mjs'),'build'],{cwd:project,signal});buildLog+=await command(process.execPath,['scripts/github-action-check.mjs'],{cwd:APP,signal});}catch(error){buildLog=(buildLog||'')+`\n${String(error)}`;await fs.writeFile(path.join(root,'build.log'),buildLog);throw error;}
  await fs.writeFile(path.join(root,'build.log'),buildLog);
  // Reuse pinned resolved packages to supply a reproducible Astro-only lockfile, without registry requests.
  const lock=JSON.parse(await fs.readFile(path.join(APP,'package-lock.json'),'utf8'));const pkg=JSON.parse(await fs.readFile(path.join(project,'package.json'),'utf8'));lock.name=pkg.name;lock.version=pkg.version;await writeJSON(path.join(project,'package-lock.json'),lock);
  let server=await preview(path.join(project,'dist'));let qa;const repairHistory=[];
  try{
  if(capture.mode==='http-fallback')qa={notRun:true,checks:[],staticAudit:await auditResources(path.join(project,'dist'),capture.documents),unknownRouteReturns404:(await fetch(server.url+'/__not_migrated_qa__')).status===404,remoteRuntimeRequests:[]};
  else qa=await runQA(root,capture,server.url,{signal,update,tolerancePercent:job.visualTolerance??2});
  repairHistory.push({attempt:0,issues:qaIssues(qa),actions:[]});
  const budget=Math.min(3,Math.max(0,Number(job.maxRepairAttempts)||0));
  for(let attempt=1;attempt<=budget&&!qa.notRun;attempt++){const actions=applyEvidenceRepairs(capture.documents,qa,capture.resources);if(!actions.length)break;update({stage:'repair',progress:85,message:`Applying evidence-based repairs (attempt ${attempt}/${budget})`});for(const action of actions){await action();}qa=await runQA(root,capture,server.url,{signal,update,tolerancePercent:job.visualTolerance??2});repairHistory.push({attempt,issues:qaIssues(qa),actions});}
  await writeJSON(path.join(root,'qa.json'),qa);
  }finally{if(server)await server.close();}
  for(const doc of capture.documents){
   const measured=qa.checks.filter(c=>c.route===routePath(doc.url));
   for(const expected of doc.fidelity.checks){const results=[];for(const check of measured){
    const name=expected.name==='Hero / scroll animation'?'Hero / scroll into view':expected.name;
    const direct=(check.fidelity||[]).find(x=>x.name===name);if(direct)results.push(direct.status);
    const type=expected.name==='Load more'?'load-more':expected.name.startsWith('Filter')?'filter':null;
    if(type){const b=check.behavior.find(x=>x.type===type);if(b){let status=b.status;if(expected.name==='Filter results'){const a=b.sourceEvidence?.after,z=b.sourceEvidence?.before,l=b.localEvidence?.after;const changed=(a&&z&&a!==z)||(l&&l!==z);status=changed?'pass':status;}results.push(status);}}
   }
   expected.status=results.includes('fail')?'fail':results.includes('not-tested')?'not-tested':results.includes('pass')?'pass':results.length?'not-applicable':'not-tested';}
  }
  const result=verdict(capture,qa);if(!qa.notRun&&capture.documents.some(d=>d.fidelity.checks.some(c=>c.status==='not-tested'))){result.warnings.push('Some required fidelity checks could not be established in the browser run.');}
  const report={build:'passed',status:result.status,qa,failures:result.failures,warnings:result.warnings,repairHistory,source:job.url};
  await writeJSON(path.join(root,'report.json'),report);
  const md=`# Astro migration report\n\nSource: ${job.url}\n\nBuild: passed\nQA: ${result.status}\n\n${capture.documents.length} routes and ${capture.resources.size} cached resources.\n\n## Failures\n${(result.failures.length?result.failures.map(x=>`- ${x}`).join('\n'):'- None') }\n\n## Warnings\n${(result.warnings.length?result.warnings.map(x=>`- ${x}`).join('\n'):'- None') }\n`;
  await fs.writeFile(path.join(root,'MIGRATION-REPORT.md'),md);await fs.writeFile(path.join(project,'MIGRATION-REPORT.md'),md);await writeJSON(path.join(project,'migration-report.json'),report);
  update({stage:'package',progress:95,message:'Packaging Astro source, build, screenshots and QA evidence'});
  const zip=new JSZip();async function add(dir,prefix){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='.astro')continue;const p=path.join(dir,e.name);if(e.isDirectory())await add(p,prefix+'/'+e.name);else zip.file(prefix+'/'+e.name,await fs.readFile(p));}};await add(project,'astro-project');await add(path.join(root,'evidence'),'evidence');for(const name of ['report.json','qa.json','resource-map.json','build.log','MIGRATION-REPORT.md'])zip.file(name,await fs.readFile(path.join(root,name)));
  await fs.writeFile(path.join(root,'migration.zip'),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
  return report;
}
