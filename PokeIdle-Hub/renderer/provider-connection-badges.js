'use strict';

(() => {
  const PROVIDERS = Object.freeze([
    { id: 'twitch', name: 'Twitch' },
    { id: 'kick', name: 'Kick' },
  ]);

  function createProviderConnectionBadges({
    el,
    getElement,
    getCurrentAccount,
    connections,
    getProviderState,
    partitionForAccount,
    openLogin,
    getHeader,
    isSelectedAccount,
    syncTiles,
    queueMicrotask,
  }) {
    async function updateGameBarConnections() {
      const account = getCurrentAccount();
      if (!account) return;
      const status = await connections.read(account);

      for (const provider of PROVIDERS) {
        const loginButton = getElement(`#account-login-${provider.id}`);
        const clearButton = getElement(`#account-clear-${provider.id}`);
        if (!loginButton || !clearButton) continue;

        const connectionState = getProviderState(status, provider.id);
        if (connectionState === 'connected') {
          loginButton.textContent = `${provider.name} ✓ Conectada`;
          loginButton.style.color = '#86efac';
          loginButton.title = `${provider.name} conectada nesta conta`;
          clearButton.hidden = false;
        } else if (connectionState === 'unavailable') {
          loginButton.textContent = `Verificar ${provider.name}`;
          loginButton.style.color = '#fbbf24';
          loginButton.title = 'Não foi possível verificar a conexão. Clique para tentar novamente.';
          clearButton.hidden = true;
        } else {
          loginButton.textContent = `Entrar na ${provider.name}`;
          loginButton.style.color = '';
          loginButton.title = `Entrar na ${provider.name} nesta conta`;
          clearButton.hidden = true;
        }
      }
    }

    async function render(account, header) {
      const previous = connections.getCached(account.id);
      const status = await connections.read(account);
      if (previous && (previous.twitch !== status.twitch || previous.kick !== status.kick)) {
        queueMicrotask(syncTiles);
      }

      let badges = header.querySelector('.account-col-badges');
      if (!badges) {
        badges = el('div', { class: 'account-col-badges' });
        header.append(badges);
      }
      badges.replaceChildren(...PROVIDERS.map(provider => createBadge(provider, status, account)));
    }

    function createBadge(provider, status, account) {
      const state = getProviderState(status, provider.id);
      if (state === 'connected') {
        return el('span', {
          class: 'badge-conn ok',
          text: `${provider.name} ✓`,
          title: `${provider.name} conectada para ${account.name}`,
        });
      }

      if (state === 'unavailable') {
        return el('button', {
          class: 'badge-conn btn-unavailable',
          text: `${provider.name} ?`,
          title: `Não foi possível verificar a ${provider.name} para ${account.name}. Clique para tentar novamente.`,
          onclick: event => {
            event.stopPropagation();
            void refresh(account);
          },
        });
      }

      return el('button', {
        class: 'badge-conn btn-login',
        text: `+ ${provider.name}`,
        title: `Entrar na ${provider.name} para ${account.name}`,
        onclick: event => {
          event.stopPropagation();
          openLogin(provider.id, partitionForAccount(account), account.name);
        },
      });
    }

    async function refresh(account) {
      if (!account) return;
      connections.invalidate(account.id);
      await connections.read(account, { refresh: true });
      const header = getHeader(account.id);
      if (header) await render(account, header);
      if (isSelectedAccount(account.id)) await updateGameBarConnections();
      syncTiles();
    }

    return Object.freeze({ render, refresh, updateGameBarConnections });
  }

  const api = Object.freeze({ createProviderConnectionBadges });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleProviderConnectionBadges = api;
})();
