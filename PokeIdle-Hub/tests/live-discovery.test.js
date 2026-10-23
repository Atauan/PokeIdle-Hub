'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { discoverLives } = require('../live-discovery');

const accounts = [{ id: 'main' }, { id: 'secondary' }];
const channels = [
  { provider: 'twitch', name: 'axtlol' },
  { provider: 'twitch', name: 'rodil' },
  { provider: 'kick', name: 'axt' },
];

test('does not query any provider when no account is connected', async () => {
  const queries = [];
  const result = await discoverLives({
    accounts,
    channels,
    checkConnections: async account => ({ twitch: false, kick: false, accountId: account.id }),
    liveStatus: async (...args) => queries.push(args),
  });

  assert.deepEqual(queries, []);
  assert.deepEqual(result.plan.eligibleAccountIdsByProvider, { kick: [], twitch: [] });
  assert.deepEqual(result.diagnostics, {
    disconnectedProviders: ['kick', 'twitch'],
    unavailableProviders: [],
    failedProviders: [],
    failureReasons: {},
  });
});

test('reports providers whose connection check or status lookup failed', async () => {
  const result = await discoverLives({
    accounts: [accounts[0]],
    channels: [channels[0]],
    checkConnections: async () => ({ twitch: true, kick: false }),
    liveStatus: async () => ({ $error: 'HTTP_403' }),
  });

  assert.deepEqual(result.diagnostics, {
    disconnectedProviders: [],
    unavailableProviders: [],
    failedProviders: ['twitch'],
    failureReasons: { twitch: 'HTTP_403' },
  });

  const unavailable = await discoverLives({
    accounts: [accounts[0]],
    channels: [channels[0]],
    checkConnections: async () => ({ twitch: false, kick: false, unavailableProviders: ['twitch'] }),
    liveStatus: async () => ({}),
  });
  assert.deepEqual(unavailable.diagnostics, {
    disconnectedProviders: [],
    unavailableProviders: ['twitch'],
    failedProviders: [],
    failureReasons: {},
  });
});

test('deduplicates discovery once per connected provider and returns per-provider statuses', async () => {
  const queries = [];
  const result = await discoverLives({
    accounts,
    channels: [...channels, { provider: 'twitch', name: 'AXTLOL' }],
    checkConnections: async account => ({ twitch: account.id === 'main' || account.id === 'secondary', kick: false }),
    liveStatus: async (provider, names) => {
      queries.push({ provider, names });
      return Object.fromEntries(names.map(name => [name, 'online']));
    },
  });

  assert.deepEqual(queries, [{ provider: 'twitch', names: ['axtlol', 'rodil'] }]);
  assert.deepEqual(result.statusesByProvider, {
    kick: {},
    twitch: { axtlol: 'online', rodil: 'online' },
  });
  assert.deepEqual(result.plan.eligibleAccountIdsByProvider, { kick: [], twitch: ['main', 'secondary'] });
});

test('queries Twitch and Kick independently for accounts connected to different providers', async () => {
  const queries = [];
  await discoverLives({
    accounts,
    channels,
    checkConnections: async account => account.id === 'main'
      ? { twitch: true, kick: false }
      : { twitch: false, kick: true },
    liveStatus: async (provider, names) => {
      queries.push(provider);
      return Object.fromEntries(names.map(name => [name, 'offline']));
    },
  });

  assert.deepEqual(queries.sort(), ['kick', 'twitch']);
});

test('respects the service 200-channel limit while querying every eligible channel', async () => {
  const manyChannels = Array.from({ length: 205 }, (_, index) => ({
    provider: 'twitch',
    name: `channel_${String(index).padStart(3, '0')}`,
  }));
  const batches = [];
  await discoverLives({
    accounts: [accounts[0]],
    channels: manyChannels,
    checkConnections: async () => ({ twitch: true, kick: false }),
    liveStatus: async (_provider, names) => {
      batches.push(names);
      return {};
    },
  });

  assert.deepEqual(batches.map(batch => batch.length), [200, 5]);
  assert.equal(new Set(batches.flat()).size, 205);
});

test('treats connection and status lookup failures as unavailable without throwing', async () => {
  let queries = 0;
  const result = await discoverLives({
    accounts,
    channels,
    checkConnections: async () => { throw new Error('read failed'); },
    liveStatus: async () => { queries++; return {}; },
  });

  assert.equal(queries, 0);
  assert.deepEqual(result.statusesByProvider, { kick: {}, twitch: {} });
});

test('does not treat inherited connection flags or status keys as trusted data', async () => {
  let queries = 0;
  const result = await discoverLives({
    accounts: [{ id: '__proto__' }],
    channels: [{ provider: 'twitch', name: 'axtlol' }],
    checkConnections: async () => Object.create({ twitch: true }),
    liveStatus: async () => { queries++; return Object.create({ axtlol: 'online' }); },
  });

  assert.equal(queries, 0);
  assert.deepEqual(result.plan.eligibleAccountIdsByProvider, { kick: [], twitch: [] });
});

test('does not start status queries after the discovery cycle becomes stale', async () => {
  let current = true;
  let queries = 0;
  await discoverLives({
    accounts: [accounts[0]],
    channels: [{ provider: 'twitch', name: 'axtlol' }],
    checkConnections: async () => {
      current = false;
      return { twitch: true, kick: false };
    },
    liveStatus: async () => { queries++; return {}; },
    shouldContinue: () => current,
  });

  assert.equal(queries, 0);
});

test('exposes policy and discovery to the classic renderer scripts', async () => {
  const context = vm.createContext({});
  for (const filename of ['live-policy.js', 'live-discovery.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    vm.runInContext(source, context, { filename });
  }

  const result = await context.PokeIdleLiveDiscovery.discoverLives({
    accounts: [{ id: 'main' }],
    channels: [{ provider: 'twitch', name: 'axtlol' }],
    checkConnections: async () => ({ twitch: true, kick: false }),
    liveStatus: async () => ({ axtlol: 'online' }),
  });
  assert.equal(result.statusesByProvider.twitch.axtlol, 'online');
});
