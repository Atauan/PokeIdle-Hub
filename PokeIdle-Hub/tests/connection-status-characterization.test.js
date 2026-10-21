'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createProviderConnectionService } = require('../provider-connection-service');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const ipcSource = fs.readFileSync(path.join(__dirname, '..', 'provider-connection-ipc.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

function createService(sessionForPartition) {
  const partitions = [];
  const service = createProviderConnectionService({
    session: {
      fromPartition(partition) {
        partitions.push(partition);
        return sessionForPartition(partition);
      },
    },
  });
  return { service, partitions };
}

test('provider status checks cookies in the requested account partition', async () => {
  const { service, partitions } = createService(() => ({
    cookies: {
      get: async ({ domain }) => domain === 'twitch.tv'
        ? [{ name: 'auth-token', value: 'present' }]
        : [{ name: 'session', value: 'present' }],
    },
  }));

  const status = await service.checkConnections('persist:pokeidlehub-acc-alt');

  assert.deepEqual(status, { twitch: true, kick: true, unavailableProviders: [] });
  assert.deepEqual(partitions, ['persist:pokeidlehub-acc-alt']);
});

test('a cookie read failure is reported separately from an absent cookie', async () => {
  const { service } = createService(() => ({
    cookies: { get: async () => { throw new Error('session unavailable'); } },
  }));

  assert.deepEqual(await service.checkConnections('persist:pokeidlehub'), {
    twitch: false,
    kick: false,
    unavailableProviders: ['twitch', 'kick'],
  });
});

test('one provider can be unavailable while the other has a positive cookie signal', async () => {
  const { service } = createService(() => ({
    cookies: {
      get: async ({ domain }) => {
        if (domain === 'twitch.tv') throw new Error('session unavailable');
        return [{ name: 'session', value: 'present' }];
      },
    },
  }));

  assert.deepEqual(await service.checkConnections('persist:pokeidlehub'), {
    twitch: false,
    kick: true,
    unavailableProviders: ['twitch'],
  });
});

test('disconnect removes only cookies for the selected provider and partition', async () => {
  const removed = [];
  const { service, partitions } = createService(() => ({
    cookies: {
      get: async ({ domain }) => domain === 'twitch.tv' ? [
        { domain: '.www.twitch.tv', path: '/login', secure: true, name: 'auth-token' },
        { domain: 'twitch.tv', path: '/', secure: false, name: 'other' },
      ] : [],
      remove: async (url, name) => removed.push([url, name]),
    },
  }));

  assert.equal(await service.clearConnection('twitch', 'persist:pokeidlehub-acc-alt'), true);
  assert.deepEqual(partitions, ['persist:pokeidlehub-acc-alt']);
  assert.deepEqual(removed, [
    ['https://www.twitch.tv/login', 'auth-token'],
    ['http://twitch.tv/', 'other'],
  ]);
  assert.equal(await service.clearConnection('google', 'persist:pokeidlehub'), false);
});

test('provider IPC module retains caller and partition validation while delegating cookie work', () => {
  assert.match(mainSource, /const providerConnectionService = createProviderConnectionService\(\{ session \}\)/);
  assert.match(mainSource, /registerProviderConnectionHandlers\(\{[\s\S]*?isTrustedSender: fromApp,[\s\S]*?providerConnectionService,/);
  assert.match(ipcSource, /ipcMain\.handle\('check-connections',[\s\S]*?if \(!isTrustedSender\(event\)\)[\s\S]*?providerConnectionService\.checkConnections\(targetPartition\)/);
  assert.match(ipcSource, /ipcMain\.handle\('clear-connection',[\s\S]*?if \(!isTrustedSender\(event\) \|\| !\['twitch', 'kick'\]\.includes\(platform\)\) return false;[\s\S]*?providerConnectionService\.clearConnection\(platform, targetPartition\)/);
  assert.match(preloadSource, /checkConnections: \(partition\) => ipcRenderer\.invoke\('check-connections', partition \? String\(partition\) : null\)/);
  assert.ok(packageJson.build.files.includes('provider-connection-service.js'));
  assert.ok(packageJson.build.files.includes('provider-connection-ipc.js'));
});
