'use strict';

(function expose(root, api) {
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PokeIdleLiveRuntime = api;
})(typeof globalThis === 'object' ? globalThis : this, {
  createLoadQueue,
  reconcileMap,
});

function createLoadQueue({
  setTimeout: schedule = setTimeout,
  clearTimeout: cancelTimer = clearTimeout,
  now = () => Date.now(),
  intervalMs = 1500,
} = {}) {
  let queue = [];
  let timer = null;
  let lastSuccessfulLoad = null;
  let stopped = false;
  let started = 0;
  let totalWaitMs = 0;
  let maxWaitMs = 0;

  function pump() {
    if (stopped || timer !== null || !queue.length) return;
    const delay = lastSuccessfulLoad === null
      ? 0
      : Math.max(0, intervalMs - (now() - lastSuccessfulLoad));
    timer = schedule(() => {
      timer = null;
      if (stopped) return;
      const task = queue.shift();
      if (task && !task.cancelled) {
        try {
          if (task.run() === true) {
            const currentTime = now();
            const waitMs = Math.max(0, currentTime - task.enqueuedAt);
            started += 1;
            totalWaitMs += waitMs;
            maxWaitMs = Math.max(maxWaitMs, waitMs);
            lastSuccessfulLoad = currentTime;
          }
        } catch (_) {
          // A removed page may invalidate its queued load before the task is run.
        }
      }
      pump();
    }, delay);
  }

  function enqueue(run) {
    if (stopped || typeof run !== 'function') return () => {};
    const task = { run, cancelled: false, enqueuedAt: now() };
    queue.push(task);
    pump();
    return () => {
      if (task.cancelled) return;
      task.cancelled = true;
      queue = queue.filter(queued => queued !== task);
      if (!queue.length && timer !== null) {
        cancelTimer(timer);
        timer = null;
      }
      pump();
    };
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    queue = [];
    if (timer !== null) cancelTimer(timer);
    timer = null;
  }

  function getStats() {
    return Object.freeze({
      pending: queue.length,
      started,
      averageWaitMs: started ? totalWaitMs / started : 0,
      maxWaitMs,
    });
  }

  return Object.freeze({ enqueue, getStats, stop });
}

function reconcileMap(current, desired, create, dispose = () => {}) {
  for (const [key, value] of current) {
    if (desired.has(key)) continue;
    dispose(value, key);
    current.delete(key);
  }

  for (const [key, descriptor] of desired) {
    if (!current.has(key)) current.set(key, create(descriptor, key));
  }

  return current;
}
