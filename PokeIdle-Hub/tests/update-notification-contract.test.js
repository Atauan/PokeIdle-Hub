'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'app-lifecycle.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('main delegates update lifecycle and retains packaged and IPC guards', () => {
  assert.match(main, /const updateNotificationService = createUpdateNotificationService\(/);
  assert.match(main, /registerAppLifecycle\([\s\S]*?updateNotificationService/);
  assert.match(lifecycle, /if \(app\.isPackaged && !qaBuild\) updateNotificationService\.start\(\)/);
  assert.match(lifecycle, /before-quit'[\s\S]*?updateNotificationService\.stop\(\)/);
  assert.match(main, /registerAppShellHandlers\(\{[\s\S]*?isAuthorized: fromMainWindow,[\s\S]*?isDevelopment: IS_DEVELOPMENT,[\s\S]*?showAbout: aboutWindowService\.show,[\s\S]*?updateNotificationService/);
  assert.doesNotMatch(main, /ipcMain\.handle\('(update-state|check-updates)'/);
  assert.doesNotMatch(main, /function startUpdateChecks|let updateChecker|let updateTimer/);
  assert.ok(packageJson.build.files.includes('update-notification-service.js'));
  assert.ok(packageJson.build.files.includes('app-shell-ipc.js'));
});
