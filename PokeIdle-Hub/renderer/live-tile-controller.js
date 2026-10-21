'use strict';

(() => {
  function createLiveTileController({
    state,
    liveStates,
    tiles,
    getItems,
    getAccounts,
    getEligibleAccountIdsByProvider,
    getAccountLimits,
    getFavoriteChannelsByAccount,
    isTwitchEconomyEnabled,
    policy,
    runtime,
    createTile,
    disposeTile,
    getGrid,
    getColumnBody,
    syncColumns,
    syncEconomy,
    persist,
    layout,
    renderControls,
  }) {
    function sync() {
      const grid = getGrid();
      const saved = getItems();
      const ids = new Set(saved.map(entry => entry.i.id));
      const open = saved.filter(entry => liveStates.get(entry.i.id)?.open);
      const accounts = getAccounts();
      const eligibleAccountIdsByProvider = getEligibleAccountIdsByProvider(accounts);
      const livePlan = policy.createResourcePlan({
        accounts,
        channels: open.map(({ p, i }) => ({ provider: p, item: i })),
        eligibleAccountIdsByProvider,
        accountLimitsById: Object.fromEntries(accounts.map(account => [account.id, getAccountLimits(account.id)])),
        favoriteChannelsByAccount: getFavoriteChannelsByAccount(),
        existingTileKeys: new Set(tiles.keys()),
        economyProviders: isTwitchEconomyEnabled() ? ['twitch'] : [],
      });
      const { visibleChannels, allowedByAccount, countsByAccount, desiredTiles } = livePlan;

      runtime.reconcileMap(tiles, desiredTiles, ({ provider, item, account }) => createTile(provider, item, account), disposeTile);
      syncColumns(accounts, visibleChannels, countsByAccount);

      for (const id of Object.keys(state.frames)) if (!ids.has(id)) delete state.frames[id];
      for (const id of liveStates.keys()) if (!ids.has(id)) liveStates.delete(id);

      for (const account of accounts) {
        const columnBody = getColumnBody(account.id);
        const allowed = allowedByAccount.get(account.id) || [];
        allowed.forEach((channel, index) => {
          const key = `${account.id}:${channel.item.id}`;
          let tile = tiles.get(key);
          if (!tile) tile = createTile(channel.provider, channel.item, account);
          tile.root.style.order = String(index);
          const parent = columnBody || grid;
          if (tile.root.parentElement !== parent) parent.append(tile.root);
        });
      }

      syncEconomy(open.filter(entry => entry.p === 'twitch').map(entry => entry.i.channel), eligibleAccountIdsByProvider.twitch);
      persist();
      layout();
      renderControls();
    }

    return Object.freeze({ sync });
  }

  const api = { createLiveTileController };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveTileController = api;
})();
