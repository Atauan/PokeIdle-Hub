'use strict';

(() => {
  function createLiveAccountPreferenceController({ state, preferences, getTiles, persist, syncTiles, toast }) {
    function isAccountFavorite(channel, accountId) {
      return preferences.isAccountFavorite(state.accountFavorites, channel, accountId);
    }

    function toggleAccountFavorite(channel, accountId) {
      const result = preferences.toggleAccountFavorite(state.accountFavorites, accountId, channel);
      if (!result.changed) return;

      const normalizedChannel = channel.toLowerCase();
      state.accountFavorites = result.favorites;
      toast(result.favorite
        ? `★ Canal ${normalizedChannel} adicionado aos favoritos desta conta!`
        : `Canal ${normalizedChannel} removido dos favoritos.`);
      persist();

      for (const [, tile] of getTiles()) {
        if (tile.acc.id !== accountId || tile.item.channel.toLowerCase() !== normalizedChannel) continue;
        const favorite = isAccountFavorite(normalizedChannel, accountId);
        if (!tile.favBtn) continue;
        tile.favBtn.innerHTML = `<span class="icon-svg ${favorite ? 'icon-star' : 'icon-star-outline'}"></span>`;
        tile.favBtn.classList.toggle('active', favorite);
        tile.favBtn.title = favorite ? 'Remover dos favoritos desta conta' : 'Favoritar para esta conta (fixa no topo)';
      }

      syncTiles();
    }

    function getAccountLimits(accountId) {
      return preferences.getAccountLimits(state, accountId);
    }

    function applyUniversalLimit(platform, value) {
      const accounts = state.accounts && state.accounts.length
        ? state.accounts
        : [{ id: 'main', name: 'Conta 1', main: true }];
      const result = preferences.setUniversalLimit(state, accounts, platform, value);
      if (!result) return;

      state.accountLimits = result.state.accountLimits;
      state.universalLimits = result.state.universalLimits;
      persist();
      syncTiles();

      const name = platform === 'kick' ? 'Kick' : 'Twitch';
      const label = result.value >= 99 ? 'Ilimitado' : (result.value === 0 ? 'Desativado' : `${result.value} live(s)`);
      toast(`Máx ${name} universal definido para ${label} em todas as contas.`);
    }

    function changeAccountLimit(accountId, platform, delta) {
      const result = preferences.changeAccountLimit(state, accountId, platform, delta);
      if (!result.changed) return;
      state.accountLimits = result.state.accountLimits;
      persist();
      syncTiles();
    }

    return Object.freeze({
      isAccountFavorite,
      toggleAccountFavorite,
      getAccountLimits,
      applyUniversalLimit,
      changeAccountLimit,
    });
  }

  const api = Object.freeze({ createLiveAccountPreferenceController });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveAccountPreferenceController = api;
})();
