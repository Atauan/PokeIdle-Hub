'use strict';

const path = require('path');

function getBestUpdateAsset(assets, platform, isPortable) {
  if (!Array.isArray(assets) || !assets.length) return null;

  if (platform === 'win32') {
    if (isPortable) {
      const portable = assets.find(asset => asset.name.toLowerCase().includes('portable') && asset.name.toLowerCase().endsWith('.exe'));
      if (portable) return { ...portable, isPortable: true };
    }
    const setup = assets.find(asset => asset.name.toLowerCase().includes('setup') && asset.name.toLowerCase().endsWith('.exe'))
      || assets.find(asset => asset.name.toLowerCase().endsWith('.exe'));
    if (setup) return { ...setup, isPortable: false };
  } else if (platform === 'darwin') {
    const dmg = assets.find(asset => asset.name.toLowerCase().endsWith('.dmg'))
      || assets.find(asset => asset.name.toLowerCase().endsWith('.zip'));
    if (dmg) return { ...dmg, isPortable: false };
  } else if (platform === 'linux') {
    const linux = assets.find(asset => asset.name.toLowerCase().endsWith('.appimage'))
      || assets.find(asset => asset.name.toLowerCase().endsWith('.deb'));
    if (linux) return { ...linux, isPortable: false };
  }
  return assets[0] ? { ...assets[0], isPortable } : null;
}

function isRunningAsPortable({ env = process.env, getExecutablePath }) {
  if (env.PORTABLE_EXECUTABLE_DIR || env.PORTABLE_EXECUTABLE_FILE) return true;
  try {
    return path.basename(getExecutablePath()).toLowerCase().includes('portable');
  } catch (_) {
    return false;
  }
}

function createUpdateDownloadService({
  ipcMain,
  isAuthorized,
  isDevelopment,
  platform,
  getRelease,
  getPortableStatus,
  getDownloadsPath,
  joinPath = path.join,
  fetch: fetchFile = globalThis.fetch,
  createWriteStream,
  existsSync,
  spawn,
  setTimeoutFn = setTimeout,
  app,
  shell,
  getMainWindow,
}) {
  let currentDownloadAbort = null;

  ipcMain.handle('get-update-target', event => {
    if (!isAuthorized(event) || isDevelopment) return null;
    const release = getRelease();
    const portable = getPortableStatus();
    const asset = getBestUpdateAsset(release?.assets, platform, portable);
    return {
      isPortable: portable,
      platform,
      assetName: asset?.name || null,
      assetSize: asset?.size || 0,
    };
  });

  ipcMain.handle('open-update', async event => {
    if (!isAuthorized(event) || isDevelopment) return false;
    const url = getRelease()?.url;
    if (!url) return false;
    try { await shell.openExternal(url); return true; } catch (_) { return false; }
  });

  ipcMain.handle('download-update', async event => {
    if (!isAuthorized(event)) return { ok: false, error: 'Unauthorized' };
    if (isDevelopment) return { ok: false, error: 'Atualizações não estão disponíveis em dev.' };
    const release = getRelease();
    if (!release) return { ok: false, error: 'Nenhuma versão disponível' };

    const asset = getBestUpdateAsset(release.assets, platform, getPortableStatus());
    if (!asset || !asset.url) return { ok: false, error: 'Arquivo executável não encontrado na release' };

    try {
      if (currentDownloadAbort) {
        currentDownloadAbort.abort();
        currentDownloadAbort = null;
      }
      currentDownloadAbort = new AbortController();

      const destPath = joinPath(getDownloadsPath(), asset.name);
      const response = await fetchFile(asset.url, {
        signal: currentDownloadAbort.signal,
        headers: {
          'User-Agent': 'PokeIdleHub-Updater',
          Accept: 'application/octet-stream',
        },
      });

      if (!response.ok || !response.body) throw new Error(`Falha no download: HTTP ${response.status}`);

      const totalBytes = Number(response.headers.get('content-length')) || asset.size || 0;
      let downloadedBytes = 0;
      const fileStream = createWriteStream(destPath);
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        downloadedBytes += value.length;
        fileStream.write(Buffer.from(value));
        const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
        getMainWindow()?.webContents.send('update-download-progress', {
          percent,
          downloadedBytes,
          totalBytes,
          fileName: asset.name,
        });
      }

      await new Promise((resolve, reject) => {
        fileStream.end(error => (error ? reject(error) : resolve()));
      });
      currentDownloadAbort = null;
      return {
        ok: true,
        filePath: destPath,
        fileName: asset.name,
        isPortable: asset.isPortable,
        version: release.version,
      };
    } catch (error) {
      currentDownloadAbort = null;
      if (error.name === 'AbortError') return { ok: false, aborted: true };
      return { ok: false, error: String(error.message || error) };
    }
  });

  ipcMain.handle('cancel-download-update', event => {
    if (!isAuthorized(event) || isDevelopment) return false;
    if (!currentDownloadAbort) return false;
    currentDownloadAbort.abort();
    currentDownloadAbort = null;
    return true;
  });

  ipcMain.handle('install-update', async (event, filePath) => {
    if (!isAuthorized(event) || isDevelopment) return false;
    if (!filePath || typeof filePath !== 'string' || !existsSync(filePath)) return false;
    try {
      if (platform === 'win32') {
        spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
        setTimeoutFn(() => { app.quit(); }, 800);
        return true;
      }
      await shell.openPath(filePath);
      return true;
    } catch (_) {
      return false;
    }
  });
}

module.exports = { createUpdateDownloadService, getBestUpdateAsset, isRunningAsPortable };
