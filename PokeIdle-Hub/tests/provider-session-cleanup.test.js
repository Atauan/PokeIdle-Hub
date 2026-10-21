'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createProviderSessionCleanup } = require('../provider-session-cleanup');

function createFixture(runClearData = async () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeidle-provider-cleanup-'));
  const userDataPath = path.join(root, 'PokeIdle Hub');
  const partitionsPath = path.join(userDataPath, 'Partitions');
  fs.mkdirSync(path.join(partitionsPath, 'pokeidlehub-acc-secondary'), { recursive: true });
  fs.mkdirSync(path.join(partitionsPath, 'pokeidlehub'), { recursive: true });
  fs.mkdirSync(path.join(partitionsPath, 'unrelated-partition'), { recursive: true });
  fs.writeFileSync(path.join(userDataPath, 'app-settings.json'), '{"keep":true}');
  const calls = [];
  const cleanup = createProviderSessionCleanup({
    session: {
      fromPartition(partition) {
        calls.push(['partition', partition]);
        return { clearData: options => runClearData(partition, options, calls) };
      },
    },
  });
  return { root, userDataPath, partitionsPath, calls, cleanup };
}

test('clears only Twitch and Kick storage in valid account partitions once', async () => {
  const fixture = createFixture(async (partition, options, calls) => calls.push(['clear', partition, options]));
  try {
    const result = await fixture.cleanup.clearStaleProviderData(fixture.userDataPath);

    assert.deepEqual(result, {
      cleared: true,
      partitions: ['persist:pokeidlehub', 'persist:pokeidlehub-acc-secondary'],
    });
    const clearCalls = fixture.calls.filter(call => call[0] === 'clear');
    assert.equal(clearCalls.length, 2);
    for (const [, , options] of clearCalls) {
      assert.deepEqual(options.origins, [
        'https://www.twitch.tv',
        'https://passport.twitch.tv',
        'https://kick.com',
        'https://web.kick.com',
      ]);
      assert.deepEqual(options.dataTypes, [
        'backgroundFetch', 'cache', 'cookies', 'fileSystems', 'indexedDB',
        'localStorage', 'serviceWorkers', 'webSQL',
      ]);
      assert.equal(options.originMatchingMode, 'origin-in-all-contexts');
    }
    assert.equal(fs.readFileSync(path.join(fixture.userDataPath, 'app-settings.json'), 'utf8'), '{"keep":true}');
    assert.equal(fs.existsSync(path.join(fixture.userDataPath, 'provider-storage-cleanup-v1.json')), true);

    const second = await fixture.cleanup.clearStaleProviderData(fixture.userDataPath);
    assert.deepEqual(second, { cleared: false, partitions: [] });
    assert.equal(fixture.calls.filter(call => call[0] === 'clear').length, 2);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('does not mark completion when a partition fails so the next startup can retry', async () => {
  let fail = true;
  const fixture = createFixture(async () => {
    if (fail) throw new Error('simulated storage failure');
  });
  try {
    await assert.rejects(fixture.cleanup.clearStaleProviderData(fixture.userDataPath), /storage failure/);
    assert.equal(fs.existsSync(path.join(fixture.userDataPath, 'provider-storage-cleanup-v1.json')), false);

    fail = false;
    const result = await fixture.cleanup.clearStaleProviderData(fixture.userDataPath);
    assert.equal(result.cleared, true);
    assert.equal(fs.existsSync(path.join(fixture.userDataPath, 'provider-storage-cleanup-v1.json')), true);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('rejects an unsupported cleanup marker rather than skipping the reset', async () => {
  const fixture = createFixture();
  try {
    fs.writeFileSync(path.join(fixture.userDataPath, 'provider-storage-cleanup-v1.json'), '{"version":99}');
    await assert.rejects(fixture.cleanup.clearStaleProviderData(fixture.userDataPath), /marcador/i);
    assert.equal(fixture.calls.some(call => call[0] === 'clear'), false);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
