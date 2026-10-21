'use strict';

(() => {
  const PLAYBACK_PROGRESS_SCRIPT = '(function(){var v=document.querySelector("video");if(!v||v.paused||v.readyState<2)return false;' +
    'var t=v.currentTime,ok=window.__kmLastT!==t;window.__kmLastT=t;return ok;})()';

  function createLivePlayerWatchdog({
    getTiles,
    reloadPlayer,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  }) {
    let intervalId = null;

    function scan() {
      for (const tile of getTiles().values()) {
        if (!tile.player.__ready) continue;
        tile.player.executeJavaScript(PLAYBACK_PROGRESS_SCRIPT).then((isPlaying) => {
          if (isPlaying) {
            tile.stalls = 0;
            return;
          }
          tile.stalls += 1;
          if (tile.stalls >= 3) {
            tile.stalls = 0;
            reloadPlayer(tile.player);
          }
        }).catch(() => {});
      }
    }

    function start() {
      if (intervalId !== null) return;
      intervalId = setIntervalFn(scan, 60000);
    }

    function dispose() {
      if (intervalId === null) return;
      clearIntervalFn(intervalId);
      intervalId = null;
    }

    return Object.freeze({ start, scan, dispose, isRunning: () => intervalId !== null });
  }

  const api = Object.freeze({ createLivePlayerWatchdog });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLivePlayerWatchdog = api;
})();
