'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveTileController } = require('../renderer/live-tile-controller');
const policy = require('../live-policy');
const runtime = require('../live-runtime');

function setup({ accounts, items, connections, limits, favorites = {}, economy = false, existingTiles } = {}) {
  const state = {
    accounts: accounts || [{ id: 'main', name: 'Principal' }],
    accountFavorites: favorites,
    twitchEconomy: economy,
    frames: { removed: { x: 1 } },
  };
  const liveStates = new Map((items || []).map(({ i }) => [i.id, { open: true }]));
  const tiles = existingTiles || new Map();
  const events = [];
  const columns = new Map();
  let currentConnections = connections || { kick: [], twitch: [] };
  const makeBody = id => ({ id, children: [], append(root) { root.parentElement = this; this.children.push(root); } });
  const grid = { id: 'grid', append(root) { root.parentElement = this; } };
  const controller = createLiveTileController({
    state,
    liveStates,
    tiles,
    getItems: () => items || [],
    getAccounts: () => state.accounts,
    getEligibleAccountIdsByProvider: () => currentConnections,
    getAccountLimits: accountId => limits?.[accountId] || limits || { kick: 0, twitch: 0 },
    getFavoriteChannelsByAccount: () => state.accountFavorites,
    isTwitchEconomyEnabled: () => state.twitchEconomy,
    policy,
    runtime,
    createTile: (provider, item, account) => {
      const tile = { key: `${account.id}:${item.id}`, provider, account, item, root: { style: {}, parentElement: null } };
      events.push(['create', provider, item.id, account.id]);
      return tile;
    },
    disposeTile: (tile, key) => events.push(['dispose', key]),
    getGrid: () => grid,
    getColumnBody: accountId => columns.get(accountId)?.body,
    syncColumns: (accounts, visible, counts) => {
      events.push(['columns', visible.map(channel => channel.item.id), [...counts.keys()]]);
      if (!visible.length) columns.clear();
      for (const account of accounts) {
        if (!columns.has(account.id)) columns.set(account.id, { body: makeBody(account.id) });
      }
    },
    syncEconomy: (channels, eligibleIds) => events.push(['economy', channels, eligibleIds]),
    persist: () => events.push(['persist']),
    layout: () => events.push(['layout']),
    renderControls: () => events.push(['controls']),
  });
  return {
    controller,
    state,
    liveStates,
    tiles,
    events,
    columns,
    grid,
    setConnections(value) { currentConnections = value; },
  };
}

test('does not create live tiles when no account is connected and disposes stale resources', () => {
  const stale = { root: { style: {}, parentElement: null } };
  const context = setup({
    items: [{ p: 'twitch', i: { id: 'live', channel: 'channel' } }],
    existingTiles: new Map([['main:old', stale]]),
  });

  context.controller.sync();

  assert.equal(context.tiles.size, 0);
  assert.equal(context.events.some(([type]) => type === 'create'), false);
  assert.ok(context.events.some(([type, key]) => type === 'dispose' && key === 'main:old'));
  assert.equal(context.liveStates.has('live'), true);
  assert.deepEqual(context.events.slice(-4).map(([type]) => type), ['economy', 'persist', 'layout', 'controls']);
});

test('applies account limits and economic mode before creating resources in connected partitions', () => {
  const items = [
    { p: 'twitch', i: { id: 'tw-favorite', channel: 'favorite' } },
    { p: 'twitch', i: { id: 'tw-other', channel: 'other' } },
    { p: 'kick', i: { id: 'kick-live', channel: 'kickchannel' } },
  ];
  const context = setup({
    accounts: [{ id: 'main' }, { id: 'alt' }, { id: 'offline' }],
    items,
    connections: { twitch: ['main'], kick: ['alt'] },
    limits: { main: { twitch: 2, kick: 2 }, alt: { twitch: 2, kick: 1 }, offline: { twitch: 2, kick: 2 } },
    favorites: { main: ['favorite'] },
    economy: true,
  });

  context.controller.sync();

  assert.deepEqual([...context.tiles.keys()], ['alt:kick-live']);
  assert.deepEqual(context.events.filter(([type]) => type === 'create'), [['create', 'kick', 'kick-live', 'alt']]);
  assert.deepEqual(context.events.find(([type]) => type === 'economy'), ['economy', ['favorite', 'other'], ['main']]);
  assert.equal(context.tiles.has('offline:tw-favorite'), false);
  assert.equal(context.tiles.has('main:tw-favorite'), false);
});

test('zero Kick video limit and Twitch economy keep videos hidden while syncing Twitch economy', () => {
  const items = [
    { p: 'twitch', i: { id: 'tw-live', channel: 'twitchchannel' } },
    { p: 'kick', i: { id: 'kick-live', channel: 'kickchannel' } },
  ];
  const context = setup({
    accounts: [{ id: 'main' }],
    items,
    connections: { twitch: ['main'], kick: ['main'] },
    limits: { main: { twitch: 99, kick: 0 } },
    economy: true,
  });

  context.controller.sync();

  assert.equal(context.tiles.size, 0);
  assert.equal(context.events.some(([type]) => type === 'create'), false);
  assert.deepEqual(context.events.find(([type]) => type === 'economy'), [
    'economy', ['twitchchannel'], ['main'],
  ]);
});

test('disconnecting one provider account disposes only its views and preserves other account resources', () => {
  const items = [
    { p: 'twitch', i: { id: 'tw-live', channel: 'twitchchannel' } },
    { p: 'kick', i: { id: 'kick-live', channel: 'kickchannel' } },
  ];
  const context = setup({
    accounts: [{ id: 'first' }, { id: 'second' }],
    items,
    connections: { twitch: ['first', 'second'], kick: ['first', 'second'] },
    limits: { first: { twitch: 1, kick: 1 }, second: { twitch: 1, kick: 1 } },
    economy: false,
  });

  context.controller.sync();
  const preservedKickTile = context.tiles.get('first:kick-live');
  const preservedSecondTwitchTile = context.tiles.get('second:tw-live');
  const disposedBeforeDisconnect = context.events.filter(([type]) => type === 'dispose').length;

  context.setConnections({ twitch: ['second'], kick: ['first', 'second'] });
  context.controller.sync();

  assert.deepEqual([...context.tiles.keys()].sort(), [
    'first:kick-live',
    'second:tw-live',
    'second:kick-live',
  ].sort());
  assert.equal(context.tiles.get('first:kick-live'), preservedKickTile);
  assert.equal(context.tiles.get('second:tw-live'), preservedSecondTwitchTile);
  assert.deepEqual(
    context.events.filter(([type]) => type === 'dispose').slice(disposedBeforeDisconnect),
    [['dispose', 'first:tw-live']],
  );
  assert.deepEqual(context.events.filter(([type]) => type === 'economy').at(-1), [
    'economy', ['twitchchannel'], ['second'],
  ]);
});

test('reuses existing tiles, positions allowed resources and cleans removed item state', () => {
  const oldTile = { root: { style: {}, parentElement: null } };
  const existing = new Map([['main:live', oldTile]]);
  const context = setup({
    items: [{ p: 'kick', i: { id: 'live', channel: 'channel' } }],
    connections: { kick: ['main'], twitch: [] },
    limits: { main: { kick: 1, twitch: 0 } },
    existingTiles: existing,
  });
  context.liveStates.set('deleted', { open: true });
  context.state.frames.deleted = { x: 10 };

  context.controller.sync();

  assert.equal(context.tiles.get('main:live'), oldTile);
  assert.equal(oldTile.root.style.order, '0');
  assert.equal(context.liveStates.has('deleted'), false);
  assert.equal(Object.hasOwn(context.state.frames, 'deleted'), false);
  assert.equal(context.events.some(([type]) => type === 'create'), false);
  assert.deepEqual(context.events.slice(-4).map(([type]) => type), ['economy', 'persist', 'layout', 'controls']);
});
