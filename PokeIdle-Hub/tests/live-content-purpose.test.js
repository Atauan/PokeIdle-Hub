'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyLiveContentPurpose, createLiveContentRegistry, trackAttachedLiveWebviews } = require('../live-content-purpose');

test('classifies only known live player, chat, and economy URLs', () => {
  assert.equal(classifyLiveContentPurpose('https://player.kick.com/axt?autoplay=true'), 'live-player');
  assert.equal(classifyLiveContentPurpose('https://kick.com/popout/axt/chat'), 'live-chat');
  assert.equal(classifyLiveContentPurpose('https://www.twitch.tv/rodil'), 'live-player');
  assert.equal(classifyLiveContentPurpose('https://www.twitch.tv/popout/rodil/chat?popout='), 'live-chat');
  assert.equal(classifyLiveContentPurpose('https://www.twitch.tv/popout/rodil/chat?pf-economy=1'), 'live-economy');
  assert.equal(classifyLiveContentPurpose('https://www.twitch.tv/login'), null);
  assert.equal(classifyLiveContentPurpose('https://accounts.google.com/login'), null);
  assert.equal(classifyLiveContentPurpose('https://pokeidle.io/app'), null);
  assert.equal(classifyLiveContentPurpose('not a URL'), null);
});

test('registry adds recognized purposes and removes unknown or destroyed contents', () => {
  const registry = createLiveContentRegistry();
  registry.set(7, registry.classify('https://player.kick.com/axt'));
  assert.equal(registry.get(7), 'live-player');
  registry.set(7, registry.classify('https://www.twitch.tv/login'));
  assert.equal(registry.get(7), null);
  registry.set(8, 'auth-window');
  assert.equal(registry.get(8), null);
  registry.set(undefined, 'live-player');
  assert.equal(registry.get(undefined), null);
  registry.set(7, 'live-chat');
  assert.equal(registry.remove(7), true);
  assert.equal(registry.get(7), null);
});

test('tracks attached webview purpose across navigation and removes it on destruction', () => {
  const registry = createLiveContentRegistry();
  const embedderListeners = new Map();
  const guestListeners = new Map();
  const guestOnceListeners = new Map();
  const guest = {
    id: 17,
    getURL: () => 'https://player.kick.com/axt',
    on: (event, callback) => guestListeners.set(event, callback),
    once: (event, callback) => guestOnceListeners.set(event, callback),
  };
  const embedder = { on: (event, callback) => embedderListeners.set(event, callback) };

  trackAttachedLiveWebviews(embedder, registry);
  embedderListeners.get('did-attach-webview')({}, guest);
  assert.equal(registry.get(17), 'live-player');
  guestListeners.get('will-frame-navigate')({ isMainFrame: false, url: 'https://accounts.google.com/login' });
  assert.equal(registry.get(17), 'live-player');
  guestListeners.get('did-start-navigation')({ isMainFrame: true, url: 'https://www.twitch.tv/login' });
  assert.equal(registry.get(17), null);
  guestListeners.get('will-frame-navigate')({ isMainFrame: true, url: 'https://www.twitch.tv/rodil' });
  assert.equal(registry.get(17), 'live-player');
  guestOnceListeners.get('destroyed')();
  assert.equal(registry.get(17), null);
});
