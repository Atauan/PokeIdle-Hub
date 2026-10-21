'use strict';
// PokeIdle Hub — processo principal (Mac e Windows)
const { app, BrowserWindow, ipcMain, Notification, powerSaveBlocker, shell, session, Tray, Menu, nativeImage, screen, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createLiveStatusService } = require('./live-status');
const { registerLiveStatusHandler } = require('./live-status-ipc');
const { registerMainWindowCommandHandlers } = require('./main-window-command-ipc');
const { registerAppShellHandlers } = require('./app-shell-ipc');
const { registerAppLifecycle } = require('./app-lifecycle');
const { createMainWindowService } = require('./main-window-service');
const { createTrayService } = require('./tray-service');
const { channelURL } = require('./live-channel-url');
const { createLoginWindowService } = require('./login-window-service');
const { createAboutWindowService } = require('./about-window-service');
const { migrateLegacySessions } = require('./legacy-session-migration');
const { createProviderConnectionService } = require('./provider-connection-service');
const { createProviderSessionCleanup } = require('./provider-session-cleanup');
const { registerProviderConnectionHandlers } = require('./provider-connection-ipc');
const { createRotomCockpitService } = require('./rotom-cockpit-service');
const { registerNotificationHandlers } = require('./notification-service');
const { createReleaseChecker } = require('./release-updates');
const { createUpdateNotificationService } = require('./update-notification-service');
const { createUpdateDownloadService, isRunningAsPortable } = require('./update-download-service');
const { registerSessionMaintenanceHandlers } = require('./session-maintenance-service');
const { registerHubWorkingSetCleanupHandler } = require('./hub-working-set-cleanup-service');
const { createWindowsWorkingSetTrimmer } = require('./windows-working-set-trimmer');
const { createSessionSummaryService } = require('./session-summary-service');
const { createElectronSessionService } = require('./electron-session-service');
const { registerElectronWebContentsHandlers } = require('./electron-webcontents-service');
const { registerMarketSampleHandler } = require('./market-sample-ipc');
const { registerRotomCockpitHandlers } = require('./rotom-cockpit-ipc');
const { createLiveContentRegistry } = require('./live-content-purpose');
const { isAdditionalPartition } = require('./account-partition');
const { resolveVersion } = require('./app-version');
const { initializeDevProfile } = require('./dev-profile');
const { initializeQaProfile } = require('./qa-profile');
const { createBrowserIdentity } = require('./browser-identity');
const QA_BUILD = app.isPackaged && require('./package.json').pokeidleHubQaBuild === true;
const IS_DEVELOPMENT = !app.isPackaged || QA_BUILD;
const APP_USER_MODEL_ID = QA_BUILD
  ? 'com.pokeidlehub.app.qa'
  : app.isPackaged ? 'com.pokeidlehub.app' : 'com.pokeidlehub.app.dev';
const APP_VERSION = resolveVersion({ fallbackVersion: app.getVersion(), isPackaged: app.isPackaged });
const donations = require('./assets/donations/developers.json');
const DEV_RESET_REQUESTED = process.argv.includes('--dev-reset') || app.commandLine.hasSwitch('dev-reset');

// Todas as lives, chats, jogo e janelas de login usam a mesma sessão: logou uma vez, vale para tudo
const PARTITION = 'persist:pokeidlehub';

// Mantém o User-Agent de Chrome alinhado ao Chromium empacotado e ao SO real;
// os cabeçalhos Client Hints permanecem sob controle do Electron, como no PokeFarm.
const BROWSER_IDENTITY = createBrowserIdentity(process.platform, process.versions.chrome);
const CHROME_UA = BROWSER_IDENTITY.userAgent;

// Rodar 24h: nada é pausado/desacelerado com janela atrás, minimizada ou tela bloqueada
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,WebBluetooth');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.userAgentFallback = CHROME_UA;
let startupReady = true;
let lockAcquired = false;
if (QA_BUILD) {
  try {
    const profile = initializeQaProfile(app, { reset: DEV_RESET_REQUESTED });
    lockAcquired = profile.lockAcquired;
    if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);
  } catch (error) {
    console.error(`Inicialização QA recusada: ${error.message}`);
    startupReady = false;
    app.exit(1);
  }
} else if (app.isPackaged) {
  try {
    initializeDevProfile(app, { reset: DEV_RESET_REQUESTED });
  } catch (error) {
    console.error(`Inicialização recusada: ${error.message}`);
    startupReady = false;
    app.exit(1);
  }
  if (startupReady) {
    app.setName('PokeIdle Hub');
    if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);
    lockAcquired = app.requestSingleInstanceLock();
  }
} else {
  if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);
  try {
    const profile = initializeDevProfile(app, { reset: DEV_RESET_REQUESTED });
    lockAcquired = profile.lockAcquired;
  } catch (error) {
    console.error(`Falha ao preparar o perfil de dev: ${error.message}`);
    startupReady = false;
    app.exit(1);
  }
}

if (!lockAcquired && startupReady) {
  if (DEV_RESET_REQUESTED) {
    console.error('O reset de dev foi recusado porque já existe uma instância de dev ativa.');
  }
  app.quit();
}

let win = null;
let quitting = false;
const aboutWindowService = createAboutWindowService({
  BrowserWindow,
  ipcMain,
  shell,
  clipboard,
  appDirectory: __dirname,
  appVersion: APP_VERSION,
  getAppIcon,
  donations,
  isQuitting: () => quitting,
});

const mainWindowService = createMainWindowService({
  BrowserWindow,
  appDirectory: __dirname,
  isDevelopment: IS_DEVELOPMENT,
  platform: process.platform,
  appUserModelId: APP_USER_MODEL_ID,
  getAppIcon,
  getTaskbarIconPath: () => (app.isPackaged ? process.execPath : getAppIcon()),
  getWindow: () => win,
  setWindow: value => { win = value; },
  isQuitting: () => quitting,
  getTray: () => trayService.getTray(),
  setQuitting: value => { quitting = value; },
});

function showWindow() {
  if (quitting) return;
  trayService.clearClickTimer();
  sessionSummaryService.hide();
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

const trayService = createTrayService({
  Tray,
  Menu,
  nativeImage,
  app,
  getAppIcon,
  platform: process.platform,
  isDevelopment: IS_DEVELOPMENT,
  showMainWindow: showWindow,
  showSessionSummary: () => sessionSummaryService.show(),
  hideSessionSummary: () => sessionSummaryService.hide(),
  isMainWindowHiddenOrMinimized: () => win && (!win.isVisible() || win.isMinimized()),
  onAbout: aboutWindowService.show,
});

function getAppIcon() {
  if (process.platform === 'win32') {
    const icoPath = path.join(__dirname, 'assets', 'icon.ico');
    if (fs.existsSync(icoPath)) return icoPath;
  }
  return path.join(__dirname, 'assets', 'icon.png');
}

function createTray() {
  trayService.create();
}

const sessionSummaryService = createSessionSummaryService({
  ipcMain,
  BrowserWindow,
  screen,
  getTray: () => trayService.getTray(),
  getMainWindow: () => win,
  isQuitting: () => quitting,
  showMainWindow: showWindow,
  appDirectory: __dirname,
});

const updateNotificationService = createUpdateNotificationService({
  createReleaseChecker,
  currentVersion: APP_VERSION,
  getSettingsFile: () => path.join(app.getPath('userData'), 'update-notifications.json'),
  readFileSync: (...args) => fs.readFileSync(...args),
  writeFileSync: (...args) => fs.writeFileSync(...args),
  Notification,
  shell,
  getMainWindow: () => win,
});

const isGame = (contents) => {
  try { return /(^|\.)pokeidle\.io$/.test(new URL(contents.getURL()).hostname); } catch (_) { return false; }
};

function addLive(link) {
  if (win && !win.isDestroyed()) win.webContents.send('add-live', link);
}

// Sessão de cada conta extra do Pokeidle: persist:pokeidlehub-acc-<id>
const providerConnectionService = createProviderConnectionService({ session });
const providerSessionCleanup = createProviderSessionCleanup({ session });
const liveContentRegistry = createLiveContentRegistry();
const electronSessionService = createElectronSessionService({
  session,
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  appDirectory: __dirname,
  existsSync: filePath => fs.existsSync(filePath),
  joinPath: (...parts) => path.join(...parts),
  userAgent: CHROME_UA,
  getContentPurpose: webContentsId => liveContentRegistry.get(webContentsId),
});
const { setupSession, configuredPartitions: configuredSessions } = electronSessionService;

const fromApp = (e) => !!(e.senderFrame && String(e.senderFrame.url).startsWith('file://'));
const liveStatus = createLiveStatusService((url, options) => fetch(url, options));
const loginWindowService = createLoginWindowService({
  BrowserWindow,
  userAgent: CHROME_UA,
  onClosed: (closedWindow, { platform, partition, flowId }) => {
    BrowserWindow.getAllWindows().forEach((browserWindow) => {
      if (browserWindow !== closedWindow && !browserWindow.isDestroyed()) {
        browserWindow.webContents.send('login-window-closed', { platform, partition, flowId });
      }
    });
  },
});

function createWindow() {
  mainWindowService.create();
}

registerElectronWebContentsHandlers({
  app,
  preloadPath: path.join(__dirname, 'webview-preload.js'),
  primaryPartition: PARTITION,
  setupSession,
  isGame,
  channelURL,
  addLive,
  liveContentRegistry,
});

// MARK: IPC da interface

const fromMainWindow = e => !!win && e.sender === win.webContents && e.senderFrame === win.webContents.mainFrame;
registerAppShellHandlers({
  ipcMain,
  isAuthorized: fromMainWindow,
  isDevelopment: IS_DEVELOPMENT,
  showAbout: aboutWindowService.show,
  updateNotificationService,
});
createUpdateDownloadService({
  ipcMain,
  isAuthorized: fromMainWindow,
  isDevelopment: IS_DEVELOPMENT,
  platform: process.platform,
  getRelease: () => updateNotificationService.getState()?.release,
  getPortableStatus: () => isRunningAsPortable({
    env: process.env,
    getExecutablePath: () => app.getPath('exe'),
  }),
  getDownloadsPath: () => app.getPath('downloads'),
  joinPath: (...parts) => path.join(...parts),
  fetch: (url, options) => fetch(url, options),
  createWriteStream: filePath => fs.createWriteStream(filePath),
  existsSync: filePath => fs.existsSync(filePath),
  spawn: (...args) => spawn(...args),
  setTimeoutFn: (callback, delay) => setTimeout(callback, delay),
  app,
  shell,
  getMainWindow: () => win,
});

registerMainWindowCommandHandlers({
  ipcMain,
  isMainWindowAuthorized: fromMainWindow,
  isTrustedAppSender: fromApp,
  platform: process.platform,
  app,
  shell,
  spawn: (...args) => spawn(...args),
});

registerLiveStatusHandler({
  ipcMain,
  isAuthorized: fromMainWindow,
  checkStatus: (platform, channels) => liveStatus.check(platform, channels),
});

registerNotificationHandlers({
  ipcMain,
  Notification,
  app,
  platform: process.platform,
  isTrustedSender: fromApp,
  isQuitting: () => quitting,
  showWindow,
  getMainWindow: () => win,
});

registerProviderConnectionHandlers({
  ipcMain,
  primaryPartition: PARTITION,
  isAdditionalPartition,
  isTrustedSender: fromApp,
  setupSession,
  loginWindowService,
  providerConnectionService,
});

// Amostras brutas do mercado (ajudam a ajustar a leitura depois)
registerMarketSampleHandler({
  ipcMain,
  isTrustedSender: fromApp,
  getUserDataPath: () => app.getPath('userData'),
  joinPath: (...parts) => path.join(...parts),
  fs,
});

registerSessionMaintenanceHandlers({
  ipcMain,
  isTrustedSender: fromApp,
  session,
  fs,
  primaryPartition: PARTITION,
  configuredPartitions: configuredSessions,
  getSessionDataPath: () => app.getPath('sessionData'),
  getUserDataPath: () => app.getPath('userData'),
  joinPath: (...parts) => path.join(...parts),
  openPath: dir => shell.openPath(dir),
  garbageCollect: typeof global.gc === 'function' ? () => global.gc() : null,
  getAppMetrics: () => app.getAppMetrics(),
  relaunch: () => {
    app.relaunch();
    app.quit();
  },
});

const trimHubWorkingSet = createWindowsWorkingSetTrimmer({
  platform: process.platform,
  helperPath: app.isPackaged
    ? path.join(process.resourcesPath, 'win-memory-trimmer.exe')
    : path.join(__dirname, 'build', 'win-memory-trimmer.exe'),
  spawn: (...args) => spawn(...args),
});
registerHubWorkingSetCleanupHandler({
  ipcMain,
  platform: process.platform,
  isTrustedSender: fromApp,
  getAppMetrics: () => app.getAppMetrics(),
  trimProcesses: processes => trimHubWorkingSet(processes),
});

// MARK: Gerenciamento do Cockpit Sniper (Janela Standalone por conta)
const rotomCockpitService = createRotomCockpitService({
  BrowserWindow,
  assetDirectory: path.join(__dirname, 'assets', 'addons', 'rotom-sniper'),
  getAppIcon,
  getMainWindow: () => win,
});

registerRotomCockpitHandlers({
  ipcMain,
  isMainWindowAuthorized: fromMainWindow,
  rotomCockpitService,
});

registerAppLifecycle({
  app,
  qaBuild: QA_BUILD,
  startupReady,
  lockAcquired,
  primaryPartition: PARTITION,
  portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR,
  migrateLegacySessions,
  prepareProviderSessions: () => providerSessionCleanup.clearStaleProviderData(app.getPath('userData')),
  setupSession,
  powerSaveBlocker,
  createTray,
  createWindow,
  showWindow,
  isSessionSummaryVisible: () => sessionSummaryService.isVisible(),
  updateNotificationService,
  rotomCockpitService,
  setQuitting: value => { quitting = value; },
  clearTrayClickTimer: () => trayService.clearClickTimer(),
  getTray: () => trayService.getTray(),
  setTray: value => trayService.setTray(value),
});
