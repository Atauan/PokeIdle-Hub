'use strict';

(() => {
  function createLiveChatOverlay({ tiles, getBackdrop, applyChatMode, nextZIndex, documentObject }) {
    let expandedKey = null;

    function expand(key) {
      if (expandedKey === key) return;
      collapse();
      const tile = tiles.get(key);
      if (!tile) return;
      expandedKey = key;
      tile.root.style.zIndex = '9500';
      tile.chatBox.classList.add('expanded');
      applyChatMode(key);
      getBackdrop().hidden = false;
    }

    function collapse() {
      if (!expandedKey) return;
      const key = expandedKey;
      const tile = tiles.get(key);
      expandedKey = null;
      getBackdrop().hidden = true;
      if (!tile) return;
      tile.chatBox.classList.remove('expanded');
      applyChatMode(key);
      tile.root.style.zIndex = nextZIndex();
    }

    function bind() {
      getBackdrop().addEventListener('click', collapse);
      documentObject.addEventListener('keydown', event => {
        if (event.key === 'Escape') collapse();
      });
    }

    return Object.freeze({
      isExpanded: key => expandedKey === key,
      expand,
      collapse,
      bind,
    });
  }

  const api = { createLiveChatOverlay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveChatOverlay = api;
})();
