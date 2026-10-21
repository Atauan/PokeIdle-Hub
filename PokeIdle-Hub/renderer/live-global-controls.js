'use strict';

(() => {
  function createLiveGlobalControls({
    query,
    state,
    all,
    tiles,
    persist,
    applyMute,
    followAllOpenChannels,
    reloadTile,
    twitchEconomyRuntime,
    syncTiles,
    applyChatMode,
    applyQuality,
    reloadWebview,
  }) {
    function bind() {
      query('#mute-all').addEventListener('click', () => {
        all().forEach(entry => { entry.i.muted = true; });
        persist();
        tiles.forEach((_tile, id) => applyMute(id));
      });

      query('#follow-all')?.addEventListener('click', () => {
        void followAllOpenChannels();
      });

      query('#reload-all').addEventListener('click', () => {
        tiles.forEach(reloadTile);
        twitchEconomyRuntime.reloadAll();
      });

      query('#twitch-economy').addEventListener('change', event => {
        state.twitchEconomy = event.target.checked;
        syncTiles();
      });

      query('#kick-economy').addEventListener('change', event => {
        state.kickEconomy = event.target.checked;
        persist();
        query('#kick-economy-help').hidden = !state.kickEconomy;
        for (const [id, tile] of tiles) {
          if (tile.p !== 'kick') continue;
          applyChatMode(id);
          if (!state.kickEconomy && !state.quality) reloadWebview(tile.player);
          else applyQuality(tile.player);
        }
      });

      query('#twitch-economy-reload').addEventListener('click', () => {
        twitchEconomyRuntime.reloadAll();
      });
    }

    return Object.freeze({ bind });
  }

  const api = Object.freeze({ createLiveGlobalControls });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveGlobalControls = api;
})();
