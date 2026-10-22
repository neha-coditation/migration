import {captureExperience,installExperienceRecorder} from './experience.mjs';
import {probeFidelity} from './fidelity.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {load} from 'cheerio';
import {launchBrowser,VIEWPORTS,settle,screenshotStates,probeInteractions,readPageInventory} from './browser.mjs';
import {canonical,crawlable,routePath} from './url-policy.mjs';
import {writeJSON} from './files.mjs';
const suffixes={'text/css':'.css','text/javascript':'.js','application/javascript':'.js','application/json':'.json','text/html':'.html','image/png':'.png','image/jpeg':'.jpg','image/svg+xml':'.svg','font/woff2':'.woff2'};
export async function captureSite(job,root,{policy,signal,update}){
 const resourceDir=path.join(root,'captured/resources');await fs.mkdir(resourceDir,{recursive:true});await fs.mkdir(path.join(root,'evidence/source'),{recursive:true});
 const resources=new Map(),documents=[],warnings=[],blocked=[],pending=new Set(),attempted=new Set();let bytes=0;
 const browser=await launchBrowser();const origin=new URL(job.url).origin;const queue=[canonical(job.url),...job.extraPaths.map(p=>canonical(new URL(p,job.url)))];const visited=new Set();
 const throwAbort=()=>{if(signal.aborted)throw new Error('Migration cancelled.');};
 signal.addEventListener('abort',()=>browser.close().catch(()=>{}),{once:true});
 try{
  const context=await browser.newContext({viewport:{width:VIEWPORTS[0].width,height:VIEWPORTS[0].height},serviceWorkers:'block',acceptDownloads:false,ignoreHTTPSErrors:false});
  await installExperienceRecorder(context);
  await context.route('**/*',async route=>{
   const req=route.request(),u=req.url();if(/^(data:|blob:)/.test(u))return route.continue();
   try{if(!['GET','HEAD'].includes(req.method()))throw new Error('State-changing requests are disabled.');await policy(u);await route.continue();}
   catch(error){blocked.push({url:u,reason:error.message});await route.abort();}
  });
  await context.routeWebSocket(/.*/,ws=>ws.close());
  context.on('response',response=>{
   const task=(async()=>{
    try{const url=response.url();if(attempted.has(url)||resources.size>=1500||bytes>250*1024*1024||!response.ok()||!/^(https?:)/.test(url))return;
     attempted.add(url);const headers=response.headers(),type=(headers['content-type']||'application/octet-stream').split(';')[0];
     if(Number(headers['content-length'])>24*1024*1024){warnings.push(`Resource exceeds 24 MB capture limit: ${url}`);return;}
     const buffer=await response.body();if(buffer.length>24*1024*1024||bytes+buffer.length>250*1024*1024){warnings.push(`Resource exceeds capture budget: ${url}`);return;}
     let suffix=suffixes[type]||path.extname(new URL(url).pathname);if(!/^\.[a-z\d]{1,8}$/i.test(suffix))suffix='.bin';
     const file=crypto.createHash('sha256').update(url).digest('hex').slice(0,24)+suffix;const disk=path.join(resourceDir,file);await fs.writeFile(disk,buffer);bytes+=buffer.length;const asset={file,disk,type,bytes:buffer.length,originalURL:url};resources.set(url,asset);let previous=response.request().redirectedFrom();while(previous){resources.set(previous.url(),asset);previous=previous.redirectedFrom();}
    }catch(error){warnings.push(`Could not cache response: ${response.url()} (${error.message.split('\n')[0]})`);}
   })();pending.add(task);task.finally(()=>pending.delete(task));
  });
  const page=await context.newPage();
  while(queue.length&&(job.maxPages===0||documents.length<job.maxPages)){
   throwAbort();const url=queue.shift();if(visited.has(url))continue;visited.add(url);await policy(url);
   update({stage:'capture',progress:12+Math.round(documents.length/(job.maxPages||Math.max(documents.length+queue.length,1))*28),message:`Capturing ${url}`});
   try{
    const response=await page.goto(url,{waitUntil:'load',timeout:30000});if(!response||!response.ok())throw new Error(`HTTP ${response?.status()||'no response'}`);
    const final=canonical(page.url());if(new URL(final).origin!==origin)throw new Error('Page redirected outside the source origin.');
    if(documents.some(d=>routePath(d.url)===routePath(final)))continue;
    await settle(page);const inventory=await readPageInventory(page);const raw=await response.text();
    let markup=raw;const $=load(raw);const rawText=$('body').text().replace(/\s+/g,' ').trim();
    if(inventory.text.length>rawText.length*2+300){markup=await page.content();warnings.push(`Rendered DOM used for client-rendered route ${final}; framework rehydration needs review.`);}
    const index=documents.length;const evidence=[];
    for(const viewport of VIEWPORTS){await page.setViewportSize({width:viewport.width,height:viewport.height});await page.reload({waitUntil:'load',timeout:30000});await settle(page);const viewportInventory=await readPageInventory(page);const experience=await captureExperience(page,path.join(root,'evidence/source'),`${index}-${viewport.name}`);const fidelity=await probeFidelity(page);const shots=await screenshotStates(page,path.join(root,'evidence/source'),`${index}-${viewport.name}`);const interactions=await probeInteractions(page);evidence.push({viewport:viewport.name,shots,interactions,fidelity,experience,inventory:viewportInventory});}
    await page.setViewportSize({width:VIEWPORTS[0].width,height:VIEWPORTS[0].height});
    documents.push({url:final,html:markup,inventory,evidence});
    await fs.writeFile(path.join(root,`captured/page-${index}.html`),markup);
    for(const link of inventory.links){if(crawlable(link,origin)){const candidate=canonical(link);if(!visited.has(candidate)&&!queue.includes(candidate))queue.push(candidate);}}
    // Public pagination links are included in the report, never claimed as a complete CMS export.
   }catch(error){if(signal.aborted)throw error;warnings.push(`Page capture failed: ${url} (${error.message.split('\n')[0]})`);}
  }
  await Promise.allSettled([...pending]);throwAbort();
  if(!documents.length)throw new Error('No pages were captured. Check the URL, network access and browser installation.');
  await writeJSON(path.join(root,'captured/inventory.json'),{documents:documents.map(({html,...d})=>d),resources:[...resources].map(([url,{disk,...r}])=>({url,...r})),warnings,blocked,omittedRoutes:queue.filter(u=>!visited.has(u)),totalBytes:bytes});
  return {documents,resources,warnings,blocked,omittedRoutes:queue.filter(u=>!visited.has(u)),bytes};
 }finally{await browser.close();}
}
