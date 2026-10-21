'use strict';

const LIVE_PURPOSES = new Set(['live-player', 'live-chat', 'live-economy']);

function classifyLiveContentPurpose(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (host === 'player.kick.com' && /^\/[a-z0-9_]+$/i.test(path)) return 'live-player';
    if (host === 'kick.com' && /^\/popout\/[a-z0-9_]+\/chat$/i.test(path)) return 'live-chat';

    if (host === 'www.twitch.tv' || host === 'twitch.tv') {
      if (/^\/popout\/[a-z0-9_]+\/chat$/i.test(path)) {
        return url.searchParams.has('pf-economy') ? 'live-economy' : 'live-chat';
      }
      if (/^\/[a-z0-9_]+$/i.test(path) && !['login', 'signup'].includes(path.slice(1).toLowerCase())) {
        return 'live-player';
      }
    }
  } catch (_) { /* URLs inválidas permanecem sem finalidade de live */ }
  return null;
}

function createLiveContentRegistry() {
  const purposes = new Map();

  function set(webContentsId, purpose) {
    if (!Number.isInteger(webContentsId)) return;
    if (LIVE_PURPOSES.has(purpose)) purposes.set(webContentsId, purpose);
    else purposes.delete(webContentsId);
  }

  return Object.freeze({
    classify: classifyLiveContentPurpose,
    set,
    get: webContentsId => purposes.get(webContentsId) || null,
    remove: webContentsId => purposes.delete(webContentsId),
  });
}

function trackAttachedLiveWebviews(embedder, registry) {
  embedder.on('did-attach-webview', (_event, guest) => {
    const updatePurpose = url => registry.set(guest.id, registry.classify(url));
    updatePurpose(guest.getURL());
    guest.on('will-frame-navigate', event => {
      if (event.isMainFrame) updatePurpose(event.url);
    });
    guest.on('did-start-navigation', event => {
      if (event.isMainFrame) updatePurpose(event.url);
    });
    guest.once('destroyed', () => registry.remove(guest.id));
  });
}

module.exports = { LIVE_PURPOSES, classifyLiveContentPurpose, createLiveContentRegistry, trackAttachedLiveWebviews };
