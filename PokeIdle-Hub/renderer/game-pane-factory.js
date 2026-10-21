'use strict';

(() => {
  function createGamePaneFactory({
    gameUrl,
    makeWebview,
    accountPartition,
    getZoom,
    getMarketPoll,
    applyFpsLimits,
    bindGameWebviewEvents,
    createHeader,
    createElement,
    getPanel,
  }) {
    function applyZoom(webview, account) {
      try {
        if (typeof webview.setZoomFactor === 'function') {
          webview.setZoomFactor(getZoom(account.id));
        }
      } catch (_) {}
    }

    function create(account, market) {
      const webview = makeWebview(gameUrl, {
        muted: false,
        now: true,
        skeleton: 'game',
        partition: accountPartition(account),
        onReady: async view => {
          view.executeJavaScript(`window.__pfPoll = ${getMarketPoll()}`).catch(() => {});
          applyZoom(view, account);
          applyFpsLimits();
        },
      });
      webview.addEventListener('dom-ready', () => applyZoom(webview, account));
      bindGameWebviewEvents({ webview, account, market });

      const header = createHeader(account, webview, market);
      const pane = createElement('div', { class: 'game-pane', 'data-account': account.id },
        header, webview, webview.__skeleton);
      getPanel().append(pane);
      return { pane, wv: webview, market };
    }

    return Object.freeze({ create });
  }

  const api = Object.freeze({ createGamePaneFactory });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGamePaneFactory = api;
})();
