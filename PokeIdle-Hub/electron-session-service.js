'use strict';

const PRELOADS = Object.freeze([
  ['pf-game-channels', 'game-channels.js'],
  ['pf-game-session', 'game-session.js'],
  ['pf-pokeidle-hunt', 'pokeidle-hunt.js'],
  ['pf-twitch-economy', 'twitch-economy.js'],
  ['pf-kick-economy', 'kick-economy.js'],
  ['pf-rotom-addon', 'rotom-addon.js'],
]);

function createElectronSessionService({
  session,
  isPackaged,
  resourcesPath,
  appDirectory,
  existsSync,
  joinPath,
  userAgent,
  getContentPurpose = () => null,
}) {
  const configuredPartitions = new Set();

  function resolvePreloadPath(filename) {
    if (isPackaged) {
      const unpacked = joinPath(resourcesPath, 'app.asar.unpacked', filename);
      if (existsSync(unpacked)) return unpacked;
    }
    return joinPath(appDirectory, filename);
  }

  function setupSession(partition) {
    if (configuredPartitions.has(partition)) return;
    configuredPartitions.add(partition);
    const currentSession = session.fromPartition(partition);
    currentSession.setUserAgent(userAgent);
    currentSession.webRequest.onBeforeRequest((details, callback) => {
      let cancel = false;
      if (details.webContentsId != null && ['live-player', 'live-chat', 'live-economy'].includes(getContentPurpose(details.webContentsId))) try {
        const url = new URL(details.url);
        if (['www.facebook.com', 'facebook.com', 'use1-turn.fpjs.io', 'fpjs.io'].includes(url.hostname) ||
            (url.hostname === 's.amazon-adsystem.com' && details.resourceType === 'subFrame')) {
          cancel = true;
        }
      } catch (_) { /* página em navegação/fechada: preserva a requisição */ }
      callback({ cancel });
    });

    for (const [id, filename] of PRELOADS) {
      try {
        const filePath = resolvePreloadPath(filename);
        if (!existsSync(filePath)) continue;
        try { currentSession.unregisterPreloadScript(id); } catch (_) {}
        currentSession.registerPreloadScript({ id, type: 'frame', filePath });
      } catch (_) {}
    }
  }

  return { setupSession, configuredPartitions };
}

module.exports = { createElectronSessionService };
