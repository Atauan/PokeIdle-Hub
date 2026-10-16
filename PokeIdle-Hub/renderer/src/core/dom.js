(() => {
  'use strict';
  // PokeIdle Hub — Módulo Central de Manipulação de DOM e Utilitários

  window.PF = window.PF || {};

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

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  // ---------------- WebViews Helpers ----------------

  const NET_ERRORS = new Set([-7, -21, -100, -101, -102, -103, -104, -105, -106, -109, -118, -130, -137]);
  const loadQueue = [];
  let loadTimer = null;

  function processLoadQueue() {
    clearTimeout(loadTimer);
    loadTimer = null;
    while (loadQueue.length) {
      const task = loadQueue.shift();
      if (task()) {
        if (loadQueue.length) loadTimer = setTimeout(processLoadQueue, 1500);
        return;
      }
    }
  }

  function enqueueLoad(task) {
    loadQueue.push(task);
    if (!loadTimer) loadTimer = setTimeout(processLoadQueue, 0);
  }

  function makeWebview(src, opts = {}) {
    const wv = el('webview', {
      class: opts.class || '',
      allowpopups: '',
      partition: opts.partition || 'persist:pokeidlehub',
      webpreferences: 'backgroundThrottling=no',
    });
    wv.__pfSrc = src;
    wv.__ready = false;
    wv.__muted = opts.muted || false;
    wv.__skeleton = skeleton(opts.skeleton || 'video');
    wv.afterInit = () => wv.before(wv.__skeleton);
    wv.addEventListener('did-start-loading', () => wv.__skeleton.classList.remove('gone'));
    wv.addEventListener('did-stop-loading', () => setTimeout(() => {
      let loading = false;
      try { loading = wv.isLoading(); } catch (_) { /* ainda não anexada */ }
      if (!loading) wv.__skeleton.classList.add('gone');
    }, 800));
    wv.addEventListener('dom-ready', () => {
      wv.__ready = true;
      wv.__skeleton.classList.add('gone');
      try { wv.setAudioMuted(wv.__muted); } catch (_) { /* ignora */ }
      if (opts.onReady) opts.onReady(wv);
    });
    wv.addEventListener('render-process-gone', () => setTimeout(() => reloadWebview(wv), 2000));
    wv.addEventListener('unresponsive', () => reloadWebview(wv));
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
    if (!wv || !wv.isConnected) return;
    try { wv.__ready ? wv.reload() : (wv.src = wv.__pfSrc); } catch (_) { wv.src = wv.__pfSrc; }
  }

  window.PF.DOM = {
    $, $$, el, load, save, uid, toast,
    NET_ERRORS, loadQueue, enqueueLoad, makeWebview, skeleton, reloadWebview
  };
})();
