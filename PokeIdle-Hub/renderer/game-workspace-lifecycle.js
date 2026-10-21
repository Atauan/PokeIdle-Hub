'use strict';

(() => {
  function createGameWorkspaceLifecycle({
    state,
    games,
    planWorkspace,
    ensureHeader,
    createResource,
    setPrimaryWebview,
    afterSetup,
  }) {
    function setup() {
      const plan = planWorkspace(state.accounts, games);
      for (const id of plan.removeIds) {
        const resource = games.get(id);
        resource?.pane.remove();
        games.delete(id);
      }
      for (const action of plan.actions) {
        const { account, market } = action;
        if (action.type === 'reuse') {
          if (!action.resource.pane.querySelector('.game-pane-header')) {
            ensureHeader(account, action.resource, market);
          }
          continue;
        }
        if (action.type === 'replace') {
          action.resource.pane.remove();
          games.delete(account.id);
        }
        games.set(account.id, createResource(account, market));
      }
      setPrimaryWebview(games.get(plan.primaryAccountId)?.wv || null);
      if (!state.accounts.some((account) => account.id === state.gameAccount)) {
        state.gameAccount = plan.primaryAccountId;
      }
      afterSetup();
    }

    return Object.freeze({ setup });
  }

  const api = { createGameWorkspaceLifecycle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameWorkspaceLifecycle = api;
})();
