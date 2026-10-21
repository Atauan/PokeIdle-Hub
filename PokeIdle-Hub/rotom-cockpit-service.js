'use strict';

const path = require('node:path');

function createRotomCockpitService({ BrowserWindow, assetDirectory, getAppIcon, getMainWindow }) {
  const windowsByAccount = new Map();

  function openCockpit(accountId, accountName) {
    if (typeof accountId !== 'string' || !accountId.trim() || accountId.length > 128 || typeof accountName !== 'string') {
      return { ok: false, error: 'Invalid account' };
    }
    const existing = windowsByAccount.get(accountId);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return { ok: true, focused: true };
    }

    const window = new BrowserWindow({
      width: 1160,
      height: 760,
      minWidth: 900,
      minHeight: 600,
      title: `Sniper — Cockpit [${accountName || accountId}]`,
      icon: getAppIcon(),
      backgroundColor: '#33202b',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(assetDirectory, 'cockpit-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false,
      },
    });

    windowsByAccount.set(accountId, window);
    window.once('ready-to-show', () => {
      window.show();
      window.focus();
    });
    window.on('closed', () => {
      if (windowsByAccount.get(accountId) === window) windowsByAccount.delete(accountId);
    });

    const htmlPath = path.join(assetDirectory, 'cockpit.html').replace(/\\/g, '/');
    const fileUrl = `file://${htmlPath}?acc=${encodeURIComponent(accountId)}&name=${encodeURIComponent(accountName || 'Conta')}`;
    window.loadURL(fileUrl);
    return { ok: true, created: true };
  }

  function forwardToGame(event, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const { accId, message } = payload;
    if (typeof accId !== 'string' || !message || typeof message !== 'object' || Array.isArray(message)) return false;
    const entry = [...windowsByAccount.entries()].find(([, window]) => window.webContents === event?.sender);
    if (!entry || entry[0] !== accId || event.senderFrame !== event.sender.mainFrame) return false;
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed?.()) return false;
    mainWindow.webContents.send('rotom-forward-to-game', { accId, message });
    return true;
  }

  function forwardFromGame(accountId, data) {
    if (typeof accountId !== 'string' || !data || typeof data !== 'object' || Array.isArray(data)) return false;
    const window = windowsByAccount.get(accountId);
    if (!window || window.isDestroyed()) return false;
    window.webContents.send('rotom-from-game', data);
    return true;
  }

  function closeAll() {
    const windows = [...windowsByAccount.values()];
    windowsByAccount.clear();
    for (const window of windows) {
      try { if (!window.isDestroyed()) window.close(); } catch (_) {}
    }
  }

  return Object.freeze({ openCockpit, forwardToGame, forwardFromGame, closeAll });
}

module.exports = { createRotomCockpitService };
