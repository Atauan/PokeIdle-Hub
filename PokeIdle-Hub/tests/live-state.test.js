'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { nextLiveState } = require('../renderer/live-state');

test('opens an online live and resets consecutive offline confirmations', () => {
  assert.deepEqual(nextLiveState({ offlineCount: 1 }, 'online', false), {
    status: 'online', offlineCount: 0, open: true,
  });
});

test('keeps an open live after one offline result and closes after the second', () => {
  const first = nextLiveState({ offlineCount: 0 }, 'offline', true);
  assert.deepEqual(first, { status: 'offline', offlineCount: 1, open: true });
  assert.deepEqual(nextLiveState(first, 'offline', first.open), {
    status: 'offline', offlineCount: 2, open: false,
  });
});

test('preserves prior open state for unknown status and normalizes unsupported states', () => {
  assert.deepEqual(nextLiveState({ offlineCount: 1 }, 'unknown', true), {
    status: 'unknown', offlineCount: 0, open: true,
  });
  assert.deepEqual(nextLiveState(null, 'invalid', false), {
    status: 'unknown', offlineCount: 0, open: false,
  });
});
