'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameToolbarControls } = require('../renderer/game-toolbar-controls');

function makeButton() {
  const listeners = new Map();
  return {
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatch(name) { listeners.get(name)?.(); },
  };
}

function setup(account = { id: 'alt-2', name: 'Conta 2', main: false }) {
  const events = [];
  const buttons = new Map(['game-reload', 'game-open-sniper', 'game-toggle-mosaic', 'game-edge', 'game-login']
    .map(id => [id, makeButton()]));
  const webview = { id: 'game-webview' };
  const games = new Map([[account.id, { wv: webview }]]);
  const controller = createGameToolbarControls({
    query: selector => buttons.get(selector.slice(1)),
    getCurrentAccount: () => account,
    getGames: () => games,
    reloadWebview: target => events.push(['reload', target]),
    toggleMosaic: () => events.push('mosaic'),
    openEdge: url => events.push(['edge', url]),
    gameUrl: 'https://www.pokeidle.net/',
    openRotomCockpit: (id, name) => events.push(['sniper', id, name]),
    openGameLogin: partition => events.push(['login', partition]),
    partitionForAccount: value => `persist:pokeidlehub-acc-${value.id}`,
    toast: message => events.push(['toast', message]),
  });
  controller.bind();
  return { buttons, events, webview };
}

test('routes game toolbar actions to the selected account and active integrations', () => {
  const context = setup();
  for (const id of ['game-reload', 'game-open-sniper', 'game-toggle-mosaic', 'game-edge']) {
    context.buttons.get(id).dispatch('click');
  }

  assert.deepEqual(context.events, [
    ['reload', context.webview],
    ['sniper', 'alt-2', 'Conta 2'],
    'mosaic',
    ['edge', 'https://www.pokeidle.net/'],
  ]);
});

test('opens login using the selected account partition and retains the existing instruction toast', () => {
  const context = setup();
  context.buttons.get('game-login').dispatch('click');

  assert.deepEqual(context.events, [
    ['login', 'persist:pokeidlehub-acc-alt-2'],
    ['toast', 'Faça o login na janela que abriu. Depois clique em "Recarregar jogo".'],
  ]);
});

test('opens primary-account login without an additional partition', () => {
  const context = setup({ id: 'main', name: 'Conta 1', main: true });
  context.buttons.get('game-login').dispatch('click');
  assert.deepEqual(context.events, [
    ['login', null],
    ['toast', 'Faça o login na janela que abriu. Depois clique em "Recarregar jogo".'],
  ]);
});
