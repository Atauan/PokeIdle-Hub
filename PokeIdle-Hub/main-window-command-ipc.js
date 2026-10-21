'use strict';

const SAFE_URL = /^https:\/\/([a-z0-9-]+\.)*(kick\.com|twitch\.tv|pokeidle\.io)(\/[A-Za-z0-9_\-/]*)?$/;

function registerMainWindowCommandHandlers({
  ipcMain,
  isMainWindowAuthorized,
  isTrustedAppSender,
  platform,
  app,
  shell,
  spawn,
}) {
  ipcMain.on('show-in-folder', (event, filePath) => {
    if (isMainWindowAuthorized(event) && filePath && typeof filePath === 'string') {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.on('quit-app', event => {
    if (isMainWindowAuthorized(event)) app.quit();
  });

  ipcMain.on('open-edge', (event, url) => {
    if (!isTrustedAppSender(event) || typeof url !== 'string' || !SAFE_URL.test(url)) return;
    if (platform === 'darwin') {
      const child = spawn('open', ['-a', 'Microsoft Edge', url], { stdio: 'ignore' });
      child.on('error', () => shell.openExternal(url));
      child.on('exit', code => { if (code !== 0) shell.openExternal(url); });
    } else if (platform === 'win32') {
      // O Windows registra o protocolo microsoft-edge: para abrir direto no Edge.
      shell.openExternal(`microsoft-edge:${url}`).catch(() => shell.openExternal(url));
    } else {
      shell.openExternal(url);
    }
  });
}

module.exports = { registerMainWindowCommandHandlers };
