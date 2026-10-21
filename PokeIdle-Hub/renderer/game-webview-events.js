'use strict';

(() => {
  function bindGameWebviewEvents({
    webview,
    account,
    market,
    adjustZoom,
    resetZoom,
    captureMarket,
    receiveChannels,
    sendRotomMessage,
    persist,
    renderAccountTabs,
  }) {
    webview.addEventListener('ipc-message', (event) => {
      if (event.channel === 'game-zoom-delta') {
        adjustZoom(account.id, Number(event.args[0]) || 0);
      }
      if (event.channel === 'game-zoom-reset') {
        resetZoom(account.id);
      }
      if (event.channel === 'market' && market) captureMarket(event.args[0]);
      if (event.channel === 'game-channels') {
        try {
          if (/(^|\.)pokeidle\.io$/.test(new URL(webview.getURL()).hostname)) {
            receiveChannels(event.args[0]);
          }
        } catch (_) { /* a página já foi fechada ou navegou */ }
      }
      if (event.channel === 'rotom-msg') sendRotomMessage(account.id, event.args[0]);
      if (event.channel === 'game-account-nick') {
        const nickname = String(event.args[0] || '').trim();
        if (nickname && nickname !== '—' && account.name !== nickname) {
          account.name = nickname;
          persist();
          renderAccountTabs();
        }
      }
    });
  }

  function bindRotomForwardEvent({ onRotomForwardToGame, getGame }) {
    if (typeof onRotomForwardToGame !== 'function') return;
    onRotomForwardToGame(({ accId, message }) => {
      const game = getGame(accId);
      if (game && game.wv && typeof game.wv.send === 'function') {
        game.wv.send('rotom-cmd', message);
      }
    });
  }

  const api = { bindGameWebviewEvents, bindRotomForwardEvent };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameWebviewEvents = api;
})();
