'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createBrowserIdentity } = require('../browser-identity');

test('main uses the Chromium version provided by Electron instead of pinning a stale version', () => {
  const mainSource = readFileSync(join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(mainSource, /createBrowserIdentity\(process\.platform, process\.versions\.chrome\)/);
  assert.doesNotMatch(mainSource, /LOGIN_CHROMIUM_VERSION/);
});

test('creates the same Chrome user-agent as the login-compatible PokeFarm baseline', () => {
  const cases = [
    ['win32', 'Windows NT 10.0; Win64; x64'],
    ['darwin', 'Macintosh; Intel Mac OS X 10_15_7'],
    ['linux', 'X11; Linux x86_64'],
  ];

  for (const [platform, uaPlatform] of cases) {
    const identity = createBrowserIdentity(platform, '132.0.6834.196');
    assert.ok(identity.userAgent.includes(`(${uaPlatform})`));
  }
});

test('rejects unsupported platforms and malformed Chromium versions', () => {
  assert.throws(() => createBrowserIdentity('freebsd', '144.0.7559.97'), /Unsupported platform/);
  assert.throws(() => createBrowserIdentity('linux', 'unknown'), /Invalid Chromium version/);
});
