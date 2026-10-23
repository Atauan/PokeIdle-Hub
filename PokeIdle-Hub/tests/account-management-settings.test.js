'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAccountManagementSettings } = require('../renderer/account-management-settings');
const stateApi = require('../renderer/app-state');

function setup() {
  const state = {
    accounts: [
      { id: 'main', name: 'Principal', main: true },
      { id: 'alt', name: 'Alternativa' },
      { id: 'third', name: 'Terceira' },
    ],
    accountOrder: ['main', 'alt', 'third'],
    defaultGameAccountId: 'main',
    gameAccount: 'main',
  };
  const container = { children: [], replaceChildren(...children) { this.children = children; } };
  const effects = { persist: 0, renderTabs: 0, selectedDefaults: [] };
  const settings = createAccountManagementSettings({
    state,
    stateApi,
    query: selector => selector === '#cfg-account-list' ? container : null,
    el: (tag, props = {}, ...children) => ({ tag, props, children: children.flat() }),
    persist: () => { effects.persist += 1; },
    renderTabs: () => { effects.renderTabs += 1; },
    onDefaultAccountChanged: id => effects.selectedDefaults.push(id),
  });
  return { settings, state, container, effects };
}

test('renders the configured order and distinguishes the UI default from the shared login owner', () => {
  const { settings, container } = setup();
  settings.render();

  assert.deepEqual(container.children.map(row => row.props['data-account']), ['main', 'alt', 'third']);
  assert.equal(container.children[0].children[0].children[0].props.text, 'Principal');
  assert.equal(container.children[0].children[0].children[1].props.text, 'Conta padrão');
  assert.equal(container.children[0].children[0].children[2].props.text, 'Usa os logins das lives');
  assert.equal(container.children[1].children[0].children[2].props.text, 'Logins separados');
});

test('reorders visible accounts without changing accounts array or its session/runtime order', () => {
  const { settings, state, container, effects } = setup();
  const originalAccounts = [...state.accounts];
  settings.render();

  const moveDown = container.children[1].children[1].children[1];
  moveDown.props.onclick();

  assert.deepEqual(state.accountOrder, ['main', 'third', 'alt']);
  assert.deepEqual(state.accounts, originalAccounts);
  assert.deepEqual(container.children.map(row => row.props['data-account']), ['main', 'third', 'alt']);
  assert.equal(effects.persist, 1);
  assert.equal(effects.renderTabs, 1);
});

test('choosing another default moves it to the top, selects it and persists the preference', () => {
  const { settings, state, container, effects } = setup();
  settings.render();

  const chooseDefault = container.children[2].children[1].children[2];
  chooseDefault.props.onclick();

  assert.equal(state.defaultGameAccountId, 'third');
  assert.equal(state.gameAccount, 'third');
  assert.deepEqual(state.accountOrder, ['third', 'main', 'alt']);
  assert.deepEqual(container.children.map(row => row.props['data-account']), ['third', 'main', 'alt']);
  assert.deepEqual(effects.selectedDefaults, ['third']);
  assert.equal(effects.persist, 1);
  assert.equal(effects.renderTabs, 1);
});

test('keeps default account pinned visually and disables actions at order boundaries', () => {
  const { settings, container } = setup();
  settings.render();
  const rows = container.children;
  assert.equal(rows[0].children[1].children[0].props.disabled, true);
  assert.equal(rows[0].children[1].children[1].props.disabled, true);
  assert.equal(rows[1].children[1].children[0].props.disabled, true);
  assert.equal(rows[2].children[1].children[1].props.disabled, true);
  assert.equal(rows[0].children[1].children[2].props.disabled, true);
  assert.equal(rows[1].children[1].children[2].props.disabled, false);
});
