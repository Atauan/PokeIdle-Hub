'use strict';

function registerAppShellHandlers({
  ipcMain,
  isAuthorized,
  isDevelopment,
  showAbout,
  updateNotificationService,
}) {
  ipcMain.on('open-about', event => {
    if (isAuthorized(event)) showAbout();
  });

  ipcMain.handle('update-state', event => (
    isAuthorized(event) && !isDevelopment ? updateNotificationService.getState() : null
  ));

  ipcMain.handle('app-environment', event => (
    isAuthorized(event) ? { isDevelopment } : null
  ));

  ipcMain.handle('check-updates', event => (
    isAuthorized(event) && !isDevelopment ? updateNotificationService.check() : null
  ));
}

module.exports = { registerAppShellHandlers };
