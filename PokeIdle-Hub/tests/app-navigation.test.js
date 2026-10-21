'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAppNavigation } = require('../renderer/app-navigation');

function makeNode(dataset = {}) {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  return {
    dataset,
    hidden: false,
    disabled: false,
    textContent: '',
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatch(name) { listeners.get(name)?.(); },
  };
}

function setup() {
  const accounts = [{ id: 'main' }, { id: 'alt' }];
  const state = {
    tab: 'lives', accounts, gameAccount: 'alt', gameMosaic: true,
    gameActionsVisible: false, liveActionsVisible: true,
  };
  const calls = [];
  let openTabHandler = null;
  const navItems = ['lives', 'game', 'alerts', 'afk', 'settings'].map(tab => makeNode({ tab }));
  const accountTabs = accounts.map(account => makeNode({ account: account.id }));
  const gamePanes = new Map(accounts.map(account => [account.id, { classList: makeNode().classList }]));
  const gameMap = new Map(accounts.map(account => [account.id, { pane: gamePanes.get(account.id) }]));
  const nodes = new Map([
    '#account-remove', '#btn-game-zoom-reset', '#panel-lives', '#panel-game', '#panel-alerts',
    '#panel-afk', '#panel-settings', '#bar-lives', '#bar-game', '#bar-alerts', '#bar-afk',
    '#bar-settings', '#game-actions-bar', '#lives-actions-bar',
  ].map(selector => [selector, makeNode()]));
  nodes.get('#btn-game-zoom-reset').textContent = 'old';
  const navigation = createAppNavigation({
    state,
    persist: () => calls.push('persist'),
    query: selector => nodes.get(selector) || null,
    queryAll: selector => selector.startsWith('.sidebar-nav') ? navItems : accountTabs,
    getCurrentAccount: () => accounts.find(account => account.id === state.gameAccount),
    getAccounts: () => state.accounts,
    games: gameMap,
    updateGameBarConnections: () => calls.push('gamebar'),
    applyGameMosaic: enabled => calls.push(['mosaic', enabled]),
    getAccountZoom: accountId => accountId === 'alt' ? 1.25 : 1,
    updateGameActionsToggleBtn: () => calls.push('game-actions-toggle'),
    updateLiveActionsToggleBtn: () => calls.push('live-actions-toggle'),
    renderMarketAlerts: () => calls.push('alerts'),
    initFarmAfk: () => calls.push('afk'),
    renderSettings: () => calls.push('settings'),
    layoutLives: () => calls.push('layout'),
    applyFpsLimits: () => calls.push('fps'),
    onOpenTab: callback => { openTabHandler = callback; },
  });
  return { accounts, accountTabs, calls, gamePanes, navItems, nodes, navigation, state, openTab: tab => openTabHandler?.(tab) };
}

test('selects the game tab, selected account pane, account controls, and action bars', () => {
  const context = setup();

  context.navigation.setTab('game');

  assert.equal(context.state.tab, 'game');
  assert.deepEqual(context.calls, ['persist', 'gamebar', ['mosaic', true], 'game-actions-toggle', 'live-actions-toggle', 'fps']);
  assert.equal(context.navItems.find(item => item.dataset.tab === 'game').classList.contains('on'), true);
  assert.equal(context.navItems.find(item => item.dataset.tab === 'lives').getAttribute('aria-selected'), 'false');
  assert.equal(context.accountTabs.find(item => item.dataset.account === 'alt').getAttribute('aria-selected'), 'true');
  assert.equal(context.gamePanes.get('alt').classList.contains('on'), true);
  assert.equal(context.gamePanes.get('main').classList.contains('on'), false);
  assert.equal(context.nodes.get('#account-remove').disabled, false);
  assert.equal(context.nodes.get('#btn-game-zoom-reset').textContent, '125%');
  assert.equal(context.nodes.get('#panel-game').classList.contains('active'), true);
  assert.equal(context.nodes.get('#bar-game').hidden, false);
  assert.equal(context.nodes.get('#game-actions-bar').hidden, true);
  assert.equal(context.nodes.get('#lives-actions-bar').hidden, true);
});

test('routes each non-game tab to its existing feature rendering and live layout effects', () => {
  const context = setup();

  context.navigation.setTab('alerts');
  context.navigation.setTab('afk');
  context.navigation.setTab('settings');
  context.navigation.setTab('lives');

  assert.equal(context.calls.filter(call => call === 'alerts').length, 1);
  assert.equal(context.calls.filter(call => call === 'afk').length, 1);
  assert.equal(context.calls.filter(call => call === 'settings').length, 1);
  assert.equal(context.calls.filter(call => call === 'layout').length, 1);
  assert.equal(context.calls.filter(call => call === 'persist').length, 4);
  assert.equal(context.calls.filter(call => call === 'fps').length, 4);
});

test('falls back to lives for unsupported tabs and retains navigation call order', () => {
  const context = setup();

  context.navigation.setTab('unknown');

  assert.equal(context.state.tab, 'lives');
  assert.deepEqual(context.calls, ['persist', 'game-actions-toggle', 'live-actions-toggle', 'layout', 'fps']);
});

test('binds sidebar navigation items to the existing tab transition', () => {
  const context = setup();
  context.navigation.bind();
  context.navItems.find(item => item.dataset.tab === 'alerts').dispatch('click');
  context.openTab('settings');

  assert.equal(context.state.tab, 'settings');
  assert.equal(context.calls.includes('alerts'), true);
  assert.equal(context.calls.includes('settings'), true);
  assert.equal(context.navItems.find(item => item.dataset.tab === 'settings').classList.contains('on'), true);

  const app = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
  assert.match(app, /appNavigation\.bind\(\)/);
  assert.doesNotMatch(app, /\$\$\('\.sidebar-nav \.nav-item\[data-tab\]'\)/);
});

test('binds action bar toggles, persists visibility, and relayouts only live actions', () => {
  const context = setup();
  context.nodes.set('#btn-toggle-game-actions', makeNode());
  context.nodes.set('#btn-toggle-live-actions', makeNode());
  context.navigation.bind();

  context.nodes.get('#btn-toggle-game-actions').dispatch('click');
  assert.equal(context.state.gameActionsVisible, true);
  assert.equal(context.nodes.get('#game-actions-bar').hidden, true);

  context.state.tab = 'lives';
  context.nodes.get('#btn-toggle-live-actions').dispatch('click');
  assert.equal(context.state.liveActionsVisible, false);
  assert.equal(context.nodes.get('#lives-actions-bar').hidden, true);
  assert.deepEqual(context.calls.filter(call => call === 'persist'), ['persist', 'persist']);
  assert.equal(context.calls.filter(call => call === 'layout').length, 1);

  const app = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /\$\('#btn-toggle-(?:game|live)-actions'\)\?\.addEventListener/);
});
