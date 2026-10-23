'use strict';

(() => {
  function createLiveToolbarControls({
    query,
    queryAll,
    createElement,
    state,
    persist,
    layout,
    addChannels,
    tiles,
    applyChatMode,
    applyQuality,
    reloadWebview,
    getItems,
    liveStates,
    getDiscoveryState,
    getEconomyViewCount,
    getTileCount,
    onAutoLivesChanged,
    onPollingIntervalChanged,
    onUniversalLimitChanged,
    onCheckLives,
  }) {
    function setTarget(provider) {
      state.target = provider;
      queryAll('#target button').forEach(button => {
        button.classList.toggle('on', button.dataset.target === provider);
      });
    }

    function renderStatus() {
      const items = getItems();
      const discovery = getDiscoveryState();
      query('#auto-lives').checked = state.autoLives;
      query('#live-poll').value = String(state.livePoll);
      query('#check-lives').disabled = discovery.checking || discovery.refreshing;
      const unknown = items.filter(({ i }) => liveStates.get(i.id)?.status === 'unknown').length;
      const count = items.filter(entry => liveStates.get(entry.i.id)?.open).length;
      const diagnostics = discovery.diagnostics || {};
      const providerLabels = { twitch: 'Twitch', kick: 'Kick' };
      const providerNames = providers => providers
        .map(provider => providerLabels[provider] ? `na ${providerLabels[provider]}` : null)
        .filter(Boolean)
        .join(' e ');
      const failureReason = providers => {
        const reasons = [...new Set(providers.map(provider => diagnostics.failureReasons?.[provider]).filter(Boolean))];
        if (!reasons.length) return '';
        const labels = {
          NETWORK: 'falha de rede',
          TIMEOUT: 'tempo esgotado',
          GRAPHQL: 'resposta GraphQL rejeitada',
          CLIENT_ID: 'identificador público indisponível',
          INVALID_RESPONSE: 'resposta inválida',
          UNKNOWN: 'causa não identificada',
        };
        const label = labels[reasons[0]] || (/^HTTP_\d{3}$/.test(reasons[0]) ? reasons[0].replace('_', ' ') : 'causa não identificada');
        return ` (${label})`;
      };
      const badgeLives = query('#badge-lives');
      if (badgeLives) {
        badgeLives.textContent = String(count);
        badgeLives.hidden = count === 0;
      }
      const diagnosticSummary = diagnostics.disconnectedProviders?.length
        ? ` · Faça login ${providerNames(diagnostics.disconnectedProviders)}`
        : diagnostics.unavailableProviders?.length
          ? ` · Vínculo indisponível ${providerNames(diagnostics.unavailableProviders)}`
          : diagnostics.failedProviders?.length
            ? ` · Consulta falhou ${providerNames(diagnostics.failedProviders)}${failureReason(diagnostics.failedProviders)}`
            : '';
      query('#live-summary').textContent = discovery.checking || discovery.refreshing ? 'Verificando canais…'
        : discovery.manualDiscoveryPending ? 'Abra o Pokeidle para carregar os canais'
          : `${state.autoLives ? '' : 'Automático desligado · '}${count} abertas${unknown ? ` · ${unknown} sem confirmação` : ''}${diagnosticSummary}`;
      const kickLimit = query('#universal-limit-kick');
      if (kickLimit && state.universalLimits) kickLimit.value = String(state.universalLimits.kick ?? 2);
      const twitchLimit = query('#universal-limit-twitch');
      if (twitchLimit && state.universalLimits) twitchLimit.value = String(state.universalLimits.twitch ?? 3);
      query('#empty-title').textContent = items.length ? 'Nenhuma live aberta no momento'
        : 'Entre no Pokeidle para carregar os canais';
      query('#empty-detail').textContent = !items.length
        ? 'Os canais oficiais são reconhecidos pelo jogo. Use Verificar lives para abrir os que estiverem online.'
        : unknown && diagnostics.disconnectedProviders?.length
          ? `Faça login ${providerNames(diagnostics.disconnectedProviders)} pelo menu Conectar Lives da conta para verificar e exibir esses canais.`
          : unknown && diagnostics.unavailableProviders?.length
            ? `Não foi possível conferir o vínculo ${providerNames(diagnostics.unavailableProviders)}. Abra Conectar Lives na conta e tente novamente.`
            : unknown && diagnostics.failedProviders?.length
              ? `A consulta ${providerNames(diagnostics.failedProviders)} falhou${failureReason(diagnostics.failedProviders)}. Tente novamente; o diagnóstico não inclui nomes de canais nem dados da sessão.`
              : unknown ? 'Não foi possível verificar alguns canais. Use Verificar lives para tentar novamente.'
          : state.autoLives ? 'As lives abrirão automaticamente quando os canais estiverem online.'
            : 'Clique em Verificar lives para trazer os canais online à tela.';
      if (getEconomyViewCount() && !getTileCount()) {
        query('#empty-title').textContent = 'Twitch em modo econômico';
        query('#empty-detail').textContent = 'Os canais usam o chat compartilhado. Acompanhe a conexão acima e os bônus na aba Pokeidle.';
      }
    }

    function bind() {
      query('#auto-lives').addEventListener('change', event => onAutoLivesChanged(event.target.checked));
      query('#live-poll').addEventListener('change', event => onPollingIntervalChanged(event.target.value));
      query('#universal-limit-kick')?.addEventListener('change', event => onUniversalLimitChanged('kick', event.target.value));
      query('#universal-limit-twitch')?.addEventListener('change', event => onUniversalLimitChanged('twitch', event.target.value));
      query('#check-lives').addEventListener('click', onCheckLives);

      const input = query('#channel-input');
      const add = () => {
        addChannels(input.value);
        input.value = '';
      };
      query('#add-btn').addEventListener('click', add);
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') add();
      });

      const columns = query('#columns');
      columns.append(createElement('option', { value: '0', text: 'Auto' }));
      for (let count = 1; count <= 8; count += 1) {
        columns.append(createElement('option', { value: String(count), text: String(count) }));
      }
      columns.value = String(state.columns);
      columns.addEventListener('change', () => {
        state.columns = Number(columns.value) || 0;
        persist();
        layout();
      });

      query('#reset-layout').addEventListener('click', () => {
        state.frames = {};
        persist();
        layout();
      });

      const chatButton = query('#chat-toggle');
      const paintChat = () => chatButton.classList.toggle('on', state.showChat);
      paintChat();
      chatButton.addEventListener('click', () => {
        state.showChat = !state.showChat;
        persist();
        paintChat();
        layout();
        tiles.forEach((_tile, id) => applyChatMode(id));
      });

      const videoButton = query('#toggle-video-view');
      const paintHideVideos = () => {
        if (videoButton) {
          videoButton.innerHTML = state.hideVideos
            ? '<span class="icon-svg icon-video-show"></span> Mostrar vídeos'
            : '<span class="icon-svg icon-video-hide"></span> Ocultar vídeos';
          videoButton.title = state.hideVideos
            ? 'Mostra a imagem das lives novamente; o áudio e a conexão já continuam ativos'
            : 'Oculta a imagem das lives para reduzir o uso de recursos; mantém o áudio e a conexão';
          videoButton.classList.toggle('active', !!state.hideVideos);
        }
        query('#grid').classList.toggle('hide-videos', !!state.hideVideos);
      };
      paintHideVideos();
      videoButton?.addEventListener('click', () => {
        state.hideVideos = !state.hideVideos;
        persist();
        paintHideVideos();
        layout();
      });

      const quality = query('#quality');
      quality.value = String(state.quality);
      quality.addEventListener('change', () => {
        state.quality = Number(quality.value) || 0;
        persist();
        tiles.forEach(tile => {
          if (!state.quality && /player\.kick\.com/.test(tile.player.__pfSrc)) reloadWebview(tile.player);
          else applyQuality(tile.player);
        });
      });

      queryAll('#target button').forEach(button => {
        button.addEventListener('click', () => setTarget(button.dataset.target));
      });
    }

    return Object.freeze({ bind, setTarget, renderStatus });
  }

  const api = Object.freeze({ createLiveToolbarControls });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveToolbarControls = api;
})();
