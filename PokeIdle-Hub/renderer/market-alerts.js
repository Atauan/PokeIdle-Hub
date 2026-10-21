'use strict';

(() => {
  function createMarketAlerts({ load, save, $, el, uid, policy, engine, notify, attention, writeSample }) {
    const state = {
      rules: load('pf.rules', []),
      hits: load('pf.hits', []),
      enabled: load('pf.alertsOn', true),
      poll: load('pf.poll', 60),
      seen: [],
      totalSeen: 0,
      lastCapture: null,
      endpoints: [],
      alerted: new Set(),
      history: {},
      samples: {},
    };
    const saveRules = () => save('pf.rules', state.rules);
    const saveHits = () => save('pf.hits', state.hits);
    const currencyLabel = (currency) => (currency === 'gems' ? 'gemas' : 'coins');

    function capture(message) {
      if (!message || typeof message !== 'object') return;
      const url = typeof message.url === 'string' ? message.url.slice(0, 500) : 'dom';
      if (url !== 'dom' && typeof message.sample === 'string') {
        const count = state.samples[url] || 0;
        if (count < 3) { state.samples[url] = count + 1; writeSample(url, message.sample); }
      }
      if (url !== 'dom' && !state.endpoints.includes(url)) state.endpoints = [...state.endpoints, url].slice(-10);
      state.lastCapture = new Date();

      const items = (Array.isArray(message.items) ? message.items : []).slice(0, 2000).map((data) => ({
        name: typeof data.name === 'string' ? data.name.slice(0, 80) : '',
        price: Number(data.price),
        currency: data.currency === 'gems' ? 'gems' : 'coins',
        shiny: data.shiny === true,
        id: data.id != null ? String(data.id).slice(0, 80) : null,
        source: url === 'dom' ? 'tela' : 'rede',
      })).filter((item) => item.name && Number.isFinite(item.price) && item.price > 0);

      if (items.length) engine.processItems(state, items, {
        policy,
        now: Date.now(),
        saveHits,
        notify,
        attention,
      });
      render();
    }

    const formatDate = (date) => new Date(date).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });

    function render() {
      $('#alerts-on').checked = !!state.enabled;
      $('#poll').value = String(state.poll);
      $('#market-status').textContent = state.lastCapture
        ? `Última leitura do mercado: ${state.lastCapture.toLocaleTimeString('pt-BR')} · ${state.totalSeen} anúncios lidos · ${state.endpoints.length} fonte(s) de rede`
        : 'Ainda não li o mercado. Abra o Market (Community Market) no jogo uma vez para o app aprender de onde vêm os anúncios.';

      const rules = $('#rules');
      rules.replaceChildren(...(state.rules.length ? state.rules.map((rule) => el('li', {},
        el('input', {
          type: 'checkbox', checked: rule.enabled, 'aria-label': 'Regra ligada',
          onchange: (event) => { rule.enabled = event.target.checked; saveRules(); },
        }),
        el('span', { class: 'grow', text: policy.ruleSummary(rule) }),
        el('button', {
          text: '🗑', title: 'Apagar regra', 'aria-label': 'Apagar regra',
          onclick: () => { state.rules = state.rules.filter((item) => item.id !== rule.id); saveRules(); render(); },
        }),
      )) : [el('li', { class: 'empty', text: 'Nenhuma regra ainda' })]));

      $('#seen').replaceChildren(...(state.seen.length ? state.seen.map((entry) => el('li', {},
        el('span', { class: 'grow', text: entry.item.shiny ? `✨ ${entry.item.name}` : entry.item.name }),
        el('span', { class: 'num', text: `${policy.formatAmount(entry.item.price)} ${currencyLabel(entry.item.currency)}` }),
        el('span', { class: 'muted small', text: entry.item.source }),
      )) : [el('li', { class: 'empty', text: 'Nada lido ainda' })]));

      $('#hits').replaceChildren(...(state.hits.length ? state.hits.map((hit) => el('li', { class: 'hit' },
        el('div', { class: 'row' },
          el('strong', { class: 'grow', text: hit.shiny ? `✨ ${hit.name}` : hit.name }),
          el('span', { class: 'num', text: `${policy.formatAmount(hit.price)} ${currencyLabel(hit.currency)}` })),
        el('div', { class: 'muted small', text: `${formatDate(hit.date)} · ${hit.rule}${hit.average != null ? ` · média ${policy.formatAmount(hit.average)}` : ''}` }),
      )) : [el('li', { class: 'empty', text: 'Nada ainda. Quando um anúncio bater numa regra, aparece aqui e como notificação.' })]));
    }

    function addRule() {
      const below = Number($('#r-below').value) || 0;
      state.rules.push({
        id: uid(),
        name: $('#r-name').value.trim().slice(0, 60),
        maxCoins: policy.parseAmount($('#r-coins').value),
        maxGems: policy.parseAmount($('#r-gems').value),
        belowAvg: below > 0 ? below : null,
        shinyOnly: $('#r-shiny').checked,
        enabled: true,
      });
      saveRules();
      $('#r-name').value = ''; $('#r-coins').value = ''; $('#r-gems').value = '';
      $('#r-below').value = '0'; $('#r-shiny').checked = false;
      render();
    }

    function setEnabled(enabled) {
      state.enabled = enabled;
      save('pf.alertsOn', state.enabled);
    }

    function setPoll(value) {
      state.poll = Number(value) || 60;
      save('pf.poll', state.poll);
      return state.poll;
    }

    function clearHits() {
      state.hits = [];
      saveHits();
      render();
    }

    function bind({ onPollChanged = () => {}, testNotification = () => {}, openSamples = () => {} } = {}) {
      $('#alerts-on').addEventListener('change', event => setEnabled(event.target.checked));
      $('#poll').addEventListener('change', event => onPollChanged(setPoll(event.target.value)));
      $('#test-notif').addEventListener('click', testNotification);
      $('#open-samples').addEventListener('click', openSamples);
      $('#r-add').addEventListener('click', addRule);
      $('#r-name').addEventListener('keydown', event => {
        if (event.key === 'Enter') addRule();
      });
      $('#hits-clear').addEventListener('click', clearHits);
    }

    return {
      bind,
      capture,
      render,
      addRule,
      setEnabled,
      setPoll,
      clearHits,
      get poll() { return state.poll; },
    };
  }

  const api = { createMarketAlerts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.PF = window.PF || {};
    window.PF.MarketAlerts = api;
  }
})();
