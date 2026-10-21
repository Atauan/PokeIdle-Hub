'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameFpsLimits } = require('../renderer/game-fps-limits');

function setup(overrides = {}) {
  const state = {
    tab: 'game',
    gameMosaic: false,
    fpsForeground: 30,
    fpsBackground: 15,
    ...overrides.state,
  };
  const scripts = new Map();
  const games = new Map(['main', 'alt'].map((id) => [id, {
    wv: { executeJavaScript(script) { scripts.set(id, script); return Promise.resolve(); } },
  }]));
  const limits = createGameFpsLimits({
    state,
    getCurrentAccount: () => ({ id: overrides.currentAccountId || 'main' }),
    games,
  });
  return { state, scripts, games, limits };
}

test('applies foreground FPS only to the selected account while game tab is focused', () => {
  const { scripts, limits } = setup();

  limits.apply();

  assert.equal(scripts.get('main'), 'window.__pfSetTargetFps && window.__pfSetTargetFps(30)');
  assert.equal(scripts.get('alt'), 'window.__pfSetTargetFps && window.__pfSetTargetFps(15)');
});

test('applies foreground FPS to every account in mosaic mode', () => {
  const { scripts, limits } = setup({ state: { gameMosaic: true } });

  limits.apply();

  assert.equal(scripts.get('main'), 'window.__pfSetTargetFps && window.__pfSetTargetFps(30)');
  assert.equal(scripts.get('alt'), 'window.__pfSetTargetFps && window.__pfSetTargetFps(30)');
});

test('applies background FPS to all game webviews outside the game tab', () => {
  const { scripts, limits } = setup({ state: { tab: 'lives' } });

  limits.apply();

  assert.deepEqual([...scripts.values()], [
    'window.__pfSetTargetFps && window.__pfSetTargetFps(15)',
    'window.__pfSetTargetFps && window.__pfSetTargetFps(15)',
  ]);
});

test('preserves existing fallback FPS values for zero and invalid settings', () => {
  const { scripts, limits } = setup({ state: { fpsForeground: 0, fpsBackground: 'invalid', tab: 'lives' } });

  limits.apply();

  assert.deepEqual([...scripts.values()], [
    'window.__pfSetTargetFps && window.__pfSetTargetFps(15)',
    'window.__pfSetTargetFps && window.__pfSetTargetFps(15)',
  ]);
});

test('ignores missing and destroyed webviews without aborting the remaining accounts', async () => {
  const state = { tab: 'game', gameMosaic: false, fpsForeground: 30, fpsBackground: 15 };
  const scripts = [];
  const games = new Map([
    ['missing', { wv: null }],
    ['destroyed', { wv: { executeJavaScript() { throw new Error('destroyed'); } } }],
    ['working', { wv: { executeJavaScript(script) { scripts.push(script); return Promise.reject(new Error('destroyed')); } } }],
  ]);
  const limits = createGameFpsLimits({ state, getCurrentAccount: () => ({ id: 'working' }), games });

  assert.doesNotThrow(() => limits.apply());
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(scripts, ['window.__pfSetTargetFps && window.__pfSetTargetFps(30)']);
});
