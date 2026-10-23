'use strict';

(function expose(root, factory) {
  const policy = typeof module === 'object' && module.exports
    ? require('./live-policy')
    : root.PokeIdleLivePolicy;
  const api = factory(policy);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PokeIdleLiveDiscovery = api;
})(typeof globalThis === 'object' ? globalThis : this, (policy) => {
  const PROVIDERS = Object.freeze(['kick', 'twitch']);
  const SERVICE_BATCH_SIZE = 200;
  const EMPTY_PLAN = () => ({
    channelsByProvider: { kick: [], twitch: [] },
    eligibleAccountIdsByProvider: { kick: [], twitch: [] },
  });

  async function discoverLives({ accounts, channels, checkConnections, liveStatus, shouldContinue = () => true } = {}) {
    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    const safeChannels = Array.isArray(channels) ? channels : [];
    const statuses = Object.create(null);

    if (typeof checkConnections === 'function') {
      await Promise.all(safeAccounts.map(async account => {
        if (typeof account?.id !== 'string' || !account.id.trim()) return;
        try {
          Object.defineProperty(statuses, account.id, {
            value: await checkConnections(account), enumerable: true, configurable: true, writable: true,
          });
        } catch (_) {
          Object.defineProperty(statuses, account.id, {
            value: null, enumerable: true, configurable: true, writable: true,
          });
        }
      }));
    }

    const plan = typeof policy?.createLivePlan === 'function'
      ? policy.createLivePlan({ accounts: safeAccounts, channels: safeChannels, connectionStatuses: statuses })
      : EMPTY_PLAN();
    const statusesByProvider = { kick: {}, twitch: {} };
    const connectionStatuses = Object.fromEntries(Object.keys(statuses).map(id => [id, statuses[id]]));
    const diagnostics = {
      disconnectedProviders: [],
      unavailableProviders: [],
      failedProviders: [],
      failureReasons: {},
    };
    const requestedProviders = new Set(safeChannels
      .map(channel => channel?.provider)
      .filter(provider => PROVIDERS.includes(provider)));

    for (const provider of PROVIDERS) {
      if (!requestedProviders.has(provider) || plan.eligibleAccountIdsByProvider[provider].length) continue;
      const connectionResults = safeAccounts
        .filter(account => typeof account?.id === 'string' && account.id.trim())
        .map(account => statuses[account.id]);
      const unavailable = connectionResults.length === 0 || connectionResults.some(status =>
        !status || (Array.isArray(status.unavailableProviders) && status.unavailableProviders.includes(provider)));
      diagnostics[unavailable ? 'unavailableProviders' : 'disconnectedProviders'].push(provider);
    }

    if (typeof liveStatus !== 'function') {
      if (plan.channelsByProvider.twitch.length) diagnostics.failedProviders.push('twitch');
      if (plan.channelsByProvider.kick.length) diagnostics.failedProviders.push('kick');
      return { plan, statusesByProvider, connectionStatuses, diagnostics };
    }
    if (typeof shouldContinue === 'function' && !shouldContinue()) {
      return { plan, statusesByProvider, connectionStatuses, diagnostics };
    }

    await Promise.all(PROVIDERS.map(async provider => {
      const names = plan.channelsByProvider[provider];
      for (let offset = 0; offset < names.length; offset += SERVICE_BATCH_SIZE) {
        if (typeof shouldContinue === 'function' && !shouldContinue()) break;
        const batch = names.slice(offset, offset + SERVICE_BATCH_SIZE);
        try {
          const result = await liveStatus(provider, batch);
          if (!result || typeof result !== 'object') {
            diagnostics.failedProviders.push(provider);
            continue;
          }
          if (typeof result.$error === 'string' && result.$error) {
            diagnostics.failedProviders.push(provider);
            diagnostics.failureReasons[provider] = result.$error;
          }
          for (const name of batch) {
            if (!Object.prototype.hasOwnProperty.call(result, name)) continue;
            if (!['online', 'offline', 'unknown'].includes(result[name])) continue;
            Object.defineProperty(statusesByProvider[provider], name, {
              value: result[name], enumerable: true, configurable: true, writable: true,
            });
          }
        } catch (_) {
          diagnostics.failedProviders.push(provider);
          diagnostics.failureReasons[provider] = 'UNKNOWN';
        }
      }
    }));

    diagnostics.failedProviders = [...new Set(diagnostics.failedProviders)];
    return { plan, statusesByProvider, connectionStatuses, diagnostics };
  }

  return { discoverLives };
});
