'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerElectronWebContentsHandlers } = require('../electron-webcontents-service');
const { createLiveContentRegistry } = require('../live-content-purpose');

function emitter(type = 'window') {
  const listeners = new Map();
  return {
    listeners,
    type,
    session: { id: 'account-session' },
    getType: () => type,
    getURL: () => 'https://pokeidle.io/app',
    on: (event, callback) => listeners.set(event, callback),
    once: (event, callback) => listeners.set(`once:${event}`, callback),
    setWindowOpenHandler(callback) { this.windowOpenHandler = callback; },
    emit: (event, ...args) => listeners.get(event)?.(...args),
    emitOnce: (event, ...args) => listeners.get(`once:${event}`)?.(...args),
  };
}

function setup() {
  const app = emitter();
  const partitions = [];
  const addedLives = [];
  registerElectronWebContentsHandlers({
    app,
    preloadPath: 'C:/app/webview-preload.js',
    primaryPartition: 'persist:pokeidlehub',
    setupSession: partition => partitions.push(partition),
    isGame: contents => contents.getURL().includes('pokeidle.io'),
    channelURL: url => url === 'https://www.twitch.tv/rodil' ? 'https://twitch.tv/rodil' : null,
    addLive: link => addedLives.push(link),
    liveContentRegistry: createLiveContentRegistry(),
  });
  return { app, partitions, addedLives };
}

test('registers secure webview preferences and preserves only valid account partitions', () => {
  const context = setup();
  const contents = emitter();
  context.app.emit('web-contents-created', {}, contents);
  const configure = contents.listeners.get('will-attach-webview');
  const preferences = { preloadURL: 'unsafe', nodeIntegration: true };
  const params = { partition: 'persist:pokeidlehub-acc-secondary', src: 'https://pokeidle.io/app' };
  let prevented = false;

  configure({ preventDefault: () => { prevented = true; } }, preferences, params);

  assert.equal(prevented, false);
  assert.equal('preloadURL' in preferences, false);
  assert.equal(preferences.preload, 'C:/app/webview-preload.js');
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.sandbox, true);
  assert.equal(preferences.backgroundThrottling, false);
  assert.equal(preferences.partition, 'persist:pokeidlehub-acc-secondary');
  assert.deepEqual(context.partitions, ['persist:pokeidlehub-acc-secondary']);

  configure({ preventDefault: () => { prevented = true; } }, {}, { partition: 'persist:other', src: 'javascript:alert(1)' });
  assert.equal(prevented, true);
  assert.deepEqual(context.partitions, ['persist:pokeidlehub-acc-secondary', 'persist:pokeidlehub']);
});

test('routes game channel navigation and popup navigation into lives', () => {
  const context = setup();
  const gameContents = emitter('webview');
  context.app.emit('web-contents-created', {}, gameContents);

  let navigationPrevented = false;
  gameContents.listeners.get('will-navigate')({ preventDefault: () => { navigationPrevented = true; } }, 'https://www.twitch.tv/rodil');
  assert.equal(navigationPrevented, true);
  assert.deepEqual(context.addedLives, ['https://twitch.tv/rodil']);

  const child = emitter();
  child.webContents = emitter('window');
  let childPrevented = false;
  let childClosed = false;
  child.close = () => { childClosed = true; };
  gameContents.listeners.get('did-create-window')(child);
  child.webContents.listeners.get('will-navigate')({ preventDefault: () => { childPrevented = true; } }, 'https://www.twitch.tv/rodil');
  assert.equal(childPrevented, true);
  assert.equal(childClosed, true);
  assert.equal(context.addedLives.length, 2);
});

test('preserves safe popup policies for game blank windows and external HTTPS pages', () => {
  const context = setup();
  const gameContents = emitter('webview');
  context.app.emit('web-contents-created', {}, gameContents);
  const open = url => gameContents.windowOpenHandler({ url });

  assert.deepEqual(open('file:///unexpected'), { action: 'deny' });
  assert.deepEqual(open('https://www.twitch.tv/rodil'), { action: 'deny' });
  assert.equal(context.addedLives.at(-1), 'https://twitch.tv/rodil');

  const blank = open('about:blank');
  assert.equal(blank.action, 'allow');
  assert.equal(blank.overrideBrowserWindowOptions.show, false);
  assert.equal(blank.overrideBrowserWindowOptions.webPreferences.session, gameContents.session);
  assert.equal(blank.overrideBrowserWindowOptions.webPreferences.contextIsolation, true);
  assert.equal(blank.overrideBrowserWindowOptions.webPreferences.sandbox, true);
  assert.equal(blank.overrideBrowserWindowOptions.webPreferences.nodeIntegration, false);

  const external = open('https://accounts.google.com/o/oauth2/auth');
  assert.equal(external.action, 'allow');
  assert.equal(external.overrideBrowserWindowOptions.webPreferences.session, gameContents.session);
  assert.equal(external.overrideBrowserWindowOptions.width, 520);
  assert.equal(external.overrideBrowserWindowOptions.height, 760);
});

test('does not intercept channel navigation or grant game popup exceptions outside the game', () => {
  const context = setup();
  const liveContents = emitter('webview');
  liveContents.getURL = () => 'https://www.twitch.tv/some-channel';
  context.app.emit('web-contents-created', {}, liveContents);

  let prevented = false;
  liveContents.listeners.get('will-navigate')({ preventDefault: () => { prevented = true; } }, 'https://www.twitch.tv/rodil');
  assert.equal(prevented, false);
  assert.deepEqual(context.addedLives, []);
  assert.deepEqual(liveContents.windowOpenHandler({ url: 'about:blank' }), { action: 'deny' });
});
