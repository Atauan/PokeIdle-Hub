'use strict';

function registerNotificationHandlers({
  ipcMain,
  Notification,
  app,
  platform,
  isTrustedSender,
  isQuitting,
  showWindow,
  getMainWindow,
}) {
  ipcMain.on('notify', (event, message) => {
    if (!isTrustedSender(event) || !message || !Notification.isSupported()) return;
    const notification = new Notification({
      title: String(message.title).slice(0, 120),
      body: String(message.body).slice(0, 300),
    });
    notification.on('click', () => {
      if (isQuitting()) return;
      showWindow();
      getMainWindow()?.webContents.send('open-tab', 'game');
    });
    notification.show();
  });

  ipcMain.on('attention', event => {
    if (!isTrustedSender(event)) return;
    const window = getMainWindow();
    if (!window) return;
    if (platform === 'darwin' && app.dock) app.dock.bounce('informational');
    else if (!window.isFocused()) window.flashFrame(true);
  });
}

module.exports = { registerNotificationHandlers };
