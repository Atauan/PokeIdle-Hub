'use strict';

(() => {
  function createLiveTileView({
    getPlatform,
    getCurrentAccount,
    accountPartition,
    makeWebview,
    el,
    tiles,
    isFavorite,
    toggleFavorite,
    toggleMute,
    follow,
    reload,
    openExternal,
    removeItem,
    startDrag,
    bringFront,
    applyMute,
    applyQuality,
    applyChatMode,
    expandChat,
    checkTwitchChat,
    onKickPoints = () => {},
  }) {
    function createTile(provider, item, account) {
      const platform = getPlatform(provider);
      const acc = account || getCurrentAccount() || { id: 'main', name: 'Conta 1' };
      const key = `${acc.id}:${item.id}`;
      const tile = { stalls: 0, rect: null, sharedTwitch: provider === 'twitch', chatFallbackTimer: null, key, acc, item, p: provider };

      tile.muteBtn = el('button', { onclick: () => toggleMute(key) });

      const favorite = isFavorite(item.channel, acc.id, provider);
      tile.favBtn = el('button', {
        class: `tile-fav-btn${favorite ? ' active' : ''}`,
        title: favorite ? 'Remover dos favoritos desta conta e plataforma' : 'Favoritar nesta conta e plataforma (fixa no topo)',
        'aria-label': 'Favoritar canal',
        onclick: event => {
          event.stopPropagation();
          toggleFavorite(item.channel, acc.id, provider);
        },
      }, el('span', { class: `icon-svg ${favorite ? 'icon-star' : 'icon-star-outline'}` }));

      tile.followBtn = el('button', {
        class: 'tile-follow-btn',
        title: `Seguir ${item.channel} com a conta ${acc.name}`,
        'aria-label': 'Seguir canal',
        text: '+ Seguir',
        onclick: async event => {
          event.stopPropagation();
          await follow(tile, tile.followBtn);
        },
      });

      const header = el('div', { class: 'hdr', 'data-drag': 'move', title: 'Arraste para mover o bloco' },
        tile.favBtn,
        el('span', { class: 'dot', style: `background:${platform.color}` }),
        el('span', { class: 'name', text: item.channel }),
        el('span', { class: 'sp' }),
        tile.followBtn,
        tile.muteBtn,
        el('button', { title: 'Recarregar', 'aria-label': 'Recarregar', onclick: () => reload(tile) },
          el('span', { class: 'icon-svg icon-reload' })),
        el('button', { title: 'Abrir no Edge', 'aria-label': 'Abrir no Edge', onclick: () => openExternal(`https://${platform.host}/${item.channel}`) },
          el('span', { class: 'icon-svg icon-edge' })),
        el('button', { title: 'Remover canal desta conta', 'aria-label': 'Remover canal desta conta', onclick: () => removeItem(item.id, acc.id, provider) },
          el('span', { class: 'icon-svg icon-trash' })),
      );

      const partition = accountPartition(acc);
      tile.player = makeWebview(platform.player(item.channel), {
        partition,
        muted: item.muted,
        onReady: webview => { applyMute(key); applyQuality(webview); applyChatMode(key); },
      });
      tile.playerBox = el('div', { class: `player${tile.sharedTwitch ? ' shared-twitch' : ''}` }, tile.player, tile.player.__skeleton);
      if (tile.sharedTwitch) {
        tile.chat = tile.player;
        tile.chatBox = tile.playerBox;
        tile.player.addEventListener('ipc-message', event => {
          if (!tile.sharedTwitch) return;
          if (event.channel === 'chat-click') expandChat(key);
          if (event.channel === 'twitch-chat-ready') checkTwitchChat(key, event.args[0] === true);
        });
      } else {
        tile.chat = makeWebview(platform.chat(item.channel), {
          partition,
          muted: true,
          skeleton: 'chat',
          onReady: () => applyChatMode(key),
        });
        tile.chatBox = el('div', { class: 'chat' }, tile.chat, tile.chat.__skeleton);
        tile.chat.addEventListener('ipc-message', event => {
          if (event.channel === 'chat-click') expandChat(key);
        });
      }

      if (provider === 'kick') {
        const receivePoints = event => {
          if (event.channel !== 'kick-points') return;
          const report = event.args?.[0];
          if (report?.channel !== item.channel.toLowerCase() ||
              !(report.points === null || Number.isSafeInteger(report.points) && report.points >= 0)) return;
          onKickPoints({ accountId: acc.id, channel: item.channel, points: report.points });
        };
        tile.player.addEventListener('ipc-message', receivePoints);
        if (tile.chat !== tile.player) tile.chat.addEventListener('ipc-message', receivePoints);
      }

      tile.root = el('div', { class: 'tile' },
        header,
        tile.playerBox,
        tile.sharedTwitch ? null : tile.chatBox,
        el('div', { class: 'grip grip-r', 'data-drag': 'right', title: 'Arraste para mudar a largura' }),
        el('div', { class: 'grip grip-b', 'data-drag': 'bottom', title: 'Arraste para mudar a altura' }),
        el('div', { class: 'grip grip-c', 'data-drag': 'corner', title: 'Arraste para mudar largura e altura', text: '⤡' }),
      );
      tile.root.addEventListener('pointerdown', event => startDrag(event, key));
      tile.root.addEventListener('pointerdown', () => bringFront(key), true);
      tiles.set(key, tile);
      applyMute(key);
      return tile;
    }

    return Object.freeze({ createTile });
  }

  const api = { createLiveTileView };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveTileView = api;
})();
