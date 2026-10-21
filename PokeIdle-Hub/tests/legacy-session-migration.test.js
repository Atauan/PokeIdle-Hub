'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { migrateLegacySessions } = require('../legacy-session-migration');

function withTemporaryRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeidle-legacy-migration-'));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function write(root, relativePath, contents = 'data') {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function currentUserData(root) {
  const userDataPath = path.join(root, 'app-data', 'PokeIdle Hub');
  fs.mkdirSync(userDataPath, { recursive: true });
  return userDataPath;
}

test('imports portable legacy local storage and account partitions before sibling candidates', () => {
  withTemporaryRoot(root => {
    const userDataPath = currentUserData(root);
    const portableExecutableDir = path.join(root, 'portable-app');
    const portableData = path.join(portableExecutableDir, 'data');
    const siblingPokeFarm = path.join(path.dirname(userDataPath), 'PokeFarm');

    write(portableData, 'Local Storage/leveldb/000001.log', 'portable-storage');
    write(portableData, 'Partitions/pokefarm/Cookies', 'primary-cookie');
    write(portableData, 'Partitions/pokefarm-acc-new/Cookies', 'secondary-cookie');
    write(portableData, 'Partitions/pokeidlehub-acc-third/Cookies', 'renamed-cookie');
    write(siblingPokeFarm, 'Local Storage/leveldb/sibling.log', 'sibling-storage');
    write(siblingPokeFarm, 'Partitions/pokefarm/Cookies', 'sibling-cookie');
    write(userDataPath, 'Partitions/pokeidlehub-acc-new/Cookies', 'keep-existing');

    migrateLegacySessions({ userDataPath, portableExecutableDir });

    assert.equal(fs.readFileSync(path.join(userDataPath, 'Local Storage/leveldb/000001.log'), 'utf8'), 'portable-storage');
    assert.equal(fs.existsSync(path.join(userDataPath, 'Local Storage/leveldb/sibling.log')), false);
    assert.equal(fs.readFileSync(path.join(userDataPath, 'Partitions/pokeidlehub/Cookies'), 'utf8'), 'primary-cookie');
    assert.equal(fs.readFileSync(path.join(userDataPath, 'Partitions/pokeidlehub-acc-new/Cookies'), 'utf8'), 'keep-existing');
    assert.equal(fs.readFileSync(path.join(userDataPath, 'Partitions/pokeidlehub-acc-third/Cookies'), 'utf8'), 'renamed-cookie');
  });
});

test('does not copy legacy local storage over an existing LevelDB with more than two entries', () => {
  withTemporaryRoot(root => {
    const userDataPath = currentUserData(root);
    const legacyDir = path.join(path.dirname(userDataPath), 'PokeFarm');
    write(userDataPath, 'Local Storage/leveldb/one', '1');
    write(userDataPath, 'Local Storage/leveldb/two', '2');
    write(userDataPath, 'Local Storage/leveldb/three', '3');
    write(userDataPath, 'Local Storage/current-setting', 'current');
    write(legacyDir, 'Local Storage/legacy-setting', 'legacy');
    write(legacyDir, 'Partitions/pokefarm/Cookies', 'legacy-cookie');

    migrateLegacySessions({ userDataPath });

    assert.equal(fs.readFileSync(path.join(userDataPath, 'Local Storage/current-setting'), 'utf8'), 'current');
    assert.equal(fs.existsSync(path.join(userDataPath, 'Local Storage/legacy-setting')), false);
    assert.equal(fs.readFileSync(path.join(userDataPath, 'Partitions/pokeidlehub/Cookies'), 'utf8'), 'legacy-cookie');
  });
});

test('copies legacy local storage when the current LevelDB has exactly two entries', () => {
  withTemporaryRoot(root => {
    const userDataPath = currentUserData(root);
    const legacyDir = path.join(path.dirname(userDataPath), 'pokefarm');
    write(userDataPath, 'Local Storage/leveldb/one', '1');
    write(userDataPath, 'Local Storage/leveldb/two', '2');
    write(legacyDir, 'Local Storage/imported-setting', 'legacy');

    migrateLegacySessions({ userDataPath });

    assert.equal(fs.readFileSync(path.join(userDataPath, 'Local Storage/imported-setting'), 'utf8'), 'legacy');
  });
});

test('searches the final legacy sibling directory when earlier candidates are absent', () => {
  withTemporaryRoot(root => {
    const userDataPath = currentUserData(root);
    const legacyDir = path.join(path.dirname(userDataPath), 'PokeFarm-Hub');
    write(legacyDir, 'Local Storage/imported-setting', 'last-candidate');

    migrateLegacySessions({ userDataPath });

    assert.equal(fs.readFileSync(path.join(userDataPath, 'Local Storage/imported-setting'), 'utf8'), 'last-candidate');
  });
});

test('normalizes legacy partition names inside the current profile without overwriting destinations', () => {
  withTemporaryRoot(root => {
    const userDataPath = currentUserData(root);
    write(userDataPath, 'Partitions/pokefarm/Cookies', 'main');
    write(userDataPath, 'Partitions/pokefarm-acc-old/Cookies', 'old-secondary');
    write(userDataPath, 'Partitions/pokeidlehub-acc-kept/Cookies', 'keep-current');
    write(userDataPath, 'Partitions/pokefarm-acc-kept/Cookies', 'do-not-overwrite');

    migrateLegacySessions({ userDataPath });

    assert.equal(fs.readFileSync(path.join(userDataPath, 'Partitions/pokeidlehub/Cookies'), 'utf8'), 'main');
    assert.equal(fs.readFileSync(path.join(userDataPath, 'Partitions/pokeidlehub-acc-old/Cookies'), 'utf8'), 'old-secondary');
    assert.equal(fs.readFileSync(path.join(userDataPath, 'Partitions/pokeidlehub-acc-kept/Cookies'), 'utf8'), 'keep-current');
  });
});

test('main invokes migration only for packaged startup and includes the module in the build', () => {
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const lifecycle = fs.readFileSync(path.join(root, 'app-lifecycle.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /registerAppLifecycle\([\s\S]*?migrateLegacySessions/);
  assert.match(lifecycle, /if \(app\.isPackaged && !qaBuild\) \{\s*migrateLegacySessions\(\{\s*userDataPath: app\.getPath\('userData'\)/);
  assert.doesNotMatch(main, /function migrateLegacySessions\(/);
  assert.ok(packageJson.build.files.includes('legacy-session-migration.js'));
});
