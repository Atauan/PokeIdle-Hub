(function exposeProviderConnections(root) {
'use strict';

const PROVIDERS = ['twitch', 'kick'];

function getProviderState(status, provider) {
  if (!PROVIDERS.includes(provider)) return 'unavailable';
  if (!status || typeof status !== 'object') return 'unavailable';
  if (Array.isArray(status?.unavailableProviders) && status.unavailableProviders.includes(provider)) return 'unavailable';
  return status?.[provider] === true ? 'connected' : 'disconnected';
}

function createProviderConnections({ partitionForAccount, checkConnections, accountExists }) {
  const statuses = new Map();
  const requests = new Map();

  function read(account, { refresh = false } = {}) {
    if (!account || typeof account.id !== 'string') return Promise.resolve({ twitch: false, kick: false, unavailableProviders: ['twitch', 'kick'] });
    if (!refresh && statuses.has(account.id)) return Promise.resolve(statuses.get(account.id));
    const pending = requests.get(account.id);
    if (pending) return pending;

    const request = Promise.resolve()
      .then(() => checkConnections(partitionForAccount(account)))
      .catch(() => null)
      .then(status => {
        const unavailableProviders = status && Array.isArray(status.unavailableProviders)
          ? PROVIDERS.filter(provider => status.unavailableProviders.includes(provider))
          : status ? [] : [...PROVIDERS];
        const normalized = {
          twitch: status?.twitch === true,
          kick: status?.kick === true,
          unavailableProviders,
        };
        if (requests.get(account.id) === request && accountExists(account.id)) statuses.set(account.id, normalized);
        return normalized;
      })
      .finally(() => {
        if (requests.get(account.id) === request) requests.delete(account.id);
      });
    requests.set(account.id, request);
    return request;
  }

  function invalidate(accountId) {
    statuses.delete(accountId);
    requests.delete(accountId);
  }

  function getCached(accountId) {
    return statuses.get(accountId);
  }

  function eligibleAccountIds(accounts) {
    return {
      twitch: accounts.filter(account => getProviderState(statuses.get(account.id), 'twitch') === 'connected').map(account => account.id),
      kick: accounts.filter(account => getProviderState(statuses.get(account.id), 'kick') === 'connected').map(account => account.id),
    };
  }

  async function refresh(accounts) {
    await Promise.all(accounts.map(account => read(account, { refresh: true })));
    return eligibleAccountIds(accounts);
  }

  return Object.freeze({ read, invalidate, getCached, eligibleAccountIds, refresh });
}
const api = Object.freeze({ createProviderConnections, getProviderState });
if (typeof module === 'object' && module.exports) module.exports = api;
else root.PokeIdleProviderConnections = api;
})(typeof globalThis === 'object' ? globalThis : this);
