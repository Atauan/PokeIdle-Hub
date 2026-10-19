'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  ensureDevProfile,
  initializeDevProfile,
} = require('../dev-profile');

function withTempAppData(callback) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeidle-dev-profile-'));
  const appDataPath = path.join(tempRoot, 'app-data');
  fs.mkdirSync(appDataPath);
  try {
    callback({ tempRoot, appDataPath, profilePath: path.join(appDataPath, 'PokeIdle Hub Dev') });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function resetProfile(appDataPath) {
  const app = {
    isPackaged: false,
    setName() {},
    getPath() { return appDataPath; },
    setPath() {},
    requestSingleInstanceLock() { return true; },
  };
  return initializeDevProfile(app, { reset: true });
}

test('first run creates only the fixed development profile and its marker', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    const profile = ensureDevProfile(appDataPath);

    assert.equal(profile.root, profilePath);
    assert.equal(fs.statSync(profilePath).isDirectory(), true);
    assert.equal(fs.readdirSync(profilePath).includes(profile.markerName), true);
  });
});

test('refuses to adopt a non-empty directory without a valid marker', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    fs.mkdirSync(profilePath);
    const userFile = path.join(profilePath, 'important.txt');
    fs.writeFileSync(userFile, 'keep');

    assert.throws(() => ensureDevProfile(appDataPath), /marcador|perfil/i);
    assert.equal(fs.readFileSync(userFile, 'utf8'), 'keep');
  });
});

test('refuses a development profile redirected through a symlink or junction', () => {
  withTempAppData(({ appDataPath, tempRoot, profilePath }) => {
    const redirectedPath = path.join(tempRoot, 'redirected-profile');
    fs.mkdirSync(redirectedPath);
    fs.writeFileSync(path.join(redirectedPath, 'keep.txt'), 'keep');
    fs.symlinkSync(redirectedPath, profilePath, process.platform === 'win32' ? 'junction' : 'dir');

    assert.throws(() => ensureDevProfile(appDataPath), /redirecion|simb[oó]lic|link/i);
    assert.equal(fs.readFileSync(path.join(redirectedPath, 'keep.txt'), 'utf8'), 'keep');
  });
});

test('normal startup refuses a profile whose previous reset did not finish', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    const profile = ensureDevProfile(appDataPath);
    const markerPath = path.join(profilePath, profile.markerName);
    fs.writeFileSync(markerPath, JSON.stringify({ profile: 'pokeidle-hub-dev', format: 1, state: 'resetting' }));

    assert.throws(() => ensureDevProfile(appDataPath), /reset|incompleto/i);
    assert.equal(resetProfile(appDataPath).root, profilePath);
  });
});

test('reset removes profile data, preserves only runtime lock files and leaves sibling data intact', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    ensureDevProfile(appDataPath);
    fs.writeFileSync(path.join(profilePath, 'preferences.json'), '{"theme":"dark"}');
    fs.writeFileSync(path.join(profilePath, 'SingletonCookie'), 'runtime-lock');
    fs.writeFileSync(path.join(appDataPath, 'production-data.txt'), 'production');

    const profile = resetProfile(appDataPath);

    assert.deepEqual(fs.readdirSync(profilePath).sort(), [profile.markerName, 'Session Data', 'SingletonCookie'].sort());
    assert.equal(fs.readFileSync(path.join(profilePath, 'SingletonCookie'), 'utf8'), 'runtime-lock');
    assert.deepEqual(fs.readdirSync(path.join(profilePath, 'Session Data')), []);
    assert.equal(fs.readFileSync(path.join(appDataPath, 'production-data.txt'), 'utf8'), 'production');
    assert.equal(ensureDevProfile(appDataPath).root, profilePath);
  });
});

test('reset rejects a modified marker before deleting profile data', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    const profile = ensureDevProfile(appDataPath);
    const userFile = path.join(profilePath, 'preferences.json');
    fs.writeFileSync(userFile, 'keep');
    fs.writeFileSync(path.join(profilePath, profile.markerName), '{"format":99,"state":"ready"}');

    assert.throws(() => resetProfile(appDataPath), /marcador|perfil/i);
    assert.equal(fs.readFileSync(userFile, 'utf8'), 'keep');
  });
});

test('refuses a redirected session-data directory before opening the app lock', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    const profile = ensureDevProfile(appDataPath);
    const outsidePath = path.join(path.dirname(profilePath), 'outside-session-data');
    fs.mkdirSync(outsidePath);
    fs.symlinkSync(outsidePath, path.join(profilePath, 'Session Data'), process.platform === 'win32' ? 'junction' : 'dir');

    const { initializeDevProfile } = require('../dev-profile');
    const calls = [];
    const app = {
      isPackaged: false,
      setName() {},
      getPath() { return appDataPath; },
      setPath() {},
      requestSingleInstanceLock() { calls.push('lock'); return true; },
    };

    assert.throws(() => initializeDevProfile(app), /sess[oõ]es dev.*redirecionad/i);
    assert.deepEqual(calls, []);
    assert.equal(fs.existsSync(profile.marker), true);
  });
});

test('reset removes a nested symlink or junction without following it outside the profile', () => {
  withTempAppData(({ appDataPath, tempRoot, profilePath }) => {
    ensureDevProfile(appDataPath);
    const outsidePath = path.join(tempRoot, 'outside');
    fs.mkdirSync(outsidePath);
    fs.writeFileSync(path.join(outsidePath, 'keep.txt'), 'keep');
    fs.symlinkSync(outsidePath, path.join(profilePath, 'external'), process.platform === 'win32' ? 'junction' : 'dir');

    resetProfile(appDataPath);

    assert.equal(fs.existsSync(path.join(outsidePath, 'keep.txt')), true);
    assert.equal(fs.existsSync(path.join(profilePath, 'external')), false);
  });
});
