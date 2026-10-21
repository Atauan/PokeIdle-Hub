'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameWorkspaceLifecycle } = require('../renderer/game-workspace-lifecycle');

function setup({ accounts, resources, plan, selected = 'main', events = [] } = {}) {
  const state = { accounts: accounts || [{ id: 'main' }, { id: 'alt' }], gameAccount: selected, gameMosaic: false };
  const games = resources || new Map();
  const controller = createGameWorkspaceLifecycle({
    state,
    games,
    planWorkspace: () => plan,
    ensureHeader: (account, resource, market) => events.push(['ensureHeader', account.id, resource, market]),
    createResource: (account, market) => {
      const resource = { id: account.id, wv: account.id, market, pane: { remove: () => events.push(['remove', account.id]) } };
      events.push(['create', account.id, market]);
      return resource;
    },
    setPrimaryWebview: (webview) => events.push(['primary', webview]),
    afterSetup: () => events.push(['afterSetup']),
  });
  return { controller, state, games, events };
}

test('removes obsolete panes and creates planned accounts in order before final synchronization', () => {
  const obsolete = { pane: { remove: () => events.push(['remove', 'gone']) } };
  const events = [];
  const resources = new Map([['gone', obsolete]]);
  const { controller, games } = setup({
    resources,
    events,
    plan: {
      removeIds: ['gone'],
      actions: [
        { type: 'create', account: { id: 'main' }, market: true },
        { type: 'create', account: { id: 'alt' }, market: false },
      ],
      primaryAccountId: 'main',
    },
  });
  controller.setup();
  assert.deepEqual(events.slice(0, 3), [['remove', 'gone'], ['create', 'main', true], ['create', 'alt', false]]);
  assert.equal(games.has('gone'), false);
  assert.deepEqual([...games.keys()], ['main', 'alt']);
  assert.equal(games.get('main').market, true);
});

test('reuses resources, adds a missing header, and preserves the selected account', () => {
  const resource = { wv: 'webview', pane: { querySelector: () => null } };
  const account = { id: 'main' };
  const { controller, events } = setup({
    accounts: [account],
    resources: new Map([['main', resource]]),
    selected: 'main',
    plan: { removeIds: [], actions: [{ type: 'reuse', account, resource, market: true }], primaryAccountId: 'main' },
  });
  controller.setup();
  assert.deepEqual(events, [['ensureHeader', 'main', resource, true], ['primary', 'webview'], ['afterSetup']]);
});

test('replaces a pane before creation and falls back to primary when selection was removed', () => {
  const oldResource = { pane: { remove: () => events.push(['remove', 'alt']) } };
  const events = [];
  const account = { id: 'alt' };
  const { controller, state, games } = setup({
    accounts: [{ id: 'main' }, account],
    resources: new Map([['alt', oldResource]]),
    selected: 'deleted',
    events,
    plan: { removeIds: [], actions: [{ type: 'replace', account, resource: oldResource, market: true }], primaryAccountId: 'alt' },
  });
  controller.setup();
  assert.deepEqual(events.slice(0, 2), [['remove', 'alt'], ['create', 'alt', true]]);
  assert.equal(games.get('alt').id, 'alt');
  assert.equal(state.gameAccount, 'alt');
  assert.deepEqual(events.slice(-2), [['primary', 'alt'], ['afterSetup']]);
});
