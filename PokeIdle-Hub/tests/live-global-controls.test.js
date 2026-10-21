'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveGlobalControls } = require('../renderer/live-global-controls');

function button() {
  const listeners = new Map();
  return {
    hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatch(name, event = {}) { listeners.get(name)?.(event); },
  };
}

function setup() {
  const events = [];
  const elements = new Map(['mute-all', 'follow-all', 'reload-all', 'twitch-economy', 'kick-economy', 'kick-economy-help', 'twitch-economy-reload']
    .map(id => [id, button()]));
  const twitchTile = { p: 'twitch', player: { id: 'twitch-player' }, item: { muted: false } };
  const kickTile = { p: 'kick', player: { id: 'kick-player' }, item: { muted: false } };
  const state = { twitchEconomy: false, kickEconomy: true, quality: 160 };
  const controls = createLiveGlobalControls({
    query: selector => elements.get(selector.slice(1)),
    state,
    all: () => [{ i: twitchTile.item }, { i: kickTile.item }],
    tiles: new Map([['twitch:one', twitchTile], ['kick:one', kickTile]]),
    persist: () => events.push('persist'),
    applyMute: id => events.push(['mute', id]),
    followAllOpenChannels: () => events.push('follow'),
    reloadTile: tile => events.push(['reload-tile', tile.p]),
    twitchEconomyRuntime: { reloadAll: () => events.push('reload-economy') },
    syncTiles: () => events.push('sync'),
    applyChatMode: id => events.push(['chat-mode', id]),
    applyQuality: player => events.push(['quality', player.id]),
    reloadWebview: player => events.push(['reload-webview', player.id]),
  });
  controls.bind();
  return { controls, elements, events, state, twitchTile, kickTile };
}

test('mute-all persists muted items then updates each open tile', () => {
  const context = setup();
  context.elements.get('mute-all').dispatch('click');
  assert.equal(context.twitchTile.item.muted, true);
  assert.equal(context.kickTile.item.muted, true);
  assert.deepEqual(context.events, ['persist', ['mute', 'twitch:one'], ['mute', 'kick:one']]);
});

test('follow-all and reload-all preserve the current action sequence', () => {
  const context = setup();
  context.elements.get('follow-all').dispatch('click');
  context.elements.get('reload-all').dispatch('click');
  assert.deepEqual(context.events, ['follow', ['reload-tile', 'twitch'], ['reload-tile', 'kick'], 'reload-economy']);
});

test('Twitch economy toggle updates state and reconciles tiles without an extra persist call', () => {
  const context = setup();
  context.elements.get('twitch-economy').dispatch('change', { target: { checked: true } });
  assert.equal(context.state.twitchEconomy, true);
  assert.deepEqual(context.events, ['sync']);
});

test('Kick economy toggle updates help and only adjusts Kick tiles', () => {
  const context = setup();
  context.state.kickEconomy = false;
  context.state.quality = 0;
  context.elements.get('kick-economy').dispatch('change', { target: { checked: true } });
  assert.equal(context.state.kickEconomy, true);
  assert.equal(context.elements.get('kick-economy-help').hidden, false);
  assert.deepEqual(context.events, ['persist', ['chat-mode', 'kick:one'], ['quality', 'kick-player']]);

  context.events.length = 0;
  context.elements.get('kick-economy').dispatch('change', { target: { checked: false } });
  assert.equal(context.elements.get('kick-economy-help').hidden, true);
  assert.deepEqual(context.events, ['persist', ['chat-mode', 'kick:one'], ['reload-webview', 'kick-player']]);
});

test('Twitch economy reload action only refreshes the economy runtime', () => {
  const context = setup();
  context.elements.get('twitch-economy-reload').dispatch('click');
  assert.deepEqual(context.events, ['reload-economy']);
});
