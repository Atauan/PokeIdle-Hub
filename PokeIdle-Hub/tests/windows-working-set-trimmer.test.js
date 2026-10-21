'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createWindowsWorkingSetTrimmer } = require('../windows-working-set-trimmer');

function fakeChild() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killCalls = 0;
  child.kill = () => { child.killCalls += 1; };
  child.input = '';
  child.stdin.on('data', chunk => { child.input += chunk.toString(); });
  return child;
}

test('invokes the packaged helper directly with only validated PIDs and parses per-process results', async () => {
  const child = fakeChild();
  const calls = [];
  const trimmer = createWindowsWorkingSetTrimmer({
    platform: 'win32',
    helperPath: 'C:/app/resources/win-memory-trimmer.exe',
    spawn: (...args) => { calls.push(args); return child; },
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
  });

  const pending = trimmer([
    { pid: 321, creationTime: 1234.5 },
    { pid: -1, creationTime: 2222 },
    { pid: 321, creationTime: 1234.5 },
  ]);
  child.stdout.end('321\ttrimmed\n');
  child.emit('close', 0);
  const result = await pending;

  assert.equal(calls[0][0], 'C:/app/resources/win-memory-trimmer.exe');
  assert.deepEqual(calls[0][1], []);
  assert.equal(calls[0][2].windowsHide, true);
  assert.equal(calls[0][2].shell, undefined);
  assert.equal(child.input, '321\t1234.5\n');
  assert.deepEqual(result, { results: [{ pid: 321, status: 'trimmed' }] });
});

test('does not launch a helper for empty or invalid process lists', async () => {
  let launches = 0;
  const trimmer = createWindowsWorkingSetTrimmer({ platform: 'win32', spawn: () => { launches += 1; } });

  assert.deepEqual(await trimmer([{ pid: 0, creationTime: 1 }]), { results: [] });
  assert.equal(launches, 0);
});

test('rejects unsupported platforms before launching a Windows helper', async () => {
  let launches = 0;
  const trimmer = createWindowsWorkingSetTrimmer({ platform: 'linux', spawn: () => { launches += 1; } });

  await assert.rejects(trimmer([{ pid: 321, creationTime: 1234 }]), /Windows/);
  assert.equal(launches, 0);
});
