import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function launchBrowser(){
 const bundled=path.resolve(fileURLToPath(new URL('../.browsers',import.meta.url)));
 if(fs.existsSync(bundled)&&!process.env.PLAYWRIGHT_BROWSERS_PATH)process.env.PLAYWRIGHT_BROWSERS_PATH=bundled;
 const {chromium}=await import('playwright');
 return chromium.launch({headless:true,chromiumSandbox:true,timeout:15000,...(process.env.MIGRATION_BROWSER_EXECUTABLE?{executablePath:process.env.MIGRATION_BROWSER_EXECUTABLE}:{})});
}
export const VIEWPORTS=[{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}];
export async function settle(page){await page.evaluate(()=>Promise.race([document.fonts?.ready, new Promise(resolve=>setTimeout(resolve,5000))])).catch(()=>{});await page.waitForTimeout(650);}
export async function screenshotStates(page,dir,key){
 const shots=[];
 for(const [name,fraction] of [['top',0],['middle',.5],['bottom',1]]){
  await page.evaluate(f=>window.scrollTo({top:Math.max(0,document.documentElement.scrollHeight-innerHeight)*f,behavior:'instant'}),fraction);await page.waitForTimeout(220);
  const file=`${key}--${name}.png`;await page.screenshot({path:`${dir}/${file}`,animations:'disabled',caret:'hide',timeout:15000});shots.push({name,file});
 }return shots;
}
export async function probeInteractions(page){
 const candidates=[
  {type:'menu',selector:'.w-nav-button,button[aria-label*="menu" i],button[aria-label*="navigation" i]'},
  {type:'slider',selector:'.swiper-button-next,.swiper-button-next_testimonial,[aria-label="Next Testimonial"],[aria-label="next slide" i],.w-slider-arrow-right'},
  {type:'dropdown',selector:'.w-dropdown-toggle'},
  {type:'accordion',selector:'details > summary'},
  {type:'tab',selector:'.w-tab-link[href^="#"]'},
  {type:'filter',selector:'[fs-cmsfilter-element="filters"] input:is([type="checkbox"],[type="radio"]), [fs-list-element="filters"] input:is([type="checkbox"],[type="radio"])'},
  {type:'load-more',selector:'[data-migration-more],[fs-cmsload-element="load-more"],.w-pagination-next,button[data-load-more]'}
 ];const checks=[];
 for(const item of candidates){
  if(item.type==='filter'){const dropdown=page.locator('.migration-filter-tabs .w-tab-link,.w-tabs .w-tab-link').filter({hasText:/department/i}).first();if(await dropdown.count()&&await dropdown.isVisible())await dropdown.click({timeout:2000}).catch(()=>{});}
  const all=page.locator(item.selector);const count=await all.count();if(!count)continue;
  const order=await all.evaluateAll((nodes,type)=>nodes.map((e,index)=>({index,priority:type==='filter'&&/finance/i.test(e.getAttribute('aria-label')||e.closest('label')?.textContent||'')?0:1})).sort((a,b)=>a.priority-b.priority).map(x=>x.index),item.type);
  for(let rank=0;rank<Math.min(count,6);rank++){const n=order[rank],target=all.nth(n);const identity=await target.evaluate(e=>e.getAttribute('aria-label')||e.closest('label')?.textContent.trim()||e.id||e.textContent.trim().slice(0,90)||e.getAttribute('name')||e.tagName);
  if(!await target.isVisible()&&!(item.type==='filter'&&await target.evaluate(e=>{const l=e.closest('label');return !!l&&l.getBoundingClientRect().width>0;}))){checks.push({type:item.type,index:n,identity,status:'not-tested',reason:'Control exists but is hidden at this viewport.'});continue;}
  // Known UI-only controls; never click submit, purchase, authentication or arbitrary buttons.
  const safe=await target.evaluate(e=>!(e.closest('form')&&!e.closest('[fs-cmsfilter-element=filters],[fs-list-element=filters]'))&&!(e.tagName==='A'&&!['','#'].includes(e.getAttribute('href')||'')&&!(e.getAttribute('href')||'').startsWith('#')));
  if(!safe){checks.push({type:item.type,index:n,identity,status:'not-tested',reason:'Excluded to avoid navigation or form side effects.'});continue;}
  const state=()=>target.evaluate((el,type)=>{
   const visible=e=>!!(e.getBoundingClientRect().width&&e.getBoundingClientRect().height)&&getComputedStyle(e).display!=='none';
   if(type==='menu')return {expanded:el.getAttribute('aria-expanded'),class:el.className,nav:[...document.querySelectorAll('.w-nav-menu,header nav')].map(e=>[e.className,visible(e)])};
   if(type==='slider'){const root=el.closest('.swiper,.w-slider')||(el.matches('.swiper-button-next_testimonial')?document.querySelector('#testimonial'):null)||el.parentElement;return {active:[...root.querySelectorAll('.swiper-slide-active,.w-active')].map(e=>[e.textContent,e.getAttribute('data-swiper-slide-index')]),transforms:[...root.querySelectorAll('.swiper-wrapper,.w-slider-mask,.w-slide')].map(e=>getComputedStyle(e).transform)};}
   if(type==='accordion')return {open:el.closest('details').open};
   if(type==='dropdown')return {expanded:el.getAttribute('aria-expanded'),panes:[...el.parentElement.querySelectorAll('.w-dropdown-list')].map(e=>({class:e.className,visible:visible(e)}))};
   if(type==='tab')return {selected:el.getAttribute('aria-selected'),class:el.className,panes:[...document.querySelectorAll('.w-tab-pane')].map(visible)};
   if(type==='filter'){const box=el.closest('label')?.querySelector('.w-checkbox-input,.w-radio-input');const style=box?getComputedStyle(box):getComputedStyle(el);return {checked:el.checked,indicator:style.backgroundImage!=='none'||(!box&&style.appearance!=='none'&&style.opacity!=='0')||!!box&&!['none','normal','""'].includes(getComputedStyle(box,'::after').content),class:el.closest('label')?.className,visibleItems:[...document.querySelectorAll('.w-dyn-item')].filter(visible).length};}
   return {visibleItems:[...document.querySelectorAll('.w-dyn-item')].filter(visible).length,hidden:el.hidden};
  },item.type);
  try{const before=await state();if(item.type==='filter')await target.evaluate(e=>e.closest('label')?e.closest('label').click():e.click());else await target.click({timeout:4000});await page.waitForTimeout(750);const after=await state();checks.push({type:item.type,index:n,identity,status:item.type==='load-more'&&after.visibleItems<=before.visibleItems?'not-observed':item.type==='filter'&&after.checked&&!after.indicator?'not-observed':JSON.stringify(before)!==JSON.stringify(after)?'observed':'not-observed',before,after,reason:'Compared visible content, selected and expanded states, and slider transforms before and after activation.'});}
  catch(error){checks.push({type:item.type,index:n,identity,status:'not-tested',reason:error.message.split('\n')[0]});}
  if(item.type==='filter')await target.evaluate(e=>{if(e.checked){e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));}}).catch(()=>{});
  if(['menu','dropdown','accordion'].includes(item.type))await target.click({timeout:1500}).catch(()=>{});
  }if(count>6)checks.push({type:item.type,index:-1,identity:'remaining controls',status:'not-tested',reason:'Per-type interaction budget reached; '+(count-6)+' controls remain.'});
 }
 return checks;
}
export async function readPageInventory(page){return page.evaluate(()=>({
 title:document.title,description:document.querySelector('meta[name=description]')?.content||'',canonical:document.querySelector('link[rel=canonical]')?.href||'',
 text:document.body.innerText.replace(/\s+/g,' ').trim(),h1:[...document.querySelectorAll('h1')].map(e=>e.textContent.trim()),
 links:[...document.querySelectorAll('a[href]')].map(e=>e.href),scripts:[...document.scripts].map(e=>({src:e.src||null,inlineBytes:e.src?0:e.textContent.length})),
 cmsLists:document.querySelectorAll('[fs-cmsload-element=list],[fs-cmsfilter-element=list],[fs-list-element=list]').length,
 canvas:document.querySelectorAll('canvas').length,sticky:[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='sticky').length,
 forms:[...document.forms].map(f=>({name:f.name||f.id||'Unnamed form',action:f.action})),
 controls:{menus:document.querySelectorAll('.w-nav-button,button[aria-label*="menu" i]').length,sliders:document.querySelectorAll('.swiper,.w-slider').length,tabs:document.querySelectorAll('[role=tab],.w-tab-link').length,filters:document.querySelectorAll('[fs-cmsfilter-element=filters],[fs-list-element=filters]').length},
 scrollHeight:document.documentElement.scrollHeight
}));}
