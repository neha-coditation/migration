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
 return new Promise((resolve,reject)=>{const child=spawn(program,args,{cwd,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'},signal,stdio:['ignore','pipe','pipe']});let output='';const keep=b=>{output=(output+b.toString()).slice(-100000);};child.stdout.on('data',keep);child.stderr.on('data',keep);const timer=setTimeout(()=>child.kill('SIGTERM'),timeout);child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',code=>{clearTimeout(timer);if(code===0)resolve(output);else reject(new Error(`Astro build failed (${code}).\n${output}`));});});
}
function verdict(capture,qa){
 const failures=[],warnings=[...capture.warnings];
 if(qa.staticAudit.seo.length)warnings.push(`${qa.staticAudit.seo.length} SEO metadata findings`);
 if(qa.notRun)failures.push('Visual and interaction QA did not run because the browser could not launch');
 if(qa.staticAudit.missingResources.length)failures.push(`${qa.staticAudit.missingResources.length} missing local resources`);
 if(qa.remoteRuntimeRequests.length||qa.staticAudit.remoteResources.length)failures.push('Remote runtime dependencies remain');
 if(!qa.unknownRouteReturns404)failures.push('Unknown routes do not return 404');
 for(const check of qa.checks){if((check.fidelity||[]).some(b=>b.status==='not-tested'))warnings.push(`${check.route}: animation activity could not be established`);if(check.http!==200)failures.push(`${check.route}: HTTP ${check.http}`);if(check.pageErrors.length)failures.push(`${check.route}: browser errors`);if((check.fidelity||[]).some(b=>b.status==='fail'))failures.push(`${check.route}: fidelity regression`);if(check.behavior.some(b=>b.status==='fail'))failures.push(`${check.route}: interaction regression`);if(!check.textSame)warnings.push(`${check.route} ${check.viewport}: visible text differs`);if(check.comparisons.some(x=>x.status!=='pass'))warnings.push(`${check.route} ${check.viewport}: visual difference exceeds 2 percent`);if(check.behavior.some(x=>x.status==='not-tested'))warnings.push(`${check.route}: some controls could not be verified`);}
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
 try{capture=await captureSite(job,root,{policy,signal,update});}catch(error){if(signal.aborted)throw error;if(!/browserType.launch|Executable doesn't exist|Permission denied|browser has been closed/.test(error.message))throw error;capture=await captureHTTP(job,root,{policy,signal,update,reason:'Browser could not launch. Run npm run setup:browser in a normal local terminal. Visual and interaction QA are unverified.'});}
 for(const doc of capture.documents){prepareFidelity(doc);const recovered=await recoverCollections(doc.html,doc.url,{policy,signal});doc.html=recovered.html;doc.recoveredCollections=recovered.lists;if(recovered.lists.some(x=>!x.publicPaginationExhausted))capture.warnings.push(`${doc.url}: public CMS pagination could not be exhausted within eight pages.`);}
 const completion=await completeResources(capture.documents,capture.resources,root,{policy,signal});capture.warnings.push(...completion.warnings);capture.bytes=completion.bytes;
 update({stage:'generate',progress:48,message:`Generating real Astro routes for ${capture.documents.length} pages`});
 const project=await generateAstro(root,capture.documents,capture.resources);await writeJSON(path.join(root,'resource-map.json'),[...capture.resources].map(([url,{disk,...r}])=>({url,...r})));
 update({stage:'build',progress:55,message:'Running Astro production build'});
 // Use installed studio packages for this build only. The downloaded project installs its own pinned Astro.
 const link=path.join(project,'node_modules');await fs.symlink(path.join(APP,'node_modules'),link,'dir');
 let buildLog;try{buildLog=await command(process.execPath,[path.join(APP,'node_modules/astro/bin/astro.mjs'),'build'],{cwd:project,signal});buildLog+=await command(process.execPath,['scripts/github-pages.mjs'],{cwd:project,signal});}finally{await fs.unlink(link).catch(()=>{});}
 await fs.writeFile(path.join(root,'build.log'),buildLog);
 // Reuse pinned resolved packages to supply a reproducible Astro-only lockfile, without registry requests.
 const lock=JSON.parse(await fs.readFile(path.join(APP,'package-lock.json'),'utf8'));const pkg=JSON.parse(await fs.readFile(path.join(project,'package.json'),'utf8'));lock.name=pkg.name;lock.version=pkg.version;lock.packages['']={name:pkg.name,version:pkg.version,dependencies:pkg.dependencies};await writeJSON(path.join(project,'package-lock.json'),lock);
 const server=await preview(path.join(project,'dist'));let qa;
 try{
 if(capture.mode==='http-fallback')qa={notRun:true,checks:[],staticAudit:await auditResources(path.join(project,'dist'),capture.documents),unknownRouteReturns404:(await fetch(server.url+'/__not_migrated_qa__')).status===404,remoteRuntimeRequests:[],notes:['Browser QA did not run. HTTP capture cannot establish visual or interaction fidelity.']};
 else qa=await runQA(root,capture,server.url,{signal,update});
 await writeJSON(path.join(root,'qa.json'),qa);
 }finally{await server.close();}
 for(const doc of capture.documents){
  const measured=qa.checks.filter(c=>c.route===routePath(doc.url));
  for(const expected of doc.fidelity.checks){const results=[];for(const check of measured){
   const name=expected.name==='Hero / scroll animation'?'Hero / scroll into view':expected.name;
   const direct=(check.fidelity||[]).find(x=>x.name===name);if(direct)results.push(direct.status);
   const type=expected.name==='Load more'?'load-more':expected.name.startsWith('Filter')?'filter':null;
   if(type){const b=check.behavior.find(x=>x.type===type);if(b){let status=b.status;if(expected.name==='Filter results'){const a=b.sourceEvidence?.after,z=b.sourceEvidence?.before,l=b.localEvidence?.after;status=a&&z&&a.visibleItems!==z.visibleItems?(l?.visibleItems===a.visibleItems?'pass':'fail'):'not-tested';}results.push(status);}else results.push('not-applicable');}
  }expected.status=results.includes('fail')?'fail':results.includes('not-tested')?'not-tested':results.includes('pass')?'pass':results.length?'not-applicable':'not-tested';}
 }
 const result=verdict(capture,qa);if(!qa.notRun&&capture.documents.some(d=>d.fidelity.checks.some(c=>c.status==='not-tested'))){result.warnings.push('Some required fidelity checks could not be established from source behavior');result.status='needs-review';}const report={schemaVersion:3,source:job.url,createdAt:new Date().toISOString(),captureMode:capture.mode||'browser',architecture:'Astro static capture with original markup and localized observed assets',astroVersion:'7.4.2',deployment:{target:'GitHub Pages',workflow:'.github/workflows/deploy.yml',site:'ASTRO_SITE',base:'ASTRO_BASE',lockfile:'package-lock.json',published:false},experienceCoverage:{animation:'per-target startup, time and five scroll checkpoints',illustration:'asset identity, load, SVG geometry and dimensions',interaction:'up to six controls per known type; untested and hidden controls require review',browserExecuted:!qa.notRun},build:'passed',...result,pages:capture.documents.map(d=>({url:d.url,route:routePath(d.url),title:d.inventory.title,controls:d.inventory.controls,canvas:d.inventory.canvas,sticky:d.inventory.sticky,forms:d.forms,collections:d.recoveredCollections,fidelity:d.fidelity})),resources:capture.resources.size,resourceBytes:capture.bytes,blockedSourceRequests:capture.blocked,omittedRoutes:capture.omittedRoutes,qa,limitations:['This first release captures public pages and observed resources. It does not infer unseen CMS records, backend code or every hidden interaction.','It preserves source HTML and browser code inside real Astro routes; it does not refactor the source into a component design system.','Finsweet, domain-bound APIs, dynamically constructed imports, WebGL and timing-dependent animation may require manual repair.','No publishing or live-site changes. Source forms cannot submit.']};
 await writeJSON(path.join(root,'report.json'),report);
 const md=`# Astro migration report\n\nSource: ${job.url}\n\nBuild: passed\nQA: ${result.status}\n\n${capture.documents.length} routes and ${capture.resources.size} cached resources.\n\n## Failures\n${result.failures.map(x=>'- '+x).join('\n')||'None observed in the checks run.'}\n\n## Review items\n${result.warnings.map(x=>'- '+x).join('\n')||'None observed in the checks run.'}\n\n## Limits\n${report.limitations.map(x=>'- '+x).join('\n')}\n\nSee report.json and qa.json for measured results. Evidence includes source, local and difference screenshots at desktop and mobile sizes.\n`;
 await fs.writeFile(path.join(root,'MIGRATION-REPORT.md'),md);await fs.writeFile(path.join(project,'MIGRATION-REPORT.md'),md);await writeJSON(path.join(project,'migration-report.json'),report);
 update({stage:'package',progress:95,message:'Packaging Astro source, build, screenshots and QA evidence'});
 const zip=new JSZip();async function add(dir,prefix){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='.astro')continue;const p=path.join(dir,e.name),name=prefix+'/'+e.name;if(e.isDirectory())await add(p,name);else if(e.isFile())zip.file(name,await fs.readFile(p));}}
 await add(project,'astro-project');await add(path.join(root,'evidence'),'evidence');for(const name of ['report.json','qa.json','resource-map.json','build.log','MIGRATION-REPORT.md'])zip.file(name,await fs.readFile(path.join(root,name)));
 await fs.writeFile(path.join(root,'migration.zip'),await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));
 return report;
}
