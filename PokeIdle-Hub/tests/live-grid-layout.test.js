'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveGridLayout } = require('../renderer/live-grid-layout');

function setup({
  state = { showChat: true, columns: 0, hideVideos: false },
  accounts = [{ id: 'main' }],
  tiles = new Map(),
  columnWidths = { main: 1000 },
  gridWidth = 1000,
  gridHeight = 800,
} = {}) {
  const classes = new Map();
  const grid = {
    clientWidth: gridWidth,
    clientHeight: gridHeight,
    classList: { toggle: (name, enabled) => classes.set(name, enabled) },
  };
  const empty = { hidden: false };
  const columns = new Map(accounts.map(account => [account.id, {
    col: { style: { display: 'none' } },
    body: { clientWidth: columnWidths[account.id] || 0, style: {} },
  }]));
  const layout = createLiveGridLayout({
    state,
    getGrid: () => grid,
    getEmpty: () => empty,
    getAccounts: () => accounts,
    getTiles: () => tiles,
    getAccountColumns: () => columns,
    isAccountFavorite: () => false,
  });
  return { layout, classes, columns, empty, grid };
}

test('empty grid hides account columns and keeps the empty-state surface visible', () => {
  const context = setup({ state: { showChat: false, columns: 0, hideVideos: false } });

  context.layout.layout();

  assert.equal(context.classes.get('nochat'), true);
  assert.equal(context.empty.hidden, false);
  assert.equal(context.columns.get('main').col.style.display, 'none');
});

test('single account grid sizes video tiles to the existing column and chat rules', () => {
  const tiles = new Map([
    ['main:one', { acc: { id: 'main' }, item: { channel: 'one' }, root: { style: {} } }],
    ['main:two', { acc: { id: 'main' }, item: { channel: 'two' }, root: { style: {} } }],
    ['main:three', { acc: { id: 'main' }, item: { channel: 'three' }, root: { style: {} } }],
  ]);
  const context = setup({ tiles });

  context.layout.layout();

  assert.equal(context.empty.hidden, true);
  assert.equal(context.columns.get('main').col.style.display, 'flex');
  assert.equal(context.columns.get('main').body.style.gridTemplateColumns, 'repeat(2, minmax(0, 1fr))');
  for (const tile of tiles.values()) {
    assert.equal(tile.root.style.height, '343px');
    assert.deepEqual(tile.rect, { w: 488, h: 343 });
  }
});

test('hidden videos use compact tiles across account columns while retaining minimum width', () => {
  const accounts = [{ id: 'main' }, { id: 'alt' }];
  const tiles = new Map([
    ['main:one', { acc: { id: 'main' }, item: { channel: 'one' }, root: { style: {} } }],
  ]);
  const context = setup({
    state: { showChat: false, columns: 0, hideVideos: true },
    accounts,
    tiles,
    columnWidths: { main: 200, alt: 500 },
  });

  context.layout.layout();

  assert.equal(context.empty.hidden, true);
  assert.equal(context.classes.get('nochat'), true);
  assert.equal(context.columns.get('main').body.style.gridTemplateColumns, 'repeat(1, minmax(0, 1fr))');
  assert.equal(tiles.get('main:one').root.style.height, '36px');
  assert.deepEqual(tiles.get('main:one').rect, { w: 260, h: 36 });
});

test('promotes favorites only for the matching account and provider', () => {
  const tiles = new Map([
    ['main:twitch', { acc: { id: 'main' }, p: 'twitch', item: { channel: 'same' }, root: { style: {} } }],
    ['main:kick', { acc: { id: 'main' }, p: 'kick', item: { channel: 'same' }, root: { style: {} } }],
    ['alt:kick', { acc: { id: 'alt' }, p: 'kick', item: { channel: 'same' }, root: { style: {} } }],
  ]);
  const context = setup({
    accounts: [{ id: 'main' }, { id: 'alt' }],
    tiles,
    columnWidths: { main: 500, alt: 500 },
  });
  const favoriteCalls = [];
  const favoriteKey = (channel, accountId, provider) => {
    favoriteCalls.push([channel, accountId, provider]);
    return accountId === 'main' && provider === 'kick' && channel === 'same';
  };
  const layout = createLiveGridLayout({
    state: { showChat: true, columns: 0, hideVideos: false },
    getGrid: () => context.grid,
    getEmpty: () => context.empty,
    getAccounts: () => [{ id: 'main' }, { id: 'alt' }],
    getTiles: () => tiles,
    getAccountColumns: () => context.columns,
    isAccountFavorite: favoriteKey,
  });

  layout.layout();

  assert.ok(favoriteCalls.some(([, accountId, provider]) => accountId === 'main' && provider === 'kick'));
  assert.ok(favoriteCalls.some(([, accountId, provider]) => accountId === 'main' && provider === 'twitch'));
});
