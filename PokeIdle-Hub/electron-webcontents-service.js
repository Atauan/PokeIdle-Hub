'use strict';

const { isAdditionalPartition } = require('./account-partition');
const { trackAttachedLiveWebviews } = require('./live-content-purpose');

function registerElectronWebContentsHandlers({
  app,
  preloadPath,
  primaryPartition,
  setupSession,
  isGame,
  channelURL,
  addLive,
  liveContentRegistry,
}) {
  app.on('web-contents-created', (_event, contents) => {
    trackAttachedLiveWebviews(contents, liveContentRegistry);

    contents.on('will-attach-webview', (event, webPreferences, params) => {
      delete webPreferences.preloadURL;
      webPreferences.preload = preloadPath;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      webPreferences.backgroundThrottling = false;

      const partition = isAdditionalPartition(params.partition || '')
        ? params.partition
        : primaryPartition;
      setupSession(partition);
      webPreferences.partition = partition;
      if (!/^https:\/\//.test(params.src || '')) event.preventDefault();
    });

    if (contents.getType() !== 'webview') return;

    contents.on('will-navigate', (event, url) => {
      if (!isGame(contents)) return;
      const link = channelURL(url);
      if (link) {
        event.preventDefault();
        addLive(link);
      }
    });

    contents.on('did-create-window', child => {
      if (!isGame(contents)) return;
      child.webContents.on('will-navigate', (event, url) => {
        const link = channelURL(url);
        if (link) {
          event.preventDefault();
          addLive(link);
          child.close();
        }
      });
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (isGame(contents)) {
        const link = channelURL(url);
        if (link) {
          addLive(link);
          return { action: 'deny' };
        }
      }
      if (url === 'about:blank' && isGame(contents)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            show: false,
            webPreferences: {
              session: contents.session,
              contextIsolation: true,
              sandbox: true,
              nodeIntegration: false,
            },
          },
        };
      }
      if (!/^https:\/\//.test(url)) return { action: 'deny' };
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 760,
          title: 'Entrar',
          autoHideMenuBar: true,
          webPreferences: {
            session: contents.session,
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
          },
        },
      };
    });
  });
}

module.exports = { registerElectronWebContentsHandlers };
