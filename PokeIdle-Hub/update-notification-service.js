'use strict';

function createUpdateNotificationService({
  createReleaseChecker,
  currentVersion,
  getSettingsFile,
  readFileSync,
  writeFileSync,
  Notification,
  shell,
  getMainWindow,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  let checker = null;
  let timer = null;

  function start() {
    if (checker) return checker;

    const settingsFile = getSettingsFile();
    let notifiedVersions = [];
    try { notifiedVersions = JSON.parse(readFileSync(settingsFile, 'utf8')); } catch (_) { /* primeira abertura */ }

    checker = createReleaseChecker({
      currentVersion,
      notifiedVersions,
      persistNotified: versions => {
        try { writeFileSync(settingsFile, JSON.stringify(versions)); } catch (_) {}
      },
      onChange: state => {
        const window = getMainWindow();
        if (window && !window.isDestroyed()) window.webContents.send('update-state', state);
      },
      onAvailable: update => {
        if (!Notification.isSupported()) return;
        const notification = new Notification({
          title: 'Atualização do PokeIdle Hub',
          body: `A versão ${update.version} está disponível. Clique para ver a release.`,
        });
        notification.on('click', () => { void shell.openExternal(update.url).catch(() => {}); });
        notification.show();
      },
    });
    void checker.check();
    timer = setIntervalFn(() => { void checker.check(); }, 60 * 60 * 1000);
    return checker;
  }

  function stop() {
    if (timer === null) return;
    clearIntervalFn(timer);
    timer = null;
  }

  return {
    start,
    stop,
    getState: () => checker?.getState() ?? null,
    check: () => checker?.check() ?? null,
  };
}

module.exports = { createUpdateNotificationService };
