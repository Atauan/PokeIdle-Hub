'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadPreloadApi() {
  const source = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  let exposedApi;
  const listeners = new Map();
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, api) {
        assert.equal(name, 'pf');
        exposedApi = api;
      },
    },
    ipcRenderer: {
      send() {},
      invoke() { return Promise.resolve(); },
      on(channel, callback) { listeners.set(channel, callback); },
    },
  };
  vm.runInNewContext(source, {
    require: (name) => {
      if (name === 'electron') return electron;
      assert.fail(`Unexpected preload dependency: ${name}`);
    },
    process: { platform: 'win32' },
  }, { filename: 'preload.js' });
  return { api: exposedApi, listeners };
}

test('preload forwards valid login-close events to the renderer without exposing Electron objects', () => {
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'renderer', 'provider-connection-controller.js'), 'utf8');
  const { api, listeners } = loadPreloadApi();

  assert.match(main, /onClosed: \(closedWindow, \{ platform, partition, flowId \}\) =>/);
  assert.match(main, /send\('login-window-closed', \{ platform, partition, flowId \}\)/);
  assert.match(fs.readFileSync(path.join(root, 'login-window-service.js'), 'utf8'), /onClosed\(window, \{ platform, partition, flowId \}\)/);
  assert.match(renderer, /PokeIdleProviderConnectionController\.createProviderConnectionController\(/);
  assert.match(renderer, /providerConnectionController\.bind\(\)/);
  assert.match(controller, /loginApi\.onLoginClosed\(handleLoginClosed\)/);
  assert.match(controller, /connections\.invalidate\(affected\.id\)[\s\S]*?connections\.read\(affected, \{ refresh: true \}\)[\s\S]*?status_refresh_completed[\s\S]*?syncTiles\(\)/);
  assert.match(controller, /loginApi\?\.onLoginTrace\?\.\(entry => log\('\[auth-flow\]', entry\)\)/);
  assert.equal(typeof api.onLoginClosed, 'function');
  assert.equal(typeof api.onLoginTrace, 'function');

  const received = [];
  api.onLoginClosed((payload) => received.push(payload));
  const flowId = '123e4567-e89b-12d3-a456-426614174000';
  const onClosed = listeners.get('login-window-closed');
  onClosed({ privateElectronEvent: true }, { platform: 'unknown', partition: 'persist:pokeidlehub' });
  onClosed({ privateElectronEvent: true }, { platform: 'twitch', partition: 'persist:pokeidlehub-acc-invalid_id' });
  onClosed({ privateElectronEvent: true }, { platform: 'twitch', partition: 'persist:pokeidlehub-acc-test', flowId });
  onClosed({ privateElectronEvent: true }, { platform: 'kick', partition: 'persist:pokeidlehub', flowId });
  onClosed({ privateElectronEvent: true }, { platform: 'game', partition: 'persist:pokeidlehub-acc-secondary', flowId });

  assert.deepEqual(received.map((payload) => ({ ...payload })), [
    { platform: 'twitch', partition: 'persist:pokeidlehub-acc-test', flowId },
    { platform: 'kick', partition: 'persist:pokeidlehub', flowId },
    { platform: 'game', partition: 'persist:pokeidlehub-acc-secondary', flowId },
  ]);

  const traces = [];
  api.onLoginTrace(entry => traces.push(entry));
  const onTrace = listeners.get('login-flow-stage');
  onTrace({ privateElectronEvent: true }, { flowId, provider: 'twitch', stage: 'navigation_failed', errorCode: -105, password: 'redacted' });
  onTrace({ privateElectronEvent: true }, { flowId, provider: 'twitch', stage: 'unknown', errorCode: -105 });
  onTrace({ privateElectronEvent: true }, { flowId: 'invalid', provider: 'twitch', stage: 'window_created' });
  assert.deepEqual(traces.map(entry => ({ ...entry })), [
    { flowId, provider: 'twitch', stage: 'navigation_failed', errorCode: -105 },
  ]);
});
