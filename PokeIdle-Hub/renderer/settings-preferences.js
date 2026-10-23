'use strict';

(() => {
  function formatBytes(value) {
    if (!Number.isFinite(value) || value < 0) return 'Indisponível';
    if (value < 1024) return `${Math.round(value)} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let amount = value;
    let unit = -1;
    do {
      amount /= 1024;
      unit += 1;
    } while (amount >= 1024 && unit < units.length - 1);
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(amount)} ${units[unit]}`;
  }

  function createSettingsPreferences({ state, query, persist, applyFpsLimits, toast, cleanRam, trimHubWorkingSet, platform, getMaintenanceSummary, getLiveRuntimeMetrics, restartApp, resetAppData, confirm }) {
    let summaryLoaded = false;
    let summaryRequest = null;
    let cleanupRequest = null;
    let workingSetRequest = null;

    function renderMaintenanceSummary(summary) {
      const sessionData = query('#cfg-session-data-size');
      const httpCache = query('#cfg-http-cache-size');
      if (!summary || summary.ok !== true) {
        if (sessionData) sessionData.textContent = 'Indisponível';
        if (httpCache) httpCache.textContent = 'Indisponível';
        return;
      }
      if (sessionData) {
        const prefix = summary.sessionDataPartial ? 'Pelo menos ' : '';
        sessionData.textContent = `${prefix}${formatBytes(summary.sessionDataBytes)} (inclui logins e configurações)`;
      }
      if (httpCache) {
        httpCache.textContent = summary.httpCacheAvailable
          ? `${formatBytes(summary.httpCacheBytes)} podem ser liberados`
          : 'Não foi possível consultar';
      }
    }

    function renderLiveRuntimeMetrics(metrics) {
      const target = query('#cfg-live-runtime-metrics');
      if (!target) return;
      const queue = metrics?.queue;
      const values = [metrics?.tileCount, metrics?.playerChatViews, metrics?.economyViews,
        queue?.pending, queue?.started, queue?.averageWaitMs, queue?.maxWaitMs];
      if (!values.every(value => Number.isFinite(value) && value >= 0)) {
        target.textContent = 'Indisponível';
        return;
      }
      const count = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
      const seconds = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1000);
      const economical = metrics.economyViews === 1 ? 'live em modo econômico' : 'lives em modo econômico';
      target.textContent = `${count(metrics.tileCount)} lives abertas · ${count(metrics.playerChatViews)} vídeos ou chats ativos · ${count(metrics.economyViews)} ${economical} · ${count(queue.pending)} aguardando abertura · espera: ${seconds(queue.averageWaitMs)} s em média, até ${seconds(queue.maxWaitMs)} s (${count(queue.started)} aberturas desde que o Hub iniciou)`;
    }

    async function refreshMaintenanceSummary({ force = false } = {}) {
      if (!force && summaryLoaded) return;
      if (summaryRequest) {
        if (!force) return summaryRequest;
        await summaryRequest;
        if (summaryRequest) return summaryRequest;
      }
      const button = query('#cfg-refresh-cache-summary');
      const sessionData = query('#cfg-session-data-size');
      const httpCache = query('#cfg-http-cache-size');
      const runtimeMetrics = query('#cfg-live-runtime-metrics');
      if (button) button.disabled = true;
      if (sessionData) sessionData.textContent = 'Atualizando...';
      if (httpCache) httpCache.textContent = 'Atualizando...';
      if (runtimeMetrics) runtimeMetrics.textContent = 'Atualizando...';
      summaryRequest = (async () => {
        try {
          const [summary, liveMetrics] = await Promise.all([
            Promise.resolve().then(() => getMaintenanceSummary()).catch(() => null),
            Promise.resolve().then(() => getLiveRuntimeMetrics?.()).catch(() => null),
          ]);
          renderMaintenanceSummary(summary);
          renderLiveRuntimeMetrics(liveMetrics);
          summaryLoaded = summary?.ok === true;
          return summary;
        } catch (_) {
          renderMaintenanceSummary(null);
          renderLiveRuntimeMetrics(null);
          summaryLoaded = false;
          return { ok: false };
        } finally {
          if (button) button.disabled = false;
          summaryRequest = null;
        }
      })();
      return summaryRequest;
    }

    function render() {
      const foreground = query('#cfg-fps-foreground');
      const background = query('#cfg-fps-background');
      const suspendVideos = query('#cfg-suspend-video');
      if (foreground) foreground.value = String(state.fpsForeground ?? 30);
      if (background) background.value = String(state.fpsBackground ?? 15);
      if (suspendVideos) suspendVideos.checked = state.suspendBgVideos !== false;
      if (!summaryLoaded) void refreshMaintenanceSummary();
    }

    async function cleanNow() {
      if (cleanupRequest) return { ok: false, busy: true };
      const buttons = [query('#cfg-clean-ram-btn'), query('#btn-clean-ram')].filter(Boolean);
      const resultNode = query('#cfg-cleanup-result');
      for (const button of buttons) button.disabled = true;
      if (resultNode) resultNode.textContent = 'Apagando arquivos temporários...';

      cleanupRequest = (async () => {
        try {
          const result = await cleanRam();
          if (result && typeof result === 'object') {
            const cacheMessage = result.cacheBytesObservedCleared === null
              ? 'Não foi possível medir quanto espaço foi liberado.'
              : `Espaço liberado: ${formatBytes(result.cacheBytesObservedCleared)} (antes: ${formatBytes(result.cacheBytesBefore)}; depois: ${formatBytes(result.cacheBytesAfter)}).`;
            const memoryMessage = Number.isFinite(result.memoryBeforeBytes) && Number.isFinite(result.memoryAfterBytes)
              ? ` Uso de memória do Hub: ${formatBytes(result.memoryBeforeBytes)} antes e ${formatBytes(result.memoryAfterBytes)} depois.`
              : ' O uso de memória não pôde ser medido.';
            const measurementMessage = result.measurementFailures ? ' Algumas medidas não puderam ser feitas.' : '';
            const message = `${cacheMessage}${measurementMessage}${memoryMessage}`;
            if (resultNode) resultNode.textContent = result.partial
              ? `Alguns arquivos temporários não puderam ser apagados. ${message} Logins e configurações foram mantidos.`
              : result.ok ? `${message} Logins e configurações foram mantidos.` : `Não foi possível apagar todos os arquivos temporários. ${message}`;
            const preservationMessage = 'Logins e configurações foram mantidos.';
            if (result.partial) toast(`Limpeza incompleta. ${cacheMessage} ${preservationMessage}`);
            else if (result.ok) toast(`${cacheMessage} ${preservationMessage}`);
            else toast(`Não foi possível apagar todos os arquivos temporários. ${cacheMessage} ${preservationMessage}`);
          } else {
            if (resultNode) resultNode.textContent = 'Não foi possível apagar os arquivos temporários.';
            toast('Não foi possível apagar os arquivos temporários.');
          }
          await refreshMaintenanceSummary({ force: true });
          return result;
        } catch (_) {
          if (resultNode) resultNode.textContent = 'Não foi possível apagar os arquivos temporários.';
          toast('Não foi possível apagar os arquivos temporários.');
          await refreshMaintenanceSummary({ force: true });
          return { ok: false };
        } finally {
          for (const button of buttons) button.disabled = false;
          cleanupRequest = null;
        }
      })();
      return cleanupRequest;
    }

    async function trimWorkingSetNow() {
      if (workingSetRequest) return { ok: false, busy: true };
      const button = query('#cfg-trim-working-set-btn');
      const resultNode = query('#cfg-working-set-result');
      if (platform !== 'win32') {
        if (resultNode) resultNode.textContent = 'A liberação de memória está disponível somente no Windows.';
        return { ok: false, unavailable: true };
      }
      if (button) button.disabled = true;
      if (resultNode) resultNode.textContent = 'Pedindo ao Windows para liberar memória usada pelo Hub...';

      workingSetRequest = (async () => {
        try {
          const result = await trimHubWorkingSet();
          if (result?.unavailable) {
            if (resultNode) resultNode.textContent = 'Não há partes ativas do Hub para liberar memória agora.';
            toast('Não foi possível liberar memória do Hub agora.');
          } else if (result?.ok || result?.partial) {
            const reduced = Number.isFinite(result.observedBytesReduced)
              ? `Memória liberada agora: ${formatBytes(result.observedBytesReduced)}.`
              : 'Não foi possível medir a mudança neste momento.';
            const rebound = ' O Hub pode voltar a usar parte dessa memória enquanto estiver aberto.';
            const message = result.partial
              ? `${reduced} Algumas partes do Hub não puderam ser ajustadas.${rebound}`
              : `${reduced}${rebound}`;
            if (resultNode) resultNode.textContent = message;
            toast(message);
          } else {
            const message = 'O Windows não conseguiu liberar memória do Hub agora. Tente novamente mais tarde.';
            if (resultNode) resultNode.textContent = message;
            toast(message);
          }
          return result;
        } catch (_) {
          if (resultNode) resultNode.textContent = 'Não foi possível pedir ao Windows para liberar memória do Hub.';
          toast('Falha ao liberar RAM do Hub.');
          return { ok: false };
        } finally {
          if (button) button.disabled = false;
          workingSetRequest = null;
        }
      })();
      return workingSetRequest;
    }

    async function restart() {
      const button = query('#cfg-restart-app-btn');
      if (typeof confirm !== 'function' || !confirm('O PokeIdle Hub será fechado e aberto novamente. As lives, chats e janelas do jogo serão interrompidos e carregados de novo. Logins e dados salvos serão mantidos. Deseja reiniciar agora?')) return;
      if (button) button.disabled = true;
      try {
        const result = await restartApp();
        if (result?.ok) toast('Reiniciando o PokeIdle Hub...');
        else toast('Não foi possível reiniciar o PokeIdle Hub.');
      } catch (_) {
        toast('Não foi possível reiniciar o PokeIdle Hub.');
      } finally {
        if (button) button.disabled = false;
      }
    }

    async function resetData() {
      const button = query('#cfg-reset-app-data-btn');
      const resultNode = query('#cfg-reset-result');
      const warning = 'Isso apagará as contas, os logins de Twitch e Kick, as preferências, os alertas e o histórico salvos neste computador. O Hub será reiniciado como novo e você precisará entrar nas contas novamente. Esta ação não pode ser desfeita.\n\nDeseja apagar tudo e reiniciar?';
      if (typeof confirm !== 'function' || !confirm(warning)) return;
      if (button) button.disabled = true;
      if (resultNode) resultNode.textContent = 'Apagando os dados e reiniciando o Hub...';
      try {
        const result = typeof resetAppData === 'function' ? await resetAppData() : { ok: false };
        if (result?.ok) {
          toast('Dados locais apagados. Reiniciando o PokeIdle Hub...');
        } else {
          if (resultNode) resultNode.textContent = 'Não foi possível apagar tudo.';
          toast('Não foi possível apagar os dados locais do PokeIdle Hub.');
          if (button) button.disabled = false;
        }
      } catch (_) {
        if (resultNode) resultNode.textContent = 'Não foi possível apagar tudo.';
        toast('Não foi possível apagar os dados locais do PokeIdle Hub.');
        if (button) button.disabled = false;
      }
    }

    function setup() {
      query('#cfg-fps-foreground')?.addEventListener('change', (event) => {
        state.fpsForeground = Number(event.target.value) || 0;
        persist();
        applyFpsLimits();
        toast(`FPS do jogo na tela: ${state.fpsForeground || 'padrão do monitor'}`);
      });

      query('#cfg-fps-background')?.addEventListener('change', (event) => {
        state.fpsBackground = Number(event.target.value) || 0;
        persist();
        applyFpsLimits();
        toast(`FPS dos jogos em outras abas: ${state.fpsBackground || 'padrão do monitor'}`);
      });

      query('#cfg-suspend-video')?.addEventListener('change', (event) => {
        state.suspendBgVideos = event.target.checked;
        persist();
        query('#panel-lives')?.classList.toggle('suspend-bg', state.suspendBgVideos !== false);
        toast(state.suspendBgVideos ? 'A imagem das lives será pausada fora da aba Lives.' : 'A imagem das lives continuará sendo exibida fora da aba Lives.');
      });

      query('#cfg-clean-ram-btn')?.addEventListener('click', () => { void cleanNow(); });
      query('#btn-clean-ram')?.addEventListener('click', () => { void cleanNow(); });
      const trimWorkingSetButton = query('#cfg-trim-working-set-btn');
      if (trimWorkingSetButton) {
        trimWorkingSetButton.disabled = platform !== 'win32';
        trimWorkingSetButton.addEventListener('click', () => { void trimWorkingSetNow(); });
      }
      query('#cfg-refresh-cache-summary')?.addEventListener('click', () => { void refreshMaintenanceSummary({ force: true }); });
      query('#cfg-restart-app-btn')?.addEventListener('click', () => restart());
      query('#cfg-reset-app-data-btn')?.addEventListener('click', () => resetData());
      render();
    }

    return Object.freeze({ render, setup, cleanNow, trimWorkingSetNow, refreshMaintenanceSummary, restart, resetData });
  }

  const api = { createSettingsPreferences };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleSettingsPreferences = api;
})();
