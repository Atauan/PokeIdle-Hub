'use strict';

(() => {
  function createGameAccountTabs({
    getAccounts,
    getAccountOrder = () => null,
    getSelectedAccountId,
    setSelectedAccountId,
    isMosaicEnabled,
    toggleMosaic,
    setTab,
    getContainer,
    getBadge,
    el,
    prompt,
    persist,
    updatePaneHeaders,
  }) {
    function render() {
      const sourceAccounts = getAccounts();
      const byId = new Map(sourceAccounts.map(account => [account.id, account]));
      const order = getAccountOrder();
      const accounts = Array.isArray(order)
        ? order.map(id => byId.get(id)).filter(Boolean).concat(sourceAccounts.filter(account => !order.includes(account.id)))
        : sourceAccounts;
      const selected = accounts.find((account) => account.id === getSelectedAccountId()) || accounts[0];
      getContainer().replaceChildren(...accounts.map((account) => el('button', {
        class: 'acc' + (account.id === selected?.id ? ' on' : ''),
        role: 'tab',
        'data-tab': 'game',
        'data-account': account.id,
        text: account.name || 'Sem nome',
        title: `${account.name || 'Sem nome'} (Duplo clique para renomear)`,
        onclick: () => {
          setSelectedAccountId(account.id);
          if (isMosaicEnabled()) toggleMosaic(false);
          setTab('game');
        },
        ondblclick: (event) => {
          event.stopPropagation();
          const name = prompt('Renomear esta conta:', account.name || '');
          if (name !== null && name.trim()) {
            account.name = name.trim().slice(0, 30);
            persist();
            render();
            setTab('game');
          }
        },
      })));

      const badge = getBadge();
      if (badge) {
        badge.textContent = String(accounts.length);
        badge.hidden = accounts.length === 0;
      }
      updatePaneHeaders();
    }

    return { render };
  }

  const api = { createGameAccountTabs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameAccountTabs = api;
})();
