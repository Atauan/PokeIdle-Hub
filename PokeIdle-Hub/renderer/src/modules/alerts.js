(() => {
  'use strict';
  // PokeIdle Hub — Módulo de Alertas e Monitoramento do Community Market

  window.PF = window.PF || {};

  const { $, el, load, save, uid } = window.PF.DOM;

  function parseAmount(raw) {
    let s = String(raw || '').trim().toUpperCase().replace(/\s/g, '');
    if (!s) return null;
    let m = 1;
    const mult = { K: 1e3, M: 1e6, B: 1e9 }[s.slice(-1)];
    if (mult) { m = mult; s = s.slice(0, -1); }
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 6.039.587
    s = s.replace(',', '.');                                       // 4,4
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
    history: {}, // "nome|moeda" -> últimos preços
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
      const avg = average(item); // média antes de incluir este preço
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

  window.PF.Alerts = {
    M,
    saveRules,
    saveHits,
    onMarket,
    renderAlerts,
    addRule
  };
})();
