'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveTwitchChatFallback } = require('../renderer/live-twitch-chat-fallback');

function setup() {
  const events = [];
  const tiles = new Map();
  const timers = new Map();
  let nextTimer = 1;
  let expanded = false;
  const tile = {
    sharedTwitch: true,
    chatFallbackTimer: null,
    playerBox: { classList: { remove: name => events.push(['remove-class', name]) } },
    player: { executeJavaScript: source => { events.push(['disable-layout', source]); return Promise.resolve(); } },
    item: { channel: 'streamer' },
    acc: { id: 'secondary' },
    playerBoxAfter: () => events.push(['insert-chat']),
  };
  tiles.set('secondary:live', tile);
  const fallback = createLiveTwitchChatFallback({
    tiles,
    setTimer: (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimer: id => timers.delete(id),
    isExpanded: key => expanded && key === 'secondary:live',
    collapse: () => { expanded = false; events.push(['collapse']); },
    expand: () => { expanded = true; events.push(['expand']); },
    getChatUrl: channel => `https://www.twitch.tv/popout/${channel}/chat`,
    getPartition: account => `persist:pokeidlehub-acc-${account.id}`,
    attachSeparateChat: (key, currentTile, url, partition) => events.push(['attach', key, url, partition]),
    insertChatAfterPlayer: () => events.push(['insert-chat']),
  });
  return { fallback, events, tiles, timers, tile, setExpanded: value => { expanded = value; } };
}

test('schedules one fallback and cancels it when Twitch shared chat becomes ready', () => {
  const { fallback, tile, timers } = setup();
  fallback.check('secondary:live', false);
  fallback.check('secondary:live', false);
  assert.equal(timers.size, 1);
  assert.equal(timers.get(1).delay, 30000);
  const timer = tile.chatFallbackTimer;

  fallback.check('secondary:live', true);
  assert.equal(timers.size, 0);
  assert.equal(tile.chatFallbackTimer, null);
  assert.equal(timer, 1);
});

test('switches to a separate chat after 30 seconds in the same account partition', () => {
  const { fallback, events, timers, setExpanded } = setup();
  setExpanded(true);
  fallback.check('secondary:live', false);
  const runTimer = timers.get(1).callback;
  runTimer();

  assert.deepEqual(events.filter(([type]) => ['collapse', 'attach', 'insert-chat', 'expand'].includes(type)), [
    ['collapse'],
    ['attach', 'secondary:live', 'https://www.twitch.tv/popout/streamer/chat', 'persist:pokeidlehub-acc-secondary'],
    ['insert-chat'],
    ['expand'],
  ]);
});

test('does not mutate a tile replaced before timeout and clears its pending timer on disposal', () => {
  const { fallback, events, timers, tiles, tile } = setup();
  fallback.check('secondary:live', false);
  const runTimer = timers.get(1).callback;
  tiles.set('secondary:live', {});
  runTimer();
  assert.equal(events.some(([type]) => type === 'attach'), false);

  tiles.set('secondary:live', tile);
  fallback.check('secondary:live', false);
  const pending = tile.chatFallbackTimer;
  fallback.dispose(tile);
  assert.equal(timers.has(pending), false);
  assert.equal(tile.chatFallbackTimer, null);
  assert.equal(tile.chatFallbackTimer, null);
});
