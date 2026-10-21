'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('main composes the summary service for tray, focus, and window lifecycle', () => {
  assert.match(main, /const sessionSummaryService = createSessionSummaryService\(\{[\s\S]*?getTray: \(\) => trayService\.getTray\(\),[\s\S]*?getMainWindow: \(\) => win,[\s\S]*?showMainWindow: showWindow/);
  assert.match(main, /sessionSummaryService\.show\(\)/);
  assert.match(main, /sessionSummaryService\.hide\(\)/);
  assert.match(main, /sessionSummaryService\.isVisible\(\)/);
  assert.match(main, /showSessionSummary: \(\) => sessionSummaryService\.show\(\)/);
  assert.doesNotMatch(main, /summaryWindow|function showSessionSummary|ipcMain\.(?:handle|on)\('session-(summary|open|close)'/);
  assert.equal(packageJson.build.files.filter(file => file === 'session-summary-service.js').length, 1);
  assert.equal(packageJson.build.files.filter(file => file === 'session-maintenance-service.js').length, 1);
});
