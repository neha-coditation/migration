import test from 'node:test';
import assert from 'node:assert/strict';
import {createNeonApi} from '../server/neon/api-handler.mjs';

const pid='11111111-1111-4111-8111-111111111111';
const owner='person-123';
function harness() {
 const calls=[];
 const state={
  createProject:async x=>(calls.push(['create',x]),{id:x.id,owner_subject:x.ownerSubject,source_url:x.sourceUrl}),
  getProject:async x=>(calls.push(['get',x]),x.ownerSubject===owner?{id:x.id,source_url:'https://example.com/'}:null),
  listPages:async x=>(calls.push(['list',x]),[]),
  queuePage:async x=>(calls.push(['queue',x]),{id:x.id,route:x.route})
 };
 return {calls, handle:createNeonApi({state,authenticate:async token=>token==='valid'?{subject:owner}:null})};
}
const req=(path,method='GET',body,token='valid')=>new Request('https://studio.example'+path,{
 method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{})
});
test('unauthenticated users cannot access or create projects',async()=>{
 const {handle,calls}=harness();
 assert.equal((await handle(req('/api/neon/projects/'+pid,'GET',null,null))).status,401);
 assert.equal((await handle(req('/api/neon/projects','POST',{sourceUrl:'https://example.com/'},'bad'))).status,401);
 assert.equal(calls.length,0);
});
test('project creates use verified session subject, not caller body',async()=>{
 const {handle,calls}=harness();
 const result=await handle(req('/api/neon/projects','POST',{sourceUrl:'https://example.com/',ownerSubject:'attacker'}));
 assert.equal(result.status,201);assert.equal(calls[0][1].ownerSubject,owner);
});
test('page enqueue is bounded to the parent origin',async()=>{
 const {handle,calls}=harness();
 const foreign=await handle(req('/api/neon/projects/'+pid+'/pages','POST',{sourceUrl:'https://evil.example/x'}));
 assert.equal(foreign.status,400);assert.equal(calls.some(c=>c[0]==='queue'),false);
 const allowed=await handle(req('/api/neon/projects/'+pid+'/pages','POST',{sourceUrl:'/blog'}));
 assert.equal(allowed.status,201);assert.equal(calls.at(-1)[1].route,'/blog');
});
