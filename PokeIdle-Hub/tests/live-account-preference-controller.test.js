'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLiveAccountPreferenceController } = require('../renderer/live-account-preference-controller');
const preferences = require('../live-account-preferences');

function setup() {
  const state = {
    accountFavorites: { main: [], alt: [] },
    accounts: [{ id: 'main' }, { id: 'alt' }],
    accountLimits: {},
    universalLimits: { kick: 2, twitch: 3 },
  };
  const events = [];
  const button = {
    innerHTML: '',
    title: '',
    classList: { toggle: (...args) => events.push(['class', ...args]) },
  };
  const tiles = new Map([
    ['main:alpha', { acc: { id: 'main' }, item: { channel: 'Alpha' }, favBtn: button }],
    ['alt:alpha', { acc: { id: 'alt' }, item: { channel: 'alpha' }, favBtn: { ...button } }],
    ['main:beta', { acc: { id: 'main' }, item: { channel: 'beta' }, favBtn: { ...button } }],
  ]);
  const controller = createLiveAccountPreferenceController({
    state,
    preferences,
    getTiles: () => tiles,
    persist: () => events.push(['persist']),
    syncTiles: () => events.push(['sync']),
    toast: message => events.push(['toast', message]),
  });
  return { button, controller, events, state, tiles };
}

test('toggles a favorite and updates only matching tiles for the selected account', () => {
  const { button, controller, events, state, tiles } = setup();
  assert.equal(controller.isAccountFavorite('alpha', 'main'), false);
  controller.toggleAccountFavorite('Alpha', 'main');

  assert.equal(controller.isAccountFavorite('ALPHA', 'main'), true);
  assert.deepEqual(state.accountFavorites, { main: ['alpha'], alt: [] });
  assert.equal(button.classList.toggle instanceof Function, true);
  assert.match(button.innerHTML, /icon-star/);
  assert.equal(tiles.get('alt:alpha').favBtn.innerHTML, '');
  assert.equal(tiles.get('main:beta').favBtn.innerHTML, '');
  assert.deepEqual(events.filter(([type]) => type === 'persist' || type === 'sync').map(([type]) => type), ['persist', 'sync']);
  assert.match(events.find(([type]) => type === 'toast')[1], /adicionado aos favoritos/);
});

test('applies universal limits to every current account and preserves labels and effects', () => {
  const { controller, events, state } = setup();
  controller.applyUniversalLimit('kick', '0');

  assert.equal(state.universalLimits.kick, 0);
  assert.equal(state.accountLimits.main.kick, 0);
  assert.equal(state.accountLimits.alt.kick, 0);
  assert.deepEqual(events.filter(([type]) => type === 'persist' || type === 'sync').map(([type]) => type), ['persist', 'sync']);
  assert.match(events.find(([type]) => type === 'toast')[1], /Máx Kick universal definido para Desativado/);
});

test('uses the legacy main-account fallback and ignores invalid universal values', () => {
  const { controller, events, state } = setup();
  state.accounts = [];
  controller.applyUniversalLimit('twitch', '99');
  const afterValid = structuredClone(state);
  const effectCount = events.length;
  controller.applyUniversalLimit('twitch', 'invalid');

  assert.equal(afterValid.accountLimits.main.twitch, 99);
  assert.equal(events.length, effectCount);
  assert.deepEqual(state, afterValid);
  assert.match(events.find(([type]) => type === 'toast')[1], /Ilimitado/);
});

test('changes one account limit and skips no-op changes', () => {
  const { controller, events, state } = setup();
  controller.changeAccountLimit('main', 'kick', -1);
  assert.equal(state.accountLimits.main.kick, 1);
  assert.deepEqual(events.filter(([type]) => type === 'persist' || type === 'sync').map(([type]) => type), ['persist', 'sync']);

  events.length = 0;
  state.accountLimits.main.kick = 0;
  controller.changeAccountLimit('main', 'kick', -1);
  assert.deepEqual(events, []);
});

test('application and html register the preference controller before app composition', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../renderer/app.js'), 'utf8');
  const htmlSource = fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf8');
  const controllerIndex = htmlSource.indexOf('live-account-preference-controller.js');
  const appIndex = htmlSource.indexOf('app.js');

  assert.notEqual(controllerIndex, -1);
  assert.ok(controllerIndex < appIndex);
  assert.match(appSource, /createLiveAccountPreferenceController/);
});
