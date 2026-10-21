'use strict';

(() => {
  function createTwitchEconomyRuntime({
    state,
    getAccounts,
    getEligibleAccountIds,
    partitionForAccount,
    createWebview,
    disposeWebview,
    body,
    controls,
    reloadWebview,
    setIntervalFn = setInterval,
  }) {
    const economyViews = new Map();

    function createView(url, account) {
      const view = createWebview(url, { partition: partitionForAccount(account), muted: true });
      view.classList.add('twitch-economy-session');
      view.setAttribute('aria-hidden', 'true');
      body.append(view);
      economyViews.set(account.id, { view, url, acc: account });
    }

    function sync(channels, eligibleAccountIds = getEligibleAccountIds()) {
      const names = [...new Set(channels.filter(name => /^[a-z0-9_]{1,25}$/.test(name)))].sort();
      const selected = names.slice(0, 100);
      const eligibleIds = new Set(eligibleAccountIds);
      const url = state.twitchEconomy && eligibleIds.size && selected.length
        ? `https://www.twitch.tv/popout/${selected[0]}/chat?pf-economy=1&pf-channels=${encodeURIComponent(selected.join(','))}` : '';

      controls.twitchEconomy.checked = state.twitchEconomy;
      controls.kickEconomy.checked = state.kickEconomy;
      controls.kickHelp.hidden = !state.kickEconomy;
      controls.twitchHelp.hidden = !state.twitchEconomy;
      controls.reload.hidden = !url;
      controls.status.dataset.total = String(names.length);

      const accounts = getAccounts();
      const activeAccounts = accounts.filter(account => eligibleIds.has(account.id));
      const activeAccountIds = new Set(activeAccounts.map(account => account.id));
      for (const [accountId, item] of economyViews) {
        if (!activeAccountIds.has(accountId) || !url) {
          disposeWebview(item.view);
          item.view.remove();
          economyViews.delete(accountId);
        }
      }

      if (!url) {
        controls.status.textContent = !state.twitchEconomy ? ''
          : eligibleIds.size ? 'Aguardando canais online' : 'Nenhuma conta Twitch conectada';
        return;
      }

      for (const account of activeAccounts) {
        const item = economyViews.get(account.id);
        if (!item) createView(url, account);
        else if (item.url !== url) {
          disposeWebview(item.view);
          item.view.remove();
          economyViews.delete(account.id);
          createView(url, account);
        }
      }

      controls.status.textContent = 'Conectando aos chats das contas…';
    }

    async function poll() {
      if (!economyViews.size) return;
      const reports = [];
      for (const item of economyViews.values()) {
        const view = item.view;
        if (!view?.__ready || !view.isConnected) continue;
        try {
          const reportedState = await view.executeJavaScript('window.__pfTwitchEconomy || null');
          reports.push({ account: item.acc, state: reportedState });
        } catch (_) {}
      }
      if (!reports.length) return;
      const unauthenticated = reports.filter(report => report.state && !report.state.authenticated);
      const total = Number(controls.status.dataset.total);
      const limit = total > 100 ? ` · limite: 100 de ${total} canais` : '';
      if (unauthenticated.length) {
        const names = unauthenticated.map(report => report.account.name || 'Conta').join(', ');
        controls.status.textContent = `Sem login na Twitch em: ${names} — use o botão [+ Twitch] na coluna`;
      } else {
        const connected = reports.filter(report => report.state?.connected).length;
        controls.status.textContent = `${connected}/${reports.length} contas conectadas aos chats · sem vídeo${limit}`;
      }
    }

    function reloadAll() {
      for (const item of economyViews.values()) reloadWebview(item.view);
    }

    setIntervalFn(poll, 2000);

    return Object.freeze({ reloadAll, size: () => economyViews.size, sync });
  }

  const api = { createTwitchEconomyRuntime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleTwitchEconomyRuntime = api;
})();
