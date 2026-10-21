'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { forAccount, isAdditionalPartition } = require('../account-partition');

const rendererRoot = path.join(__dirname, '..', 'renderer');

test('renderer entrypoint loads active modules and excludes replaced legacy modules', () => {
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const scripts = [...index.matchAll(/<script\s+src="([^"]+)"/g)].map(([, src]) => src);
  const replacedLegacy = [
    'src/core/state.js',
    'src/core/dom.js',
    'src/modules/accounts.js',
    'src/modules/lives.js',
    'src/modules/game.js',
    'src/modules/alerts.js',
  ];

  assert.ok(scripts.includes('src/modules/farm-afk.js'));
  assert.ok(scripts.includes('app.js'));
  assert.ok(scripts.includes('live-options-dialog.js'));
  for (const legacyPath of replacedLegacy) {
    assert.ok(!scripts.includes(legacyPath), `${legacyPath} must not be loaded`);
    assert.equal(fs.existsSync(path.join(rendererRoot, legacyPath)), false, `${legacyPath} should be removed after replacement`);
  }
});

test('active live toolbar controls are composed by app.js and loaded before the coordinator', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const moduleSource = fs.readFileSync(path.join(rendererRoot, 'live-toolbar-controls.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');

  assert.match(source, /PokeIdleLiveToolbarControls\.createLiveToolbarControls\(/);
  assert.match(source, /addChannels:\s*\(\.\.\.args\)\s*=>\s*addChannels\(\.\.\.args\)/);
  assert.match(source, /liveToolbarControls\.bind\(\)/);
  assert.match(source, /onAutoLivesChanged:\s*enabled\s*=>\s*liveDiscoveryController\.setAutoLives\(enabled\)/);
  assert.match(source, /onUniversalLimitChanged:\s*\(provider, value\)\s*=>\s*applyUniversalLimit\(provider, value\)/);
  assert.doesNotMatch(source, /\$\('#auto-lives'\)\.addEventListener/);
  assert.doesNotMatch(source, /\$\('#check-lives'\)\.addEventListener/);
  assert.match(moduleSource, /function setTarget\(provider\)/);
  assert.ok(index.indexOf('<script src="live-toolbar-controls.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active live global controls are composed by app.js and loaded before the coordinator', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const moduleSource = fs.readFileSync(path.join(rendererRoot, 'live-global-controls.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');

  assert.match(source, /PokeIdleLiveGlobalControls\.createLiveGlobalControls\(/);
  assert.match(source, /liveGlobalControls\.bind\(\)/);
  assert.match(moduleSource, /!state\.kickEconomy && !state\.quality/);
  assert.ok(index.indexOf('<script src="live-global-controls.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('live limits stay in the action bar while secondary controls live in the options dialog', () => {
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const dialogStart = index.indexOf('<dialog id="live-options-dialog"');
  const dialogEnd = index.indexOf('</dialog>', dialogStart);
  const dialog = index.slice(dialogStart, dialogEnd);
  const actionsBarStart = index.indexOf('<div id="lives-actions-bar"');
  const actionsBarEnd = index.indexOf('</div>', actionsBarStart);
  const actionsHeader = index.slice(actionsBarStart, dialogStart);

  assert.ok(dialogStart >= 0 && dialogEnd > dialogStart);
  assert.match(actionsHeader, /id="universal-limit-kick"/);
  assert.match(actionsHeader, /id="universal-limit-twitch"/);
  assert.match(actionsHeader, /id="auto-lives"/);
  assert.match(actionsHeader, /data-clear="all"/);
  assert.match(actionsHeader, /id="live-options-open"/);
  assert.doesNotMatch(dialog, /universal-limit-(kick|twitch)/);
  for (const id of ['columns', 'quality', 'chat-toggle', 'toggle-video-view', 'twitch-economy', 'kick-economy', 'twitch-economy-reload']) {
    assert.match(dialog, new RegExp(`id="${id}"`));
  }
  assert.ok(actionsBarEnd > actionsBarStart);
});

test('options dialog controller is loaded and composed by the renderer coordinator', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  assert.match(source, /PokeIdleLiveOptionsDialog\.createLiveOptionsDialog\(/);
  assert.match(source, /liveOptionsDialog\.bind\(\)/);
  assert.ok(index.indexOf('<script src="live-options-dialog.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('baseline: account partition mapping preserves the primary and per-account identities', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  assert.match(source, /PokeIdleAccountPartition\.forAccount\(a, PARTITION\)/);
  assert.equal(forAccount({ id: 'main', main: true }, 'persist:pokeidlehub'), 'persist:pokeidlehub');
  assert.equal(forAccount({ id: 'alt-123', main: false }, 'persist:pokeidlehub'), 'persist:pokeidlehub-acc-alt-123');
  assert.equal(isAdditionalPartition('persist:pokeidlehub-acc-alt-123'), true);
  assert.equal(isAdditionalPartition('persist:pokeidlehub-acc-invalid_id'), false);
});

test('account partition helper exposes its API to classic renderer scripts', () => {
  const helperSource = fs.readFileSync(path.join(__dirname, '..', 'account-partition.js'), 'utf8');
  const browserContext = { window: {} };
  vm.runInNewContext(helperSource, browserContext, { filename: 'account-partition.js' });

  assert.equal(typeof browserContext.PokeIdleAccountPartition.forAccount, 'function');
  assert.equal(
    browserContext.PokeIdleAccountPartition.forAccount({ id: 'secondary', main: false }),
    'persist:pokeidlehub-acc-secondary',
  );
});

test('baseline: a live stays open through one offline/unknown result and closes after two offline results', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'live-state.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  const { nextLiveState } = sandbox.window.PokeIdleLiveState;

  let state = nextLiveState(undefined, 'online', false);
  assert.deepEqual({ ...state }, { status: 'online', offlineCount: 0, open: true });
  state = nextLiveState(state, 'unknown', true);
  assert.deepEqual({ ...state }, { status: 'unknown', offlineCount: 0, open: true });
  state = nextLiveState(state, 'offline', true);
  assert.deepEqual({ ...state }, { status: 'offline', offlineCount: 1, open: true });
  state = nextLiveState(state, 'offline', true);
  assert.deepEqual({ ...state }, { status: 'offline', offlineCount: 2, open: false });
});

test('active status polling delegates discovery through connection-aware policy', () => {
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const controller = fs.readFileSync(path.join(rendererRoot, 'live-discovery-controller.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(app, /createLiveDiscoveryController\(\{[\s\S]*?getItems: all,[\s\S]*?checkConnections: account => providerConnections\.read\(account, \{ refresh: true \}\),[\s\S]*?liveStatus: \(provider, channels\) => window\.pf\.liveStatus\(provider, channels\)/);
  assert.match(app, /discoverLives: options => window\.PokeIdleLiveDiscovery\.discoverLives\(options\)/);
  assert.match(controller, /channels: items\.map\(\(\{ p, i \}\) => \(\{ provider: p, name: i\.channel \}\)\)/);
  assert.match(controller, /shouldContinue: \(\) => generation === liveGeneration && \(state\.autoLives \|\| manual\)/);
});

test('tile and Twitch economy reconciliation are restricted to eligible account sessions', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const tileController = fs.readFileSync(path.join(rendererRoot, 'live-tile-controller.js'), 'utf8').replace(/\r\n/g, '\n');
  const economyRuntime = fs.readFileSync(path.join(rendererRoot, 'twitch-economy-runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const syncTiles = source.match(/function syncTiles\(\) \{([\s\S]*?)\n\}/);
  assert.ok(syncTiles, 'active syncTiles function should be found');
  assert.match(syncTiles[1], /liveTileController\.sync\(\)/);
  assert.match(tileController, /getEligibleAccountIdsByProvider\(accounts\)/);
  assert.match(tileController, /policy\.createResourcePlan\(/);
  assert.match(tileController, /getFavoriteChannelsByAccount\(\)/);
  assert.match(tileController, /economyProviders: isTwitchEconomyEnabled\(\) \? \['twitch'\] : \[\]/);
  assert.match(tileController, /runtime\.reconcileMap\(tiles, desiredTiles/);
  assert.match(tileController, /syncEconomy\(open\.filter\(entry => entry\.p === 'twitch'\)/);
  assert.match(source, /const liveTileController = window\.PokeIdleLiveTileController\.createLiveTileController\(/);
  assert.match(source, /disposeTile: \(tile, key\) => \{[\s\S]*disposeWebview\(tile\.player\)/);
  assert.match(economyRuntime, /accounts\.filter\(account => eligibleIds\.has\(account\.id\)\)/);
  assert.match(economyRuntime, /if \(!activeAccountIds\.has\(accountId\) \|\| !url\)/);
  assert.match(economyRuntime, /view\.executeJavaScript\('window\.__pfTwitchEconomy \|\| null'\)/);
  assert.match(economyRuntime, /setIntervalFn\(poll, 2000\)/);
  assert.match(source, /const twitchEconomyRuntime = window\.PokeIdleTwitchEconomyRuntime\.createTwitchEconomyRuntime\(/);
  assert.doesNotMatch(source, /const economyViews = new Map\(\)|function syncTwitchEconomy\(/);
  assert.ok(index.indexOf('<script src="live-tile-controller.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(index.indexOf('<script src="twitch-economy-runtime.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active live runtime cancels removed webview jobs and stops on renderer unload', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const tileController = fs.readFileSync(path.join(rendererRoot, 'live-tile-controller.js'), 'utf8').replace(/\r\n/g, '\n');
  const webviewFactory = fs.readFileSync(path.join(rendererRoot, 'live-webview-factory.js'), 'utf8').replace(/\r\n/g, '\n');
  const economyRuntime = fs.readFileSync(path.join(rendererRoot, 'twitch-economy-runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

  assert.match(source, /PokeIdleLiveRuntime\.createLoadQueue\(/);
  assert.match(source, /beforeunload[\s\S]*webviewLoadQueue\.stop\(\)/);
  assert.match(source, /const liveWebviewFactory = window\.PokeIdleLiveWebviewFactory\.createLiveWebviewFactory\(/);
  assert.match(webviewFactory, /function disposeWebview\(webview\) \{[\s\S]*webview\.__pfCancelQueuedLoad\?\.\(\)/);
  assert.match(tileController, /runtime\.reconcileMap\(tiles, desiredTiles/);
  assert.match(source, /disposeTile: \(tile, key\) => \{[\s\S]*disposeWebview\(tile\.player\)/);
  assert.match(economyRuntime, /disposeWebview\(item\.view\);\s*item\.view\.remove\(\)/);
  assert.ok(index.indexOf('<script src="../live-runtime.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(index.indexOf('<script src="live-webview-factory.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('live-runtime.js'));
});

test('live account columns own per-account DOM references and load before the coordinator', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'live-account-columns.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'live-account-columns.js' });

  assert.equal(typeof browserContext.window.PokeIdleLiveAccountColumns.createLiveAccountColumns, 'function');
  assert.match(app, /const liveAccountColumns = window\.PokeIdleLiveAccountColumns\.createLiveAccountColumns\(/);
  assert.match(app, /syncColumns: \(accounts, visible, counts\) => liveAccountColumns\.sync\(accounts, visible, counts\)/);
  assert.match(app, /getHeader: accountId => liveAccountColumns\.getHeader\(accountId\)/);
  assert.doesNotMatch(app, /const (?:accountCols|colHeaders) = new Map\(\)/);
  assert.ok(index.indexOf('<script src="live-account-columns.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('live grid layout is an active module composed through the renderer coordinator', () => {
  const moduleSource = fs.readFileSync(path.join(rendererRoot, 'live-grid-layout.js'), 'utf8');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const browserContext = { window: {} };

  vm.runInNewContext(moduleSource, browserContext, { filename: 'live-grid-layout.js' });

  assert.equal(typeof browserContext.window.PokeIdleLiveGridLayout.createLiveGridLayout, 'function');
  assert.match(app, /const liveGridLayout = window\.PokeIdleLiveGridLayout\.createLiveGridLayout\(/);
  assert.match(app, /function layout\(\) \{\s*liveGridLayout\.layout\(\);\s*\}/);
  assert.ok(index.indexOf('<script src="live-grid-layout.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});

test('live tile view owns markup and account-bound webview creation while app injects actions', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'live-tile-view.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'live-tile-view.js' });

  assert.equal(typeof browserContext.window.PokeIdleLiveTileView.createLiveTileView, 'function');
  assert.match(source, /const partition = accountPartition\(acc\)[\s\S]*makeWebview\(platform\.player\(item\.channel\), \{\s*partition,/);
  assert.match(source, /sharedTwitch \? null : tile\.chatBox/);
  assert.match(source, /onReady: webview => \{ applyMute\(key\); applyQuality\(webview\); applyChatMode\(key\); \}/);
  assert.match(app, /function createTile\(p, item, account\) \{\s*return liveTileView\.createTile\(p, item, account\);\s*\}/);
  assert.match(app, /const liveTileView = window\.PokeIdleLiveTileView\.createLiveTileView\(/);
  assert.match(app, /follow: \(tile, button\) => liveFollowController\.followSingleTile\(tile, button\)/);
  assert.ok(index.indexOf('<script src="live-tile-view.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(app.indexOf('const accountPartition =') < app.indexOf('const liveTileView ='));
});

test('live chat overlay owns expanded-chat state and loads before the renderer coordinator', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'live-chat-overlay.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'live-chat-overlay.js' });

  assert.equal(typeof browserContext.window.PokeIdleLiveChatOverlay.createLiveChatOverlay, 'function');
  assert.match(app, /const liveChatOverlay = PokeIdleLiveChatOverlay\.createLiveChatOverlay\(/);
  assert.match(app, /function expandChat\(key\) \{\s*liveChatOverlay\.expand\(key\);\s*\}/);
  assert.match(app, /liveChatOverlay\.bind\(\)/);
  assert.doesNotMatch(app, /\$\('#chat-backdrop'\)\.addEventListener/);
  assert.match(app, /liveChatOverlay\.isExpanded\(key\)/);
  assert.doesNotMatch(app, /let expandedChat = null/);
  assert.ok(index.indexOf('<script src="live-chat-overlay.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('Twitch chat fallback is a renderer module with explicit timer disposal', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'live-twitch-chat-fallback.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'live-twitch-chat-fallback.js' });

  assert.equal(typeof browserContext.window.PokeIdleLiveTwitchChatFallback.createLiveTwitchChatFallback, 'function');
  assert.match(app, /const twitchChatFallback = PokeIdleLiveTwitchChatFallback\.createLiveTwitchChatFallback\(/);
  assert.match(app, /function checkTwitchChat\(key, ready\) \{\s*twitchChatFallback\.check\(key, ready\);\s*\}/);
  assert.match(app, /twitchChatFallback\.dispose\(tile\)/);
  assert.ok(index.indexOf('<script src="live-twitch-chat-fallback.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('renderer entrypoint resolves extracted root-level scripts from its own directory', () => {
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const scriptSources = [...index.matchAll(/<script src="([^"]+)"\s*><\/script>/g)].map((match) => match[1]);

  for (const source of scriptSources) {
    assert.ok(fs.existsSync(path.resolve(rendererRoot, source)), `Missing renderer script: ${source}`);
  }
});

test('active connection module receives only the account-scoped status adapter', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const badges = fs.readFileSync(path.join(rendererRoot, 'provider-connection-badges.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

  assert.match(source, /PokeIdleProviderConnections\.createProviderConnections\(\{[\s\S]*partitionForAccount: accountPartition,[\s\S]*checkConnections: partition => window\.pf\?\.checkConnections\(partition\),[\s\S]*accountExists:/);
  assert.match(source, /const providerConnectionBadges = window\.PokeIdleProviderConnectionBadges\.createProviderConnectionBadges\(/);
  assert.match(source, /getProviderState: PokeIdleProviderConnections\.getProviderState/);
  assert.match(source, /renderBadges: \(account, header\) => updateAccountHeaderBadges\(account, header\)/);
  assert.match(source, /const refreshProviderStatus = account => providerConnectionBadges\.refresh\(account\)/);
  assert.match(badges, /\{ id: 'twitch', name: 'Twitch' \}/);
  assert.match(badges, /\{ id: 'kick', name: 'Kick' \}/);
  assert.match(badges, /Não foi possível verificar a \$\{provider\.name\}/);
  assert.match(badges, /openLogin\(provider\.id, partitionForAccount\(account\), account\.name\)/);
  assert.ok(index.indexOf('<script src="provider-connections.js"></script>') < index.indexOf('<script src="provider-connection-badges.js"></script>'));
  assert.ok(index.indexOf('<script src="provider-connection-badges.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('provider-connections.js'));
});

test('active market alert policy loads before the renderer coordinator', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'market-alert-policy.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const feature = fs.readFileSync(path.join(rendererRoot, 'market-alerts.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'market-alert-policy.js' });

  assert.equal(typeof browserContext.window.PF.MarketAlertPolicy.matches, 'function');
  assert.match(feature, /policy\.parseAmount\(/);
  assert.ok(index.indexOf('<script src="market-alert-policy.js"></script>') < index.indexOf('<script src="market-alerts.js"></script>'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});

test('active market alert engine owns item processing while UI keeps effects at the boundary', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'market-alert-engine.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const feature = fs.readFileSync(path.join(rendererRoot, 'market-alerts.js'), 'utf8');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'market-alert-engine.js' });

  assert.equal(typeof browserContext.window.PF.MarketAlertEngine.processItems, 'function');
  assert.match(feature, /engine\.processItems\(state, items/);
  assert.ok(index.indexOf('<script src="market-alert-engine.js"></script>') < index.indexOf('<script src="market-alerts.js"></script>'));
  assert.doesNotMatch(app, /function processItems\(items\)/);
});

test('market alert feature loads after its policies and owns capture/UI composition', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'market-alerts.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const policyIndex = index.indexOf('<script src="market-alert-policy.js"></script>');
  const engineIndex = index.indexOf('<script src="market-alert-engine.js"></script>');
  const featureIndex = index.indexOf('<script src="market-alerts.js"></script>');
  const appIndex = index.indexOf('<script src="app.js"></script>');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'market-alerts.js' });

  assert.equal(typeof browserContext.window.PF.MarketAlerts.createMarketAlerts, 'function');
  assert.ok(policyIndex < engineIndex && engineIndex < featureIndex && featureIndex < appIndex);
  assert.match(app, /const marketAlerts = window\.PF\.MarketAlerts\.createMarketAlerts\(/);
  assert.match(source, /function bind\(\{ onPollChanged = \(\) => \{\}, testNotification = \(\) => \{\}, openSamples = \(\) => \{\} \} = \{\}\)/);
  assert.match(app, /marketAlerts\.bind\(\{/);
  assert.doesNotMatch(app, /\$\('#alerts-on'\)\.addEventListener/);
  assert.doesNotMatch(app, /\$\('#r-add'\)\.addEventListener/);
  assert.doesNotMatch(app, /function renderAlerts\(|function addRule\(|function onMarket\(/);
  assert.doesNotMatch(app, /\bM\.(rules|hits|enabled|poll|seen|history|samples)\b/);
});

test('active game workspace delegates account pane lifecycle while app composes webviews', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'game-workspace-policy.js'), 'utf8');
  const lifecycle = fs.readFileSync(path.join(rendererRoot, 'game-workspace-lifecycle.js'), 'utf8');
  const factory = fs.readFileSync(path.join(rendererRoot, 'game-pane-factory.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const paneFactoryStart = app.indexOf('const gamePaneFactory =');
  const workspaceStart = app.indexOf('const gameWorkspaceLifecycle =', paneFactoryStart);
  const paneFactoryComposition = app.slice(paneFactoryStart, workspaceStart);
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'game-workspace-policy.js' });
  vm.runInNewContext(lifecycle, browserContext, { filename: 'game-workspace-lifecycle.js' });

  assert.equal(typeof browserContext.window.PokeIdleGameWorkspacePolicy.planGameWorkspace, 'function');
  assert.equal(typeof browserContext.window.PokeIdleGameWorkspaceLifecycle.createGameWorkspaceLifecycle, 'function');
  assert.match(paneFactoryComposition, /applyFpsLimits:\s*\(\)\s*=>\s*applyFpsLimits\(\)/);
  assert.match(app, /const gameWorkspaceLifecycle = window\.PokeIdleGameWorkspaceLifecycle\.createGameWorkspaceLifecycle\(/);
  assert.match(app, /function setupGame\(\) \{\s*gameWorkspaceLifecycle\.setup\(\);\s*\}/);
  assert.match(factory, /partition: accountPartition\(account\)/);
  assert.match(lifecycle, /action\.resource\.pane\.remove\(\)/);
  assert.match(lifecycle, /games\.set\(account\.id, createResource\(account, market\)\)/);
  assert.ok(index.indexOf('<script src="game-workspace-policy.js"></script>') < index.indexOf('<script src="game-workspace-lifecycle.js"></script>'));
  assert.ok(index.indexOf('<script src="game-workspace-lifecycle.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active game account zoom delegates per-account state and UI updates to its module', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'account-zoom.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'account-zoom.js' });

  assert.equal(typeof browserContext.window.PokeIdleAccountZoom.createAccountZoomController, 'function');
  assert.match(app, /const gameZoom = window\.PokeIdleAccountZoom\.createAccountZoomController\(/);
  assert.match(app, /const adjustAccountZoom = \(accountId, delta\) => gameZoom\.adjust\(accountId, delta\)/);
  assert.doesNotMatch(app, /function setAccountZoom\(/);
  assert.ok(index.indexOf('<script src="account-zoom.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active game layout module owns mosaic and account focus behavior', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'game-layout.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'game-layout.js' });

  assert.equal(typeof browserContext.window.PokeIdleGameLayout.createGameLayout, 'function');
  assert.match(app, /const gameLayout = window\.PokeIdleGameLayout\.createGameLayout\(/);
  assert.match(app, /const toggleGameMosaic = \(force\) => gameLayout\.toggleMosaic\(force\)/);
  assert.doesNotMatch(app, /function toggleGameMosaic\(/);
  assert.ok(index.indexOf('<script src="game-layout.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active game account tabs module owns account selection and rename behavior', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'game-account-tabs.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'game-account-tabs.js' });

  assert.equal(typeof browserContext.window.PokeIdleGameAccountTabs.createGameAccountTabs, 'function');
  assert.match(app, /const gameAccountTabs = window\.PokeIdleGameAccountTabs\.createGameAccountTabs\(/);
  assert.match(app, /const renderAccountTabs = \(\) => gameAccountTabs\.render\(\)/);
  assert.doesNotMatch(app, /function renderAccountTabs\(/);
  assert.ok(index.indexOf('<script src="game-account-tabs.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active game pane view owns header markup and delegates account actions', () => {
  const moduleSource = fs.readFileSync(path.join(rendererRoot, 'game-pane-view.js'), 'utf8');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const browserContext = { window: {} };

  vm.runInNewContext(moduleSource, browserContext, { filename: 'game-pane-view.js' });

  assert.equal(typeof browserContext.window.PokeIdleGamePaneView.createGamePaneHeader, 'function');
  assert.match(app, /function createGamePaneHeader\(a, wv, isMarket\) \{\s*return window\.PokeIdleGamePaneView\.createGamePaneHeader\(/);
  assert.match(moduleSource, /selectAccount\(account\.id\)/);
  assert.match(moduleSource, /openCockpit\(account\.id, account\.name\)/);
  assert.match(moduleSource, /reloadWebview\(webview\)/);
  assert.ok(index.indexOf('<script src="game-pane-view.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).build.files.includes('renderer/**'));
});

test('active game pane factory preserves the account-bound webview composition', () => {
  const moduleSource = fs.readFileSync(path.join(rendererRoot, 'game-pane-factory.js'), 'utf8');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const browserContext = { window: {} };

  vm.runInNewContext(moduleSource, browserContext, { filename: 'game-pane-factory.js' });

  assert.equal(typeof browserContext.window.PokeIdleGamePaneFactory.createGamePaneFactory, 'function');
  assert.match(app, /const gamePaneFactory = window\.PokeIdleGamePaneFactory\.createGamePaneFactory\(/);
  assert.match(app, /createResource: \(account, market\) => gamePaneFactory\.create\(account, market\)/);
  assert.match(app, /const gamePaneFactory = window\.PokeIdleGamePaneFactory\.createGamePaneFactory\(\{[\s\S]*?getMarketPoll: \(\) => Number\(marketAlerts\.poll\) \|\| 60,[\s\S]*?bindGameWebviewEvents:/);
  assert.ok(index.indexOf('<script src="game-pane-factory.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(index.indexOf('<script src="game-webview-events.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active game account lifecycle owns account creation and removal effects', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'game-account-lifecycle.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'game-account-lifecycle.js' });

  assert.equal(typeof browserContext.window.PokeIdleGameAccountLifecycle.createGameAccountLifecycle, 'function');
  assert.match(app, /const gameAccountLifecycle = window\.PokeIdleGameAccountLifecycle\.createGameAccountLifecycle\(/);
  assert.match(app, /gameAccountLifecycle\.bind\(\)/);
  assert.doesNotMatch(app, /\$\('#add-account'\)\.addEventListener/);
  assert.doesNotMatch(app, /\$\('#account-remove'\)\.addEventListener/);
  assert.doesNotMatch(app, /function (addAccount|removeAccount)\(/);
  assert.ok(index.indexOf('<script src="game-account-lifecycle.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active game FPS limits are owned by their game module and loaded before app composition', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'game-fps-limits.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'game-fps-limits.js' });

  assert.equal(typeof browserContext.window.PokeIdleGameFpsLimits.createGameFpsLimits, 'function');
  assert.match(app, /const gameFpsLimits = window\.PokeIdleGameFpsLimits\.createGameFpsLimits\(/);
  assert.match(app, /const applyFpsLimits = \(\) => gameFpsLimits\.apply\(\)/);
  assert.doesNotMatch(app, /function applyFpsLimits\(/);
  assert.ok(index.indexOf('<script src="game-fps-limits.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active app navigation owns tab selection and loads before app composition', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app-navigation.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'app-navigation.js' });

  assert.equal(typeof browserContext.window.PokeIdleAppNavigation.createAppNavigation, 'function');
  assert.match(app, /const appNavigation = window\.PokeIdleAppNavigation\.createAppNavigation\(/);
  assert.match(app, /function setTab\(tab\) \{\s*appNavigation\.setTab\(tab\);\s*\}/);
  assert.match(app, /appNavigation\.bind\(\)/);
  assert.match(app, /onOpenTab:\s*callback\s*=>\s*window\.pf\.onOpenTab\(callback\)/);
  assert.doesNotMatch(app, /\$\$\('\.sidebar-nav \.nav-item\[data-tab\]'\)/);
  assert.ok(index.indexOf('<script src="app-navigation.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active game toolbar controls are delegated and loaded before app composition', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');

  assert.match(source, /PokeIdleGameToolbarControls\.createGameToolbarControls\(/);
  assert.match(source, /gameToolbarControls\.bind\(\)/);
  assert.doesNotMatch(source, /\$\('#game-reload'\)\.addEventListener/);
  assert.doesNotMatch(source, /\$\('#game-login'\)\.addEventListener/);
  assert.ok(index.indexOf('<script src="game-toolbar-controls.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active game webview IPC routing is delegated to its account-scoped module', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'game-webview-events.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'game-webview-events.js' });

  assert.equal(typeof browserContext.window.PokeIdleGameWebviewEvents.bindGameWebviewEvents, 'function');
  assert.equal(typeof browserContext.window.PokeIdleGameWebviewEvents.bindRotomForwardEvent, 'function');
  assert.match(app, /PokeIdleGameWebviewEvents\.bindGameWebviewEvents\(/);
  assert.match(app, /PokeIdleGameWebviewEvents\.bindRotomForwardEvent\(/);
  assert.doesNotMatch(app, /wv\.addEventListener\('ipc-message'/);
  assert.doesNotMatch(app, /window\.pf\.onRotomForwardToGame\(\(/);
  assert.ok(index.indexOf('<script src="game-webview-events.js"></script>') < index.indexOf('<script src="app.js"></script>'));
});

test('active live webview factory owns queueing, recovery and disposal hooks', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'live-webview-factory.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const app = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const browserContext = { window: {} };

  vm.runInNewContext(source, browserContext, { filename: 'live-webview-factory.js' });

  assert.equal(typeof browserContext.window.PokeIdleLiveWebviewFactory.createLiveWebviewFactory, 'function');
  assert.match(app, /const liveWebviewFactory = window\.PokeIdleLiveWebviewFactory\.createLiveWebviewFactory\(/);
  assert.match(app, /const \{ disposeWebview, makeWebview, reloadWebview \} = liveWebviewFactory/);
  assert.doesNotMatch(app, /function (makeWebview|skeleton|reloadWebview|disposeWebview)\(/);
  assert.ok(index.indexOf('<script src="live-webview-factory.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).build.files.includes('renderer/**'));
});

test('active performance settings are delegated to the loaded renderer module', () => {
  const source = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');
  const moduleSource = fs.readFileSync(path.join(rendererRoot, 'settings-preferences.js'), 'utf8');
  const index = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const browserContext = { window: {} };

  vm.runInNewContext(moduleSource, browserContext, { filename: 'settings-preferences.js' });

  assert.equal(typeof browserContext.window.PokeIdleSettingsPreferences.createSettingsPreferences, 'function');
  assert.match(source, /const settingsPreferences = window\.PokeIdleSettingsPreferences\.createSettingsPreferences\(/);
  assert.match(source, /function setupSettings\(\) \{\s*settingsPreferences\.setup\(\)/);
  assert.match(source, /settingsPreferences\.render\(\)/);
  assert.doesNotMatch(source, /function renderSettings\(/);
  assert.ok(index.indexOf('<script src="settings-preferences.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).build.files.includes('renderer/**'));
});
