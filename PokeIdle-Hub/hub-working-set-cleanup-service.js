'use strict';

const VALID_STATUSES = new Set([
  'trimmed',
  'access-denied',
  'process-exited',
  'identity-mismatch',
  'open-failed',
  'process-query-failed',
  'trim-failed',
]);

function normalizeMetrics(metrics) {
  if (!Array.isArray(metrics)) return [];
  const unique = new Map();
  for (const metric of metrics) {
    const pid = metric?.pid;
    const creationTime = metric?.creationTime;
    if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isFinite(creationTime) || creationTime <= 0) continue;
    if (unique.has(pid)) continue;
    const workingSetSize = metric?.memory?.workingSetSize;
    unique.set(pid, {
      pid,
      creationTime,
      workingSetBytes: Number.isFinite(workingSetSize) && workingSetSize >= 0 ? workingSetSize * 1024 : null,
    });
  }
  return [...unique.values()];
}

function totalWorkingSet(processes) {
  if (processes.length === 0 || processes.some(process => process.workingSetBytes === null)) return null;
  return processes.reduce((total, process) => total + process.workingSetBytes, 0);
}

function createHubWorkingSetCleanupService({ platform, isTrustedSender, getAppMetrics, trimProcesses }) {
  async function trim(event) {
    if (!isTrustedSender(event)) return { ok: false };
    if (platform !== 'win32') return { ok: false, unavailable: true };

    let beforeProcesses;
    try { beforeProcesses = normalizeMetrics(getAppMetrics()); } catch (_) { beforeProcesses = []; }
    if (beforeProcesses.length === 0) return { ok: false, unavailable: true, attempted: 0, trimmed: 0, failed: 0 };

    let results;
    try {
      const response = await trimProcesses(beforeProcesses.map(({ pid, creationTime }) => ({ pid, creationTime })));
      results = Array.isArray(response?.results) ? response.results : [];
    } catch (_) {
      return { ok: false, partial: false, attempted: beforeProcesses.length, trimmed: 0, failed: beforeProcesses.length, accessDenied: 0, observedBytesReduced: null };
    }

    const allowedPids = new Set(beforeProcesses.map(process => process.pid));
    const outcomes = new Map();
    for (const result of results) {
      if (allowedPids.has(result?.pid) && VALID_STATUSES.has(result?.status)) outcomes.set(result.pid, result.status);
    }
    const trimmed = beforeProcesses.filter(process => outcomes.get(process.pid) === 'trimmed').length;
    const failed = beforeProcesses.length - trimmed;
    const accessDenied = beforeProcesses.filter(process => outcomes.get(process.pid) === 'access-denied').length;

    let afterProcesses;
    try { afterProcesses = normalizeMetrics(getAppMetrics()); } catch (_) { afterProcesses = []; }
    const afterByPid = new Map(afterProcesses.map(process => [process.pid, process]));
    const comparableAfter = beforeProcesses.map(process => {
      const after = afterByPid.get(process.pid);
      return after?.creationTime === process.creationTime ? after : { ...process, workingSetBytes: null };
    });
    const workingSetBeforeBytes = totalWorkingSet(beforeProcesses);
    const workingSetAfterBytes = totalWorkingSet(comparableAfter);

    return {
      ok: failed === 0,
      partial: trimmed > 0 && failed > 0,
      attempted: beforeProcesses.length,
      trimmed,
      failed,
      accessDenied,
      workingSetBeforeBytes,
      workingSetAfterBytes,
      observedBytesReduced: workingSetBeforeBytes === null || workingSetAfterBytes === null
        ? null
        : Math.max(0, workingSetBeforeBytes - workingSetAfterBytes),
    };
  }

  return Object.freeze({ trim });
}

function registerHubWorkingSetCleanupHandler({ ipcMain, ...dependencies }) {
  const service = createHubWorkingSetCleanupService(dependencies);
  ipcMain.handle('trim-hub-working-set', event => service.trim(event));
  return service;
}

module.exports = { createHubWorkingSetCleanupService, registerHubWorkingSetCleanupHandler };
