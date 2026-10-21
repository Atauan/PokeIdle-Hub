'use strict';

(() => {
  function createGameLayout({ state, getAccounts, games, getPanel, getMosaicButton, persist, applyFpsLimits, setTab }) {
    function updatePaneHeaders() {
      for (const account of getAccounts()) {
        const resource = games.get(account.id);
        if (!resource) continue;
        const name = resource.pane.querySelector('.game-pane-name');
        if (name) name.textContent = account.name || 'Conta';
      }
      const panel = getPanel();
      if (panel) panel.dataset.accounts = getAccounts().length;
    }

    function applyMosaic(enable) {
      const panel = getPanel();
      const button = getMosaicButton();
      if (panel) {
        panel.classList.toggle('mosaic-mode', enable);
        panel.dataset.accounts = getAccounts().length;
      }
      if (button) {
        button.classList.toggle('on', enable);
        button.innerHTML = enable
          ? '<span class="icon-svg icon-single"></span> Conta Única'
          : '<span class="icon-svg icon-mosaic"></span> Ver Todas';
        button.title = enable
          ? 'Voltar para visualização em tela cheia da conta selecionada'
          : 'Alternar entre ver conta única ou todas as contas em grade simultânea';
      }
      updatePaneHeaders();
    }

    function toggleMosaic(force) {
      const panel = getPanel();
      const enable = typeof force === 'boolean' ? force : !panel.classList.contains('mosaic-mode');
      state.gameMosaic = enable;
      persist();
      applyMosaic(enable);
      applyFpsLimits();
    }

    function focusAccount(accountId) {
      state.gameAccount = accountId;
      toggleMosaic(false);
      setTab('game');
      applyFpsLimits();
    }

    return { updatePaneHeaders, applyMosaic, toggleMosaic, focusAccount };
  }

  const api = { createGameLayout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameLayout = api;
})();
