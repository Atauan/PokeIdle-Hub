'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { createMainWindowService } = require('../main-window-service');

class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    this.windowOpenHandler = null;
  }

  setWindowOpenHandler(handler) { this.windowOpenHandler = handler; }
}

class FakeBrowserWindow extends EventEmitter {
  static created = [];

  constructor(options) {
    super();
    this.options = options;
    this.webContents = new FakeWebContents();
    this.destroyed = false;
    this.calls = [];
    FakeBrowserWindow.created.push(this);
  }

  loadFile(...args) { this.calls.push(['loadFile', ...args]); }
  isDestroyed() { return this.destroyed; }
  setTitle(value) { this.calls.push(['setTitle', value]); }
  setAppDetails(value) { this.calls.push(['setAppDetails', value]); }
  reload() { this.calls.push(['reload']); }
  hide() { this.calls.push(['hide']); }
}

function setup(overrides = {}) {
  FakeBrowserWindow.created = [];
  const calls = [];
  let window = null;
  let tray = { isDestroyed: () => false };
  let quitting = false;
  const service = createMainWindowService({
    BrowserWindow: FakeBrowserWindow,
    appDirectory: 'C:/app',
    isDevelopment: true,
    platform: 'win32',
    appUserModelId: 'com.pokeidlehub.app.dev',
    getTaskbarIconPath: () => 'C:/app/PokeIdle Hub.exe',
    getAppIcon: () => 'C:/app/assets/icon.ico',
    getWindow: () => window,
    setWindow: value => { window = value; calls.push(['setWindow', value]); },
    getTray: () => tray,
    isQuitting: () => quitting,
    setQuitting: value => { quitting = value; calls.push(['quitting', value]); },
    setTimeoutFn: (callback, delay) => { calls.push(['timeout', callback, delay]); return 17; },
    ...overrides,
  });
  return {
    calls,
    service,
    getWindow: () => window,
    setTray: value => { tray = value; },
    setQuitting: value => { quitting = value; },
  };
}

test('creates the secure main window with current options and active renderer path', () => {
  const { service, getWindow } = setup();
  service.create();
  const window = getWindow();

  assert.deepEqual(window.options, {
    width: 1440,
    height: 880,
    minWidth: 1000,
    minHeight: 560,
    title: 'PokeIdle Hub [DEV]',
    backgroundColor: '#141416',
    autoHideMenuBar: true,
    icon: 'C:/app/assets/icon.ico',
    webPreferences: {
      preload: path.join('C:/app', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  assert.deepEqual(window.calls, [
    ['setAppDetails', {
      appId: 'com.pokeidlehub.app.dev',
      appIconPath: 'C:/app/PokeIdle Hub.exe',
      appIconIndex: 0,
    }],
    ['loadFile', path.join('C:/app', 'renderer', 'index.html')],
  ]);
  assert.deepEqual(window.calls.find(call => call[0] === 'setAppDetails'), [
    'setAppDetails',
    { appId: 'com.pokeidlehub.app.dev', appIconPath: 'C:/app/PokeIdle Hub.exe', appIconIndex: 0 },
  ]);
});

test('only configures the taskbar identity on Windows', () => {
  const { service, getWindow } = setup({ platform: 'linux' });
  service.create();
  assert.equal(getWindow().calls.some(call => call[0] === 'setAppDetails'), false);
});

test('blocks main-window popups and navigation and restores its fixed title', () => {
  const { service, getWindow } = setup({ isDevelopment: false });
  service.create();
  const window = getWindow();
  assert.deepEqual(window.webContents.windowOpenHandler(), { action: 'deny' });

  let prevented = false;
  window.webContents.emit('will-navigate', { preventDefault: () => { prevented = true; } });
  let titlePrevented = false;
  window.webContents.emit('page-title-updated', { preventDefault: () => { titlePrevented = true; } });

  assert.equal(prevented, true);
  assert.equal(titlePrevented, true);
  assert.deepEqual(window.calls.at(-1), ['setTitle', 'PokeIdle Hub']);
});

test('close hides the window while tray is available but permits close during shutdown', () => {
  const { service, getWindow, setTray, setQuitting } = setup();
  service.create();
  const window = getWindow();
  let prevented = false;
  window.emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(window.calls.at(-1), ['hide']);

  setQuitting(true);
  prevented = false;
  window.emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);

  setQuitting(false);
  setTray(null);
  window.emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
});

test('session end marks shutdown, renderer crash reloads after two seconds and close clears the reference', () => {
  const { service, getWindow, calls } = setup();
  service.create();
  const window = getWindow();

  window.emit('session-end');
  window.webContents.emit('render-process-gone');
  const timeout = calls.find(call => call[0] === 'timeout');
  assert.equal(timeout[2], 2000);
  timeout[1]();
  assert.deepEqual(window.calls.at(-1), ['reload']);

  window.emit('closed');
  assert.equal(getWindow(), null);
});

test('main composes and packages the main window service', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /createMainWindowService\(\{[\s\S]*?getWindow: \(\) => win,[\s\S]*?setWindow: value => \{ win = value; \}/);
  assert.doesNotMatch(main, /new BrowserWindow\(/);
  assert.ok(packageJson.build.files.includes('main-window-service.js'));
});
