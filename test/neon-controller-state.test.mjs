import test from 'node:test';
import assert from 'node:assert/strict';
import {NeonControllerState} from '../server/neon/controller-state.mjs';

test('page queue requires matching project ownership and preserves existing routes', async () => {
  const calls = [];
  const state = new NeonControllerState({query: async (sql, params) => {
    calls.push({sql, params}); return {rows: [{id: params[0]}]};
  }});
  const result = await state.queuePage({
    id: 'job-1', projectId: 'project-1', ownerSubject: 'verified-user',
    route: '/news', sourceUrl: 'https://example.org/news'
  });
  assert.equal(result.id, 'job-1');
  assert.match(calls[0].sql, /p.owner_subject = \$3/);
  assert.match(calls[0].sql, /ON CONFLICT \(project_id, route\) DO NOTHING/);
  assert.deepEqual(calls[0].params, ['job-1','project-1','verified-user','/news','https://example.org/news',3]);
});

test('project reading is scoped to verified owner and cannot overwrite existing IDs', async () => {
  const calls = [];
  const state = new NeonControllerState({query: async (sql, params) => {
    calls.push({sql, params}); return {rows: []};
  }});
  assert.equal(await state.createProject({id:'p',ownerSubject:'user',sourceUrl:'https://example.org'}),null);
  assert.equal(await state.getProject({id:'p',ownerSubject:'user'}),null);
  assert.match(calls[0].sql, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(calls[1].sql, /owner_subject = \$2/);
});

test('progress updates cannot be issued by a worker without a current lease', async () => {
  const calls = [];
  const state = new NeonControllerState({query: async (sql, params) => {
    calls.push({sql, params}); return {rows: []};
  }});
  assert.equal(await state.recordProgress({jobId:'j',workerId:'w',stage:'qa',progress:70}),null);
  assert.match(calls[0].sql, /lease_owner = \$2/);
  assert.match(calls[0].sql, /lease_until > now\(\)/);
  await assert.rejects(() => state.recordProgress({jobId:'j',workerId:'w',stage:'qa',progress:101}),/Invalid progress/);
  assert.equal(calls.length,1);
});
