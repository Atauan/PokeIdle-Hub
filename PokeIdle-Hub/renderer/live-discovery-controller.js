'use strict';

(() => {
  function createLiveDiscoveryController({
    state,
    getItems,
    getItemById,
    readGameChannels,
    mergeGameChannels,
    clearIgnoredGameChannels,
    importGameChannels,
    getAccounts,
    checkConnections,
    liveStatus,
    discoverLives,
    liveStates,
    nextLiveState,
    persist,
    syncTiles,
    renderControls,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  }) {
    let liveTimer = null;
    let liveChecking = false;
    let liveRefreshing = false;
    let manualDiscoveryPending = false;
    let liveGeneration = 0;
    let lastDiagnostics = null;

    function schedule() {
      clearTimeoutFn(liveTimer);
      liveTimer = null;
      liveGeneration++;
      if (state.autoLives && getItems().length && !liveChecking) {
        liveTimer = setTimeoutFn(() => check(), 0);
      }
    }

    function setAutoLives(enabled) {
      state.autoLives = enabled;
      if (state.autoLives) {
        liveStates.forEach((current, id) => liveStates.set(id, nextLiveState(null, 'unknown', current.open)));
      }
      persist();
      syncTiles();
      schedule();
    }

    function setPollingInterval(rawValue) {
      state.livePoll = Number(rawValue) || 60;
      persist();
      schedule();
    }

    async function refreshNow() {
      if (liveChecking || liveRefreshing) return;
      liveRefreshing = true;
      manualDiscoveryPending = false;
      lastDiagnostics = null;
      clearTimeoutFn(liveTimer);
      liveTimer = null;
      renderControls();
      try {
        const rows = await readGameChannels();
        if (rows != null) mergeGameChannels(rows);
      } catch (_) { /* usa os canais já conhecidos se o jogo estiver recarregando */ }
      clearIgnoredGameChannels();
      importGameChannels();
      liveRefreshing = false;
      if (!getItems().length) {
        manualDiscoveryPending = true;
        renderControls();
        return;
      }
      await check(true);
    }

    async function check(manual = false) {
      clearTimeoutFn(liveTimer);
      liveTimer = null;
      if ((!state.autoLives && !manual) || liveChecking || liveRefreshing || !getItems().length) return;
      liveChecking = true;
      const generation = liveGeneration;
      renderControls();
      try {
        const items = getItems();
        const discovery = await discoverLives({
          accounts: getAccounts(),
          channels: items.map(({ p, i }) => ({ provider: p, name: i.channel })),
          checkConnections,
          liveStatus,
          shouldContinue: () => generation === liveGeneration && (state.autoLives || manual),
        });
        lastDiagnostics = discovery.diagnostics || null;
        if (generation !== liveGeneration || (!state.autoLives && !manual)) return;
        for (const { i, p } of items) {
          if (!getItemById(i.id)) continue;
          const status = discovery.statusesByProvider[p]?.[i.channel];
          liveStates.set(i.id, nextLiveState(liveStates.get(i.id), status, liveStates.get(i.id)?.open === true));
        }
        syncTiles();
      } finally {
        liveChecking = false;
        renderControls();
        if (state.autoLives && getItems().length) {
          liveTimer = setTimeoutFn(() => check(), generation === liveGeneration ? state.livePoll * 1000 : 0);
        }
      }
    }

    return Object.freeze({
      check,
      isChecking: () => liveChecking,
      getDiagnostics: () => lastDiagnostics,
      isManualDiscoveryPending: () => manualDiscoveryPending,
      isRefreshing: () => liveRefreshing,
      refreshNow,
      schedule,
      setAutoLives,
      setPollingInterval,
    });
  }

  const api = Object.freeze({ createLiveDiscoveryController });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveDiscoveryController = api;
})();
