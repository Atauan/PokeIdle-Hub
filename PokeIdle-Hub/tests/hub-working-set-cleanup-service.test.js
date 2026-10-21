'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHubWorkingSetCleanupService } = require('../hub-working-set-cleanup-service');

function setup({ platform = 'win32', metrics, afterMetrics, outcomes, trusted = true } = {}) {
  const calls = [];
  let reads = 0;
  const service = createHubWorkingSetCleanupService({
    platform,
    isTrustedSender: event => event.trusted,
    getAppMetrics: () => reads++ === 0 ? metrics : (afterMetrics ?? metrics),
    trimProcesses: async processes => {
      calls.push(processes);
      return outcomes ?? { results: processes.map(process => ({ pid: process.pid, status: 'trimmed' })) };
    },
  });
  return { service, calls, event: { trusted } };
}

test('trims only unique valid PIDs from Electron metrics and reports observed working-set reduction', async () => {
  const { service, calls, event } = setup({
    metrics: [
      { pid: 101, creationTime: 1000, memory: { workingSetSize: 2048 } },
      { pid: 102, creationTime: 2000, memory: { workingSetSize: 1024 } },
      { pid: 101, creationTime: 1000, memory: { workingSetSize: 2048 } },
      { pid: -1, creationTime: 3000, memory: { workingSetSize: 1 } },
      { pid: 103, creationTime: 3000, memory: { workingSetSize: 1 } },
    ],
    afterMetrics: [
      { pid: 101, creationTime: 1000, memory: { workingSetSize: 1024 } },
      { pid: 102, creationTime: 2000, memory: { workingSetSize: 512 } },
      { pid: 103, creationTime: 3000, memory: { workingSetSize: 1 } },
    ],
  });

  const result = await service.trim(event);

  assert.deepEqual(calls[0], [{ pid: 101, creationTime: 1000 }, { pid: 102, creationTime: 2000 }, { pid: 103, creationTime: 3000 }]);
  assert.equal(result.ok, true);
  assert.equal(result.attempted, 3);
  assert.equal(result.trimmed, 3);
  assert.equal(result.workingSetBeforeBytes, 3073 * 1024);
  assert.equal(result.workingSetAfterBytes, 1537 * 1024);
  assert.equal(result.observedBytesReduced, 1536 * 1024);
});

test('reports partial outcomes without elevating or stopping other process attempts', async () => {
  const { service, event } = setup({
    metrics: [
      { pid: 201, creationTime: 1000, memory: { workingSetSize: 1024 } },
      { pid: 202, creationTime: 2000, memory: { workingSetSize: 1024 } },
    ],
    outcomes: { results: [{ pid: 201, status: 'trimmed' }, { pid: 202, status: 'access-denied' }] },
  });

  const result = await service.trim(event);

  assert.equal(result.ok, false);
  assert.equal(result.partial, true);
  assert.equal(result.trimmed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.accessDenied, 1);
});

test('rejects untrusted renderer requests before reading or trimming process metrics', async () => {
  const { service, calls } = setup({ trusted: false, metrics: [] });

  assert.deepEqual(await service.trim({ trusted: false }), { ok: false });
  assert.deepEqual(calls, []);
});

test('reports unsupported operating systems without invoking the Windows adapter', async () => {
  const { service, calls, event } = setup({ platform: 'linux', metrics: [] });

  const result = await service.trim(event);

  assert.equal(result.ok, false);
  assert.equal(result.unavailable, true);
  assert.deepEqual(calls, []);
});
