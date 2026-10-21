'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'electron-session-service.js'), 'utf8');
const webContentsService = fs.readFileSync(path.join(root, 'electron-webcontents-service.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('main composes the Electron session service and uses it for account partitions', () => {
  assert.match(main, /const electronSessionService = createElectronSessionService\(\{[\s\S]*?session,[\s\S]*?isPackaged: app\.isPackaged,[\s\S]*?userAgent: CHROME_UA/);
  assert.match(main, /const \{ setupSession, configuredPartitions: configuredSessions \} = electronSessionService/);
  assert.match(main, /registerElectronWebContentsHandlers\(\{[\s\S]*?app,[\s\S]*?setupSession,[\s\S]*?liveContentRegistry/);
  assert.doesNotMatch(main, /app\.on\('web-contents-created'/);
  assert.match(webContentsService, /will-attach-webview/);
  assert.match(webContentsService, /setWindowOpenHandler/);
  assert.ok(packageJson.build.files.includes('electron-webcontents-service.js'));
  assert.equal(packageJson.build.files.filter(file => file === 'electron-webcontents-service.js').length, 1);
  assert.doesNotMatch(service, /onBeforeSendHeaders/);
  assert.match(service, /onBeforeRequest/);
  assert.match(main, /require\('\.\/electron-webcontents-service'\)/);
  assert.match(main, /getContentPurpose: webContentsId => liveContentRegistry\.get\(webContentsId\)/);
  assert.ok(packageJson.build.files.includes('live-content-purpose.js'));
  assert.equal(packageJson.build.files.filter(file => file === 'live-content-purpose.js').length, 1);
  assert.match(service, /unregisterPreloadScript/);
  assert.match(service, /registerPreloadScript/);
  assert.ok(packageJson.build.files.includes('electron-session-service.js'));
  assert.equal(packageJson.build.files.filter(file => file === 'electron-session-service.js').length, 1);
});
