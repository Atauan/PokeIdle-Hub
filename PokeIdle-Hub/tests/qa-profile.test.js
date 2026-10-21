'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { initializeQaProfile } = require('../qa-profile');

function withTempAppData(callback) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeidle-qa-profile-'));
  const appDataPath = path.join(tempRoot, 'app-data');
  fs.mkdirSync(appDataPath);
  try {
    callback({ tempRoot, appDataPath, profilePath: path.join(appDataPath, 'PokeIdle Hub QA Isolado') });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function createApp(appDataPath, { isPackaged = true, argv = [] } = {}) {
  const calls = [];
  return {
    isPackaged,
    commandLine: { hasSwitch: () => false },
    setName: name => calls.push(['setName', name]),
    getPath: name => name === 'appData' ? appDataPath : null,
    setPath: (name, value) => calls.push(['setPath', name, value]),
    requestSingleInstanceLock: () => true,
    calls,
    argv,
  };
}

test('creates an isolated QA profile and redirects Electron storage before app start', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    const app = createApp(appDataPath);
    const result = initializeQaProfile(app, { argv: app.argv });

    assert.equal(result.root, profilePath);
    assert.equal(result.lockAcquired, true);
    assert.equal(fs.statSync(path.join(profilePath, 'Session Data')).isDirectory(), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(result.marker, 'utf8')), {
      profile: 'pokeidle-hub-qa', format: 1, state: 'ready',
    });
    assert.deepEqual(app.calls.filter(call => call[0] === 'setPath'), [
      ['setPath', 'userData', profilePath],
      ['setPath', 'sessionData', path.join(profilePath, 'Session Data')],
    ]);
  });
});

test('reuses QA data without deleting it on subsequent starts', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    const first = initializeQaProfile(createApp(appDataPath));
    const savedFile = path.join(profilePath, 'qa-session.txt');
    fs.writeFileSync(savedFile, 'keep');

    const second = initializeQaProfile(createApp(appDataPath));

    assert.equal(second.root, first.root);
    assert.equal(fs.readFileSync(savedFile, 'utf8'), 'keep');
  });
});

test('refuses to adopt a non-empty QA directory without its marker', () => {
  withTempAppData(({ appDataPath, profilePath }) => {
    fs.mkdirSync(profilePath);
    const savedFile = path.join(profilePath, 'unknown.txt');
    fs.writeFileSync(savedFile, 'keep');

    assert.throws(() => initializeQaProfile(createApp(appDataPath)), /marcador|perfil/i);
    assert.equal(fs.readFileSync(savedFile, 'utf8'), 'keep');
  });
});

test('refuses redirected, development, reset, and profile-path-override startup', () => {
  withTempAppData(({ tempRoot, appDataPath, profilePath }) => {
    const external = path.join(tempRoot, 'external');
    fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, 'keep.txt'), 'keep');
    fs.symlinkSync(external, profilePath, process.platform === 'win32' ? 'junction' : 'dir');

    assert.throws(() => initializeQaProfile(createApp(appDataPath)), /redirecion|simb[oó]lic|link/i);
    assert.throws(() => initializeQaProfile(createApp(appDataPath, { isPackaged: false })), /empacotado/i);
    assert.throws(() => initializeQaProfile(createApp(appDataPath), { reset: true }), /reset/i);
    assert.throws(() => initializeQaProfile(createApp(appDataPath), { argv: ['--user-data-dir=C:/prod'] }), /redirecionam/i);
    assert.equal(fs.readFileSync(path.join(external, 'keep.txt'), 'utf8'), 'keep');
  });
});
