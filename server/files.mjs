import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
export async function writeJSON(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2));}
export async function readJSON(file){return JSON.parse(await fs.readFile(file,'utf8'));}
export function inside(root,relative){const p=path.resolve(root,relative);if(p!==path.resolve(root)&&!p.startsWith(path.resolve(root)+path.sep))throw new Error('Invalid artifact path.');return p;}
export const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.webp':'image/webp','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4','.webm':'video/webm','.ico':'image/x-icon','.zip':'application/zip','.txt':'text/plain'};
export async function staticResponse(req,res,root,pathname){
 try{let file=inside(root,decodeURIComponent(pathname).replace(/^\//,''));let stat=await fs.stat(file).catch(()=>null);if(stat?.isDirectory()){file=path.join(file,'index.html');stat=await fs.stat(file).catch(()=>null);}if(!stat?.isFile()){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Page not included in this migration');return;}
 res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(await fs.readFile(file));
 }catch{res.writeHead(400);res.end('Invalid path');}
}
export async function preview(root){const server=createServer((req,res)=>staticResponse(req,res,root,new URL(req.url,'http://localhost').pathname));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};}
