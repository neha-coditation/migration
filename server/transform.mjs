import {addDeployment} from './deployment.mjs';
import {load} from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import {routePath} from './url-policy.mjs';
export function resolveReference(value,base,resources,routes){
 if(['/migration-collections.js','/migration-guard.js'].includes(value))return value;
 if(!value||/^(?:data:|blob:|mailto:|tel:|#)/i.test(value))return value;
 if(/^javascript:/i.test(value))return '#';
 try { const u=new URL(value,base),hash=u.hash;u.hash='';
   if(routes.has(u.href)||!u.search&&routes.has(u.origin+u.pathname.replace(/\/$/,'')))return routePath(u.href)+hash;
   const asset=resources.get(u.href);return asset?`/migrated/${asset.file}${hash}`:u.href+hash;
 }catch{return value;}
}
export function rewriteCSS(text,base,resources,routes){return text.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/g,(_,a,b,c)=>`url("${resolveReference(a??b??c,base,resources,routes)}")`).replace(/@import\s+(["'])(.*?)\1/g,(_,q,u)=>`@import ${q}${resolveReference(u,base,resources,routes)}${q}`);}
export function rewriteJS(text,base,resources,routes){
 // Exact observed URL rewrites plus imports relative to the original resource location.
 for(const [url,a] of resources)if(a.type!=='text/html')for(const quote of ['\"',"'",'`'])text=text.split(quote+url+quote).join(quote+`/migrated/${a.file}`+quote);
 return text.replace(/((?:\bfrom\s*|\bimport\s*\(|\bimport\s*|\bfetch\s*\(|\bnew\s+URL\s*\()\s*["'])([^"']+)(["'])/g,(all,p,u,q)=>{if(!/^(https?:|\/|\.\/|\.\.\/)/.test(u))return all;return p+resolveReference(u,base,resources,routes)+q;});
}

export function rewriteSVG(text,base,resources,routes){const $=load(text,{xmlMode:true});$('*').each((_,el)=>{const e=$(el);for(const attr of ['href','xlink:href'])if(e.attr(attr))e.attr(attr,resolveReference(e.attr(attr),base,resources,routes));if(e.attr('style'))e.attr('style',rewriteCSS(e.attr('style'),base,resources,routes));});$('style').each((_,el)=>$(el).text(rewriteCSS($(el).text(),base,resources,routes)));return $.xml();}
export function rewriteAnimationJSON(text,base,resources,routes){
 try{const data=JSON.parse(text);for(const asset of data.assets||[]){if(asset.p&&!asset.p.startsWith('data:')){const original=(asset.u||'')+asset.p,local=resolveReference(original,base,resources,routes);if(local.startsWith('/migrated/')){asset.u='';asset.p=local;asset.e=1;}}}for(const asset of [...data.images||[],...data.buffers||[]])if(asset.uri)asset.uri=resolveReference(asset.uri,base,resources,routes);return JSON.stringify(data);}catch{return text;}
}
export function transformHTML(document,resources,routes){
 const $=load(document.html);const base=document.url;
 $('base,meta[http-equiv="Content-Security-Policy"]').remove();
 $('script').each((_,el)=>{const node=$(el);if(/googletagmanager\.com|google-analytics\.com|clarity\.ms|static\.hotjar\.com|analytics\.ahrefs\.com/.test(node.attr('src')||'')||!node.attr('src')&&/gtag\(|googletagmanager\.com|clarity\.ms/.test(node.text()))node.remove();});
 $('[integrity]').removeAttr('integrity');$('[crossorigin]').removeAttr('crossorigin');
 $('link[rel=preconnect],link[rel=dns-prefetch]').remove();
 $('*').each((_,el)=>{const e=$(el);
  for(const attr of ['src','href','xlink:href','poster','data-src']) {const value=e.attr(attr);if(!value)continue;if(el.name==='link'&&/canonical/.test(e.attr('rel')||''))continue;e.attr(attr,resolveReference(value,base,resources,routes));}
  if(e.attr('srcset')&&!e.attr('srcset').startsWith('data:'))e.attr('srcset',e.attr('srcset').split(',').map(x=>{const [u,...rest]=x.trim().split(/\s+/);return [resolveReference(u,base,resources,routes),...rest].join(' ');}).join(', '));
  if(e.attr('style'))e.attr('style',rewriteCSS(e.attr('style'),base,resources,routes));
  if(e.attr('data-video-urls'))e.attr('data-video-urls',e.attr('data-video-urls').split(',').map(x=>resolveReference(x,base,resources,routes)).join(','));
 });
 $('style').each((_,el)=>$(el).text(rewriteCSS($(el).html(),base,resources,routes)));
 $('script:not([src])').each((_,el)=>{if(!/json/i.test($(el).attr('type')||''))$(el).text(rewriteJS($(el).html()||'',base,resources,routes));});
 const forms=[];$('form').each((_,el)=>{if($(el).find('[type=submit]').length&&!$(el).is('[fs-cmsfilter-element=filters]'))forms.push({name:$(el).attr('name')||$(el).attr('id')||'Unnamed form',action:$(el).attr('action')||'Script controlled'});});
 if(!$('link[rel=canonical]').length)$('head').append(`<link rel="canonical" href="${base.replaceAll('&','&amp;').replaceAll('"','&quot;')}">`);
 $('head').prepend('<script src="/migration-guard.js"></script>');
 const references=[];$('[src],link[href]').each((_,e)=>{for(const attr of ['src','href']){const u=$(e).attr(attr);if(u&&/^https?:/.test(u)&&!['canonical','alternate'].includes($(e).attr('rel')))references.push(u);}});
 return {html:$.html(),forms,remoteResources:[...new Set(references)]};
}
export async function generateAstro(root,documents,resources,{astroVersion='7.4.2'}={}){
 const project=path.join(root,'astro-project');await fs.mkdir(path.join(project,'src/pages'),{recursive:true});await fs.mkdir(path.join(project,'src/data'),{recursive:true});await fs.mkdir(path.join(project,'public/migrated'),{recursive:true});
 const routes=new Set(documents.map(d=>d.url));const output=[];
 for(const doc of documents){const result=transformHTML(doc,resources,routes);doc.forms=result.forms;doc.remoteResources=result.remoteResources;output.push({route:routePath(doc.url),html:result.html});}
 for(const [url,asset] of resources){let data=await fs.readFile(asset.disk);if(/css|javascript|ecmascript|json|svg|text\/html/.test(asset.type)){
 let text=data.toString('utf8');if(/css/.test(asset.type))text=rewriteCSS(text,asset.originalURL||url,resources,routes);else if(/svg/.test(asset.type))text=rewriteSVG(text,asset.originalURL||url,resources,routes);else if(/json/.test(asset.type))text=rewriteAnimationJSON(text,asset.originalURL||url,resources,routes);else if(/text\/html/.test(asset.type))text=transformHTML({url:asset.originalURL||url,html:text},resources,routes).html;else text=rewriteJS(text,asset.originalURL||url,resources,routes);data=Buffer.from(text);
 }await fs.writeFile(path.join(project,'public/migrated',asset.file),data);}
 await fs.writeFile(path.join(project,'src/data/pages.json'),JSON.stringify(output,null,2));
 await fs.writeFile(path.join(project,'src/pages/[...path].astro'),`---\nimport pages from '../data/pages.json';\nexport const prerender = true;\nexport function getStaticPaths() { return pages.map(page => ({ params: { path: page.route === '/' ? undefined : page.route.slice(1) }, props: { markup: page.html } })); }\nconst { markup } = Astro.props;\n---\n<Fragment set:html={markup} />\n`);
 await fs.writeFile(path.join(project,'astro.config.mjs'),`import { defineConfig } from 'astro/config';\nexport default defineConfig({site:process.env.ASTRO_SITE||undefined,base:process.env.ASTRO_BASE||'/',output:'static',compressHTML:false,build:{format:'directory'}});\n`);
 await fs.writeFile(path.join(project,'package.json'),JSON.stringify({name:'migrated-astro-site',version:'1.0.0',private:true,type:'module',scripts:{dev:'astro dev',build:'astro build',postbuild:'node scripts/github-pages.mjs',preview:'astro preview'},dependencies:{astro:astroVersion}},null,2));
 await fs.copyFile(new URL('./collection-runtime.js',import.meta.url),path.join(project,'public/migration-collections.js'));
 const mapping=Object.fromEntries([...resources].map(([url,asset])=>[url,'/migrated/'+asset.file]));
 const chunkAliases={};for(const [url,asset] of resources){const name=new URL(url).pathname.split('/').pop();if(/^webflow\.achunk\.[a-f0-9]+\.js$/.test(name))chunkAliases[name]='/migrated/'+asset.file;}
 const guard=`/* Keep observed dynamic resource URLs local. Unknown dependencies remain QA findings. */
(()=>{const map=${JSON.stringify(mapping).replaceAll('<','\\u003c')};const sourceOrigin=${JSON.stringify(new URL(documents[0].url).origin)};
const chunkAliases=${JSON.stringify(chunkAliases)};
function local(value){try{const parsed=new URL(String(value),location.href);const name=parsed.pathname.split('/').pop();if(parsed.origin===location.origin&&chunkAliases[name])return chunkAliases[name];const absolute=new URL(String(value),sourceOrigin+location.pathname).href;return map[absolute]||value;}catch{return value;}}
const originalFetch=window.fetch;window.fetch=function(input,options){if(typeof input==='string'||input instanceof URL)input=local(input);return originalFetch.call(this,input,options);};
const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...rest){return open.call(this,method,local(url),...rest);};
for(const [type,key] of [[HTMLScriptElement,'src'],[HTMLImageElement,'src'],[HTMLLinkElement,'href'],[HTMLIFrameElement,'src'],[HTMLSourceElement,'src'],[HTMLMediaElement,'src']]){const descriptor=Object.getOwnPropertyDescriptor(type.prototype,key);if(descriptor?.set&&descriptor.configurable)Object.defineProperty(type.prototype,key,{...descriptor,set(value){descriptor.set.call(this,local(value));}});}
const set=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,value){if((name==='src'||name==='href')&&['SCRIPT','IMG','LINK','IFRAME','SOURCE','VIDEO','AUDIO'].includes(this.tagName))value=local(value);return set.call(this,name,value);};
document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
})();`;
 await fs.writeFile(path.join(project,'public/migration-guard.js'),guard);
 await fs.writeFile(path.join(project,'README.md'),`# Migrated Astro website\n\nRun npm install, npm run build, then npm run preview. Requires Node 22.23.4 or later.\n\nCaptured markup is in src/data/pages.json. The Astro catch-all page statically generates clean routes. Browser scripts and assets are cached in public/migrated. This is an Astro snapshot migration, not a redesign into semantic components.\n\nRead the migration report before use. Source forms are blocked from submitting; no backend, deployment, login, payment or private CMS implementation is included. Uncaptured API dependencies or dynamic imports may still need repairs.\n`);
 await fs.writeFile(path.join(project,'public/404.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page not migrated</title></head><body><h1>Page not included</h1><p>This route was not captured.</p><a href="/">Home</a></body></html>');
 await addDeployment(project);
 return project;
}
