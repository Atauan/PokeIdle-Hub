'use strict';
// Ponte segura entre a interface (renderer) e o processo principal
const { contextBridge, ipcRenderer } = require('electron');
// Sandboxed Electron preloads can require only Electron's built-in modules.
// Keep this boundary validation local; the main process validates the same format.
const isAdditionalPartition = (partition) =>
  typeof partition === 'string' && /^persist:pokeidlehub-acc-[a-z0-9-]{1,60}$/i.test(partition);

contextBridge.exposeInMainWorld('pf', {
  platform: process.platform,
  openAbout: () => ipcRenderer.send('open-about'),
  updateState: () => ipcRenderer.invoke('update-state'),
  appEnvironment: () => ipcRenderer.invoke('app-environment'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  openUpdate: () => ipcRenderer.invoke('open-update'),
  onUpdateState: (cb) => ipcRenderer.on('update-state', (_e, state) => cb(state)),
  liveStatus: (platform, channels) => ipcRenderer.invoke('live-status', platform, channels),
  notify: (title, body) => ipcRenderer.send('notify', { title: String(title), body: String(body) }),
  attention: () => ipcRenderer.send('attention'),
  openEdge: (url) => ipcRenderer.send('open-edge', String(url)),
  openLogin: (platform, partition, label) => ipcRenderer.send('open-login', String(platform), partition ? String(partition) : null, label ? String(label) : null),
  onLoginClosed: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('login-window-closed', (_e, result) => {
      if (!result || typeof result !== 'object') return;
      if (!['twitch', 'kick', 'game'].includes(result.platform)) return;
      if (result.partition !== 'persist:pokeidlehub' && !isAdditionalPartition(result.partition)) return;
      const flowId = typeof result.flowId === 'string' && /^[\da-f-]{36}$/i.test(result.flowId) ? result.flowId : null;
      cb({ platform: result.platform, partition: result.partition, flowId });
    });
  },
  onLoginTrace: (cb) => {
    if (typeof cb !== 'function') return;
    const stages = new Set([
      'request_received', 'session_ready', 'session_setup_failed', 'window_creation_started',
      'window_created', 'window_creation_failed', 'navigation_started', 'navigation_finished',
      'navigation_failed', 'window_ready_to_show', 'popup_created', 'window_closed',
    ]);
    ipcRenderer.on('login-flow-stage', (_e, result) => {
      if (!result || typeof result !== 'object') return;
      if (typeof result.flowId !== 'string' || !/^[\da-f-]{36}$/i.test(result.flowId)) return;
      if (!['twitch', 'kick', 'game'].includes(result.provider) || !stages.has(result.stage)) return;
      const payload = { flowId: result.flowId, provider: result.provider, stage: result.stage };
      if (Number.isInteger(result.errorCode)) payload.errorCode = result.errorCode;
      cb(payload);
    });
  },
  openGameLogin: (partition) => ipcRenderer.send('open-game-login', partition ? String(partition) : null),
  writeSample: (url, text) => ipcRenderer.send('write-sample', { url: String(url), text: String(text).slice(0, 30000) }),
  openDataDir: () => ipcRenderer.send('open-data-dir'),
  getSessionMaintenanceSummary: () => ipcRenderer.invoke('session-maintenance-summary'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  resetAppData: () => ipcRenderer.invoke('reset-app-data'),
  onOpenTab: (cb) => ipcRenderer.on('open-tab', (_e, tab) => cb(String(tab))),
  clearAccount: (id) => ipcRenderer.invoke('clear-account', String(id)),
  onAddLive: (cb) => ipcRenderer.on('add-live', (_e, link) => cb(String(link))),
  checkConnections: (partition) => ipcRenderer.invoke('check-connections', partition ? String(partition) : null),
  clearConnection: (platform, partition) => ipcRenderer.invoke('clear-connection', String(platform), partition ? String(partition) : null),
  cleanRam: () => ipcRenderer.invoke('clean-ram'),
  trimHubWorkingSet: () => ipcRenderer.invoke('trim-hub-working-set'),
  getUpdateTarget: () => ipcRenderer.invoke('get-update-target'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  cancelDownloadUpdate: () => ipcRenderer.invoke('cancel-download-update'),
  installUpdate: (filePath) => ipcRenderer.invoke('install-update', filePath),
  showInFolder: (filePath) => ipcRenderer.send('show-in-folder', filePath),
  quitApp: () => ipcRenderer.send('quit-app'),
  onDownloadProgress: (cb) => ipcRenderer.on('update-download-progress', (_e, data) => cb(data)),
  openRotomCockpit: (accId, accName) => ipcRenderer.invoke('open-rotom-cockpit', { accId: String(accId), accName: String(accName) }),
  sendRotomFromWebview: (accId, data) => ipcRenderer.send('rotom-from-webview', { accId: String(accId), data }),
  onRotomForwardToGame: (cb) => ipcRenderer.on('rotom-forward-to-game', (_e, payload) => cb(payload)),
});
