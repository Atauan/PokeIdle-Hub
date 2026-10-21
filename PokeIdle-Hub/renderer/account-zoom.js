'use strict';

(() => {
  function createAccountZoomController({ state, games, persist, getSelectedAccountId, getSelectedZoomLabel }) {
    function get(accountId) {
      const id = accountId || getSelectedAccountId();
      const value = state.accountZoom && state.accountZoom[id];
      return typeof value === 'number' && value >= 0.35 && value <= 2.0 ? value : 1.0;
    }

    function set(accountId, factor) {
      const id = accountId || getSelectedAccountId();
      const clamped = Math.max(0.40, Math.min(1.50, Math.round(factor * 100) / 100));
      if (!state.accountZoom || typeof state.accountZoom !== 'object') state.accountZoom = {};
      state.accountZoom[id] = clamped;
      persist();

      const resource = games.get(id);
      if (resource && resource.wv) {
        try {
          if (typeof resource.wv.setZoomFactor === 'function') resource.wv.setZoomFactor(clamped);
        } catch (_) {}
      }

      if (id === getSelectedAccountId()) {
        const label = getSelectedZoomLabel();
        if (label) label.textContent = `${Math.round(clamped * 100)}%`;
      }

      if (resource && resource.pane) {
        const label = resource.pane.querySelector('.game-pane-zoom-level');
        if (label) label.textContent = `${Math.round(clamped * 100)}%`;
      }
      return clamped;
    }

    function adjust(accountId, delta) {
      const id = accountId || getSelectedAccountId();
      return set(id, get(id) + delta);
    }

    function bindControls({ query, windowObject, getActiveTab, getSelectedAccountId: selectedAccountId }) {
      query('#btn-game-zoom-out')?.addEventListener('click', () => adjust(selectedAccountId(), -0.05));
      query('#btn-game-zoom-in')?.addEventListener('click', () => adjust(selectedAccountId(), 0.05));
      query('#btn-game-zoom-reset')?.addEventListener('click', () => set(selectedAccountId(), 1.0));

      windowObject.addEventListener('keydown', event => {
        if (getActiveTab() !== 'game') return;
        if (event.ctrlKey && (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract')) {
          event.preventDefault();
          adjust(selectedAccountId(), -0.05);
        } else if (event.ctrlKey && (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd')) {
          event.preventDefault();
          adjust(selectedAccountId(), 0.05);
        } else if (event.ctrlKey && (event.key === '0' || event.code === 'Numpad0')) {
          event.preventDefault();
          set(selectedAccountId(), 1.0);
        }
      });

      windowObject.addEventListener('wheel', event => {
        if (getActiveTab() !== 'game' || !event.ctrlKey) return;
        event.preventDefault();
        adjust(selectedAccountId(), event.deltaY < 0 ? 0.05 : -0.05);
      }, { passive: false });
    }

    return Object.freeze({ get, set, adjust, bindControls });
  }

  const api = { createAccountZoomController };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleAccountZoom = api;
})();
