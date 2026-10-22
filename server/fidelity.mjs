import {repairStructuredData} from './structured-data.mjs';
import fs from 'node:fs';
import {load} from 'cheerio';
export const fidelityChecks=['Animated illustration frames','Individual animations','Illustrations and assets','Interaction coverage','Source controls only','Filter selected indicator','Filter results','Load more','Testimonial edge spacing','Hero / scroll animation','Navigation scroll behavior','Sticky pinning','Canvas / particles'];
export function controlContract(html){const $=load(html);return $('input:not([type=hidden]),select,button,a').toArray().map(e=>{const n=$(e);return `${e.name}:${n.attr('type')||''}:${(n.attr('aria-label')||n.attr('placeholder')||n.text()).replace(/\s+/g,' ').trim().toLowerCase()}`;}).filter(x=>!x.endsWith(':'));}
export function prepareFidelity(document){
 const structured=repairStructuredData(document.html);const $=load(structured.html),repairs=structured.repaired?[`Restore ${structured.repaired} stripped JSON-LD script wrapper(s) so metadata is not visible page text`]:[];const coditation=/(^|\.)coditation\.com$/i.test(new URL(document.url).hostname);
 if(coditation){
  $('script:not([src])').each((_,el)=>{const code=$(el).text();if(code.includes('createParticleBG')&&code.includes('sceneUpdates')){$(el).text(fs.readFileSync(new URL('./profiles/coditation-particles.js',import.meta.url),'utf8'));repairs.push('Restore the captured Coditation particle scenes with isolated initialization, resize and reduced-motion handling.');}});

  if(/^\/resources\/blogs\/?$/.test(new URL(document.url).pathname)){
   $('.insight-cat-wp').remove();
   $('a,button').filter((_,e)=>/^search all published blog posts$/i.test($(e).text().trim())).remove();
   $('input[type=search]').filter((_,e)=>/blogs/i.test($(e).attr('placeholder')||$(e).attr('aria-label')||'')).remove();
   repairs.push('Coditation blog: retain original cards and layout; remove the previously rejected search and topic controls.');
  }
  $('head').append(`<style data-migration-repair="coditation">body{overflow-x:clip}html{scroll-behavior:auto}#testimonial.swiper{overflow:visible!important}.insight-checkbox-field.fs-cmsfilter_active .insight-checkbox{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='m3 8 3 3 7-7' fill='none' stroke='%23524ff4' stroke-width='2'/%3E%3C/svg%3E")!important;background-color:rgba(73,118,255,.3)!important;border:1px solid #3064fe!important}</style>`);
  repairs.push('Coditation: restore selected filter tick, sticky overflow and testimonial neighboring-card visibility.');
 }
 // Preserve original engines. No blanket reveal styles, replacement nav, or duplicate slider initialization.
 const implementation={animations:{inlineScripts:$('script:not([src])').toArray().filter(e=>/gsap|THREE|Swiper|Globe|lottie|requestAnimationFrame|ScrollTrigger|animate\(/i.test($(e).text())).length,scriptURLs:$('script[src]').map((_,e)=>$(e).attr('src')).get(),targets:$('[data-w-id],canvas,[data-animation-type=lottie],lottie-player,dotlottie-player').length},illustrations:{images:$('img').length,inlineSVG:$('svg').length,canvas:$('canvas').length,lottie:$('[data-animation-type=lottie],lottie-player,dotlottie-player').length},interactions:{menus:$('.w-nav-button').length,dropdowns:$('.w-dropdown-toggle').length,sliders:$('.swiper,.w-slider').length,accordions:$('details').length,filters:$('[fs-cmsfilter-element=filters],[fs-list-element=filters]').length}};
 document.html=$.html();document.fidelity={implementation,profile:coditation?'coditation':'source-preserving',repairs,expectedControls:controlContract(document.html),checks:fidelityChecks.map(name=>({name,status:'not-tested'}))};
 return document.fidelity;
}
export async function probeFidelity(page){
 return await page.evaluate(async()=>{
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const sample=()=>[...new Set([...document.querySelectorAll('canvas,[data-w-id],.w-nav,header,[class*=hero]'),...document.getAnimations().map(a=>a.effect?.target).filter(Boolean)])].filter(visible).slice(0,100).map(e=>{const s=getComputedStyle(e);let pixels=null;if(e.tagName==='CANVAS')try{{const data=e.toDataURL();let hash=0;for(let i=0;i<data.length;i++)hash=(Math.imul(hash,31)+data.charCodeAt(i))|0;pixels=String(hash);}}catch{}return {kind:e.matches('.w-nav,header')?'navigation':e.tagName==='CANVAS'?'canvas':'hero',id:e.id||e.className,transform:s.transform,opacity:s.opacity,top:s.top,background:s.backgroundColor,pixels};});
  window.scrollTo(0,0);await new Promise(r=>setTimeout(r,120));const initial=sample();await new Promise(r=>setTimeout(r,450));const later=sample();
  const sticky=[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='sticky').slice(0,12);const stickyResults=[];
  for(const el of sticky){const top=Number.parseFloat(getComputedStyle(el).top)||0;const target=el.getBoundingClientRect().top+scrollY-top+40;window.scrollTo(0,target);await new Promise(r=>setTimeout(r,80));const a=el.getBoundingClientRect().top,at=scrollY;window.scrollTo(0,target+60);await new Promise(r=>setTimeout(r,80));const b=el.getBoundingClientRect().top;stickyResults.push({moved:scrollY-at,pinned:Math.abs(a-b)<3&&Math.abs(a-top)<4});}
  window.scrollTo(0,Math.min(innerHeight,document.documentElement.scrollHeight-innerHeight));await new Promise(r=>setTimeout(r,450));const scrolled=sample();
  const slider=document.querySelector('#testimonial');let geometry=null;if(slider){slider.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,200));const cards=[...slider.querySelectorAll('.swiper-slide')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,active:e.classList.contains('swiper-slide-active')};});const on=cards.filter(r=>r.right>0&&r.left<innerWidth);geometry={viewport:innerWidth,visibleCards:on.length,left:Math.min(...on.map(r=>r.left)),right:Math.max(...on.map(r=>r.right)),activeCentered:on.some(r=>r.active&&Math.abs((r.left+r.right)/2-innerWidth/2)<8),overflow:getComputedStyle(slider).overflowX};}
  window.scrollTo(0,0);
  const changed=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
  return {motion:{present:initial.length>0,changed:changed(initial,later),scrollChanged:changed(later,scrolled),heroChanged:changed(initial.filter(x=>x.kind==='hero'),scrolled.filter(x=>x.kind==='hero')),navChanged:changed(initial.filter(x=>x.kind==='navigation'),scrolled.filter(x=>x.kind==='navigation')),canvas:initial.filter(x=>x.pixels).length,canvasChanged:initial.some((x,i)=>x.pixels&&later[i]?.pixels!==x.pixels)},sticky:stickyResults,slider:geometry,controls:[...document.querySelectorAll('input:not([type=hidden]),select,button,a')].map(e=>`${e.tagName.toLowerCase()}:${e.getAttribute('type')||''}:${(e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.textContent).replace(/\s+/g,' ').trim().toLowerCase()}`).filter(x=>!x.endsWith(':'))};
 });
}
export function compareFidelity(source,local){
 if(!source)return [{name:'Source behavior baseline',status:'not-tested'}];
 const checks=[];const add=(name,required,pass)=>checks.push({name,status:required?(pass?'pass':'fail'):'not-applicable'});
 add('Source controls only',true,local.controls.every(x=>source.controls.includes(x)));
 checks.push({name:'Animation activity',status:source.motion.changed?(local.motion.changed?'pass':'fail'):(source.motion.present?'not-tested':'not-applicable')});
 add('Hero / scroll into view',source.motion.heroChanged??source.motion.scrollChanged,local.motion.heroChanged??local.motion.scrollChanged);add('Navigation scroll behavior',source.motion.navChanged??false,local.motion.navChanged??false);
 checks.push({name:'Canvas / particles',status:source.motion.canvasChanged?(local.motion.canvasChanged?'pass':'fail'):(source.motion.canvas?'not-tested':'not-applicable')});
 add('Sticky pinning',source.sticky.some(x=>x.pinned),local.sticky.filter(x=>x.pinned).length>=source.sticky.filter(x=>x.pinned).length);
 if(source.slider){const s=source.slider,l=local.slider;add('Testimonial edge spacing',true,!!l&&l.visibleCards>=s.visibleCards&&Math.abs(l.left-s.left)<10&&Math.abs(l.right-s.right)<10&&(!s.activeCentered||l.activeCentered));}
 return checks;
}
