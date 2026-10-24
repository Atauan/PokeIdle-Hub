'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveTileView } = require('../renderer/live-tile-view');

function setup({ platform = 'twitch', favorite = false } = {}) {
  const events = [];
  const tiles = new Map();
  const webviews = [];
  const el = (tag, props = {}, ...children) => ({
    tag, props, children, style: {}, listeners: [],
    classList: { remove: name => events.push(['classRemove', name]) },
    addEventListener(name, listener) { this.listeners.push([name, listener]); },
    after(node) { events.push(['after', node]); },
  });
  const platforms = {
    twitch: { color: '#9147ff', host: 'twitch.tv', player: channel => `https://player.twitch.tv/${channel}`, chat: channel => `https://www.twitch.tv/popout/${channel}/chat` },
    kick: { color: '#53fc18', host: 'kick.com', player: channel => `https://player.kick.com/${channel}`, chat: channel => `https://kick.com/${channel}/chat` },
  };
  const view = createLiveTileView({
    getPlatform: provider => platforms[provider],
    getCurrentAccount: () => ({ id: 'fallback' }),
    accountPartition: account => `persist:${account.id}`,
    makeWebview: (url, options) => {
      const webview = { url, options, listeners: [], addEventListener(name, listener) { this.listeners.push([name, listener]); } };
      webviews.push(webview);
      events.push(['webview', url, options.partition, options.muted]);
      return webview;
    },
    el,
    tiles,
    isFavorite: () => favorite,
    toggleFavorite: (...args) => events.push(['favorite', ...args]),
    toggleMute: key => events.push(['mute', key]),
    follow: (tile, button) => events.push(['follow', tile.key, button]),
    reload: tile => events.push(['reload', tile.key]),
    openExternal: url => events.push(['external', url]),
    removeItem: (...args) => events.push(['removeItem', ...args]),
    startDrag: (event, key) => events.push(['drag', key]),
    bringFront: key => events.push(['front', key]),
    applyMute: key => events.push(['applyMute', key]),
    applyQuality: webview => events.push(['applyQuality', webview.url]),
    applyChatMode: key => events.push(['applyChatMode', key]),
    expandChat: key => events.push(['expand', key]),
    checkTwitchChat: (key, ready) => events.push(['chatReady', key, ready]),
    onKickPoints: report => events.push(['kickPoints', report]),
  });
  const find = (root, predicate) => {
    if (!root) return null;
    if (predicate(root)) return root;
    for (const child of root.children || []) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return null;
  };
  return { view, events, tiles, webviews, find };
}

test('creates one Twitch player/chat webview in the account partition and wires chat events', () => {
  const context = setup();
  const account = { id: 'main', name: 'Principal' };
  const item = { id: 'live-1', channel: 'streamer', muted: true };
  const tile = context.view.createTile('twitch', item, account);

  assert.equal(tile.key, 'main:live-1');
  assert.equal(tile.sharedTwitch, true);
  assert.equal(tile.chat, tile.player);
  assert.equal(tile.chatBox, tile.playerBox);
  assert.equal(context.webviews.length, 1);
  assert.deepEqual(context.events[0], ['webview', 'https://player.twitch.tv/streamer', 'persist:main', true]);
  assert.equal(context.tiles.get(tile.key), tile);

  const ipc = tile.player.listeners.find(([name]) => name === 'ipc-message')[1];
  ipc({ channel: 'chat-click' });
  ipc({ channel: 'twitch-chat-ready', args: [true] });
  assert.ok(context.events.some(([type, key]) => type === 'expand' && key === tile.key));
  assert.ok(context.events.some(([type, key, ready]) => type === 'chatReady' && key === tile.key && ready));
});

test('creates separate Kick chat with the same account partition and preserves tile actions', async () => {
  const context = setup({ platform: 'kick', favorite: false });
  const account = { id: 'alt', name: 'Alternativa' };
  const item = { id: 'live-2', channel: 'kickstream', muted: false };
  const tile = context.view.createTile('kick', item, account);

  assert.equal(tile.sharedTwitch, false);
  assert.deepEqual(context.webviews.map(webview => [webview.url, webview.options.partition]), [
    ['https://player.kick.com/kickstream', 'persist:alt'],
    ['https://kick.com/kickstream/chat', 'persist:alt'],
  ]);
  const chatClick = tile.chat.listeners.find(([name]) => name === 'ipc-message')[1];
  chatClick({ channel: 'chat-click' });
  const pointsListener = tile.chat.listeners.find(([name, listener]) => name === 'ipc-message' && listener !== chatClick)[1];
  pointsListener({ channel: 'kick-points', args: [{ channel: 'kickstream', points: 1234 }] });
  pointsListener({ channel: 'kick-points', args: [{ channel: 'kickstream', points: null }] });
  pointsListener({ channel: 'kick-points', args: [{ channel: 'other', points: 9999 }] });
  pointsListener({ channel: 'kick-points', args: [{ channel: 'kickstream', points: -1 }] });
  assert.deepEqual(context.events.filter(([type]) => type === 'kickPoints'), [
    ['kickPoints', { accountId: 'alt', channel: 'kickstream', points: 1234 }],
    ['kickPoints', { accountId: 'alt', channel: 'kickstream', points: null }],
  ]);
  assert.ok(context.events.some(([type, key]) => type === 'expand' && key === tile.key));
  const favorite = tile.favBtn.props.onclick;
  let stopped = false;
  favorite({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.ok(context.events.some(([type, channel, accountId, provider]) => type === 'favorite' && channel === item.channel && accountId === 'alt' && provider === 'kick'));
  await tile.followBtn.props.onclick({ stopPropagation() {} });
  assert.ok(context.events.some(([type, key]) => type === 'follow' && key === tile.key));
  tile.root.listeners.find(([name]) => name === 'pointerdown')[1]({});
  assert.ok(context.events.some(([type, key]) => type === 'drag' && key === tile.key));
});

test('uses current account fallback and retains per-tile external, reload and remove actions', () => {
  const context = setup();
  const tile = context.view.createTile('twitch', { id: 'live-3', channel: 'fallback', muted: false });
  assert.equal(tile.acc.id, 'fallback');
  assert.ok(context.events.some(([type, url]) => type === 'webview' && url.endsWith('/fallback')));

  context.find(tile.root, node => node.props?.title === 'Recarregar').props.onclick();
  context.find(tile.root, node => node.props?.title === 'Abrir no Edge').props.onclick();
  context.find(tile.root, node => node.props?.title === 'Remover canal desta conta').props.onclick();
  tile.muteBtn.props.onclick();
  assert.ok(context.events.some(([type, key]) => type === 'reload' && key === tile.key));
  assert.ok(context.events.some(([type, url]) => type === 'external' && url === 'https://twitch.tv/fallback'));
  assert.ok(context.events.some(([type, id, accountId, provider]) => type === 'removeItem' && id === 'live-3' && accountId === 'fallback' && provider === 'twitch'));
  assert.ok(context.events.some(([type, key]) => type === 'mute' && key === tile.key));
  tile.player.options.onReady(tile.player);
  assert.ok(context.events.some(([type, key]) => type === 'applyMute' && key === tile.key));
  assert.ok(context.events.some(([type, url]) => type === 'applyQuality' && url === tile.player.url));
});
