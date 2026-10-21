'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createUpdateNotificationService } = require('../update-notification-service');

function setup({ settings = '["3.0.0"]', supported = true } = {}) {
  let timerCallback = null;
  let intervalDelay = null;
  let clearedTimer = null;
  const writes = [];
  const notifications = [];
  const windowMessages = [];
  const release = {
    state: { status: 'current', release: null },
    checks: 0,
    check() { this.checks += 1; return Promise.resolve(this.state); },
    getState() { return this.state; },
  };
  class FakeNotification {
    static isSupported = () => supported;
    constructor(options) { this.options = options; notifications.push(this); }
    on(event, listener) { if (event === 'click') this.onClick = listener; }
    show() { this.shown = true; }
  }
  const service = createUpdateNotificationService({
    createReleaseChecker: options => { release.options = options; return release; },
    currentVersion: '3.1.0',
    getSettingsFile: () => 'settings.json',
    settingsFile: 'settings.json',
    readFileSync: () => settings,
    writeFileSync: (...args) => writes.push(args),
    Notification: FakeNotification,
    shell: { openExternal: url => { windowMessages.push(['external', url]); return Promise.resolve(); } },
    getMainWindow: () => ({ isDestroyed: () => false, webContents: { send: (...args) => windowMessages.push(args) } }),
    setIntervalFn: (callback, delay) => { timerCallback = callback; intervalDelay = delay; return 'timer-id'; },
    clearIntervalFn: id => { clearedTimer = id; },
  });
  return { service, release, writes, notifications, windowMessages, get timerCallback() { return timerCallback; }, get intervalDelay() { return intervalDelay; }, get clearedTimer() { return clearedTimer; } };
}

test('starts one release checker, reports changes, and checks hourly', async () => {
  const context = setup();
  context.service.start();
  context.service.start();
  assert.equal(context.release.options.currentVersion, '3.1.0');
  assert.deepEqual(context.release.options.notifiedVersions, ['3.0.0']);
  assert.equal(context.intervalDelay, 60 * 60 * 1000);
  assert.equal(context.release.checks, 1);
  await context.release.options.onChange({ status: 'available' });
  assert.deepEqual(context.windowMessages, [['update-state', { status: 'available' }]]);
  context.timerCallback();
  assert.equal(context.release.checks, 2);
  assert.equal(context.service.getState(), context.release.state);
  assert.equal(await context.service.check(), context.release.state);
  assert.equal(context.release.checks, 3);
});

test('persists notified versions and opens the release URL from a supported notification', async () => {
  const context = setup();
  context.service.start();
  context.release.options.persistNotified(['3.2.0']);
  assert.deepEqual(context.writes, [['settings.json', '["3.2.0"]']]);
  context.release.options.onAvailable({ version: '3.2.0', url: 'https://example.test/release' });
  assert.deepEqual(context.notifications[0].options, {
    title: 'Atualização do PokeIdle Hub',
    body: 'A versão 3.2.0 está disponível. Clique para ver a release.',
  });
  assert.equal(context.notifications[0].shown, true);
  await context.notifications[0].onClick();
  assert.deepEqual(context.windowMessages, [['external', 'https://example.test/release']]);
});

test('ignores unavailable notification support and stops its timer', () => {
  const context = setup({ supported: false, settings: '{invalid' });
  context.service.start();
  context.release.options.onAvailable({ version: '3.2.0', url: 'https://example.test/release' });
  assert.equal(context.notifications.length, 0);
  context.service.stop();
  assert.equal(context.clearedTimer, 'timer-id');
  context.service.stop();
  assert.equal(context.clearedTimer, 'timer-id');
});
