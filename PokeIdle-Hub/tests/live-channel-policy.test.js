'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeGameChannels, cleanChannel } = require('../live-channel-policy');

test('normalizes game channels, filters invalid rows and keeps the first occurrence order', () => {
  assert.deepEqual(normalizeGameChannels([
    { platform: 'twitch', channel: ' Alpha ' },
    { platform: 'kick', channel: 'BETA' },
    { platform: 'youtube', channel: 'ignored' },
    { platform: 'kick', channel: 'x' },
    null,
    { platform: 'twitch', channel: 'alpha' },
    { platform: 'twitch', channel: 'invalid name' },
  ]), [
    { platform: 'twitch', channel: 'alpha' },
    { platform: 'kick', channel: 'beta' },
  ]);
});

test('normalizes only the first 200 game channel rows and treats non-arrays as empty', () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({ platform: 'kick', channel: `ch${index}` }));
  assert.equal(normalizeGameChannels(rows).length, 200);
  assert.deepEqual(normalizeGameChannels(null), []);
});

test('cleans channel names and Twitch/Kick URLs using the existing path and character rules', () => {
  assert.equal(cleanChannel(' Alpha_2 '), 'alpha_2');
  assert.equal(cleanChannel('https://www.twitch.tv/Streamer-1?lang=pt'), 'streamer-1');
  assert.equal(cleanChannel('https://kick.com/Streamer-2/live#chat'), 'live');
  assert.equal(cleanChannel('x'), null);
  assert.equal(cleanChannel('canal com espaço'), null);
  assert.equal(cleanChannel('https://twitch.tv/'), null);
  assert.equal(cleanChannel('a'.repeat(41)), null);
});

test('active renderer loads the channel policy before app.js and includes it in the package', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(html, /<script src="\.\.\/live-channel-policy\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/);
  assert.ok(packageJson.build.files.includes('live-channel-policy.js'));
});

test('channel policy and renderer app can coexist as classic scripts without lexical collisions', () => {
  const root = path.join(__dirname, '..');
  const policy = fs.readFileSync(path.join(root, 'live-channel-policy.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');

  assert.doesNotThrow(() => new vm.Script(`${policy}\n${app}`));
});
