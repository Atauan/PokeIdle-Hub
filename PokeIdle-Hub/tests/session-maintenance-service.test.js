'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSessionMaintenanceHandlers } = require('../session-maintenance-service');

function dirent(name, type = 'file') {
  return {
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
    isSymbolicLink: () => type === 'symlink',
  };
}

function setup({
  exists = true,
  clearStorageError = false,
  clearCacheErrors = [],
  readDirectoryError = false,
  pathError = false,
  metrics = [
    [{ memory: { privateBytes: 1000 } }, { memory: { privateBytes: 500 } }],
    [{ memory: { privateBytes: 800 } }, { memory: { privateBytes: 400 } }],
  ],
} = {}) {
  const handlers = new Map();
  const opened = [];
  const storageClears = [];
  const cacheClears = [];
  const gc = { calls: 0 };
  const restart = { calls: 0 };
  const cacheSizes = new Map([
    ['persist:pokeidlehub', 100],
    ['persist:pokeidlehub-acc-active', 200],
    ['persist:pokeidlehub-acc-saved', 300],
    ['default', 50],
  ]);
  const sizes = new Map([
    ['C:/Profile/Session Data/Cookies', 600],
    ['C:/Profile/Session Data/Partitions/pokeidlehub-acc-saved/Cache/data', 400],
    ['C:/Profile/Session Data/Partitions/pokeidlehub-acc-saved/Cache/link', 9000],
  ]);
  const directories = new Map([
    ['C:/Profile/Session Data', [dirent('Cookies'), dirent('Partitions', 'directory')]],
    ['C:/Profile/Session Data/Partitions', [dirent('pokeidlehub-acc-saved', 'directory'), dirent('other-profile', 'directory'), dirent('pokeidlehub-acc-link', 'symlink')]],
    ['C:/Profile/Session Data/Partitions/pokeidlehub-acc-saved', [dirent('Cache', 'directory')]],
    ['C:/Profile/Session Data/Partitions/pokeidlehub-acc-saved/Cache', [dirent('data'), dirent('link', 'symlink')]],
    ['C:/Profile/User Data', [dirent('Partitions', 'directory'), dirent('market-samples.jsonl'), dirent('SingletonLock')]],
  ]);
  const removed = [];
  const fs = {
    existsSync: () => exists,
    readdirSync: targetDir => directories.get(targetDir) ?? directories.get('C:/Profile/Session Data/Partitions') ?? [],
    rmSync: targetPath => { removed.push(targetPath); },
    promises: {
      readdir: async directory => {
        if (readDirectoryError) throw new Error('directory unavailable');
        return directories.get(directory) ?? [];
      },
      stat: async file => ({ size: sizes.get(file) ?? 0 }),
    },
  };
  const sessionFor = partition => ({
    clearStorageData: async () => {
      storageClears.push(partition);
      if (clearStorageError) throw new Error('storage clear failed');
    },
    getCacheSize: async () => {
      if (clearCacheErrors.includes(`read:${partition}`)) throw new Error('cache size failed');
      return cacheSizes.get(partition) ?? 0;
    },
    clearCache: async () => {
      cacheClears.push(partition);
      if (clearCacheErrors.includes(partition)) throw new Error('cache clear failed');
      cacheSizes.set(partition, 0);
    },
  });
  const session = {
    fromPartition: partition => sessionFor(partition),
    defaultSession: {
      clearStorageData: async () => {
        storageClears.push('default');
      },
      getCacheSize: async () => cacheSizes.get('default'),
      clearCache: async () => {
        cacheClears.push('default');
        if (clearCacheErrors.includes('default')) throw new Error('cache clear failed');
        cacheSizes.set('default', 0);
      },
    },
  };
  let metricCall = 0;
  registerSessionMaintenanceHandlers({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler), on: (channel, handler) => handlers.set(channel, handler) },
    isTrustedSender: event => event.trusted === true,
    session,
    fs,
    primaryPartition: 'persist:pokeidlehub',
    configuredPartitions: new Set(['persist:pokeidlehub-acc-active']),
    getSessionDataPath: () => {
      if (pathError) throw new Error('path failure');
      return 'C:/Profile/Session Data';
    },
    getUserDataPath: () => 'C:/Profile/User Data',
    joinPath: (...parts) => parts.join('/'),
    openPath: async dir => { opened.push(dir); },
    garbageCollect: () => { gc.calls += 1; },
    getAppMetrics: () => metrics[Math.min(metricCall++, metrics.length - 1)],
    relaunch: () => { restart.calls += 1; },
  });
  return { handlers, opened, storageClears, cacheClears, cacheSizes, gc, restart, removed };
}

test('clear-account deletes only a valid additional account partition', async () => {
  const context = setup();
  assert.equal(await context.handlers.get('clear-account')({ trusted: true }, 'secondary-1'), true);
  assert.deepEqual(context.storageClears, ['persist:pokeidlehub-acc-secondary-1']);
  assert.equal(await context.handlers.get('clear-account')({ trusted: true }, 'invalid id'), false);
  assert.equal(await context.handlers.get('clear-account')({ trusted: false }, 'secondary-2'), false);
  assert.deepEqual(context.storageClears, ['persist:pokeidlehub-acc-secondary-1']);
});

test('open-data-dir exposes only the configured user data directory to trusted app content', () => {
  const context = setup();
  context.handlers.get('open-data-dir')({ trusted: false });
  context.handlers.get('open-data-dir')({ trusted: true });
  assert.deepEqual(context.opened, ['C:/Profile/User Data']);
});

test('summary separates total session-data size from cache HTTP size and ignores symlinks', async () => {
  const context = setup();
  const summary = await context.handlers.get('session-maintenance-summary')({ trusted: true });

  assert.deepEqual(summary, {
    ok: true,
    sessionDataBytes: 1000,
    sessionDataPartial: false,
    httpCacheBytes: 650,
    httpCacheAvailable: true,
    failureCount: 0,
  });
  assert.deepEqual(context.storageClears, []);
});

test('summary reports partial folder scans and unavailable cache sizes without rejecting other results', async () => {
  const context = setup({ readDirectoryError: true, clearCacheErrors: ['read:persist:pokeidlehub-acc-active'] });
  const summary = await context.handlers.get('session-maintenance-summary')({ trusted: true });

  assert.equal(summary.ok, true);
  assert.equal(summary.sessionDataBytes, null);
  assert.equal(summary.sessionDataPartial, true);
  assert.equal(summary.httpCacheAvailable, false);
  assert.equal(summary.httpCacheBytes, null);
  assert.ok(summary.failureCount >= 2);
});

test('clean-ram reports cache and app-memory measurements without clearing persistent storage', async () => {
  const context = setup();
  const result = await context.handlers.get('clean-ram')({ trusted: true });

  assert.deepEqual(result, {
    ok: true,
    partial: false,
    cacheBytesBefore: 650,
    cacheBytesAfter: 0,
    cacheBytesObservedCleared: 650,
    cacheFailures: 0,
    measurementFailures: 0,
    memoryBeforeBytes: 1536000,
    memoryAfterBytes: 1228800,
    memoryMeasurement: 'private-bytes',
    garbageCollectionRequested: true,
  });
  assert.deepEqual(context.cacheClears.sort(), [
    'default',
    'persist:pokeidlehub',
    'persist:pokeidlehub-acc-active',
    'persist:pokeidlehub-acc-saved',
  ]);
  assert.deepEqual(context.storageClears, []);
  assert.equal(context.gc.calls, 1);
});

test('clean-ram reports partial failures and still clears sessions that succeed', async () => {
  const context = setup({ clearCacheErrors: ['persist:pokeidlehub-acc-saved'] });
  const result = await context.handlers.get('clean-ram')({ trusted: true });

  assert.equal(result.ok, false);
  assert.equal(result.partial, true);
  assert.equal(result.cacheFailures, 1);
  assert.equal(result.cacheBytesBefore, 650);
  assert.equal(result.cacheBytesAfter, 300);
  assert.equal(result.cacheBytesObservedCleared, 350);
  assert.deepEqual(context.storageClears, []);
});

test('maintenance rejects untrusted renderers and restarts only on explicit trusted request', async () => {
  const context = setup();
  assert.deepEqual(await context.handlers.get('session-maintenance-summary')({ trusted: false }), { ok: false });
  assert.deepEqual(await context.handlers.get('clean-ram')({ trusted: false }), { ok: false });
  assert.deepEqual(await context.handlers.get('restart-app')({ trusted: false }), { ok: false });
  assert.deepEqual(await context.handlers.get('restart-app')({ trusted: true }), { ok: true });
  assert.equal(context.restart.calls, 1);
});

test('reset-app-data rejects untrusted renderers', async () => {
  const context = setup();
  assert.deepEqual(await context.handlers.get('reset-app-data')({ trusted: false }), { ok: false });
  assert.equal(context.restart.calls, 0);
  assert.deepEqual(context.storageClears, []);
  assert.deepEqual(context.removed, []);
});

test('reset-app-data clears all sessions, removes non-lock userData files and restarts', async () => {
  const context = setup();
  const result = await context.handlers.get('reset-app-data')({ trusted: true });

  assert.deepEqual(result, { ok: true });
  assert.ok(context.storageClears.includes('persist:pokeidlehub'));
  assert.ok(context.storageClears.includes('persist:pokeidlehub-acc-active'));
  assert.ok(context.storageClears.includes('persist:pokeidlehub-acc-saved'));
  assert.ok(context.storageClears.includes('default'));
  assert.deepEqual(context.removed, ['C:/Profile/User Data/Partitions', 'C:/Profile/User Data/market-samples.jsonl']);
  assert.ok(!context.removed.includes('C:/Profile/User Data/SingletonLock'));
  assert.equal(context.restart.calls, 1);
});
