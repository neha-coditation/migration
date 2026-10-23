import test from 'node:test';import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/neon/[[path]].js';
const req=(path,method='GET',headers={})=>({request:new Request('https://migration-studio-web.pages.dev'+path,{method,headers})});
test('Neon cloud proxy rejects absent authentication',async()=>{const r=await onRequest(req('/api/neon/projects'));assert.equal(r.status,401);assert.equal((await r.json()).error,'Authentication required');});
test('Neon cloud proxy rejects unsupported mutation methods',async()=>{const r=await onRequest(req('/api/neon/projects','DELETE'));assert.equal(r.status,405);});
test('Neon cloud proxy rejects unexpected paths without fetching',async()=>{const r=await onRequest(req('/api/neon/worker/status','GET',{authorization:'Bearer test'}));assert.equal(r.status,404);});
