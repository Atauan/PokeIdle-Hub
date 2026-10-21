'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bindGameWebviewEvents, bindRotomForwardEvent } = require('../renderer/game-webview-events');

function setup({ market = false, url = 'https://pokeidle.io/app' } = {}) {
  const listeners = new Map();
  const effects = [];
  const account = { id: 'account-1', name: 'Conta 1' };
  const webview = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    getURL() { return url; },
    executeJavaScript() { return Promise.resolve(); },
  };
  bindGameWebviewEvents({
    webview,
    account,
    market,
    adjustZoom: (id, delta) => effects.push(['adjustZoom', id, delta]),
    resetZoom: (id) => effects.push(['resetZoom', id]),
    captureMarket: (payload) => effects.push(['captureMarket', payload]),
    receiveChannels: (payload) => effects.push(['receiveChannels', payload]),
    sendRotomMessage: (id, payload) => effects.push(['sendRotomMessage', id, payload]),
    persist: () => effects.push(['persist']),
    renderAccountTabs: () => effects.push(['renderAccountTabs']),
  });
  return {
    account,
    effects,
    dispatch: (channel, payload) => listeners.get('ipc-message')({ channel, args: [payload] }),
  };
}

test('routes account-specific game zoom events and market messages only through the market pane', () => {
  const primary = setup({ market: true });
  primary.dispatch('game-zoom-delta', '0.05');
  primary.dispatch('game-zoom-reset');
  const marketPayload = { listings: [] };
  primary.dispatch('market', marketPayload);

  const secondary = setup();
  secondary.dispatch('market', marketPayload);

  assert.deepEqual(primary.effects, [
    ['adjustZoom', 'account-1', 0.05],
    ['resetZoom', 'account-1'],
    ['captureMarket', marketPayload],
  ]);
  assert.deepEqual(secondary.effects, []);
});

test('accepts game channel messages only from the Pokeidle origin', () => {
  const trusted = setup();
  const channels = ['canal1'];
  trusted.dispatch('game-channels', channels);
  assert.deepEqual(trusted.effects, [['receiveChannels', channels]]);

  const external = setup({ url: 'https://example.com/' });
  external.dispatch('game-channels', channels);
  assert.deepEqual(external.effects, []);

  const malformed = setup({ url: 'not a url' });
  assert.doesNotThrow(() => malformed.dispatch('game-channels', channels));
  assert.deepEqual(malformed.effects, []);
});

test('routes Rotom messages with the owning account ID', () => {
  const { dispatch, effects } = setup();
  const payload = { type: 'status' };
  dispatch('rotom-msg', payload);

  assert.deepEqual(effects, [['sendRotomMessage', 'account-1', payload]]);
});

test('updates a changed game nickname but ignores blank, placeholder, and unchanged names', () => {
  const { account, dispatch, effects } = setup();
  dispatch('game-account-nick', '  Novo Nome  ');
  dispatch('game-account-nick', 'Novo Nome');
  dispatch('game-account-nick', '—');
  dispatch('game-account-nick', '   ');

  assert.equal(account.name, 'Novo Nome');
  assert.deepEqual(effects, [['persist'], ['renderAccountTabs']]);
});

test('binds Rotom bridge once and forwards only to an account webview that can receive messages', () => {
  let forwardHandler = null;
  let subscriptions = 0;
  const sent = [];
  const games = new Map([
    ['account-1', { wv: { send: (channel, message) => sent.push([channel, message]) } }],
    ['account-2', { wv: {} }],
  ]);
  bindRotomForwardEvent({
    onRotomForwardToGame: callback => { subscriptions += 1; forwardHandler = callback; },
    getGame: accountId => games.get(accountId),
  });

  const message = { type: 'status' };
  forwardHandler({ accId: 'account-1', message });
  forwardHandler({ accId: 'missing', message });
  forwardHandler({ accId: 'account-2', message });

  assert.equal(subscriptions, 1);
  assert.deepEqual(sent, [['rotom-cmd', message]]);
});

test('does not subscribe to an unavailable optional Rotom bridge callback', () => {
  assert.doesNotThrow(() => bindRotomForwardEvent({ getGame: () => null }));
});
