'use strict';

(() => {
  function createLiveMediaControls({ state, tiles, chatOverlay, checkTwitchChat, persist, nextZIndex, reloadWebview }) {
    function applyMute(key) {
      const tile = tiles.get(key);
      if (!tile || !tile.item) return;
      const muted = !!tile.item.muted;
      tile.muteBtn.innerHTML = `<span class="icon-svg ${muted ? 'icon-mute' : 'icon-unmute'}"></span>`;
      tile.muteBtn.title = muted ? 'Ativar som' : 'Silenciar';
      tile.muteBtn.setAttribute('aria-label', tile.muteBtn.title);
      tile.player.__muted = muted;
      if (!tile.player.__ready) return;
      try { tile.player.setAudioMuted(muted); } catch (_) { /* ignora */ }
      tile.player.executeJavaScript(`window.__kmSetMuted && window.__kmSetMuted(${muted})`).catch(() => {});
    }

    function applyQuality(webview) {
      if (!webview.__ready) return;
      const quality = state.kickEconomy && new URL(webview.__pfSrc).hostname === 'player.kick.com'
        ? 160
        : Number(state.quality) || 0;
      webview.executeJavaScript(`window.__kmApplyQuality && window.__kmApplyQuality(${quality})`).catch(() => {});
    }

    function applyChatMode(key) {
      const tile = tiles.get(key);
      if (!tile?.chat?.__ready || !tile.item) return;
      const compact = !chatOverlay.isExpanded(key);
      const kickEconomy = tile.p === 'kick' && state.kickEconomy && compact;
      if (tile.sharedTwitch) {
        return tile.player.executeJavaScript(`window.__pfSetTwitchLayout && window.__pfSetTwitchLayout(${JSON.stringify({
          enabled: true,
          expanded: !compact,
          showChat: state.showChat,
        })})`).then(ready => checkTwitchChat(key, ready === true)).catch(() => checkTwitchChat(key, false));
      }
      return tile.chat.executeJavaScript(
        `window.__pfSetChatCompact && window.__pfSetChatCompact(${compact});` +
        `window.__pfSetKickEconomy && window.__pfSetKickEconomy(${kickEconomy});`,
      ).catch(() => {});
    }

    function toggleMute(key) {
      const tile = tiles.get(key);
      if (!tile || !tile.item) return;
      tile.item.muted = !tile.item.muted;
      persist();
      applyMute(key);
    }

    function bringFront(key) {
      const tile = tiles.get(key);
      if (tile && !chatOverlay.isExpanded(key)) tile.root.style.zIndex = nextZIndex();
    }

    function reloadTile(tile) {
      for (const webview of new Set([tile.player, tile.chat])) reloadWebview(webview);
    }

    return Object.freeze({ applyMute, applyQuality, applyChatMode, toggleMute, bringFront, reloadTile });
  }

  const api = Object.freeze({ createLiveMediaControls });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveMediaControls = api;
})();
