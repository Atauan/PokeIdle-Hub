'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSettingsPreferences } = require('../renderer/settings-preferences');

function element({ value = '', checked = false } = {}) {
  const listeners = new Map();
  return {
    value,
    checked,
    disabled: false,
    hidden: false,
    textContent: '',
    listeners,
    addEventListener(type, callback) { listeners.set(type, callback); },
    dispatch(type, event = {}) { return listeners.get(type)?.({ target: this, ...event }); },
  };
}

function setup({
  state = {},
  cleanRam = async () => ({ ok: true, cacheBytesBefore: 1024 * 1024, cacheBytesAfter: 256 * 1024, cacheBytesObservedCleared: 768 * 1024, memoryBeforeBytes: 10 * 1024 * 1024, memoryAfterBytes: 9 * 1024 * 1024, memoryMeasurement: 'private-bytes' }),
  cleanRamError = null,
  platform = 'win32',
  trimHubWorkingSet = async () => ({ ok: true, attempted: 4, trimmed: 4, failed: 0, accessDenied: 0, observedBytesReduced: 2 * 1024 * 1024 }),
  summary = async () => ({ ok: true, sessionDataBytes: 12 * 1024 * 1024, sessionDataPartial: false, httpCacheBytes: 2 * 1024 * 1024, httpCacheAvailable: true, failureCount: 0 }),
  liveRuntime = async () => ({ tileCount: 4, playerChatViews: 6, economyViews: 1, queue: { pending: 2, started: 10, averageWaitMs: 750, maxWaitMs: 1500 } }),
  restartApp = async () => ({ ok: true }),
  confirm = () => true,
} = {}) {
  const elements = new Map([
    ['#cfg-fps-foreground', element()],
    ['#cfg-fps-background', element()],
    ['#cfg-suspend-video', element()],
    ['#cfg-clean-ram-btn', element()],
    ['#cfg-trim-working-set-btn', element()],
    ['#cfg-working-set-result', element()],
    ['#btn-clean-ram', element()],
    ['#cfg-refresh-cache-summary', element()],
    ['#cfg-restart-app-btn', element()],
    ['#cfg-session-data-size', element()],
    ['#cfg-http-cache-size', element()],
    ['#cfg-live-runtime-metrics', element()],
    ['#cfg-cleanup-result', element()],
    ['#panel-lives', { classList: { toggles: [], toggle(...args) { this.toggles.push(args); } } }],
  ]);
  if (cleanRamError) cleanRam = async () => { throw cleanRamError; };
  const effects = { persist: 0, fps: 0, toasts: [], cleanRam: 0, trimHubWorkingSet: 0, summary: 0, liveRuntime: 0, restart: 0, confirmations: [] };
  const preferences = createSettingsPreferences({
    state,
    query: selector => elements.get(selector),
    persist: () => { effects.persist += 1; },
    applyFpsLimits: () => { effects.fps += 1; },
    toast: message => effects.toasts.push(message),
    cleanRam: async () => { effects.cleanRam += 1; return cleanRam(); },
    trimHubWorkingSet: async () => { effects.trimHubWorkingSet += 1; return trimHubWorkingSet(); },
    platform,
    getMaintenanceSummary: async () => { effects.summary += 1; return summary(); },
    getLiveRuntimeMetrics: async () => { effects.liveRuntime += 1; return liveRuntime(); },
    restartApp: async () => { effects.restart += 1; return restartApp(); },
    confirm: message => { effects.confirmations.push(message); return confirm(message); },
  });
  return { preferences, elements, effects, state };
}

test('renders stored performance preferences and preserves defaults', () => {
  const { preferences, elements } = setup({ state: { fpsForeground: 0, fpsBackground: 24, suspendBgVideos: false } });

  preferences.render();

  assert.equal(elements.get('#cfg-fps-foreground').value, '0');
  assert.equal(elements.get('#cfg-fps-background').value, '24');
  assert.equal(elements.get('#cfg-suspend-video').checked, false);

  const defaults = setup();
  defaults.preferences.render();
  assert.equal(defaults.elements.get('#cfg-fps-foreground').value, '30');
  assert.equal(defaults.elements.get('#cfg-fps-background').value, '15');
  assert.equal(defaults.elements.get('#cfg-suspend-video').checked, true);
});

test('changing FPS values persists, reapplies limits, and keeps current toast text', () => {
  const { preferences, elements, effects, state } = setup();
  preferences.setup();

  elements.get('#cfg-fps-foreground').value = '0';
  elements.get('#cfg-fps-foreground').dispatch('change');
  elements.get('#cfg-fps-background').value = '20';
  elements.get('#cfg-fps-background').dispatch('change');

  assert.equal(state.fpsForeground, 0);
  assert.equal(state.fpsBackground, 20);
  assert.equal(effects.persist, 2);
  assert.equal(effects.fps, 2);
  assert.deepEqual(effects.toasts, ['FPS da conta em foco: Sem limite', 'FPS de contas em segundo plano: 20 FPS']);
});

test('changing background video suspension updates state, storage, class, and feedback', () => {
  const { preferences, elements, effects, state } = setup();
  preferences.setup();
  elements.get('#cfg-suspend-video').checked = false;

  elements.get('#cfg-suspend-video').dispatch('change');

  assert.equal(state.suspendBgVideos, false);
  assert.equal(effects.persist, 1);
  assert.deepEqual(elements.get('#panel-lives').classList.toggles, [['suspend-bg', false]]);
  assert.deepEqual(effects.toasts, ['Suspensão de vídeo desativada.']);
});

test('maintenance summary distinguishes session-data folder size from clearable HTTP cache', async () => {
  const { preferences, elements } = setup();
  await preferences.refreshMaintenanceSummary();

  assert.match(elements.get('#cfg-session-data-size').textContent, /^12 MB \(dados totais/);
  assert.equal(elements.get('#cfg-http-cache-size').textContent, '2 MB estimados para limpeza');
});

test('maintenance summary shows aggregate live view and queue metrics', async () => {
  const { preferences, elements } = setup();
  await preferences.refreshMaintenanceSummary();

  assert.equal(elements.get('#cfg-live-runtime-metrics').textContent,
    '4 tiles · 6 players/chats anexados · 1 view econômica · fila: 2 pendentes · espera média 750 ms, pico 1.500 ms (10 inícios desde a abertura)');
});

test('cleanup disables both buttons, reports measured results, and refreshes sizes', async () => {
  let resolveCleanup;
  const context = setup({ cleanRam: () => new Promise(resolve => { resolveCleanup = resolve; }) });
  context.preferences.setup();

  const pending = context.preferences.cleanNow();
  assert.equal(context.elements.get('#cfg-clean-ram-btn').disabled, true);
  assert.equal(context.elements.get('#btn-clean-ram').disabled, true);
  resolveCleanup({ ok: true, cacheBytesBefore: 1024 * 1024, cacheBytesAfter: 256 * 1024, cacheBytesObservedCleared: 768 * 1024, memoryBeforeBytes: 10 * 1024 * 1024, memoryAfterBytes: 9 * 1024 * 1024, memoryMeasurement: 'private-bytes' });
  await pending;

  assert.equal(context.elements.get('#cfg-clean-ram-btn').disabled, false);
  assert.equal(context.elements.get('#btn-clean-ram').disabled, false);
  assert.match(context.elements.get('#cfg-cleanup-result').textContent, /Cache HTTP.*768 KB/);
  assert.match(context.elements.get('#cfg-cleanup-result').textContent, /10 MB.*9 MB/);
  assert.equal(context.effects.summary, 2);
  assert.match(context.effects.toasts[0], /Cache HTTP: 768 KB de redução observada/);
  assert.match(context.effects.toasts[0], /logins e dados persistentes foram preservados/i);
});

test('settings module binds the quick cleanup button without an app-level listener', async () => {
  const context = setup();
  context.preferences.setup();

  context.elements.get('#btn-clean-ram').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(context.effects.cleanRam, 1);
  assert.equal(context.elements.get('#btn-clean-ram').disabled, false);
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /\$\('#btn-clean-ram'\)\?\.addEventListener/);
});

test('working-set cleanup is separate, reports only observed reduction, and warns memory can return', async () => {
  let resolveTrim;
  const context = setup({ trimHubWorkingSet: () => new Promise(resolve => { resolveTrim = resolve; }) });
  context.preferences.setup();

  const pending = context.preferences.trimWorkingSetNow();
  assert.equal(context.elements.get('#cfg-trim-working-set-btn').disabled, true);
  resolveTrim({ ok: true, attempted: 4, trimmed: 4, failed: 0, accessDenied: 0, observedBytesReduced: 2 * 1024 * 1024 });
  await pending;

  assert.equal(context.elements.get('#cfg-trim-working-set-btn').disabled, false);
  assert.equal(context.effects.cleanRam, 0);
  assert.equal(context.effects.trimHubWorkingSet, 1);
  assert.match(context.elements.get('#cfg-working-set-result').textContent, /2 MB de redução observada/);
  assert.match(context.elements.get('#cfg-working-set-result').textContent, /4 de 4 processos atendidos/);
  assert.match(context.elements.get('#cfg-working-set-result').textContent, /pode voltar a ser residente/i);
});

test('working-set cleanup reports partial access failures and stays disabled outside Windows', async () => {
  const partial = setup({ trimHubWorkingSet: async () => ({ ok: false, partial: true, attempted: 3, trimmed: 2, failed: 1, accessDenied: 1, observedBytesReduced: 1024 }) });
  await partial.preferences.trimWorkingSetNow();
  assert.match(partial.elements.get('#cfg-working-set-result').textContent, /Redução parcial/);
  assert.match(partial.elements.get('#cfg-working-set-result').textContent, /acesso negado em 1/);

  const unsupported = setup({ platform: 'linux' });
  unsupported.preferences.setup();
  assert.equal(unsupported.elements.get('#cfg-trim-working-set-btn').disabled, true);
  await unsupported.preferences.trimWorkingSetNow();
  assert.equal(unsupported.effects.trimHubWorkingSet, 0);
  assert.match(unsupported.elements.get('#cfg-working-set-result').textContent, /somente no Windows/);
});

test('cleanup waits for a pre-existing size scan and refreshes its post-clean measurements', async () => {
  let resolveFirstSummary;
  let summaryCalls = 0;
  const context = setup({
    summary: () => {
      summaryCalls += 1;
      if (summaryCalls === 1) return new Promise(resolve => { resolveFirstSummary = resolve; });
      return Promise.resolve({ ok: true, sessionDataBytes: 20 * 1024 * 1024, sessionDataPartial: false, httpCacheBytes: 100, httpCacheAvailable: true, failureCount: 0 });
    },
  });
  context.preferences.render();
  const cleanup = context.preferences.cleanNow();
  await Promise.resolve();
  await Promise.resolve();
  resolveFirstSummary({ ok: true, sessionDataBytes: 12 * 1024 * 1024, sessionDataPartial: false, httpCacheBytes: 2 * 1024 * 1024, httpCacheAvailable: true, failureCount: 0 });
  await cleanup;

  assert.equal(summaryCalls, 2);
  assert.match(context.elements.get('#cfg-session-data-size').textContent, /^20 MB/);
});

test('partial cleanup and measurement failure are reported without false success', async () => {
  const partial = setup({ cleanRam: async () => ({ ok: false, partial: true, cacheFailures: 1, cacheBytesObservedCleared: 10 }) });
  await partial.preferences.cleanNow();
  assert.match(partial.elements.get('#cfg-cleanup-result').textContent, /parcial/);
  assert.match(partial.effects.toasts[0], /parcial/);

  const failed = setup({ cleanRamError: new Error('failure') });
  await failed.preferences.cleanNow();
  assert.match(failed.effects.toasts[0], /Falha/);
  assert.equal(failed.elements.get('#cfg-clean-ram-btn').disabled, false);
});

test('restart requires confirmation and uses a separate explicit action', async () => {
  const rejected = setup({ confirm: () => false });
  rejected.preferences.setup();
  await rejected.elements.get('#cfg-restart-app-btn').dispatch('click');
  assert.equal(rejected.effects.restart, 0);
  assert.equal(rejected.effects.confirmations.length, 1);

  const accepted = setup();
  accepted.preferences.setup();
  await accepted.elements.get('#cfg-restart-app-btn').dispatch('click');
  assert.equal(accepted.effects.restart, 1);
});
