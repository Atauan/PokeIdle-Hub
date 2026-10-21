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

    if (typeof liveStatus !== 'function') return { plan, statusesByProvider, connectionStatuses };
    if (typeof shouldContinue === 'function' && !shouldContinue()) return { plan, statusesByProvider, connectionStatuses };

    await Promise.all(PROVIDERS.map(async provider => {
      const names = plan.channelsByProvider[provider];
      for (let offset = 0; offset < names.length; offset += SERVICE_BATCH_SIZE) {
        if (typeof shouldContinue === 'function' && !shouldContinue()) break;
        const batch = names.slice(offset, offset + SERVICE_BATCH_SIZE);
        try {
          const result = await liveStatus(provider, batch);
          if (!result || typeof result !== 'object') continue;
          for (const name of batch) {
            if (!Object.prototype.hasOwnProperty.call(result, name)) continue;
            if (!['online', 'offline', 'unknown'].includes(result[name])) continue;
            Object.defineProperty(statusesByProvider[provider], name, {
              value: result[name], enumerable: true, configurable: true, writable: true,
            });
          }
        } catch (_) {
          // Ausência de status mantém o estado atual da live como desconhecido no chamador.
        }
      }
    }));

    return { plan, statusesByProvider, connectionStatuses };
  }

  return { discoverLives };
});
