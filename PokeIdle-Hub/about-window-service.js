'use strict';

const path = require('path');

function createAboutWindowService({
  BrowserWindow,
  ipcMain,
  shell,
  clipboard,
  appDirectory,
  appVersion,
  getAppIcon,
  donations,
  isQuitting,
}) {
  let aboutWindow = null;
  const allowedExternalLinks = new Set([
    donations.repository,
    'https://github.com/RaullPereira/PokeFarm',
    ...donations.developers.flatMap(profile => [profile.github, profile.linkedin]),
  ]);

  ipcMain.handle('about-data', event => event.sender === aboutWindow?.webContents ? donations : null);
  ipcMain.handle('about-copy-pix', (event, id) => {
    if (event.sender !== aboutWindow?.webContents) return false;
    const profile = donations.developers.find(developer => developer.id === id);
    if (!profile) return false;
    clipboard.writeText(profile.pix);
    return true;
  });

  function show() {
    if (isQuitting()) return;
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
      webPreferences: {
        preload: path.join(appDirectory, 'about-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    aboutWindow = window;
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (allowedExternalLinks.has(url)) void shell.openExternal(url).catch(() => {});
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.once('ready-to-show', () => { window.show(); window.focus(); });
    window.on('closed', () => { if (aboutWindow === window) aboutWindow = null; });
    window.loadFile(path.join(appDirectory, 'renderer', 'about.html'), {
      query: { version: appVersion },
    });
  }

  return Object.freeze({ show });
}

module.exports = { createAboutWindowService };
