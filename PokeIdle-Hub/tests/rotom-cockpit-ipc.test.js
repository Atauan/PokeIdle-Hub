'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registerRotomCockpitHandlers } = require('../rotom-cockpit-ipc');

function setup({ authorized = true } = {}) {
  const handlers = new Map();
  const listeners = new Map();
  const calls = [];
  const service = {
    openCockpit: (...args) => { calls.push(['openCockpit', ...args]); return { ok: true }; },
    forwardToGame: (...args) => { calls.push(['forwardToGame', ...args]); return true; },
    forwardFromGame: (...args) => { calls.push(['forwardFromGame', ...args]); return true; },
  };
  registerRotomCockpitHandlers({
    ipcMain: {
      handle: (channel, callback) => handlers.set(channel, callback),
      on: (channel, callback) => listeners.set(channel, callback),
    },
    isMainWindowAuthorized: () => authorized,
    rotomCockpitService: service,
  });
  return { handlers, listeners, calls };
}

test('cockpit open is authorized and validates its account payload before delegating', async () => {
  const { handlers, calls } = setup();
  const event = {};

  assert.deepEqual(await handlers.get('open-rotom-cockpit')(event, { accId: 'a1', accName: 'Conta' }), { ok: true });
  assert.deepEqual(calls, [['openCockpit', 'a1', 'Conta']]);
  assert.deepEqual(await handlers.get('open-rotom-cockpit')(event, { accId: 1, accName: 'Conta' }), { ok: false, error: 'Invalid payload' });
  assert.equal(calls.length, 1);
});

test('cockpit open rejects unauthorized callers without invoking the service', async () => {
  const { handlers, calls } = setup({ authorized: false });

  assert.deepEqual(await handlers.get('open-rotom-cockpit')({}, { accId: 'a1', accName: 'Conta' }), { ok: false, error: 'Unauthorized' });
  assert.deepEqual(calls, []);
});

test('cockpit message routes preserve their existing service delegation', () => {
  const { listeners, calls } = setup();
  const event = { sender: 'cockpit' };
  const payload = { accId: 'a1', message: { type: 'status' } };
  const data = { type: 'status' };

  listeners.get('rotom-to-game')(event, payload);
  listeners.get('rotom-from-webview')({ authorized: true }, { accId: 'a1', data });

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'forwardToGame');
  assert.equal(calls[0][1], event);
  assert.equal(calls[0][2], payload);
  assert.deepEqual(calls[1], ['forwardFromGame', 'a1', data]);
});

test('main composes and packages the cockpit IPC handlers', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /registerRotomCockpitHandlers\(\{[\s\S]*?isMainWindowAuthorized: fromMainWindow,[\s\S]*?rotomCockpitService/);
  assert.doesNotMatch(main, /ipcMain\.(?:handle|on)\('(?:open-rotom-cockpit|rotom-to-game|rotom-from-webview)'/);
  assert.ok(packageJson.build.files.includes('rotom-cockpit-ipc.js'));
});
