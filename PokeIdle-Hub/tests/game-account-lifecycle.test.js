'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameAccountLifecycle } = require('../renderer/game-account-lifecycle');
const { normalizeAccountOrder, resolveDefaultAccountId, promoteDefaultAccount } = require('../renderer/app-state');

function setup({ accounts, selected = 'main', defaultAccount = 'main', confirmResult = true, cleanupReject = false, cleanupResult = true, accountPreferences = true } = {}) {
  const state = {
    accounts: accounts || [
      { id: 'main', name: 'Principal', main: true },
      { id: 'alt', name: 'Alternativa' },
    ],
    gameAccount: selected,
    defaultGameAccountId: defaultAccount,
    accountOrder: ['main', 'alt'],
    accountFavorites: accountPreferences ? { alt: ['twitch:canal'] } : {},
    accountLimits: accountPreferences ? { alt: { kick: 2, twitch: 3 } } : {},
  };
  const events = [];
  let scheduledCleanup = null;
  const listeners = new Map();
  const buttons = new Map(['#add-account', '#account-remove'].map(selector => [selector, {
    addEventListener: (name, listener) => listeners.set(`${selector}:${name}`, listener),
    dispatch: name => listeners.get(`${selector}:${name}`)?.(),
  }]));
  const controller = createGameAccountLifecycle({
    state,
    query: selector => buttons.get(selector),
    uid: () => 'new-id',
    persist: () => events.push(['persist']),
    setupGame: () => events.push(['setupGame']),
    renderAccountTabs: () => events.push(['renderAccountTabs']),
    refreshConnection: (account) => {
      events.push(['refreshConnection', account.id]);
      return Promise.resolve();
    },
    invalidateConnection: (accountId) => events.push(['invalidateConnection', accountId]),
    syncTiles: () => events.push(['syncTiles']),
    setTab: (tab) => events.push(['setTab', tab]),
    confirm: (message) => { events.push(['confirm', message]); return confirmResult; },
    notify: (message) => events.push(['notify', message]),
    clearAccount: (accountId) => {
      events.push(['clearAccount', accountId]);
      return cleanupReject ? Promise.reject(new Error('cleanup failed')) : Promise.resolve(cleanupResult);
    },
    normalizeAccountOrder,
    resolveDefaultAccountId,
    promoteDefaultAccount,
    setTimeout: (callback, delay) => {
      events.push(['setTimeout', delay]);
      scheduledCleanup = callback;
    },
  });
  return { controller, state, events, buttons, runScheduledCleanup: async () => scheduledCleanup?.() };
}

test('adding an account selects it and preserves game, connection and live synchronization order', async () => {
  const { controller, state, events } = setup();

  const account = controller.addAccount();
  await Promise.resolve();

  assert.deepEqual(account, { id: 'new-id', name: 'Conta 3' });
  assert.equal(state.gameAccount, 'new-id');
  assert.deepEqual(state.accountOrder, ['main', 'alt', 'new-id']);
  assert.deepEqual(events, [
    ['persist'],
    ['setupGame'],
    ['renderAccountTabs'],
    ['refreshConnection', 'new-id'],
    ['syncTiles'],
    ['setTab', 'game'],
    ['syncTiles'],
  ]);
});

test('adding an account skips used default names', () => {
  const { controller, state } = setup({ accounts: [
    { id: 'main', name: 'Conta 1', main: true },
    { id: 'alt', name: 'Conta 2' },
  ] });

  controller.addAccount();

  assert.equal(state.accounts[2].name, 'Conta 3');
});

test('removing a secondary account persists state and reports successful session deletion after teardown', async () => {
  const { controller, state, events, runScheduledCleanup } = setup({ selected: 'alt' });

  await controller.removeAccount();

  assert.deepEqual(state.accounts.map((account) => account.id), ['main']);
  assert.equal(state.gameAccount, 'main');
  assert.equal(state.accountFavorites.alt, undefined);
  assert.equal(state.accountLimits.alt, undefined);
  assert.deepEqual(state.accountOrder, ['main']);
  assert.equal(state.defaultGameAccountId, 'main');
  assert.deepEqual(events, [
    ['confirm', 'Remover "Alternativa"? A aba fecha e o login desta conta no Pokeidle é apagado do app.'],
    ['invalidateConnection', 'alt'],
    ['persist'],
    ['setupGame'],
    ['renderAccountTabs'],
    ['syncTiles'],
    ['setTab', 'game'],
    ['setTimeout', 2000],
  ]);
  await runScheduledCleanup();
  assert.deepEqual(events.slice(-2), [
    ['clearAccount', 'alt'],
    ['notify', 'Dados de sessão da conta "Alternativa" foram removidos.'],
  ]);
});

test('removing a secondary account persists even when it has no account-specific settings', async () => {
  const { controller, events } = setup({ selected: 'alt', accountPreferences: false });
  await controller.removeAccount();
  assert.equal(events.filter(([name]) => name === 'persist').length, 1);
});

test('removing the selected default chooses the first remaining display account', async () => {
  const { controller, state } = setup({ selected: 'alt', defaultAccount: 'alt' });
  await controller.removeAccount();
  assert.equal(state.defaultGameAccountId, 'main');
  assert.equal(state.gameAccount, 'main');
  assert.deepEqual(state.accountOrder, ['main']);
});

test('removing the primary account preserves the shared provider login', async () => {
  const { controller, events } = setup({ selected: 'main' });

  await controller.removeAccount();

  assert.ok(events.some(([name, message]) => name === 'confirm' && message.includes('O login continua salvo, porque é o mesmo das lives.')));
  assert.ok(!events.some(([name]) => name === 'clearAccount'));
  assert.equal(events.filter(([name]) => name === 'persist').length, 1);
});

test('canceling removal or removing the only account makes no changes', async () => {
  const canceled = setup({ selected: 'alt', confirmResult: false });
  await canceled.controller.removeAccount();
  assert.deepEqual(canceled.state.accounts.map((account) => account.id), ['main', 'alt']);
  assert.deepEqual(canceled.events.map(([name]) => name), ['confirm']);

  const onlyAccount = setup({ accounts: [{ id: 'main', name: 'Principal', main: true }] });
  await onlyAccount.controller.removeAccount();
  assert.deepEqual(onlyAccount.events, []);
});

test('failed delayed session cleanup is non-fatal and reports that data may remain', async () => {
  const { controller, events, runScheduledCleanup } = setup({ selected: 'alt', cleanupReject: true });
  await assert.doesNotReject(controller.removeAccount());
  assert.ok(events.some(([name]) => name === 'setTimeout'));
  await runScheduledCleanup();
  assert.deepEqual(events.slice(-2), [
    ['clearAccount', 'alt'],
    ['notify', 'A conta foi removida, mas não foi possível confirmar a limpeza da sessão. Os dados podem permanecer armazenados.'],
  ]);
});

test('cleanup returning false reports failure instead of claiming deletion', async () => {
  const { controller, events, runScheduledCleanup } = setup({ selected: 'alt', cleanupResult: false });
  await controller.removeAccount();
  await runScheduledCleanup();
  assert.equal(events.at(-1)[0], 'notify');
  assert.match(events.at(-1)[1], /dados podem permanecer armazenados/);
});

test('binds add and remove buttons to the existing account lifecycle actions', () => {
  const added = setup();
  added.controller.bind();
  added.buttons.get('#add-account').dispatch('click');
  assert.equal(added.state.gameAccount, 'new-id');
  assert.ok(added.events.some(([name]) => name === 'setupGame'));

  const removed = setup({ selected: 'alt' });
  removed.controller.bind();
  removed.buttons.get('#account-remove').dispatch('click');
  assert.deepEqual(removed.state.accounts.map(account => account.id), ['main']);
  assert.ok(removed.events.some(([name]) => name === 'confirm'));
});
