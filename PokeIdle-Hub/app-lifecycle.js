'use strict';

function registerAppLifecycle({
  app,
  qaBuild = false,
  startupReady,
  lockAcquired,
  primaryPartition,
  portableExecutableDir,
  migrateLegacySessions,
  prepareProviderSessions = async () => {},
  setupSession,
  powerSaveBlocker,
  createTray,
  createWindow,
  showWindow,
  isSessionSummaryVisible,
  updateNotificationService,
  rotomCockpitService,
  setQuitting,
  clearTrayClickTimer,
  getTray,
  setTray,
}) {
  app.on('second-instance', (_event, commandLine = []) => {
    if (commandLine.includes('--dev-reset')) return;
    showWindow();
  });

  app.whenReady().then(async () => {
    if (!startupReady || !lockAcquired) return;
    if (app.isPackaged && !qaBuild) {
      migrateLegacySessions({
        userDataPath: app.getPath('userData'),
        portableExecutableDir,
      });
      try {
        await prepareProviderSessions();
      } catch (_) {
        console.error('[provider-session-cleanup] Limpeza incompleta; nova tentativa no próximo início.');
      }
    }
    setupSession(primaryPartition);
    powerSaveBlocker.start('prevent-app-suspension');
    powerSaveBlocker.start('prevent-display-sleep');
    createTray();
    createWindow();
    if (app.isPackaged && !qaBuild) updateNotificationService.start();
    app.on('activate', () => { if (!isSessionSummaryVisible()) showWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    setQuitting(true);
    clearTrayClickTimer();
    updateNotificationService.stop();
    rotomCockpitService.closeAll();
  });
  app.on('will-quit', () => {
    const tray = getTray();
    if (tray && !tray.isDestroyed()) tray.destroy();
    setTray(null);
  });
}

module.exports = { registerAppLifecycle };
