import {createServer} from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import {staticResponse} from '../server/files.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
for(const [port,dir] of [[4371,path.join(root,'fixture')],[4372,path.join(root,'../test-results/fixture/astro-project/dist')]])createServer((req,res)=>staticResponse(req,res,dir,new URL(req.url,'http://localhost').pathname)).listen(port,'127.0.0.1',()=>console.log(`Fixture ${port}`));
