'use strict';
// PokeIdle Hub — interface (abas, blocos de lives livres, jogo e alertas do mercado)

const PARTITION = 'persist:pokeidlehub';
const accountPartition = (a) => PokeIdleAccountPartition.forAccount(a, PARTITION);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = window.PokeIdleElementFactory.createElementFactory(document);
const toast = window.PokeIdleAppToast.createAppToast({
  query: $,
  setTimeoutFn: setTimeout,
  clearTimeoutFn: clearTimeout,
}).show;

const { load, save } = window.PokeIdleAppStorage.createAppStorage(localStorage);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const { normalizeGameChannels, cleanChannel } = window.PokeIdleLiveChannelPolicy;
const { nextLiveState } = window.PokeIdleLiveState;
const liveAccountPreferences = window.PokeIdleLiveAccountPreferences;
const liveFollowService = window.PokeIdleLiveFollow.createLiveFollowService();

// ---------------- Estado ----------------

const appState = window.PokeIdleAppState;
const S = appState.createAppState({ load, normalizeGameChannels });
function persist() {
  appState.persistAppState(S, save);
}

window.PF = window.PF || {};
window.PF.S = S;
window.PF.persist = persist;

const PLAT = window.PokeIdleLivePlatforms.platforms;

function all() {
  return liveChannelCollection.listAll();
}

// Game-channel import and manual entry live in the collection feature.

// ---------------- WebViews ----------------

// Espaça o início das páginas das lives; tarefas removidas não ocupam um intervalo.
const webviewLoadQueue = PokeIdleLiveRuntime.createLoadQueue({
  setTimeout,
  clearTimeout,
  now: () => performance.now(),
  intervalMs: 1500,
});
window.addEventListener('beforeunload', () => webviewLoadQueue.stop(), { once: true });

function enqueueLoad(job) {
  return webviewLoadQueue.enqueue(job);
}

const liveWebviewFactory = window.PokeIdleLiveWebviewFactory.createLiveWebviewFactory({
  document,
  el,
  enqueueLoad,
  primaryPartition: PARTITION,
});
const { disposeWebview, makeWebview, reloadWebview } = liveWebviewFactory;

// ---------------- Blocos das lives ----------------

const tiles = new Map();   // key -> { root, player, chat, muteBtn, rect, stalls, acc, item, p, key }
let zTop = 10;
const liveAccountPreferenceController = window.PokeIdleLiveAccountPreferenceController.createLiveAccountPreferenceController({
  state: S,
  preferences: liveAccountPreferences,
  getTiles: () => tiles,
  persist,
  syncTiles: () => syncTiles(),
  toast: message => toast(message),
});
const liveTileDragController = window.PokeIdleLiveTileDrag.createLiveTileDragController({
  state: S,
  tiles,
  getGrid: () => $('#grid'),
  getShield: () => $('#shield'),
  layout,
  persist,
  windowObject: window,
});
liveTileDragController.bind();
window.addEventListener('beforeunload', () => liveTileDragController.dispose(), { once: true });
const liveChatOverlay = PokeIdleLiveChatOverlay.createLiveChatOverlay({
  tiles,
  getBackdrop: () => $('#chat-backdrop'),
  applyChatMode: key => applyChatMode(key),
  nextZIndex: () => String(++zTop),
  documentObject: document,
});
const twitchChatFallback = PokeIdleLiveTwitchChatFallback.createLiveTwitchChatFallback({
  tiles,
  isExpanded: key => liveChatOverlay.isExpanded(key),
  collapse: () => collapseChat(),
  expand: key => expandChat(key),
  getChatUrl: channel => PLAT.twitch.chat(channel),
  getPartition: account => accountPartition(account),
  insertChatAfterPlayer: (_key, tile) => tile.playerBox.after(tile.chatBox),
});
const liveMediaControls = window.PokeIdleLiveMediaControls.createLiveMediaControls({
  state: S,
  tiles,
  chatOverlay: liveChatOverlay,
  checkTwitchChat,
  persist,
  nextZIndex: () => String(++zTop),
  reloadWebview,
});

function createTile(p, item, account) {
  return liveTileView.createTile(p, item, account);
}

function checkTwitchChat(key, ready) {
  twitchChatFallback.check(key, ready);
}

function applyMute(key) {
  liveMediaControls.applyMute(key);
}

function applyQuality(wv) {
  liveMediaControls.applyQuality(wv);
}

function applyChatMode(key) {
  return liveMediaControls.applyChatMode(key);
}

function toggleMute(key) {
  liveMediaControls.toggleMute(key);
}

function removeItem(id) {
  liveChannelCollection.removeChannel(id);
}

function bringFront(key) {
  liveMediaControls.bringFront(key);
}

async function followTile(t) {
  return liveFollowService.followTile(t);
}

const liveFollowController = window.PokeIdleLiveFollowController.createLiveFollowController({
  followTile,
  toast,
});

const liveFollowBatch = window.PokeIdleLiveFollowBatch.createLiveFollowBatch({
  getOpenTiles: () => tiles,
  getButton: () => $('#follow-all'),
  followTile,
  toast,
  logError: (...args) => console.error(...args),
  wait: delay => new Promise(resolve => setTimeout(resolve, delay)),
});

function followAllOpenChannels() {
  return liveFollowBatch.followAllOpenChannels();
}

function isAccountFavorite(channel, accId) {
  return liveAccountPreferenceController.isAccountFavorite(channel, accId);
}

function toggleAccountFavorite(channel, accId) {
  liveAccountPreferenceController.toggleAccountFavorite(channel, accId);
}

function getAccountLimits(accId) {
  return liveAccountPreferenceController.getAccountLimits(accId);
}

function applyUniversalLimit(platform, val) {
  liveAccountPreferenceController.applyUniversalLimit(platform, val);
}

function changeAccountLimit(accId, platform, delta) {
  liveAccountPreferenceController.changeAccountLimit(accId, platform, delta);
}

// ---- Chat aberto inteiro (para resgatar pontos: o modal precisa de espaço) ----
// Só muda o CSS: o chat não recarrega ao abrir/fechar.

function expandChat(key) {
  liveChatOverlay.expand(key);
}

function collapseChat() {
  liveChatOverlay.collapse();
}

const providerConnections = PokeIdleProviderConnections.createProviderConnections({
  partitionForAccount: accountPartition,
  checkConnections: partition => window.pf?.checkConnections(partition),
  accountExists: accountId => S.accounts.some(account => account.id === accountId),
});

function syncTiles() {
  liveTileController.sync();
}

const providerConnectionBadges = window.PokeIdleProviderConnectionBadges.createProviderConnectionBadges({
  el,
  getElement: $,
  getCurrentAccount: () => currentAccount(),
  connections: providerConnections,
  getProviderState: PokeIdleProviderConnections.getProviderState,
  partitionForAccount: accountPartition,
  openLogin: (provider, partition, label) => window.pf.openLogin(provider, partition, label),
  getHeader: accountId => liveAccountColumns.getHeader(accountId),
  isSelectedAccount: accountId => currentAccount()?.id === accountId,
  syncTiles: () => syncTiles(),
  queueMicrotask: callback => queueMicrotask(callback),
});

const updateAccountHeaderBadges = (account, header) => providerConnectionBadges.render(account, header);
const refreshProviderStatus = account => providerConnectionBadges.refresh(account);

// ---------------- Monitoramento online/offline ----------------

const twitchEconomyRuntime = window.PokeIdleTwitchEconomyRuntime.createTwitchEconomyRuntime({
  state: S,
  getAccounts: () => S.accounts && S.accounts.length
    ? S.accounts
    : [{ id: 'main', name: 'Conta 1', main: true }],
  getEligibleAccountIds: () => providerConnections.eligibleAccountIds(S.accounts).twitch,
  partitionForAccount: account => accountPartition(account),
  createWebview: (url, options) => makeWebview(url, options),
  disposeWebview,
  body: document.body,
  controls: {
    twitchEconomy: $('#twitch-economy'),
    kickEconomy: $('#kick-economy'),
    kickHelp: $('#kick-economy-help'),
    twitchHelp: $('#twitch-economy-help'),
    reload: $('#twitch-economy-reload'),
    status: $('#twitch-economy-status'),
  },
  reloadWebview,
});

const liveStates = new Map();

const accountLimitControls = window.PokeIdleLiveAccountColumns.createAccountLimitControls({
  el,
  getAccountLimits,
  onChangeLimit: changeAccountLimit,
});

const liveAccountColumns = window.PokeIdleLiveAccountColumns.createLiveAccountColumns({
  el,
  getGrid: () => $('#grid'),
  renderBadges: (account, header) => updateAccountHeaderBadges(account, header),
  renderLimits: accountLimitControls.render,
});

const liveGridLayout = window.PokeIdleLiveGridLayout.createLiveGridLayout({
  state: S,
  getGrid: () => $('#grid'),
  getEmpty: () => $('#empty'),
  getAccounts: () => S.accounts && S.accounts.length
    ? S.accounts
    : [{ id: 'main', name: 'Conta 1', main: true }],
  getTiles: () => tiles,
  getAccountColumns: () => liveAccountColumns,
  isAccountFavorite: (channel, accountId) => isAccountFavorite(channel, accountId),
});

const liveToolbarControls = window.PokeIdleLiveToolbarControls.createLiveToolbarControls({
  query: $,
  queryAll: $$,
  createElement: el,
  state: S,
  persist,
  layout: () => layout(),
  addChannels: (...args) => addChannels(...args),
  tiles,
  applyChatMode,
  applyQuality,
  reloadWebview,
  getItems: all,
  liveStates,
  getDiscoveryState: () => ({
    checking: liveDiscoveryController.isChecking(),
    refreshing: liveDiscoveryController.isRefreshing(),
    manualDiscoveryPending: liveDiscoveryController.isManualDiscoveryPending(),
  }),
  getEconomyViewCount: () => twitchEconomyRuntime.size(),
  getTileCount: () => tiles.size,
  onAutoLivesChanged: enabled => liveDiscoveryController.setAutoLives(enabled),
  onPollingIntervalChanged: value => liveDiscoveryController.setPollingInterval(value),
  onUniversalLimitChanged: (provider, value) => applyUniversalLimit(provider, value),
  onCheckLives: () => { void checkLivesNow(); },
});

const liveGlobalControls = window.PokeIdleLiveGlobalControls.createLiveGlobalControls({
  query: $,
  state: S,
  all,
  tiles,
  persist,
  applyMute,
  followAllOpenChannels,
  reloadTile: tile => liveMediaControls.reloadTile(tile),
  twitchEconomyRuntime,
  syncTiles,
  applyChatMode,
  applyQuality,
  reloadWebview,
});

const liveOptionsDialog = window.PokeIdleLiveOptionsDialog.createLiveOptionsDialog({ query: $ });

const liveTileView = window.PokeIdleLiveTileView.createLiveTileView({
  getPlatform: provider => PLAT[provider],
  getCurrentAccount: () => currentAccount(),
  accountPartition,
  makeWebview,
  el,
  tiles,
  isFavorite: (channel, accountId) => isAccountFavorite(channel, accountId),
  toggleFavorite: (channel, accountId) => toggleAccountFavorite(channel, accountId),
  toggleMute: key => toggleMute(key),
  follow: (tile, button) => liveFollowController.followSingleTile(tile, button),
  reload: tile => liveMediaControls.reloadTile(tile),
  openExternal: url => window.pf.openEdge(url),
  removeItem: id => removeItem(id),
  startDrag: (event, key) => liveTileDragController.startDrag(event, key),
  bringFront: key => bringFront(key),
  applyMute: key => applyMute(key),
  applyQuality: webview => applyQuality(webview),
  applyChatMode: key => applyChatMode(key),
  expandChat: key => expandChat(key),
  checkTwitchChat: (key, ready) => checkTwitchChat(key, ready),
});

const liveTileController = window.PokeIdleLiveTileController.createLiveTileController({
  state: S,
  liveStates,
  tiles,
  getItems: all,
  getAccounts: () => S.accounts && S.accounts.length ? S.accounts : [{ id: 'main', name: 'Conta 1', main: true }],
  getEligibleAccountIdsByProvider: accounts => providerConnections.eligibleAccountIds(accounts),
  getAccountLimits,
  getFavoriteChannelsByAccount: () => S.accountFavorites,
  isTwitchEconomyEnabled: () => S.twitchEconomy,
  policy: PokeIdleLivePolicy,
  runtime: PokeIdleLiveRuntime,
  createTile,
  disposeTile: (tile, key) => {
    if (liveChatOverlay.isExpanded(key)) collapseChat();
    liveTileDragController.cancelForTile(key);
    twitchChatFallback.dispose(tile);
    disposeWebview(tile.player);
    if (tile.chat !== tile.player) disposeWebview(tile.chat);
    tile.root.remove();
  },
  getGrid: () => $('#grid'),
  getColumnBody: accountId => liveAccountColumns.getBody(accountId),
  syncColumns: (accounts, visible, counts) => liveAccountColumns.sync(accounts, visible, counts),
  syncEconomy: (channels, eligibleAccountIds) => twitchEconomyRuntime.sync(channels, eligibleAccountIds),
  persist,
  layout: () => layout(),
  renderControls: () => renderLiveControls(),
});

const liveChannelCollection = window.PokeIdleLiveChannelCollection.createLiveChannelCollection({
  state: S,
  policy: window.PokeIdleLiveChannelPolicy,
  uid,
  liveStates,
  nextLiveState,
  persist,
  syncTiles: () => syncTiles(),
  scheduleLiveChecks: () => scheduleLiveChecks(),
  isLiveRefreshing: () => liveDiscoveryController.isRefreshing(),
  isManualDiscoveryPending: () => liveDiscoveryController.isManualDiscoveryPending(),
  checkLivesNow: () => checkLivesNow(),
  queryAll: $$,
  onAddLive: callback => window.pf.onAddLive(callback),
  toast,
});
const { addChannels, importGameChannels, receiveGameChannels } = liveChannelCollection;

const liveDiscoveryController = window.PokeIdleLiveDiscoveryController.createLiveDiscoveryController({
  state: S,
  getItems: all,
  getItemById: id => liveChannelCollection.findChannelById(id),
  readGameChannels: () => game?.__ready
    ? game.executeJavaScript('window.__pfReadGameChannels ? window.__pfReadGameChannels() : []')
    : null,
  mergeGameChannels: rows => {
    S.gameChannels = normalizeGameChannels([...S.gameChannels, ...normalizeGameChannels(rows)]);
  },
  clearIgnoredGameChannels: () => { S.ignoredGameChannels = []; },
  importGameChannels: () => importGameChannels(),
  getAccounts: () => S.accounts && S.accounts.length
    ? S.accounts
    : [{ id: 'main', name: 'Conta 1', main: true }],
  checkConnections: account => providerConnections.read(account, { refresh: true }),
  liveStatus: (provider, channels) => window.pf.liveStatus(provider, channels),
  discoverLives: options => window.PokeIdleLiveDiscovery.discoverLives(options),
  liveStates,
  nextLiveState,
  persist,
  syncTiles: () => syncTiles(),
  renderControls: () => renderLiveControls(),
});

function scheduleLiveChecks() { liveDiscoveryController.schedule(); }
function checkLivesNow() { return liveDiscoveryController.refreshNow(); }
function checkLives(manual = false) { return liveDiscoveryController.check(manual); }

function renderLiveControls() {
  liveToolbarControls.renderStatus();
}

/** Organização das lives em colunas verticais roláveis com dimensões 16:9 saudáveis. */
function layout() {
  liveGridLayout.layout();
}

new ResizeObserver(() => layout()).observe($('#grid'));

const livePlayerWatchdog = window.PokeIdleLivePlayerWatchdog.createLivePlayerWatchdog({
  getTiles: () => tiles,
  reloadPlayer: player => reloadWebview(player),
});
livePlayerWatchdog.start();
window.addEventListener('beforeunload', () => livePlayerWatchdog.dispose(), { once: true });

// ---------------- Jogo ----------------

const GAME_URL = 'https://pokeidle.io/app';
// Aba que lê o mercado (a primeira conta: o mercado é o mesmo para todas)
let game = null;
const games = new Map();   // id da conta -> { pane, wv }

const gameZoom = window.PokeIdleAccountZoom.createAccountZoomController({
  state: S,
  games,
  persist,
  getSelectedAccountId: () => S.gameAccount,
  getSelectedZoomLabel: () => $('#btn-game-zoom-reset'),
});
const getAccountZoom = (accountId) => gameZoom.get(accountId);
const setAccountZoom = (accountId, factor) => gameZoom.set(accountId, factor);
const adjustAccountZoom = (accountId, delta) => gameZoom.adjust(accountId, delta);
const gameLayout = window.PokeIdleGameLayout.createGameLayout({
  state: S,
  getAccounts: () => S.accounts,
  games,
  getPanel: () => $('#panel-game'),
  getMosaicButton: () => $('#game-toggle-mosaic'),
  persist,
  applyFpsLimits: () => applyFpsLimits(),
  setTab: (tab) => setTab(tab),
});
const updateGamePaneHeaders = () => gameLayout.updatePaneHeaders();
const applyGameMosaic = (enable) => gameLayout.applyMosaic(enable);
const toggleGameMosaic = (force) => gameLayout.toggleMosaic(force);
const focarConta = (accountId) => gameLayout.focusAccount(accountId);
const currentAccount = () => S.accounts.find((a) => a.id === S.gameAccount) || S.accounts[0];
const gameAccountTabs = window.PokeIdleGameAccountTabs.createGameAccountTabs({
  getAccounts: () => S.accounts,
  getAccountOrder: () => appState.normalizeAccountOrder(S.accounts, S.accountOrder),
  getSelectedAccountId: () => S.gameAccount,
  setSelectedAccountId: (id) => { S.gameAccount = id; },
  isMosaicEnabled: () => S.gameMosaic,
  toggleMosaic: (force) => toggleGameMosaic(force),
  setTab: (tab) => setTab(tab),
  getContainer: () => $('#account-tabs'),
  getBadge: () => $('#badge-accounts'),
  el,
  prompt: (message, initialValue) => window.prompt(message, initialValue),
  persist,
  updatePaneHeaders: () => updateGamePaneHeaders(),
});
const renderAccountTabs = () => gameAccountTabs.render();
const gameAccountLifecycle = window.PokeIdleGameAccountLifecycle.createGameAccountLifecycle({
  state: S,
  query: $,
  uid,
  persist,
  setupGame,
  renderAccountTabs,
  refreshConnection: (account) => providerConnections.read(account, { refresh: true }),
  invalidateConnection: (accountId) => providerConnections.invalidate(accountId),
  syncTiles,
  setTab,
  confirm: (message) => window.confirm(message),
  clearAccount: (accountId) => window.pf.clearAccount(accountId),
  notify: toast,
  normalizeAccountOrder: appState.normalizeAccountOrder,
  resolveDefaultAccountId: appState.resolveDefaultAccountId,
  promoteDefaultAccount: appState.promoteDefaultAccount,
  setTimeout,
});

window.PF.games = games;
window.PF.currentAccount = currentAccount;

const gameSessionSummary = window.PokeIdleGameSessionSummary.createGameSessionSummary({
  getSelectedAccountId: () => S.gameAccount,
  getAccounts: () => S.accounts,
  getWebview: accountId => games.get(accountId)?.wv,
});
// Consultado somente pelo painel do tray, sem abrir as abas ou alterar o jogo.
window.__pfCollectSessions = gameSessionSummary.collect;

function createGamePaneHeader(a, wv, isMarket) {
  return window.PokeIdleGamePaneView.createGamePaneHeader({
    account: a,
    webview: wv,
    isMarket,
    createElement: el,
    selectAccount: accountId => { S.gameAccount = accountId; },
    setTab,
    getZoom: getAccountZoom,
    adjustZoom: adjustAccountZoom,
    setZoom: setAccountZoom,
    openCockpit: (accountId, name) => {
      if (window.pf?.openRotomCockpit) window.pf.openRotomCockpit(accountId, name);
    },
    focusAccount: focarConta,
    reloadWebview,
  });
}

/** Cria/remove as abas do jogo para bater com a lista de contas. Todas ficam rodando. */
function setupGame() {
  gameWorkspaceLifecycle.setup();
}

const gamePaneFactory = window.PokeIdleGamePaneFactory.createGamePaneFactory({
  gameUrl: GAME_URL,
  makeWebview,
  accountPartition,
  getZoom: getAccountZoom,
  getMarketPoll: () => Number(marketAlerts.poll) || 60,
  applyFpsLimits: () => applyFpsLimits(),
  bindGameWebviewEvents: ({ webview, account, market }) => {
    window.PokeIdleGameWebviewEvents.bindGameWebviewEvents({
      webview,
      account,
      market,
      adjustZoom: adjustAccountZoom,
      resetZoom: accountId => setAccountZoom(accountId, 1.0),
      captureMarket: payload => marketAlerts.capture(payload),
      receiveChannels: receiveGameChannels,
      sendRotomMessage: (accountId, payload) => {
        if (window.pf?.sendRotomFromWebview) window.pf.sendRotomFromWebview(accountId, payload);
      },
      persist,
      renderAccountTabs,
    });
  },
  createHeader: createGamePaneHeader,
  createElement: el,
  getPanel: () => $('#panel-game'),
});

const gameWorkspaceLifecycle = window.PokeIdleGameWorkspaceLifecycle.createGameWorkspaceLifecycle({
  state: S,
  games,
  planWorkspace: (accounts, resources) => PokeIdleGameWorkspacePolicy.planGameWorkspace(accounts, resources),
  ensureHeader: (account, resource, market) => {
    resource.pane.prepend(createGamePaneHeader(account, resource.wv, market));
  },
  createResource: (account, market) => gamePaneFactory.create(account, market),
  setPrimaryWebview: (webview) => { game = webview; },
  afterSetup: () => {
    updateGamePaneHeaders();
    renderAccountTabs();
    if (S.gameMosaic) applyGameMosaic(true);
    applyFpsLimits();
  },
});

// ---------------- Alertas do mercado ----------------

const marketAlerts = window.PF.MarketAlerts.createMarketAlerts({
  load,
  save,
  $,
  el,
  uid,
  policy: window.PF.MarketAlertPolicy,
  engine: window.PF.MarketAlertEngine,
  notify: (title, body) => window.pf.notify(title, body),
  attention: () => window.pf.attention(),
  writeSample: (url, sample) => window.pf.writeSample(url, sample),
});
// ---------------- Barra e abas ----------------

function setTab(tab) {
  appNavigation.setTab(tab);
}

function updateGameActionsToggleBtn() {
  const btn = $('#btn-toggle-game-actions');
  if (!btn) return;
  const isVisible = S.gameActionsVisible !== false;
  btn.innerHTML = isVisible ? '▲ Opções' : '▼ Opções';
  btn.title = isVisible
    ? 'Ocultar barra de ações do jogo'
    : 'Mostrar barra de ações do jogo';
  btn.classList.toggle('active', isVisible);
}

function updateLiveActionsToggleBtn() {
  const btn = $('#btn-toggle-live-actions');
  if (!btn) return;
  const isVisible = S.liveActionsVisible !== false;
  btn.innerHTML = isVisible ? '▲ Ações' : '▼ Ações';
  btn.title = isVisible
    ? 'Ocultar barra de ações das lives'
    : 'Mostrar barra de ações das lives';
  btn.classList.toggle('active', isVisible);
}

const gameFpsLimits = window.PokeIdleGameFpsLimits.createGameFpsLimits({
  state: S,
  getCurrentAccount: currentAccount,
  games,
});
const applyFpsLimits = () => gameFpsLimits.apply();

const settingsPreferences = window.PokeIdleSettingsPreferences.createSettingsPreferences({
  state: S,
  query: $,
  persist,
  applyFpsLimits,
  toast,
  platform: window.pf?.platform || 'unknown',
  cleanRam: () => window.pf?.cleanRam ? window.pf.cleanRam() : Promise.resolve({ ok: false }),
  trimHubWorkingSet: () => window.pf?.trimHubWorkingSet ? window.pf.trimHubWorkingSet() : Promise.resolve({ ok: false }),
  getMaintenanceSummary: () => window.pf?.getSessionMaintenanceSummary
    ? window.pf.getSessionMaintenanceSummary()
    : Promise.resolve({ ok: false }),
  getLiveRuntimeMetrics: () => {
    let playerChatViews = 0;
    for (const tile of tiles.values()) {
      if (tile.player?.isConnected) playerChatViews += 1;
      if (tile.chat && tile.chat !== tile.player && tile.chat.isConnected) playerChatViews += 1;
    }
    return {
      tileCount: tiles.size,
      playerChatViews,
      economyViews: twitchEconomyRuntime.size(),
      queue: webviewLoadQueue.getStats(),
    };
  },
  restartApp: () => window.pf?.restartApp ? window.pf.restartApp() : Promise.resolve({ ok: false }),
  resetAppData: () => window.pf?.resetAppData ? window.pf.resetAppData() : Promise.resolve({ ok: false }),
  confirm: message => window.confirm(message),
});

const accountManagementSettings = window.PokeIdleAccountManagementSettings.createAccountManagementSettings({
  state: S,
  stateApi: appState,
  query: $,
  el,
  persist,
  renderTabs: renderAccountTabs,
  onDefaultAccountChanged: () => {
    updateGamePaneHeaders();
    applyFpsLimits();
  },
});

const gameToolbarControls = window.PokeIdleGameToolbarControls.createGameToolbarControls({
  query: $,
  getCurrentAccount: currentAccount,
  getGames: () => games,
  reloadWebview,
  toggleMosaic: () => toggleGameMosaic(),
  openEdge: url => window.pf.openEdge(url),
  gameUrl: GAME_URL,
  openRotomCockpit: (accountId, accountName) => window.pf?.openRotomCockpit?.(accountId, accountName),
  openGameLogin: partition => window.pf.openGameLogin(partition),
  partitionForAccount: accountPartition,
  toast,
});

function setupSettings() {
  settingsPreferences.setup();
  accountManagementSettings.render();
}

const providerConnectionController = window.PokeIdleProviderConnectionController.createProviderConnectionController({
  getElement: selector => $(selector),
  getCurrentAccount: () => currentAccount(),
  getAccounts: () => S.accounts,
  getPrimaryAccount: () => ({ id: 'main', name: 'Conta 1', main: true }),
  partitionForAccount: accountPartition,
  connections: providerConnections,
  getProviderState: PokeIdleProviderConnections.getProviderState,
  getLoginApi: () => window.pf,
  confirm: message => window.confirm(message),
  toast,
  updateGameBarConnections: () => providerConnectionBadges.updateGameBarConnections(),
  getHeader: accountId => liveAccountColumns.getHeader(accountId),
  renderHeaderBadges: updateAccountHeaderBadges,
  syncTiles: () => syncTiles(),
  autoLivesEnabled: () => S.autoLives,
  scheduleLiveChecks: () => scheduleLiveChecks(),
  refreshProviderStatus: account => refreshProviderStatus(account),
  log: (...args) => console.info(...args),
});

const appNavigation = window.PokeIdleAppNavigation.createAppNavigation({
  state: S,
  persist,
  query: $,
  queryAll: $$,
  getCurrentAccount: currentAccount,
  getAccounts: () => S.accounts,
  games,
  updateGameBarConnections: () => providerConnectionBadges.updateGameBarConnections(),
  applyGameMosaic,
  getAccountZoom,
  updateGameActionsToggleBtn,
  updateLiveActionsToggleBtn,
  renderMarketAlerts: () => marketAlerts.render(),
  initFarmAfk: () => { if (window.PF?.FarmAfk?.init) window.PF.FarmAfk.init(); },
  renderSettings: () => {
    settingsPreferences.render();
    accountManagementSettings.render();
  },
  layoutLives: layout,
  applyFpsLimits,
  onOpenTab: callback => window.pf.onOpenTab(callback),
});

const appChromeControls = window.PokeIdleAppChromeControls.createAppChromeControls({
  query: $,
  queryAll: $$,
  save,
  load,
  getTab: () => S.tab,
  layout,
  documentObject: document,
});

function setupBar() {
  $('#panel-lives')?.classList.toggle('suspend-bg', S.suspendBgVideos !== false);
  setupSettings();

  // Navegação da sidebar lateral
  appNavigation.bind();

  appChromeControls.bind();

  gameAccountLifecycle.bind();

  gameZoom.bindControls({
    query: $,
    windowObject: window,
    getActiveTab: () => S.tab,
    getSelectedAccountId: () => S.gameAccount,
  });
  liveToolbarControls.bind();

  liveGlobalControls.bind();

  liveOptionsDialog.bind();

  gameToolbarControls.bind();
  liveChatOverlay.bind();

  providerConnectionController.bind();
  liveChannelCollection.bind();

  marketAlerts.bind({
    onPollChanged: poll => {
      if (game && game.__ready) game.executeJavaScript(`window.__pfPoll = ${poll}`).catch(() => {});
    },
    testNotification: () => window.pf.notify('PokeIdle Hub', 'Teste de alerta: notificações funcionando.'),
    openSamples: () => window.pf.openDataDir(),
  });

  window.PokeIdleGameWebviewEvents.bindRotomForwardEvent({
    onRotomForwardToGame: typeof window.pf?.onRotomForwardToGame === 'function'
      ? callback => window.pf.onRotomForwardToGame(callback)
      : null,
    getGame: accountId => games.get(accountId),
  });

}

// ---------------- Link de live clicado no jogo ----------------

// ---------------- Início ----------------

setupBar();
liveToolbarControls.setTarget('kick');
setupGame();
renderAccountTabs();
importGameChannels();
void providerConnections.refresh(S.accounts).then(() => syncTiles());
scheduleLiveChecks();
setTab(S.tab);
marketAlerts.render();
