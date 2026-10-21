'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createProviderConnectionController } = require('../renderer/provider-connection-controller');

function setup({ status = { twitch: false, kick: false }, selected = 'main', accounts = [
  { id: 'main', name: 'Principal', main: true },
  { id: 'alt', name: 'Secundária' },
], autoLives = true } = {}) {
  const calls = [];
  const handlers = new Map();
  const loginButtons = new Map();
  const clearButtons = new Map();
  for (const provider of ['twitch', 'kick']) {
    loginButtons.set(provider, { addEventListener: (_name, handler) => handlers.set(`login:${provider}`, handler) });
    clearButtons.set(provider, { addEventListener: (_name, handler) => handlers.set(`clear:${provider}`, handler) });
  }
  let closedHandler;
  let traceHandler;
  const readStatus = { ...status, unavailableProviders: status.unavailableProviders || [] };
  const controller = createProviderConnectionController({
    getElement: selector => {
      const provider = selector.includes('twitch') ? 'twitch' : 'kick';
      return selector.includes('clear') ? clearButtons.get(provider) : loginButtons.get(provider);
    },
    getCurrentAccount: () => accounts.find(account => account.id === selected) || accounts[0],
    getAccounts: () => accounts,
    getPrimaryAccount: () => ({ id: 'main', name: 'Conta 1', main: true }),
    partitionForAccount: account => account.main ? 'persist:pokeidlehub' : `persist:pokeidlehub-acc-${account.id}`,
    connections: {
      getCached: accountId => { calls.push(['cached', accountId]); return readStatus; },
      invalidate: accountId => calls.push(['invalidate', accountId]),
      read: async (account, options) => { calls.push(['read', account.id, options]); return readStatus; },
    },
    getProviderState: (value, provider) => value?.unavailableProviders?.includes(provider)
      ? 'unavailable'
      : value?.[provider] === true ? 'connected' : 'disconnected',
    getLoginApi: () => ({
      openLogin: (...args) => calls.push(['open-login', ...args]),
      clearConnection: (...args) => { calls.push(['clear-connection', ...args]); return Promise.resolve(true); },
      onLoginClosed: handler => { closedHandler = handler; },
      onLoginTrace: handler => { traceHandler = handler; },
    }),
    confirm: message => { calls.push(['confirm', message]); return true; },
    toast: message => calls.push(['toast', message]),
    updateGameBarConnections: () => calls.push(['gamebar']),
    getHeader: accountId => { calls.push(['header', accountId]); return { id: accountId }; },
    renderHeaderBadges: (account, header) => calls.push(['render-badges', account.id, header.id]),
    syncTiles: () => calls.push(['sync-tiles']),
    autoLivesEnabled: () => autoLives,
    scheduleLiveChecks: () => calls.push(['schedule-live-checks']),
    refreshProviderStatus: account => calls.push(['refresh-provider-status', account?.id]),
    log: (...args) => calls.push(['log', ...args]),
  });
  return { calls, closed: payload => closedHandler(payload), controller, handlers, trace: entry => traceHandler(entry) };
}

test('binds provider login buttons to the selected account and logs only approved auth fields', () => {
  const context = setup({ selected: 'alt' });
  context.controller.bind();
  context.handlers.get('login:twitch')();

  assert.ok(context.calls.some(call => call[0] === 'open-login' && call[1] === 'twitch' && call[2] === 'persist:pokeidlehub-acc-alt' && call[3] === 'Secundária'));
  assert.ok(context.calls.some(call => call[0] === 'log' && call[1] === '[auth-flow]' && call[2].stage === 'renderer_login_requested'));
  assert.equal(context.calls.some(call => call.flat(Infinity).includes('password')), false);
});

test('does not open login while cached status is unavailable and requests a refresh', () => {
  const context = setup({ status: { twitch: false, kick: false, unavailableProviders: ['twitch'] } });
  context.controller.bind();
  context.handlers.get('login:twitch')();

  assert.ok(context.calls.some(call => call[0] === 'refresh-provider-status' && call[1] === 'main'));
  assert.equal(context.calls.some(call => call[0] === 'open-login'), false);
});

test('refreshes only the account matching the closed login partition and keeps provider status independent', async () => {
  const context = setup({ status: { twitch: true, kick: false } });
  context.controller.bind();
  context.closed({ platform: 'twitch', partition: 'persist:pokeidlehub-acc-alt', flowId: '123e4567-e89b-12d3-a456-426614174000' });
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(context.calls.some(call => call[0] === 'invalidate' && call[1] === 'alt'));
  assert.ok(context.calls.some(call => call[0] === 'read' && call[1] === 'alt' && call[2]?.refresh === true));
  assert.ok(context.calls.some(call => call[0] === 'render-badges' && call[1] === 'alt'));
  assert.ok(context.calls.some(call => call[0] === 'schedule-live-checks'));
  assert.equal(context.calls.filter(call => call[0] === 'sync-tiles').length, 1);
  assert.equal(context.calls.some(call => call[0] === 'invalidate' && call[1] === 'main'), false);
});

test('closing login without an authenticated provider refreshes and renders disconnected status', async () => {
  const context = setup();
  context.controller.bind();
  context.closed({ platform: 'twitch', partition: 'persist:pokeidlehub', flowId: '123e4567-e89b-12d3-a456-426614174000' });
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(context.calls.some(call => call[0] === 'read' && call[1] === 'main' && call[2]?.refresh === true));
  assert.ok(context.calls.some(call => call[0] === 'log' && call[1] === '[auth-flow]' && call[2].stage === 'status_refresh_completed' && call[2].state === 'disconnected'));
  assert.equal(context.calls.some(call => call[0] === 'log' && call[1] === '[auth-flow]' && call[2].stage === 'status_refresh_completed' && call[2].state === 'connected'), false);
  assert.ok(context.calls.some(call => call[0] === 'render-badges' && call[1] === 'main'));
  assert.equal(context.calls.filter(call => call[0] === 'sync-tiles').length, 1);
});

test('skips unsupported close events and logs provider trace payloads', () => {
  const context = setup();
  context.controller.bind();
  context.closed({ platform: 'game', partition: 'persist:pokeidlehub', flowId: '123e4567-e89b-12d3-a456-426614174000' });
  context.trace({ flowId: '123e4567-e89b-12d3-a456-426614174000', provider: 'kick', stage: 'navigation_started' });

  assert.equal(context.calls.some(call => call[0] === 'read'), false);
  assert.ok(context.calls.some(call => call[0] === 'log' && call[1] === '[auth-flow]' && call[2].stage === 'status_refresh_skipped'));
  assert.ok(context.calls.some(call => call[0] === 'log' && call[1] === '[auth-flow]' && call[2].stage === 'navigation_started'));
});

test('disconnects only the selected provider after confirmation and updates the selected account UI', async () => {
  const context = setup({ selected: 'alt' });
  context.controller.bind();
  let propagationStopped = false;
  await context.handlers.get('clear:kick')({ stopPropagation() { propagationStopped = true; } });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(propagationStopped, true);
  assert.ok(context.calls.some(call => call[0] === 'clear-connection' && call[1] === 'kick' && call[2] === 'persist:pokeidlehub-acc-alt'));
  assert.ok(context.calls.some(call => call[0] === 'toast' && call[1] === 'Kick desconectada de Secundária'));
  assert.ok(context.calls.some(call => call[0] === 'read' && call[1] === 'alt' && call[2]?.refresh === true));
  assert.ok(context.calls.some(call => call[0] === 'gamebar'));
  assert.ok(context.calls.some(call => call[0] === 'sync-tiles'));
  assert.equal(context.calls.some(call => call[0] === 'clear-connection' && call[1] === 'twitch'), false);
});

test('active renderer loads and composes the provider controller before binding UI events', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(app, /PokeIdleProviderConnectionController\.createProviderConnectionController\(/);
  assert.match(app, /providerConnectionController\.bind\(\)/);
  assert.ok(html.indexOf('<script src="provider-connection-controller.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
