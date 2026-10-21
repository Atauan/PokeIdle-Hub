'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isAdditionalPartition } = require('../account-partition');
const { registerProviderConnectionHandlers } = require('../provider-connection-ipc');

const root = path.join(__dirname, '..');
const primaryPartition = 'persist:pokeidlehub';

function setup() {
  const listeners = new Map();
  const handlers = new Map();
  const calls = { sessions: [], logins: [], statuses: [], clears: [], traces: [], logs: [] };
  const providerConnectionService = {
    checkConnections: async partition => {
      calls.statuses.push(partition);
      return { twitch: true, kick: false, unavailableProviders: [] };
    },
    clearConnection: async (platform, partition) => {
      calls.clears.push([platform, partition]);
      return true;
    },
  };
  registerProviderConnectionHandlers({
    ipcMain: {
      on: (channel, listener) => listeners.set(channel, listener),
      handle: (channel, listener) => handlers.set(channel, listener),
    },
    primaryPartition,
    isAdditionalPartition,
    isTrustedSender: event => event?.trusted === true,
    setupSession: partition => calls.sessions.push(partition),
    loginWindowService: {
      openLoginWindow: (...args) => calls.logins.push(args),
    },
    providerConnectionService,
    createFlowId: () => '123e4567-e89b-12d3-a456-426614174000',
    logStage: entry => calls.logs.push(entry),
  });
  return { listeners, handlers, calls };
}

test('opens Twitch and Kick logins only from the trusted app and sets the same partition first', () => {
  const { listeners, calls } = setup();
  const openLogin = listeners.get('open-login');
  const sender = { messages: [], send(channel, payload) { this.messages.push([channel, payload]); } };
  openLogin({ trusted: false, sender }, 'twitch', 'persist:pokeidlehub-acc-alt', 'Conta secundária');
  openLogin({ trusted: true, sender }, 'google', 'persist:pokeidlehub', 'Conta principal');
  openLogin({ trusted: true, sender }, 'twitch', 'persist:pokeidlehub-acc-alt', ` ${'A'.repeat(40)} `);
  openLogin({ trusted: true, sender }, 'kick', 'malformed-partition', 'Conta 2');

  assert.deepEqual(calls.sessions, ['persist:pokeidlehub-acc-alt', primaryPartition]);
  assert.equal(calls.logins.length, 2);
  assert.deepEqual(calls.logins.map(args => args.slice(0, 4)), [
    ['https://www.twitch.tv/login', `Entrar na Twitch (${`${'A'.repeat(30)}`})`, 'persist:pokeidlehub-acc-alt', 'twitch'],
    ['https://kick.com/', 'Entrar na Kick (Conta 2)', primaryPartition, 'kick'],
  ]);
  const flowOptions = calls.logins[0][4];
  assert.equal(flowOptions.flowId, '123e4567-e89b-12d3-a456-426614174000');
  flowOptions.reportStage('navigation_started');
  assert.deepEqual(sender.messages.map(([channel, payload]) => [channel, payload.stage, payload.provider]), [
    ['login-flow-stage', 'request_received', 'twitch'],
    ['login-flow-stage', 'session_ready', 'twitch'],
    ['login-flow-stage', 'request_received', 'kick'],
    ['login-flow-stage', 'session_ready', 'kick'],
    ['login-flow-stage', 'navigation_started', 'twitch'],
  ]);
  assert.equal(calls.logs.some(entry => JSON.stringify(entry).includes('Conta')), false);
  assert.equal(calls.logs.every(entry => entry.flowId === '123e4567-e89b-12d3-a456-426614174000'), true);
});

test('opens game login only from the trusted app and uses the requested account partition', () => {
  const { listeners, calls } = setup();
  const openGameLogin = listeners.get('open-game-login');
  const sender = { messages: [], send(channel, payload) { this.messages.push([channel, payload]); } };
  openGameLogin({ trusted: false, sender }, 'persist:pokeidlehub-acc-secondary');
  openGameLogin({ trusted: true, sender }, 'persist:pokeidlehub-acc-secondary');
  openGameLogin({ trusted: true, sender }, 'invalid');

  assert.deepEqual(calls.sessions, ['persist:pokeidlehub-acc-secondary', primaryPartition]);
  assert.equal(calls.logins.length, 2);
  assert.deepEqual(calls.logins.map(args => args.slice(0, 4)), [
    ['https://pokeidle.io/app', 'Entrar no Pokeidle', 'persist:pokeidlehub-acc-secondary', 'game'],
    ['https://pokeidle.io/app', 'Entrar no Pokeidle', primaryPartition, 'game'],
  ]);
});

test('connection status rejects untrusted senders and falls back to the primary partition', async () => {
  const { handlers, calls } = setup();
  const check = handlers.get('check-connections');

  assert.deepEqual(await check({ trusted: false }, 'persist:pokeidlehub-acc-alt'), {
    twitch: false, kick: false, unavailableProviders: ['twitch', 'kick'],
  });
  assert.deepEqual(await check({ trusted: true }, 'malformed'), {
    twitch: true, kick: false, unavailableProviders: [],
  });
  assert.deepEqual(await check({ trusted: true }, 'persist:pokeidlehub-acc-alt'), {
    twitch: true, kick: false, unavailableProviders: [],
  });
  assert.deepEqual(calls.statuses, [primaryPartition, 'persist:pokeidlehub-acc-alt']);
});

test('connection clearing validates sender, platform and partition before delegating', async () => {
  const { handlers, calls } = setup();
  const clear = handlers.get('clear-connection');

  assert.equal(await clear({ trusted: false }, 'twitch', 'persist:pokeidlehub'), false);
  assert.equal(await clear({ trusted: true }, 'google', primaryPartition), false);
  assert.equal(await clear({ trusted: true }, 'kick', 'malformed'), false);
  assert.equal(await clear({ trusted: true }, 'twitch', 'persist:pokeidlehub-acc-alt'), true);
  assert.equal(await clear({ trusted: true }, 'kick', null), true);
  assert.deepEqual(calls.clears, [
    ['twitch', 'persist:pokeidlehub-acc-alt'],
    ['kick', primaryPartition],
  ]);
});

test('main delegates provider IPC registration and packages the service module', () => {
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /registerProviderConnectionHandlers\(/);
  assert.doesNotMatch(main, /ipcMain\.(?:on|handle)\('(open-login|open-game-login|check-connections|clear-connection)'/);
  assert.ok(packageJson.build.files.includes('provider-connection-ipc.js'));
});
