'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameAccountTabs } = require('../renderer/game-account-tabs');

test('renders a visual copy in the configured order and leaves internal accounts untouched', () => {
  const accounts = [
    { id: 'main', name: 'Conta compartilhada', main: true },
    { id: 'alt', name: 'Alternativa' },
    { id: 'third', name: 'Terceira' },
  ];
  const container = { children: [], replaceChildren(...children) { this.children = children; } };
  const tabs = createGameAccountTabs({
    getAccounts: () => accounts,
    getAccountOrder: () => ['third', 'main', 'alt'],
    getSelectedAccountId: () => 'main',
    setSelectedAccountId() {},
    isMosaicEnabled: () => false,
    toggleMosaic() {},
    setTab() {},
    getContainer: () => container,
    getBadge: () => null,
    el: (tag, props) => ({ tag, props }),
    prompt() { return null; },
    persist() {},
    updatePaneHeaders() {},
  });

  tabs.render();

  assert.deepEqual(container.children.map(tab => tab.props['data-account']), ['third', 'main', 'alt']);
  assert.deepEqual(accounts.map(account => account.id), ['main', 'alt', 'third']);
});
