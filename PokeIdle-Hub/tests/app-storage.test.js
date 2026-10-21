'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppStorage } = require('../renderer/app-storage');

function setup() {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };
  return { ...createAppStorage(storage), values, storage };
}

test('reads JSON values and uses the fallback for missing, null, or invalid JSON', () => {
  const context = setup();
  context.values.set('present', '{"enabled":true}');
  context.values.set('null', 'null');
  context.values.set('broken', '{');

  assert.deepEqual(context.load('present', {}), { enabled: true });
  assert.deepEqual(context.load('missing', ['fallback']), ['fallback']);
  assert.deepEqual(context.load('null', 'fallback'), 'fallback');
  assert.deepEqual(context.load('broken', 7), 7);
});

test('returns fallback when storage read fails and propagates write failures', () => {
  const storage = {
    getItem() { throw new Error('read failed'); },
    setItem() { throw new Error('write failed'); },
  };
  const { load, save } = createAppStorage(storage);

  assert.equal(load('key', 'fallback'), 'fallback');
  assert.throws(() => save('key', { value: 1 }), /write failed/);
});

test('serializes values to the same localStorage key', () => {
  const context = setup();
  context.save('pf.accounts', [{ id: 'main' }]);

  assert.equal(context.values.get('pf.accounts'), '[{"id":"main"}]');
  assert.deepEqual(context.load('pf.accounts', []), [{ id: 'main' }]);
});
