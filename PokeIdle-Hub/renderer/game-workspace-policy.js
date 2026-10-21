'use strict';

(() => {
  function planGameWorkspace(accounts, existingResources) {
    const removeIds = [];
    for (const [accountId, resource] of existingResources) {
      const index = accounts.findIndex((account) => account.id === accountId);
      if (index < 0) removeIds.push(accountId);
    }

    const actions = [];
    accounts.forEach((account, index) => {
      const market = index === 0;
      const resource = existingResources.get(account.id);
      if (resource && resource.market === market) actions.push({ type: 'reuse', account, resource, market });
      else actions.push({ type: resource ? 'replace' : 'create', account, resource, market });
    });

    return {
      removeIds,
      actions,
      primaryAccountId: accounts[0]?.id ?? null,
    };
  }

  const api = { planGameWorkspace };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameWorkspacePolicy = api;
})();
