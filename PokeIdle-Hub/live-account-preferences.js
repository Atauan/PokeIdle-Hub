'use strict';

(() => {
  const DEFAULT_LIMITS = Object.freeze({ kick: 2, twitch: 3 });
  const PROVIDERS = Object.freeze(['kick', 'twitch']);
  const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

  function normalizeChannelList(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const channels = [];
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const channel = item.trim().toLowerCase();
      if (!channel || seen.has(channel)) continue;
      seen.add(channel);
      channels.push(channel);
    }
    return channels;
  }

  function normalizeProviderLists(value) {
    const result = {};
    for (const provider of PROVIDERS) {
      const channels = normalizeChannelList(value?.[provider]);
      if (channels.length) result[provider] = channels;
    }
    return result;
  }

  function normalizeAccountFavorites(favorites) {
    if (!favorites || typeof favorites !== 'object' || Array.isArray(favorites)) return {};
    const result = {};
    for (const [accountId, value] of Object.entries(favorites)) {
      if (!accountId || UNSAFE_KEYS.has(accountId)) continue;
      const normalized = Array.isArray(value)
        ? Object.fromEntries(PROVIDERS.map(provider => [provider, normalizeChannelList(value)]).filter(([, channels]) => channels.length))
        : normalizeProviderLists(value);
      if (Object.keys(normalized).length) result[accountId] = normalized;
    }
    return result;
  }

  function normalizeAccountIgnoredGameChannels(exclusions) {
    if (!exclusions || typeof exclusions !== 'object' || Array.isArray(exclusions)) return {};
    const result = {};
    for (const [accountId, value] of Object.entries(exclusions)) {
      if (!accountId || UNSAFE_KEYS.has(accountId)) continue;
      const normalized = normalizeProviderLists(value);
      if (Object.keys(normalized).length) result[accountId] = normalized;
    }
    return result;
  }

  function setAccountChannelExcluded(exclusions, accountId, provider, channel, excluded = true) {
    if (!accountId || UNSAFE_KEYS.has(accountId) || !PROVIDERS.includes(provider) || typeof channel !== 'string') {
      return exclusions;
    }
    const normalizedChannel = channel.trim().toLowerCase();
    if (!normalizedChannel) return exclusions;
    const current = normalizeAccountIgnoredGameChannels(exclusions);
    const account = current[accountId] || {};
    const channels = account[provider] || [];
    const exists = channels.includes(normalizedChannel);
    if (exists === excluded) return current;
    const nextChannels = excluded
      ? [...channels, normalizedChannel]
      : channels.filter(value => value !== normalizedChannel);
    const nextProviderLists = { ...account };
    if (nextChannels.length) nextProviderLists[provider] = nextChannels;
    else delete nextProviderLists[provider];
    const next = { ...current };
    if (Object.keys(nextProviderLists).length) next[accountId] = nextProviderLists;
    else delete next[accountId];
    return next;
  }

  function clearChannelExclusionAcrossAccounts(exclusions, provider, channel) {
    if (!PROVIDERS.includes(provider) || typeof channel !== 'string') return exclusions;
    const normalizedChannel = channel.trim().toLowerCase();
    if (!normalizedChannel) return exclusions;
    const current = normalizeAccountIgnoredGameChannels(exclusions);
    const next = {};
    for (const [accountId, account] of Object.entries(current)) {
      const channels = (account[provider] || []).filter(value => value !== normalizedChannel);
      const providers = { ...account };
      if (channels.length) providers[provider] = channels;
      else delete providers[provider];
      if (Object.keys(providers).length) next[accountId] = providers;
    }
    return next;
  }

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

  function isAccountFavorite(favorites, accountId, provider, channel) {
    if (!channel || !accountId || !PROVIDERS.includes(provider)) return false;
    const list = favorites?.[accountId]?.[provider];
    return Array.isArray(list) && list.includes(channel.trim().toLowerCase());
  }

  function toggleAccountFavorite(favorites, accountId, provider, channel) {
    if (!channel || !accountId || UNSAFE_KEYS.has(accountId) || !PROVIDERS.includes(provider)) {
      return { favorites, changed: false, favorite: false };
    }
    const normalizedChannel = channel.trim().toLowerCase();
    if (!normalizedChannel) return { favorites, changed: false, favorite: false };
    const accountFavorites = favorites?.[accountId] && typeof favorites[accountId] === 'object'
      ? favorites[accountId]
      : {};
    const current = Array.isArray(accountFavorites[provider]) ? accountFavorites[provider] : [];
    const favorite = !current.includes(normalizedChannel);
    const nextList = favorite
      ? [...current, normalizedChannel]
      : current.filter(item => item !== normalizedChannel);

    return {
      favorites: {
        ...(favorites || {}),
        [accountId]: { ...accountFavorites, [provider]: nextList },
      },
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
    normalizeAccountFavorites,
    normalizeAccountIgnoredGameChannels,
    setAccountChannelExcluded,
    clearChannelExclusionAcrossAccounts,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveAccountPreferences = api;
})();
