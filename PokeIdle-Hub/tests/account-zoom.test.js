'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAccountZoomController } = require('../renderer/account-zoom');

function setup({ selected = 'main', accountZoom = {}, resources = new Map() } = {}) {
  const state = { gameAccount: selected, accountZoom };
  const selectedLabel = { textContent: '' };
  let persists = 0;
  const zoom = createAccountZoomController({
    state,
    games: resources,
    persist: () => { persists += 1; },
    getSelectedAccountId: () => state.gameAccount,
    getSelectedZoomLabel: () => selectedLabel,
  });
  return { zoom, state, selectedLabel, get persists() { return persists; } };
}

test('reads stored per-account zoom and falls back for absent or out-of-range values', () => {
  const { zoom } = setup({ accountZoom: { main: 0.75, alt: 2.1 } });

  assert.equal(zoom.get('main'), 0.75);
  assert.equal(zoom.get('alt'), 1);
  assert.equal(zoom.get('missing'), 1);
});

test('sets a rounded clamped zoom only for the selected account and updates its controls', () => {
  const paneLabel = { textContent: '' };
  const webview = { setZoomFactor(value) { this.factor = value; } };
  const resource = { wv: webview, pane: { querySelector() { return paneLabel; } } };
  const setupResult = setup({ resources: new Map([['main', resource]]) });
  const { zoom, state, selectedLabel } = setupResult;

  assert.equal(zoom.set('main', 1.237), 1.24);

  assert.equal(state.accountZoom.main, 1.24);
  assert.equal(webview.factor, 1.24);
  assert.equal(selectedLabel.textContent, '124%');
  assert.equal(paneLabel.textContent, '124%');
  assert.equal(setupResult.persists, 1);
});

test('keeps zoom isolated per account, clamps user changes, and tolerates a destroyed webview', () => {
  const brokenResource = {
    wv: { setZoomFactor() { throw new Error('destroyed'); } },
    pane: { querySelector() { return null; } },
  };
  const { zoom, state } = setup({
    accountZoom: { main: 1.1 },
    resources: new Map([['alt', brokenResource]]),
  });

  assert.equal(zoom.set('alt', 2), 1.5);
  assert.equal(state.accountZoom.main, 1.1);
  assert.equal(state.accountZoom.alt, 1.5);
  assert.equal(zoom.adjust('alt', -2), 0.4);
});

test('adjust defaults to the selected account when no account ID is supplied', () => {
  const { zoom, state } = setup({ selected: 'alt', accountZoom: { alt: 0.8, main: 1.2 } });

  assert.equal(zoom.adjust(undefined, 0.05), 0.85);
  assert.equal(state.accountZoom.alt, 0.85);
  assert.equal(state.accountZoom.main, 1.2);
});

test('binds game zoom buttons, keyboard shortcuts, and Ctrl-wheel only in the game tab', () => {
  const listeners = new Map();
  const elements = new Map(['btn-game-zoom-out', 'btn-game-zoom-in', 'btn-game-zoom-reset'].map(id => [id, {
    addEventListener: (name, listener) => listeners.set(`${id}:${name}`, listener),
  }]));
  const windowObject = {
    addEventListener: (name, listener, options) => listeners.set(`window:${name}`, { listener, options }),
  };
  const context = setup({ accountZoom: { main: 1 }, resources: new Map() });
  let tab = 'game';
  context.zoom.bindControls({
    query: selector => elements.get(selector.slice(1)),
    windowObject,
    getActiveTab: () => tab,
    getSelectedAccountId: () => context.state.gameAccount,
  });

  listeners.get('btn-game-zoom-out:click')();
  assert.equal(context.state.accountZoom.main, 0.95);
  listeners.get('btn-game-zoom-in:click')();
  assert.equal(context.state.accountZoom.main, 1);
  listeners.get('btn-game-zoom-out:click')();
  listeners.get('btn-game-zoom-reset:click')();
  assert.equal(context.state.accountZoom.main, 1);

  let prevented = 0;
  const keydown = listeners.get('window:keydown').listener;
  keydown({ key: '+', ctrlKey: true, preventDefault: () => prevented++ });
  assert.equal(context.state.accountZoom.main, 1.05);
  keydown({ key: '0', code: 'Numpad0', ctrlKey: true, preventDefault: () => prevented++ });
  assert.equal(context.state.accountZoom.main, 1);
  tab = 'lives';
  keydown({ key: '-', ctrlKey: true, preventDefault: () => prevented++ });
  assert.equal(context.state.accountZoom.main, 1);

  const wheel = listeners.get('window:wheel');
  assert.deepEqual(wheel.options, { passive: false });
  tab = 'game';
  wheel.listener({ ctrlKey: true, deltaY: -1, preventDefault: () => prevented++ });
  assert.equal(context.state.accountZoom.main, 1.05);
  wheel.listener({ ctrlKey: false, deltaY: 1, preventDefault: () => prevented++ });
  assert.equal(context.state.accountZoom.main, 1.05);
  assert.equal(prevented, 3);
});
