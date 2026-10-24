'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function resolveLocalDependency(fromFile, request) {
  const basePath = path.resolve(path.dirname(fromFile), request);
  const candidates = [basePath, `${basePath}.js`, `${basePath}.json`, path.join(basePath, 'index.js')];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function getLocalDependencyClosure(entryFiles) {
  const visited = new Set();
  const pending = entryFiles.map(file => path.join(root, file));

  while (pending.length) {
    const currentFile = pending.pop();
    if (visited.has(currentFile)) continue;
    visited.add(currentFile);

    const source = fs.readFileSync(currentFile, 'utf8');
    for (const [, request] of source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!request.startsWith('.')) continue;
      const dependency = resolveLocalDependency(currentFile, request);
      assert.ok(dependency, `${path.relative(root, currentFile)} requires missing local file ${request}`);
      pending.push(dependency);
    }
  }

  return [...visited].map(file => path.relative(root, file).replaceAll(path.sep, '/'));
}

function isIncludedByBuilder(relativeFile) {
  return packageJson.build.files.some(pattern => {
    const normalizedPattern = pattern.replaceAll('\\', '/');
    if (normalizedPattern === relativeFile) return true;
    if (normalizedPattern.endsWith('/**')) {
      return relativeFile.startsWith(normalizedPattern.slice(0, -2));
    }
    return false;
  });
}

test('electron-builder includes the local dependency closure of main and preload', () => {
  const dependencies = getLocalDependencyClosure(['main.js', 'preload.js', 'webview-preload.js']);
  const missing = dependencies.filter(file => !isIncludedByBuilder(file));

  assert.deepEqual(missing, [], `unpackaged local dependencies: ${missing.join(', ')}`);
});

test('development and distribution commands rebuild the generated Rotom addon before launch or packaging', () => {
  for (const name of ['start', 'dev', 'dev:reset', 'dist:mac', 'dist:win', 'dist:win:qa', 'dist:linux', 'dist']) {
    assert.match(packageJson.scripts[name], /node tools\/build-rotom\.js/, `${name} should rebuild rotom-addon.js`);
  }
});
