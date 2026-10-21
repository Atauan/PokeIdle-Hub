'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registerMainWindowCommandHandlers } = require('../main-window-command-ipc');

function setup(overrides = {}) {
  const handlers = new Map();
  const calls = [];
  const deps = {
    ipcMain: { on: (channel, handler) => handlers.set(channel, handler) },
    isMainWindowAuthorized: event => event.sender === 'main',
    isTrustedAppSender: event => event.local === true,
    platform: 'win32',
    app: { quit: () => calls.push(['quit']) },
    shell: {
      showItemInFolder: value => calls.push(['showItemInFolder', value]),
      openExternal: value => { calls.push(['openExternal', value]); return Promise.resolve(); },
    },
    spawn: (...args) => {
      calls.push(['spawn', ...args]);
      return { on: () => {} };
    },
    ...overrides,
  };
  registerMainWindowCommandHandlers(deps);
  return { handlers, calls };
}

test('show-in-folder and quit-app require the authorized main window', () => {
  const { handlers, calls } = setup();
  handlers.get('show-in-folder')({ sender: 'other' }, 'C:\\safe.txt');
  handlers.get('show-in-folder')({ sender: 'main' }, 'C:\\safe.txt');
  handlers.get('show-in-folder')({ sender: 'main' }, '');
  handlers.get('quit-app')({ sender: 'other' });
  handlers.get('quit-app')({ sender: 'main' });

  assert.deepEqual(calls, [['showItemInFolder', 'C:\\safe.txt'], ['quit']]);
});

test('open-edge rejects untrusted senders and URLs outside its existing allowlist', () => {
  const { handlers, calls } = setup();
  handlers.get('open-edge')({ local: false }, 'https://twitch.tv/channel');
  handlers.get('open-edge')({ local: true }, 'https://example.com/channel');
  handlers.get('open-edge')({ local: true }, 'javascript:alert(1)');

  assert.deepEqual(calls, []);
});

test('open-edge uses the platform-specific launch behavior for an allowed URL', () => {
  const { handlers, calls } = setup();
  const url = 'https://twitch.tv/channel';
  handlers.get('open-edge')({ local: true }, url);

  assert.deepEqual(calls, [['openExternal', `microsoft-edge:${url}`]]);
});

test('Windows falls back to the default browser when its Edge protocol fails', async () => {
  const calls = [];
  const { handlers } = setup({
    shell: { openExternal: url => {
      calls.push(url);
      return url.startsWith('microsoft-edge:') ? Promise.reject(new Error('unavailable')) : Promise.resolve();
    } },
  });
  const url = 'https://pokeidle.io/app';
  handlers.get('open-edge')({ local: true }, url);
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(calls, [`microsoft-edge:${url}`, url]);
});

test('Linux opens an allowed URL in the default browser', () => {
  const calls = [];
  const { handlers } = setup({
    platform: 'linux',
    shell: { openExternal: url => { calls.push(url); return Promise.resolve(); } },
  });
  const url = 'https://kick.com/channel';
  handlers.get('open-edge')({ local: true }, url);

  assert.deepEqual(calls, [url]);
});

test('macOS open-edge falls back to the default browser when Edge cannot launch', () => {
  const calls = [];
  const { handlers } = setup({
    platform: 'darwin',
    spawn: (...args) => {
      calls.push(['spawn', ...args]);
      return { on: (event, callback) => { if (event === 'error') callback(new Error('unavailable')); } };
    },
    shell: { openExternal: url => { calls.push(['openExternal', url]); } },
  });
  const url = 'https://kick.com/channel';
  handlers.get('open-edge')({ local: true }, url);

  assert.deepEqual(calls, [
    ['spawn', 'open', ['-a', 'Microsoft Edge', url], { stdio: 'ignore' }],
    ['openExternal', url],
  ]);
});

test('main composes and packages the window command IPC handlers', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /registerMainWindowCommandHandlers\(\{[\s\S]*?isMainWindowAuthorized: fromMainWindow,[\s\S]*?isTrustedAppSender: fromApp/);
  for (const channel of ['show-in-folder', 'quit-app', 'open-edge']) {
    assert.doesNotMatch(main, new RegExp(`ipcMain\\.on\\('${channel}'`));
  }
  assert.ok(packageJson.build.files.includes('main-window-command-ipc.js'));
});
