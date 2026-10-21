'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'session-maintenance-service.js'), 'utf8');
const workingSetService = fs.readFileSync(path.join(root, 'hub-working-set-cleanup-service.js'), 'utf8');
const workingSetTrimmer = fs.readFileSync(path.join(root, 'windows-working-set-trimmer.js'), 'utf8');
const nativeTrimmer = fs.readFileSync(path.join(root, 'tools', 'win-memory-trimmer.cs'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
const settingsPreferences = fs.readFileSync(path.join(root, 'renderer', 'settings-preferences.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('main delegates account session maintenance with trusted sender and current session registry', () => {
  assert.match(main, /registerSessionMaintenanceHandlers\(\{[\s\S]*?isTrustedSender: fromApp,[\s\S]*?primaryPartition: PARTITION,[\s\S]*?configuredPartitions: configuredSessions/);
  for (const channel of ['clear-account', 'open-data-dir', 'session-maintenance-summary', 'clean-ram', 'restart-app']) {
    assert.match(service, new RegExp(`'${channel}'`));
  }
  assert.match(main, /getAppMetrics: \(\) => app\.getAppMetrics\(\)/);
  assert.match(main, /registerHubWorkingSetCleanupHandler\(\{[\s\S]*?trimProcesses: processes => trimHubWorkingSet\(processes\)/);
  assert.match(workingSetService, /ipcMain\.handle\('trim-hub-working-set', event => service\.trim\(event\)\)/);
  assert.match(workingSetService, /isTrustedSender\(event\)/);
  assert.match(workingSetTrimmer, /windowsHide: true, stdio: \['pipe', 'pipe', 'pipe'\]/);
  assert.doesNotMatch(workingSetTrimmer, /shell:\s*true/);
  assert.match(nativeTrimmer, /ProcessSetQuota\s*=\s*0x0100/);
  assert.match(nativeTrimmer, /ProcessQueryLimitedInformation\s*=\s*0x1000/);
  assert.match(nativeTrimmer, /EmptyWorkingSet\(handle\)/);
  assert.match(nativeTrimmer, /GetProcessTimes\(handle/);
  assert.doesNotMatch(nativeTrimmer, /SeDebugPrivilege|PROCESS_ALL_ACCESS|runas/i);
  assert.match(main, /relaunch: \(\) => \{\s*app\.relaunch\(\);\s*app\.quit\(\);/);
  assert.match(preload, /getSessionMaintenanceSummary: \(\) => ipcRenderer\.invoke\('session-maintenance-summary'\)/);
  assert.match(preload, /trimHubWorkingSet: \(\) => ipcRenderer\.invoke\('trim-hub-working-set'\)/);
  assert.match(preload, /restartApp: \(\) => ipcRenderer\.invoke\('restart-app'\)/);
  for (const id of ['cfg-refresh-cache-summary', 'cfg-session-data-size', 'cfg-http-cache-size', 'cfg-live-runtime-metrics', 'cfg-cleanup-result', 'cfg-restart-app-btn', 'cfg-trim-working-set-btn', 'cfg-working-set-result']) {
    assert.match(indexHtml, new RegExp(`id="${id}"`));
  }
  assert.ok(renderer.includes('getLiveRuntimeMetrics: () => {'));
  assert.ok(renderer.includes('queue: webviewLoadQueue.getStats()'));
  assert.match(settingsPreferences, /query\('#btn-clean-ram'\)\?\.addEventListener\('click', \(\) => \{ void cleanNow\(\); \}\)/);
  assert.doesNotMatch(renderer, /\$\('#btn-clean-ram'\)\?\.addEventListener/);
  assert.doesNotMatch(main, /ipcMain\.(?:handle|on)\('(clear-account|open-data-dir|session-maintenance-summary|clean-ram|restart-app)'/);
  assert.ok(packageJson.build.files.includes('session-maintenance-service.js'));
  assert.equal(packageJson.build.files.filter(file => file === 'session-maintenance-service.js').length, 1);
  assert.ok(packageJson.build.files.includes('hub-working-set-cleanup-service.js'));
  assert.ok(packageJson.build.files.includes('windows-working-set-trimmer.js'));
  assert.equal(packageJson.build.win.extraResources[0].from, 'build/win-memory-trimmer.exe');
  assert.match(packageJson.scripts['dist:win'], /build-win-memory-trimmer\.js/);
});
