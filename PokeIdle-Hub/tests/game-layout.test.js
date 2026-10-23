'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameLayout } = require('../renderer/game-layout');

function setup() {
  const state = {
    accounts: [{ id: 'main', name: 'Conta principal' }, { id: 'alt', name: 'Alternativa' }],
    gameAccount: 'main',
    gameMosaic: false,
  };
  const classes = new Set();
  const panel = {
    dataset: {},
    classList: {
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
  };
  const buttonClasses = new Set();
  const button = {
    classList: {
      toggle(name, on) { if (on) buttonClasses.add(name); else buttonClasses.delete(name); },
      contains(name) { return buttonClasses.has(name); },
    },
    innerHTML: '', title: '',
  };
  const labels = new Map();
  const games = new Map(state.accounts.map((account) => {
    const label = { textContent: '' };
    labels.set(account.id, label);
    return [account.id, { pane: { querySelector: () => label } }];
  }));
  const effects = { persists: 0, fpsUpdates: 0, tabs: [] };
  const layout = createGameLayout({
    state,
    getAccounts: () => state.accounts,
    games,
    getPanel: () => panel,
    getMosaicButton: () => button,
    persist: () => { effects.persists += 1; },
    applyFpsLimits: () => { effects.fpsUpdates += 1; },
    setTab: (tab) => effects.tabs.push(tab),
  });
  return { state, panel, button, labels, effects, classes, buttonClasses, layout };
}

test('updates per-account pane names and panel account count', () => {
  const { state, panel, labels, layout } = setup();

  layout.updatePaneHeaders();

  assert.equal(labels.get('main').textContent, 'Conta principal');
  assert.equal(labels.get('alt').textContent, 'Alternativa');
  assert.equal(panel.dataset.accounts, 2);
  state.accounts[1].name = 'Nova alternativa';
  layout.updatePaneHeaders();
  assert.equal(labels.get('alt').textContent, 'Nova alternativa');
});

test('toggles mosaic classes, button text, persistence, and FPS updates', () => {
  const { state, button, buttonClasses, effects, classes, layout } = setup();

  layout.toggleMosaic(true);

  assert.equal(state.gameMosaic, true);
  assert.equal(classes.has('mosaic-mode'), true);
  assert.equal(buttonClasses.has('on'), true);
  assert.match(button.innerHTML, /Mostrar uma conta/);
  assert.match(button.title, /conta selecionada em tamanho maior/);
  assert.equal(effects.persists, 1);
  assert.equal(effects.fpsUpdates, 1);
});

test('focus selects the account, exits mosaic, and returns to the game tab', () => {
  const { state, effects, classes, layout } = setup();
  state.gameMosaic = true;
  layout.applyMosaic(true);

  layout.focusAccount('alt');

  assert.equal(state.gameAccount, 'alt');
  assert.equal(state.gameMosaic, false);
  assert.equal(classes.has('mosaic-mode'), false);
  assert.deepEqual(effects.tabs, ['game']);
  assert.equal(effects.persists, 1);
  assert.equal(effects.fpsUpdates, 2);
});
