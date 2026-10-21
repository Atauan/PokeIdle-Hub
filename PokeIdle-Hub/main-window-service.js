'use strict';

const path = require('node:path');

function createMainWindowService({
  BrowserWindow,
  appDirectory,
  isDevelopment,
  platform,
  appUserModelId,
  getAppIcon,
  getTaskbarIconPath,
  getWindow,
  setWindow,
  isQuitting,
  getTray,
  setQuitting,
  setTimeoutFn = setTimeout,
}) {
  function create() {
    setWindow(new BrowserWindow({
      width: 1440,
      height: 880,
      minWidth: 1000,
      minHeight: 560,
      title: isDevelopment ? 'PokeIdle Hub [DEV]' : 'PokeIdle Hub',
      backgroundColor: '#141416',
      autoHideMenuBar: true,
      icon: getAppIcon(),
      webPreferences: {
        preload: path.join(appDirectory, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: true,
        backgroundThrottling: false,
        spellcheck: false,
      },
    }));

    const window = getWindow();
    if (platform === 'win32' && appUserModelId && getTaskbarIconPath) {
      window.setAppDetails({
        appId: appUserModelId,
        appIconPath: getTaskbarIconPath(),
        appIconIndex: 0,
      });
    }
    window.loadFile(path.join(appDirectory, 'renderer', 'index.html'));
    window.webContents.on('page-title-updated', event => {
      event.preventDefault();
      const currentWindow = getWindow();
      if (currentWindow && !currentWindow.isDestroyed()) {
        currentWindow.setTitle(isDevelopment ? 'PokeIdle Hub [DEV]' : 'PokeIdle Hub');
      }
    });
    // A janela principal não navega para fora nem abre pop-ups.
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('render-process-gone', () => setTimeoutFn(() => {
      const currentWindow = getWindow();
      if (currentWindow && !currentWindow.isDestroyed()) currentWindow.reload();
    }, 2000));
    window.on('close', event => {
      const tray = getTray();
      if (isQuitting() || !tray || tray.isDestroyed()) return;
      event.preventDefault();
      // Ocultar preserva renderer, webviews e áudio enquanto a bandeja está ativa.
      getWindow().hide();
    });
    // O Windows não emite before-quit ao encerrar a sessão do usuário.
    window.on('session-end', () => setQuitting(true));
    window.on('closed', () => setWindow(null));
    return window;
  }

  return { create };
}

module.exports = { createMainWindowService };
