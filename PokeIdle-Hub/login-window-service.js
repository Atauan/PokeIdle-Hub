'use strict';

function createLoginWindowService({ BrowserWindow, userAgent, onClosed }) {
  function openLoginWindow(url, title, partition, platform, { flowId, reportStage } = {}) {
    const trace = (stage, details) => {
      if (typeof reportStage === 'function') reportStage(stage, details);
    };
    trace('window_creation_started');
    const window = new BrowserWindow({
      width: 540,
      height: 760,
      title,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        partition,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    trace('window_created');

    window.webContents.setUserAgent(userAgent);
    window.webContents.on('did-finish-load', () => trace('navigation_finished'));
    window.webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
      if (isMainFrame && Number.isInteger(errorCode)) trace('navigation_failed', { errorCode });
    });

    const popupOptions = {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 540,
        height: 720,
        autoHideMenuBar: true,
        webPreferences: {
          session: window.webContents.session,
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
        },
      },
    };

    const setPopupPolicy = (webContents) => {
      webContents.setWindowOpenHandler(({ url: targetUrl }) => (
        /^https:\/\//.test(targetUrl) ? popupOptions : { action: 'deny' }
      ));
    };

    setPopupPolicy(window.webContents);
    window.webContents.on('did-create-window', (child) => {
      trace('popup_created');
      child.webContents.setUserAgent(userAgent);
      setPopupPolicy(child.webContents);
    });

    window.once('ready-to-show', () => {
      trace('window_ready_to_show');
      window.show();
      window.focus();
    });
    window.on('closed', () => {
      trace('window_closed');
      onClosed(window, { platform, partition, flowId });
    });
    trace('navigation_started');
    Promise.resolve(window.loadURL(url)).catch(() => trace('navigation_failed'));
    return window;
  }

  return Object.freeze({ openLoginWindow });
}

module.exports = { createLoginWindowService };
