'use strict';

function registerLiveStatusHandler({ ipcMain, isAuthorized, checkStatus }) {
  ipcMain.handle('live-status', (event, platform, channels) => {
    if (!isAuthorized(event)) return {};
    return checkStatus(platform, channels);
  });
}

module.exports = { registerLiveStatusHandler };
