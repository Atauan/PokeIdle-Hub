'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { platforms } = require('../renderer/live-platforms');

test('defines stable player and chat URLs for active Kick and Twitch tiles', () => {
  assert.deepEqual(Object.keys(platforms).sort(), ['kick', 'twitch']);
  assert.equal(platforms.kick.title, 'Kick');
  assert.equal(platforms.kick.color, 'var(--kick)');
  assert.equal(platforms.kick.host, 'kick.com');
  assert.equal(platforms.kick.player('channel'), 'https://player.kick.com/channel?autoplay=true&muted=true');
  assert.equal(platforms.kick.chat('channel'), 'https://kick.com/popout/channel/chat');
  assert.equal(platforms.twitch.title, 'Twitch');
  assert.equal(platforms.twitch.color, 'var(--twitch)');
  assert.equal(platforms.twitch.host, 'www.twitch.tv');
  assert.equal(platforms.twitch.player('channel'), 'https://www.twitch.tv/channel');
  assert.equal(platforms.twitch.chat('channel'), 'https://www.twitch.tv/popout/channel/chat?popout=');
  assert.ok(Object.isFrozen(platforms));
  assert.ok(Object.isFrozen(platforms.kick));
  assert.ok(Object.isFrozen(platforms.twitch));
});
