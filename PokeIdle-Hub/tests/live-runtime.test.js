'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoadQueue, reconcileMap } = require('../live-runtime');

function createFakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    timers,
    now: () => now,
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      const target = now + ms;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = target;
    },
  };
}

test('cancellable load queue preserves the interval between successful page loads', () => {
  const clock = createFakeClock();
  const queue = createLoadQueue({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
    intervalMs: 1500,
  });
  const started = [];

  queue.enqueue(() => { started.push(clock.now()); return true; });
  queue.enqueue(() => { started.push(clock.now()); return true; });
  clock.advance(0);
  assert.deepEqual(started, [0]);
  clock.advance(1499);
  assert.deepEqual(started, [0]);
  clock.advance(1);
  assert.deepEqual(started, [0, 1500]);
});

test('load queue exposes anonymous pending and wait-time metrics without counting cancelled or stale jobs', () => {
  const clock = createFakeClock();
  const queue = createLoadQueue({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
    intervalMs: 100,
  });

  queue.enqueue(() => true);
  clock.advance(0);
  const cancel = queue.enqueue(() => true);
  queue.enqueue(() => false);
  queue.enqueue(() => true);
  assert.deepEqual(queue.getStats(), {
    pending: 3,
    started: 1,
    averageWaitMs: 0,
    maxWaitMs: 0,
  });

  cancel();
  clock.advance(0);
  assert.deepEqual(queue.getStats(), {
    pending: 2,
    started: 1,
    averageWaitMs: 0,
    maxWaitMs: 0,
  });

  clock.advance(99);
  assert.equal(queue.getStats().pending, 2);
  clock.advance(1);
  assert.deepEqual(queue.getStats(), {
    pending: 0,
    started: 2,
    averageWaitMs: 50,
    maxWaitMs: 100,
  });
});

test('cancelling a queued webview removes its job and releases an idle timer', () => {
  const clock = createFakeClock();
  const queue = createLoadQueue({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
    intervalMs: 1500,
  });
  let started = 0;
  const cancel = queue.enqueue(() => { started++; return true; });

  cancel();
  assert.equal(clock.timers.size, 0);
  clock.advance(5000);
  assert.equal(started, 0);
});

test('stopping the queue cancels pending loads and rejects future work', () => {
  const clock = createFakeClock();
  const queue = createLoadQueue({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
  });
  let started = 0;
  queue.enqueue(() => { started++; return true; });
  queue.stop();
  queue.enqueue(() => { started++; return true; });
  clock.advance(5000);

  assert.equal(started, 0);
  assert.equal(clock.timers.size, 0);
});

test('failed or stale queue jobs do not consume the successful-load interval', () => {
  const clock = createFakeClock();
  const queue = createLoadQueue({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
    intervalMs: 1500,
  });
  const started = [];

  queue.enqueue(() => { started.push('stale'); return false; });
  queue.enqueue(() => { started.push('valid'); return true; });
  clock.advance(0);
  assert.deepEqual(started, ['stale', 'valid']);
  assert.equal(clock.timers.size, 0);
});

test('resource map reconciliation creates, reuses, and disposes views idempotently', () => {
  const current = new Map();
  const created = [];
  const disposed = [];
  const create = descriptor => {
    const value = { id: descriptor.id };
    created.push(descriptor.id);
    return value;
  };
  const dispose = value => disposed.push(value.id);

  reconcileMap(current, new Map([['main:stream', { id: 'stream' }]]), create, dispose);
  reconcileMap(current, new Map([['main:stream', { id: 'stream' }]]), create, dispose);
  assert.deepEqual(created, ['stream']);
  assert.deepEqual(disposed, []);

  reconcileMap(current, new Map([['secondary:stream', { id: 'stream' }]]), create, dispose);
  assert.deepEqual(created, ['stream', 'stream']);
  assert.deepEqual(disposed, ['stream']);
  assert.deepEqual([...current.keys()], ['secondary:stream']);
});

test('reconciliation cancels a removed view before its queued page load starts', () => {
  const clock = createFakeClock();
  const queue = createLoadQueue({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    now: clock.now,
    intervalMs: 1500,
  });
  const current = new Map();
  let started = 0;
  let disposed = 0;

  const create = () => ({ cancelLoad: queue.enqueue(() => { started++; return true; }) });
  const dispose = view => {
    disposed++;
    view.cancelLoad();
  };

  reconcileMap(current, new Map([['account:channel', {}]]), create, dispose);
  reconcileMap(current, new Map(), create, dispose);
  clock.advance(5000);

  assert.equal(started, 0);
  assert.equal(disposed, 1);
  assert.equal(current.size, 0);
  assert.equal(clock.timers.size, 0);
});

test('runtime helper exposes its API to classic renderer scripts', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '..', 'live-runtime.js'), 'utf8');
  const context = vm.createContext({});

  vm.runInContext(source, context, { filename: 'live-runtime.js' });
  assert.equal(typeof context.PokeIdleLiveRuntime.reconcileMap, 'function');
  assert.equal(typeof context.PokeIdleLiveRuntime.createLoadQueue, 'function');
});
