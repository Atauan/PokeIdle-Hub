'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAboutWindowService } = require('../about-window-service');

class FakeBrowserWindow {
  static created = [];

  constructor(options) {
    this.options = options;
    this.listeners = new Map();
    this.webContents = {
      listeners: new Map(),
      setWindowOpenHandler: handler => { this.webContents.openWindowHandler = handler; },
      on: (event, callback) => this.webContents.listeners.set(event, callback),
    };
    this.destroyed = false;
    this.visible = false;
    this.focused = false;
    this.loadedFile = null;
    FakeBrowserWindow.created.push(this);
  }

  setMenu(menu) { this.menu = menu; }
  once(event, callback) { this.listeners.set(`once:${event}`, callback); }
  on(event, callback) { this.listeners.set(event, callback); }
  isDestroyed() { return this.destroyed; }
  show() { this.visible = true; }
  focus() { this.focused = true; }
  loadFile(file, options) { this.loadedFile = { file, options }; }
  emit(event, ...args) {
    const callback = this.listeners.get(event) || this.listeners.get(`once:${event}`);
    if (event.startsWith('ready')) this.listeners.delete(`once:${event}`);
    callback?.(...args);
  }
}

function setup({ isQuitting = () => false } = {}) {
  FakeBrowserWindow.created = [];
  const handlers = new Map();
  const openedExternal = [];
  const copied = [];
  const donations = {
    repository: 'https://github.com/example/repo',
    developers: [
      { id: 'dev-1', github: 'https://github.com/example', linkedin: 'https://linkedin.com/in/example', pix: 'pix-value' },
    ],
  };
  const service = createAboutWindowService({
    BrowserWindow: FakeBrowserWindow,
    ipcMain: { handle: (channel, listener) => handlers.set(channel, listener) },
    shell: { openExternal: url => { openedExternal.push(url); return Promise.resolve(); } },
    clipboard: { writeText: value => copied.push(value) },
    appDirectory: 'C:/app',
    appVersion: '3.1.0',
    getAppIcon: () => 'C:/app/assets/icon.png',
    donations,
    isQuitting,
  });
  return { service, handlers, openedExternal, copied, donations };
}

test('creates the About window with its current secure options, link allowlist and lifecycle', () => {
  const { service, openedExternal } = setup();
  service.show();
  const window = FakeBrowserWindow.created[0];

  assert.equal(window.options.title, 'Sobre o PokeIdle Hub');
  assert.equal(window.options.width, 440);
  assert.equal(window.options.height, 640);
  assert.equal(window.options.show, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.menu, null);
  assert.deepEqual(window.loadedFile, {
    file: path.join('C:/app', 'renderer', 'about.html'),
    options: { query: { version: '3.1.0' } },
  });

  const openWindow = window.webContents.openWindowHandler;
  assert.equal(typeof openWindow, 'function');
  assert.deepEqual(openWindow({ url: 'https://github.com/example/repo' }), { action: 'deny' });
  assert.deepEqual(openWindow({ url: 'https://unlisted.example/path' }), { action: 'deny' });
  assert.deepEqual(openedExternal, ['https://github.com/example/repo']);

  let prevented = false;
  window.webContents.listeners.get('will-navigate')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);

  window.emit('ready-to-show');
  assert.equal(window.visible, true);
  assert.equal(window.focused, true);
  service.show();
  assert.equal(FakeBrowserWindow.created.length, 1);
  assert.equal(window.visible, true);
  assert.equal(window.focused, true);

  window.destroyed = true;
  service.show();
  assert.equal(FakeBrowserWindow.created.length, 2);
  FakeBrowserWindow.created[1].emit('closed');
  service.show();
  assert.equal(FakeBrowserWindow.created.length, 3);
});

test('registers About IPC that returns or copies data only for the About window', () => {
  const { service, handlers, donations, copied } = setup();
  service.show();
  const window = FakeBrowserWindow.created[0];
  const getData = handlers.get('about-data');
  const copyPix = handlers.get('about-copy-pix');

  assert.equal(typeof getData, 'function');
  assert.equal(typeof copyPix, 'function');
  assert.equal(getData({ sender: window.webContents }), donations);
  assert.equal(getData({ sender: {} }), null);
  assert.equal(copyPix({ sender: {} }, 'dev-1'), false);
  assert.equal(copyPix({ sender: window.webContents }, 'unknown'), false);
  assert.equal(copyPix({ sender: window.webContents }, 'dev-1'), true);
  assert.deepEqual(copied, ['pix-value']);
});

test('does not create an About window while the application is quitting', () => {
  const { service } = setup({ isQuitting: () => true });

  service.show();

  assert.equal(FakeBrowserWindow.created.length, 0);
});

test('main composes the About service and packages it as an active main-process module', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

  assert.match(main, /createAboutWindowService/);
  assert.match(main, /aboutWindowService\.show/);
  assert.doesNotMatch(main, /ipcMain\.handle\('about-data'/);
  assert.doesNotMatch(main, /ipcMain\.handle\('about-copy-pix'/);
  assert.ok(packageJson.build.files.includes('about-window-service.js'));
});
