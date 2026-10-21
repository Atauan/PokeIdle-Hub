'use strict';

(() => {
  function createGameFpsLimits({ state, getCurrentAccount, games }) {
    function apply() {
      try {
        const isGameTab = state.tab === 'game';
        const currentAccount = getCurrentAccount();
        const foregroundFps = Number(state.fpsForeground) || 30;
        const backgroundFps = Number(state.fpsBackground) || 15;

        games.forEach((game, accountId) => {
          if (!game?.wv || typeof game.wv.executeJavaScript !== 'function') return;
          try {
            let targetFps;
            if (!isGameTab) {
              targetFps = backgroundFps;
            } else if (state.gameMosaic) {
              targetFps = foregroundFps;
            } else {
              targetFps = accountId === currentAccount?.id ? foregroundFps : backgroundFps;
            }
            game.wv.executeJavaScript(`window.__pfSetTargetFps && window.__pfSetTargetFps(${targetFps})`).catch(() => {});
          } catch (_) {}
        });
      } catch (_) {}
    }

    return Object.freeze({ apply });
  }

  const api = { createGameFpsLimits };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameFpsLimits = api;
})();
