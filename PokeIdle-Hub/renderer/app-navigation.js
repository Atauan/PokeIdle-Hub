'use strict';

(() => {
  const TABS = Object.freeze(['lives', 'game', 'alerts', 'afk', 'settings']);

  function createAppNavigation({
    state,
    persist,
    query,
    queryAll,
    getCurrentAccount,
    getAccounts,
    games,
    updateGameBarConnections,
    applyGameMosaic,
    getAccountZoom,
    updateGameActionsToggleBtn,
    updateLiveActionsToggleBtn,
    renderMarketAlerts,
    initFarmAfk,
    renderSettings,
    layoutLives,
    applyFpsLimits,
    onOpenTab,
  }) {
    function bind() {
      queryAll('.sidebar-nav .nav-item[data-tab]').forEach(button => {
        button.addEventListener('click', () => setTab(button.dataset.tab));
      });
      query('#btn-toggle-game-actions')?.addEventListener('click', () => {
        state.gameActionsVisible = !state.gameActionsVisible;
        persist();
        const actionsBar = query('#game-actions-bar');
        if (actionsBar) actionsBar.hidden = state.tab !== 'game' || !state.gameActionsVisible;
        updateGameActionsToggleBtn();
      });
      query('#btn-toggle-live-actions')?.addEventListener('click', () => {
        state.liveActionsVisible = !state.liveActionsVisible;
        persist();
        const actionsBar = query('#lives-actions-bar');
        if (actionsBar) actionsBar.hidden = state.tab !== 'lives' || !state.liveActionsVisible;
        updateLiveActionsToggleBtn();
        if (state.tab === 'lives') layoutLives();
      });
      onOpenTab(setTab);
    }

    function setTab(tab) {
      if (!TABS.includes(tab)) tab = 'lives';
      state.tab = tab;
      persist();
      const account = getCurrentAccount();
      queryAll('.sidebar-nav .nav-item[data-tab]').forEach(button => {
        const selected = button.dataset.tab === tab;
        button.classList.toggle('on', selected);
        button.setAttribute('aria-selected', String(selected));
      });
      queryAll('#account-tabs button[data-account]').forEach(button => {
        const selected = button.dataset.account === account?.id;
        button.classList.toggle('on', selected);
        button.setAttribute('aria-selected', String(selected));
      });
      games.forEach((game, accountId) => game.pane.classList.toggle('on', accountId === account?.id));

      if (tab === 'game') {
        query('#account-remove').disabled = getAccounts().length <= 1;
        void updateGameBarConnections();
        applyGameMosaic(Boolean(state.gameMosaic));
        const zoomLabel = query('#btn-game-zoom-reset');
        if (zoomLabel) zoomLabel.textContent = `${Math.round(getAccountZoom(state.gameAccount) * 100)}%`;
      }

      query('#panel-lives').classList.toggle('active', tab === 'lives');
      query('#panel-game').classList.toggle('active', tab === 'game');
      query('#panel-alerts').classList.toggle('active', tab === 'alerts');
      query('#panel-afk')?.classList.toggle('active', tab === 'afk');
      query('#panel-settings')?.classList.toggle('active', tab === 'settings');
      query('#bar-lives').hidden = tab !== 'lives';
      query('#bar-game').hidden = tab !== 'game';
      query('#bar-alerts').hidden = tab !== 'alerts';
      query('#bar-afk').hidden = tab !== 'afk';
      query('#bar-settings').hidden = tab !== 'settings';

      const gameActionsBar = query('#game-actions-bar');
      if (gameActionsBar) gameActionsBar.hidden = tab !== 'game' || state.gameActionsVisible === false;
      updateGameActionsToggleBtn();
      const liveActionsBar = query('#lives-actions-bar');
      if (liveActionsBar) liveActionsBar.hidden = tab !== 'lives' || state.liveActionsVisible === false;
      updateLiveActionsToggleBtn();

      if (tab === 'alerts') renderMarketAlerts();
      if (tab === 'afk') initFarmAfk();
      if (tab === 'settings') renderSettings();
      if (tab === 'lives') layoutLives();
      applyFpsLimits();
    }

    return Object.freeze({ bind, setTab });
  }

  const api = Object.freeze({ createAppNavigation });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleAppNavigation = api;
})();
