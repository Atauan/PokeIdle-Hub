'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { initializeDevProfile } = require('../dev-profile');

function withAppData(callback) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeidle-dev-bootstrap-'));
  const appDataPath = path.join(tempRoot, 'app-data');
  fs.mkdirSync(appDataPath);
  try {
    const calls = [];
    const app = {
      isPackaged: false,
      getPath(name) { calls.push(`getPath:${name}`); return appDataPath; },
      setName(name) { calls.push(`setName:${name}`); },
      setPath(name, value) { calls.push(`setPath:${name}:${value}`); },
      requestSingleInstanceLock() { calls.push('requestSingleInstanceLock'); return true; },
    };
    callback({ app, calls, appDataPath, profilePath: path.join(appDataPath, 'PokeIdle Hub Dev') });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test('sets the dev name and both storage paths before acquiring the instance lock', () => {
  withAppData(({ app, calls, profilePath }) => {
    const initialized = initializeDevProfile(app);
    const lockIndex = calls.indexOf('requestSingleInstanceLock');

    assert.equal(initialized.lockAcquired, true);
    assert.equal(calls[0], 'setName:PokeIdle Hub Dev');
    assert.ok(calls.findIndex(call => call.startsWith('setPath:userData:')) < lockIndex);
    assert.ok(calls.findIndex(call => call.startsWith('setPath:sessionData:')) < lockIndex);
    assert.equal(initialized.root, profilePath);
    assert.equal(fs.statSync(initialized.sessionDataPath).isDirectory(), true);
  });
});

test('does not reset when the dev instance lock is already held', () => {
  withAppData(({ app, appDataPath, profilePath }) => {
    const profile = require('../dev-profile').ensureDevProfile(appDataPath);
    const userFile = path.join(profilePath, 'preferences.json');
    fs.writeFileSync(userFile, 'keep');
    app.requestSingleInstanceLock = () => false;

    const initialized = initializeDevProfile(app, { reset: true });

    assert.equal(initialized.lockAcquired, false);
    assert.equal(fs.readFileSync(userFile, 'utf8'), 'keep');
  });
});

test('rejects reset in a packaged app before reading or changing profile paths', () => {
  withAppData(({ app, calls }) => {
    app.isPackaged = true;

    assert.throws(() => initializeDevProfile(app, { reset: true }), /empacotado|dev/i);
    assert.deepEqual(calls, []);
  });
});

test('rejects command-line options that redirect profile, cache, logs or crash dumps', () => {
  withAppData(({ app, calls }) => {
    assert.throws(() => initializeDevProfile(app, { argv: ['electron', '.', '--user-data-dir=C:/prod'] }), /caminho|perfil|armazenamento/i);
    assert.deepEqual(calls, []);
  });
});

test('rejects path redirection in a packaged app without touching its profile', () => {
  withAppData(({ app, calls }) => {
    app.isPackaged = true;

    assert.throws(() => initializeDevProfile(app, { argv: ['electron', '.', '--user-data-dir=C:/dev'] }), /redirecionam|perfil/i);
    assert.deepEqual(calls, []);
  });
});

test('rejects Chromium path switches even when they are absent from process arguments', () => {
  withAppData(({ app, calls }) => {
    app.commandLine = { hasSwitch: name => name === 'disk-cache-dir' };

    assert.throws(() => initializeDevProfile(app, { argv: ['electron', '.'] }), /redirecionam|perfil/i);
    assert.deepEqual(calls, []);
  });
});

test('completes reset after obtaining the lock and recreates an empty session directory', () => {
  withAppData(({ app, profilePath }) => {
    const first = initializeDevProfile(app);
    fs.writeFileSync(path.join(first.sessionDataPath, 'cookies.txt'), 'test-cookie');
    fs.writeFileSync(path.join(profilePath, 'preferences.json'), 'test-preference');
    const calls = [];
    app.requestSingleInstanceLock = () => {
      assert.equal(fs.readFileSync(path.join(profilePath, 'preferences.json'), 'utf8'), 'test-preference');
      assert.equal(fs.readFileSync(path.join(first.sessionDataPath, 'cookies.txt'), 'utf8'), 'test-cookie');
      calls.push('lock');
      return true;
    };
    app.setPath = (name, value) => calls.push(`path:${name}:${value}`);

    const initialized = initializeDevProfile(app, { reset: true });

    assert.equal(calls[0], `path:userData:${profilePath}`);
    assert.ok(calls.includes('lock'));
    assert.deepEqual(fs.readdirSync(initialized.sessionDataPath), []);
    assert.deepEqual(fs.readdirSync(profilePath).filter(name => name !== initialized.markerName), ['Session Data']);
  });
});

test('does not reset when acquiring the instance lock throws', () => {
  withAppData(({ app, profilePath }) => {
    const profile = require('../dev-profile').ensureDevProfile(path.dirname(profilePath));
    const userFile = path.join(profilePath, 'preferences.json');
    fs.writeFileSync(userFile, 'keep');
    app.requestSingleInstanceLock = () => { throw new Error('lock failed'); };

    assert.throws(() => initializeDevProfile(app, { reset: true }), /lock failed/);
    assert.equal(fs.readFileSync(userFile, 'utf8'), 'keep');
  });
});
