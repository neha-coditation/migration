import fs from 'node:fs/promises';
import path from 'node:path';
const base=(process.env.ASTRO_BASE||'/').replace(/\/$/,'');
if(base&&!/^\/[a-zA-Z0-9._/-]+$/.test(base))throw new Error('ASTRO_BASE must be a URL path, such as /my-repo');
if(base){
 const pages=JSON.parse(await fs.readFile('src/data/pages.json','utf8'));
 const routes=new Set(pages.map(p=>p.route));const publicRoots=new Set((await fs.readdir('public',{withFileTypes:true})).map(e=>'/'+e.name+(e.isDirectory()?'/':'')));const isAsset=value=>[...publicRoots].some(root=>root.endsWith('/')?value.startsWith(root):value.split(/[?#]/)[0]===root);
 const prefix=value=>value.startsWith('/')&&!value.startsWith('//')&&(isAsset(value)||routes.has(value.split(/[?#]/)[0].replace(/\/$/,'')||'/'))?base+value:value;
 async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(html|css|js|mjs|json|svg)$/.test(entry.name)){let text=await fs.readFile(file,'utf8');text=text.replace(/(["'`])(\/(?!\/)[^"'`\s<>]*)\1/g,(all,quote,value)=>quote+(value==='/'?value:prefix(value))+quote);text=text.replace(/(\b(?:href|src|poster|data-src)=)(["'])(\/)\2/g,(all,attribute,quote,value)=>attribute+quote+prefix(value)+quote);text=text.replace(/(\bsrcset=)(["'])(.*?)\2/g,(all,attribute,quote,value)=>attribute+quote+value.split(',').map(part=>part.trim().split(/\s+/).map((token,i)=>i===0?prefix(token):token).join(' ')).join(', ')+quote);text=text.replace(/(\bcontent=["']0;\s*url=)(\/[^"']+)/g,(all,start,value)=>start+prefix(value));text=text.replace(/url\(\s*(\/(?!\/)[^\s)]+)\s*\)/g,(all,value)=>'url('+prefix(value)+')');await fs.writeFile(file,text);}}}
 await walk('dist');
}
await fs.writeFile('dist/.nojekyll','');
console.log('GitHub Pages paths prepared for '+(base||'/'));
if(process.env.ASTRO_SITE){
 const site=new URL(process.env.ASTRO_SITE);if(!['https:','http:'].includes(site.protocol))throw new Error('ASTRO_SITE must be an HTTP(S) origin');
 const canonical=route=>new URL((base||'')+(route==='/'?'/':route.replace(/\/$/,'')+'/'),site.origin).href;
 const pages=JSON.parse(await fs.readFile('src/data/pages.json','utf8'));
 for(const page of pages){const file=path.join('dist',page.route,'index.html');let text=await fs.readFile(file,'utf8'),url=canonical(page.route);text=text.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi,tag=>tag.replace(/\bhref=(["']).*?\1/i,'href="'+url+'"'));text=text.replace(/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/gi,tag=>tag.replace(/\bcontent=(["']).*?\1/i,'content="'+url+'"'));await fs.writeFile(file,text);}
 const sitemap='dist/sitemap.xml';try{let text=await fs.readFile(sitemap,'utf8');text=text.replace(/<loc>(.*?)<\/loc>/g,(all,url)=>{try{const route=new URL(url).pathname.replace(/\/$/,'')||'/';return '<loc>'+canonical(route)+'</loc>';}catch{return all;}});await fs.writeFile(sitemap,text);}catch(error){if(error.code!=='ENOENT')throw error;}
 try{let text=await fs.readFile('dist/robots.txt','utf8');text=text.replace(/^Sitemap:.*$/gm,'Sitemap: '+new URL((base||'')+'/sitemap.xml',site.origin).href);await fs.writeFile('dist/robots.txt',text);}catch(error){if(error.code!=='ENOENT')throw error;}
}
