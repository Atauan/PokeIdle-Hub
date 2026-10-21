'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTrayService } = require('../tray-service');

function setup({ platform = 'win32', isDevelopment = false } = {}) {
  const calls = [];
  const timers = new Map();
  let nextTimerId = 0;
  let now = 1000;
  let mainWindowHidden = false;
  let builtMenu;

  class FakeTray {
    constructor(icon) { this.icon = icon; this.events = new Map(); this.destroyed = false; }
    setToolTip(value) { this.tooltip = value; }
    on(event, callback) { this.events.set(event, callback); }
    emit(event) { this.events.get(event)?.(); }
    popUpContextMenu(menu) { calls.push(['popup-menu', menu]); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; calls.push(['destroy-tray']); }
  }

  const service = createTrayService({
    Tray: FakeTray,
    Menu: { buildFromTemplate: template => { builtMenu = template; return template; } },
    nativeImage: { createFromPath: file => ({ file, resize: size => ({ file, size }) }) },
    app: { quit: () => calls.push(['quit']) },
    getAppIcon: () => '/assets/icon.ico',
    platform,
    isDevelopment,
    showMainWindow: () => calls.push(['show-main']),
    showSessionSummary: () => calls.push(['show-summary']),
    hideSessionSummary: () => calls.push(['hide-summary']),
    isMainWindowHiddenOrMinimized: () => mainWindowHidden,
    onAbout: () => calls.push(['about']),
    now: () => now,
    setTimeoutFn: (callback, delay) => {
      const id = ++nextTimerId;
      timers.set(id, { callback, delay, cleared: false });
      return id;
    },
    clearTimeoutFn: id => {
      const timer = timers.get(id);
      if (timer) timer.cleared = true;
    },
  });

  return {
    service,
    calls,
    timers,
    getMenu: () => builtMenu,
    setMainWindowHidden: value => { mainWindowHidden = value; },
    setNow: value => { now = value; },
  };
}

test('creates platform-sized tray, menu, and debounced single-click behavior', () => {
  const context = setup({ platform: 'darwin', isDevelopment: true });
  const tray = context.service.create();

  assert.deepEqual(tray.icon, { file: '/assets/icon.ico', size: { width: 18, height: 18 } });
  assert.equal(tray.tooltip, 'PokeIdle Hub [DEV]');
  assert.deepEqual(context.getMenu().map(item => item.label || item.type), ['Sobre', 'separator', 'Sair']);
  context.getMenu()[0].click();
  context.getMenu()[2].click();
  assert.deepEqual(context.calls.slice(0, 2), [['about'], ['quit']]);

  tray.emit('click');
  const firstTimer = context.timers.get(1);
  assert.equal(firstTimer.delay, 300);
  context.setMainWindowHidden(true);
  firstTimer.callback();
  assert.deepEqual(context.calls.at(-1), ['show-summary']);

  context.setMainWindowHidden(false);
  tray.emit('click');
  context.timers.get(2).callback();
  assert.deepEqual(context.calls.at(-1), ['show-main']);
});

test('double-click suppresses the following click and right-click clears pending work', () => {
  const context = setup();
  const tray = context.service.create();

  tray.emit('double-click');
  tray.emit('click');
  assert.deepEqual(context.calls, [['show-main']]);
  assert.equal(context.timers.size, 0);

  context.setNow(1501);
  tray.emit('click');
  const pendingTimer = context.timers.get(1);
  tray.emit('right-click');

  assert.equal(pendingTimer.cleared, true);
  assert.deepEqual(context.calls.slice(-2), [
    ['hide-summary'],
    ['popup-menu', context.getMenu()],
  ]);
});

test('tray reference remains available for main-window and shutdown lifecycle', () => {
  const context = setup();
  const tray = context.service.create();

  assert.equal(context.service.getTray(), tray);
  context.service.setTray(null);
  assert.equal(context.service.getTray(), null);
});

test('main composes and packages the tray service without owning tray timers', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /const trayService = createTrayService\(/);
  assert.match(main, /clearTrayClickTimer: \(\) => trayService\.clearClickTimer\(\)/);
  assert.match(main, /getTray: \(\) => trayService\.getTray\(\)/);
  assert.doesNotMatch(main, /let trayClickTimer|let ignoreTrayClickUntil|function createTray\(\) \{[\s\S]*new Tray/);
  assert.ok(packageJson.build.files.includes('tray-service.js'));
});
