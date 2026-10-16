'use strict';

// Compartilhado pelo preload do Electron e pelo WKUserScript da versão Swift.
// Lê apenas os canais oficiais; não envia comandos, não abre modais e não exporta dados da conta.
function watchGameChannels() {
  if (window.top !== window || !/(^|\.)pokeidle\.io$/.test(location.hostname) || window.__pfWatchingGameChannels) return;
  window.__pfWatchingGameChannels = true;
  const catalog = new Map();
  let lastSent = '';
  const add = (platform, raw) => {
    if (typeof raw !== 'string' || catalog.size >= 200) return;
    const channel = raw.trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,40}$/.test(channel)) return;
    catalog.set(`${platform}:${channel}`, { platform, channel });
  };
  const publish = () => {
    if (!catalog.size) return;
    const channels = [...catalog.values()].sort((a, b) => `${a.platform}:${a.channel}`.localeCompare(`${b.platform}:${b.channel}`));
    const signature = JSON.stringify(channels);
    if (signature === lastSent) return;
    lastSent = signature;
    const native = window.webkit?.messageHandlers?.pfGameChannels;
    if (native) native.postMessage(channels);
    else window.postMessage({ __pfGameChannels: channels }, location.origin);
  };

  const getLogin = (row) => {
    if (typeof row === 'string') return row;
    if (!row || typeof row !== 'object') return null;
    return row.login || row.slug || row.channel || row.canal || row.user || row.username || row.name || null;
  };

  const parseList = (platform, list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const name = getLogin(item);
      if (name) add(platform, name);
    }
  };

  const readMessage = (event) => {
    if (typeof event.data !== 'string' || !/"(?:twitch|kick)"/i.test(event.data)) return;
    try {
      const message = JSON.parse(event.data);
      const states = [message, message?.estado, message?.data, message?.payload].filter(Boolean);
      for (const st of states) {
        if (typeof st !== 'object') continue;
        if (st.twitch) {
          parseList('twitch', st.twitch.oficiais);
          parseList('twitch', st.twitch.lives);
          parseList('twitch', st.twitch.canais);
          parseList('twitch', st.twitch.channels);
          if (Array.isArray(st.twitch)) parseList('twitch', st.twitch);
        }
        if (st.kick) {
          parseList('kick', st.kick.oficiais);
          parseList('kick', st.kick.lives);
          parseList('kick', st.kick.canais);
          parseList('kick', st.kick.channels);
          if (Array.isArray(st.kick)) parseList('kick', st.kick);
        }
      }
      publish();
    } catch (_) { /* mensagem diferente/incompleta: espera a próxima */ }
  };

  if (window.WebSocket) {
    window.WebSocket = new Proxy(window.WebSocket, {
      construct(target, args, newTarget) {
        const socket = Reflect.construct(target, args, newTarget);
        try {
          const url = new URL(String(args[0]), location.href);
          if (url.hostname === location.hostname && ['ws:', 'wss:'].includes(url.protocol)) {
            socket.addEventListener('message', readMessage);
          }
        } catch (_) { /* não interfere na conexão do jogo */ }
        return socket;
      },
    });
  }

  // Reserva para mudanças no transporte ou painel montado/aberto.
  // Varre links de canais oficiais no DOM (.tw-canais, .tw-canal, .kk-canais, .kk-canal e links externos).
  const readPanels = () => {
    const selectors = [
      '.tw-canal[href]',
      '.kk-canal[href]',
      '.tw-canais a[href]',
      '.kk-canais a[href]',
      '#tw-corpo a[href]',
      '#kk-corpo a[href]',
      'a[href*="twitch.tv/"]',
      'a[href*="kick.com/"]',
    ];
    for (const link of document.querySelectorAll(selectors.join(', '))) {
      try {
        const rawHref = link.getAttribute('href');
        if (rawHref) {
          const url = new URL(rawHref, location.href);
          if (url.protocol === 'https:' && !url.username && !url.password && !url.port) {
            const platform = ['twitch.tv', 'www.twitch.tv'].includes(url.hostname) ? 'twitch'
              : ['kick.com', 'www.kick.com'].includes(url.hostname) ? 'kick' : null;
            const parts = url.pathname.split('/').filter(Boolean);
            if (platform && parts.length === 1) {
              const slug = parts[0].toLowerCase();
              if (!['directory', 'p', 'downloads', 'jobs', 'turbo', 'prime', 'popout'].includes(slug)) {
                add(platform, slug);
              }
            }
          }
        }
        const nomeSpan = link.querySelector('.tw-canal-nome, .kk-canal-nome');
        if (nomeSpan?.textContent?.trim()) {
          const p = link.classList.contains('tw-canal') || link.closest('.tw-canais') ? 'twitch'
            : (link.classList.contains('kk-canal') || link.closest('.kk-canais') ? 'kick' : null);
          if (p) add(p, nomeSpan.textContent.trim());
        }
      } catch (_) { /* ignora links inválidos */ }
    }
    publish();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', readPanels, { once: true });
  else readPanels();
  window.__pfReadGameChannels = () => {
    readPanels();
    return [...catalog.values()].map(channel => ({ ...channel }));
  };
  setInterval(readPanels, 3000);
}

if (typeof process !== 'undefined' && process.versions?.electron && typeof require === 'function') {
  if (window.top === window && /(^|\.)pokeidle\.io$/.test(location.hostname)) {
    const { contextBridge, ipcRenderer, webFrame } = require('electron');
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.origin !== location.origin || !Array.isArray(event.data?.__pfGameChannels)) return;
      ipcRenderer.sendToHost('game-channels', event.data.__pfGameChannels.slice(0, 200));
    });
    try { contextBridge.executeInMainWorld({ func: watchGameChannels }); }
    catch (_) { webFrame.executeJavaScript(`(${watchGameChannels.toString()})()`).catch(() => {}); }
  }
} else {
  watchGameChannels();
}
