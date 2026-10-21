'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLiveFollowService } = require('../live-follow-service');

function webview({ ready = true, connected = true, result, error } = {}) {
  const calls = [];
  return {
    __ready: ready,
    isConnected: connected,
    calls,
    async executeJavaScript(source) {
      calls.push(source);
      if (error) throw error;
      return result;
    },
  };
}

test('returns no_tile for missing tile and unsupported for unknown provider', async () => {
  const service = createLiveFollowService();

  assert.deepEqual(await service.followTile(null), { ok: false, status: 'no_tile' });
  assert.deepEqual(await service.followTile({ item: { channel: 'alpha' }, p: 'other' }), { ok: false, status: 'unsupported' });
});

test('follows a Twitch channel through its ready player and preserves provider result details', async () => {
  const player = webview({ result: { ok: true, status: 'followed', marker: 1 } });
  const service = createLiveFollowService();
  const result = await service.followTile({ p: 'twitch', item: { channel: 'alpha' }, player });

  assert.deepEqual(result, { ok: true, status: 'followed', marker: 1, channel: 'alpha', platform: 'twitch' });
  assert.equal(player.calls.length, 1);
  assert.match(player.calls[0], /data-a-target="follow-button"/);
  assert.match(player.calls[0], /data-a-target="unfollow-button"/);
  assert.match(player.calls[0], /status: 'not_logged_in'/);
});

test('uses the Kick chat webview first, with the existing logged-in request and result mapping', async () => {
  const chat = webview({ result: { ok: true, status: 'already_following' } });
  const player = webview({ result: { ok: false, status: 'unused' } });
  const service = createLiveFollowService();
  const result = await service.followTile({ p: 'kick', item: { channel: 'beta' }, chat, player });

  assert.deepEqual(result, { ok: true, status: 'already_following', channel: 'beta', platform: 'kick' });
  assert.equal(chat.calls.length, 1);
  assert.equal(player.calls.length, 0);
  assert.match(chat.calls[0], /credentials: 'include'/);
  assert.match(chat.calls[0], /status: 'not_logged_in'/);
});

test('uses the Kick player when a separate chat webview does not exist', async () => {
  const player = webview({ result: { ok: true, status: 'followed' } });
  const service = createLiveFollowService();

  assert.equal((await service.followTile({ p: 'kick', item: { channel: 'beta' }, player })).status, 'followed');
  assert.equal(player.calls.length, 1);
});

test('keeps channels with quote characters inside the Kick script argument', async () => {
  const chat = webview({ result: { ok: true, status: 'followed' } });
  const service = createLiveFollowService();

  await service.followTile({ p: 'kick', item: { channel: "alpha') ; window.injected = true; //" }, chat });

  assert.match(chat.calls[0].trim(), /\}\)\("alpha'\) ; window\.injected = true; \/\/"\)$/);
});

test('distinguishes a webview that is not ready from execution failures', async () => {
  const service = createLiveFollowService();
  const notReady = webview({ ready: false });
  const disconnected = webview({ connected: false });
  const broken = webview({ error: new Error('destroyed') });

  assert.deepEqual(await service.followTile({ p: 'twitch', item: { channel: 'alpha' }, player: notReady }), {
    ok: false, status: 'not_ready', channel: 'alpha',
  });
  assert.deepEqual(await service.followTile({ p: 'kick', item: { channel: 'beta' }, player: disconnected }), {
    ok: false, status: 'not_ready', channel: 'beta',
  });
  assert.equal((await service.followTile({ p: 'twitch', item: { channel: 'alpha' }, player: broken })).status, 'exec_error');
});

test('renderer composes the follow service with the tested UI batch module', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const batch = fs.readFileSync(path.join(root, 'renderer', 'live-follow-batch.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(app, /const liveFollowService = window\.PokeIdleLiveFollow\.createLiveFollowService\(\)/);
  assert.match(app, /async function followTile\(t\) \{\s*return liveFollowService\.followTile\(t\);\s*\}/);
  assert.match(app, /PokeIdleLiveFollowController\.createLiveFollowController/);
  assert.match(app, /follow: \(tile, button\) => liveFollowController\.followSingleTile\(tile, button\)/);
  assert.doesNotMatch(app, /async function followSingleTile\(/);
  assert.match(app, /const liveFollowBatch = window\.PokeIdleLiveFollowBatch\.createLiveFollowBatch\(/);
  assert.match(app, /function followAllOpenChannels\(\) \{\s*return liveFollowBatch\.followAllOpenChannels\(\);\s*\}/);
  assert.match(batch, /for \(const \[, tile\] of tiles\) \{[\s\S]*?await followTile\(tile\)[\s\S]*?await wait\(250\)/);
  assert.ok(html.indexOf('<script src="../live-follow-service.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(html.indexOf('<script src="../live-follow-service.js"></script>') < html.indexOf('<script src="live-follow-batch.js"></script>'));
  assert.ok(html.indexOf('<script src="live-follow-controller.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(html.indexOf('<script src="live-follow-batch.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('live-follow-service.js'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
