'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const rendererRoot = path.join(root, 'renderer');
const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('renderer entrypoint references existing scripts and loads feature modules before app composition', () => {
  const scriptSources = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/g)]
    .map(match => match[1]);
  const appIndexes = scriptSources
    .map((source, index) => source === 'app.js' ? index : -1)
    .filter(index => index >= 0);

  assert.ok(scriptSources.length > 0, 'index.html must declare renderer scripts');
  assert.equal(appIndexes.length, 1, 'app.js must be loaded exactly once');
  for (const source of scriptSources) {
    assert.ok(fs.existsSync(path.resolve(rendererRoot, source)), `missing renderer script: ${source}`);
  }

  const appIndex = appIndexes[0];
  for (let index = 0; index < appIndex; index += 1) {
    assert.notEqual(scriptSources[index], 'updates.js');
    assert.notEqual(scriptSources[index], 'src/modules/farm-afk.js');
  }
  assert.ok(scriptSources.includes('src/modules/farm-afk.js'));
  assert.ok(scriptSources.includes('updates.js'));
  assert.ok(scriptSources.indexOf('live-platforms.js') < appIndex, 'live platform catalog must load before app composition');
  assert.ok(scriptSources.indexOf('app-state.js') < appIndex, 'app state module must load before app composition');
  assert.ok(scriptSources.indexOf('app-toast.js') < appIndex, 'toast module must load before app composition');
  assert.ok(scriptSources.indexOf('app-storage.js') < appIndex, 'storage module must load before app composition');
  assert.ok(scriptSources.indexOf('app-element-factory.js') < appIndex, 'DOM element factory must load before app composition');
  assert.ok(scriptSources.indexOf('live-state.js') < appIndex, 'live state policy must load before app composition');
  assert.ok(packageJson.build.files.includes('renderer/**'), 'electron-builder must package active renderer modules');
});
