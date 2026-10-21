'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registerLiveStatusHandler } = require('../live-status-ipc');

test('live-status rejects unauthorized senders without invoking discovery', async () => {
  let handler;
  let calls = 0;
  registerLiveStatusHandler({
    ipcMain: { handle: (channel, callback) => { assert.equal(channel, 'live-status'); handler = callback; } },
    isAuthorized: () => false,
    checkStatus: () => { calls += 1; return { channel: 'online' }; },
  });

  assert.deepEqual(await handler({ sender: {} }, 'twitch', ['channel']), {});
  assert.equal(calls, 0);
});

test('live-status delegates the original provider and channel list for the authorized main frame', async () => {
  let handler;
  const result = { channel: 'online' };
  const channels = ['channel', 'channel-two'];
  const calls = [];
  registerLiveStatusHandler({
    ipcMain: { handle: (channel, callback) => { assert.equal(channel, 'live-status'); handler = callback; } },
    isAuthorized: event => event.sender === 'main-window',
    checkStatus: (...args) => { calls.push(args); return result; },
  });

  assert.equal(await handler({ sender: 'main-window' }, 'twitch', channels), result);
  assert.deepEqual(calls, [['twitch', channels]]);
});

test('main composes and packages the live-status IPC handler', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /registerLiveStatusHandler\(\{[\s\S]*?isAuthorized: fromMainWindow,[\s\S]*?checkStatus: \(platform, channels\) => liveStatus\.check\(platform, channels\)/);
  assert.doesNotMatch(main, /ipcMain\.handle\('live-status'/);
  assert.ok(packageJson.build.files.includes('live-status-ipc.js'));
});
