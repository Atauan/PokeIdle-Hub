(() => {
  'use strict';
  // PokeIdle Hub — Módulo de Gerenciamento das WebViews do Jogo Pokeidle

  window.PF = window.PF || {};

  const { $, el, makeWebview } = window.PF.DOM;
  const { S, accountPartition } = window.PF.State;

  const GAME_URL = 'https://pokeidle.io/app';
  let game = null;
  const games = new Map(); // id da conta -> { pane, wv, market }

  // Consultado somente pelo painel do tray, sem abrir as abas ou alterar o jogo.
  window.__pfCollectSessions = async () => ({
    selected: S.gameAccount,
    accounts: await Promise.all(S.accounts.map(async account => {
      const page = games.get(account.id)?.wv;
      let data = { status: 'waiting' };
      try {
        if (page?.__ready && /(^|\.)pokeidle\.io$/.test(new URL(page.getURL()).hostname)) {
          let timer;
          try {
            data = await Promise.race([
              page.executeJavaScript('window.__pfReadSessionSummary ? window.__pfReadSessionSummary() : ({status: "waiting"})'),
              new Promise(resolve => { timer = setTimeout(() => resolve({ status: 'waiting' }), 2000); }),
            ]);
          } finally { clearTimeout(timer); }
        }
      } catch (_) { /* carregamento, logout ou conta removida */ }
      return { id: account.id, name: account.name || 'Sem nome', data };
    })),
  });

  /** Cria/remove as abas do jogo para bater com a lista de contas. Todas ficam rodando. */
  function setupGame() {
    for (const [id, g] of games) {
      if (!S.accounts.some((a) => a.id === id)) { g.pane.remove(); games.delete(id); }
    }
    S.accounts.forEach((a) => {
      const market = S.marketAccount !== 'off' && a.id === S.marketAccount;
      const g = games.get(a.id);
      if (g && g.market === market) return;
      if (g) { g.pane.remove(); games.delete(a.id); } // virou (ou deixou de ser) a aba do mercado
      const wv = makeWebview(GAME_URL, {
        muted: false,
        now: true,
        skeleton: 'game',
        partition: accountPartition(a),
        onReady: (w) => {
          const poll = window.PF.Alerts?.M?.poll || 60;
          w.executeJavaScript(`window.__pfPoll = ${Number(poll)}`).catch(() => {});
          w.executeJavaScript(`window.__pfEnableMarket && window.__pfEnableMarket(${market})`).catch(() => {});
        },
      });
      wv.addEventListener('ipc-message', (e) => {
        if (e.channel === 'market' && market && window.PF.Alerts?.onMarket) {
          window.PF.Alerts.onMarket(e.args[0]);
        }
        if (e.channel === 'game-channels') {
          try {
            if (/(^|\.)pokeidle\.io$/.test(new URL(wv.getURL()).hostname)) {
              if (window.PF.Lives?.receiveGameChannels) {
                window.PF.Lives.receiveGameChannels(e.args[0], a.id);
              }
            }
          } catch (_) { /* a página já foi fechada/navegou */ }
        }
      });
      const pane = el('div', { class: 'game-pane', 'data-account': a.id }, wv, wv.__skeleton);
      $('#panel-game').append(pane);
      games.set(a.id, { pane, wv, market });
    });
    game = games.get(S.marketAccount !== 'off' ? S.marketAccount : S.accounts[0].id)?.wv || null;
    if (!S.accounts.some((a) => a.id === S.gameAccount)) S.gameAccount = S.accounts[0].id;
  }

  function renderMarketAccountSelector() {
    const sel = $('#market-account');
    if (!sel) return;
    sel.replaceChildren(
      el('option', { value: 'off', text: 'Desativado' }),
      ...S.accounts.map(a => el('option', { value: a.id, text: a.name || 'Conta' }))
    );
    if (S.marketAccount !== 'off' && !S.accounts.some(a => a.id === S.marketAccount)) {
      S.marketAccount = S.accounts[0]?.id || 'off';
    }
    sel.value = S.marketAccount;
  }

  window.PF.Game = {
    GAME_URL,
    get game() { return game; },
    set game(val) { game = val; },
    games,
    setupGame,
    renderMarketAccountSelector
  };
})();
