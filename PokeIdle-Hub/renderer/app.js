'use strict';
// PokeIdle Hub — interface (abas, blocos de lives livres, jogo e alertas do mercado)

const PARTITION = 'persist:pokeidlehub';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  kids.flat().forEach((c) => { if (c != null) e.append(c); });
  return e;
}

const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (_) { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

// ---------------- Estado ----------------

const S = {
  kick: load('pf.kick', []),
  twitch: load('pf.twitch', []),
  columns: load('pf.columns', 0),
  showChat: load('pf.showChat', true),
  quality: load('pf.quality', 160),   // altura máxima das lives (0 = automática)
  autoLives: load('pf.autoLives', true) === true,
  twitchEconomy: load('pf.twitchEconomy', false) === true,
  kickEconomy: load('pf.kickEconomy', false) === true,
  gameChannels: normalizeGameChannels(load('pf.gameChannels', [])),
  ignoredGameChannels: load('pf.ignoredGameChannels', []),
  livePoll: [30, 60, 120, 300].includes(load('pf.livePoll', 60)) ? load('pf.livePoll', 60) : 60,
  tab: load('pf.tab', 'lives'),
  // Contas do Pokeidle: a primeira usa a sessão das lives (mantém o login que já existia)
  accounts: (() => {
    const list = load('pf.accounts', null);
    return Array.isArray(list) && list.length ? list : [{ id: 'main', name: 'Conta 1', main: true }];
  })(),
  gameAccount: load('pf.gameAccount', 'main'),
  gameMosaic: load('pf.gameMosaic', false) === true,
  frames: load('pf.frames', {}),      // id -> [x, y, largura, altura] em fração da área
  target: 'kick',
  hideVideos: load('pf.hideVideos', false) === true,
  accountFavorites: load('pf.accountFavorites', {}),
  fpsForeground: load('pf.fpsForeground', 0),
  fpsBackground: load('pf.fpsBackground', 15),
  suspendBgVideos: load('pf.suspendBgVideos', true) !== false,
  accountLimits: (() => {
    const lim = load('pf.accountLimits', {});
    return lim && typeof lim === 'object' ? lim : {};
  })(),
  universalLimits: (() => {
    const u = load('pf.universalLimits', { kick: 2, twitch: 3 });
    return u && typeof u === 'object' ? u : { kick: 2, twitch: 3 };
  })(),
  gameActionsVisible: load('pf.gameActionsVisible', true) !== false,
};
function persist() {
  save('pf.kick', S.kick); save('pf.twitch', S.twitch); save('pf.columns', S.columns);
  save('pf.showChat', S.showChat); save('pf.quality', S.quality); save('pf.tab', S.tab); save('pf.frames', S.frames);
  save('pf.accounts', S.accounts); save('pf.gameAccount', S.gameAccount);
  save('pf.gameMosaic', S.gameMosaic);
  save('pf.gameActionsVisible', S.gameActionsVisible);
  save('pf.autoLives', S.autoLives); save('pf.livePoll', S.livePoll);
  save('pf.twitchEconomy', S.twitchEconomy);
  save('pf.kickEconomy', S.kickEconomy);
  save('pf.gameChannels', S.gameChannels);
  save('pf.ignoredGameChannels', S.ignoredGameChannels);
  save('pf.hideVideos', S.hideVideos);
  save('pf.accountFavorites', S.accountFavorites);
  save('pf.fpsForeground', S.fpsForeground);
  save('pf.fpsBackground', S.fpsBackground);
  save('pf.suspendBgVideos', S.suspendBgVideos);
  save('pf.accountLimits', S.accountLimits);
  save('pf.universalLimits', S.universalLimits);
}

window.PF = window.PF || {};
window.PF.S = S;
window.PF.persist = persist;

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

function normalizeGameChannels(rows) {
  const channels = new Map();
  if (!Array.isArray(rows)) return [];
  for (const row of rows.slice(0, 200)) {
    if (!row || !['kick', 'twitch'].includes(row.platform) || typeof row.channel !== 'string') continue;
    const channel = row.channel.trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,40}$/.test(channel)) continue;
    channels.set(`${row.platform}:${channel}`, { platform: row.platform, channel });
  }
  return [...channels.values()];
}

function receiveGameChannels(rows) {
  S.gameChannels = normalizeGameChannels([...S.gameChannels, ...normalizeGameChannels(rows)]);
  importGameChannels();
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
  syncTiles();
  if (added && S.autoLives && !liveRefreshing) scheduleLiveChecks();
}

/** Só letras, números, _ e - (o resto vira URL, então precisa ser seguro). */
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
    if (!S.autoLives) {
      const item = S[p].find(x => x.channel === c);
      liveStates.set(item.id, nextLiveState(null, 'unknown', true));
    }
  }
  persist();
  syncTiles();
  scheduleLiveChecks();
}

// ---------------- WebViews ----------------

// Erros de rede do Chromium (sem internet, conexão caiu, DNS, timeout...)
const NET_ERRORS = new Set([-7, -21, -100, -101, -102, -103, -104, -105, -106, -109, -118, -130, -137]);

// Espaça o início das páginas das lives; tarefas removidas não ocupam um intervalo.
const loadQueue = [];
let loadTimer = null;
let lastPageLoad = -Infinity;
function enqueueLoad(job) {
  loadQueue.push(job);
  pumpLoadQueue();
}
function pumpLoadQueue() {
  if (loadTimer !== null || !loadQueue.length) return;
  loadTimer = setTimeout(() => {
    loadTimer = null;
    const job = loadQueue.shift();
    try { if (job()) lastPageLoad = performance.now(); } catch (_) { /* a página pode ter sido removida */ }
    pumpLoadQueue();
  }, Math.max(0, 1500 - (performance.now() - lastPageLoad)));
}

function makeWebview(src, opts = {}) {
  const wv = document.createElement('webview');
  wv.setAttribute('partition', opts.partition || PARTITION);
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('webpreferences', 'backgroundThrottling=no');
  wv.__pfSrc = src;
  wv.__ready = false;
  wv.__muted = opts.muted ?? false;
  // Skeleton por cima enquanto a página carrega (o chamador coloca ao lado da webview)
  wv.__skeleton = skeleton(opts.skeleton || 'video');
  wv.addEventListener('did-start-loading', () => wv.__skeleton.classList.remove('gone'));
  wv.addEventListener('did-stop-loading', () => setTimeout(() => {
    let loading = false;
    try { loading = wv.isLoading(); } catch (_) { /* ainda não anexada */ }
    if (!loading) wv.__skeleton.classList.add('gone');
  }, 800));
  wv.addEventListener('dom-ready', () => {
    wv.__ready = true;
    try { wv.setAudioMuted(wv.__muted); } catch (_) { /* ignora */ }
    if (opts.onReady) opts.onReady(wv);
  });
  // Página travou/morreu (comum em 24h rodando): recarrega
  wv.addEventListener('render-process-gone', () => setTimeout(() => reloadWebview(wv), 2000));
  wv.addEventListener('unresponsive', () => reloadWebview(wv));
  // Sem internet: tenta de novo em 30 s
  wv.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || !NET_ERRORS.has(e.errorCode)) return;
    setTimeout(() => {
      if (!wv.isConnected) return;
      try { wv.loadURL(e.validatedURL || wv.__pfSrc); } catch (_) { wv.src = wv.__pfSrc; }
    }, 30000);
  });
  if (opts.now) wv.src = src;
  else enqueueLoad(() => {
    if (!wv.isConnected || wv.getAttribute('src')) return false;
    wv.src = src;
    return true;
  });
  return wv;
}

/** Blocos cinza com brilho passando, no formato de cada tipo de página. */
function skeleton(style) {
  const b = (cls) => el('div', { class: `bone ${cls}` });
  const kids = {
    video: [b('screen'), b('play'), b('l1'), b('l2')],
    chat: [b('avatar'), b('bar'), b('btn')],
    game: [b('top'), ...Array.from({ length: 6 }, (_, i) => b(`side s${i}`)),
      el('div', { class: 'cards' }, ...Array.from({ length: 8 }, () => b('card')))],
  }[style] || [];
  return el('div', { class: `skeleton sk-${style}`, 'aria-hidden': 'true' }, ...kids);
}

function reloadWebview(wv) {
  if (!wv.isConnected) return;
  try { wv.__ready ? wv.reload() : (wv.src = wv.__pfSrc); } catch (_) { wv.src = wv.__pfSrc; }
}

// ---------------- Blocos das lives ----------------

const tiles = new Map();   // key -> { root, player, chat, muteBtn, rect, stalls, acc, item, p, key }
const colHeaders = new Map(); // acc.id -> header DOM element
const accountCols = new Map(); // acc.id -> { col, header, body }
let zTop = 10;

function createTile(p, item, account) {
  const P = PLAT[p];
  const acc = account || currentAccount() || { id: 'main', name: 'Conta 1' };
  const key = `${acc.id}:${item.id}`;
  const t = { stalls: 0, rect: null, sharedTwitch: p === 'twitch', chatFallbackTimer: null, key, acc, item, p };

  t.muteBtn = el('button', { onclick: () => toggleMute(key) });

  const isFav = isAccountFavorite(item.channel, acc.id);
  const favBtn = el('button', {
    class: `tile-fav-btn${isFav ? ' active' : ''}`,
    title: isFav ? 'Remover dos favoritos desta conta' : 'Favoritar para esta conta (fixa no topo)',
    'aria-label': 'Favoritar canal',
    onclick: (e) => {
      e.stopPropagation();
      toggleAccountFavorite(item.channel, acc.id);
    }
  }, el('span', { class: `icon-svg ${isFav ? 'icon-star' : 'icon-star-outline'}` }));
  t.favBtn = favBtn;

  const followBtn = el('button', {
    class: 'tile-follow-btn',
    title: `Seguir ${item.channel} com a conta ${acc.name}`,
    'aria-label': 'Seguir canal',
    text: '+ Seguir',
    onclick: async (e) => {
      e.stopPropagation();
      await followSingleTile(t, followBtn);
    }
  });
  t.followBtn = followBtn;

  const hdr = el('div', { class: 'hdr', 'data-drag': 'move', title: 'Arraste para mover o bloco' },
    favBtn,
    el('span', { class: 'dot', style: `background:${P.color}` }),
    el('span', { class: 'name', text: item.channel }),
    el('span', { class: 'sp' }),
    followBtn,
    t.muteBtn,
    el('button', { title: 'Recarregar', 'aria-label': 'Recarregar', onclick: () => reloadTile(t) },
      el('span', { class: 'icon-svg icon-reload' })),
    el('button', { title: 'Abrir no Edge', 'aria-label': 'Abrir no Edge', onclick: () => window.pf.openEdge(`https://${P.host}/${item.channel}`) },
      el('span', { class: 'icon-svg icon-edge' })),
    el('button', { title: 'Remover canal', 'aria-label': 'Remover canal', onclick: () => removeItem(item.id) },
      el('span', { class: 'icon-svg icon-trash' })),
  );

  const part = accountPartition(acc);
  t.player = makeWebview(P.player(item.channel), {
    partition: part,
    muted: item.muted,
    onReady: (wv) => { applyMute(key); applyQuality(wv); applyChatMode(key); },
  });
  t.playerBox = el('div', { class: `player${t.sharedTwitch ? ' shared-twitch' : ''}` }, t.player, t.player.__skeleton);
  if (t.sharedTwitch) {
    t.chat = t.player;
    t.chatBox = t.playerBox;
    t.player.addEventListener('ipc-message', (e) => {
      if (!t.sharedTwitch) return;
      if (e.channel === 'chat-click') expandChat(key);
      if (e.channel === 'twitch-chat-ready') checkTwitchChat(key, e.args[0] === true);
    });
  } else attachSeparateChat(key, t, P.chat(item.channel), part);

  t.root = el('div', { class: 'tile' },
    hdr,
    t.playerBox,
    t.sharedTwitch ? null : t.chatBox,
    el('div', { class: 'grip grip-r', 'data-drag': 'right', title: 'Arraste para mudar a largura' }),
    el('div', { class: 'grip grip-b', 'data-drag': 'bottom', title: 'Arraste para mudar a altura' }),
    el('div', { class: 'grip grip-c', 'data-drag': 'corner', title: 'Arraste para mudar largura e altura', text: '⤡' }),
  );
  t.root.addEventListener('pointerdown', (ev) => startDrag(ev, key));
  t.root.addEventListener('pointerdown', () => bringFront(key), true);
  tiles.set(key, t);
  applyMute(key);
  return t;
}

function reloadTile(t) {
  for (const wv of new Set([t.player, t.chat])) reloadWebview(wv);
}

function attachSeparateChat(key, t, url, partition) {
  t.chat = makeWebview(url, { partition, muted: true, skeleton: 'chat', onReady: () => applyChatMode(key) });
  t.chatBox = el('div', { class: 'chat' }, t.chat, t.chat.__skeleton);
  t.chat.addEventListener('ipc-message', e => { if (e.channel === 'chat-click') expandChat(key); });
}

function checkTwitchChat(key, ready) {
  const t = tiles.get(key);
  if (!t?.sharedTwitch) return;
  if (ready) { clearTimeout(t.chatFallbackTimer); t.chatFallbackTimer = null; return; }
  if (t.chatFallbackTimer !== null) return;
  t.chatFallbackTimer = setTimeout(() => {
    t.chatFallbackTimer = null;
    if (tiles.get(key) !== t || !t.sharedTwitch) return;
    const wasExpanded = expandedChat === key;
    if (wasExpanded) collapseChat();
    t.sharedTwitch = false;
    t.playerBox.classList.remove('shared-twitch');
    t.player.executeJavaScript('window.__pfSetTwitchLayout && window.__pfSetTwitchLayout({enabled:false})').catch(() => {});
    attachSeparateChat(key, t, PLAT.twitch.chat(t.item.channel), accountPartition(t.acc));
    t.playerBox.after(t.chatBox);
    if (wasExpanded) expandChat(key);
  }, 30000);
}

function applyMute(key) {
  const t = tiles.get(key);
  if (!t || !t.item) return;
  const m = !!t.item.muted;
  t.muteBtn.innerHTML = `<span class="icon-svg ${m ? 'icon-mute' : 'icon-unmute'}"></span>`;
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

function applyChatMode(key) {
  const t = tiles.get(key);
  if (!t?.chat?.__ready || !t.item) return;
  const compact = expandedChat !== key;
  const kickEconomy = t.p === 'kick' && S.kickEconomy && compact;
  if (t.sharedTwitch) {
    t.player.executeJavaScript(`window.__pfSetTwitchLayout && window.__pfSetTwitchLayout(${JSON.stringify({
      enabled: true, expanded: !compact, showChat: S.showChat,
    })})`).then(ready => checkTwitchChat(key, ready === true)).catch(() => checkTwitchChat(key, false));
    return;
  }
  t.chat.executeJavaScript(
    `window.__pfSetChatCompact && window.__pfSetChatCompact(${compact});` +
    `window.__pfSetKickEconomy && window.__pfSetKickEconomy(${kickEconomy});`,
  ).catch(() => {});
}

function toggleMute(key) {
  const t = tiles.get(key);
  if (!t || !t.item) return;
  t.item.muted = !t.item.muted;
  persist();
  applyMute(key);
}

function removeItem(id) {
  const entry = findItem(id);
  if (entry) S.ignoredGameChannels = [...new Set([...S.ignoredGameChannels, `${entry.p}:${entry.i.channel}`])];
  S.kick = S.kick.filter((x) => x.id !== id);
  S.twitch = S.twitch.filter((x) => x.id !== id);
  persist();
  syncTiles();
}

function bringFront(key) {
  const t = tiles.get(key);
  if (t && expandedChat !== key) t.root.style.zIndex = String(++zTop);
}

async function followTile(t) {
  if (!t || !t.item) return { ok: false, status: 'no_tile' };

  if (t.p === 'twitch') {
    const wv = t.player;
    if (!wv || !wv.__ready || !wv.isConnected) {
      return { ok: false, status: 'not_ready', channel: t.item.channel };
    }
    try {
      const res = await wv.executeJavaScript(`
        (() => {
          try {
            const unfollow = document.querySelector(
              'button[data-a-target="unfollow-button"], button[data-test-selector="unfollow-button"], [data-a-target="followed-button"]'
            );
            if (unfollow) return { ok: true, status: 'already_following' };

            const follow = document.querySelector(
              'button[data-a-target="follow-button"], button[data-test-selector="follow-button"]'
            ) || Array.from(document.querySelectorAll('button')).find(b => {
              const txt = (b.textContent || '').trim().toLowerCase();
              const aria = (b.getAttribute('aria-label') || '').toLowerCase();
              return (txt === 'seguir' || txt === 'follow' || aria.includes('seguir') || aria.includes('follow')) && !aria.includes('deixar');
            });

            if (follow) {
              if (follow.disabled) return { ok: false, status: 'disabled' };
              follow.click();
              return { ok: true, status: 'followed' };
            }

            const isAuth = !!document.querySelector(
              '[data-a-target="user-display-name"], [data-a-target="user-menu-toggle"], [data-a-target="avatar-image"], .tw-avatar'
            );
            if (!isAuth) return { ok: false, status: 'not_logged_in' };

            return { ok: false, status: 'btn_not_found' };
          } catch (e) {
            return { ok: false, status: 'error', error: String(e) };
          }
        })()
      `);
      return { ...res, channel: t.item.channel, platform: 'twitch' };
    } catch (e) {
      return { ok: false, status: 'exec_error', channel: t.item.channel, error: String(e) };
    }
  }

  if (t.p === 'kick') {
    const wv = t.chat || t.player;
    if (!wv || !wv.__ready || !wv.isConnected) {
      return { ok: false, status: 'not_ready', channel: t.item.channel };
    }
    try {
      const ch = t.item.channel;
      const res = await wv.executeJavaScript(`
        (async (canal) => {
          try {
            const btn = document.querySelector('button[data-testid="follow-button"], .follow-btn');
            if (btn) {
              btn.click();
              return { ok: true, status: 'followed' };
            }

            const csrf = document.cookie.split('; ').find(r => r.startsWith('XSRF-TOKEN='))?.split('=')[1] || '';
            const r = await fetch('/api/v2/channels/' + canal + '/follow', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': decodeURIComponent(csrf)
              },
              credentials: 'include'
            });

            if (r.ok || r.status === 200 || r.status === 201) return { ok: true, status: 'followed' };
            if (r.status === 409 || r.status === 422) return { ok: true, status: 'already_following' };
            if (r.status === 401 || r.status === 403) return { ok: false, status: 'not_logged_in' };
            return { ok: false, status: 'api_' + r.status };
          } catch (e) {
            return { ok: false, status: 'error', error: String(e) };
          }
        })('${ch}')
      `);
      return { ...res, channel: t.item.channel, platform: 'kick' };
    } catch (e) {
      return { ok: false, status: 'exec_error', channel: t.item.channel, error: String(e) };
    }
  }

  return { ok: false, status: 'unsupported' };
}

async function followAllOpenChannels() {
  const btn = $('#follow-all');
  if (!tiles.size) {
    toast('Nenhum canal de live aberto no momento.');
    return;
  }

  if (btn) {
    btn.classList.add('loading');
    btn.disabled = true;
    btn.innerHTML = '<span class="icon-svg icon-follow"></span> Seguindo...';
  }

  let seguidos = 0;
  let jaSeguia = 0;
  let semLogin = 0;
  let naoCarregado = 0;
  let outrosErros = 0;

  try {
    for (const [key, t] of tiles) {
      const res = await followTile(t);
      if (res.status === 'followed') {
        seguidos++;
      } else if (res.status === 'already_following') {
        jaSeguia++;
      } else if (res.status === 'not_logged_in') {
        semLogin++;
      } else if (res.status === 'not_ready') {
        naoCarregado++;
      } else {
        outrosErros++;
      }
      await new Promise(r => setTimeout(r, 250));
    }

    if (seguidos > 0) {
      const extra = jaSeguia ? ' (' + jaSeguia + ' já eram seguidos)' : '';
      toast('✓ ' + seguidos + ' canal(is) seguido(s) com sucesso!' + extra);
    } else if (jaSeguia > 0 && semLogin === 0) {
      toast('Você já segue todos os ' + jaSeguia + ' canais abertos.');
    } else if (semLogin > 0) {
      toast('Atenção: ' + semLogin + ' canal(is) não puderam ser seguidos por falta de login na plataforma.');
    } else if (naoCarregado > 0) {
      toast('Alguns canais ainda estavam carregando. Aguarde e tente novamente.');
    } else {
      toast('Comando de seguir concluído.');
    }
  } catch (err) {
    console.error('Falha ao processar seguir todos:', err);
    toast('Falha ao processar comando de seguir.');
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.innerHTML = '<span class="icon-svg icon-follow"></span> Seguir Todos';
    }
  }
}

function isAccountFavorite(channel, accId) {
  if (!channel || !accId) return false;
  const list = S.accountFavorites[accId];
  return Array.isArray(list) && list.includes(channel.toLowerCase());
}

function toggleAccountFavorite(channel, accId) {
  if (!channel || !accId) return;
  const c = channel.toLowerCase();
  const current = Array.isArray(S.accountFavorites[accId]) ? S.accountFavorites[accId] : [];
  if (current.includes(c)) {
    S.accountFavorites[accId] = current.filter(x => x !== c);
    toast(`Canal ${c} removido dos favoritos.`);
  } else {
    S.accountFavorites[accId] = [...current, c];
    toast(`★ Canal ${c} adicionado aos favoritos desta conta!`);
  }
  persist();
  for (const [key, t] of tiles) {
    if (t.acc.id === accId && t.item.channel.toLowerCase() === c) {
      const isFav = isAccountFavorite(c, accId);
      if (t.favBtn) {
        t.favBtn.innerHTML = `<span class="icon-svg ${isFav ? 'icon-star' : 'icon-star-outline'}"></span>`;
        t.favBtn.classList.toggle('active', isFav);
        t.favBtn.title = isFav ? 'Remover dos favoritos desta conta' : 'Favoritar para esta conta (fixa no topo)';
      }
    }
  }
  syncTiles();
}

async function followSingleTile(t, btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Seguindo...';
  btn.classList.add('loading');
  try {
    const res = await followTile(t);
    if (res.status === 'followed' || res.status === 'already_following') {
      btn.textContent = '✓ Seguido';
      btn.classList.remove('loading');
      btn.classList.add('followed');
      btn.title = `Você segue ${t.item.channel} nesta conta`;
      toast(`✓ ${t.item.channel} seguido com sucesso na conta ${t.acc.name}!`);
    } else if (res.status === 'not_logged_in') {
      btn.disabled = false;
      btn.textContent = '+ Seguir';
      btn.classList.remove('loading');
      toast(`Atenção: Entre na ${t.p === 'kick' ? 'Kick' : 'Twitch'} para a conta "${t.acc.name}" para poder seguir.`);
    } else if (res.status === 'not_ready') {
      btn.disabled = false;
      btn.textContent = '+ Seguir';
      btn.classList.remove('loading');
      toast(`O canal ${t.item.channel} ainda está carregando. Tente novamente em instantes.`);
    } else {
      btn.disabled = false;
      btn.textContent = '+ Seguir';
      btn.classList.remove('loading');
      toast(`Não foi possível seguir ${t.item.channel}.`);
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '+ Seguir';
    btn.classList.remove('loading');
    toast(`Erro ao processar comando de seguir em ${t.item.channel}.`);
  }
}

function getAccountLimits(accId) {
  if (!S.accountLimits || typeof S.accountLimits !== 'object') {
    S.accountLimits = {};
  }
  const saved = S.accountLimits[accId];
  const defaultKick = typeof S.universalLimits?.kick === 'number' ? S.universalLimits.kick : 2;
  const defaultTwitch = typeof S.universalLimits?.twitch === 'number' ? S.universalLimits.twitch : 3;
  return {
    kick: typeof saved?.kick === 'number' ? saved.kick : defaultKick,
    twitch: typeof saved?.twitch === 'number' ? saved.twitch : defaultTwitch,
  };
}

function applyUniversalLimit(platform, val) {
  const limitVal = parseInt(val, 10);
  if (isNaN(limitVal)) return;
  if (!S.universalLimits) S.universalLimits = { kick: 2, twitch: 3 };
  S.universalLimits[platform] = limitVal;

  const accounts = S.accounts && S.accounts.length ? S.accounts : [{ id: 'main', name: 'Conta 1', main: true }];
  for (const acc of accounts) {
    if (!S.accountLimits[acc.id]) {
      S.accountLimits[acc.id] = getAccountLimits(acc.id);
    }
    S.accountLimits[acc.id][platform] = limitVal;
  }
  persist();
  syncTiles();
  const name = platform === 'kick' ? 'Kick' : 'Twitch';
  const text = limitVal >= 99 ? 'Ilimitado' : (limitVal === 0 ? 'Desativado' : `${limitVal} live(s)`);
  toast(`Máx ${name} universal definido para ${text} em todas as contas.`);
}

function changeAccountLimit(accId, platform, delta) {
  if (!accId || !platform) return;
  const current = getAccountLimits(accId);
  const minVal = 0;
  const maxVal = 99;
  const newVal = Math.max(minVal, Math.min(maxVal, current[platform] + delta));
  if (newVal === current[platform]) return;

  if (!S.accountLimits[accId]) {
    S.accountLimits[accId] = { ...current };
  }
  S.accountLimits[accId][platform] = newVal;
  persist();
  syncTiles();
}

function updateAccountHeaderLimits(acc, header, counts) {
  let limitsWrap = header.querySelector('.account-col-limits');
  if (!limitsWrap) {
    limitsWrap = el('div', { class: 'account-col-limits' });
    header.append(limitsWrap);
  }
  const lim = getAccountLimits(acc.id);
  const kickOpen = counts?.kick ?? 0;
  const twitchOpen = counts?.twitch ?? 0;

  limitsWrap.replaceChildren(
    el('span', { class: 'account-col-limits-label', text: 'Máx lives:' }),
    el('div', {
      class: 'limit-stepper kick',
      title: `Limite Kick: ${lim.kick} (abertas nesta conta: ${kickOpen})`
    },
      el('span', { class: 'limit-tag kick', text: 'K' }),
      el('button', {
        class: 'btn-limit-step',
        'aria-label': 'Diminuir limite Kick',
        text: '−',
        onclick: (e) => {
          e.stopPropagation();
          changeAccountLimit(acc.id, 'kick', -1);
        }
      }),
      el('span', { class: 'limit-val', text: String(lim.kick) }),
      el('button', {
        class: 'btn-limit-step',
        'aria-label': 'Aumentar limite Kick',
        text: '+',
        onclick: (e) => {
          e.stopPropagation();
          changeAccountLimit(acc.id, 'kick', 1);
        }
      })
    ),
    el('div', {
      class: 'limit-stepper twitch',
      title: `Limite Twitch: ${lim.twitch} (abertas nesta conta: ${twitchOpen})`
    },
      el('span', { class: 'limit-tag twitch', text: 'T' }),
      el('button', {
        class: 'btn-limit-step',
        'aria-label': 'Diminuir limite Twitch',
        text: '−',
        onclick: (e) => {
          e.stopPropagation();
          changeAccountLimit(acc.id, 'twitch', -1);
        }
      }),
      el('span', { class: 'limit-val', text: String(lim.twitch) }),
      el('button', {
        class: 'btn-limit-step',
        'aria-label': 'Aumentar limite Twitch',
        text: '+',
        onclick: (e) => {
          e.stopPropagation();
          changeAccountLimit(acc.id, 'twitch', 1);
        }
      })
    )
  );
}


// ---- Chat aberto inteiro (para resgatar pontos: o modal precisa de espaço) ----
// Só muda o CSS: o chat não recarrega ao abrir/fechar.

let expandedChat = null;

function expandChat(key) {
  if (expandedChat === key) return;
  collapseChat();
  const t = tiles.get(key);
  if (!t) return;
  expandedChat = key;
  t.root.style.zIndex = '9500';
  t.chatBox.classList.add('expanded');
  applyChatMode(key);
  $('#chat-backdrop').hidden = false;
}

function collapseChat() {
  if (!expandedChat) return;
  const key = expandedChat;
  const t = tiles.get(key);
  expandedChat = null;
  $('#chat-backdrop').hidden = true;
  if (!t) return;
  t.chatBox.classList.remove('expanded');
  applyChatMode(key);
  t.root.style.zIndex = String(++zTop);
}

function syncTiles() {
  const grid = $('#grid');
  const saved = all();
  const ids = new Set(saved.map((e) => e.i.id));
  const open = saved.filter((e) => liveStates.get(e.i.id)?.open);
  const visible = open.filter(e => !(S.twitchEconomy && e.p === 'twitch'));

  const accounts = S.accounts && S.accounts.length ? S.accounts : [{ id: 'main', name: 'Conta 1', main: true }];

  // Calcular canais permitidos por conta respeitando limites de Kick e Twitch
  const allowedByAccount = new Map();
  const countsByAccount = new Map();
  const expectedKeys = new Set();

  for (const acc of accounts) {
    const limits = getAccountLimits(acc.id);
    const visibleKick = visible.filter(e => e.p === 'kick');
    const visibleTwitch = visible.filter(e => e.p === 'twitch');

    function comparePriority(a, b) {
      const aFav = isAccountFavorite(a.i.channel, acc.id) ? 1 : 0;
      const bFav = isAccountFavorite(b.i.channel, acc.id) ? 1 : 0;
      if (bFav !== aFav) return bFav - aFav;

      const aKey = `${acc.id}:${a.i.id}`;
      const bKey = `${acc.id}:${b.i.id}`;
      const aOpen = tiles.has(aKey) ? 1 : 0;
      const bOpen = tiles.has(bKey) ? 1 : 0;
      if (bOpen !== aOpen) return bOpen - aOpen;

      return 0;
    }

    const sortedKick = [...visibleKick].sort(comparePriority);
    const sortedTwitch = [...visibleTwitch].sort(comparePriority);

    const allowedKick = sortedKick.slice(0, Math.max(0, limits.kick));
    const allowedTwitch = sortedTwitch.slice(0, Math.max(0, limits.twitch));

    // Fixar favoritos no topo visual da coluna
    const allowed = [...allowedKick, ...allowedTwitch].sort((a, b) => {
      const aFav = isAccountFavorite(a.i.channel, acc.id) ? 1 : 0;
      const bFav = isAccountFavorite(b.i.channel, acc.id) ? 1 : 0;
      return bFav - aFav;
    });

    allowedByAccount.set(acc.id, allowed);
    countsByAccount.set(acc.id, { kick: allowedKick.length, twitch: allowedTwitch.length });

    for (const e of allowed) {
      expectedKeys.add(`${acc.id}:${e.i.id}`);
    }
  }

  for (const [key, t] of tiles) {
    if (!expectedKeys.has(key)) {
      if (expandedChat === key) collapseChat();
      if (drag?.id === key) { drag = null; $('#shield').hidden = true; }
      clearTimeout(t.chatFallbackTimer);
      t.root.remove();
      tiles.delete(key);
    }
  }

  // Sincronizar colunas e cabeçalhos de contas
  const activeAccIds = new Set(accounts.map(a => a.id));
  for (const [accId, colObj] of accountCols) {
    if (!activeAccIds.has(accId) || !visible.length) {
      colObj.col.remove();
      accountCols.delete(accId);
      colHeaders.delete(accId);
    }
  }
  if (visible.length) {
    for (const acc of accounts) {
      let colObj = accountCols.get(acc.id);
      if (!colObj) {
        const topRow = el('div', { class: 'account-col-top' },
          el('div', { class: 'account-col-info' },
            el('span', { class: 'icon-svg icon-game account-col-icon' }),
            el('span', { class: 'account-col-name', text: acc.name || 'Conta' }),
          ),
          el('div', { class: 'account-col-badges' }),
        );
        const limitsRow = el('div', { class: 'account-col-limits' });
        const header = el('div', { class: 'account-col-header' }, topRow, limitsRow);
        const body = el('div', { class: 'account-col-body' });
        const col = el('div', { class: 'account-column', 'data-acc-id': acc.id }, header, body);
        grid.append(col);
        colObj = { col, header, body };
        accountCols.set(acc.id, colObj);
        colHeaders.set(acc.id, header);
      } else {
        const nameEl = colObj.header.querySelector('.account-col-name');
        if (nameEl) nameEl.textContent = acc.name || 'Conta';
      }
      updateAccountHeaderBadges(acc, colObj.header);
      updateAccountHeaderLimits(acc, colObj.header, countsByAccount.get(acc.id));
    }
  }

  // Fechar por estar offline preserva o tamanho/posição. Remover o canal apaga ambos.
  for (const id of Object.keys(S.frames)) if (!ids.has(id)) delete S.frames[id];
  for (const id of liveStates.keys()) if (!ids.has(id)) liveStates.delete(id);

  for (const acc of accounts) {
    const colObj = accountCols.get(acc.id);
    const allowed = allowedByAccount.get(acc.id) || [];
    allowed.forEach((e, idx) => {
      const key = `${acc.id}:${e.i.id}`;
      let t = tiles.get(key);
      if (!t) {
        t = createTile(e.p, e.i, acc);
      }
      t.root.style.order = String(idx);
      if (colObj?.body) {
        if (t.root.parentElement !== colObj.body) colObj.body.append(t.root);
      } else if (t.root.parentElement !== grid) {
        grid.append(t.root);
      }
    });
  }

  syncTwitchEconomy(open.filter(e => e.p === 'twitch').map(e => e.i.channel));
  persist();
  layout();
  renderLiveControls();
}

async function updateAccountHeaderBadges(acc, header) {
  const part = accountPartition(acc);
  let conn = { twitch: false, kick: false };
  try {
    if (window.pf?.checkConnections) conn = await window.pf.checkConnections(part);
  } catch (_) {}

  let badges = header.querySelector('.account-col-badges');
  if (!badges) {
    badges = el('div', { class: 'account-col-badges' });
    header.append(badges);
  }
  badges.replaceChildren();

  if (conn.twitch) {
    badges.append(el('span', { class: 'badge-conn ok', text: 'Twitch ✓', title: `Twitch conectada para ${acc.name}` }));
  } else {
    badges.append(el('button', {
      class: 'badge-conn btn-login',
      text: '+ Twitch',
      title: `Entrar na Twitch para ${acc.name}`,
      onclick: (e) => {
        e.stopPropagation();
        window.pf.openLogin('twitch', part, acc.name);
      },
    }));
  }

  if (conn.kick) {
    badges.append(el('span', { class: 'badge-conn ok', text: 'Kick ✓', title: `Kick conectada para ${acc.name}` }));
  } else {
    badges.append(el('button', {
      class: 'badge-conn btn-login',
      text: '+ Kick',
      title: `Entrar na Kick para ${acc.name}`,
      onclick: (e) => {
        e.stopPropagation();
        window.pf.openLogin('kick', part, acc.name);
      },
    }));
  }
}

// ---------------- Monitoramento online/offline ----------------

// Chat compartilhado por conta na Twitch econômica
const economyViews = new Map(); // acc.id -> { view, url, acc }

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

  const accounts = S.accounts && S.accounts.length ? S.accounts : [{ id: 'main', name: 'Conta 1', main: true }];
  const activeAccIds = new Set(accounts.map(a => a.id));

  for (const [accId, item] of economyViews) {
    if (!activeAccIds.has(accId) || !url) {
      item.view.remove();
      economyViews.delete(accId);
    }
  }

  if (!url) {
    $('#twitch-economy-status').textContent = S.twitchEconomy ? 'Aguardando canais online' : '';
    return;
  }

  for (const acc of accounts) {
    let item = economyViews.get(acc.id);
    if (!item) {
      const view = makeWebview(url, { partition: accountPartition(acc), muted: true });
      view.classList.add('twitch-economy-session');
      view.setAttribute('aria-hidden', 'true');
      document.body.append(view);
      economyViews.set(acc.id, { view, url, acc });
    } else if (item.url !== url) {
      item.view.remove();
      const view = makeWebview(url, { partition: accountPartition(acc), muted: true });
      view.classList.add('twitch-economy-session');
      view.setAttribute('aria-hidden', 'true');
      document.body.append(view);
      economyViews.set(acc.id, { view, url, acc });
    }
  }

  $('#twitch-economy-status').textContent = 'Conectando aos chats das contas…';
}

setInterval(async () => {
  if (!economyViews.size) return;
  const reports = [];
  for (const [accId, item] of economyViews) {
    const view = item.view;
    if (!view?.__ready || !view.isConnected) continue;
    try {
      const state = await view.executeJavaScript('window.__pfTwitchEconomy || null');
      reports.push({ acc: item.acc, state });
    } catch (_) {}
  }
  if (!reports.length) return;
  const notAuth = reports.filter(r => r.state && !r.state.authenticated);
  const total = Number($('#twitch-economy-status').dataset.total);
  const limit = total > 100 ? ` · limite: 100 de ${total} canais` : '';
  if (notAuth.length) {
    const names = notAuth.map(r => r.acc.name || 'Conta').join(', ');
    $('#twitch-economy-status').textContent = `Sem login na Twitch em: ${names} — use o botão [+ Twitch] na coluna`;
  } else {
    const connected = reports.filter(r => r.state?.connected).length;
    $('#twitch-economy-status').textContent = `${connected}/${reports.length} contas conectadas aos chats · sem vídeo${limit}`;
  }
}, 2000);

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
  // A consulta atual termina antes da próxima; a geração descarta respostas antigas.
  if (S.autoLives && all().length && !liveChecking) liveTimer = setTimeout(checkLives, 0);
}

async function checkLivesNow() {
  if (liveChecking || liveRefreshing) return;
  liveRefreshing = true;
  manualDiscoveryPending = false;
  clearTimeout(liveTimer); liveTimer = null;
  renderLiveControls();
  try {
    if (game?.__ready) {
      const rows = await game.executeJavaScript('window.__pfReadGameChannels ? window.__pfReadGameChannels() : []');
      S.gameChannels = normalizeGameChannels([...S.gameChannels, ...normalizeGameChannels(rows)]);
    }
  } catch (_) { /* usa os canais já conhecidos se o jogo estiver recarregando */ }
  S.ignoredGameChannels = [];
  importGameChannels();
  liveRefreshing = false;
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
    // Até quatro requisições em paralelo; cada consulta Twitch agrupa até 30 canais.
    for (let offset = 0; offset < jobs.length; offset += 4) {
      if (generation !== liveGeneration || (!S.autoLives && !manual)) break;
      await Promise.all(jobs.slice(offset, offset + 4).map(async ({ p, items: batch }) => {
        let statuses = {};
        try { statuses = await window.pf.liveStatus(p, batch.map(({ i }) => i.channel)); } catch (_) { /* mantém estado */ }
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
  const badgeLives = $('#badge-lives');
  if (badgeLives) {
    badgeLives.textContent = String(count);
    badgeLives.hidden = count === 0;
  }
  $('#live-summary').textContent = liveChecking || liveRefreshing ? 'Verificando canais…'
    : manualDiscoveryPending ? 'Abra o Pokeidle para carregar os canais'
      : `${S.autoLives ? '' : 'Automático desligado · '}${count} abertas${unknown ? ` · ${unknown} sem confirmação` : ''}`;
  const ukick = $('#universal-limit-kick');
  if (ukick && S.universalLimits) ukick.value = String(S.universalLimits.kick ?? 2);
  const utwitch = $('#universal-limit-twitch');
  if (utwitch && S.universalLimits) utwitch.value = String(S.universalLimits.twitch ?? 3);
  $('#empty-title').textContent = items.length ? 'Nenhuma live aberta no momento'
    : 'Entre no Pokeidle para carregar os canais';
  $('#empty-detail').textContent = !items.length
    ? 'Os canais oficiais são reconhecidos pelo jogo. Use Verificar agora para abrir os online.'
    : unknown ? 'Não foi possível verificar alguns canais. Use Verificar agora para tentar novamente.'
      : S.autoLives ? 'As lives abrirão automaticamente quando os canais estiverem online.'
        : 'Clique em Verificar agora para trazer os canais online à tela.';
  if (economyViews.size && !tiles.size) {
    $('#empty-title').textContent = 'Twitch em modo econômico';
    $('#empty-detail').textContent = 'Os canais usam o chat compartilhado. Acompanhe a conexão acima e os bônus na aba Pokeidle.';
  }
}

/** Nº de colunas que deixa os vídeos maiores (16:9). */
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

/** Organização das lives em colunas verticais roláveis com dimensões 16:9 saudáveis. */
function layout() {
  const grid = $('#grid');
  grid.classList.toggle('nochat', !S.showChat);
  const accounts = S.accounts && S.accounts.length ? S.accounts : [{ id: 'main', name: 'Conta 1', main: true }];
  const hasTiles = tiles.size > 0;
  $('#empty').hidden = hasTiles;
  const W = grid.clientWidth;
  const H = grid.clientHeight;
  if (!hasTiles || !W || !H) {
    accountCols.forEach(c => { c.col.style.display = 'none'; });
    return;
  }
  accountCols.forEach(c => { c.col.style.display = 'flex'; });

  const numCols = accounts.length;

  accounts.forEach((acc) => {
    const colObj = accountCols.get(acc.id);
    if (!colObj) return;

    const accTiles = [...tiles.values()].filter(t => t.acc.id === acc.id).sort((a, b) => {
      const aFav = isAccountFavorite(a.item.channel, acc.id) ? 1 : 0;
      const bFav = isAccountFavorite(b.item.channel, acc.id) ? 1 : 0;
      return bFav - aFav;
    });
    const K = accTiles.length;
    if (!K) return;

    const bodyW = colObj.body.clientWidth || Math.floor(W / numCols);

    // Determinar sub-colunas internas dentro de cada conta
    let gridCols = 1;
    if (numCols === 1) {
      if (S.columns > 0) {
        gridCols = Math.min(S.columns, K);
      } else {
        gridCols = bodyW >= 1200 ? Math.min(3, K) : (bodyW >= 720 ? Math.min(2, K) : 1);
      }
    }
    colObj.body.style.gridTemplateColumns = `repeat(${gridCols}, minmax(0, 1fr))`;

    // Largura disponível para cada card e altura proporcional 16:9
    const gap = 8;
    const tileW = Math.max(260, Math.floor((bodyW - gap * (gridCols - 1) - 16) / gridCols));
    const videoH = Math.round((tileW * 9) / 16);
    const hdrH = 22;
    const chatH = S.showChat ? 46 : 0;
    const naturalTileH = hdrH + videoH + chatH;

    // Limites saudáveis de altura: nunca espremer abaixo de 270px (com chat) ou 210px (sem chat)
    const minTileH = S.showChat ? 270 : 210;
    const maxTileH = S.showChat ? 460 : 400;
    const tileH = S.hideVideos
      ? (S.showChat ? 74 : 36)
      : Math.min(maxTileH, Math.max(minTileH, naturalTileH));

    accTiles.forEach((t) => {
      t.root.style.height = `${tileH}px`;
      t.rect = { w: tileW, h: tileH };
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
  const snap = (v) => Math.round(v / 8) * 8;   // encaixa de 8 em 8 px
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

// Vigia: se o vídeo de uma live ficar ~3 min parado ou travado, recarrega
setInterval(() => {
  for (const t of tiles.values()) {
    if (!t.player.__ready) continue;
    t.player.executeJavaScript(
      // Tocando de verdade = não pausado E o tempo do vídeo andou desde a última checagem
      '(function(){var v=document.querySelector("video");if(!v||v.paused||v.readyState<2)return false;' +
      'var t=v.currentTime,ok=window.__kmLastT!==t;window.__kmLastT=t;return ok;})()',
    ).then((ok) => {
      if (ok) { t.stalls = 0; return; }
      t.stalls += 1;
      if (t.stalls >= 3) { t.stalls = 0; reloadWebview(t.player); }
    }).catch(() => {});
  }
}, 60000);

// ---------------- Jogo ----------------

const GAME_URL = 'https://pokeidle.io/app';
// Aba que lê o mercado (a primeira conta: o mercado é o mesmo para todas)
let game = null;
const games = new Map();   // id da conta -> { pane, wv }

const accountPartition = (a) => (a.main ? PARTITION : `persist:pokeidlehub-acc-${a.id}`);
const currentAccount = () => S.accounts.find((a) => a.id === S.gameAccount) || S.accounts[0];

window.PF.games = games;
window.PF.currentAccount = currentAccount;

// Consultado somente pelo painel do tray, sem abrir as abas ou alterar o jogo.
window.__pfCollectSessions = async () => ({
  selected: S.gameAccount,
  accounts: await Promise.all(S.accounts.map(async account => {
    const page = games.get(account.id)?.wv;
    let data = { status: 'waiting' };
    try {
      if (page?.__ready && /(^|\.)pokeidle\.io$/.test(new URL(page.getURL()).hostname)) {
        let timer;
        try {
          data = await Promise.race([
            page.executeJavaScript('window.__pfReadSessionSummary ? window.__pfReadSessionSummary() : ({status: "waiting"})'),
            new Promise(resolve => { timer = setTimeout(() => resolve({ status: 'waiting' }), 2000); }),
          ]);
        } finally { clearTimeout(timer); }
      }
    } catch (_) { /* carregamento, logout ou conta removida */ }
    return { id: account.id, name: account.name || 'Sem nome', data };
  })),
});

function createGamePaneHeader(a, wv, isMarket) {
  return el('div', {
    class: 'game-pane-header',
    onclick: () => {
      S.gameAccount = a.id;
      setTab('game');
    },
  },
    el('div', { class: 'game-pane-info' },
      el('span', { class: 'game-pane-dot' }),
      el('span', { class: 'icon-svg icon-game game-pane-icon' }),
      el('span', { class: 'game-pane-name', text: a.name || 'Conta' }),
      isMarket ? el('span', { class: 'game-pane-tag', text: 'Principal' }) : null
    ),
    el('div', { class: 'game-pane-actions' },
      el('button', {
        class: 'game-pane-btn sniper',
        title: 'Abrir Cockpit Sniper desta conta',
        onclick: (e) => {
          e.stopPropagation();
          if (window.pf?.openRotomCockpit) {
            window.pf.openRotomCockpit(a.id, a.name);
          }
        },
      }, el('span', { class: 'icon-svg icon-target' }), ' Sniper'),
      el('button', {
        class: 'game-pane-btn focus',
        title: 'Focar nesta conta em tela cheia',
        onclick: (e) => {
          e.stopPropagation();
          focarConta(a.id);
        },
      }, el('span', { class: 'icon-svg icon-single' }), ' Focar'),
      el('button', {
        class: 'game-pane-btn reload',
        title: 'Recarregar esta conta',
        onclick: (e) => {
          e.stopPropagation();
          reloadWebview(wv);
        },
      }, el('span', { class: 'icon-svg icon-reload' }))
    )
  );
}

function updateGamePaneHeaders() {
  for (const a of S.accounts) {
    const g = games.get(a.id);
    if (!g) continue;
    const nameEl = g.pane.querySelector('.game-pane-name');
    if (nameEl) nameEl.textContent = a.name || 'Conta';
  }
  const panel = $('#panel-game');
  if (panel) panel.dataset.accounts = S.accounts.length;
}

function applyGameMosaic(enable) {
  const panel = $('#panel-game');
  const btn = $('#game-toggle-mosaic');
  if (panel) {
    panel.classList.toggle('mosaic-mode', enable);
    panel.dataset.accounts = S.accounts.length;
  }
  if (btn) {
    btn.classList.toggle('on', enable);
    btn.innerHTML = enable
      ? '<span class="icon-svg icon-single"></span> Conta Única'
      : '<span class="icon-svg icon-mosaic"></span> Ver Todas';
    btn.title = enable
      ? 'Voltar para visualização em tela cheia da conta selecionada'
      : 'Alternar entre ver conta única ou todas as contas em grade simultânea';
  }
  updateGamePaneHeaders();
}

function toggleGameMosaic(force) {
  const panel = $('#panel-game');
  const enable = typeof force === 'boolean' ? force : !panel.classList.contains('mosaic-mode');
  S.gameMosaic = enable;
  persist();
  applyGameMosaic(enable);
  applyFpsLimits();
}

function focarConta(accId) {
  S.gameAccount = accId;
  toggleGameMosaic(false);
  setTab('game');
  applyFpsLimits();
}

/** Cria/remove as abas do jogo para bater com a lista de contas. Todas ficam rodando. */
function setupGame() {
  for (const [id, g] of games) {
    if (!S.accounts.some((a) => a.id === id)) { g.pane.remove(); games.delete(id); }
  }
  S.accounts.forEach((a, i) => {
    const market = i === 0;
    const g = games.get(a.id);
    if (g && g.market === market) {
      if (!g.pane.querySelector('.game-pane-header')) {
        g.pane.prepend(createGamePaneHeader(a, g.wv, market));
      }
      return;
    }
    if (g) { g.pane.remove(); games.delete(a.id); }   // virou (ou deixou de ser) a aba do mercado
    const wv = makeWebview(GAME_URL, {
      muted: false,
      now: true,
      skeleton: 'game',
      partition: accountPartition(a),
      onReady: (w) => {
        w.executeJavaScript(`window.__pfPoll = ${Number(M.poll) || 60}`).catch(() => {});
        applyFpsLimits();
      },
    });
    wv.addEventListener('ipc-message', (e) => {
      if (e.channel === 'market' && market) onMarket(e.args[0]);
      if (e.channel === 'game-channels') {
        try {
          if (/(^|\.)pokeidle\.io$/.test(new URL(wv.getURL()).hostname)) receiveGameChannels(e.args[0]);
        } catch (_) { /* a página já foi fechada/navegou */ }
      }
      if (e.channel === 'rotom-msg') {
        if (window.pf?.sendRotomFromWebview) {
          window.pf.sendRotomFromWebview(a.id, e.args[0]);
        }
      }
      if (e.channel === 'game-account-nick') {
        const nick = String(e.args[0] || '').trim();
        if (nick && nick !== '—' && a.name !== nick) {
          a.name = nick;
          persist();
          renderAccountTabs();
        }
      }
    });
    const header = createGamePaneHeader(a, wv, market);
    const pane = el('div', { class: 'game-pane', 'data-account': a.id }, header, wv, wv.__skeleton);
    $('#panel-game').append(pane);
    games.set(a.id, { pane, wv, market });
  });
  game = games.get(S.accounts[0].id)?.wv || null;
  if (!S.accounts.some((a) => a.id === S.gameAccount)) S.gameAccount = S.accounts[0].id;
  updateGamePaneHeaders();
  renderAccountTabs();
  if (S.gameMosaic) applyGameMosaic(true);
  applyFpsLimits();
}

function renderAccountTabs() {
  const acc = currentAccount();
  $('#account-tabs').replaceChildren(...S.accounts.map((a) => el('button', {
    class: 'acc' + (a.id === acc?.id ? ' on' : ''),
    role: 'tab',
    'data-tab': 'game',
    'data-account': a.id,
    text: a.name || 'Sem nome',
    title: `${a.name || 'Sem nome'} (Duplo clique para renomear)`,
    onclick: () => {
      S.gameAccount = a.id;
      if (S.gameMosaic) toggleGameMosaic(false);
      setTab('game');
    },
    ondblclick: (e) => {
      e.stopPropagation();
      const novo = window.prompt('Renomear esta conta:', a.name || '');
      if (novo !== null && novo.trim()) {
        a.name = novo.trim().slice(0, 30);
        persist();
        renderAccountTabs();
        setTab('game');
      }
    },
  })));
  const badgeAccounts = $('#badge-accounts');
  if (badgeAccounts) {
    badgeAccounts.textContent = String(S.accounts.length);
    badgeAccounts.hidden = S.accounts.length === 0;
  }
  updateGamePaneHeaders();
}

function addAccount() {
  let n = S.accounts.length + 1;
  while (S.accounts.some((a) => a.name === `Conta ${n}`)) n += 1;
  const a = { id: uid(), name: `Conta ${n}` };
  S.accounts.push(a);
  S.gameAccount = a.id;
  setupGame();
  renderAccountTabs();
  syncTiles();
  setTab('game');
}

async function removeAccount() {
  const a = currentAccount();
  if (!a || S.accounts.length <= 1) return;
  const msg = a.main
    ? `Remover "${a.name}"? A aba fecha. O login continua salvo, porque é o mesmo das lives.`
    : `Remover "${a.name}"? A aba fecha e o login desta conta no Pokeidle é apagado do app.`;
  if (!window.confirm(msg)) return;
  S.accounts = S.accounts.filter((x) => x.id !== a.id);
  if (S.accountFavorites && S.accountFavorites[a.id]) {
    delete S.accountFavorites[a.id];
    persist();
  }
  if (S.accountLimits && S.accountLimits[a.id]) {
    delete S.accountLimits[a.id];
    persist();
  }
  S.gameAccount = S.accounts[0].id;
  setupGame();
  renderAccountTabs();
  syncTiles();
  setTab('game');
  // Espera a aba fechar antes de apagar o login
  if (!a.main) setTimeout(() => { window.pf.clearAccount(a.id).catch(() => {}); }, 2000);
}

// ---------------- Alertas do mercado ----------------

function parseAmount(raw) {
  let s = String(raw || '').trim().toUpperCase().replace(/\s/g, '');
  if (!s) return null;
  let m = 1;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[s.slice(-1)];
  if (mult) { m = mult; s = s.slice(0, -1); }
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // 6.039.587
  s = s.replace(',', '.');                                         // 4,4
  const v = Number(s);
  return s !== '' && Number.isFinite(v) && v > 0 ? v * m : null;
}

function fmt(v) {
  const f = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace('.', ','));
  if (v >= 1e9) return `${f(v / 1e9)}B`;
  if (v >= 1e6) return `${f(v / 1e6)}M`;
  if (v >= 1e3) return `${f(v / 1e3)}K`;
  return f(v);
}

const curLabel = (c) => (c === 'gems' ? 'gemas' : 'coins');
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const M = {
  rules: load('pf.rules', []),
  hits: load('pf.hits', []),
  enabled: load('pf.alertsOn', true),
  poll: load('pf.poll', 60),
  seen: [],
  totalSeen: 0,
  lastCapture: null,
  endpoints: [],
  alerted: new Set(),
  history: {},   // "nome|moeda" -> últimos preços
  samples: {},
};
const saveRules = () => save('pf.rules', M.rules);
const saveHits = () => save('pf.hits', M.hits);

function ruleSummary(r) {
  const p = [r.name ? r.name : 'Qualquer um'];
  if (r.shinyOnly) p.push('só shiny');
  if (r.maxCoins) p.push(`≤ ${fmt(r.maxCoins)} coins`);
  if (r.maxGems) p.push(`≤ ${fmt(r.maxGems)} gemas`);
  if (r.belowAvg) p.push(`${r.belowAvg}% abaixo da média`);
  return p.join(' · ');
}

function average(item) {
  const h = M.history[`${norm(item.name)}|${item.currency}`] || [];
  return h.length >= 5 ? h.reduce((a, b) => a + b, 0) / h.length : null;
}

function matches(r, item, avg) {
  if (!r.enabled) return false;
  if (r.name && !norm(item.name).includes(norm(r.name))) return false;
  if (r.shinyOnly && !item.shiny) return false;
  if (!r.maxCoins && !r.maxGems && !r.belowAvg) return true;
  if (item.currency === 'coins' && r.maxCoins && item.price <= r.maxCoins) return true;
  if (item.currency === 'gems' && r.maxGems && item.price <= r.maxGems) return true;
  if (r.belowAvg && avg != null && item.price <= avg * (1 - r.belowAvg / 100)) return true;
  return false;
}

function onMarket(msg) {
  if (!msg || typeof msg !== 'object') return;
  const url = typeof msg.url === 'string' ? msg.url.slice(0, 500) : 'dom';
  if (url !== 'dom' && typeof msg.sample === 'string') {
    const n = M.samples[url] || 0;
    if (n < 3) { M.samples[url] = n + 1; window.pf.writeSample(url, msg.sample); }
  }
  if (url !== 'dom' && !M.endpoints.includes(url)) M.endpoints = [...M.endpoints, url].slice(-10);
  M.lastCapture = new Date();

  const items = (Array.isArray(msg.items) ? msg.items : []).slice(0, 2000).map((d) => ({
    name: typeof d.name === 'string' ? d.name.slice(0, 80) : '',
    price: Number(d.price),
    currency: d.currency === 'gems' ? 'gems' : 'coins',
    shiny: d.shiny === true,
    id: d.id != null ? String(d.id).slice(0, 80) : null,
    source: url === 'dom' ? 'tela' : 'rede',
  })).filter((i) => i.name && Number.isFinite(i.price) && i.price > 0);

  if (items.length) processItems(items);
  renderAlerts();
}

function processItems(items) {
  const now = Date.now();
  if (!M.recentSeenMap) M.recentSeenMap = new Map();
  for (const [k, t] of M.recentSeenMap) {
    if (now - t > 600000) M.recentSeenMap.delete(k);
  }

  const fresh = [];
  for (const item of items) {
    const key = item.id != null
      ? `id:${item.id}`
      : `${norm(item.name)}|${item.currency}|${item.price}|${item.shiny ? 1 : 0}`;
    if (M.recentSeenMap.has(key)) continue;
    M.recentSeenMap.set(key, now);
    fresh.push(item);
  }

  if (!fresh.length) return;

  M.totalSeen += fresh.length;
  M.seen = [...fresh.map((item) => ({ date: now, item })), ...M.seen].slice(0, 60);

  for (const item of fresh) {
    const avg = average(item);   // média antes de incluir este preço
    const hKey = `${norm(item.name)}|${item.currency}`;
    M.history[hKey] = [...(M.history[hKey] || []), item.price].slice(-50);

    if (!M.enabled) continue;
    const rule = M.rules.find((r) => matches(r, item, avg));
    if (!rule) continue;
    // Mesmo anúncio só alerta uma vez
    const aKey = item.id != null ? `id:${item.id}` : `${hKey}|${item.price}|${item.shiny ? 1 : 0}`;
    if (M.alerted.has(aKey)) continue;
    if (M.alerted.size > 20000) M.alerted.clear();
    M.alerted.add(aKey);

    const summary = ruleSummary(rule);
    M.hits.unshift({ date: now, name: item.name, price: item.price, currency: item.currency, shiny: item.shiny, rule: summary, average: avg });
    if (M.hits.length > 300) M.hits.length = 300;
    saveHits();

    let body = `${fmt(item.price)} ${curLabel(item.currency)}`;
    if (avg != null) body += ` (média ${fmt(avg)})`;
    body += ` · regra: ${summary}`;
    window.pf.notify(`${item.shiny ? '✨ ' : ''}${item.name} no mercado`, body);
    window.pf.attention();
  }
}

const fmtDate = (d) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function renderAlerts() {
  $('#alerts-on').checked = !!M.enabled;
  $('#poll').value = String(M.poll);
  $('#market-status').textContent = M.lastCapture
    ? `Última leitura do mercado: ${M.lastCapture.toLocaleTimeString('pt-BR')} · ${M.totalSeen} anúncios lidos · ${M.endpoints.length} fonte(s) de rede`
    : 'Ainda não li o mercado. Abra o Market (Community Market) no jogo uma vez para o app aprender de onde vêm os anúncios.';

  const rules = $('#rules');
  rules.replaceChildren(...(M.rules.length ? M.rules.map((r) => el('li', {},
    el('input', { type: 'checkbox', checked: r.enabled, 'aria-label': 'Regra ligada', onchange: (e) => { r.enabled = e.target.checked; saveRules(); } }),
    el('span', { class: 'grow', text: ruleSummary(r) }),
    el('button', { text: '🗑', title: 'Apagar regra', 'aria-label': 'Apagar regra', onclick: () => { M.rules = M.rules.filter((x) => x.id !== r.id); saveRules(); renderAlerts(); } }),
  )) : [el('li', { class: 'empty', text: 'Nenhuma regra ainda' })]));

  $('#seen').replaceChildren(...(M.seen.length ? M.seen.map((s) => el('li', {},
    el('span', { class: 'grow', text: s.item.shiny ? `✨ ${s.item.name}` : s.item.name }),
    el('span', { class: 'num', text: `${fmt(s.item.price)} ${curLabel(s.item.currency)}` }),
    el('span', { class: 'muted small', text: s.item.source }),
  )) : [el('li', { class: 'empty', text: 'Nada lido ainda' })]));

  $('#hits').replaceChildren(...(M.hits.length ? M.hits.map((h) => el('li', { class: 'hit' },
    el('div', { class: 'row' },
      el('strong', { class: 'grow', text: h.shiny ? `✨ ${h.name}` : h.name }),
      el('span', { class: 'num', text: `${fmt(h.price)} ${curLabel(h.currency)}` })),
    el('div', { class: 'muted small', text: `${fmtDate(h.date)} · ${h.rule}${h.average != null ? ` · média ${fmt(h.average)}` : ''}` }),
  )) : [el('li', { class: 'empty', text: 'Nada ainda. Quando um anúncio bater numa regra, aparece aqui e como notificação.' })]));
}

function addRule() {
  const below = Number($('#r-below').value) || 0;
  M.rules.push({
    id: uid(),
    name: $('#r-name').value.trim().slice(0, 60),
    maxCoins: parseAmount($('#r-coins').value),
    maxGems: parseAmount($('#r-gems').value),
    belowAvg: below > 0 ? below : null,
    shinyOnly: $('#r-shiny').checked,
    enabled: true,
  });
  saveRules();
  $('#r-name').value = ''; $('#r-coins').value = ''; $('#r-gems').value = '';
  $('#r-below').value = '0'; $('#r-shiny').checked = false;
  renderAlerts();
}

// ---------------- Barra e abas ----------------

function setTab(tab) {
  if (!['lives', 'game', 'alerts', 'afk', 'settings'].includes(tab)) tab = 'lives';
  S.tab = tab;
  persist();
  const acc = currentAccount();
  $$('.sidebar-nav .nav-item[data-tab]').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
  $$('#account-tabs button[data-account]').forEach((b) => {
    const on = b.dataset.account === acc?.id;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
  games.forEach((g, id) => g.pane.classList.toggle('on', id === acc?.id));
  if (tab === 'game') {
    $('#account-remove').disabled = S.accounts.length <= 1;
    void updateGameBarConnections();
    applyGameMosaic(Boolean(S.gameMosaic));
  }
  $('#panel-lives').classList.toggle('active', tab === 'lives');
  $('#panel-game').classList.toggle('active', tab === 'game');
  $('#panel-alerts').classList.toggle('active', tab === 'alerts');
  $('#panel-afk')?.classList.toggle('active', tab === 'afk');
  $('#panel-settings')?.classList.toggle('active', tab === 'settings');
  $('#bar-lives').hidden = tab !== 'lives';
  $('#bar-game').hidden = tab !== 'game';
  $('#bar-alerts').hidden = tab !== 'alerts';
  $('#bar-afk').hidden = tab !== 'afk';
  $('#bar-settings').hidden = tab !== 'settings';
  const actionsBar = $('#game-actions-bar');
  if (actionsBar) actionsBar.hidden = tab !== 'game' || S.gameActionsVisible === false;
  updateGameActionsToggleBtn();
  if (tab === 'alerts') renderAlerts();
  if (tab === 'afk' && window.PF?.FarmAfk?.init) window.PF.FarmAfk.init();
  if (tab === 'settings') renderSettings();
  if (tab === 'lives') layout();
  applyFpsLimits();
}

function updateGameActionsToggleBtn() {
  const btn = $('#btn-toggle-game-actions');
  if (!btn) return;
  const isVisible = S.gameActionsVisible !== false;
  btn.innerHTML = isVisible ? '▲ Opções' : '▼ Opções';
  btn.title = isVisible
    ? 'Ocultar barra de ações do jogo'
    : 'Mostrar barra de ações do jogo';
  btn.classList.toggle('active', isVisible);
}

async function updateGameBarConnections() {
  const a = currentAccount();
  if (!a) return;
  const part = accountPartition(a);
  let conn = { twitch: false, kick: false };
  try {
    if (window.pf?.checkConnections) conn = await window.pf.checkConnections(part);
  } catch (_) {}

  const twitchBtn = $('#account-login-twitch');
  const twitchClear = $('#account-clear-twitch');
  if (twitchBtn && twitchClear) {
    if (conn.twitch) {
      twitchBtn.textContent = 'Twitch ✓ Conectada';
      twitchBtn.style.color = '#86efac';
      twitchClear.hidden = false;
    } else {
      twitchBtn.textContent = 'Entrar na Twitch';
      twitchBtn.style.color = '';
      twitchClear.hidden = true;
    }
  }

  const kickBtn = $('#account-login-kick');
  const kickClear = $('#account-clear-kick');
  if (kickBtn && kickClear) {
    if (conn.kick) {
      kickBtn.textContent = 'Kick ✓ Conectada';
      kickBtn.style.color = '#86efac';
      kickClear.hidden = false;
    } else {
      kickBtn.textContent = 'Entrar na Kick';
      kickBtn.style.color = '';
      kickClear.hidden = true;
    }
  }
}

function setTarget(p) {
  S.target = p;
  $$('#target button').forEach((b) => b.classList.toggle('on', b.dataset.target === p));
}

function applyFpsLimits() {
  try {
    const isGameTab = S.tab === 'game';
    const currentAcc = currentAccount();
    const fg = Number(S.fpsForeground) || 30;
    const bg = Number(S.fpsBackground) || 15;

    games.forEach((g, accId) => {
      if (!g?.wv || typeof g.wv.executeJavaScript !== 'function') return;
      try {
        let target;
        if (!isGameTab) {
          target = bg;
        } else if (S.gameMosaic) {
          target = fg;
        } else {
          target = accId === currentAcc?.id ? fg : bg;
        }
        g.wv.executeJavaScript(`window.__pfSetTargetFps && window.__pfSetTargetFps(${target})`).catch(() => {});
      } catch (_) {}
    });
  } catch (_) {}
}

function renderSettings() {
  const fg = $('#cfg-fps-foreground');
  const bg = $('#cfg-fps-background');
  const susp = $('#cfg-suspend-video');
  if (fg) fg.value = String(S.fpsForeground ?? 30);
  if (bg) bg.value = String(S.fpsBackground ?? 15);
  if (susp) susp.checked = S.suspendBgVideos !== false;
}

function setupSettings() {
  $('#cfg-fps-foreground')?.addEventListener('change', (e) => {
    S.fpsForeground = Number(e.target.value) || 0;
    persist();
    applyFpsLimits();
    toast(`FPS da conta em foco: ${S.fpsForeground ? S.fpsForeground + ' FPS' : 'Sem limite'}`);
  });

  $('#cfg-fps-background')?.addEventListener('change', (e) => {
    S.fpsBackground = Number(e.target.value) || 0;
    persist();
    applyFpsLimits();
    toast(`FPS de contas em segundo plano: ${S.fpsBackground ? S.fpsBackground + ' FPS' : 'Sem limite'}`);
  });

  $('#cfg-suspend-video')?.addEventListener('change', (e) => {
    S.suspendBgVideos = e.target.checked;
    persist();
    $('#panel-lives')?.classList.toggle('suspend-bg', S.suspendBgVideos !== false);
    toast(S.suspendBgVideos ? 'Suspensão de vídeo ativada.' : 'Suspensão de vídeo desativada.');
  });

  $('#cfg-clean-ram-btn')?.addEventListener('click', async () => {
    const btn = $('#cfg-clean-ram-btn');
    if (btn) btn.disabled = true;
    try {
      if (window.pf?.cleanRam) {
        await window.pf.cleanRam();
      }
      toast('✓ Memória RAM otimizada e caches temporários liberados.');
    } catch (_) {
      toast('Falha ao liberar memória.');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  renderSettings();
}

function setupBar() {
  $('#panel-lives')?.classList.toggle('suspend-bg', S.suspendBgVideos !== false);
  setupSettings();
  $('#auto-lives').addEventListener('change', (e) => {
    S.autoLives = e.target.checked;
    // A chave controla o monitoramento, sem abrir canais offline nem fechar a tela atual.
    if (S.autoLives) liveStates.forEach((state, id) => liveStates.set(id, nextLiveState(null, 'unknown', state.open)));
    persist(); syncTiles(); scheduleLiveChecks();
  });
  $('#live-poll').addEventListener('change', (e) => {
    S.livePoll = Number(e.target.value) || 60;
    persist(); scheduleLiveChecks();
  });
  $('#universal-limit-kick')?.addEventListener('change', (e) => {
    applyUniversalLimit('kick', e.target.value);
  });
  $('#universal-limit-twitch')?.addEventListener('change', (e) => {
    applyUniversalLimit('twitch', e.target.value);
  });
  $('#check-lives').addEventListener('click', () => { void checkLivesNow(); });

  // Navegação da sidebar lateral
  $$('.sidebar-nav .nav-item[data-tab]').forEach((b) => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });

  // Controle de recolher/expandir barra lateral
  const sidebar = $('#sidebar');
  const sidebarToggle = $('#sidebar-toggle');
  const setSidebarCollapsed = (collapsed) => {
    sidebar?.classList.toggle('collapsed', collapsed);
    if (sidebarToggle) {
      sidebarToggle.textContent = collapsed ? '▶' : '◀';
      sidebarToggle.title = collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral';
    }
    save('pf.sidebarCollapsed', collapsed);
    if (S.tab === 'lives') layout();
  };
  sidebarToggle?.addEventListener('click', () => {
    const isCollapsed = sidebar?.classList.contains('collapsed');
    setSidebarCollapsed(!isCollapsed);
  });
  if (load('pf.sidebarCollapsed', false)) {
    setSidebarCollapsed(true);
  }

  // Controle de Tela Limpa (ocultar / mostrar barras de ferramentas)
  const bar = $('#bar');
  const updateBar = $('#update-bar');
  const gameActionsBar = $('#game-actions-bar');
  const floatingRestore = $('#bars-floating-restore');
  const setBarsCollapsed = (hide) => {
    bar?.classList.toggle('bar-collapsed', hide);
    updateBar?.classList.toggle('bar-collapsed', hide);
    gameActionsBar?.classList.toggle('bar-collapsed', hide);
    if (floatingRestore) floatingRestore.hidden = !hide;
    save('pf.barsCollapsed', hide);
    if (S.tab === 'lives') layout();
  };
  $('#btn-toggle-bars')?.addEventListener('click', () => {
    const isHidden = bar?.classList.contains('bar-collapsed');
    setBarsCollapsed(!isHidden);
  });
  $('#btn-collapse-topbar')?.addEventListener('click', () => {
    setBarsCollapsed(true);
  });
  floatingRestore?.addEventListener('click', () => {
    setBarsCollapsed(false);
  });
  if (load('pf.barsCollapsed', false)) {
    setBarsCollapsed(true);
  }

  // Limpeza de cache e memória RAM não utilizada
  $('#btn-clean-ram')?.addEventListener('click', async () => {
    const btn = $('#btn-clean-ram');
    if (btn) btn.disabled = true;
    try {
      if (window.pf?.cleanRam) {
        await window.pf.cleanRam();
      }
      toast('✓ Memória RAM otimizada e caches temporários liberados.');
    } catch (_) {
      toast('Falha ao liberar memória.');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Atalho de teclado F10 para alternar barras / tela limpa
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F10') {
      e.preventDefault();
      const isHidden = bar?.classList.contains('bar-collapsed');
      setBarsCollapsed(!isHidden);
    }
  });

  $('#add-account').addEventListener('click', addAccount);
  $('#account-remove').addEventListener('click', () => { void removeAccount(); });
  $('#btn-toggle-game-actions')?.addEventListener('click', () => {
    S.gameActionsVisible = !S.gameActionsVisible;
    persist();
    if (gameActionsBar) {
      gameActionsBar.hidden = S.tab !== 'game' || !S.gameActionsVisible;
    }
    updateGameActionsToggleBtn();
  });
  $$('#target button').forEach((b) => b.addEventListener('click', () => setTarget(b.dataset.target)));

  const input = $('#channel-input');
  const add = () => { addChannels(input.value); input.value = ''; };
  $('#add-btn').addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  const cols = $('#columns');
  cols.append(el('option', { value: '0', text: 'Auto' }));
  for (let i = 1; i <= 8; i++) cols.append(el('option', { value: String(i), text: String(i) }));
  cols.value = String(S.columns);
  cols.addEventListener('change', () => { S.columns = Number(cols.value) || 0; persist(); layout(); });

  $('#reset-layout').addEventListener('click', () => { S.frames = {}; persist(); layout(); });

  const chatBtn = $('#chat-toggle');
  const paintChat = () => chatBtn.classList.toggle('on', S.showChat);
  paintChat();
  chatBtn.addEventListener('click', () => { S.showChat = !S.showChat; persist(); paintChat(); layout(); tiles.forEach((_t, id) => applyChatMode(id)); });

  const toggleVideoBtn = $('#toggle-video-view');
  const paintHideVideos = () => {
    if (toggleVideoBtn) {
      toggleVideoBtn.innerHTML = S.hideVideos
        ? '<span class="icon-svg icon-video-show"></span> Mostrar Vídeos'
        : '<span class="icon-svg icon-video-hide"></span> Ocultar Vídeos';
      toggleVideoBtn.classList.toggle('active', !!S.hideVideos);
    }
    $('#grid').classList.toggle('hide-videos', !!S.hideVideos);
  };
  paintHideVideos();
  toggleVideoBtn?.addEventListener('click', () => {
    S.hideVideos = !S.hideVideos;
    persist();
    paintHideVideos();
    layout();
  });

  const quality = $('#quality');
  quality.value = String(S.quality);
  quality.addEventListener('change', () => {
    S.quality = Number(quality.value) || 0;
    persist();
    tiles.forEach((t) => {
      // Kick no automático: recarrega para o player voltar a escolher sozinho
      if (!S.quality && /player\.kick\.com/.test(t.player.__pfSrc)) reloadWebview(t.player);
      else applyQuality(t.player);
    });
  });

  $('#mute-all').addEventListener('click', () => {
    all().forEach((e) => { e.i.muted = true; });
    persist();
    tiles.forEach((_t, id) => applyMute(id));
  });
  $('#follow-all')?.addEventListener('click', () => {
    void followAllOpenChannels();
  });
  $('#reload-all').addEventListener('click', () => {
    tiles.forEach(reloadTile);
    for (const item of economyViews.values()) reloadWebview(item.view);
  });
  $('#twitch-economy').addEventListener('change', e => { S.twitchEconomy = e.target.checked; syncTiles(); });
  $('#kick-economy').addEventListener('change', e => {
    S.kickEconomy = e.target.checked;
    persist();
    $('#kick-economy-help').hidden = !S.kickEconomy;
    for (const [id, t] of tiles) {
      if (t.p !== 'kick') continue;
      applyChatMode(id);
      if (!S.kickEconomy && !S.quality) reloadWebview(t.player);
      else applyQuality(t.player);
    }
  });
  $('#twitch-economy-reload').addEventListener('click', () => {
    for (const item of economyViews.values()) reloadWebview(item.view);
  });

  if (window.pf?.onLoginClosed) {
    window.pf.onLoginClosed(() => {
      void updateGameBarConnections();
      const accounts = S.accounts && S.accounts.length ? S.accounts : [{ id: 'main', name: 'Conta 1', main: true }];
      for (const acc of accounts) {
        const header = colHeaders.get(acc.id);
        if (header) updateAccountHeaderBadges(acc, header);
      }
    });
  }

  $('#account-login-twitch')?.addEventListener('click', () => {
    const a = currentAccount();
    window.pf.openLogin('twitch', accountPartition(a), a.name);
  });
  $('#account-clear-twitch')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const a = currentAccount();
    if (!a) return;
    if (window.confirm(`Desconectar a Twitch da conta "${a.name}"?`)) {
      await window.pf.clearConnection('twitch', accountPartition(a));
      toast(`Twitch desconectada de ${a.name}`);
      await updateGameBarConnections();
      syncTiles();
    }
  });

  $('#account-login-kick')?.addEventListener('click', () => {
    const a = currentAccount();
    window.pf.openLogin('kick', accountPartition(a), a.name);
  });
  $('#account-clear-kick')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const a = currentAccount();
    if (!a) return;
    if (window.confirm(`Desconectar a Kick da conta "${a.name}"?`)) {
      await window.pf.clearConnection('kick', accountPartition(a));
      toast(`Kick desconectada de ${a.name}`);
      await updateGameBarConnections();
      syncTiles();
    }
  });
  $$('[data-clear]').forEach((b) => b.addEventListener('click', () => {
    const w = b.dataset.clear;
    const removed = all().filter(e => w === 'all' || e.p === w).map(e => `${e.p}:${e.i.channel}`);
    S.ignoredGameChannels = [...new Set([...S.ignoredGameChannels, ...removed])];
    if (w === 'kick' || w === 'all') S.kick = [];
    if (w === 'twitch' || w === 'all') S.twitch = [];
    syncTiles();
  }));

  // Menus suspensos
  $$('.menu').forEach((m) => $('.menu-btn', m).addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !m.classList.contains('open');
    $$('.menu').forEach((x) => x.classList.remove('open'));
    m.classList.toggle('open', open);
  }));
  document.addEventListener('click', () => $$('.menu').forEach((x) => x.classList.remove('open')));

  $('#game-reload').addEventListener('click', () => {
    const g = games.get(currentAccount().id);
    if (g) reloadWebview(g.wv);
  });
  $('#game-open-sniper')?.addEventListener('click', () => {
    const a = currentAccount();
    if (a && window.pf?.openRotomCockpit) {
      window.pf.openRotomCockpit(a.id, a.name);
    }
  });
  $('#game-toggle-mosaic')?.addEventListener('click', () => toggleGameMosaic());
  $('#game-edge').addEventListener('click', () => window.pf.openEdge(GAME_URL));
  $('#game-login').addEventListener('click', () => {
    const a = currentAccount();
    window.pf.openGameLogin(a.main ? null : accountPartition(a));
    toast('Faça o login na janela que abriu. Depois clique em "Recarregar jogo".');
  });

  $('#alerts-on').addEventListener('change', (e) => { M.enabled = e.target.checked; save('pf.alertsOn', M.enabled); });
  $('#poll').addEventListener('change', (e) => {
    M.poll = Number(e.target.value) || 60;
    save('pf.poll', M.poll);
    if (game && game.__ready) game.executeJavaScript(`window.__pfPoll = ${M.poll}`).catch(() => {});
  });
  $('#test-notif').addEventListener('click', () => window.pf.notify('PokeIdle Hub', 'Teste de alerta: notificações funcionando.'));
  $('#open-samples').addEventListener('click', () => window.pf.openDataDir());
  $('#r-add').addEventListener('click', addRule);
  $('#r-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') addRule(); });
  $('#hits-clear').addEventListener('click', () => { M.hits = []; saveHits(); renderAlerts(); });

  window.pf.onOpenTab((tab) => setTab(tab));
  // Link de live clicado no jogo: vira bloco na aba Lives (o jogo continua aberto)
  window.pf.onAddLive(addFromGame);
  if (window.pf?.onRotomForwardToGame) {
    window.pf.onRotomForwardToGame(({ accId, message }) => {
      const g = games.get(accId);
      if (g && g.wv && typeof g.wv.send === 'function') {
        g.wv.send('rotom-cmd', message);
      }
    });
  }

  $('#chat-backdrop').addEventListener('click', collapseChat);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') collapseChat(); });
}

// ---------------- Link de live clicado no jogo ----------------

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

/** Vira bloco na aba Lives; o jogo continua aberto. */
function addFromGame(link) {
  const name = link.split('/').pop();
  const plat = link.includes('twitch.tv') ? 'Twitch' : 'Kick';
  const before = all().length;
  addChannels(link);
  toast(all().length > before ? `✓ ${name} (${plat}) adicionado às Lives` : `${name} já está nas Lives`);
}

// ---------------- Início ----------------

setupBar();
setTarget('kick');
setupGame();
renderAccountTabs();
importGameChannels();
scheduleLiveChecks();
setTab(S.tab);
renderAlerts();
