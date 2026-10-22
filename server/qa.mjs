import {captureExperience,compareExperience,installExperienceRecorder} from './experience.mjs';
import {probeFidelity,compareFidelity,controlContract} from './fidelity.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import {PNG} from 'pngjs';
import {load} from 'cheerio';
import {launchBrowser,VIEWPORTS,settle,screenshotStates,probeInteractions,readPageInventory} from './browser.mjs';
import {routePath} from './url-policy.mjs';
import {resourceReferences} from './http-capture.mjs';
import {inside,writeJSON} from './files.mjs';
export async function compareImages(a,b,diffFile){
 const left=PNG.sync.read(await fs.readFile(a)),right=PNG.sync.read(await fs.readFile(b));
 if(left.width!==right.width||left.height!==right.height)return {status:'fail',reason:'Screenshot dimensions differ.',differencePercent:100};
 const diff=new PNG({width:left.width,height:left.height});const changed=pixelmatch(left.data,right.data,diff.data,left.width,left.height,{threshold:.15,includeAA:false});
 await fs.writeFile(diffFile,PNG.sync.write(diff));const differencePercent=Number((changed/(left.width*left.height)*100).toFixed(2));return {differencePercent,status:differencePercent<=2?'pass':'review'};
}
export async function auditResources(dist,documents){
 const missing=[],remote=[],unmigratedLinks=[],seo=[];const routeSet=new Set(documents.map(d=>routePath(d.url)));
 for(const doc of documents){const route=routePath(doc.url),file=inside(dist,(route==='/'?'':route.slice(1)+'/')+'index.html');const html=await fs.readFile(file,'utf8');const $=load(html);if(doc.fidelity){const added=controlContract(html).filter(x=>!doc.fidelity.expectedControls.includes(x));if(added.length)missing.push({route,url:'Unexpected UI controls: '+added.join(', ')});}
  for(const url of resourceReferences(html,'text/html','http://migration.local'+route+'/')){const parsed=new URL(url);if(parsed.origin==='http://migration.local')missing.push({route,url:parsed.pathname});else remote.push({route,url});}
  if(!$('title').text().trim())seo.push({route,issue:'Missing page title'});
  if(!$('link[rel=canonical]').length)seo.push({route,issue:'Missing canonical URL'});
  $('[src],link[href]').each((_,el)=>{const e=$(el);for(const attr of ['src','href']){const u=e.attr(attr);if(!u||['canonical','alternate'].includes(e.attr('rel')))continue;if(u.startsWith('/')){const local=u.split(/[?#]/)[0];missing.push({route,url:local,check:true});}else if(/^https?:/.test(u))remote.push({route,url:u});}});
  $('a[href]').each((_,el)=>{try{const u=new URL($(el).attr('href'),doc.url);if(u.origin===new URL(doc.url).origin&&!routeSet.has(routePath(u.href))&&!/\.(pdf|png|jpg|zip)$/i.test(u.pathname))unmigratedLinks.push({route,url:u.href});}catch{}});
 }
 async function cssFiles(dir){const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await cssFiles(p));else if(e.name.endsWith('.css'))result.push(p);}return result;}
 for(const file of await cssFiles(dist)){const relative='/'+path.relative(dist,file).split(path.sep).join('/');for(const url of resourceReferences(await fs.readFile(file,'utf8'),'text/css','http://migration.local'+relative)){const parsed=new URL(url);if(parsed.origin==='http://migration.local')missing.push({route:relative,url:parsed.pathname});else remote.push({route:relative,url});}}
 const absent=[];for(const entry of missing){try{await fs.access(inside(dist,entry.url.slice(1)));}catch{absent.push({route:entry.route,url:entry.url});}}
 return {missingResources:absent,remoteResources:remote,unmigratedLinks:[...new Map(unmigratedLinks.map(x=>[x.url,x])).values()],seo};
}
export async function runQA(root,capture,previewURL,{signal,update}){
 const browser=await launchBrowser();const localDir=path.join(root,'evidence/local'),diffDir=path.join(root,'evidence/diff');await fs.mkdir(localDir,{recursive:true});await fs.mkdir(diffDir,{recursive:true});const checks=[],blocked=[];
 signal.addEventListener('abort',()=>browser.close().catch(()=>{}),{once:true});
 try{
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  await installExperienceRecorder(context);
  await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith(previewURL+'/')||/^(data:|blob:)/.test(u))return route.continue();blocked.push(u);return route.abort();});await context.routeWebSocket(/.*/,ws=>ws.close());
  const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [index,doc] of capture.documents.entries()){
   for(const viewport of VIEWPORTS){
    if(signal.aborted)throw new Error('Migration cancelled.');errors=[];const blockStart=blocked.length;update({stage:'qa',progress:65+Math.round((index*2+(viewport.name==='mobile'?1:0))/(capture.documents.length*2)*25),message:`Checking ${routePath(doc.url)} at ${viewport.name} size`});
    await page.setViewportSize({width:viewport.width,height:viewport.height});const response=await page.goto(previewURL+routePath(doc.url),{waitUntil:'load',timeout:30000});await settle(page);
    const inventory=await readPageInventory(page);const localExperience=await captureExperience(page,localDir,`${index}-${viewport.name}`);const localFidelity=await probeFidelity(page);const shots=await screenshotStates(page,localDir,`${index}-${viewport.name}`);const original=doc.evidence.find(e=>e.viewport===viewport.name);const comparisons=[];
    for(const shot of shots){const source=original.shots.find(s=>s.name===shot.name);const difference=await compareImages(path.join(root,'evidence/source',source.file),path.join(localDir,shot.file),path.join(diffDir,shot.file));comparisons.push({...difference,state:shot.name,source:`evidence/source/${source.file}`,local:`evidence/local/${shot.file}`,diff:`evidence/diff/${shot.file}`});}
    const assetMap=new Map([...capture.resources].flatMap(([url,a])=>[[url,'/migrated/'+a.file],['/migrated/'+a.file,'/migrated/'+a.file]]));const experience=compareExperience(original.experience,localExperience,assetMap);const fidelity=[...compareFidelity(original.fidelity,localFidelity),...experience.checks];const interactions=await probeInteractions(page);const behavior=original.interactions.map(before=>{const after=interactions.find(c=>c.type===before.type&&c.index===before.index);return {type:before.type,index:before.index,identity:before.identity,source:before.status,local:after?.status||'missing',sourceEvidence:{before:before.before,after:before.after},localEvidence:{before:after?.before,after:after?.after},status:before.status==='observed'?(after?.status==='observed'?'pass':'fail'):'not-tested'};});
    fidelity.push({name:'Interaction coverage',status:behavior.some(b=>b.status==='fail')?'fail':behavior.some(b=>b.status==='not-tested')?'not-tested':behavior.length?'pass':'not-applicable'});
    const sourceInventory=original.inventory||doc.inventory;const textSame=inventory.text===sourceInventory.text;checks.push({route:routePath(doc.url),viewport:viewport.name,http:response?.status()||0,title:inventory.title,textSame,scrollHeight:{source:sourceInventory.scrollHeight,local:inventory.scrollHeight},comparisons,behavior,fidelity,experience,pageErrors:[...new Set(errors)],blockedRemoteRequests:[...new Set(blocked.slice(blockStart))],canvas:inventory.canvas,sticky:inventory.sticky});
   }
  }
  const unknown=await page.goto(previewURL+'/__not_migrated_qa__');const staticAudit=await auditResources(path.join(root,'astro-project/dist'),capture.documents);
  const result={checks,staticAudit,unknownRouteReturns404:unknown?.status()===404,remoteRuntimeRequests:[...new Set(blocked)],notes:['Screenshots compare CSS-animation-disabled captures at matched viewports and scroll checkpoints. JavaScript, video and WebGL can remain time-dependent.','Observable control changes do not prove complete business behavior. Hidden controls, forms, login, checkout and private CMS are not tested.','A URL capture cannot establish that every published or draft CMS record was found.']};
  await writeJSON(path.join(root,'qa.json'),result);return result;
 }finally{await browser.close();}
}
