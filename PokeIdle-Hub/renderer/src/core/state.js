(() => {
  'use strict';
  // PokeIdle Hub — Módulo Central de Estado e Persistência

  window.PF = window.PF || {};

  const { load, save } = window.PF.DOM;

  const PARTITION = 'persist:pokeidlehub';

  const accountPartition = (a) => {
    if (!a) return PARTITION;
    const id = typeof a === 'object' ? a.id : String(a);
    return id === 'main' ? PARTITION : `persist:pokeidlehub-acc-${id}`;
  };

  const normalizeChannelsList = (list) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const ch = String(item.channel || '').trim().toLowerCase();
      if (!ch || seen.has(ch)) continue;
      seen.add(ch);
      result.push({
        id: item.id || uid(),
        channel: ch,
        muted: item.muted !== false,
      });
    }
    return result;
  };

  function normalizeGameChannels(rows) {
    const channels = new Map();
    if (!Array.isArray(rows)) return [];
    for (const row of rows.slice(0, 200)) {
      if (!row || !['kick', 'twitch'].includes(row.platform) || typeof row.channel !== 'string') continue;
      const channel = row.channel.trim().toLowerCase();
      if (!/^[a-z0-9_-]{2,40}$/.test(channel)) continue;
      channels.set(`${row.platform}:${channel}`, { platform: row.platform, channel });
    }
    return [...channels.values()];
  }

  const DEFAULT_GAME_CHANNELS = [
    { platform: 'twitch', channel: 'surskity11' },
    { platform: 'twitch', channel: 'faasii' },
    { platform: 'twitch', channel: 'patopapao' },
    { platform: 'twitch', channel: 'axtlol' },
    { platform: 'twitch', channel: 'matta' },
    { platform: 'twitch', channel: 'rodil' },
    { platform: 'twitch', channel: 'clovaobengala' },
    { platform: 'twitch', channel: 'xdaren_' },
    { platform: 'twitch', channel: 'biscoitao' },
    { platform: 'twitch', channel: 'cogu' },
    { platform: 'twitch', channel: 'tftoddy' },
    { platform: 'twitch', channel: 'luccatv' },
    { platform: 'twitch', channel: 'techzz' },
    { platform: 'kick', channel: 'axt' },
    { platform: 'kick', channel: 'surskity' },
  ];

  function loadWithDefaults(key, platform) {
    const list = normalizeChannelsList(load(key, []));
    const seen = new Set(list.map(x => x.channel.toLowerCase()));
    for (const d of DEFAULT_GAME_CHANNELS) {
      if (d.platform === platform && !seen.has(d.channel.toLowerCase())) {
        list.push({ id: uid(), channel: d.channel, muted: true });
        seen.add(d.channel.toLowerCase());
      }
    }
    return list;
  }

  const S = {
    kick: loadWithDefaults('pf.kick', 'kick'),
    twitch: loadWithDefaults('pf.twitch', 'twitch'),
    columns: load('pf.columns', 0),
    showChat: load('pf.showChat', true),
    quality: load('pf.quality', 160),   // altura máxima das lives (0 = automática)
    // O gerenciamento automático deve estar ligado em toda inicialização.
    autoLives: true,
    twitchEconomy: load('pf.twitchEconomy', false) === true,
    kickEconomy: load('pf.kickEconomy', false) === true,
    livePlatformFilter: load('pf.livePlatformFilter', 'both'),
    marketAccount: load('pf.marketAccount', 'main'),
    profileLivesActive: load('pf.profileLivesActive', {}),
    hideVideos: load('pf.hideVideos', false) === true,
    favorites: load('pf.favorites', []),
    accountFavorites: (() => {
      const saved = load('pf.accountFavorites', null);
      if (saved && typeof saved === 'object') return saved;
      const legacy = load('pf.favorites', []);
      return Array.isArray(legacy) && legacy.length ? { main: legacy } : {};
    })(),
    limitTwitch: Number(load('pf.limitTwitch', 0)) || 0,
    limitKick: Number(load('pf.limitKick', 0)) || 0,
    keepOpen: load('pf.keepOpen', true) !== false,
    gameChannels: normalizeGameChannels([...DEFAULT_GAME_CHANNELS, ...(load('pf.gameChannels', []))]),
    savedOpenLives: (() => {
      const saved = load('pf.savedOpenLives', []);
      if (!Array.isArray(saved)) return [];
      return saved.filter(item => item && ['kick', 'twitch'].includes(item.platform) &&
        typeof item.channel === 'string' && /^[a-z0-9_-]{2,40}$/.test(item.channel) &&
        typeof item.accountId === 'string');
    })(),
    ignoredGameChannels: load('pf.ignoredGameChannels', []),
    livePoll: [30, 60, 120, 300].includes(load('pf.livePoll', 60)) ? load('pf.livePoll', 60) : 60,
    tab: load('pf.tab', 'lives'),
    // Contas do Pokeidle: a primeira usa a sessão das lives (mantém o login que já existia)
    accounts: (() => {
      const list = load('pf.accounts', null);
      return Array.isArray(list) && list.length ? list : [{ id: 'main', name: 'Conta 1', main: true }];
    })(),
    gameAccount: load('pf.gameAccount', 'main'),
    gameHunt: load('pf.gameHunt', true) !== false,
    frames: load('pf.frames', {}),      // id -> [x, y, largura, altura] em fração da área
    target: 'kick',
  };

  const getAccount = (id) => S.accounts.find((a) => a.id === id) || S.accounts[0];
  const currentAccount = () => getAccount(S.gameAccount);
  const currentLiveAccount = () => getAccount(S.liveProfile);

  function persist() {
    save('pf.kick', S.kick); save('pf.twitch', S.twitch); save('pf.columns', S.columns);
    save('pf.showChat', S.showChat); save('pf.quality', S.quality); save('pf.tab', S.tab); save('pf.frames', S.frames);
    save('pf.accounts', S.accounts); save('pf.gameAccount', S.gameAccount); save('pf.gameHunt', S.gameHunt);
    save('pf.autoLives', S.autoLives); save('pf.livePoll', S.livePoll);
    save('pf.twitchEconomy', S.twitchEconomy);
    save('pf.kickEconomy', S.kickEconomy);
    save('pf.livePlatformFilter', S.livePlatformFilter);
    save('pf.hideVideos', S.hideVideos);
    save('pf.favorites', S.favorites);
    save('pf.accountFavorites', S.accountFavorites);
    save('pf.limitTwitch', S.limitTwitch);
    save('pf.limitKick', S.limitKick);
    save('pf.keepOpen', S.keepOpen);
    save('pf.marketAccount', S.marketAccount);
    save('pf.profileLivesActive', S.profileLivesActive);
    save('pf.liveProfile', S.liveProfile);
    save('pf.gameChannels', S.gameChannels);
    save('pf.savedOpenLives', S.savedOpenLives);
    save('pf.ignoredGameChannels', S.ignoredGameChannels);
  }

  window.PF.State = {
    PARTITION,
    accountPartition,
    normalizeChannelsList,
    normalizeGameChannels,
    S,
    persist,
    getAccount,
    currentAccount,
    currentLiveAccount
  };
})();
