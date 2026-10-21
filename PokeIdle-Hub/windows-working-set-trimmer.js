'use strict';

const KNOWN_STATUSES = new Set([
  'trimmed',
  'access-denied',
  'process-exited',
  'identity-mismatch',
  'open-failed',
  'process-query-failed',
  'trim-failed',
]);

function createWindowsWorkingSetTrimmer({
  platform = process.platform,
  helperPath,
  spawn = require('node:child_process').spawn,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  return function trimProcesses(processes) {
    if (platform !== 'win32') return Promise.reject(new Error('A redução do working set está disponível somente no Windows.'));

    const unique = new Map();
    for (const process of Array.isArray(processes) ? processes : []) {
      if (!Number.isSafeInteger(process?.pid) || process.pid <= 0
        || !Number.isFinite(process?.creationTime) || process.creationTime <= 0) continue;
      if (!unique.has(process.pid)) unique.set(process.pid, { pid: process.pid, creationTime: process.creationTime });
    }
    const targets = [...unique.values()];
    if (targets.length === 0) return Promise.resolve({ results: [] });
    if (typeof helperPath !== 'string' || !helperPath) return Promise.reject(new Error('Helper de working set indisponível.'));

    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn(helperPath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (_) {
        reject(new Error('Não foi possível iniciar o helper de working set.'));
        return;
      }

      let output = '';
      let settled = false;
      let timeout;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeoutFn(timeout);
        if (error) reject(error);
        else resolve(result);
      };
      timeout = setTimeoutFn(() => {
        try { child.kill(); } catch (_) {}
        finish(new Error('O helper de working set excedeu o tempo limite.'));
      }, 15000);

      child.stdout.on('data', chunk => {
        output += chunk.toString('utf8');
        if (output.length > 262144) {
          try { child.kill(); } catch (_) {}
          finish(new Error('Resposta inválida do helper de working set.'));
        }
      });
      child.stderr.on('data', () => {});
      child.stdin.on('error', () => finish(new Error('Não foi possível enviar os processos ao helper.')));
      child.on('error', () => finish(new Error('Não foi possível executar o helper de working set.')));
      child.on('close', code => {
        if (code !== 0) {
          finish(new Error('O helper de working set terminou com erro.'));
          return;
        }
        const results = [];
        for (const line of output.split(/\r?\n/)) {
          if (!line) continue;
          const [pidText, status, ...extra] = line.split('\t');
          const pid = Number(pidText);
          if (extra.length || !Number.isSafeInteger(pid) || pid <= 0 || !KNOWN_STATUSES.has(status)) continue;
          results.push({ pid, status });
        }
        finish(null, { results });
      });

      const input = targets.map(target => `${target.pid}\t${target.creationTime}`).join('\n');
      try { child.stdin.end(`${input}\n`); } catch (_) { finish(new Error('Não foi possível enviar os processos ao helper.')); }
    });
  };
}

module.exports = { createWindowsWorkingSetTrimmer };
