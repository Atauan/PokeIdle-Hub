'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerNotificationHandlers } = require('../notification-service');

function setup({ platform = 'win32', supported = true, quitting = false } = {}) {
  const handlers = new Map();
  const sent = [];
  const notifications = [];
  const effects = { shown: 0, dock: [], flash: [] };
  const mainWindow = {
    webContents: { send: (...args) => sent.push(args) },
    isFocused: () => false,
    flashFrame: value => effects.flash.push(value),
  };
  class FakeNotification {
    static isSupported = () => supported;
    constructor(options) { this.options = options; notifications.push(this); }
    on(event, listener) { if (event === 'click') this.onClick = listener; }
    show() { effects.shown += 1; }
  }
  const app = { dock: { bounce: type => effects.dock.push(type) } };
  registerNotificationHandlers({
    ipcMain: { on: (channel, handler) => handlers.set(channel, handler) },
    Notification: FakeNotification,
    app,
    platform,
    isTrustedSender: event => event.trusted === true,
    isQuitting: () => quitting,
    showWindow: () => { effects.showWindow = (effects.showWindow || 0) + 1; },
    getMainWindow: () => mainWindow,
  });
  return { handlers, sent, effects, mainWindow, notifications };
}

test('notification ignores untrusted sender and unsupported platform', () => {
  const untrusted = setup();
  untrusted.handlers.get('notify')({ trusted: false }, { title: 'title', body: 'body' });
  assert.equal(untrusted.effects.shown, 0);

  const unsupported = setup({ supported: false });
  unsupported.handlers.get('notify')({ trusted: true }, { title: 'title', body: 'body' });
  assert.equal(unsupported.effects.shown, 0);
});

test('notification bounds text and opens the game tab on click', () => {
  const context = setup();
  context.handlers.get('notify')({ trusted: true }, { title: 't'.repeat(130), body: 'b'.repeat(310) });
  assert.equal(context.effects.shown, 1);
  assert.equal(context.notifications[0].options.title, 't'.repeat(120));
  assert.equal(context.notifications[0].options.body, 'b'.repeat(300));
  context.notifications[0].onClick();
  assert.equal(context.effects.showWindow, 1);
  assert.deepEqual(context.sent, [['open-tab', 'game']]);

  const closing = setup({ quitting: true });
  closing.handlers.get('notify')({ trusted: true }, { title: 'title', body: 'body' });
  closing.notifications[0].onClick();
  assert.equal(closing.effects.showWindow, undefined);
});

test('attention uses the platform-specific signal and requires a trusted sender', () => {
  const windows = setup();
  windows.handlers.get('attention')({ trusted: true });
  windows.handlers.get('attention')({ trusted: false });
  assert.deepEqual(windows.effects.flash, [true]);

  const mac = setup({ platform: 'darwin' });
  mac.handlers.get('attention')({ trusted: true });
  assert.deepEqual(mac.effects.dock, ['informational']);
  assert.deepEqual(mac.effects.flash, []);
});
