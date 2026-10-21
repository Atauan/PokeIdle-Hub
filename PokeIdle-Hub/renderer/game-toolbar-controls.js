'use strict';

(() => {
  function createGameToolbarControls({
    query,
    getCurrentAccount,
    getGames,
    reloadWebview,
    toggleMosaic,
    openEdge,
    gameUrl,
    openRotomCockpit,
    openGameLogin,
    partitionForAccount,
    toast,
  }) {
    function bind() {
      query('#game-reload').addEventListener('click', () => {
        const account = getCurrentAccount();
        const game = account && getGames().get(account.id);
        if (game) reloadWebview(game.wv);
      });

      query('#game-open-sniper')?.addEventListener('click', () => {
        const account = getCurrentAccount();
        if (account) openRotomCockpit(account.id, account.name);
      });

      query('#game-toggle-mosaic')?.addEventListener('click', () => toggleMosaic());
      query('#game-edge').addEventListener('click', () => openEdge(gameUrl));
      query('#game-login').addEventListener('click', () => {
        const account = getCurrentAccount();
        if (!account) return;
        openGameLogin(account.main ? null : partitionForAccount(account));
        toast('Faça o login na janela que abriu. Depois clique em "Recarregar jogo".');
      });
    }

    return Object.freeze({ bind });
  }

  const api = Object.freeze({ createGameToolbarControls });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameToolbarControls = api;
})();
