'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createSessionSummaryService } = require('../session-summary-service');

class FakeBrowserWindow {
  static created = [];

  constructor(options) {
    this.options = options;
    this.listeners = new Map();
    this.webContents = {
      mainFrame: {},
      sent: [],
      setWindowOpenHandler: handler => { this.openHandler = handler; },
      on: (event, listener) => this.webContents.listeners.set(event, listener),
      listeners: new Map(),
      executeJavaScript: async script => { this.executedScript = script; return { accounts: ['alpha'] }; },
    };
    this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
    this.visible = false;
    this.destroyed = false;
    FakeBrowserWindow.created.push(this);
  }

  once(event, listener) { this.listeners.set(`once:${event}`, listener); }
  on(event, listener) { this.listeners.set(event, listener); }
  emit(event, ...args) {
    const key = this.listeners.has(event) ? event : `once:${event}`;
    const listener = this.listeners.get(key);
    if (key.startsWith('once:')) this.listeners.delete(key);
    listener?.(...args);
  }
  setMenu(value) { this.menu = value; }
  loadFile(file) { this.file = file; }
  setBounds(bounds) { this.bounds = bounds; }
  show() { this.visible = true; }
  hide() { this.visible = false; }
  focus() { this.focused = true; }
  isVisible() { return this.visible; }
  isDestroyed() { return this.destroyed; }
}

function setup({ quitting = false, mainVisible = false, executeJavaScript } = {}) {
  FakeBrowserWindow.created = [];
  const handlers = new Map();
  const listeners = new Map();
  const timeouts = [];
  const cleared = [];
  const mainWindow = {
    isVisible: () => mainVisible,
    isMinimized: () => false,
    isDestroyed: () => false,
    webContents: { mainFrame: {}, executeJavaScript: executeJavaScript || (async function collect(script) { mainWindow.webContents.executedScript = script; return { accounts: ['alpha'] }; }) },
  };
  const tray = { getBounds: () => ({ x: 1600, y: 20, width: 40, height: 20 }) };
  const service = createSessionSummaryService({
    ipcMain: {
      handle: (channel, handler) => handlers.set(channel, handler),
      on: (channel, handler) => handlers.set(channel, handler),
    },
    BrowserWindow: FakeBrowserWindow,
    screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
    getTray: () => tray,
    getMainWindow: () => mainWindow,
    isQuitting: () => quitting,
    showMainWindow: () => { listeners.mainShown = (listeners.mainShown || 0) + 1; },
    appDirectory: 'C:/PokeIdle',
    setTimeoutFn: (callback, delay) => { timeouts.push({ callback, delay }); return `timer-${timeouts.length}`; },
    clearTimeoutFn: timer => cleared.push(timer),
  });
  return { service, handlers, listeners, timeouts, cleared, mainWindow };
}

test('creates secure summary window at the tray and repositions/reuses it', () => {
  const context = setup();
  context.service.show();
  const panel = FakeBrowserWindow.created[0];
  assert.deepEqual(panel.bounds, { x: 1220, y: 48, width: 420, height: 680 });
  assert.equal(panel.options.frame, false);
  assert.equal(panel.options.webPreferences.preload, path.join('C:/PokeIdle', 'session-preload.js'));
  assert.equal(panel.options.webPreferences.sandbox, true);
  assert.equal(panel.file, path.join('C:/PokeIdle', 'renderer', 'session.html'));
  assert.deepEqual(panel.openHandler({ url: 'https://example.test' }), { action: 'deny' });
  let navigationPrevented = false;
  panel.webContents.listeners.get('will-navigate')({ preventDefault: () => { navigationPrevented = true; } });
  assert.equal(navigationPrevented, true);
  const before = FakeBrowserWindow.created.length;
  context.service.show();
  assert.equal(FakeBrowserWindow.created.length, before);
  assert.equal(panel.visible, true);
  assert.equal(panel.focused, true);
});

test('ready-to-show only reveals the panel when the main app is hidden', () => {
  const hiddenMain = setup();
  hiddenMain.service.show();
  const panel = FakeBrowserWindow.created[0];
  panel.emit('ready-to-show');
  assert.equal(panel.visible, true);

  const visibleMain = setup({ mainVisible: true });
  visibleMain.service.show();
  const secondPanel = FakeBrowserWindow.created[0];
  secondPanel.emit('ready-to-show');
  assert.equal(secondPanel.visible, false);
});

test('session IPC validates summary main frame and opens or closes the correct windows', async () => {
  const context = setup();
  context.service.show();
  const panel = FakeBrowserWindow.created[0];
  const authorized = { sender: panel.webContents, senderFrame: panel.webContents.mainFrame };
  const unauthorized = { sender: panel.webContents, senderFrame: {} };
  assert.deepEqual(await context.handlers.get('session-summary')(authorized), { accounts: ['alpha'] });
  assert.equal(context.mainWindow.webContents.executedScript, 'window.__pfCollectSessions ? window.__pfCollectSessions() : ({accounts: []})');
  assert.equal(await context.handlers.get('session-summary')(unauthorized), null);
  context.handlers.get('session-open')(unauthorized);
  assert.equal(context.listeners.mainShown || 0, 0);
  context.handlers.get('session-open')(authorized);
  assert.equal(context.listeners.mainShown, 1);
  context.handlers.get('session-close')(authorized);
  assert.equal(panel.visible, false);
  context.handlers.get('session-close')(unauthorized);
  assert.equal(context.service.isVisible(), false);
});

test('summary collection retains the four-second timeout and clears it after completion', async () => {
  const context = setup({ executeJavaScript: () => new Promise(() => {}) });
  context.service.show();
  const panel = FakeBrowserWindow.created[0];
  const result = context.handlers.get('session-summary')({ sender: panel.webContents, senderFrame: panel.webContents.mainFrame });
  assert.equal(context.timeouts[0].delay, 4000);
  context.timeouts[0].callback();
  await assert.rejects(result, /Game summary timeout/);
  assert.deepEqual(context.cleared, ['timer-1']);
});
