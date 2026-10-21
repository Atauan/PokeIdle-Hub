'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registerAppLifecycle } = require('../app-lifecycle');

function setup(overrides = {}) {
  const calls = [];
  const listeners = new Map();
  const { app: appOverrides = {}, ...dependencyOverrides } = overrides;
  const app = {
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    on: (event, listener) => listeners.set(event, listener),
    quit: () => calls.push('quit'),
    getPath: name => `/${name}`,
    ...appOverrides,
  };
  let tray = {
    destroyed: false,
    isDestroyed() { return this.destroyed; },
    destroy() { this.destroyed = true; calls.push('destroy-tray'); },
  };
  const dependencies = {
    app,
    startupReady: true,
    lockAcquired: true,
    primaryPartition: 'persist:pokeidlehub',
    portableExecutableDir: '/portable',
    migrateLegacySessions: options => calls.push(['migrate', options]),
    prepareProviderSessions: async () => calls.push('prepare-provider-sessions'),
    setupSession: partition => calls.push(['setup-session', partition]),
    powerSaveBlocker: { start: type => calls.push(['power', type]) },
    createTray: () => calls.push('create-tray'),
    createWindow: () => calls.push('create-window'),
    showWindow: () => calls.push('show-window'),
    isSessionSummaryVisible: () => false,
    updateNotificationService: {
      start: () => calls.push('updates-start'),
      stop: () => calls.push('updates-stop'),
    },
    rotomCockpitService: { closeAll: () => calls.push('rotom-close-all') },
    setQuitting: value => calls.push(['quitting', value]),
    clearTrayClickTimer: () => calls.push('clear-tray-timer'),
    getTray: () => tray,
    setTray: value => { tray = value; calls.push(['set-tray', value]); },
    ...dependencyOverrides,
  };
  registerAppLifecycle(dependencies);
  return { app, calls, listeners, getTray: () => tray };
}

test('second instance shows the app except for a dev-reset invocation', () => {
  const { listeners, calls } = setup();
  listeners.get('second-instance')({}, ['--dev-reset']);
  listeners.get('second-instance')({}, ['--open']);

  assert.deepEqual(calls, ['show-window']);
});

test('packaged startup migrates before session setup, then creates app and starts updates', async () => {
  const { calls, listeners } = setup({ app: { isPackaged: true } });
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(calls, [
    ['migrate', { userDataPath: '/userData', portableExecutableDir: '/portable' }],
    'prepare-provider-sessions',
    ['setup-session', 'persist:pokeidlehub'],
    ['power', 'prevent-app-suspension'],
    ['power', 'prevent-display-sleep'],
    'create-tray',
    'create-window',
    'updates-start',
  ]);
  listeners.get('activate')();
  assert.equal(calls.at(-1), 'show-window');
});

test('development startup preserves the profile and skips packaged session migration and updates', async () => {
  const { calls } = setup();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'migrate'), false);
  assert.equal(calls.includes('prepare-provider-sessions'), false);
  assert.equal(calls.includes('updates-start'), false);
  assert.equal(calls[0][0], 'setup-session');
});

test('packaged QA startup skips legacy migration and automatic updates', async () => {
  const { calls } = setup({ app: { isPackaged: true }, qaBuild: true });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'migrate'), false);
  assert.equal(calls.includes('prepare-provider-sessions'), false);
  assert.equal(calls.includes('updates-start'), false);
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'setup-session'));
});

test('production starts if provider cleanup fails and records only a sanitized warning', async () => {
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const { calls } = setup({
      app: { isPackaged: true },
      prepareProviderSessions: async () => { throw new Error('sensitive path or data'); },
    });
    await new Promise(resolve => setImmediate(resolve));

    assert.ok(calls.includes('create-window'));
    assert.deepEqual(logged, [[
      '[provider-session-cleanup] Limpeza incompleta; nova tentativa no próximo início.',
    ]]);
  } finally {
    console.error = originalError;
  }
});

test('startup stops before side effects if startup readiness or lock acquisition failed', async () => {
  for (const values of [{ startupReady: false }, { lockAcquired: false }]) {
    const { calls } = setup(values);
    await Promise.resolve();
    assert.deepEqual(calls, []);
  }
});

test('application shutdown retains tray timer, updater and cockpit cleanup behavior', () => {
  const { listeners, calls, getTray } = setup();
  listeners.get('before-quit')();
  listeners.get('will-quit')();

  assert.deepEqual(calls, [
    ['quitting', true],
    'clear-tray-timer',
    'updates-stop',
    'rotom-close-all',
    'destroy-tray',
    ['set-tray', null],
  ]);
  assert.equal(getTray(), null);
});

test('main delegates app lifecycle, packages cleanup modules and prepares provider sessions', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /registerAppLifecycle\(\{[\s\S]*?primaryPartition: PARTITION,[\s\S]*?setupSession,[\s\S]*?updateNotificationService,[\s\S]*?rotomCockpitService/);
  assert.match(main, /qaBuild: QA_BUILD/);
  assert.match(main, /prepareProviderSessions: \(\) => providerSessionCleanup\.clearStaleProviderData\(app\.getPath\('userData'\)\)/);
  assert.doesNotMatch(main, /app\.whenReady\(\)|app\.on\('(second-instance|window-all-closed|before-quit|will-quit)'/);
  assert.ok(packageJson.build.files.includes('app-lifecycle.js'));
  assert.ok(packageJson.build.files.includes('provider-session-cleanup.js'));
});
