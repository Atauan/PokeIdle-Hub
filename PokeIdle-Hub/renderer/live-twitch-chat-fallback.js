'use strict';

(() => {
  function createLiveTwitchChatFallback({
    tiles,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    isExpanded,
    collapse,
    expand,
    getChatUrl,
    getPartition,
    attachSeparateChat,
    insertChatAfterPlayer,
  }) {
    function dispose(tile) {
      if (!tile || tile.chatFallbackTimer === null || tile.chatFallbackTimer === undefined) return;
      clearTimer(tile.chatFallbackTimer);
      tile.chatFallbackTimer = null;
    }

    function check(key, ready) {
      const tile = tiles.get(key);
      if (!tile?.sharedTwitch) return;
      if (ready) {
        dispose(tile);
        return;
      }
      if (tile.chatFallbackTimer !== null) return;

      tile.chatFallbackTimer = setTimer(() => {
        tile.chatFallbackTimer = null;
        if (tiles.get(key) !== tile || !tile.sharedTwitch) return;
        const wasExpanded = isExpanded(key);
        if (wasExpanded) collapse();
        tile.sharedTwitch = false;
        tile.playerBox.classList.remove('shared-twitch');
        tile.player.executeJavaScript('window.__pfSetTwitchLayout && window.__pfSetTwitchLayout({enabled:false})').catch(() => {});
        attachSeparateChat(key, tile, getChatUrl(tile.item.channel), getPartition(tile.acc));
        insertChatAfterPlayer(key, tile);
        if (wasExpanded) expand(key);
      }, 30000);
    }

    return Object.freeze({ check, dispose });
  }

  const api = { createLiveTwitchChatFallback };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveTwitchChatFallback = api;
})();
