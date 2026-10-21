'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const cockpitIpc = fs.readFileSync(path.join(__dirname, '..', 'rotom-cockpit-ipc.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(__dirname, '..', 'app-lifecycle.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

test('main IPC authorizes cockpit creation and delegates both account-scoped routes', () => {
  assert.match(main, /const rotomCockpitService = createRotomCockpitService\(/);
  assert.match(main, /registerRotomCockpitHandlers\(\{\s*ipcMain,\s*isMainWindowAuthorized: fromMainWindow,\s*rotomCockpitService/);
  assert.match(cockpitIpc, /ipcMain\.handle\('open-rotom-cockpit',[\s\S]*?if \(!isMainWindowAuthorized\(event\)\) return \{ ok: false, error: 'Unauthorized' \};[\s\S]*?rotomCockpitService\.openCockpit\(payload\.accId, payload\.accName\)/);
  assert.match(cockpitIpc, /ipcMain\.on\('rotom-to-game', \(event, payload\) => \{\s*rotomCockpitService\.forwardToGame\(event, payload\);/);
  assert.match(cockpitIpc, /ipcMain\.on\('rotom-from-webview', \(event, payload\) => \{\s*if \(!isMainWindowAuthorized\(event\)[\s\S]*?rotomCockpitService\.forwardFromGame\(payload\.accId, payload\.data\)/);
  assert.match(main, /registerAppLifecycle\([\s\S]*?rotomCockpitService/);
  assert.match(lifecycle, /before-quit'[\s\S]*?rotomCockpitService\.closeAll\(\)/);
  assert.doesNotMatch(main, /cockpitWindows|function openRotomCockpitWindow/);
  assert.ok(packageJson.build.files.includes('rotom-cockpit-service.js'));
  assert.ok(packageJson.build.files.includes('rotom-cockpit-ipc.js'));
});
