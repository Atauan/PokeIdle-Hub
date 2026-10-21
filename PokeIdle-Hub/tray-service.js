'use strict';

function createTrayService({
  Tray,
  Menu,
  nativeImage,
  app,
  getAppIcon,
  platform,
  isDevelopment,
  showMainWindow,
  showSessionSummary,
  hideSessionSummary,
  isMainWindowHiddenOrMinimized,
  onAbout,
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  let tray = null;
  let trayClickTimer = null;
  let ignoreTrayClickUntil = 0;

  function clearClickTimer() {
    clearTimeoutFn(trayClickTimer);
    trayClickTimer = null;
  }

  function create() {
    const size = platform === 'darwin' ? 18 : 32;
    const icon = nativeImage.createFromPath(getAppIcon())
      .resize({ width: size, height: size });
    tray = new Tray(icon);
    tray.setToolTip(isDevelopment ? 'PokeIdle Hub [DEV]' : 'PokeIdle Hub');
    const menu = Menu.buildFromTemplate([
      { label: 'Sobre', click: onAbout },
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() },
    ]);

    tray.on('click', () => {
      if (now() < ignoreTrayClickUntil) return;
      clearClickTimer();
      trayClickTimer = setTimeoutFn(() => {
        if (isMainWindowHiddenOrMinimized()) showSessionSummary();
        else showMainWindow();
      }, 300);
    });
    tray.on('double-click', () => {
      ignoreTrayClickUntil = now() + 500;
      showMainWindow();
    });
    // Menu explícito preserva o clique esquerdo no macOS.
    tray.on('right-click', () => {
      clearClickTimer();
      hideSessionSummary();
      tray.popUpContextMenu(menu);
    });
    return tray;
  }

  return Object.freeze({
    clearClickTimer,
    create,
    getTray: () => tray,
    setTray: value => { tray = value; },
  });
}

module.exports = { createTrayService };
