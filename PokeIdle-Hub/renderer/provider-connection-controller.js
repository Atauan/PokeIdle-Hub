'use strict';

(() => {
  const PROVIDERS = Object.freeze([
    { id: 'twitch', name: 'Twitch' },
    { id: 'kick', name: 'Kick' },
  ]);

  function createProviderConnectionController({
    getElement,
    getCurrentAccount,
    getAccounts,
    getPrimaryAccount,
    partitionForAccount,
    connections,
    getProviderState,
    getLoginApi,
    confirm,
    toast,
    updateGameBarConnections,
    getHeader,
    renderHeaderBadges,
    syncTiles,
    autoLivesEnabled,
    scheduleLiveChecks,
    refreshProviderStatus,
    log,
  }) {
    function logLoginFlow(stage, details = {}) {
      const entry = { stage };
      if (typeof details.flowId === 'string' && /^[\da-f-]{36}$/i.test(details.flowId)) entry.flowId = details.flowId;
      if (['twitch', 'kick', 'game'].includes(details.provider)) entry.provider = details.provider;
      if (['connected', 'disconnected', 'unavailable'].includes(details.state)) entry.state = details.state;
      log('[auth-flow]', entry);
    }

    function login(provider) {
      const account = getCurrentAccount();
      if (getProviderState(connections.getCached(account?.id), provider) === 'unavailable') {
        logLoginFlow('login_action_blocked', { provider });
        void refreshProviderStatus(account);
        return;
      }
      if (account) {
        logLoginFlow('renderer_login_requested', { provider });
        getLoginApi().openLogin(provider, partitionForAccount(account), account.name);
      } else {
        logLoginFlow('login_action_blocked', { provider });
      }
    }

    async function disconnect(provider, event) {
      event.stopPropagation();
      const account = getCurrentAccount();
      if (!account) return;
      const providerName = PROVIDERS.find(item => item.id === provider)?.name;
      if (!confirm(`Desconectar a ${providerName} da conta "${account.name}"?`)) return;

      await getLoginApi().clearConnection(provider, partitionForAccount(account));
      connections.invalidate(account.id);
      toast(`${providerName} desconectada de ${account.name}`);
      await connections.read(account, { refresh: true });
      await updateGameBarConnections();
      syncTiles();
    }

    function handleLoginClosed({ platform, partition, flowId }) {
      logLoginFlow('window_close_received', { flowId, provider: platform });
      const currentAccounts = getAccounts();
      const accounts = currentAccounts && currentAccounts.length ? currentAccounts : [getPrimaryAccount()];
      const affected = accounts.find(account => partitionForAccount(account) === partition);
      if (!affected || !['twitch', 'kick'].includes(platform)) {
        logLoginFlow('status_refresh_skipped', { flowId, provider: platform });
        return;
      }

      connections.invalidate(affected.id);
      logLoginFlow('status_refresh_started', { flowId, provider: platform });
      void connections.read(affected, { refresh: true }).then((status) => {
        logLoginFlow('status_refresh_completed', {
          flowId,
          provider: platform,
          state: getProviderState(status, platform),
        });
        void updateGameBarConnections();
        const header = getHeader(affected.id);
        if (header) renderHeaderBadges(affected, header);
        syncTiles();
        if (autoLivesEnabled()) scheduleLiveChecks();
      }).catch(() => {
        logLoginFlow('status_refresh_failed', { flowId, provider: platform, state: 'unavailable' });
      });
    }

    function bind() {
      const loginApi = getLoginApi();
      if (loginApi?.onLoginClosed) loginApi.onLoginClosed(handleLoginClosed);
      loginApi?.onLoginTrace?.(entry => log('[auth-flow]', entry));

      for (const provider of PROVIDERS) {
        getElement(`#account-login-${provider.id}`)?.addEventListener('click', () => login(provider.id));
        getElement(`#account-clear-${provider.id}`)?.addEventListener('click', event => {
          void disconnect(provider.id, event);
        });
      }
    }

    return Object.freeze({ bind, handleLoginClosed, login, disconnect });
  }

  const api = Object.freeze({ createProviderConnectionController });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleProviderConnectionController = api;
})();
