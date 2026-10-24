'use strict';

const path = require('path');

function createSessionSummaryService({
  ipcMain,
  BrowserWindow,
  screen,
  getTray,
  getMainWindow,
  isQuitting,
  showMainWindow,
  appDirectory,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  let summaryWindow = null;

  function isSummaryWindowEvent(event) {
    return !!summaryWindow
      && event.sender === summaryWindow.webContents
      && event.senderFrame === summaryWindow.webContents.mainFrame;
  }

  function show() {
    if (isQuitting()) return;
    const trayBounds = getTray().getBounds();
    const area = screen.getDisplayMatching(trayBounds).workArea;
    const width = Math.min(420, area.width - 16);
    const height = Math.min(680, area.height - 16);
    const x = Math.max(area.x + 8, Math.min(trayBounds.x + trayBounds.width - width, area.x + area.width - width - 8));
    const below = trayBounds.y + trayBounds.height + 8;
    const y = Math.max(area.y + 8, Math.min(below + height <= area.y + area.height ? below : trayBounds.y - height - 8, area.y + area.height - height - 8));

    if (!summaryWindow || summaryWindow.isDestroyed()) {
      const panel = new BrowserWindow({
        width, height, x, y, frame: false, show: false, resizable: false,
        skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#141416',
        webPreferences: {
          preload: path.join(appDirectory, 'session-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      summaryWindow = panel;
      panel.setMenu(null);
      panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      panel.webContents.on('will-navigate', event => event.preventDefault());
      panel.on('blur', () => panel.hide());
      panel.on('closed', () => { if (summaryWindow === panel) summaryWindow = null; });
      panel.once('ready-to-show', () => {
        const mainWindow = getMainWindow();
        if (!isQuitting() && mainWindow && (!mainWindow.isVisible() || mainWindow.isMinimized())) {
          panel.show();
          panel.focus();
        }
      });
      panel.loadFile(path.join(appDirectory, 'renderer', 'session.html'));
    } else {
      summaryWindow.setBounds({ x, y, width, height });
      summaryWindow.show();
      summaryWindow.focus();
    }
  }

  function hide() {
    summaryWindow?.hide();
  }

  ipcMain.handle('session-summary', async event => {
    const mainWindow = getMainWindow();
    if (!isSummaryWindowEvent(event) || !mainWindow || mainWindow.isDestroyed()) return null;
    let timer;
    try {
      return await Promise.race([
        mainWindow.webContents.executeJavaScript('window.__pfCollectSessions ? window.__pfCollectSessions() : ({accounts: []})'),
        new Promise((_resolve, reject) => { timer = setTimeoutFn(() => reject(new Error('Game summary timeout')), 4000); }),
      ]);
    } finally {
      clearTimeoutFn(timer);
    }
  });
  ipcMain.on('session-open', event => { if (isSummaryWindowEvent(event)) showMainWindow(); });
  ipcMain.on('session-close', event => { if (isSummaryWindowEvent(event)) hide(); });

  return {
    show,
    hide,
    isVisible: () => !!summaryWindow?.isVisible(),
  };
}

module.exports = { createSessionSummaryService };
