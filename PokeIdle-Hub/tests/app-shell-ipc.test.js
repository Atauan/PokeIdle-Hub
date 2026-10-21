'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registerAppShellHandlers } = require('../app-shell-ipc');

function setup(overrides = {}) {
  const events = new Map();
  const invocations = new Map();
  const calls = [];
  const dependencies = {
    ipcMain: {
      on: (channel, callback) => events.set(channel, callback),
      handle: (channel, callback) => invocations.set(channel, callback),
    },
    isAuthorized: event => event.sender === 'main',
    isDevelopment: false,
    showAbout: () => calls.push('show-about'),
    updateNotificationService: {
      getState: () => ({ status: 'available' }),
      check: () => ({ status: 'checking' }),
    },
    ...overrides,
  };
  registerAppShellHandlers(dependencies);
  return { events, invocations, calls };
}

test('open-about delegates only for the authorized main window', () => {
  const { events, calls } = setup();
  events.get('open-about')({ sender: 'other' });
  events.get('open-about')({ sender: 'main' });

  assert.deepEqual(calls, ['show-about']);
});

test('update state and checks remain production-only and require the main window', async () => {
  const { invocations } = setup();
  const getState = invocations.get('update-state');
  const check = invocations.get('check-updates');

  assert.deepEqual(await getState({ sender: 'main' }), { status: 'available' });
  assert.deepEqual(await check({ sender: 'main' }), { status: 'checking' });
  assert.equal(await getState({ sender: 'other' }), null);
  assert.equal(await check({ sender: 'other' }), null);

  const development = setup({ isDevelopment: true });
  assert.equal(await development.invocations.get('update-state')({ sender: 'main' }), null);
  assert.equal(await development.invocations.get('check-updates')({ sender: 'main' }), null);
});

test('app-environment reports development only to the authorized main window', () => {
  const { invocations } = setup({ isDevelopment: true });
  assert.deepEqual(invocations.get('app-environment')({ sender: 'main' }), { isDevelopment: true });
  assert.equal(invocations.get('app-environment')({ sender: 'other' }), null);
});

test('main composes app shell handlers with the extracted About window and packages the module', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /registerAppShellHandlers\(\{[\s\S]*?isAuthorized: fromMainWindow,[\s\S]*?showAbout: aboutWindowService\.show,[\s\S]*?updateNotificationService/);
  for (const channel of ['open-about', 'update-state', 'app-environment', 'check-updates']) {
    assert.doesNotMatch(main, new RegExp(`ipcMain\\.(?:on|handle)\\('${channel}'`));
  }
  assert.ok(packageJson.build.files.includes('app-shell-ipc.js'));
});
