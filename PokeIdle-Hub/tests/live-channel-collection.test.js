'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../live-channel-policy');
const { createLiveChannelCollection } = require('../renderer/live-channel-collection');

function setup({ autoLives = true, refreshing = false, manualPending = false } = {}) {
  const state = {
    kick: [],
    twitch: [],
    target: 'kick',
    autoLives,
    gameChannels: [],
    ignoredGameChannels: [],
  };
  const liveStates = new Map();
  const events = [];
  let addLiveHandler = null;
  const clearButtons = ['kick', 'twitch', 'all'].map(clear => {
    const listeners = new Map();
    return {
      dataset: { clear },
      addEventListener: (name, listener) => listeners.set(name, listener),
      dispatch: name => listeners.get(name)?.(),
    };
  });
  const collection = createLiveChannelCollection({
    state,
    policy,
    uid: (() => { let id = 0; return () => `id-${++id}`; })(),
    liveStates,
    nextLiveState: (...args) => ({ status: args[1], open: args[2] }),
    persist: () => events.push('persist'),
    syncTiles: () => events.push('syncTiles'),
    scheduleLiveChecks: () => events.push('scheduleLiveChecks'),
    isLiveRefreshing: () => refreshing,
    isManualDiscoveryPending: () => manualPending,
    checkLivesNow: () => events.push('checkLivesNow'),
    queryAll: selector => selector === '[data-clear]' ? clearButtons : [],
    onAddLive: callback => { addLiveHandler = callback; },
    toast: message => events.push(['toast', message]),
  });
  return { collection, state, liveStates, events, clearButtons, dispatchAddLive: link => addLiveHandler?.(link) };
}

test('import reconciles game channels while respecting ignored and already-added channels', () => {
  const { collection, state, events } = setup();
  state.ignoredGameChannels = ['kick:skipme'];
  state.kick.push({ id: 'existing', channel: 'already', muted: false });
  state.gameChannels = [
    { platform: 'kick', channel: 'skipme' },
    { platform: 'kick', channel: 'already' },
    { platform: 'twitch', channel: 'newchannel' },
  ];

  collection.importGameChannels();

  assert.deepEqual(state.twitch, [{ id: 'id-1', channel: 'newchannel', muted: true }]);
  assert.deepEqual(state.kick, [{ id: 'existing', channel: 'already', muted: false }]);
  assert.deepEqual(events, ['syncTiles', 'scheduleLiveChecks']);
});

test('lists channels in the established Kick-then-Twitch order from collection state', () => {
  const { collection, state } = setup();
  const kick = { id: 'kick-1', channel: 'kicker' };
  const twitch = { id: 'twitch-1', channel: 'streamer' };
  state.kick.push(kick);
  state.twitch.push(twitch);

  assert.deepEqual(collection.listAll(), [{ p: 'kick', i: kick }, { p: 'twitch', i: twitch }]);
});

test('finds an item by ID from the collection and preserves first-match ordering', () => {
  const { collection, state } = setup();
  const kick = { id: 'shared-id', channel: 'kick-channel' };
  const twitch = { id: 'shared-id', channel: 'twitch-channel' };
  state.kick.push(kick);
  state.twitch.push(twitch);

  assert.deepEqual(collection.findChannelById('shared-id'), { p: 'kick', i: kick });
  assert.equal(collection.findChannelById('missing'), undefined);
});

test('import always synchronizes but schedules only for new auto-live channels outside refresh', () => {
  const refreshing = setup({ refreshing: true });
  refreshing.collection.importGameChannels();
  assert.deepEqual(refreshing.events, ['syncTiles']);

  const noAdd = setup();
  noAdd.state.autoLives = false;
  noAdd.collection.importGameChannels();
  assert.deepEqual(noAdd.events, ['syncTiles']);
});

test('receiving game channels merges normalized rows and starts a pending manual discovery once channels exist', () => {
  const { collection, state, events } = setup({ manualPending: true });
  state.gameChannels = [{ platform: 'kick', channel: 'oldchannel' }];

  collection.receiveGameChannels([
    { platform: 'twitch', channel: ' NewChannel ' },
    { platform: 'youtube', channel: 'ignored' },
  ]);

  assert.deepEqual(state.gameChannels, [
    { platform: 'kick', channel: 'oldchannel' },
    { platform: 'twitch', channel: 'newchannel' },
  ]);
  assert.deepEqual(state.kick, [{ id: 'id-1', channel: 'oldchannel', muted: true }]);
  assert.deepEqual(state.twitch, [{ id: 'id-2', channel: 'newchannel', muted: true }]);
  assert.deepEqual(events, ['syncTiles', 'scheduleLiveChecks', 'checkLivesNow']);
});

test('manual channel entry infers platform, removes ignored keys and opens unknown entries when auto lives are disabled', () => {
  const { collection, state, liveStates, events } = setup({ autoLives: false });
  state.ignoredGameChannels = ['twitch:alpha'];

  collection.addChannels('https://www.twitch.tv/Alpha, https://kick.com/Beta');

  assert.deepEqual(state.twitch, [{ id: 'id-1', channel: 'alpha', muted: true }]);
  assert.deepEqual(state.kick, [{ id: 'id-2', channel: 'beta', muted: true }]);
  assert.deepEqual(state.ignoredGameChannels, []);
  assert.deepEqual([...liveStates], [
    ['id-1', { status: 'unknown', open: true }],
    ['id-2', { status: 'unknown', open: true }],
  ]);
  assert.deepEqual(events, ['persist', 'syncTiles', 'scheduleLiveChecks']);
});

test('manual entry remains idempotent for channels already in the selected platform list', () => {
  const { collection, state, liveStates } = setup({ autoLives: false });
  state.kick.push({ id: 'existing', channel: 'alpha', muted: false });

  collection.addChannels('alpha');

  assert.deepEqual(state.kick, [{ id: 'existing', channel: 'alpha', muted: false }]);
  assert.deepEqual([...liveStates], [['existing', { status: 'unknown', open: true }]]);
});

test('clears channels for one platform and remembers them as ignored without touching the other platform', () => {
  const { collection, state, events } = setup();
  state.kick = [{ id: 'k1', channel: 'alpha' }, { id: 'k2', channel: 'beta' }];
  state.twitch = [{ id: 't1', channel: 'gamma' }];
  state.ignoredGameChannels = ['kick:alpha'];

  collection.clearChannels('kick');

  assert.deepEqual(state.kick, []);
  assert.deepEqual(state.twitch, [{ id: 't1', channel: 'gamma' }]);
  assert.deepEqual(state.ignoredGameChannels, ['kick:alpha', 'kick:beta']);
  assert.deepEqual(events, ['syncTiles']);
});

test('clears all platforms and deduplicates ignored channel keys', () => {
  const { collection, state, events } = setup();
  state.kick = [{ id: 'k1', channel: 'alpha' }];
  state.twitch = [{ id: 't1', channel: 'alpha' }];
  state.ignoredGameChannels = ['kick:alpha'];

  collection.clearChannels('all');

  assert.deepEqual(state.kick, []);
  assert.deepEqual(state.twitch, []);
  assert.deepEqual(state.ignoredGameChannels, ['kick:alpha', 'twitch:alpha']);
  assert.deepEqual(events, ['syncTiles']);
});

test('binds clear buttons to the matching channel collection action', () => {
  const { collection, state, clearButtons, events } = setup();
  state.kick = [{ id: 'k1', channel: 'alpha' }];
  state.twitch = [{ id: 't1', channel: 'beta' }];
  collection.bind();

  clearButtons[0].dispatch('click');

  assert.deepEqual(state.kick, []);
  assert.deepEqual(state.twitch, [{ id: 't1', channel: 'beta' }]);
  assert.deepEqual(state.ignoredGameChannels, ['kick:alpha']);
  assert.deepEqual(events, ['syncTiles']);
});

test('binds game live links to collection and preserves add/already-added feedback', () => {
  const { collection, state, events, dispatchAddLive } = setup();
  collection.bind();

  dispatchAddLive('https://www.twitch.tv/NewChannel');
  assert.deepEqual(state.twitch, [{ id: 'id-1', channel: 'newchannel', muted: true }]);
  assert.deepEqual(events, [
    'persist', 'syncTiles', 'scheduleLiveChecks',
    ['toast', '✓ NewChannel (Twitch) adicionado às Lives'],
  ]);

  events.length = 0;
  dispatchAddLive('https://www.twitch.tv/NewChannel');
  assert.deepEqual(state.twitch, [{ id: 'id-1', channel: 'newchannel', muted: true }]);
  assert.deepEqual(events, [
    'persist', 'syncTiles', 'scheduleLiveChecks',
    ['toast', 'NewChannel já está nas Lives'],
  ]);
});

test('removes one channel from its platform, ignores it, persists, and reconciles tiles', () => {
  const { collection, state, events } = setup();
  state.kick = [{ id: 'k1', channel: 'alpha' }, { id: 'k2', channel: 'beta' }];
  state.twitch = [{ id: 't1', channel: 'alpha' }];

  collection.removeChannel('k1');

  assert.deepEqual(state.kick, [{ id: 'k2', channel: 'beta' }]);
  assert.deepEqual(state.twitch, [{ id: 't1', channel: 'alpha' }]);
  assert.deepEqual(state.ignoredGameChannels, ['kick:alpha']);
  assert.deepEqual(events, ['persist', 'syncTiles']);
});

test('removing an unknown channel keeps the existing persist and sync behavior', () => {
  const { collection, state, events } = setup();
  collection.removeChannel('missing');
  assert.deepEqual(state.ignoredGameChannels, []);
  assert.deepEqual(events, ['persist', 'syncTiles']);
});

test('active renderer composes and packages the live channel collection module', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const moduleSource = fs.readFileSync(path.join(root, 'renderer', 'live-channel-collection.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(html, /<script src="live-channel-collection\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/);
  assert.match(app, /window\.PokeIdleLiveChannelCollection\.createLiveChannelCollection\(/);
  assert.match(app, /addChannels, importGameChannels, receiveGameChannels/);
  assert.match(app, /removeChannel\(id\)/);
  assert.match(moduleSource, /queryAll\('\[data-clear\]'\)/);
  assert.doesNotMatch(app, /clearChannels\(button\.dataset\.clear\)/);
  assert.match(app, /onAddLive:\s*callback\s*=>\s*window\.pf\.onAddLive\(callback\)/);
  assert.match(app, /liveChannelCollection\.bind\(\)/);
  assert.doesNotMatch(app, /window\.pf\.onAddLive\(addFromGame\)/);
  assert.match(app, /liveChannelCollection\.bind\(\)/);
  assert.doesNotMatch(app, /\$\$\('\[data-clear\]'\)/);
  assert.doesNotMatch(app, /function (?:receiveGameChannels|importGameChannels|addChannels)\(/);
  assert.doesNotMatch(app, /ignoredGameChannels = \[\.\.\.new Set\(\[\.\.\.S\.ignoredGameChannels, \.\.\.removed\]\)\]/);
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
