'use strict';

(() => {
  function createGameSessionSummary({
    getSelectedAccountId,
    getAccounts,
    getWebview,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  }) {
    async function collect() {
      return {
        selected: getSelectedAccountId(),
        accounts: await Promise.all(getAccounts().map(async account => {
          const page = getWebview(account.id);
          let data = { status: 'waiting' };
          try {
            if (page?.__ready && /(^|\.)pokeidle\.io$/.test(new URL(page.getURL()).hostname)) {
              let timer;
              try {
                data = await Promise.race([
                  page.executeJavaScript('window.__pfReadSessionSummary ? window.__pfReadSessionSummary() : ({status: "waiting"})'),
                  new Promise(resolve => {
                    timer = setTimeoutFn(() => resolve({ status: 'waiting' }), 2000);
                  }),
                ]);
              } finally {
                clearTimeoutFn(timer);
              }
            }
          } catch (_) { /* carregamento, logout ou conta removida */ }
          return { id: account.id, name: account.name || 'Sem nome', data };
        })),
      };
    }

    return Object.freeze({ collect });
  }

  const api = Object.freeze({ createGameSessionSummary });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGameSessionSummary = api;
})();
