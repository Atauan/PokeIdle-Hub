'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRotomCockpitService } = require('../rotom-cockpit-service');

class FakeBrowserWindow {
  static created = [];

  constructor(options) {
    this.options = options;
    this.listeners = new Map();
    this.webContents = {
      mainFrame: {},
      sent: [],
      send: (channel, payload) => this.webContents.sent.push([channel, payload]),
    };
    this.visible = false;
    this.focused = false;
    this.minimized = false;
    this.loadedUrl = null;
    this.destroyed = false;
    this.closeCount = 0;
    FakeBrowserWindow.created.push(this);
  }

  once(event, callback) { this.listeners.set(`once:${event}`, callback); }
  on(event, callback) { this.listeners.set(event, callback); }
  emit(event, ...args) {
    const callback = this.listeners.get(event) || this.listeners.get(`once:${event}`);
    this.listeners.delete(`once:${event}`);
    callback?.(...args);
  }
  isDestroyed() { return this.destroyed; }
  isMinimized() { return this.minimized; }
  restore() { this.minimized = false; }
  show() { this.visible = true; }
  focus() { this.focused = true; }
  close() { this.closeCount += 1; }
  loadURL(url) { this.loadedUrl = url; }
}

function setup() {
  FakeBrowserWindow.created = [];
  const mainWindow = {
    destroyed: false,
    webContents: {
      sent: [],
      send(channel, payload) { this.sent.push([channel, payload]); },
    },
    isDestroyed() { return this.destroyed; },
  };
  const service = createRotomCockpitService({
    BrowserWindow: FakeBrowserWindow,
    assetDirectory: 'C:/app/assets/addons/rotom-sniper',
    getAppIcon: () => 'icon',
    getMainWindow: () => mainWindow,
  });
  return { service, mainWindow };
}

test('opens a per-account cockpit with the existing secure window options and URL', () => {
  const { service } = setup();

  assert.deepEqual(service.openCockpit('account-1', 'Conta Um'), { ok: true, created: true });
  const cockpit = FakeBrowserWindow.created[0];

  assert.equal(cockpit.options.width, 1160);
  assert.equal(cockpit.options.height, 760);
  assert.equal(cockpit.options.minWidth, 900);
  assert.equal(cockpit.options.minHeight, 600);
  assert.equal(cockpit.options.webPreferences.contextIsolation, true);
  assert.equal(cockpit.options.webPreferences.nodeIntegration, false);
  assert.equal(cockpit.options.webPreferences.sandbox, false);
  assert.equal(cockpit.loadedUrl, 'file://C:/app/assets/addons/rotom-sniper/cockpit.html?acc=account-1&name=Conta%20Um');
});

test('focuses an existing cockpit and restores it when minimized', () => {
  const { service } = setup();
  service.openCockpit('account-1', 'Conta Um');
  const cockpit = FakeBrowserWindow.created[0];
  cockpit.minimized = true;

  assert.deepEqual(service.openCockpit('account-1', 'Conta Um'), { ok: true, focused: true });
  assert.equal(FakeBrowserWindow.created.length, 1);
  assert.equal(cockpit.minimized, false);
  assert.equal(cockpit.visible, true);
  assert.equal(cockpit.focused, true);
});

test('shows the window when ready and removes only its own current map entry on close', () => {
  const { service } = setup();
  service.openCockpit('account-1', 'Conta Um');
  const first = FakeBrowserWindow.created[0];
  first.emit('ready-to-show');
  assert.equal(first.visible, true);
  assert.equal(first.focused, true);

  first.destroyed = true;
  service.openCockpit('account-1', 'Conta Um');
  const replacement = FakeBrowserWindow.created[1];
  first.emit('closed');

  assert.equal(service.forwardFromGame('account-1', { type: 'SYNC' }), true);
  assert.deepEqual(replacement.webContents.sent, [['rotom-from-game', { type: 'SYNC' }]]);
});

test('routes cockpit messages only from the matching account main frame', () => {
  const { service, mainWindow } = setup();
  service.openCockpit('account-1', 'Conta Um');
  service.openCockpit('account-2', 'Conta Dois');
  const first = FakeBrowserWindow.created[0];
  const message = { type: 'STORAGE_SET', data: { key: 'value' } };

  assert.equal(service.forwardToGame({ sender: first.webContents, senderFrame: first.webContents.mainFrame }, { accId: 'account-1', message }), true);
  assert.equal(service.forwardToGame({ sender: first.webContents, senderFrame: first.webContents.mainFrame }, { accId: 'account-2', message }), false);
  assert.equal(service.forwardToGame({ sender: first.webContents, senderFrame: {} }, { accId: 'account-1', message }), false);

  assert.deepEqual(mainWindow.webContents.sent, [['rotom-forward-to-game', { accId: 'account-1', message }]]);
});

test('routes game updates only to the matching open account cockpit', () => {
  const { service } = setup();
  service.openCockpit('account-1', 'Conta Um');
  service.openCockpit('account-2', 'Conta Dois');
  const data = { type: 'INIT', value: 1 };

  assert.equal(service.forwardFromGame('account-2', data), true);
  assert.deepEqual(FakeBrowserWindow.created[0].webContents.sent, []);
  assert.deepEqual(FakeBrowserWindow.created[1].webContents.sent, [['rotom-from-game', data]]);
  assert.equal(service.forwardFromGame('missing', data), false);
  assert.equal(service.forwardFromGame('account-2', []), false);
});

test('closes and clears all cockpit windows during app shutdown', () => {
  const { service } = setup();
  service.openCockpit('account-1', 'Conta Um');
  service.openCockpit('account-2', 'Conta Dois');

  service.closeAll();

  assert.deepEqual(FakeBrowserWindow.created.map((window) => window.closeCount), [1, 1]);
  assert.equal(service.forwardFromGame('account-1', { type: 'SYNC' }), false);
});
