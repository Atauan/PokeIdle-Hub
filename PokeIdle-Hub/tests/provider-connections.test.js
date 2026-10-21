'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProviderConnections, getProviderState } = require('../provider-connections');

function createRegistry(overrides = {}) {
  const checks = [];
  const registry = createProviderConnections({
    partitionForAccount: account => account.main ? 'persist:pokeidlehub' : `persist:pokeidlehub-acc-${account.id}`,
    checkConnections: async partition => {
      checks.push(partition);
      return { twitch: true, kick: false };
    },
    accountExists: () => true,
    ...overrides,
  });
  return { registry, checks };
}

test('provider connection reads use the account partition and cache the observed status', async () => {
  const { registry, checks } = createRegistry();
  const account = { id: 'alpha', main: false };

  assert.deepEqual(await registry.read(account), { twitch: true, kick: false, unavailableProviders: [] });
  assert.deepEqual(await registry.read(account), { twitch: true, kick: false, unavailableProviders: [] });
  assert.deepEqual(checks, ['persist:pokeidlehub-acc-alpha']);
  assert.deepEqual(registry.getCached('alpha'), { twitch: true, kick: false, unavailableProviders: [] });
});

test('concurrent refreshes share one pending request and invalidation is account scoped', async () => {
  const resolvers = new Map();
  const { registry, checks } = createRegistry({
    checkConnections: partition => {
      checks.push(partition);
      return new Promise(resolve => { resolvers.set(partition, resolve); });
    },
  });
  const alpha = { id: 'alpha', main: false };
  const first = registry.read(alpha, { refresh: true });
  const second = registry.read(alpha, { refresh: true });
  await Promise.resolve();
  assert.deepEqual(checks, ['persist:pokeidlehub-acc-alpha']);

  registry.invalidate('alpha');
  const beta = registry.read({ id: 'beta', main: false }, { refresh: true });
  await Promise.resolve();
  resolvers.get('persist:pokeidlehub-acc-alpha')({ twitch: true, kick: true });
  resolvers.get('persist:pokeidlehub-acc-beta')({ twitch: true, kick: true });
  assert.deepEqual(await Promise.all([first, second]), [
    { twitch: true, kick: true, unavailableProviders: [] },
    { twitch: true, kick: true, unavailableProviders: [] },
  ]);
  assert.equal(registry.getCached('alpha'), undefined);
  assert.deepEqual(await beta, { twitch: true, kick: true, unavailableProviders: [] });
  assert.deepEqual(checks, ['persist:pokeidlehub-acc-alpha', 'persist:pokeidlehub-acc-beta']);
});

test('eligibility includes only accounts with explicit true provider status', async () => {
  const { registry } = createRegistry({
    checkConnections: async partition => partition.endsWith('alpha')
      ? { twitch: true, kick: true }
      : { twitch: false, kick: true },
  });
  const accounts = [
    { id: 'alpha', main: false },
    { id: 'beta', main: false },
    { id: 'removed', main: false },
  ];
  const presentIds = new Set(['alpha', 'beta']);

  const isolated = createRegistry({
    accountExists: accountId => presentIds.has(accountId),
    checkConnections: async partition => partition.endsWith('alpha')
      ? { twitch: true, kick: true }
      : { twitch: false, kick: true },
  }).registry;
  await isolated.refresh(accounts);

  assert.deepEqual(isolated.eligibleAccountIds(accounts), { twitch: ['alpha'], kick: ['alpha', 'beta'] });
  assert.deepEqual(registry.eligibleAccountIds(accounts), { twitch: [], kick: [] });
});

test('failed connection reads preserve an explicit unavailable state', async () => {
  const { registry } = createRegistry({ checkConnections: async () => { throw new Error('unavailable'); } });

  assert.deepEqual(await registry.read({ id: 'alpha', main: false }), {
    twitch: false,
    kick: false,
    unavailableProviders: ['twitch', 'kick'],
  });
});

test('provider connection state distinguishes connected, disconnected and unavailable', () => {
  const disconnected = { twitch: false, kick: false, unavailableProviders: [] };
  const unavailable = { twitch: false, kick: false, unavailableProviders: ['twitch'] };

  assert.equal(getProviderState({ twitch: true }, 'twitch'), 'connected');
  assert.equal(getProviderState(disconnected, 'twitch'), 'disconnected');
  assert.equal(getProviderState(unavailable, 'twitch'), 'unavailable');
  assert.equal(getProviderState(unavailable, 'kick'), 'disconnected');
  assert.equal(getProviderState(undefined, 'twitch'), 'unavailable');
});

test('an unavailable provider is never considered eligible even if a malformed response marks it true', async () => {
  const { registry } = createRegistry({
    checkConnections: async () => ({ twitch: true, kick: true, unavailableProviders: ['twitch'] }),
  });
  const accounts = [{ id: 'alpha', main: false }];

  await registry.refresh(accounts);

  assert.deepEqual(registry.eligibleAccountIds(accounts), { twitch: [], kick: ['alpha'] });
});

test('provider connection module exposes its API to classic renderer scripts', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '..', 'provider-connections.js'), 'utf8');
  const context = vm.createContext({});

  vm.runInContext(source, context, { filename: 'provider-connections.js' });
  assert.equal(typeof context.PokeIdleProviderConnections.createProviderConnections, 'function');
});
