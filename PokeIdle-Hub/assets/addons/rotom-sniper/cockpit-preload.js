'use strict';
// PokeIdle Hub — Preload da Janela Standalone do Cockpit Sniper

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  sendToGame(accId, message) {
    ipcRenderer.send('rotom-to-game', { accId, message });
  },
  onGameMessage(callback) {
    ipcRenderer.on('rotom-from-game', (_event, data) => {
      try { callback(data); } catch (e) { console.error('[cockpit-preload]', e); }
    });
  }
};

try {
  contextBridge.exposeInMainWorld('rotomIpc', api);
} catch (_) {
  window.rotomIpc = api;
}
