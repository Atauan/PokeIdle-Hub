'use strict';

(() => {
  function processItems(state, items, effects) {
    const { policy, now, saveHits, notify, attention } = effects;
    if (!state.recentSeenMap) state.recentSeenMap = new Map();
    for (const [key, timestamp] of state.recentSeenMap) {
      if (now - timestamp > 600000) state.recentSeenMap.delete(key);
    }

    const fresh = [];
    for (const item of items) {
      const key = item.id != null
        ? `id:${item.id}`
        : `${policy.normalizeName(item.name)}|${item.currency}|${item.price}|${item.shiny ? 1 : 0}`;
      if (state.recentSeenMap.has(key)) continue;
      state.recentSeenMap.set(key, now);
      fresh.push(item);
    }

    if (!fresh.length) return;

    state.totalSeen += fresh.length;
    state.seen = [...fresh.map((item) => ({ date: now, item })), ...state.seen].slice(0, 60);

    for (const item of fresh) {
      const average = policy.average(item, state.history);
      const historyKey = `${policy.normalizeName(item.name)}|${item.currency}`;
      state.history[historyKey] = [...(state.history[historyKey] || []), item.price].slice(-50);

      if (!state.enabled) continue;
      const rule = state.rules.find((candidate) => policy.matches(candidate, item, average));
      if (!rule) continue;
      const alertKey = item.id != null ? `id:${item.id}` : `${historyKey}|${item.price}|${item.shiny ? 1 : 0}`;
      if (state.alerted.has(alertKey)) continue;
      if (state.alerted.size > 20000) state.alerted.clear();
      state.alerted.add(alertKey);

      const summary = policy.ruleSummary(rule);
      state.hits.unshift({
        date: now,
        name: item.name,
        price: item.price,
        currency: item.currency,
        shiny: item.shiny,
        rule: summary,
        average,
      });
      if (state.hits.length > 300) state.hits.length = 300;
      saveHits();

      let body = `${policy.formatAmount(item.price)} ${item.currency === 'gems' ? 'gemas' : 'coins'}`;
      if (average != null) body += ` (média ${policy.formatAmount(average)})`;
      body += ` · regra: ${summary}`;
      notify(`${item.shiny ? '✨ ' : ''}${item.name} no mercado`, body);
      attention();
    }
  }

  const api = { processItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.PF = window.PF || {};
    window.PF.MarketAlertEngine = api;
  }
})();
