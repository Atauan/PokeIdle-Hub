'use strict';

const PLATFORM_IDENTITIES = Object.freeze({
  win32: Object.freeze({ userAgentPlatform: 'Windows NT 10.0; Win64; x64', clientHintPlatform: '"Windows"' }),
  darwin: Object.freeze({ userAgentPlatform: 'Macintosh; Intel Mac OS X 10_15_7', clientHintPlatform: '"macOS"' }),
  linux: Object.freeze({ userAgentPlatform: 'X11; Linux x86_64', clientHintPlatform: '"Linux"' }),
});

function createBrowserIdentity(platform, chromiumVersion) {
  const platformIdentity = PLATFORM_IDENTITIES[platform];
  if (!platformIdentity) throw new Error(`Unsupported platform for browser login: ${platform}`);

  const version = String(chromiumVersion || '');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Invalid Chromium version for browser login');
  }
  const major = version.split('.')[0];

  return Object.freeze({
    userAgent: `Mozilla/5.0 (${platformIdentity.userAgentPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`,
    clientHintPlatform: platformIdentity.clientHintPlatform,
    brands: `"Not A(Brand";v="8", "Chromium";v="${major}", "Google Chrome";v="${major}"`,
    fullVersionList: `"Not A(Brand";v="8.0.0.0", "Chromium";v="${version}", "Google Chrome";v="${version}"`,
  });
}

function applyBrowserIdentityHeaders(requestHeaders, identity) {
  const headers = { ...requestHeaders, 'User-Agent': identity.userAgent };
  if (Object.hasOwn(headers, 'sec-ch-ua')) headers['sec-ch-ua'] = identity.brands;
  if (Object.hasOwn(headers, 'sec-ch-ua-full-version-list')) {
    headers['sec-ch-ua-full-version-list'] = identity.fullVersionList;
  }
  if (Object.hasOwn(headers, 'sec-ch-ua-mobile')) headers['sec-ch-ua-mobile'] = '?0';
  if (Object.hasOwn(headers, 'sec-ch-ua-platform')) {
    headers['sec-ch-ua-platform'] = identity.clientHintPlatform;
  }
  return headers;
}

module.exports = { createBrowserIdentity, applyBrowserIdentityHeaders };
