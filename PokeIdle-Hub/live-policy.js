'use strict';

const PROVIDERS = Object.freeze(['kick', 'twitch']);
const CHANNEL_PATTERN = /^[a-z0-9_-]{2,40}$/;

function canReceiveResources(accountId, provider, eligibleAccountIdsByProvider) {
  if (typeof accountId !== 'string' || !PROVIDERS.includes(provider)) return false;
  const eligibleAccountIds = eligibleAccountIdsByProvider?.[provider];
  return Array.isArray(eligibleAccountIds) && eligibleAccountIds.includes(accountId);
}

function filterEligibleChannels(accountId, channels, eligibleAccountIdsByProvider) {
  if (!Array.isArray(channels)) return [];
  return channels.filter(channel =>
    canReceiveResources(accountId, channel?.provider, eligibleAccountIdsByProvider));
}

function createResourcePlan({
  accounts,
  channels,
  eligibleAccountIdsByProvider,
  accountLimitsById,
  favoriteChannelsByAccount,
  existingTileKeys = new Set(),
  economyProviders = [],
} = {}) {
  const allowedByAccount = new Map();
  const countsByAccount = new Map();
  const desiredTiles = new Map();
  if (!Array.isArray(accounts) || !Array.isArray(channels)) {
    return { visibleChannels: [], allowedByAccount, countsByAccount, desiredTiles };
  }

  const accountIds = new Set(accounts.map(account => account?.id));
  const eligibleChannels = channels.filter(channel => {
    const providerAccounts = eligibleAccountIdsByProvider?.[channel?.provider];
    return Array.isArray(providerAccounts) && providerAccounts.some(accountId => accountIds.has(accountId));
  });
  const visibleChannels = eligibleChannels.filter(channel =>
    !(Array.isArray(economyProviders) && economyProviders.includes(channel.provider)));

  for (const account of accounts) {
    const accountId = account?.id;
    const accountChannels = filterEligibleChannels(accountId, visibleChannels, eligibleAccountIdsByProvider);
    const limits = accountLimitsById?.[accountId] || {};
    const favorites = Array.isArray(favoriteChannelsByAccount?.[accountId])
      ? favoriteChannelsByAccount[accountId]
      : [];
    const isFavorite = item => favorites.includes(String(item?.channel || '').toLowerCase());
    const comparePriority = (left, right) => {
      const favoriteOrder = Number(isFavorite(right.item)) - Number(isFavorite(left.item));
      if (favoriteOrder) return favoriteOrder;
      const leftOpen = existingTileKeys.has(`${accountId}:${left.item?.id}`);
      const rightOpen = existingTileKeys.has(`${accountId}:${right.item?.id}`);
      return Number(rightOpen) - Number(leftOpen);
    };
    const byProvider = { kick: [], twitch: [] };
    for (const channel of accountChannels) byProvider[channel.provider].push(channel);
    const allowedKick = byProvider.kick.sort(comparePriority).slice(0, Math.max(0, limits.kick));
    const allowedTwitch = byProvider.twitch.sort(comparePriority).slice(0, Math.max(0, limits.twitch));
    const allowed = [...allowedKick, ...allowedTwitch].sort((left, right) =>
      Number(isFavorite(right.item)) - Number(isFavorite(left.item)));

    allowedByAccount.set(accountId, allowed);
    countsByAccount.set(accountId, { kick: allowedKick.length, twitch: allowedTwitch.length });
    for (const channel of allowed) {
      desiredTiles.set(`${accountId}:${channel.item.id}`, { ...channel, account });
    }
  }

  return { visibleChannels, allowedByAccount, countsByAccount, desiredTiles };
}

function createLivePlan({ accounts, channels, connectionStatuses } = {}) {
  const eligibleAccountIdsByProvider = { kick: [], twitch: [] };
  const channelsByProvider = { kick: [], twitch: [] };
  const eligible = { kick: new Set(), twitch: new Set() };

  if (!Array.isArray(accounts) || !Array.isArray(channels)) {
    return { channelsByProvider, eligibleAccountIdsByProvider };
  }

  const seenAccountIds = new Set();
  for (const account of accounts) {
    const accountId = account?.id;
    if (typeof accountId !== 'string' || !accountId.trim() || seenAccountIds.has(accountId)) continue;
    seenAccountIds.add(accountId);

    const status = connectionStatuses && Object.prototype.hasOwnProperty.call(connectionStatuses, accountId)
      ? connectionStatuses[accountId]
      : null;
    for (const provider of PROVIDERS) {
      if (!status || !Object.prototype.hasOwnProperty.call(status, provider) || status[provider] !== true) continue;
      eligible[provider].add(accountId);
      eligibleAccountIdsByProvider[provider].push(accountId);
    }
  }

  for (const provider of PROVIDERS) {
    if (eligible[provider].size === 0) continue;
    const seenChannels = new Set();
    for (const item of channels) {
      if (item?.provider !== provider || typeof item.name !== 'string') continue;
      const channel = item.name.trim().toLowerCase();
      if (!CHANNEL_PATTERN.test(channel) || seenChannels.has(channel)) continue;
      seenChannels.add(channel);
      channelsByProvider[provider].push(channel);
    }
    channelsByProvider[provider].sort();
  }

  return { channelsByProvider, eligibleAccountIdsByProvider };
}

(function expose(root, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PokeIdleLivePolicy = api;
})(typeof globalThis === 'object' ? globalThis : this, {
  createLivePlan,
  createResourcePlan,
  canReceiveResources,
  filterEligibleChannels,
});
