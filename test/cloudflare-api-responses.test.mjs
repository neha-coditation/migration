import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

test('Cloudflare browser status returns explicit JSON readiness, never a false ready signal', async()=>{
 const mod=await import(pathToFileURL(process.cwd()+'/functions/api/browser/[[path]].js'));
 const r=await mod.onRequest({request:new Request('https://migration-studio-web.pages.dev/api/browser/status')});
 assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/json/);
 const result=await r.json();assert.equal(result.ready,false);assert.equal(result.status,'unavailable');
});
test('cloud-only app returns JSON 503 rather than empty HTML for unimplemented API', async()=>{
 const mod=await import(pathToFileURL(process.cwd()+'/functions/api/[[path]].js'));
 const r=await mod.onRequest({request:new Request('https://migration-studio-web.pages.dev/api/projects',{method:'POST'})});
 assert.equal(r.status,503);assert.equal((await r.json()).code,'BACKEND_NOT_CONNECTED');
});
test('frontend handles non-JSON response without bare JSON parse error',async()=>{
 for(const file of ['public/app.js','public/projects.js']){
  const s=await readFile(file,'utf8');assert.match(s,/safeApiJSON/);assert.match(s,/not connected/);
 }
});
