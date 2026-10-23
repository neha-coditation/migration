import test from 'node:test';
import assert from 'node:assert/strict';
import {NeonPageQueue} from '../server/neon/page-queue.mjs';

test('enqueue uses placeholders and retains unique project routes', async () => {
  const calls = [];
  const queue = new NeonPageQueue({query: async (sql, params) => {
    calls.push({sql, params});
    return {rows: [{id: params[0]}]};
  }});
  const result = await queue.enqueue({id: 'job-1', projectId: 'p', route: '/blog', sourceUrl: 'https://example.com/blog'});
  assert.equal(result.id, 'job-1');
  assert.match(calls[0].sql, /ON CONFLICT \(project_id, route\) DO NOTHING/);
  assert.deepEqual(calls[0].params, ['job-1', 'p', '/blog', 'https://example.com/blog', 3]);
});

test('claim and heartbeat pass worker identity through parameters', async () => {
  const calls = [];
  const queue = new NeonPageQueue({query: async (sql, params) => {
    calls.push(params); return {rows: [{renewed: true}]};
  }});
  await queue.claim('worker-1');
  assert.equal(await queue.heartbeat('job-1', 'worker-1'), true);
  assert.deepEqual(calls, [['worker-1', 900], ['job-1', 'worker-1', 900]]);
});

test('completion refuses invalid statuses and enforces lease ownership in SQL', async () => {
  const calls = [];
  const queue = new NeonPageQueue({query: async (sql, params) => {
    calls.push({sql, params}); return {rows: [{status: params[2]}]};
  }});
  await assert.rejects(() => queue.complete({jobId: 'job-1', workerId: 'worker-1', status: 'queued'}), /Invalid terminal status/);
  const done = await queue.complete({jobId: 'job-1', workerId: 'worker-1', status: 'verified', manifest: {sha256: 'abc'}});
  assert.equal(done.status, 'verified');
  assert.match(calls[0].sql, /lease_owner=\$2 AND status='running'/);
  assert.deepEqual(calls[0].params.slice(0, 3), ['job-1', 'worker-1', 'verified']);
});
