'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createUpdateDownloadService, getBestUpdateAsset, isRunningAsPortable } = require('../update-download-service');

function setup({ platform = 'win32', development = false, portable = false, release = null, fetchImpl, exists = true } = {}) {
  const handlers = new Map();
  const effects = { progress: [], writes: [], spawns: [], quit: 0, external: [], opened: [], reveal: [] };
  const window = { webContents: { send: (...args) => effects.progress.push(args) } };
  const service = createUpdateDownloadService({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler), on: (channel, handler) => handlers.set(channel, handler) },
    isAuthorized: event => event.authorized === true,
    isDevelopment: development,
    platform,
    getRelease: () => release,
    getPortableStatus: () => portable,
    isRunningAsPortable: () => portable,
    getDownloadsPath: () => 'C:/Downloads',
    joinPath: (...parts) => parts.join('/'),
    fetch: fetchImpl || (async () => ({ ok: true, status: 200, headers: { get: () => '3' }, body: { getReader: () => ({ read: async () => ({ done: true }) }) } })),
    createWriteStream: filePath => ({ write: data => effects.writes.push([filePath, data.toString()]), end: callback => callback() }),
    existsSync: () => exists,
    spawn: (...args) => { effects.spawns.push(args); return { unref: () => { effects.unref = true; } }; },
    setTimeoutFn: (callback, delay) => { effects.quitLater = { callback, delay }; },
    app: { quit: () => { effects.quit += 1; } },
    shell: { openExternal: async url => { effects.external.push(url); }, openPath: async filePath => { effects.opened.push(filePath); } },
    getMainWindow: () => window,
  });
  return { handlers, effects, window, service };
}

test('selects platform assets with the existing portable/setup precedence', () => {
  const assets = [
    { name: 'PokeIdle-Hub-Setup.exe', url: 'setup' },
    { name: 'PokeIdle-Hub-Portable.exe', url: 'portable' },
  ];
  assert.equal(getBestUpdateAsset(assets, 'win32', true).url, 'portable');
  assert.equal(getBestUpdateAsset(assets, 'win32', false).url, 'setup');
  assert.equal(getBestUpdateAsset([{ name: 'app.dmg' }, { name: 'app.zip' }], 'darwin', false).name, 'app.dmg');
  assert.equal(getBestUpdateAsset([{ name: 'app.AppImage' }, { name: 'app.deb' }], 'linux', false).name, 'app.AppImage');
  assert.equal(getBestUpdateAsset([], 'win32', false), null);
});

test('detects portable runtime from packaged environment or executable name', () => {
  assert.equal(isRunningAsPortable({ env: { PORTABLE_EXECUTABLE_DIR: 'C:/app' }, getExecutablePath: () => 'app.exe' }), true);
  assert.equal(isRunningAsPortable({ env: {}, getExecutablePath: () => 'C:/app/PokeIdle-Portable.exe' }), true);
  assert.equal(isRunningAsPortable({ env: {}, getExecutablePath: () => 'C:/app/PokeIdle.exe' }), false);
});

test('authorizes update IPC, reports target, and downloads with progress', async () => {
  const release = { version: '3.2.0', url: 'https://github.com/release', assets: [
    { name: 'PokeIdle-Hub-Portable.exe', url: 'https://github.com/portable', size: 3 },
  ] };
  const context = setup({ portable: true, release, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://github.com/portable');
    assert.equal(options.headers['User-Agent'], 'PokeIdleHub-Updater');
    return {
      ok: true,
      status: 200,
      headers: { get: () => '3' },
      body: { getReader: () => {
        let sent = false;
        return { read: async () => sent ? { done: true } : (sent = true, { done: false, value: new Uint8Array([1, 2, 3]) }) };
      } },
    };
  } });
  const authorized = { authorized: true };
  assert.deepEqual(await context.handlers.get('get-update-target')(authorized), {
    isPortable: true, platform: 'win32', assetName: 'PokeIdle-Hub-Portable.exe', assetSize: 3,
  });
  assert.deepEqual(await context.handlers.get('download-update')(authorized), {
    ok: true,
    filePath: 'C:/Downloads/PokeIdle-Hub-Portable.exe',
    fileName: 'PokeIdle-Hub-Portable.exe',
    isPortable: true,
    version: '3.2.0',
  });
  assert.deepEqual(context.effects.writes, [['C:/Downloads/PokeIdle-Hub-Portable.exe', '\u0001\u0002\u0003']]);
  assert.deepEqual(context.effects.progress[0], ['update-download-progress', {
    percent: 100, downloadedBytes: 3, totalBytes: 3, fileName: 'PokeIdle-Hub-Portable.exe',
  }]);
  assert.deepEqual(await context.handlers.get('open-update')(authorized), true);
  assert.deepEqual(context.effects.external, ['https://github.com/release']);
  assert.deepEqual(await context.handlers.get('get-update-target')({ authorized: false }), null);
});

test('retains dev and missing-release errors and supports cancellation', async () => {
  const dev = setup({ development: true });
  assert.deepEqual(await dev.handlers.get('download-update')({ authorized: true }), {
    ok: false, error: 'Atualizações não estão disponíveis em dev.',
  });
  assert.equal(await dev.handlers.get('cancel-download-update')({ authorized: true }), false);

  const absent = setup();
  assert.deepEqual(await absent.handlers.get('download-update')({ authorized: true }), {
    ok: false, error: 'Nenhuma versão disponível',
  });

  let rejectFetch;
  const downloading = setup({ release: { version: '3.2.0', assets: [{ name: 'a.exe', url: 'https://example.test/a.exe' }] }, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    rejectFetch = reject;
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  }) });
  const result = downloading.handlers.get('download-update')({ authorized: true });
  assert.equal(downloading.handlers.get('cancel-download-update')({ authorized: true }), true);
  assert.deepEqual(await result, { ok: false, aborted: true });
  assert.equal(rejectFetch instanceof Function, true);
});

test('installs only an existing file and uses the platform-specific action', async () => {
  const win = setup({ platform: 'win32' });
  assert.equal(await win.handlers.get('install-update')({ authorized: true }, 'C:/Downloads/update.exe'), true);
  assert.deepEqual(win.effects.spawns, [['C:/Downloads/update.exe', [], { detached: true, stdio: 'ignore' }]]);
  assert.equal(win.effects.unref, true);
  assert.equal(win.effects.quitLater.delay, 800);
  win.effects.quitLater.callback();
  assert.equal(win.effects.quit, 1);

  const mac = setup({ platform: 'darwin' });
  assert.equal(await mac.handlers.get('install-update')({ authorized: true }, '/tmp/update.dmg'), true);
  assert.deepEqual(mac.effects.opened, ['/tmp/update.dmg']);
  assert.equal(await mac.handlers.get('install-update')({ authorized: false }, '/tmp/update.dmg'), false);
  const missing = setup({ exists: false });
  assert.equal(await missing.handlers.get('install-update')({ authorized: true }, '/tmp/missing.exe'), false);
});
