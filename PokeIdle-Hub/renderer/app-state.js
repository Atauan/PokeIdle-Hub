'use strict';

(() => {
  function normalizeAccountOrder(accounts, savedOrder) {
    if (!Array.isArray(accounts)) return [];
    const validIds = new Set(accounts
      .map(account => account?.id)
      .filter(id => typeof id === 'string' && id.length > 0));
    const seen = new Set();
    const order = [];
    if (Array.isArray(savedOrder)) {
      for (const id of savedOrder) {
        if (!validIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        order.push(id);
      }
    }
    for (const account of accounts) {
      const id = account?.id;
      if (typeof id !== 'string' || !id || seen.has(id)) continue;
      seen.add(id);
      order.push(id);
    }
    return order;
  }

  function moveAccountInOrder(order, accountId, direction, defaultAccountId) {
    if (!Array.isArray(order) || !['up', 'down'].includes(direction)) return [...(order || [])];
    const from = order.indexOf(accountId);
    const to = from + (direction === 'up' ? -1 : 1);
    if (from < 0 || to < 0 || to >= order.length || accountId === defaultAccountId) return [...order];
    if (order[to] === defaultAccountId || (direction === 'down' && from === 0 && accountId === defaultAccountId)) {
      return [...order];
    }
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  }

  function promoteDefaultAccount(order, accountId) {
    if (!Array.isArray(order) || !order.includes(accountId)) {
      return { accountOrder: [...(order || [])], defaultGameAccountId: null };
    }
    return {
      accountOrder: [accountId, ...order.filter(id => id !== accountId)],
      defaultGameAccountId: accountId,
    };
  }

  function resolveDefaultAccountId(accounts, preferredId, order) {
    const ids = new Set((Array.isArray(accounts) ? accounts : [])
      .map(account => account?.id)
      .filter(id => typeof id === 'string' && id.length > 0));
    if (ids.has(preferredId)) return preferredId;
    if (Array.isArray(order)) {
      const firstVisible = order.find(id => ids.has(id));
      if (firstVisible) return firstVisible;
    }
    return (Array.isArray(accounts) ? accounts : []).find(account => ids.has(account?.id))?.id ?? null;
  }

  function createAppState({ load, normalizeGameChannels, normalizeAccountFavorites, normalizeAccountIgnoredGameChannels }) {
    const savedAccounts = load('pf.accounts', null);
    const accounts = Array.isArray(savedAccounts) && savedAccounts.length
      ? savedAccounts
      : [{ id: 'main', name: 'Conta 1', main: true }];
    const legacyGameAccount = load('pf.gameAccount', 'main');
    const accountOrder = normalizeAccountOrder(accounts, load('pf.accountOrder', null));
    const defaultGameAccountId = resolveDefaultAccountId(
      accounts,
      load('pf.defaultGameAccount', legacyGameAccount),
      accountOrder,
    );
    const normalizedOrder = promoteDefaultAccount(accountOrder, defaultGameAccountId).accountOrder;
    return {
      kick: load('pf.kick', []),
      twitch: load('pf.twitch', []),
      columns: load('pf.columns', 0),
      showChat: load('pf.showChat', true),
      quality: load('pf.quality', 160),
      autoLives: load('pf.autoLives', true) === true,
      twitchEconomy: load('pf.twitchEconomy', false) === true,
      kickEconomy: load('pf.kickEconomy', false) === true,
      gameChannels: normalizeGameChannels(load('pf.gameChannels', [])),
      ignoredGameChannels: load('pf.ignoredGameChannels', []),
      livePoll: [30, 60, 120, 300].includes(load('pf.livePoll', 60)) ? load('pf.livePoll', 60) : 60,
      tab: load('pf.tab', 'lives'),
      // A primeira conta usa a sessão das lives para preservar o login existente.
      accounts,
      gameAccount: defaultGameAccountId,
      defaultGameAccountId,
      accountOrder: normalizedOrder,
      gameMosaic: load('pf.gameMosaic', false) === true,
      frames: load('pf.frames', {}),
      target: 'kick',
      hideVideos: load('pf.hideVideos', false) === true,
      accountFavorites: normalizeAccountFavorites(load('pf.accountFavorites', {})),
      accountIgnoredGameChannels: normalizeAccountIgnoredGameChannels(load('pf.accountIgnoredGameChannels', {})),
      fpsForeground: load('pf.fpsForeground', 0),
      fpsBackground: load('pf.fpsBackground', 15),
      suspendBgVideos: load('pf.suspendBgVideos', true) !== false,
      accountLimits: (() => {
        const limits = load('pf.accountLimits', {});
        return limits && typeof limits === 'object' ? limits : {};
      })(),
      universalLimits: (() => {
        const limits = load('pf.universalLimits', { kick: 2, twitch: 3 });
        return limits && typeof limits === 'object' ? limits : { kick: 2, twitch: 3 };
      })(),
      gameActionsVisible: load('pf.gameActionsVisible', true) !== false,
      liveActionsVisible: load('pf.liveActionsVisible', true) !== false,
      accountZoom: load('pf.accountZoom', {}),
    };
  }

  function persistAppState(state, save) {
    save('pf.kick', state.kick); save('pf.twitch', state.twitch); save('pf.columns', state.columns);
    save('pf.showChat', state.showChat); save('pf.quality', state.quality); save('pf.tab', state.tab); save('pf.frames', state.frames);
    save('pf.accounts', state.accounts); save('pf.gameAccount', state.gameAccount);
    save('pf.accountOrder', state.accountOrder); save('pf.defaultGameAccount', state.defaultGameAccountId);
    save('pf.gameMosaic', state.gameMosaic);
    save('pf.gameActionsVisible', state.gameActionsVisible);
    save('pf.liveActionsVisible', state.liveActionsVisible);
    save('pf.accountZoom', state.accountZoom);
    save('pf.autoLives', state.autoLives); save('pf.livePoll', state.livePoll);
    save('pf.twitchEconomy', state.twitchEconomy);
    save('pf.kickEconomy', state.kickEconomy);
    save('pf.gameChannels', state.gameChannels);
    save('pf.ignoredGameChannels', state.ignoredGameChannels);
    save('pf.hideVideos', state.hideVideos);
    save('pf.accountFavorites', state.accountFavorites);
    save('pf.accountIgnoredGameChannels', state.accountIgnoredGameChannels);
    save('pf.fpsForeground', state.fpsForeground);
    save('pf.fpsBackground', state.fpsBackground);
    save('pf.suspendBgVideos', state.suspendBgVideos);
    save('pf.accountLimits', state.accountLimits);
    save('pf.universalLimits', state.universalLimits);
  }

  const api = Object.freeze({
    createAppState,
    persistAppState,
    normalizeAccountOrder,
    moveAccountInOrder,
    promoteDefaultAccount,
    resolveDefaultAccountId,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleAppState = api;
})();
