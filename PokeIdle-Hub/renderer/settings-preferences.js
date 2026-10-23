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
        sessionData.textContent = `${prefix}${formatBytes(summary.sessionDataBytes)} (dados totais; inclui logins e dados persistentes)`;
      }
      if (httpCache) {
        httpCache.textContent = summary.httpCacheAvailable
          ? `${formatBytes(summary.httpCacheBytes)} estimados para limpeza`
          : `Indisponível${summary.failureCount ? ` (${summary.failureCount} erro(s) de leitura)` : ''}`;
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
      target.textContent = `${count(metrics.tileCount)} tiles · ${count(metrics.playerChatViews)} players/chats anexados · ${count(metrics.economyViews)} ${metrics.economyViews === 1 ? 'view econômica' : 'views econômicas'} · fila: ${count(queue.pending)} pendentes · espera média ${count(queue.averageWaitMs)} ms, pico ${count(queue.maxWaitMs)} ms (${count(queue.started)} inícios desde a abertura)`;
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
      if (sessionData) sessionData.textContent = 'Consultando...';
      if (httpCache) httpCache.textContent = 'Consultando...';
      if (runtimeMetrics) runtimeMetrics.textContent = 'Consultando...';
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
      if (resultNode) resultNode.textContent = 'Limpando o cache HTTP das sessões...';

      cleanupRequest = (async () => {
        try {
          const result = await cleanRam();
          if (result && typeof result === 'object') {
            const cacheMessage = result.cacheBytesObservedCleared === null
              ? 'Não foi possível medir a variação do cache HTTP.'
              : `Cache HTTP: ${formatBytes(result.cacheBytesObservedCleared)} de redução observada (${formatBytes(result.cacheBytesBefore)} antes, ${formatBytes(result.cacheBytesAfter)} depois).`;
            const memoryMessage = Number.isFinite(result.memoryBeforeBytes) && Number.isFinite(result.memoryAfterBytes)
              ? ` Memória reportada pelo Hub: ${formatBytes(result.memoryBeforeBytes)} antes, ${formatBytes(result.memoryAfterBytes)} depois${result.memoryMeasurement === 'working-set-estimate' ? ' (estimativa de working set)' : ''}.`
              : ' Métrica de memória indisponível.';
            const measurementMessage = result.measurementFailures ? ` Medição incompleta em ${result.measurementFailures} leitura(s).` : '';
            const message = `${cacheMessage}${measurementMessage}${memoryMessage}`;
            if (resultNode) resultNode.textContent = result.partial
              ? `Limpeza parcial: falha em ${result.cacheFailures} sessão(ões). ${message}`
              : result.ok ? message : `Falha ao limpar o cache HTTP. ${message}`;
            const preservationMessage = 'Logins e dados persistentes foram preservados.';
            if (result.partial) toast(`Limpeza parcial do cache HTTP: ${cacheMessage} ${preservationMessage}`);
            else if (result.ok) toast(`${cacheMessage} ${preservationMessage}`);
            else toast(`Falha ao limpar o cache HTTP. ${cacheMessage} ${preservationMessage}`);
          } else {
            if (resultNode) resultNode.textContent = 'Falha ao limpar o cache HTTP.';
            toast('Falha ao limpar o cache HTTP.');
          }
          await refreshMaintenanceSummary({ force: true });
          return result;
        } catch (_) {
          if (resultNode) resultNode.textContent = 'Falha ao limpar o cache HTTP.';
          toast('Falha ao limpar o cache HTTP.');
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
        if (resultNode) resultNode.textContent = 'A liberação do working set está disponível somente no Windows.';
        return { ok: false, unavailable: true };
      }
      if (button) button.disabled = true;
      if (resultNode) resultNode.textContent = 'Solicitando ao Windows a redução do working set dos processos do Hub...';

      workingSetRequest = (async () => {
        try {
          const result = await trimHubWorkingSet();
          if (result?.unavailable) {
            if (resultNode) resultNode.textContent = 'Não foi possível identificar processos ativos do Hub para reduzir.';
            toast('Não foi possível identificar processos do Hub para liberar RAM.');
          } else if (result?.ok || result?.partial) {
            const reduced = Number.isFinite(result.observedBytesReduced)
              ? `${formatBytes(result.observedBytesReduced)} de redução observada`
              : 'a variação imediata não pôde ser medida';
            const counts = ` ${result.trimmed} de ${result.attempted} processos atendidos`;
            const access = result.accessDenied ? `; acesso negado em ${result.accessDenied}` : '';
            const rebound = ' A memória pode voltar a ser residente durante as lives.';
            const message = result.partial
              ? `Redução parcial: ${reduced}.${counts}${access}.${rebound}`
              : `Redução concluída: ${reduced}.${counts}.${rebound}`;
            if (resultNode) resultNode.textContent = message;
            toast(message);
          } else {
            const count = Number.isFinite(result?.attempted) ? result.attempted : 0;
            const access = result?.accessDenied ? ` Acesso negado em ${result.accessDenied} processo(s).` : '';
            const message = `O Windows não conseguiu reduzir o working set do Hub (${count} processo(s) tentados).${access}`;
            if (resultNode) resultNode.textContent = message;
            toast(message);
          }
          return result;
        } catch (_) {
          if (resultNode) resultNode.textContent = 'Falha ao solicitar a redução do working set do Hub.';
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
      const warning = 'ATENÇÃO: Isso apagará permanentemente todos os dados locais do PokeIdle Hub (contas cadastradas, logins de Twitch/Kick, configurações, regras de alerta e dados salvos) e reiniciará o aplicativo do zero. Esta ação não pode ser desfeita.\n\nDeseja realmente apagar todos os dados e reiniciar?';
      if (typeof confirm !== 'function' || !confirm(warning)) return;
      if (button) button.disabled = true;
      if (resultNode) resultNode.textContent = 'Apagando dados locais e reiniciando o PokeIdle Hub...';
      try {
        const result = typeof resetAppData === 'function' ? await resetAppData() : { ok: false };
        if (result?.ok) {
          toast('Dados locais apagados. Reiniciando o PokeIdle Hub...');
        } else {
          if (resultNode) resultNode.textContent = 'Falha ao apagar dados locais.';
          toast('Não foi possível apagar os dados locais do PokeIdle Hub.');
          if (button) button.disabled = false;
        }
      } catch (_) {
        if (resultNode) resultNode.textContent = 'Falha ao apagar dados locais.';
        toast('Não foi possível apagar os dados locais do PokeIdle Hub.');
        if (button) button.disabled = false;
      }
    }

    function setup() {
      query('#cfg-fps-foreground')?.addEventListener('change', (event) => {
        state.fpsForeground = Number(event.target.value) || 0;
        persist();
        applyFpsLimits();
        toast(`FPS da conta em foco: ${state.fpsForeground ? `${state.fpsForeground} FPS` : 'Sem limite'}`);
      });

      query('#cfg-fps-background')?.addEventListener('change', (event) => {
        state.fpsBackground = Number(event.target.value) || 0;
        persist();
        applyFpsLimits();
        toast(`FPS de contas em segundo plano: ${state.fpsBackground ? `${state.fpsBackground} FPS` : 'Sem limite'}`);
      });

      query('#cfg-suspend-video')?.addEventListener('change', (event) => {
        state.suspendBgVideos = event.target.checked;
        persist();
        query('#panel-lives')?.classList.toggle('suspend-bg', state.suspendBgVideos !== false);
        toast(state.suspendBgVideos ? 'Suspensão de vídeo ativada.' : 'Suspensão de vídeo desativada.');
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
