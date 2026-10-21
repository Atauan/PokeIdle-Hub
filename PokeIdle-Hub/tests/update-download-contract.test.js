'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'update-download-service.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('main composes updater IPC with the main-window guard and packaged dependencies', () => {
  assert.match(main, /createUpdateDownloadService\(\{[\s\S]*?isAuthorized: fromMainWindow,[\s\S]*?isDevelopment: IS_DEVELOPMENT,[\s\S]*?getRelease: \(\) => updateNotificationService\.getState\(\)\?\.release,[\s\S]*?getMainWindow: \(\) => win/);
  for (const channel of ['get-update-target', 'open-update', 'download-update', 'cancel-download-update', 'install-update']) {
    assert.match(service, new RegExp(`'${channel}'`));
  }
  assert.doesNotMatch(main, /function getBestUpdateAsset|let currentDownloadAbort|ipcMain\.handle\('(download-update|install-update)'/);
  assert.ok(packageJson.build.files.includes('update-download-service.js'));
});
