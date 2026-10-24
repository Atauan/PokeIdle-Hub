'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const preferences = require('../live-account-preferences');
const {
  createAppState,
  persistAppState,
  normalizeAccountOrder,
  moveAccountInOrder,
  promoteDefaultAccount,
  resolveDefaultAccountId,
} = require('../renderer/app-state');

function setup(values = {}) {
  const reads = [];
  const load = (key, fallback) => {
    reads.push([key, fallback]);
    return Object.hasOwn(values, key) ? values[key] : fallback;
  };
  const state = createAppState({
    load,
    normalizeGameChannels: channels => Array.isArray(channels) ? channels.map(channel => ({ ...channel, normalized: true })) : [],
    normalizeAccountFavorites: preferences.normalizeAccountFavorites,
    normalizeAccountIgnoredGameChannels: preferences.normalizeAccountIgnoredGameChannels,
  });
  return { state, reads };
}

test('creates state with existing defaults, coercions, account fallback, and normalized game channels', () => {
  const { state, reads } = setup({
    'pf.accounts': [],
    'pf.autoLives': 1,
    'pf.twitchEconomy': true,
    'pf.livePoll': 45,
    'pf.gameChannels': [{ channel: 'Alpha' }],
    'pf.accountLimits': null,
    'pf.universalLimits': ['legacy'],
  });

  assert.deepEqual(state, {
    kick: [], twitch: [], columns: 0, showChat: true, quality: 160,
    autoLives: false, twitchEconomy: true, kickEconomy: false,
    gameChannels: [{ channel: 'Alpha', normalized: true }], ignoredGameChannels: [],
    livePoll: 60, tab: 'lives',
    accounts: [{ id: 'main', name: 'Conta 1', main: true }],
    gameAccount: 'main', defaultGameAccountId: 'main', accountOrder: ['main'],
    gameMosaic: false, frames: {}, target: 'kick', hideVideos: false,
    accountFavorites: {}, accountIgnoredGameChannels: {}, fpsForeground: 0, fpsBackground: 15, suspendBgVideos: true,
    accountLimits: {}, universalLimits: ['legacy'], gameActionsVisible: true,
    liveActionsVisible: true, accountZoom: {},
  });
  assert.equal(reads.some(([key]) => key === 'pf.accounts'), true);
  assert.equal(reads.filter(([key]) => key === 'pf.accounts').length, 1);
  assert.deepEqual(reads.map(([key]) => key), [
    'pf.accounts', 'pf.gameAccount', 'pf.accountOrder', 'pf.defaultGameAccount',
    'pf.kick', 'pf.twitch', 'pf.columns', 'pf.showChat', 'pf.quality', 'pf.autoLives',
    'pf.twitchEconomy', 'pf.kickEconomy', 'pf.gameChannels', 'pf.ignoredGameChannels',
    'pf.livePoll', 'pf.tab', 'pf.gameMosaic', 'pf.frames',
    'pf.hideVideos', 'pf.accountFavorites', 'pf.accountIgnoredGameChannels', 'pf.fpsForeground', 'pf.fpsBackground',
    'pf.suspendBgVideos', 'pf.accountLimits', 'pf.universalLimits', 'pf.gameActionsVisible',
    'pf.liveActionsVisible', 'pf.accountZoom',
  ]);
});

test('preserves repeated localStorage read for supported polling intervals', () => {
  const { state, reads } = setup({ 'pf.livePoll': 300 });
  assert.equal(state.livePoll, 300);
  assert.equal(reads.filter(([key]) => key === 'pf.livePoll').length, 2);
});

test('persists the same application keys in the established order and excludes transient target', () => {
  const { state } = setup();
  const writes = [];
  persistAppState(state, (key, value) => writes.push([key, value]));

  assert.deepEqual(writes.map(([key]) => key), [
    'pf.kick', 'pf.twitch', 'pf.columns', 'pf.showChat', 'pf.quality', 'pf.tab', 'pf.frames',
    'pf.accounts', 'pf.gameAccount', 'pf.accountOrder', 'pf.defaultGameAccount', 'pf.gameMosaic',
    'pf.gameActionsVisible', 'pf.liveActionsVisible',
    'pf.accountZoom', 'pf.autoLives', 'pf.livePoll', 'pf.twitchEconomy', 'pf.kickEconomy',
    'pf.gameChannels', 'pf.ignoredGameChannels', 'pf.hideVideos', 'pf.accountFavorites', 'pf.accountIgnoredGameChannels',
    'pf.fpsForeground', 'pf.fpsBackground', 'pf.suspendBgVideos', 'pf.accountLimits', 'pf.universalLimits',
  ]);
  assert.equal(writes.some(([key]) => key === 'pf.target'), false);
  assert.equal(writes[0][1], state.kick);
  assert.equal(writes.at(-1)[1], state.universalLimits);
});

test('migrates legacy favorites and loads account exclusions without touching provider session keys', () => {
  const { state, reads } = setup({
    'pf.accountFavorites': { main: ['Alpha'] },
    'pf.accountIgnoredGameChannels': { main: { kick: ['Beta'] } },
    'pf.accounts': [{ id: 'main', name: 'Conta' }],
    'pf.kick': [{ id: 'kick:alpha', channel: 'alpha' }],
    'pf.twitch': [{ id: 'twitch:alpha', channel: 'alpha' }],
  });

  assert.deepEqual(state.accountFavorites, {
    main: { kick: ['alpha'], twitch: ['alpha'] },
  });
  assert.deepEqual(state.accountIgnoredGameChannels, { main: { kick: ['beta'] } });
  assert.ok(reads.some(([key]) => key === 'pf.kick'));
  assert.ok(reads.some(([key]) => key === 'pf.twitch'));
});

test('normalizes saved display order by retaining valid unique IDs and appending new accounts', () => {
  const accounts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(normalizeAccountOrder(accounts, ['c', 'missing', 'c', 'a']), ['c', 'a', 'b']);
  assert.deepEqual(normalizeAccountOrder(accounts, null), ['a', 'b', 'c']);
});

test('moves only non-default visible accounts without mutating the stored order', () => {
  const order = ['main', 'a', 'b'];
  assert.deepEqual(moveAccountInOrder(order, 'b', 'up', 'main'), ['main', 'b', 'a']);
  assert.deepEqual(moveAccountInOrder(order, 'a', 'up', 'main'), order);
  assert.deepEqual(moveAccountInOrder(order, 'main', 'down', 'main'), order);
  assert.deepEqual(order, ['main', 'a', 'b']);
});

test('promotes a valid default account to the first display position', () => {
  assert.deepEqual(promoteDefaultAccount(['main', 'a', 'b'], 'b'), {
    accountOrder: ['b', 'main', 'a'],
    defaultGameAccountId: 'b',
  });
});

test('resolves stale default IDs to the first visible existing account', () => {
  const accounts = [{ id: 'a' }, { id: 'b' }];
  assert.equal(resolveDefaultAccountId(accounts, 'b', ['a', 'b']), 'b');
  assert.equal(resolveDefaultAccountId(accounts, 'removed', ['b', 'a']), 'b');
  assert.equal(resolveDefaultAccountId([], 'removed', []), null);
});

test('restores account default and visual order independently without changing stored account order', () => {
  const accounts = [
    { id: 'main', name: 'Conta de lives', main: true },
    { id: 'alt', name: 'Alternativa' },
  ];
  const { state } = setup({
    'pf.accounts': accounts,
    'pf.gameAccount': 'main',
    'pf.accountOrder': ['alt', 'main'],
    'pf.defaultGameAccount': 'alt',
  });
  assert.equal(state.defaultGameAccountId, 'alt');
  assert.equal(state.gameAccount, 'alt');
  assert.deepEqual(state.accountOrder, ['alt', 'main']);
  assert.deepEqual(state.accounts, accounts);
});

test('uses the previously selected game account when no default preference exists', () => {
  const { state } = setup({
    'pf.accounts': [{ id: 'main', main: true }, { id: 'alt' }],
    'pf.gameAccount': 'alt',
  });
  assert.equal(state.defaultGameAccountId, 'alt');
  assert.deepEqual(state.accountOrder, ['alt', 'main']);
});
