'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLiveMediaControls } = require('../renderer/live-media-controls');

function setup(overrides = {}) {
  const calls = { muted: [], scripts: [], persist: 0, twitchChat: [], reloads: [] };
  const state = { quality: 480, kickEconomy: false, showChat: true };
  const tiles = new Map();
  let expandedKey = null;
  let zIndex = 20;
  const controls = createLiveMediaControls({
    state,
    tiles,
    chatOverlay: { isExpanded: key => expandedKey === key },
    checkTwitchChat: (key, ready) => calls.twitchChat.push([key, ready]),
    persist: () => { calls.persist += 1; },
    nextZIndex: () => String(++zIndex),
    reloadWebview: webview => calls.reloads.push(webview),
    ...overrides,
  });
  return { calls, controls, state, tiles, setExpandedKey: key => { expandedKey = key; } };
}

test('applies mute state to the tile control and ready player without exposing player errors', () => {
  const { calls, controls, tiles } = setup();
  const tile = {
    item: { muted: true },
    muteBtn: { setAttribute(name, value) { this[name] = value; } },
    player: {
      __ready: false,
      setAudioMuted: value => calls.muted.push(value),
      executeJavaScript: script => { calls.scripts.push(script); return Promise.resolve(); },
    },
  };
  tiles.set('twitch:channel', tile);

  controls.applyMute('twitch:channel');
  assert.match(tile.muteBtn.innerHTML, /icon-mute/);
  assert.equal(tile.muteBtn.title, 'Ativar som');
  assert.equal(tile.muteBtn['aria-label'], 'Ativar som');
  assert.equal(tile.player.__muted, true);
  assert.deepEqual(calls.muted, []);

  tile.player.__ready = true;
  controls.applyMute('twitch:channel');
  assert.deepEqual(calls.muted, [true]);
  assert.match(calls.scripts[0], /__kmSetMuted && window\.__kmSetMuted\(true\)/);
});

test('applies current quality while retaining the Kick economy quality cap', () => {
  const { controls, state } = setup();
  const scripts = [];
  const kickPlayer = { __ready: true, __pfSrc: 'https://player.kick.com/channel', executeJavaScript: script => { scripts.push(script); return Promise.resolve(); } };
  const twitchPlayer = { __ready: true, __pfSrc: 'https://www.twitch.tv/channel', executeJavaScript: script => { scripts.push(script); return Promise.resolve(); } };

  state.kickEconomy = true;
  controls.applyQuality(kickPlayer);
  controls.applyQuality(twitchPlayer);
  assert.match(scripts[0], /__kmApplyQuality\(160\)/);
  assert.match(scripts[1], /__kmApplyQuality\(480\)/);
});

test('keeps compact chat and economy behavior and reports Twitch chat readiness', async () => {
  const { calls, controls, state, tiles } = setup();
  state.kickEconomy = true;
  const kick = {
    p: 'kick',
    item: {},
    chat: { __ready: true, executeJavaScript: script => { calls.scripts.push(script); return Promise.resolve(); } },
  };
  const twitch = {
    p: 'twitch',
    sharedTwitch: true,
    item: {},
    player: { executeJavaScript: script => { calls.scripts.push(script); return Promise.resolve(true); } },
    chat: { __ready: true },
  };
  tiles.set('kick:channel', kick);
  tiles.set('twitch:channel', twitch);

  controls.applyChatMode('kick:channel');
  await controls.applyChatMode('twitch:channel');
  assert.match(calls.scripts[0], /__pfSetChatCompact && window\.__pfSetChatCompact\(true\)/);
  assert.match(calls.scripts[0], /__pfSetKickEconomy && window\.__pfSetKickEconomy\(true\)/);
  assert.deepEqual(calls.twitchChat, [['twitch:channel', true]]);

  twitch.player.executeJavaScript = () => Promise.reject(new Error('ignored'));
  await controls.applyChatMode('twitch:channel');
  assert.deepEqual(calls.twitchChat, [['twitch:channel', true], ['twitch:channel', false]]);
});

test('persists mute toggles and raises only non-expanded tiles', () => {
  const { calls, controls, tiles, setExpandedKey } = setup();
  const tile = {
    item: { muted: false },
    muteBtn: { setAttribute() {} },
    player: { __ready: false },
    root: { style: {} },
  };
  tiles.set('kick:channel', tile);

  controls.toggleMute('kick:channel');
  assert.equal(tile.item.muted, true);
  assert.equal(calls.persist, 1);
  controls.bringFront('kick:channel');
  assert.equal(tile.root.style.zIndex, '21');
  setExpandedKey('kick:channel');
  controls.bringFront('kick:channel');
  assert.equal(tile.root.style.zIndex, '21');
});

test('reloads both player and chat but deduplicates a shared Twitch webview', () => {
  const { calls, controls } = setup();
  const shared = {};
  const player = {};
  const chat = {};

  controls.reloadTile({ player: shared, chat: shared });
  controls.reloadTile({ player, chat });

  assert.deepEqual(calls.reloads, [shared, player, chat]);
});

test('active renderer loads and packages the media controls module before app composition', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(html.indexOf('<script src="live-media-controls.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
