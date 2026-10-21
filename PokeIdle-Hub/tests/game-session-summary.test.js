'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createGameSessionSummary } = require('../renderer/game-session-summary');

function setup({ accounts = [{ id: 'main', name: 'Principal', main: true }, { id: 'alt' }], pages = new Map(),
  timers = [], cleared = [] } = {}) {
  const service = createGameSessionSummary({
    getSelectedAccountId: () => 'alt',
    getAccounts: () => accounts,
    getWebview: accountId => pages.get(accountId),
    setTimeoutFn: (callback, delay) => { timers.push({ callback, delay }); return `timer-${timers.length}`; },
    clearTimeoutFn: timer => cleared.push(timer),
  });
  return { service, timers, cleared };
}

test('collects ready PokeIdle summaries per account and preserves selected account and fallback names', async () => {
  const pages = new Map([
    ['main', { __ready: true, getURL: () => 'https://pokeidle.io/app', executeJavaScript: async () => ({ status: 'online' }) }],
    ['alt', { __ready: false, getURL: () => 'https://pokeidle.io/app', executeJavaScript: async () => assert.fail('not ready page should not execute') }],
  ]);
  const context = setup({ pages });
  const result = await context.service.collect();

  assert.deepEqual(result, {
    selected: 'alt',
    accounts: [
      { id: 'main', name: 'Principal', data: { status: 'online' } },
      { id: 'alt', name: 'Sem nome', data: { status: 'waiting' } },
    ],
  });
  assert.deepEqual(context.timers.map(timer => timer.delay), [2000]);
  assert.deepEqual(context.cleared, ['timer-1']);
});

test('returns waiting after a two-second page timeout and clears each timer', async () => {
  const pages = new Map([
    ['main', { __ready: true, getURL: () => 'https://pokeidle.io/app', executeJavaScript: () => new Promise(() => {}) }],
  ]);
  const context = setup({ accounts: [{ id: 'main', name: '' }], pages });
  const pending = context.service.collect();
  assert.equal(context.timers[0].delay, 2000);
  context.timers[0].callback();

  assert.deepEqual(await pending, {
    selected: 'alt',
    accounts: [{ id: 'main', name: 'Sem nome', data: { status: 'waiting' } }],
  });
  assert.deepEqual(context.cleared, ['timer-1']);
});

test('ignores non-game pages and converts destroyed webview errors to waiting', async () => {
  const pages = new Map([
    ['main', { __ready: true, getURL: () => 'https://example.test/', executeJavaScript: async () => assert.fail('foreign page should not execute') }],
    ['alt', { __ready: true, getURL: () => { throw new Error('destroyed'); } }],
  ]);
  const context = setup({ pages });

  assert.deepEqual(await context.service.collect(), {
    selected: 'alt',
    accounts: [
      { id: 'main', name: 'Principal', data: { status: 'waiting' } },
      { id: 'alt', name: 'Sem nome', data: { status: 'waiting' } },
    ],
  });
  assert.deepEqual(context.timers, []);
});

test('active renderer loads and composes the collector before app.js', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(app, /PokeIdleGameSessionSummary\.createGameSessionSummary\(/);
  assert.match(app, /window\.__pfCollectSessions = gameSessionSummary\.collect/);
  assert.ok(html.indexOf('<script src="game-session-summary.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
