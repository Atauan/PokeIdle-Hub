'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTwitchEconomyRuntime } = require('../renderer/twitch-economy-runtime');

function setup({ accounts = [{ id: 'main', name: 'Principal' }, { id: 'alt', name: 'Secundária' }], eligible = ['main'], enabled = true } = {}) {
  const state = { twitchEconomy: enabled, kickEconomy: false };
  const events = [];
  const views = new Map();
  const body = { append: (view) => { view.isConnected = true; events.push(['append', view.partition]); } };
  const controls = {
    twitchEconomy: { checked: false }, kickEconomy: { checked: false },
    kickHelp: { hidden: true }, twitchHelp: { hidden: true },
    reload: { hidden: true }, status: { dataset: {}, textContent: '' },
  };
  let poll;
  const runtime = createTwitchEconomyRuntime({
    state,
    getAccounts: () => accounts,
    getEligibleAccountIds: () => eligible,
    partitionForAccount: account => `persist:${account.id}`,
    createWebview: (url, options) => {
      const view = {
        url, partition: options.partition, __ready: false, isConnected: false,
        classList: { add: value => events.push(['class', value]) },
        setAttribute: (...args) => events.push(['attribute', ...args]),
        remove: () => { view.isConnected = false; events.push(['remove', view.partition]); },
        executeJavaScript: async () => view.economyState || null,
      };
      views.set(options.partition, view);
      events.push(['create', url, options.partition, options.muted]);
      return view;
    },
    disposeWebview: view => events.push(['dispose', view.partition]),
    body,
    controls,
    reloadWebview: view => events.push(['reload', view.partition]),
    setIntervalFn: callback => { poll = callback; return 1; },
  });
  return { runtime, state, controls, events, views, getPoll: () => poll };
}

test('creates economy views only for eligible accounts and uses the shared channel URL', () => {
  const { runtime, controls, events } = setup();
  runtime.sync(['beta', 'alpha', 'invalid channel', 'alpha'], ['main']);

  assert.equal(runtime.size(), 1);
  assert.equal(events.filter(([type]) => type === 'create').length, 1);
  assert.deepEqual(events.find(([type]) => type === 'create'), [
    'create', 'https://www.twitch.tv/popout/alpha/chat?pf-economy=1&pf-channels=alpha%2Cbeta', 'persist:main', true,
  ]);
  assert.equal(controls.status.textContent, 'Conectando aos chats das contas…');
  assert.equal(controls.reload.hidden, false);
});

test('removes ineligible account views and creates only newly eligible sessions', () => {
  const context = setup();
  context.runtime.sync(['channel'], ['main']);
  context.runtime.sync(['channel'], ['alt']);

  assert.equal(context.runtime.size(), 1);
  assert.ok(context.events.some(([type, partition]) => type === 'dispose' && partition === 'persist:main'));
  assert.ok(context.events.some(([type, partition]) => type === 'append' && partition === 'persist:alt'));
});

test('clears all views when economy is disabled and distinguishes no connection from waiting channels', () => {
  const context = setup();
  context.runtime.sync(['channel']);
  context.state.twitchEconomy = false;
  context.runtime.sync(['channel']);
  assert.equal(context.runtime.size(), 0);
  assert.equal(context.controls.status.textContent, '');
  assert.equal(context.controls.reload.hidden, true);

  context.state.twitchEconomy = true;
  context.runtime.sync(['channel'], []);
  assert.equal(context.controls.status.textContent, 'Nenhuma conta Twitch conectada');
  context.runtime.sync([], ['main']);
  assert.equal(context.controls.status.textContent, 'Aguardando canais online');
});

test('replaces a view when channels change, polls chat state, and reloads current views', async () => {
  const context = setup();
  context.runtime.sync(['first']);
  context.runtime.sync(['second']);
  assert.equal(context.runtime.size(), 1);
  assert.ok(context.events.some(([type]) => type === 'dispose'));

  const view = context.views.get('persist:main');
  view.__ready = true;
  view.economyState = { authenticated: true, connected: true };
  context.runtime.reloadAll();
  assert.ok(context.events.some(([type, partition]) => type === 'reload' && partition === 'persist:main'));
  await context.getPoll()();
  assert.match(context.controls.status.textContent, /1\/1 contas conectadas aos chats/);
});

test('limits chat list to 100 and reports unauthenticated account names without exposing secrets', async () => {
  const context = setup({ accounts: [{ id: 'main', name: 'Conta segura' }, { id: 'alt', name: 'Outra' }], eligible: ['main', 'alt'] });
  const channels = Array.from({ length: 102 }, (_, index) => `channel${String(index).padStart(3, '0')}`);
  context.runtime.sync(channels);
  assert.equal(context.controls.status.dataset.total, '102');
  const url = context.events.find(([type]) => type === 'create')[1];
  assert.equal(new URL(url).searchParams.get('pf-channels').split(',').length, 100);

  for (const view of context.views.values()) {
    view.__ready = true;
    view.economyState = { authenticated: false, token: 'must-not-appear' };
  }
  await context.getPoll()();
  assert.match(context.controls.status.textContent, /Conta segura, Outra/);
  assert.doesNotMatch(context.controls.status.textContent, /must-not-appear/);
});
