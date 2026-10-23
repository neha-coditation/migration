import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDevelopmentAuthenticator, createNeonRuntime} from '../server/neon/runtime.mjs';

test('development bearer verifier uses configured hash and rejects wrong tokens', async () => {
 const tokenHash=createHash('sha256').update('sample-test-token').digest('hex');
 const verify=createDevelopmentAuthenticator({tokenHash,subject:'dev-user'});
 assert.deepEqual(await verify('sample-test-token'),{subject:'dev-user'});
 assert.equal(await verify('wrong'),null);
 assert.equal(await verify('x'.repeat(4097)),null);
 assert.throws(()=>createDevelopmentAuthenticator({tokenHash:'invalid',subject:'dev-user'}));
});
test('runtime fails closed without database or authenticator',()=>{
 assert.throws(()=>createNeonRuntime({db:null,authenticate:async()=>null}));
 assert.throws(()=>createNeonRuntime({db:{query:async()=>({rows:[]})}}));
});
test('runtime denies plaintext HTTP before attempting auth or database access', async()=>{
 let calls=0;
 const handler=createNeonRuntime({db:{query:async()=>{calls++;return {rows:[]}}},authenticate:async()=>{calls++;return {subject:'user'}}});
 const result=await handler(new Request('http://example.com/api/neon/projects'));
 assert.equal(result.status,403);assert.equal(calls,0);
});
