'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registerMarketSampleHandler } = require('../market-sample-ipc');

function setup({ authorized = true, exists = false, size = 0 } = {}) {
  let listener;
  const writes = [];
  const stats = [];
  const fsAdapter = {
    existsSync: file => { stats.push(['exists', file]); return exists; },
    statSync: file => { stats.push(['stat', file]); return { size }; },
    appendFileSync: (...args) => writes.push(args),
  };
  registerMarketSampleHandler({
    ipcMain: { on: (channel, callback) => { assert.equal(channel, 'write-sample'); listener = callback; } },
    isTrustedSender: () => authorized,
    getUserDataPath: () => 'profile',
    joinPath: (...parts) => parts.join('/'),
    fs: fsAdapter,
    now: () => new Date('2026-10-20T12:00:00.000Z'),
  });
  return { listener, writes, stats };
}

test('market sample ignores untrusted senders and missing messages', () => {
  const untrusted = setup({ authorized: false });
  untrusted.listener({}, { url: 'https://example.test', text: 'body' });
  assert.deepEqual(untrusted.stats, []);
  assert.deepEqual(untrusted.writes, []);

  const missing = setup();
  missing.listener({}, null);
  assert.deepEqual(missing.stats, []);
  assert.deepEqual(missing.writes, []);
});

test('market sample appends timestamped data with the existing field limits', () => {
  const { listener, writes } = setup();
  listener({}, { url: 'u'.repeat(501), text: 't'.repeat(30001) });

  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'profile/market-samples.jsonl');
  const line = writes[0][1];
  assert.ok(line.endsWith('\n'));
  const record = JSON.parse(line.trimEnd());
  assert.equal(record.date, '2026-10-20T12:00:00.000Z');
  assert.equal(record.url.length, 500);
  assert.equal(record.body.length, 30000);
});

test('market sample stops appending after the existing three-megabyte cap', () => {
  const { listener, writes, stats } = setup({ exists: true, size: 3_000_001 });
  listener({}, { url: 'https://example.test', text: 'body' });

  assert.deepEqual(stats.map(([operation]) => operation), ['exists', 'stat']);
  assert.deepEqual(writes, []);
});

test('main composes and packages the market sample IPC handler', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /registerMarketSampleHandler\(\{[\s\S]*?isTrustedSender: fromApp,[\s\S]*?getUserDataPath: \(\) => app\.getPath\('userData'\)/);
  assert.doesNotMatch(main, /ipcMain\.on\('write-sample'/);
  assert.ok(packageJson.build.files.includes('market-sample-ipc.js'));
});
