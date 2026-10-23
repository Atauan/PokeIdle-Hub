'use strict';

const accountPartitions = require('./account-partition');

const RUNTIME_LOCK_FILES = new Set([
  'SingletonCookie',
  'SingletonLock',
  'SingletonSocket',
  'lockfile',
]);

function registerSessionMaintenanceHandlers({
  ipcMain,
  isTrustedSender,
  session,
  fs,
  primaryPartition,
  configuredPartitions,
  getSessionDataPath,
  getUserDataPath,
  joinPath,
  openPath,
  garbageCollect,
  getAppMetrics,
  relaunch,
}) {
  function collectPartitions() {
    const partitions = new Set([primaryPartition, ...configuredPartitions]);
    let failures = 0;
    try {
      const partitionsDirectory = joinPath(getSessionDataPath(), 'Partitions');
      if (fs.existsSync(partitionsDirectory)) {
        const entries = fs.readdirSync(partitionsDirectory, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith('pokeidlehub-acc-')) {
            partitions.add(`persist:${entry.name}`);
          }
        }
      }
    } catch (_) {
      failures += 1;
    }
    return { partitions, failures };
  }

  function collectSessions() {
    const { partitions, failures: partitionFailures } = collectPartitions();
    const sessions = new Set();
    let failures = partitionFailures;
    for (const partition of partitions) {
      try { sessions.add(session.fromPartition(partition)); } catch (_) { failures += 1; }
    }
    try {
      if (session.defaultSession) sessions.add(session.defaultSession);
    } catch (_) { failures += 1; }
    return { sessions: [...sessions], failures };
  }

  async function readHttpCacheSize() {
    const { sessions, failures: sessionFailures } = collectSessions();
    const sizes = await Promise.all(sessions.map(async currentSession => {
      try {
        const bytes = await currentSession.getCacheSize();
        if (!Number.isFinite(bytes) || bytes < 0) throw new Error('invalid cache size');
        return { bytes, failed: false };
      } catch (_) {
        return { bytes: 0, failed: true };
      }
    }));
    const failures = sessionFailures + sizes.filter(result => result.failed).length;
    return {
      bytes: sizes.reduce((total, result) => total + result.bytes, 0),
      available: failures === 0,
      failures,
    };
  }

  async function measureDirectoryBytes(rootPath) {
    if (typeof rootPath !== 'string' || !rootPath || !fs.promises?.readdir || !fs.promises?.stat) {
      return { bytes: null, partial: true };
    }
    try {
      if (!fs.existsSync(rootPath)) return { bytes: 0, partial: false };
    } catch (_) {
      return { bytes: null, partial: true };
    }

    let bytes = 0;
    let partial = false;
    const directories = [rootPath];
    while (directories.length) {
      const directory = directories.pop();
      let entries;
      try {
        entries = await fs.promises.readdir(directory, { withFileTypes: true });
      } catch (_) {
        partial = true;
        continue;
      }
      for (const entry of entries) {
        const entryPath = joinPath(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          directories.push(entryPath);
          continue;
        }
        if (!entry.isFile()) continue;
        try {
          const file = await fs.promises.stat(entryPath);
          if (Number.isFinite(file.size) && file.size > 0) bytes += file.size;
        } catch (_) {
          partial = true;
        }
      }
    }
    return { bytes: partial && bytes === 0 ? null : bytes, partial };
  }

  function readAppMemory() {
    if (typeof getAppMetrics !== 'function') return { bytes: null, measurement: 'unavailable' };
    try {
      const metrics = getAppMetrics();
      if (!Array.isArray(metrics) || metrics.length === 0) return { bytes: null, measurement: 'unavailable' };
      const privateValues = metrics.map(metric => metric?.memory?.privateBytes);
      if (privateValues.every(value => Number.isFinite(value) && value >= 0)) {
        return {
          bytes: privateValues.reduce((total, value) => total + value, 0) * 1024,
          measurement: 'private-bytes',
        };
      }
      const workingSetValues = metrics.map(metric => metric?.memory?.workingSetSize);
      if (workingSetValues.every(value => Number.isFinite(value) && value >= 0)) {
        return {
          bytes: workingSetValues.reduce((total, value) => total + value, 0) * 1024,
          measurement: 'working-set-estimate',
        };
      }
    } catch (_) {}
    return { bytes: null, measurement: 'unavailable' };
  }

  async function readMaintenanceSummary() {
    let sessionData;
    try {
      sessionData = await measureDirectoryBytes(getSessionDataPath());
    } catch (_) {
      sessionData = { bytes: null, partial: true };
    }
    const httpCache = await readHttpCacheSize();
    return {
      ok: true,
      sessionDataBytes: sessionData.bytes,
      sessionDataPartial: sessionData.partial,
      httpCacheBytes: httpCache.available ? httpCache.bytes : null,
      httpCacheAvailable: httpCache.available,
      failureCount: httpCache.failures + (sessionData.partial ? 1 : 0),
    };
  }

  ipcMain.handle('clear-account', async (event, id) => {
    const partition = `persist:pokeidlehub-acc-${String(id)}`;
    if (!isTrustedSender(event) || !accountPartitions.isAdditionalPartition(partition)) return false;
    try {
      await session.fromPartition(partition).clearStorageData();
      return true;
    } catch (_) {
      return false;
    }
  });

  ipcMain.on('open-data-dir', event => {
    if (isTrustedSender(event)) openPath(getUserDataPath());
  });

  ipcMain.handle('session-maintenance-summary', async event => {
    if (!isTrustedSender(event)) return { ok: false };
    try {
      return await readMaintenanceSummary();
    } catch (_) {
      return { ok: false };
    }
  });

  ipcMain.handle('clean-ram', async event => {
    if (!isTrustedSender(event)) return { ok: false };
    const before = await readHttpCacheSize();
    const memoryBefore = readAppMemory();
    const { sessions, failures: sessionFailures } = collectSessions();
    const clearResults = await Promise.all(sessions.map(async currentSession => {
      try {
        await currentSession.clearCache();
        return true;
      } catch (_) {
        return false;
      }
    }));
    if (typeof garbageCollect === 'function') {
      try { garbageCollect(); } catch (_) {}
    }
    const after = await readHttpCacheSize();
    const memoryAfter = readAppMemory();
    const clearFailures = sessionFailures + clearResults.filter(result => !result).length;
    const cacheBytesBefore = before.available ? before.bytes : null;
    const cacheBytesAfter = after.available ? after.bytes : null;
    return {
      ok: clearFailures === 0,
      partial: clearFailures > 0 && clearResults.some(Boolean),
      cacheBytesBefore,
      cacheBytesAfter,
      cacheBytesObservedCleared: cacheBytesBefore === null || cacheBytesAfter === null
        ? null
        : Math.max(0, cacheBytesBefore - cacheBytesAfter),
      cacheFailures: clearFailures,
      measurementFailures: before.failures + after.failures,
      memoryBeforeBytes: memoryBefore.bytes,
      memoryAfterBytes: memoryAfter.bytes,
      memoryMeasurement: memoryBefore.measurement === memoryAfter.measurement ? memoryBefore.measurement : 'unavailable',
      garbageCollectionRequested: typeof garbageCollect === 'function',
    };
  });

  ipcMain.handle('restart-app', event => {
    if (!isTrustedSender(event) || typeof relaunch !== 'function') return { ok: false };
    try {
      relaunch();
      return { ok: true };
    } catch (_) {
      return { ok: false };
    }
  });

  ipcMain.handle('reset-app-data', async event => {
    if (!isTrustedSender(event) || typeof relaunch !== 'function') return { ok: false };
    try {
      const { sessions } = collectSessions();
      await Promise.all(sessions.map(async currentSession => {
        try {
          if (typeof currentSession?.clearStorageData === 'function') {
            await currentSession.clearStorageData();
          }
        } catch (_) {}
      }));

      const userDataPath = typeof getUserDataPath === 'function' ? getUserDataPath() : null;
      if (typeof userDataPath === 'string' && userDataPath && fs?.existsSync?.(userDataPath)) {
        if (typeof fs.readdirSync === 'function') {
          let entries = [];
          try {
            entries = fs.readdirSync(userDataPath, { withFileTypes: true });
          } catch (_) {}
          for (const entry of entries) {
            const name = typeof entry === 'string' ? entry : entry.name;
            if (!name || RUNTIME_LOCK_FILES.has(name)) continue;
            const targetPath = joinPath(userDataPath, name);
            try {
              if (typeof fs.rmSync === 'function') {
                fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 2 });
              }
            } catch (_) {}
          }
        }
      }

      relaunch();
      return { ok: true };
    } catch (_) {
      return { ok: false };
    }
  });
}

module.exports = { registerSessionMaintenanceHandlers };
