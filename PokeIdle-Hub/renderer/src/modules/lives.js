'use strict';

(() => {
  const { $, el, toast, uid, makeWebview, reloadWebview } = window.PF.DOM;
  const { S, persist, PARTITION } = window.PF.State;

  const PLAT = {
    kick: {
      title: 'Kick', color: 'var(--kick)', host: 'kick.com',
      player: (c) => `https://player.kick.com/${c}?autoplay=true&muted=true`,
      chat: (c) => `https://kick.com/popout/${c}/chat`,
    },
    twitch: {
      title: 'Twitch', color: 'var(--twitch)', host: 'www.twitch.tv',
      // Página completa: mantém o player e reaproveita o chat nativo do canal.
      player: (c) => `https://www.twitch.tv/${c}`,
      chat: (c) => `https://www.twitch.tv/popout/${c}/chat?popout=`,
    },
  };

  const all = () => [...S.kick.map((i) => ({ p: 'kick', i })), ...S.twitch.map((i) => ({ p: 'twitch', i }))];
  const findItem = (id) => all().find((e) => e.i.id === id);

  function cleanChannel(raw) {
    let s = String(raw).trim().toLowerCase();
    if (!s) return null;
    s = s.split(/[?#]/)[0];
    s = s.split('/').filter(Boolean).pop() || '';
    return /^[a-z0-9_-]{2,40}$/.test(s) ? s : null;
  }

  function addChannels(text) {
    for (const raw of String(text).split(/[,\s]+/)) {
      const c = cleanChannel(raw);
      if (!c) continue;
      const low = raw.toLowerCase();
      const p = low.includes('twitch.tv') ? 'twitch' : (low.includes('kick.com') ? 'kick' : S.target);
      S.ignoredGameChannels = S.ignoredGameChannels.filter(key => key !== `${p}:${c}`);
      if (!S[p].some((x) => x.channel === c)) S[p].push({ id: uid(), channel: c, muted: true });
      // Se adicionado manualmente ou clicado, injeta como aberto de imediato
      const item = S[p].find(x => x.channel === c);
      if (item && !liveStates.get(item.id)?.open) {
        liveStates.set(item.id, nextLiveState(null, 'online', true));
      }
    }
    persist();
    syncTiles();
    scheduleLiveChecks();
  }

  function receiveGameChannels(rows) {
    S.gameChannels = window.PF.State.normalizeGameChannels([...S.gameChannels, ...window.PF.State.normalizeGameChannels(rows)]);
    importGameChannels();
    persist();
    if (manualDiscoveryPending && all().length) void checkLivesNow();
  }

  function importGameChannels() {
    let added = 0;
    const ignored = new Set(S.ignoredGameChannels);
    for (const { platform, channel } of S.gameChannels) {
      if (ignored.has(`${platform}:${channel}`) || S[platform].some(item => item.channel === channel)) continue;
      S[platform].push({ id: uid(), channel, muted: true });
      added++;
    }
    if (added) persist();
    syncTiles();
    if (added && S.autoLives && !liveRefreshing) scheduleLiveChecks();
  }

  function removeItem(id) {
    const entry = findItem(id);
    if (entry) S.ignoredGameChannels = [...new Set([...S.ignoredGameChannels, `${entry.p}:${entry.i.channel}`])];
    S.kick = S.kick.filter((x) => x.id !== id);
    S.twitch = S.twitch.filter((x) => x.id !== id);
    persist();
    syncTiles();
  }

  // ---------------- Blocos das lives ----------------

  const tiles = new Map();   // id -> { root, player, chat, muteBtn, rect, stalls }
  let zTop = 10;

  function createTile(p, item) {
    const P = PLAT[p];
    const id = item.id;
    const t = { stalls: 0, rect: null, sharedTwitch: p === 'twitch', chatFallbackTimer: null, platform: p, channel: item.channel };

    t.muteBtn = el('button', { onclick: () => toggleMute(id) });
    const hdr = el('div', { class: 'hdr', 'data-drag': 'move', title: 'Arraste para mover o bloco' },
      el('span', { class: 'dot', style: `background:${P.color}` }),
      el('span', { class: 'name', text: item.channel }),
      el('span', { class: 'sp' }),
      t.muteBtn,
      el('button', { title: 'Recarregar', 'aria-label': 'Recarregar', text: '⟳', onclick: () => reloadTile(t) }),
      el('button', { title: 'Abrir no Edge', 'aria-label': 'Abrir no Edge', text: '🌐', onclick: () => window.pf.openEdge(`https://${P.host}/${item.channel}`) }),
      el('button', { title: 'Remover canal', 'aria-label': 'Remover canal', text: '✕', onclick: () => removeItem(id) }),
    );

    t.player = makeWebview(P.player(item.channel), {
      muted: item.muted,
      onReady: (wv) => { applyMute(id); applyQuality(wv); applyChatMode(id); },
    });
    t.playerBox = el('div', { class: `player${t.sharedTwitch ? ' shared-twitch' : ''}` }, t.player, t.player.__skeleton);
    if (t.sharedTwitch) {
      t.chat = t.player;
      t.chatBox = t.playerBox;
      t.player.addEventListener('ipc-message', (e) => {
        if (!t.sharedTwitch) return;
        if (e.channel === 'chat-click') expandChat(id);
        if (e.channel === 'twitch-chat-ready') checkTwitchChat(id, e.args[0] === true);
      });
    } else attachSeparateChat(id, t, P.chat(item.channel));

    t.root = el('div', { class: 'tile' },
      hdr,
      t.playerBox,
      t.sharedTwitch ? null : t.chatBox,
      el('div', { class: 'grip grip-r', 'data-drag': 'right', title: 'Arraste para mudar a largura' }),
      el('div', { class: 'grip grip-b', 'data-drag': 'bottom', title: 'Arraste para mudar a altura' }),
      el('div', { class: 'grip grip-c', 'data-drag': 'corner', title: 'Arraste para mudar largura e altura', text: '⤡' }),
    );
    t.root.addEventListener('pointerdown', (ev) => startDrag(ev, id));
    t.root.addEventListener('pointerdown', () => bringFront(id), true);
    tiles.set(id, t);
    applyMute(id);
    return t;
  }

  function reloadTile(t) {
    for (const wv of new Set([t.player, t.chat])) reloadWebview(wv);
  }

  function attachSeparateChat(id, t, url) {
    t.chat = makeWebview(url, { muted: true, skeleton: 'chat', onReady: () => applyChatMode(id) });
    t.chatBox = el('div', { class: 'chat' }, t.chat, t.chat.__skeleton);
    t.chat.addEventListener('ipc-message', e => { if (e.channel === 'chat-click') expandChat(id); });
  }

  function checkTwitchChat(id, ready) {
    const t = tiles.get(id);
    if (!t?.sharedTwitch) return;
    if (ready) { clearTimeout(t.chatFallbackTimer); t.chatFallbackTimer = null; return; }
    if (t.chatFallbackTimer !== null) return;
    t.chatFallbackTimer = setTimeout(() => {
      t.chatFallbackTimer = null;
      if (tiles.get(id) !== t || !t.sharedTwitch) return;
      const wasExpanded = expandedChat === id;
      if (wasExpanded) collapseChat();
      t.sharedTwitch = false;
      t.playerBox.classList.remove('shared-twitch');
      t.player.executeJavaScript('window.__pfSetTwitchLayout && window.__pfSetTwitchLayout({enabled:false})').catch(() => {});
      attachSeparateChat(id, t, PLAT.twitch.chat(findItem(id).i.channel));
      t.playerBox.after(t.chatBox);
      if (wasExpanded) expandChat(id);
    }, 30000);
  }

  function applyMute(id) {
    const t = tiles.get(id);
    const e = findItem(id);
    if (!t || !e) return;
    const m = !!e.i.muted;
    t.muteBtn.textContent = m ? '🔇' : '🔊';
    t.muteBtn.title = m ? 'Ativar som' : 'Silenciar';
    t.muteBtn.setAttribute('aria-label', t.muteBtn.title);
    t.player.__muted = m;
    if (!t.player.__ready) return;
    try { t.player.setAudioMuted(m); } catch (_) { /* ignora */ }
    t.player.executeJavaScript(`window.__kmSetMuted && window.__kmSetMuted(${m})`).catch(() => {});
  }

  function applyQuality(wv) {
    if (!wv.__ready) return;
    const quality = S.kickEconomy && new URL(wv.__pfSrc).hostname === 'player.kick.com' ? 160 : Number(S.quality) || 0;
    wv.executeJavaScript(`window.__kmApplyQuality && window.__kmApplyQuality(${quality})`).catch(() => {});
  }

  function applyChatMode(id) {
    const t = tiles.get(id);
    if (!t?.chat.__ready) return;
    const compact = expandedChat !== id;
    const kickEconomy = findItem(id)?.p === 'kick' && S.kickEconomy && compact;
    if (t.sharedTwitch) {
      t.player.executeJavaScript(`window.__pfSetTwitchLayout && window.__pfSetTwitchLayout(${JSON.stringify({
        enabled: true, expanded: !compact, showChat: S.showChat,
      })})`).then(ready => checkTwitchChat(id, ready === true)).catch(() => checkTwitchChat(id, false));
      return;
    }
    t.chat.executeJavaScript(
      `window.__pfSetChatCompact && window.__pfSetChatCompact(${compact});` +
      `window.__pfSetKickEconomy && window.__pfSetKickEconomy(${kickEconomy});`,
    ).catch(() => {});
  }

  function toggleMute(id) {
    const e = findItem(id);
    if (!e) return;
    e.i.muted = !e.i.muted;
    persist();
    applyMute(id);
  }

  function bringFront(id) {
    const t = tiles.get(id);
    if (t && expandedChat !== id) t.root.style.zIndex = String(++zTop);
  }

  let expandedChat = null;

  function expandChat(id) {
    if (expandedChat === id) return;
    collapseChat();
    const t = tiles.get(id);
    if (!t) return;
    expandedChat = id;
    t.root.style.zIndex = '9500';
    t.chatBox.classList.add('expanded');
    applyChatMode(id);
    $('#chat-backdrop').hidden = false;
  }

  function collapseChat() {
    if (!expandedChat) return;
    const id = expandedChat;
    const t = tiles.get(id);
    expandedChat = null;
    $('#chat-backdrop').hidden = true;
    if (!t) return;
    t.chatBox.classList.remove('expanded');
    applyChatMode(id);
    t.root.style.zIndex = String(++zTop);
  }

  function syncTiles() {
    const grid = $('#grid');
    const saved = all();
    const ids = new Set(saved.map((e) => e.i.id));
    const open = saved.filter((e) => liveStates.get(e.i.id)?.open);
    const visible = open.filter(e => !(S.twitchEconomy && e.p === 'twitch'));
    const visibleIds = new Set(visible.map((e) => e.i.id));
    for (const [id, t] of tiles) {
      if (!visibleIds.has(id)) {
        if (expandedChat === id) collapseChat();
        if (drag?.id === id) { drag = null; $('#shield').hidden = true; }
        clearTimeout(t.chatFallbackTimer);
        t.root.remove(); tiles.delete(id);
      }
    }
    for (const id of Object.keys(S.frames)) if (!ids.has(id)) delete S.frames[id];
    for (const id of liveStates.keys()) if (!ids.has(id)) liveStates.delete(id);
    for (const e of visible) if (!tiles.has(e.i.id)) grid.append(createTile(e.p, e.i).root);
    syncTwitchEconomy(open.filter(e => e.p === 'twitch').map(e => e.i.channel));
    persist();
    layout();
    renderLiveControls();
  }

  // ---------------- Twitch Econômica ----------------

  let economyView = null;
  let economyURL = '';
  function syncTwitchEconomy(channels) {
    const names = [...new Set(channels.filter(name => /^[a-z0-9_]{1,25}$/.test(name)))].sort();
    const selected = names.slice(0, 100);
    const url = S.twitchEconomy && selected.length
      ? `https://www.twitch.tv/popout/${selected[0]}/chat?pf-economy=1&pf-channels=${encodeURIComponent(selected.join(','))}` : '';
    $('#twitch-economy').checked = S.twitchEconomy;
    $('#kick-economy').checked = S.kickEconomy;
    $('#kick-economy-help').hidden = !S.kickEconomy;
    $('#twitch-economy-help').hidden = !S.twitchEconomy;
    $('#twitch-economy-reload').hidden = !url;
    $('#twitch-economy-status').dataset.total = String(names.length);
    if (url === economyURL) {
      if (!url) $('#twitch-economy-status').textContent = S.twitchEconomy ? 'Aguardando canais online' : '';
      return;
    }
    economyView?.remove(); economyView = null; economyURL = url;
    $('#twitch-economy-status').textContent = !S.twitchEconomy ? '' : !url ? 'Aguardando canais online' : 'Conectando ao chat…';
    if (!url) return;
    economyView = makeWebview(url, { muted: true });
    economyView.classList.add('twitch-economy-session');
    economyView.setAttribute('aria-hidden', 'true');
    document.body.append(economyView);
  }
  setInterval(async () => {
    const view = economyView;
    if (!view?.__ready || !view.isConnected) return;
    try {
      const state = await view.executeJavaScript('window.__pfTwitchEconomy || null');
      if (view !== economyView) return;
      const total = Number($('#twitch-economy-status').dataset.total);
      const limit = total > 100 ? ` · limite: 100 de ${total} canais` : '';
      $('#twitch-economy-status').textContent = !state?.connected ? 'Aguardando conexão com o chat…'
        : !state.authenticated ? 'Sem login — entre na Twitch e clique em Reconectar Twitch'
        : `${state.joined}/${state.requested} chats conectados · sem vídeo${limit}`;
    } catch (_) { /* a página pode estar recarregando */ }
  }, 2000);

  // ---------------- Monitoramento online/offline ----------------

  const liveStates = new Map();
  let liveTimer = null;
  let liveChecking = false;
  let liveRefreshing = false;
  let manualDiscoveryPending = false;
  let liveGeneration = 0;

  function scheduleLiveChecks() {
    clearTimeout(liveTimer);
    liveTimer = null;
    liveGeneration++;
    if (S.autoLives && all().length && !liveChecking) liveTimer = setTimeout(checkLives, 0);
  }

  async function checkLivesNow() {
    if (liveChecking || liveRefreshing) return;
    liveRefreshing = true;
    manualDiscoveryPending = false;
    clearTimeout(liveTimer); liveTimer = null;
    renderLiveControls();
    try {
      const g = window.PF.Game?.game;
      if (g?.__ready) {
        const rows = await Promise.race([
          g.executeJavaScript('window.__pfReadGameChannels ? window.__pfReadGameChannels() : []'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ]).catch(() => []);
        if (Array.isArray(rows) && rows.length) {
          S.gameChannels = window.PF.State.normalizeGameChannels([...S.gameChannels, ...window.PF.State.normalizeGameChannels(rows)]);
        }
      }
      S.ignoredGameChannels = [];
      importGameChannels();
      persist();
    } catch (_) {}
    finally {
      liveRefreshing = false;
    }
    if (!all().length) {
      manualDiscoveryPending = true;
      renderLiveControls();
      return;
    }
    await checkLives(true);
  }

  async function checkLives(manual = false) {
    clearTimeout(liveTimer);
    liveTimer = null;
    if ((!S.autoLives && !manual) || liveChecking || liveRefreshing || !all().length) return;
    liveChecking = true;
    const generation = liveGeneration;
    renderLiveControls();
    try {
      const items = all();
      const jobs = [];
      for (const p of ['kick', 'twitch']) {
        const platformItems = items.filter(item => item.p === p);
        const size = p === 'twitch' ? 30 : 1;
        for (let offset = 0; offset < platformItems.length; offset += size) {
          jobs.push({ p, items: platformItems.slice(offset, offset + size) });
        }
      }
      for (let offset = 0; offset < jobs.length; offset += 4) {
        if (generation !== liveGeneration || (!S.autoLives && !manual)) break;
        await Promise.all(jobs.slice(offset, offset + 4).map(async ({ p, items: batch }) => {
          let statuses = {};
          try {
            statuses = await Promise.race([
              window.pf.liveStatus(p, batch.map(({ i }) => i.channel)),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
            ]);
          } catch (_) {}
          if (generation !== liveGeneration || (!S.autoLives && !manual)) return;
          for (const { i } of batch) {
            if (!findItem(i.id)) continue;
            liveStates.set(i.id, nextLiveState(liveStates.get(i.id), statuses?.[i.channel], liveStates.get(i.id)?.open === true));
          }
        }));
        syncTiles();
      }
    } finally {
      liveChecking = false;
      renderLiveControls();
      if (S.autoLives && all().length) {
        liveTimer = setTimeout(checkLives, generation === liveGeneration ? S.livePoll * 1000 : 0);
      }
    }
  }

  function renderLiveControls() {
    const items = all();
    $('#auto-lives').checked = S.autoLives;
    $('#live-poll').value = String(S.livePoll);
    $('#check-lives').disabled = liveChecking || liveRefreshing;
    const unknown = items.filter(({ i }) => liveStates.get(i.id)?.status === 'unknown').length;
    const count = items.filter(e => liveStates.get(e.i.id)?.open).length;
    $('#live-summary').textContent = liveChecking || liveRefreshing ? 'Verificando canais…'
      : manualDiscoveryPending ? 'Abra o Pokeidle para carregar os canais'
        : `${S.autoLives ? '' : 'Automático desligado · '}${count} abertas${unknown ? ` · ${unknown} sem confirmação` : ''}`;
    $('#empty-title').textContent = items.length ? 'Nenhuma live aberta no momento'
      : 'Entre no Pokeidle para carregar os canais';
    $('#empty-detail').textContent = !items.length
      ? 'Os canais oficiais são reconhecidos pelo jogo. Use Verificar agora para abrir os online.'
      : unknown ? 'Não foi possível verificar alguns canais. Use Verificar agora para tentar novamente.'
        : S.autoLives ? 'As lives abrirão automaticamente quando os canais estiverem online.'
          : 'Clique em Verificar agora para trazer os canais online à tela.';
    if (economyView && !tiles.size) {
      $('#empty-title').textContent = 'Twitch em modo econômico';
      $('#empty-detail').textContent = 'Os canais usam o chat compartilhado. Acompanhe a conexão acima e os bônus na aba Pokeidle.';
    }
  }

  // ---------------- Layout da Grade ----------------

  function autoColumns(n, W, H, chrome) {
    if (n <= 1) return 1;
    let best = 1;
    let bestArea = -1;
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      const w = W / c;
      const h = H / r - chrome;
      if (h <= 0) continue;
      const vw = Math.min(w, (h * 16) / 9);
      if (vw * vw > bestArea) { bestArea = vw * vw; best = c; }
    }
    return best;
  }

  function layout() {
    const grid = $('#grid');
    grid.classList.toggle('nochat', !S.showChat);
    const items = all().filter((e) => tiles.has(e.i.id));
    $('#empty').hidden = items.length > 0;
    const W = grid.clientWidth;
    const H = grid.clientHeight;
    if (!items.length || !W || !H) return;
    const cols = S.columns > 0 ? Math.min(S.columns, items.length) : autoColumns(items.length, W, H, 22 + (S.showChat ? 46 : 0));
    const rows = Math.ceil(items.length / cols);
    const gap = 6;
    items.forEach((e, idx) => {
      const t = tiles.get(e.i.id);
      if (!t) return;
      const f = S.frames[e.i.id];
      let r;
      if (Array.isArray(f) && f.length === 4) {
        r = { x: f[0] * W, y: f[1] * H, w: f[2] * W, h: f[3] * H };
      } else {
        const w = W / cols;
        const h = H / rows;
        r = { x: (idx % cols) * w + gap / 2, y: Math.floor(idx / cols) * h + gap / 2, w: w - gap, h: h - gap };
      }
      t.rect = r;
      Object.assign(t.root.style, {
        left: `${r.x}px`, top: `${r.y}px`, width: `${Math.max(r.w, 10)}px`, height: `${Math.max(r.h, 10)}px`,
      });
    });
  }

  // ---- Arrastar/redimensionar um bloco sozinho ----

  const MIN_W = 180;
  const MIN_H = 120;
  let drag = null;

  function startDrag(ev, id) {
    const handle = ev.target.closest('[data-drag]');
    if (!handle || ev.button !== 0 || ev.target.closest('button')) return;
    const t = tiles.get(id);
    if (!t || !t.rect) return;
    ev.preventDefault();
    drag = { id, kind: handle.dataset.drag, x0: ev.clientX, y0: ev.clientY, r0: { ...t.rect } };
    const shield = $('#shield');
    shield.style.cursor = { move: 'grabbing', right: 'ew-resize', bottom: 'ns-resize', corner: 'nwse-resize' }[drag.kind];
    shield.hidden = false;
  }

  window.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const grid = $('#grid');
    const W = grid.clientWidth;
    const H = grid.clientHeight;
    const dx = ev.clientX - drag.x0;
    const dy = ev.clientY - drag.y0;
    const r = { ...drag.r0 };
    if (drag.kind === 'move') { r.x += dx; r.y += dy; }
    if (drag.kind === 'right' || drag.kind === 'corner') r.w += dx;
    if (drag.kind === 'bottom' || drag.kind === 'corner') r.h += dy;
    const snap = (v) => Math.round(v / 8) * 8;
    r.w = Math.min(Math.max(snap(r.w), MIN_W), W);
    r.h = Math.min(Math.max(snap(r.h), MIN_H), H);
    r.x = Math.min(Math.max(snap(r.x), 0), W - r.w);
    r.y = Math.min(Math.max(snap(r.y), 0), H - r.h);
    S.frames[drag.id] = [r.x / W, r.y / H, r.w / W, r.h / H];
    layout();
  });

  window.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    $('#shield').hidden = true;
    persist();
  });

  new ResizeObserver(() => layout()).observe($('#grid'));

  // Watchdog de player travado
  setInterval(() => {
    for (const t of tiles.values()) {
      if (!t.player.__ready) continue;
      t.player.executeJavaScript(
        '(function(){var v=document.querySelector("video");if(!v||v.paused||v.readyState<2)return false;' +
        'var t=v.currentTime,ok=window.__kmLastT!==t;window.__kmLastT=t;return ok;})()',
      ).then((ok) => {
        if (ok) { t.stalls = 0; return; }
        t.stalls += 1;
        if (t.stalls >= 3) { t.stalls = 0; reloadWebview(t.player); }
      }).catch(() => {});
    }
  }, 60000);

  window.PF.Lives = {
    PLAT,
    all,
    findItem,
    cleanChannel,
    addChannels,
    receiveGameChannels,
    importGameChannels,
    createTile,
    reloadTile,
    attachSeparateChat,
    applyMute,
    applyQuality,
    applyChatMode,
    toggleMute,
    removeItem,
    bringFront,
    expandChat,
    collapseChat,
    syncTiles,
    syncTwitchEconomy,
    scheduleLiveChecks,
    checkLivesNow,
    checkLives,
    renderLiveControls,
    layout,
    tiles,
    economyView,
    liveStates
  };
})();
