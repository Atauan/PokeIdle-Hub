'use strict';

(() => {
  function createLiveAccountPreferenceController({ state, preferences, getTiles, persist, syncTiles, toast }) {
    function isAccountFavorite(channel, accountId, provider) {
      return preferences.isAccountFavorite(state.accountFavorites, accountId, provider, channel);
    }

    function toggleAccountFavorite(channel, accountId, provider) {
      const result = preferences.toggleAccountFavorite(state.accountFavorites, accountId, provider, channel);
      if (!result.changed) return;

      const normalizedChannel = channel.toLowerCase();
      state.accountFavorites = result.favorites;
      const providerName = provider === 'twitch' ? 'Twitch' : 'Kick';
      toast(result.favorite
        ? `★ Canal ${normalizedChannel} adicionado aos favoritos da conta no ${providerName}!`
        : `Canal ${normalizedChannel} removido dos favoritos da conta no ${providerName}.`);
      persist();

      for (const [, tile] of getTiles()) {
        if (tile.acc.id !== accountId || tile.p !== provider || tile.item.channel.toLowerCase() !== normalizedChannel) continue;
        const favorite = isAccountFavorite(normalizedChannel, accountId, provider);
        if (!tile.favBtn) continue;
        tile.favBtn.innerHTML = `<span class="icon-svg ${favorite ? 'icon-star' : 'icon-star-outline'}"></span>`;
        tile.favBtn.classList.toggle('active', favorite);
        tile.favBtn.title = favorite
          ? 'Remover dos favoritos desta conta e plataforma'
          : 'Favoritar nesta conta e plataforma (fixa no topo)';
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
