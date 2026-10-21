'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('main delegates notifications with the existing sender and lifecycle guards', () => {
  assert.match(main, /registerNotificationHandlers\(\{[\s\S]*?isTrustedSender: fromApp,[\s\S]*?isQuitting: \(\) => quitting,[\s\S]*?showWindow,[\s\S]*?getMainWindow: \(\) => win/);
  assert.doesNotMatch(main, /ipcMain\.on\('(notify|attention)'/);
  assert.ok(packageJson.build.files.includes('notification-service.js'));
});
