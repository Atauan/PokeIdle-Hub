'use strict';

(() => {
  const DEFAULT_LIMITS = Object.freeze({ kick: 2, twitch: 3 });
  const PROVIDERS = Object.freeze(['kick', 'twitch']);

  function getAccountLimits(state, accountId) {
    const accountLimits = state?.accountLimits && typeof state.accountLimits === 'object'
      ? state.accountLimits
      : {};
    const universalLimits = state?.universalLimits && typeof state.universalLimits === 'object'
      ? state.universalLimits
      : {};
    const saved = accountLimits[accountId];
    return {
      kick: typeof saved?.kick === 'number'
        ? saved.kick
        : (typeof universalLimits.kick === 'number' ? universalLimits.kick : DEFAULT_LIMITS.kick),
      twitch: typeof saved?.twitch === 'number'
        ? saved.twitch
        : (typeof universalLimits.twitch === 'number' ? universalLimits.twitch : DEFAULT_LIMITS.twitch),
    };
  }

  function setUniversalLimit(state, accounts, provider, rawValue) {
    const value = parseInt(rawValue, 10);
    if (!PROVIDERS.includes(provider) || Number.isNaN(value)) return null;

    const accountLimits = { ...(state?.accountLimits || {}) };
    const universalLimits = { ...DEFAULT_LIMITS, ...(state?.universalLimits || {}), [provider]: value };
    for (const account of accounts) {
      if (!accountLimits[account.id]) {
        accountLimits[account.id] = getAccountLimits({ accountLimits, universalLimits }, account.id);
      } else {
        accountLimits[account.id] = { ...accountLimits[account.id] };
      }
      accountLimits[account.id][provider] = value;
    }

    return { state: { accountLimits, universalLimits }, value };
  }

  function changeAccountLimit(state, accountId, provider, delta) {
    if (!accountId || !PROVIDERS.includes(provider)) return { state, changed: false };
    const current = getAccountLimits(state, accountId);
    const nextValue = Math.max(0, Math.min(99, current[provider] + delta));
    if (nextValue === current[provider]) return { state, changed: false };

    const accountLimits = { ...(state?.accountLimits || {}) };
    accountLimits[accountId] = {
      ...(accountLimits[accountId] || current),
      [provider]: nextValue,
    };
    return { state: { ...state, accountLimits }, changed: true, value: nextValue };
  }

  function isAccountFavorite(favorites, channel, accountId) {
    if (!channel || !accountId) return false;
    const list = favorites?.[accountId];
    return Array.isArray(list) && list.includes(channel.toLowerCase());
  }

  function toggleAccountFavorite(favorites, accountId, channel) {
    if (!channel || !accountId) return { favorites, changed: false, favorite: false };
    const normalizedChannel = channel.toLowerCase();
    const current = Array.isArray(favorites?.[accountId]) ? favorites[accountId] : [];
    const favorite = !current.includes(normalizedChannel);
    const nextList = favorite
      ? [...current, normalizedChannel]
      : current.filter(item => item !== normalizedChannel);

    return {
      favorites: { ...(favorites || {}), [accountId]: nextList },
      changed: true,
      favorite,
    };
  }

  const api = Object.freeze({
    getAccountLimits,
    setUniversalLimit,
    changeAccountLimit,
    isAccountFavorite,
    toggleAccountFavorite,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveAccountPreferences = api;
})();
