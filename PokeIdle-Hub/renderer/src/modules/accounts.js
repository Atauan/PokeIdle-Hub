(() => {
  'use strict';
  // PokeIdle Hub — Módulo de Contas Pokeidle e Conexões Twitch/Kick

  window.PF = window.PF || {};

  const { $, $$, el, uid } = window.PF.DOM;
  const { S, persist, accountPartition, currentAccount, currentLiveAccount } = window.PF.State;

  const connectionStatus = new Map(); // part -> { twitch: boolean, kick: boolean }

  async function checkProfileConnections() {
    if (!window.pf?.checkConnections) return;
    for (const acc of S.accounts) {
      const part = accountPartition(acc);
      try {
        const res = await window.pf.checkConnections(part);
        connectionStatus.set(part, res);
      } catch (_) {}
    }
    updateProfileConnectionsUI();
    if (window.PF.Lives?.updateAllTileLoginBadges) {
      window.PF.Lives.updateAllTileLoginBadges();
    }
  }

  async function disconnectProfileConnection(platform) {
    if (!['twitch', 'kick'].includes(platform)) return false;
    const account = currentAccount();
    if (!account) return false;
    const platformName = platform === 'twitch' ? 'Twitch' : 'Kick';
    if (!window.confirm(`Desconectar a sessão da ${platformName} do perfil "${account.name || 'Conta'}"? O login do Pokeidle será mantido.`)) return false;
    const removed = await window.pf.clearConnection(platform, accountPartition(account));
    if (!removed) return false;
    await checkProfileConnections();
    return true;
  }

  function updateProfileConnectionsUI() {
    const a = currentAccount();
    const part = accountPartition(a);
    const status = connectionStatus.get(part) || { twitch: false, kick: false };

    const twitchBadge = $('#profile-twitch-status');
    if (twitchBadge) {
      twitchBadge.textContent = status.twitch ? '✓ Conectada' : '🔑 Conectar';
      twitchBadge.className = `conn-status ${status.twitch ? 'connected' : 'disconnected'}`;
    }
    const twitchDisconnect = $('#profile-logout-twitch');
    if (twitchDisconnect) twitchDisconnect.hidden = !status.twitch;

    const kickBadge = $('#profile-kick-status');
    if (kickBadge) {
      kickBadge.textContent = status.kick ? '✓ Conectada' : '🔑 Conectar';
      kickBadge.className = `conn-status ${status.kick ? 'connected' : 'disconnected'}`;
    }
    const kickDisconnect = $('#profile-logout-kick');
    if (kickDisconnect) kickDisconnect.hidden = !status.kick;

    const liveAcc = currentLiveAccount();
    const livePart = accountPartition(liveAcc);
    const liveStatus = connectionStatus.get(livePart) || { twitch: false, kick: false };

    const liveTwitchBadge = $('#live-twitch-status');
    if (liveTwitchBadge) {
      liveTwitchBadge.textContent = liveStatus.twitch ? '✓ Conectada' : '🔑 Conectar';
      liveTwitchBadge.className = `conn-status ${liveStatus.twitch ? 'connected' : 'disconnected'}`;
    }

    const liveKickBadge = $('#live-kick-status');
    if (liveKickBadge) {
      liveKickBadge.textContent = liveStatus.kick ? '✓ Conectada' : '🔑 Conectar';
      liveKickBadge.className = `conn-status ${liveStatus.kick ? 'connected' : 'disconnected'}`;
    }
  }

  function updateProfileActiveUi() {
    const activeBox = $('#profile-lives-active');
    const labelSpan = $('#profile-active-label');
    if (!activeBox) return;
    if (!S.liveProfile || S.liveProfile === 'all') {
      const allActive = S.accounts.every(a => S.profileLivesActive[a.id] !== false);
      activeBox.checked = allActive;
      if (labelSpan) labelSpan.textContent = 'Todas as contas ativas';
    } else {
      const acc = S.accounts.find(a => a.id === S.liveProfile);
      activeBox.checked = S.profileLivesActive[S.liveProfile] !== false;
      if (labelSpan) labelSpan.textContent = `Lives de ${acc?.name || 'Conta'} ativas`;
    }
  }

  function renderLiveProfileSelector() {
    const sel = $('#live-profile');
    if (!sel) return;
    sel.replaceChildren(
      el('option', { value: 'all', text: 'Todas as contas' }),
      ...S.accounts.map(a => el('option', { value: a.id, text: a.name || 'Conta' }))
    );
    if (S.liveProfile !== 'all' && !S.accounts.some(a => a.id === S.liveProfile)) {
      S.liveProfile = 'all';
    }
    sel.value = S.liveProfile || 'all';
    updateProfileActiveUi();
  }

  function renderAccountTabs() {
    $('#account-tabs').replaceChildren(...S.accounts.map((a) => el('button', {
      class: 'acc', role: 'tab', 'data-tab': 'game', 'data-account': a.id, text: a.name || 'Sem nome', title: a.name || 'Sem nome',
      onclick: () => { S.gameAccount = a.id; window.PF.App.setTab('game'); },
    })));
  }

  function addAccount() {
    let n = S.accounts.length + 1;
    while (S.accounts.some((a) => a.name === `Conta ${n}`)) n += 1;
    const a = { id: uid(), name: `Conta ${n}` };
    S.accounts.push(a);
    S.gameAccount = a.id;
    persist();
    if (window.PF.Game?.setupGame) window.PF.Game.setupGame();
    renderAccountTabs();
    renderLiveProfileSelector();
    if (window.PF.Game?.renderMarketAccountSelector) window.PF.Game.renderMarketAccountSelector();
    window.PF.App.setTab('game');
  }

  async function removeAccount() {
    const a = currentAccount();
    if (!a || S.accounts.length <= 1) return;
    const msg = a.main
      ? `Remover "${a.name}"? A aba fecha. O login continua salvo, porque é o mesmo das lives.`
      : `Remover "${a.name}"? A aba fecha e o login desta conta no Pokeidle é apagado do app.`;
    if (!window.confirm(msg)) return;
    S.accounts = S.accounts.filter((x) => x.id !== a.id);
    S.kick = S.kick.filter(x => (x.accountId || 'main') !== a.id);
    S.twitch = S.twitch.filter(x => (x.accountId || 'main') !== a.id);
    delete S.profileLivesActive[a.id];
    if (S.liveProfile === a.id) S.liveProfile = S.accounts[0].id;
    if (S.marketAccount === a.id) S.marketAccount = S.accounts[0].id;
    S.gameAccount = S.accounts[0].id;
    persist();
    if (window.PF.Game?.setupGame) window.PF.Game.setupGame();
    renderAccountTabs();
    renderLiveProfileSelector();
    if (window.PF.Game?.renderMarketAccountSelector) window.PF.Game.renderMarketAccountSelector();
    if (window.PF.Lives?.syncTiles) window.PF.Lives.syncTiles();
    window.PF.App.setTab('game');
    // Espera a aba fechar antes de apagar o login
    if (!a.main) setTimeout(() => { window.pf.clearAccount(a.id).catch(() => {}); }, 2000);
  }

  window.PF.Accounts = {
    connectionStatus,
    checkProfileConnections,
    disconnectProfileConnection,
    updateProfileConnectionsUI,
    updateProfileActiveUi,
    renderLiveProfileSelector,
    renderAccountTabs,
    addAccount,
    removeAccount
  };
})();
