'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLiveDiscoveryController } = require('../renderer/live-discovery-controller');

function setup({
  autoLives = true,
  items = [{ p: 'twitch', i: { id: 'live-1', channel: 'alpha' } }],
  discoverLives,
} = {}) {
  const events = [];
  const timeouts = new Map();
  const liveStates = new Map();
  let nextTimerId = 0;
  let currentItems = items;
  let gameChannels = [];
  let runDiscovery = discoverLives || (async args => {
    events.push(['discoverLives', args]);
    return { statusesByProvider: { kick: {}, twitch: { alpha: 'online', beta: 'offline' } } };
  });
  const state = { autoLives, livePoll: 60, accounts: [{ id: 'main' }], ignoredGameChannels: ['kick:ignored'], gameChannels: [] };
  const controller = createLiveDiscoveryController({
    state,
    persist: () => events.push('persist'),
    getItems: () => currentItems,
    getItemById: id => currentItems.find(({ i }) => i.id === id),
    readGameChannels: async () => gameChannels,
    mergeGameChannels: rows => events.push(['mergeGameChannels', rows]),
    clearIgnoredGameChannels: () => { state.ignoredGameChannels = []; events.push('clearIgnoredGameChannels'); },
    importGameChannels: () => events.push('importGameChannels'),
    getAccounts: () => state.accounts,
    liveStates,
    nextLiveState: (previous, status, open) => ({ status, open }),
    discoverLives: args => runDiscovery(args),
    checkConnections: account => ({ accountId: account.id }),
    liveStatus: async () => ({}),
    syncTiles: () => events.push('syncTiles'),
    renderControls: () => events.push('renderControls'),
    setTimeoutFn: (callback, delay) => { const id = ++nextTimerId; timeouts.set(id, { callback, delay }); return id; },
    clearTimeoutFn: id => timeouts.delete(id),
  });
  return {
    controller,
    events,
    liveStates,
    state,
    timeouts,
    setItems: value => { currentItems = value; },
    setGameChannels: value => { gameChannels = value; },
  };
}

test('schedule coalesces timers and does not poll with auto-lives off or no channels', () => {
  const { controller, timeouts } = setup();

  controller.schedule();
  controller.schedule();
  assert.equal(timeouts.size, 1);
  assert.equal([...timeouts.values()][0].delay, 0);

  const disabled = setup({ autoLives: false });
  disabled.controller.schedule();
  assert.equal(disabled.timeouts.size, 0);

  const empty = setup({ items: [] });
  empty.controller.schedule();
  assert.equal(empty.timeouts.size, 0);
});

test('check applies statuses only to items that still exist and schedules the configured next cycle', async () => {
  const { controller, events, liveStates, timeouts, setItems } = setup({ items: [
    { p: 'twitch', i: { id: 'live-1', channel: 'alpha' } },
    { p: 'twitch', i: { id: 'live-2', channel: 'beta' } },
  ] });
  const checking = controller.check();
  setItems([{ p: 'twitch', i: { id: 'live-2', channel: 'beta' } }]);
  await checking;

  assert.deepEqual([...liveStates.keys()], ['live-2']);
  assert.equal(events.filter(event => event === 'syncTiles').length, 1);
  assert.equal([...timeouts.values()][0].delay, 60_000);
  assert.equal(controller.isChecking(), false);
});

test('a new generation discards an in-flight result and immediately schedules a fresh cycle', async () => {
  let resolveDiscovery;
  const { controller, liveStates, timeouts } = setup({
    discoverLives: () => new Promise(resolve => { resolveDiscovery = resolve; }),
  });

  const checking = controller.check();
  controller.schedule();
  resolveDiscovery({ statusesByProvider: { kick: {}, twitch: { alpha: 'offline' } } });
  await checking;

  assert.equal(liveStates.size, 0);
  assert.equal([...timeouts.values()][0].delay, 0);
});

test('manual refresh imports game channels, clears ignored entries and checks even when auto-lives is disabled', async () => {
  const { controller, events, state, setGameChannels } = setup({ autoLives: false });
  const channels = [{ platform: 'kick', channel: 'beta' }];
  setGameChannels(channels);

  await controller.refreshNow();

  assert.deepEqual(state.ignoredGameChannels, []);
  assert.deepEqual(events.slice(0, 4), [
    'renderControls', ['mergeGameChannels', channels], 'clearIgnoredGameChannels', 'importGameChannels',
  ]);
  const discoveryCall = events.find(event => Array.isArray(event) && event[0] === 'discoverLives');
  assert.deepEqual(discoveryCall[1].channels, [{ provider: 'twitch', name: 'alpha' }]);
  assert.equal(discoveryCall[1].shouldContinue(), true);
  assert.equal(controller.isRefreshing(), false);
  assert.equal(controller.isManualDiscoveryPending(), false);
});

test('manual refresh with no channels leaves a pending prompt and renders the empty state', async () => {
  const { controller, events } = setup({ items: [] });

  await controller.refreshNow();

  assert.equal(controller.isManualDiscoveryPending(), true);
  assert.equal(events.includes('importGameChannels'), true);
  assert.equal(events.filter(event => event === 'renderControls').length, 2);
  assert.equal(events.some(event => Array.isArray(event) && event[0] === 'discoverLives'), false);
});

test('enabling automatic lives resets status while preserving open tiles and keeps effect order', () => {
  const { controller, events, liveStates, state } = setup({ autoLives: false });
  liveStates.set('open', { status: 'offline', open: true });
  liveStates.set('closed', { status: 'offline', open: false });

  controller.setAutoLives(true);

  assert.equal(state.autoLives, true);
  assert.deepEqual(liveStates.get('open'), { status: 'unknown', open: true });
  assert.deepEqual(liveStates.get('closed'), { status: 'unknown', open: false });
  assert.deepEqual(events, ['persist', 'syncTiles']);
});

test('disabling automatic lives preserves statuses and polling interval falls back to 60 seconds', () => {
  const { controller, events, liveStates, state } = setup({ autoLives: true });
  liveStates.set('open', { status: 'online', open: true });

  controller.setAutoLives(false);
  controller.setPollingInterval('invalid');

  assert.equal(state.autoLives, false);
  assert.deepEqual(liveStates.get('open'), { status: 'online', open: true });
  assert.equal(state.livePoll, 60);
  assert.deepEqual(events, ['persist', 'syncTiles', 'persist']);

  controller.setPollingInterval('5');
  assert.equal(state.livePoll, 5);
  assert.deepEqual(events.slice(-1), ['persist']);
});

test('active renderer composes and loads the discovery controller before app.js', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');

  assert.match(html, /<script src="live-discovery-controller\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/);
  assert.match(app, /window\.PokeIdleLiveDiscoveryController\.createLiveDiscoveryController\(/);
  assert.match(app, /onAutoLivesChanged:\s*enabled\s*=>\s*liveDiscoveryController\.setAutoLives\(enabled\)/);
  assert.match(app, /onPollingIntervalChanged:\s*value\s*=>\s*liveDiscoveryController\.setPollingInterval\(value\)/);
  assert.doesNotMatch(app, /\$\('#auto-lives'\)\.addEventListener/);
  assert.doesNotMatch(app, /\$\('#live-poll'\)\.addEventListener/);
  assert.doesNotMatch(app, /S\.autoLives = e\.target\.checked/);
  assert.doesNotMatch(app, /async function checkLives\(|async function checkLivesNow\(/);
});
