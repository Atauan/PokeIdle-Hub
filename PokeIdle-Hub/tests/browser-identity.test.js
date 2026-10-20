'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyBrowserIdentityHeaders, createBrowserIdentity } = require('../browser-identity');

test('creates a Chrome identity aligned to the native OS platform', () => {
  const cases = [
    ['win32', 'Windows NT 10.0; Win64; x64', '"Windows"'],
    ['darwin', 'Macintosh; Intel Mac OS X 10_15_7', '"macOS"'],
    ['linux', 'X11; Linux x86_64', '"Linux"'],
  ];

  for (const [platform, uaPlatform, clientHintPlatform] of cases) {
    const identity = createBrowserIdentity(platform, '144.0.7559.97');
    assert.ok(identity.userAgent.includes(`(${uaPlatform})`));
    assert.equal(identity.clientHintPlatform, clientHintPlatform);
    assert.match(identity.brands, /"Chromium";v="144"/);
    assert.match(identity.fullVersionList, /"Chromium";v="144\.0\.7559\.97"/);
  }
});

test('aligns outgoing Client Hints and user-agent with the same Chromium build', () => {
  const identity = createBrowserIdentity('linux', '144.0.7559.97');
  const headers = applyBrowserIdentityHeaders({
    'User-Agent': 'Electron',
    'sec-ch-ua': 'Electron',
    'sec-ch-ua-full-version-list': 'Electron',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Windows"',
  }, identity);

  assert.equal(headers['User-Agent'], identity.userAgent);
  assert.equal(headers['sec-ch-ua-platform'], '"Linux"');
  assert.equal(headers['sec-ch-ua-mobile'], '?0');
  assert.equal(headers['sec-ch-ua'], identity.brands);
  assert.equal(headers['sec-ch-ua-full-version-list'], identity.fullVersionList);
});

test('rejects unsupported platforms and malformed Chromium versions', () => {
  assert.throws(() => createBrowserIdentity('freebsd', '144.0.7559.97'), /Unsupported platform/);
  assert.throws(() => createBrowserIdentity('linux', 'unknown'), /Invalid Chromium version/);
});
