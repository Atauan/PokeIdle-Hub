'use strict';

(() => {
  function createAccountManagementSettings({
    state,
    stateApi,
    query,
    el,
    persist,
    renderTabs,
    onDefaultAccountChanged = () => {},
  }) {
    function getAccountsInOrder() {
      state.accountOrder = stateApi.normalizeAccountOrder(state.accounts, state.accountOrder);
      const byId = new Map(state.accounts.map(account => [account.id, account]));
      return state.accountOrder.map(id => byId.get(id)).filter(Boolean);
    }

    function render() {
      const container = query('#cfg-account-list');
      if (!container) return;
      const accounts = getAccountsInOrder();
      const defaultId = stateApi.resolveDefaultAccountId(state.accounts, state.defaultGameAccountId, state.accountOrder);
      state.defaultGameAccountId = defaultId;
      state.accountOrder = stateApi.promoteDefaultAccount(state.accountOrder, defaultId).accountOrder;
      const ordered = getAccountsInOrder();
      container.replaceChildren(...ordered.map((account, index) => {
        const isDefault = account.id === defaultId;
        const info = el('div', { class: 'account-settings-info' },
          el('span', { class: 'settings-row-title', text: account.name || 'Sem nome' }),
          el('span', { class: 'muted small', text: isDefault ? 'Conta padrão' : 'Conta' }),
          el('span', { class: 'muted small', text: account.main ? 'Sessão compartilhada com lives' : 'Sessão própria' }),
        );
        const actions = el('div', { class: 'account-settings-actions' },
          el('button', {
            type: 'button',
            text: 'Mover para cima',
            title: 'Mover para cima',
            'aria-label': `Mover ${account.name || 'conta'} para cima`,
            disabled: isDefault || index <= 1,
            onclick: () => move(account.id, 'up'),
          }),
          el('button', {
            type: 'button',
            text: 'Mover para baixo',
            title: 'Mover para baixo',
            'aria-label': `Mover ${account.name || 'conta'} para baixo`,
            disabled: isDefault || index === ordered.length - 1,
            onclick: () => move(account.id, 'down'),
          }),
          el('button', {
            type: 'button',
            class: isDefault ? 'primary' : '',
            text: 'Usar como padrão',
            'aria-label': `Usar ${account.name || 'conta'} como padrão`,
            disabled: isDefault,
            onclick: () => chooseDefault(account.id),
          }),
        );
        return el('li', { class: 'account-settings-row', 'data-account': account.id }, info, actions);
      }));
    }

    function move(accountId, direction) {
      const next = stateApi.moveAccountInOrder(
        state.accountOrder,
        accountId,
        direction,
        state.defaultGameAccountId,
      );
      if (next.every((id, index) => id === state.accountOrder[index])) return;
      state.accountOrder = next;
      persist();
      render();
      renderTabs();
    }

    function chooseDefault(accountId) {
      const next = stateApi.promoteDefaultAccount(state.accountOrder, accountId);
      if (next.defaultGameAccountId === null || next.defaultGameAccountId === state.defaultGameAccountId) return;
      state.accountOrder = next.accountOrder;
      state.defaultGameAccountId = next.defaultGameAccountId;
      state.gameAccount = accountId;
      persist();
      onDefaultAccountChanged(accountId);
      render();
      renderTabs();
    }

    return { render, move, chooseDefault };
  }

  const api = { createAccountManagementSettings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleAccountManagementSettings = api;
})();
