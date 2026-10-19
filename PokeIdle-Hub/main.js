'use strict';
// PokeIdle Hub — processo principal (Mac e Windows)
const { app, BrowserWindow, ipcMain, Notification, powerSaveBlocker, shell, session, Tray, Menu, nativeImage, screen, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createLiveStatusService } = require('./live-status');
const { createReleaseChecker } = require('./release-updates');
const { resolveVersion } = require('./app-version');
const APP_VERSION = resolveVersion({ fallbackVersion: app.getVersion(), isPackaged: app.isPackaged });
const donations = require('./assets/donations/developers.json');

// Todas as lives, chats, jogo e janelas de login usam a mesma sessão: logou uma vez, vale para tudo
const PARTITION = 'persist:pokeidlehub';

// User-agent e Client Hints de Chrome estável de mercado (compatível com Google OAuth, Cloudflare Turnstile, Twitch e Kick)
const CHROME_VER = '132.0.6834.196';
const CHROME_MAJOR = '132';
const OS_UA = process.platform === 'darwin'
  ? 'Macintosh; Intel Mac OS X 10_15_7'
  : (process.platform === 'linux' ? 'X11; Linux x86_64' : 'Windows NT 10.0; Win64; x64');
const CHROME_UA = `Mozilla/5.0 (${OS_UA}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VER} Safari/537.36`;

// Rodar 24h: nada é pausado/desacelerado com janela atrás, minimizada ou tela bloqueada
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,WebBluetooth');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.userAgentFallback = CHROME_UA;
app.setName('PokeIdle Hub');
if (process.platform === 'win32') app.setAppUserModelId('com.pokeidlehub.app');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let aboutWindow = null;
let summaryWindow = null;
let trayClickTimer = null;
let ignoreTrayClickUntil = 0;
let tray = null;
let quitting = false;
let updateChecker = null;
let updateTimer = null;

function showWindow() {
  if (quitting) return;
  clearTimeout(trayClickTimer);
  summaryWindow?.hide();
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function getAppIcon() {
  if (process.platform === 'win32') {
    const icoPath = path.join(__dirname, 'assets', 'icon.ico');
    if (fs.existsSync(icoPath)) return icoPath;
  }
  return path.join(__dirname, 'assets', 'icon.png');
}

function createTray() {
  const size = process.platform === 'darwin' ? 18 : 32;
  const icon = nativeImage.createFromPath(getAppIcon())
    .resize({ width: size, height: size });
  tray = new Tray(icon);
  tray.setToolTip('PokeIdle Hub');
  const menu = Menu.buildFromTemplate([
    { label: 'Sobre', click: showAbout },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]);
  tray.on('click', () => {
    if (Date.now() < ignoreTrayClickUntil) return;
    clearTimeout(trayClickTimer);
    trayClickTimer = setTimeout(() => {
      if (win && (!win.isVisible() || win.isMinimized())) showSessionSummary();
      else showWindow();
    }, 300);
  });
  tray.on('double-click', () => {
    ignoreTrayClickUntil = Date.now() + 500;
    showWindow();
  });
  // Menu explícito: setContextMenu também capturaria o clique esquerdo no macOS.
  tray.on('right-click', () => {
    clearTimeout(trayClickTimer);
    summaryWindow?.hide();
    tray.popUpContextMenu(menu);
  });
}

function showSessionSummary() {
  if (quitting) return;
  const bounds = tray.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(420, area.width - 16);
  const height = Math.min(680, area.height - 16);
  const x = Math.max(area.x + 8, Math.min(bounds.x + bounds.width - width, area.x + area.width - width - 8));
  const below = bounds.y + bounds.height + 8;
  const y = Math.max(area.y + 8, Math.min(below + height <= area.y + area.height ? below : bounds.y - height - 8, area.y + area.height - height - 8));
  if (!summaryWindow || summaryWindow.isDestroyed()) {
    const panel = new BrowserWindow({
      width, height, x, y, frame: false, show: false, resizable: false,
      skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#141416',
      webPreferences: { preload: path.join(__dirname, 'session-preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    summaryWindow = panel;
    panel.setMenu(null);
    panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    panel.webContents.on('will-navigate', event => event.preventDefault());
    panel.on('blur', () => panel.hide());
    panel.on('closed', () => { summaryWindow = null; });
    panel.once('ready-to-show', () => {
      if (!quitting && win && (!win.isVisible() || win.isMinimized())) { panel.show(); panel.focus(); }
    });
    panel.loadFile(path.join(__dirname, 'renderer', 'session.html'));
  } else {
    summaryWindow.setBounds({ x, y, width, height });
    summaryWindow.show(); summaryWindow.focus();
  }
}

function showAbout() {
  if (quitting) return;
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return;
  }
  const window = new BrowserWindow({
    title: 'Sobre o PokeIdle Hub', width: 440, height: 640, useContentSize: true,
    resizable: false, minimizable: false, maximizable: false, show: false,
    backgroundColor: '#141416', autoHideMenuBar: true,
    icon: getAppIcon(),
    webPreferences: { preload: path.join(__dirname, 'about-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  aboutWindow = window;
  window.setMenu(null);
  const aboutLinks = new Set([
    donations.repository,
    'https://github.com/RaullPereira/PokeFarm',
    ...donations.developers.flatMap(profile => [profile.github, profile.linkedin]),
  ]);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (aboutLinks.has(url)) void shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.once('ready-to-show', () => { window.show(); window.focus(); });
  window.on('closed', () => { aboutWindow = null; });
  window.loadFile(path.join(__dirname, 'renderer', 'about.html'), {
    query: { version: APP_VERSION },
  });
}

ipcMain.handle('about-data', event => event.sender === aboutWindow?.webContents ? donations : null);
ipcMain.handle('about-copy-pix', (event, id) => {
  if (event.sender !== aboutWindow?.webContents) return false;
  const profile = donations.developers.find(profile => profile.id === id);
  if (!profile) return false;
  clipboard.writeText(profile.pix);
  return true;
});

function startUpdateChecks() {
  const settingsFile = path.join(app.getPath('userData'), 'update-notifications.json');
  let notifiedVersions = [];
  try { notifiedVersions = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch (_) { /* primeira abertura */ }
  updateChecker = createReleaseChecker({
    currentVersion: APP_VERSION,
    notifiedVersions,
    persistNotified: versions => {
      try { fs.writeFileSync(settingsFile, JSON.stringify(versions)); } catch (_) {}
    },
    onChange: state => {
      if (win && !win.isDestroyed()) win.webContents.send('update-state', state);
    },
    onAvailable: update => {
      if (!Notification.isSupported()) return;
      const notification = new Notification({
        title: 'Atualização do PokeIdle Hub',
        body: `A versão ${update.version} está disponível. Clique para ver a release.`,
      });
      notification.on('click', () => { void shell.openExternal(update.url).catch(() => {}); });
      notification.show();
    },
  });
  void updateChecker.check();
  updateTimer = setInterval(() => { void updateChecker.check(); }, 60 * 60 * 1000);
}

const LOGIN_URLS = {
  twitch: 'https://www.twitch.tv/login',
  kick: 'https://kick.com/login',
};

// Só abre no Edge endereços destes sites, e só com caracteres seguros
const SAFE_URL = /^https:\/\/([a-z0-9-]+\.)*(kick\.com|twitch\.tv|pokeidle\.io)(\/[A-Za-z0-9_\-/]*)?$/;

// Caminhos da Twitch/Kick que não são canais
const RESERVED = new Set([
  'directory', 'videos', 'settings', 'login', 'signup', 'p', 'downloads', 'jobs', 'subscriptions',
  'inventory', 'wallet', 'drops', 'search', 'friends', 'messages', 'payments', 'prime', 'turbo',
  'store', 'popout', 'embed', 'moderator', 'categories', 'browse', 'following', 'dashboard',
  'terms-of-service', 'privacy-policy', 'community-guidelines', 'about', 'help', 'privacy', 'terms',
]);

/** Se a URL for de um canal da Kick/Twitch, devolve o link limpo (ex.: https://twitch.tv/rodil). */
function channelURL(raw) {
  let u;
  try { u = new URL(raw); } catch (_) { return null; }
  const host = u.hostname.toLowerCase();
  const twitch = host === 'twitch.tv' || host.endsWith('.twitch.tv');
  const kick = host === 'kick.com' || host.endsWith('.kick.com');
  if (!(twitch || kick) || /^(player|dashboard|id)\./.test(host)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  const name = parts[0].toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(name) || RESERVED.has(name)) return null;
  return `https://${twitch ? 'twitch.tv' : 'kick.com'}/${name}`;
}

const isGame = (contents) => {
  try { return /(^|\.)pokeidle\.io$/.test(new URL(contents.getURL()).hostname); } catch (_) { return false; }
};

function addLive(link) {
  if (win && !win.isDestroyed()) win.webContents.send('add-live', link);
}

// Sessão de cada conta extra do Pokeidle: persist:pokeidlehub-acc-<id>
const ACCOUNT_PARTITION = /^persist:pokeidlehub-acc-[a-z0-9-]{1,60}$/i;
const configuredSessions = new Set();
const loginWebContentsIds = new Set();

// Domínios conhecidos de telemetria pesada e publicidade de terceiros.
// Bloquear essas requisições reduz drasticamente o consumo de banda, CPU e tempo de carga nas lives.
// Endpoints essenciais de integridade, antifraude e login (como spade.twitch.tv, fls-na.amazon.com
// e telemetry.kick.com) são rigorosamente preservados para não impedir login em nenhuma plataforma.
const BLOCKED_TRACKER_SUFFIXES = [
  'amazon-adsystem.com',
  'scorecardresearch.com',
  'quantserve.com',
  'doubleclick.net',
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'segment.io',
  'sentry.io',
  'browser.sentry-cdn.com',
  'datadoghq.com',
  'hotjar.com',
  'amplitude.com',
  'facebook.com',
  'branch.io',
  'appsflyer.com',
];

const BLOCKED_TRACKER_HOSTS = new Set([
  'countess.twitch.tv',
  'science.twitch.tv',
  'analytics.kick.com',
  'imasdk.googleapis.com',
  'pubads.g.doubleclick.net',
]);

function isTrackerOrAd(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (BLOCKED_TRACKER_HOSTS.has(host)) return true;
    for (const suffix of BLOCKED_TRACKER_SUFFIXES) {
      if (host === suffix || host.endsWith('.' + suffix)) return true;
    }
  } catch (_) {}
  return false;
}

/** User-agent e scripts iguais em todas as sessões (a principal e a de cada conta). */
function setupSession(part) {
  if (configuredSessions.has(part)) return;
  configuredSessions.add(part);
  const ses = session.fromPartition(part);
  ses.setUserAgent(CHROME_UA);

  // Bloqueio nativo cirúrgico de telemetria, rastreadores e scripts de anúncios pesados
  ses.webRequest.onBeforeRequest((details, callback) => {
    let cancel = false;
    try {
      // Nunca cancela requisições vindas de janelas ou popups de login/autenticação
      if (details.webContentsId && loginWebContentsIds.has(details.webContentsId)) {
        callback({ cancel: false });
        return;
      }
      if (isTrackerOrAd(details.url)) {
        cancel = true;
      }
    } catch (_) { /* preserva a requisição em caso de erro */ }
    callback({ cancel });
  });
  // Sanitiza cabeçalhos sec-ch-ua para permitir login social do Google sem bloqueio de "app não seguro"
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders || {};
    headers['User-Agent'] = CHROME_UA;
    if (headers['sec-ch-ua']) {
      headers['sec-ch-ua'] = `"Not A(Brand";v="8", "Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}"`;
    }
    if (headers['sec-ch-ua-full-version-list']) {
      headers['sec-ch-ua-full-version-list'] = `"Not A(Brand";v="8.0.0.0", "Chromium";v="${CHROME_VER}", "Google Chrome";v="${CHROME_VER}"`;
    }
    if (headers['sec-ch-ua-mobile']) {
      headers['sec-ch-ua-mobile'] = '?0';
    }
    if (headers['sec-ch-ua-platform']) {
      headers['sec-ch-ua-platform'] = process.platform === 'darwin'
        ? '"macOS"'
        : (process.platform === 'linux' ? '"Linux"' : '"Windows"');
    }
    callback({ requestHeaders: headers });
  });

  const resolvePreloadPath = (filename) => {
    if (app.isPackaged) {
      const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', filename);
      if (fs.existsSync(unpacked)) return unpacked;
    }
    return path.join(__dirname, filename);
  };
  const regPreload = (id, filename) => {
    try {
      const filePath = resolvePreloadPath(filename);
      if (fs.existsSync(filePath)) {
        try { ses.unregisterPreloadScript(id); } catch (_) {}
        ses.registerPreloadScript({ id, type: 'frame', filePath });
      }
    } catch (_) {}
  };
  regPreload('pf-game-channels', 'game-channels.js');
  regPreload('pf-game-session', 'game-session.js');
  regPreload('pf-pokeidle-hunt', 'pokeidle-hunt.js');
  regPreload('pf-twitch-economy', 'twitch-economy.js');
  regPreload('pf-kick-economy', 'kick-economy.js');
  regPreload('pf-rotom-addon', 'rotom-addon.js');
}

const fromApp = (e) => !!(e.senderFrame && String(e.senderFrame.url).startsWith('file://'));
const liveStatus = createLiveStatusService((url, options) => fetch(url, options));

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1000,
    minHeight: 560,
    title: 'PokeIdle Hub',
    backgroundColor: '#141416',
    autoHideMenuBar: true,
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // A janela principal nunca navega para fora nem abre pop-ups
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('render-process-gone', () => setTimeout(() => win && !win.isDestroyed() && win.reload(), 2000));
  win.on('close', event => {
    if (quitting || !tray || tray.isDestroyed()) return;
    event.preventDefault();
    // Oculta sem destruir o renderer/webviews ou alterar o estado de áudio.
    win.hide();
  });
  // O Windows não emite before-quit ao encerrar a sessão do usuário.
  win.on('session-end', () => { quitting = true; });
  win.on('closed', () => { win = null; });
}

app.on('web-contents-created', (_e, contents) => {
  // Toda <webview> recebe o nosso preload e configurações seguras, na sessão compartilhada
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preloadURL;
    webPreferences.preload = path.join(__dirname, 'webview-preload.js');
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.backgroundThrottling = false;
    // Contas extras do Pokeidle usam sessão própria (login separado); o resto, a compartilhada
    const part = ACCOUNT_PARTITION.test(params.partition || '') ? params.partition : PARTITION;
    setupSession(part);
    webPreferences.partition = part;
    if (!/^https:\/\//.test(params.src || '')) event.preventDefault();
  });

  // Pop-ups das páginas (login, OAuth) abrem numa janela própria, na mesma sessão
  if (contents.getType() === 'webview') {
    // No jogo, link/botão de live da Kick/Twitch vira bloco na aba Lives em vez de abrir
    contents.on('will-navigate', (e, url) => {
      if (!isGame(contents)) return;
      const link = channelURL(url);
      if (link) { e.preventDefault(); addLive(link); }
    });
    contents.on('did-create-window', (child) => {
      child.webContents.setUserAgent(CHROME_UA);
      if (!isGame(contents)) return;
      // Pop-up aberto em branco e depois mandado para a live
      child.webContents.on('will-navigate', (e, url) => {
        const link = channelURL(url);
        if (link) { e.preventDefault(); addLive(link); child.close(); }
      });
    });
    contents.setWindowOpenHandler(({ url }) => {
      if (isGame(contents)) {
        const link = channelURL(url);
        if (link) { addLive(link); return { action: 'deny' }; }
      }
      if (url === 'about:blank' && isGame(contents)) {
        return { action: 'allow', overrideBrowserWindowOptions: { show: false, webPreferences: { session: contents.session, contextIsolation: true, sandbox: true, nodeIntegration: false } } };
      }
      if (!/^https:\/\//.test(url)) return { action: 'deny' };
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 760,
          title: 'Entrar',
          autoHideMenuBar: true,
          // Mesma sessão da página que abriu: o login de cada conta fica na conta certa
          webPreferences: { session: contents.session, contextIsolation: true, sandbox: true, nodeIntegration: false },
        },
      };
    });
  }
});

// MARK: IPC da interface

const fromMainWindow = e => !!win && e.sender === win.webContents && e.senderFrame === win.webContents.mainFrame;
const fromSummaryWindow = e => !!summaryWindow && e.sender === summaryWindow.webContents && e.senderFrame === summaryWindow.webContents.mainFrame;
ipcMain.handle('session-summary', async e => {
  if (!fromSummaryWindow(e) || !win || win.isDestroyed()) return null;
  let timer;
  try {
    return await Promise.race([
      win.webContents.executeJavaScript('window.__pfCollectSessions ? window.__pfCollectSessions() : ({accounts: []})'),
      new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Game summary timeout')), 4000); }),
    ]);
  } finally { clearTimeout(timer); }
});
ipcMain.on('session-open', e => { if (fromSummaryWindow(e)) showWindow(); });
ipcMain.on('session-close', e => { if (fromSummaryWindow(e)) summaryWindow.hide(); });
ipcMain.on('open-about', e => { if (fromMainWindow(e)) showAbout(); });
ipcMain.handle('update-state', e => fromMainWindow(e) ? updateChecker?.getState() : null);
ipcMain.handle('check-updates', e => fromMainWindow(e) ? updateChecker?.check() : null);
function isRunningAsPortable() {
  if (process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE) return true;
  try {
    const exeName = path.basename(app.getPath('exe')).toLowerCase();
    return exeName.includes('portable');
  } catch (_) {
    return false;
  }
}

function getBestUpdateAsset(assets) {
  if (!Array.isArray(assets) || !assets.length) return null;
  const isPortable = isRunningAsPortable();
  const platform = process.platform;

  if (platform === 'win32') {
    if (isPortable) {
      const p = assets.find(a => a.name.toLowerCase().includes('portable') && a.name.toLowerCase().endsWith('.exe'));
      if (p) return { ...p, isPortable: true };
    }
    const s = assets.find(a => a.name.toLowerCase().includes('setup') && a.name.toLowerCase().endsWith('.exe'))
      || assets.find(a => a.name.toLowerCase().endsWith('.exe'));
    if (s) return { ...s, isPortable: false };
  } else if (platform === 'darwin') {
    const d = assets.find(a => a.name.toLowerCase().endsWith('.dmg'))
      || assets.find(a => a.name.toLowerCase().endsWith('.zip'));
    if (d) return { ...d, isPortable: false };
  } else if (platform === 'linux') {
    const l = assets.find(a => a.name.toLowerCase().endsWith('.appimage'))
      || assets.find(a => a.name.toLowerCase().endsWith('.deb'));
    if (l) return { ...l, isPortable: false };
  }
  return assets[0] ? { ...assets[0], isPortable } : null;
}

let currentDownloadAbort = null;

ipcMain.handle('get-update-target', (e) => {
  if (!fromMainWindow(e)) return null;
  const release = updateChecker?.getState().release;
  const asset = getBestUpdateAsset(release?.assets);
  return {
    isPortable: isRunningAsPortable(),
    platform: process.platform,
    assetName: asset?.name || null,
    assetSize: asset?.size || 0,
  };
});

ipcMain.handle('open-update', async e => {
  if (!fromMainWindow(e)) return false;
  const url = updateChecker?.getState().release?.url;
  if (!url) return false;
  try { await shell.openExternal(url); return true; } catch (_) { return false; }
});

ipcMain.handle('download-update', async (e) => {
  if (!fromMainWindow(e)) return { ok: false, error: 'Unauthorized' };
  const release = updateChecker?.getState().release;
  if (!release) return { ok: false, error: 'Nenhuma versão disponível' };

  const asset = getBestUpdateAsset(release.assets);
  if (!asset || !asset.url) return { ok: false, error: 'Arquivo executável não encontrado na release' };

  try {
    if (currentDownloadAbort) {
      currentDownloadAbort.abort();
      currentDownloadAbort = null;
    }
    currentDownloadAbort = new AbortController();

    const downloadsDir = app.getPath('downloads');
    const destPath = path.join(downloadsDir, asset.name);

    const response = await fetch(asset.url, {
      signal: currentDownloadAbort.signal,
      headers: {
        'User-Agent': 'PokeIdleHub-Updater',
        Accept: 'application/octet-stream',
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Falha no download: HTTP ${response.status}`);
    }

    const totalBytes = Number(response.headers.get('content-length')) || asset.size || 0;
    let downloadedBytes = 0;

    const fileStream = fs.createWriteStream(destPath);
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      downloadedBytes += value.length;
      fileStream.write(Buffer.from(value));

      const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
      win?.webContents.send('update-download-progress', {
        percent,
        downloadedBytes,
        totalBytes,
        fileName: asset.name,
      });
    }

    await new Promise((resolve, reject) => {
      fileStream.end((err) => (err ? reject(err) : resolve()));
    });

    currentDownloadAbort = null;

    return {
      ok: true,
      filePath: destPath,
      fileName: asset.name,
      isPortable: asset.isPortable,
      version: release.version,
    };
  } catch (err) {
    currentDownloadAbort = null;
    if (err.name === 'AbortError') {
      return { ok: false, aborted: true };
    }
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('cancel-download-update', (e) => {
  if (!fromMainWindow(e)) return false;
  if (currentDownloadAbort) {
    currentDownloadAbort.abort();
    currentDownloadAbort = null;
    return true;
  }
  return false;
});

ipcMain.handle('install-update', async (e, filePath) => {
  if (!fromMainWindow(e)) return false;
  if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) return false;

  try {
    if (process.platform === 'win32') {
      spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => { app.quit(); }, 800);
      return true;
    } else {
      await shell.openPath(filePath);
      return true;
    }
  } catch (_) {
    return false;
  }
});

ipcMain.on('show-in-folder', (e, filePath) => {
  if (fromMainWindow(e) && filePath && typeof filePath === 'string') {
    shell.showItemInFolder(filePath);
  }
});

ipcMain.on('quit-app', (e) => {
  if (fromMainWindow(e)) {
    app.quit();
  }
});

ipcMain.handle('live-status', (e, platform, channels) => {
  if (!win || e.sender !== win.webContents || e.senderFrame !== win.webContents.mainFrame) {
    return {};
  }
  return liveStatus.check(platform, channels);
});

ipcMain.on('notify', (e, msg) => {
  if (!fromApp(e) || !msg || !Notification.isSupported()) return;
  const n = new Notification({ title: String(msg.title).slice(0, 120), body: String(msg.body).slice(0, 300) });
  n.on('click', () => {
    if (quitting) return;
    showWindow();
    win.webContents.send('open-tab', 'game');
  });
  n.show();
});

ipcMain.on('attention', (e) => {
  if (!fromApp(e) || !win) return;
  if (process.platform === 'darwin' && app.dock) app.dock.bounce('informational');
  else if (!win.isFocused()) win.flashFrame(true);
});

ipcMain.on('open-edge', (e, url) => {
  if (!fromApp(e) || typeof url !== 'string' || !SAFE_URL.test(url)) return;
  if (process.platform === 'darwin') {
    const p = spawn('open', ['-a', 'Microsoft Edge', url], { stdio: 'ignore' });
    p.on('error', () => shell.openExternal(url));
    p.on('exit', (code) => { if (code !== 0) shell.openExternal(url); });
  } else if (process.platform === 'win32') {
    // O Windows registra o protocolo microsoft-edge: para abrir direto no Edge
    shell.openExternal(`microsoft-edge:${url}`).catch(() => shell.openExternal(url));
  } else {
    shell.openExternal(url);
  }
});

// Login numa janela própria (não numa webview): o Google recusa login dentro de webview embutida.
// Aceita os pop-ups de OAuth (Google/Twitch/Kick) como janelas-filhas na mesma sessão.
ipcMain.on('open-login', (e, platform, partition, label) => {
  const url = LOGIN_URLS[platform];
  if (!fromApp(e) || !url) return;
  const part = ACCOUNT_PARTITION.test(partition || '') ? partition : PARTITION;
  setupSession(part);
  const platName = platform === 'twitch' ? 'Twitch' : 'Kick';
  const cleanLabel = typeof label === 'string' && label.trim() ? ` (${label.trim().slice(0, 30)})` : '';
  openLoginWindow(url, `Entrar na ${platName}${cleanLabel}`, part, platform);
});

ipcMain.on('open-game-login', (e, partition) => {
  if (!fromApp(e)) return;
  const part = ACCOUNT_PARTITION.test(partition || '') ? partition : PARTITION;
  setupSession(part);
  openLoginWindow('https://pokeidle.io/app', 'Entrar no Pokeidle', part, 'game');
});

ipcMain.handle('check-connections', async (e, partition) => {
  if (!fromApp(e)) return { twitch: false, kick: false };
  const part = ACCOUNT_PARTITION.test(partition || '') ? partition : PARTITION;
  const ses = session.fromPartition(part);
  let twitch = false;
  let kick = false;
  try {
    const twitchCookies = await ses.cookies.get({ domain: 'twitch.tv' });
    twitch = twitchCookies.some(c => c.name === 'auth-token' && !!c.value);
  } catch (_) {}
  try {
    const kickCookies = await ses.cookies.get({ domain: 'kick.com' });
    kick = kickCookies.some(c => ['session', 'kick_session', 'session_token', 'token'].includes(c.name.toLowerCase()) || (c.name.includes('session') && !!c.value));
  } catch (_) {}
  return { twitch, kick };
});

ipcMain.handle('clear-connection', async (e, platform, partition) => {
  if (!fromApp(e) || !['twitch', 'kick'].includes(platform)) return false;
  const part = !partition || partition === PARTITION || ACCOUNT_PARTITION.test(partition) ? (partition || PARTITION) : null;
  if (!part) return false;
  const domain = platform === 'twitch' ? 'twitch.tv' : 'kick.com';
  try {
    const ses = session.fromPartition(part);
    const cookies = await ses.cookies.get({ domain });
    await Promise.all(cookies.map(cookie => {
      const host = cookie.domain.replace(/^\./, '');
      const url = `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path || '/'}`;
      return ses.cookies.remove(url, cookie.name);
    }));
    return true;
  } catch (_) {
    return false;
  }
});

function openLoginWindow(url, title, part, platform) {
  const w = new BrowserWindow({
    width: 540, height: 760, title, autoHideMenuBar: true, show: false,
    webPreferences: { partition: part, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  loginWebContentsIds.add(w.webContents.id);
  w.once('closed', () => loginWebContentsIds.delete(w.webContents.id));
  // UA de navegador real (sem "Electron"); o Google bloqueia webview/apps embutidos
  w.webContents.setUserAgent(CHROME_UA);
  // Pop-up do OAuth (Google etc.): abre como janela-filha na MESMA sessão, não bloqueia
  const childOpts = {
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 540, height: 720, autoHideMenuBar: true,
      webPreferences: { session: w.webContents.session, contextIsolation: true, sandbox: true, nodeIntegration: false },
    },
  };
  w.webContents.setWindowOpenHandler(({ url: u }) => (/^https:\/\//.test(u) ? childOpts : { action: 'deny' }));
  w.webContents.on('did-create-window', (child) => {
    loginWebContentsIds.add(child.webContents.id);
    child.once('closed', () => loginWebContentsIds.delete(child.webContents.id));
    child.webContents.setUserAgent(CHROME_UA);
    child.webContents.setWindowOpenHandler(({ url: u }) => (/^https:\/\//.test(u) ? childOpts : { action: 'deny' }));
  });
  w.once('ready-to-show', () => {
    w.show();
    w.focus();
  });
  if (platform === 'game' || String(url).includes('pokeidle.io')) {
    w.webContents.on('dom-ready', () => {
      w.webContents.executeJavaScript(`
        (() => {
          if (window.__pfTurnstileWatchdog) return;
          window.__pfTurnstileWatchdog = true;
          let tries = 0;
          const check = () => {
            tries++;
            try {
              const wrap = document.getElementById('turnstile-entrar');
              const portal = document.getElementById('portal');
              const login = document.getElementById('login');
              const isLoginVisible = portal && !portal.classList.contains('hidden') && login && !login.classList.contains('hidden');
              if (isLoginVisible && wrap && wrap.children.length === 0) {
                if (typeof window.onTurnstilePronto === 'function') {
                  window.onTurnstilePronto();
                }
              }
            } catch (_) {}
            if (tries < 25) setTimeout(check, 800);
          };
          check();
        })();
      `).catch(() => {});
    });
  }
  w.on('closed', () => {
    BrowserWindow.getAllWindows().forEach((bw) => {
      if (bw !== w && !bw.isDestroyed()) {
        bw.webContents.send('login-window-closed', { platform, partition: part });
      }
    });
  });
  w.loadURL(url);
}

// Amostras brutas do mercado (ajudam a ajustar a leitura depois)
ipcMain.on('write-sample', (e, msg) => {
  if (!fromApp(e) || !msg) return;
  const file = path.join(app.getPath('userData'), 'market-samples.jsonl');
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > 3_000_000) return;
    const line = JSON.stringify({ date: new Date().toISOString(), url: String(msg.url).slice(0, 500), body: String(msg.text).slice(0, 30000) });
    fs.appendFileSync(file, line + '\n');
  } catch (_) { /* ignora */ }
});

// Conta removida: apaga o login dela (só contas extras; a principal é a mesma das lives)
ipcMain.handle('clear-account', async (e, id) => {
  const part = `persist:pokeidlehub-acc-${String(id)}`;
  if (!fromApp(e) || !ACCOUNT_PARTITION.test(part)) return false;
  try { await session.fromPartition(part).clearStorageData(); return true; } catch (_) { return false; }
});

ipcMain.on('open-data-dir', (e) => {
  if (fromApp(e)) shell.openPath(app.getPath('userData'));
});

// Limpeza cirúrgica de cache de requisições e memória temporária sem deslogar contas
ipcMain.handle('clean-ram', async (e) => {
  if (!fromApp(e)) return { ok: false };
  try {
    const partitions = new Set([PARTITION, ...configuredSessions]);
    const partitionsDir = path.join(app.getPath('userData'), 'Partitions');
    if (fs.existsSync(partitionsDir)) {
      try {
        const entries = fs.readdirSync(partitionsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith('pokeidlehub-acc-')) {
            partitions.add(`persist:${entry.name}`);
          }
        }
      } catch (_) {}
    }

    await Promise.all([...partitions].map(async (part) => {
      try {
        const ses = session.fromPartition(part);
        await ses.clearCache();
      } catch (_) {}
    }));

    try {
      await session.defaultSession.clearCache();
    } catch (_) {}

    if (typeof global.gc === 'function') {
      try { global.gc(); } catch (_) {}
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// MARK: Gerenciamento do Cockpit Sniper (Janela Standalone por conta)
const cockpitWindows = new Map();

function openRotomCockpitWindow(accId, accName) {
  const existing = cockpitWindows.get(accId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return { ok: true, focused: true };
  }

  const cpWin = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: `Sniper — Cockpit [${accName || accId}]`,
    icon: getAppIcon(),
    backgroundColor: '#33202b',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'assets', 'addons', 'rotom-sniper', 'cockpit-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  cockpitWindows.set(accId, cpWin);

  cpWin.once('ready-to-show', () => {
    cpWin.show();
    cpWin.focus();
  });

  cpWin.on('closed', () => {
    cockpitWindows.delete(accId);
  });

  const htmlPath = path.join(__dirname, 'assets', 'addons', 'rotom-sniper', 'cockpit.html');
  const fileUrl = `file://${htmlPath.replace(/\\/g, '/')}?acc=${encodeURIComponent(accId)}&name=${encodeURIComponent(accName || 'Conta')}`;
  cpWin.loadURL(fileUrl);
  return { ok: true, created: true };
}

ipcMain.handle('open-rotom-cockpit', (event, { accId, accName }) => {
  return openRotomCockpitWindow(String(accId), String(accName));
});

ipcMain.on('rotom-to-game', (event, { accId, message }) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('rotom-forward-to-game', { accId, message });
  }
});

ipcMain.on('rotom-from-webview', (event, { accId, data }) => {
  const cpWin = cockpitWindows.get(accId);
  if (cpWin && !cpWin.isDestroyed()) {
    cpWin.webContents.send('rotom-from-game', data);
  }
});

function migrateLegacySessions() {
  try {
    const currentDataDir = app.getPath('userData');
    const parentDir = path.dirname(currentDataDir);
    const partitionsDir = path.join(currentDataDir, 'Partitions');

    // 1. Diretórios legados de onde podemos importar dados existentes
    const candidateDirs = [];
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      candidateDirs.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data'));
    }
    candidateDirs.push(
      path.join(parentDir, 'PokeFarm'),
      path.join(parentDir, 'pokefarm'),
      path.join(parentDir, 'PokeFarm-Hub')
    );

    for (const legacyDir of candidateDirs) {
      if (!fs.existsSync(legacyDir)) continue;

      // Migração de Local Storage (contas cadastradas, regras e preferências)
      const currentLocalStorage = path.join(currentDataDir, 'Local Storage');
      const legacyLocalStorage = path.join(legacyDir, 'Local Storage');
      const currentLevelDb = path.join(currentLocalStorage, 'leveldb');
      const hasCurrentLevelDb = fs.existsSync(currentLevelDb) && fs.readdirSync(currentLevelDb).length > 2;

      // Se o diretório atual ainda não tiver dados salvos e o legado tiver
      if (!hasCurrentLevelDb && fs.existsSync(legacyLocalStorage)) {
        try {
          if (!fs.existsSync(currentLocalStorage)) fs.mkdirSync(currentLocalStorage, { recursive: true });
          fs.cpSync(legacyLocalStorage, currentLocalStorage, { recursive: true });
        } catch (_) {}
      }

      // Migração de Partições (cookies das contas do jogo Pokeidle, Twitch e Kick)
      const legacyPartitions = path.join(legacyDir, 'Partitions');
      if (fs.existsSync(legacyPartitions)) {
        try {
          if (!fs.existsSync(partitionsDir)) fs.mkdirSync(partitionsDir, { recursive: true });
          const legacyEntries = fs.readdirSync(legacyPartitions, { withFileTypes: true });
          for (const entry of legacyEntries) {
            if (!entry.isDirectory()) continue;
            let destName = null;
            if (entry.name === 'pokefarm' || entry.name === 'pokeidlehub') {
              destName = 'pokeidlehub';
            } else if (entry.name.startsWith('pokefarm-acc-')) {
              const suffix = entry.name.slice('pokefarm-acc-'.length);
              destName = `pokeidlehub-acc-${suffix}`;
            } else if (entry.name.startsWith('pokeidlehub-acc-')) {
              destName = entry.name;
            }
            if (destName) {
              const destPath = path.join(partitionsDir, destName);
              if (!fs.existsSync(destPath)) {
                fs.cpSync(path.join(legacyPartitions, entry.name), destPath, { recursive: true });
              }
            }
          }
        } catch (_) {}
      }

      break;
    }

    // 2. Normalizar partições internas caso já existam pastas com prefixo 'pokefarm' dentro de Partitions
    if (fs.existsSync(partitionsDir)) {
      const entries = fs.readdirSync(partitionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'pokefarm') {
          const dest = path.join(partitionsDir, 'pokeidlehub');
          if (!fs.existsSync(dest)) {
            fs.cpSync(path.join(partitionsDir, entry.name), dest, { recursive: true });
          }
        }
        if (entry.name.startsWith('pokefarm-acc-')) {
          const suffix = entry.name.slice('pokefarm-acc-'.length);
          const dest = path.join(partitionsDir, `pokeidlehub-acc-${suffix}`);
          if (!fs.existsSync(dest)) {
            fs.cpSync(path.join(partitionsDir, entry.name), dest, { recursive: true });
          }
        }
      }
    }
  } catch (_) { /* ignora erro de migração para não bloquear a inicialização */ }
}

// MARK: Ciclo de vida

app.on('second-instance', showWindow);

app.whenReady().then(() => {
  migrateLegacySessions();
  setupSession(PARTITION);
  // Mac/PC não dormem com o app aberto (inclusive com a tela bloqueada)
  powerSaveBlocker.start('prevent-app-suspension');
  powerSaveBlocker.start('prevent-display-sleep');
  createTray();
  createWindow();
  startUpdateChecks();
  app.on('activate', () => { if (!summaryWindow?.isVisible()) showWindow(); });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  quitting = true;
  clearTimeout(trayClickTimer);
  if (updateTimer) clearInterval(updateTimer);
  for (const w of cockpitWindows.values()) {
    try { if (!w.isDestroyed()) w.close(); } catch (_) {}
  }
  cockpitWindows.clear();
});
app.on('will-quit', () => {
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
});
