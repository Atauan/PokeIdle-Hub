'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLivePlayerWatchdog } = require('../renderer/live-player-watchdog');

function setup(tiles = new Map()) {
  const events = [];
  const timers = [];
  const cleared = [];
  const watchdog = createLivePlayerWatchdog({
    getTiles: () => tiles,
    reloadPlayer: player => events.push(['reload', player.id]),
    setIntervalFn: (callback, delay) => { timers.push({ callback, delay }); return `interval-${timers.length}`; },
    clearIntervalFn: timer => cleared.push(timer),
  });
  return { cleared, events, timers, watchdog };
}

test('checks only ready players on the existing 60 second interval', async () => {
  const calls = [];
  const tiles = new Map([
    ['loading', { player: { id: 'loading', __ready: false, executeJavaScript: () => assert.fail('not-ready player checked') } }],
    ['ready', { player: { id: 'ready', __ready: true, executeJavaScript: async script => { calls.push(script); return true; } }, stalls: 2 }],
  ]);
  const context = setup(tiles);
  context.watchdog.start();

  assert.equal(context.timers.length, 1);
  assert.equal(context.timers[0].delay, 60000);
  context.timers[0].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(tiles.get('ready').stalls, 0);
  assert.match(calls[0], /currentTime/);
});

test('reloads a stalled player after three failed checks and resets its counter', async () => {
  const tile = { player: { id: 'stalled', __ready: true, executeJavaScript: async () => false }, stalls: 0 };
  const context = setup(new Map([['stalled', tile]]));
  context.watchdog.start();

  for (let i = 0; i < 3; i++) {
    context.timers[0].callback();
    await new Promise(resolve => setImmediate(resolve));
  }

  assert.equal(tile.stalls, 0);
  assert.deepEqual(context.events, [['reload', 'stalled']]);
});

test('ignores execution failures and disposes its interval idempotently', async () => {
  const tile = { player: { id: 'failed', __ready: true, executeJavaScript: async () => { throw new Error('destroyed'); } }, stalls: 1 };
  const context = setup(new Map([['failed', tile]]));
  context.watchdog.start();
  context.watchdog.start();
  context.timers[0].callback();
  await new Promise(resolve => setImmediate(resolve));
  context.watchdog.dispose();
  context.watchdog.dispose();

  assert.equal(tile.stalls, 1);
  assert.deepEqual(context.cleared, ['interval-1']);
  assert.equal(context.watchdog.isRunning(), false);
});

test('active renderer composes the watchdog and packages its script before app.js', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(app, /PokeIdleLivePlayerWatchdog\.createLivePlayerWatchdog\(/);
  assert.match(app, /livePlayerWatchdog\.start\(\)/);
  assert.match(html, /<script src="live-player-watchdog\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/);
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
