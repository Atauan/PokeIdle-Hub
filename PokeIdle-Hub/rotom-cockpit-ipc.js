'use strict';

function registerRotomCockpitHandlers({ ipcMain, isMainWindowAuthorized, rotomCockpitService }) {
  ipcMain.handle('open-rotom-cockpit', (event, payload) => {
    if (!isMainWindowAuthorized(event)) return { ok: false, error: 'Unauthorized' };
    if (!payload || typeof payload !== 'object' || typeof payload.accId !== 'string' || typeof payload.accName !== 'string') {
      return { ok: false, error: 'Invalid payload' };
    }
    return rotomCockpitService.openCockpit(payload.accId, payload.accName);
  });

  ipcMain.on('rotom-to-game', (event, payload) => {
    rotomCockpitService.forwardToGame(event, payload);
  });

  ipcMain.on('rotom-from-webview', (event, payload) => {
    if (!isMainWindowAuthorized(event) || !payload || typeof payload !== 'object') return;
    rotomCockpitService.forwardFromGame(payload.accId, payload.data);
  });
}

module.exports = { registerRotomCockpitHandlers };
