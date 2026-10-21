'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoginWindowService } = require('../login-window-service');

class FakeBrowserWindow {
  static created = [];

  constructor(options) {
    this.options = options;
    this.listeners = new Map();
    this.webContents = {
      session: { id: 'account-session' },
      handlers: [],
      listeners: new Map(),
      userAgents: [],
      setUserAgent: (userAgent) => this.webContents.userAgents.push(userAgent),
      setWindowOpenHandler: (handler) => this.webContents.handlers.push(handler),
      on: (event, callback) => this.webContents.listeners.set(event, callback),
    };
    this.visible = false;
    this.focused = false;
    this.loadedUrl = null;
    FakeBrowserWindow.created.push(this);
  }

  once(event, callback) { this.listeners.set(`once:${event}`, callback); }
  on(event, callback) { this.listeners.set(event, callback); }
  show() { this.visible = true; }
  focus() { this.focused = true; }
  loadURL(url) { this.loadedUrl = url; }
  emit(event, ...args) { this.listeners.get(event)?.(...args); }
  emitOnce(event, ...args) { this.listeners.get(`once:${event}`)?.(...args); }
}

test('login window preserves account session, browser identity, and OAuth popup policy', () => {
  FakeBrowserWindow.created = [];
  const closed = [];
  const stages = [];
  const service = createLoginWindowService({
    BrowserWindow: FakeBrowserWindow,
    userAgent: 'Chrome test identity',
    onClosed: (window, payload) => closed.push({ window, payload }),
  });

  const loginWindow = service.openLoginWindow('https://www.twitch.tv/login', 'Entrar na Twitch', 'persist:pokeidlehub-acc-a', 'twitch', {
    flowId: '123e4567-e89b-12d3-a456-426614174000',
    reportStage: (stage, details = {}) => stages.push({ stage, ...details }),
  });
  const windowOpenHandler = loginWindow.webContents.handlers[0];
  const popupPolicy = windowOpenHandler({ url: 'https://accounts.google.com/o/oauth2/auth' });

  assert.equal(loginWindow.options.webPreferences.partition, 'persist:pokeidlehub-acc-a');
  assert.equal(loginWindow.options.webPreferences.contextIsolation, true);
  assert.equal(loginWindow.options.webPreferences.sandbox, true);
  assert.equal(loginWindow.options.webPreferences.nodeIntegration, false);
  assert.deepEqual(loginWindow.webContents.userAgents, ['Chrome test identity']);
  assert.equal(loginWindow.loadedUrl, 'https://www.twitch.tv/login');
  assert.deepEqual(windowOpenHandler({ url: 'file:///unexpected.html' }), { action: 'deny' });
  assert.equal(popupPolicy.action, 'allow');
  assert.equal(popupPolicy.overrideBrowserWindowOptions.webPreferences.session, loginWindow.webContents.session);
  assert.equal(popupPolicy.overrideBrowserWindowOptions.webPreferences.contextIsolation, true);
  assert.equal(popupPolicy.overrideBrowserWindowOptions.webPreferences.sandbox, true);
  assert.equal(popupPolicy.overrideBrowserWindowOptions.webPreferences.nodeIntegration, false);
  assert.deepEqual(stages.map(({ stage }) => stage), [
    'window_creation_started', 'window_created', 'navigation_started',
  ]);
});

test('login popup inherits user-agent and HTTPS-only popup policy; ready and close lifecycle are forwarded', () => {
  FakeBrowserWindow.created = [];
  const closed = [];
  const stages = [];
  const service = createLoginWindowService({
    BrowserWindow: FakeBrowserWindow,
    userAgent: 'Chrome test identity',
    onClosed: (window, payload) => closed.push({ window, payload }),
  });

  const flowId = '123e4567-e89b-12d3-a456-426614174000';
  const loginWindow = service.openLoginWindow('https://kick.com/login', 'Entrar na Kick', 'persist:pokeidlehub', 'kick', {
    flowId,
    reportStage: (stage, details = {}) => stages.push({ stage, ...details }),
  });
  loginWindow.emitOnce('ready-to-show');
  assert.equal(loginWindow.visible, true);
  assert.equal(loginWindow.focused, true);
  loginWindow.webContents.listeners.get('did-finish-load')();
  loginWindow.webContents.listeners.get('did-fail-load')({}, -105, 'network error', 'https://kick.com/login', true);

  const child = new FakeBrowserWindow({});
  loginWindow.webContents.listeners.get('did-create-window')(child);
  assert.deepEqual(child.webContents.userAgents, ['Chrome test identity']);
  assert.equal(child.webContents.handlers[0]({ url: 'https://kick.com/oauth' }).action, 'allow');
  assert.deepEqual(child.webContents.handlers[0]({ url: 'javascript:alert(1)' }), { action: 'deny' });

  loginWindow.emit('closed');
  assert.deepEqual(closed.map(({ payload }) => ({ ...payload })), [
    { platform: 'kick', partition: 'persist:pokeidlehub', flowId },
  ]);
  assert.equal(closed[0].window, loginWindow);
  assert.deepEqual(stages.map(({ stage }) => stage), [
    'window_creation_started', 'window_created', 'navigation_started', 'window_ready_to_show',
    'navigation_finished', 'navigation_failed', 'popup_created', 'window_closed',
  ]);
  assert.deepEqual(stages.find(({ stage }) => stage === 'navigation_failed'), {
    stage: 'navigation_failed', errorCode: -105,
  });
});
