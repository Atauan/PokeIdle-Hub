'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { channelURL } = require('../live-channel-url');

test('normalizes Twitch and Kick channel URLs, including supported subdomains', () => {
  assert.equal(channelURL('https://WWW.TWITCH.TV/Rodil/?ref=game#live'), 'https://twitch.tv/rodil');
  assert.equal(channelURL('https://m.kick.com/Guaxilol'), 'https://kick.com/guaxilol');
});

test('rejects reserved pages, player subdomains, and routes with more than one path segment', () => {
  for (const url of [
    'https://twitch.tv/directory',
    'https://twitch.tv/login',
    'https://kick.com/dashboard',
    'https://player.twitch.tv/rodil',
    'https://dashboard.kick.com/rodil',
    'https://twitch.tv/rodil/videos',
  ]) assert.equal(channelURL(url), null, url);
});

test('rejects malformed URLs, unrelated hosts, and invalid channel names', () => {
  for (const url of [
    'not a URL',
    'https://twitch.tv.evil.example/rodil',
    'https://example.com/rodil',
    'https://twitch.tv/a',
    'https://kick.com/channel.name',
    `https://twitch.tv/${'a'.repeat(41)}`,
  ]) assert.equal(channelURL(url), null, url);
});

test('main injects the characterized channel resolver into webview navigation and packages it', () => {
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(main, /const \{ channelURL \} = require\('\.\/live-channel-url'\)/);
  assert.match(main, /registerElectronWebContentsHandlers\(\{[\s\S]*?channelURL,[\s\S]*?addLive/);
  assert.ok(packageJson.build.files.includes('live-channel-url.js'));
});
