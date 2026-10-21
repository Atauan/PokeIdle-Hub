'use strict';

(() => {
  function createGameAccountLifecycle({
    state,
    query,
    uid,
    persist,
    setupGame,
    renderAccountTabs,
    refreshConnection,
    invalidateConnection,
    syncTiles,
    setTab,
    confirm,
    clearAccount,
    notify = () => {},
    normalizeAccountOrder,
    resolveDefaultAccountId,
    promoteDefaultAccount,
    setTimeout: schedule,
  }) {
    function addAccount() {
      let number = state.accounts.length + 1;
      while (state.accounts.some((account) => account.name === `Conta ${number}`)) number += 1;
      const account = { id: uid(), name: `Conta ${number}` };
      state.accounts.push(account);
      state.accountOrder = normalizeAccountOrder(state.accounts, state.accountOrder || []);
      state.gameAccount = account.id;
      persist();
      setupGame();
      renderAccountTabs();
      void refreshConnection(account).then(() => syncTiles());
      syncTiles();
      setTab('game');
      return account;
    }

    async function removeAccount() {
      const account = state.accounts.find((item) => item.id === state.gameAccount) || state.accounts[0];
      if (!account || state.accounts.length <= 1) return;
      const message = account.main
        ? `Remover "${account.name}"? A aba fecha. O login continua salvo, porque é o mesmo das lives.`
        : `Remover "${account.name}"? A aba fecha e o login desta conta no Pokeidle é apagado do app.`;
      if (!confirm(message)) return;

      state.accounts = state.accounts.filter((item) => item.id !== account.id);
      invalidateConnection(account.id);
      if (state.accountFavorites && state.accountFavorites[account.id]) {
        delete state.accountFavorites[account.id];
      }
      if (state.accountLimits && state.accountLimits[account.id]) {
        delete state.accountLimits[account.id];
      }
      state.accountOrder = normalizeAccountOrder(
        state.accounts,
        (state.accountOrder || []).filter(id => id !== account.id),
      );
      const preferredAccountId = state.defaultGameAccountId === account.id
        ? null
        : state.defaultGameAccountId;
      state.defaultGameAccountId = resolveDefaultAccountId(
        state.accounts,
        preferredAccountId,
        state.accountOrder,
      );
      state.accountOrder = promoteDefaultAccount(state.accountOrder, state.defaultGameAccountId).accountOrder;
      state.gameAccount = state.defaultGameAccountId;
      persist();
      setupGame();
      renderAccountTabs();
      syncTiles();
      setTab('game');
      if (!account.main) {
        schedule(async () => {
          try {
            const cleared = await clearAccount(account.id);
            notify(cleared === true
              ? `Dados de sessão da conta "${account.name}" foram removidos.`
              : 'A conta foi removida, mas não foi possível confirmar a limpeza da sessão. Os dados podem permanecer armazenados.');
          } catch (_) {
            notify('A conta foi removida, mas não foi possível confirmar a limpeza da sessão. Os dados podem permanecer armazenados.');
          }
        }, 2000);
      }
    }

    function bind() {
      query('#add-account').addEventListener('click', addAccount);
      query('#account-remove').addEventListener('click', () => { void removeAccount(); });
    }

    return { addAccount, bind, removeAccount };
  }

  const api = { createGameAccountLifecycle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameAccountLifecycle = api;
})();
