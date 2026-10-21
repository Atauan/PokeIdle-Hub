'use strict';

(() => {
  const api = (() => {
    function parseAmount(raw) {
      let value = String(raw || '').trim().toUpperCase().replace(/\s/g, '');
      if (!value) return null;
      let multiplier = 1;
      const suffix = { K: 1e3, M: 1e6, B: 1e9 }[value.slice(-1)];
      if (suffix) { multiplier = suffix; value = value.slice(0, -1); }
      if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '');
      value = value.replace(',', '.');
      const number = Number(value);
      return value !== '' && Number.isFinite(number) && number > 0 ? number * multiplier : null;
    }

    function formatAmount(value) {
      const format = (number) => (Number.isInteger(number) ? String(number) : number.toFixed(1).replace('.', ','));
      if (value >= 1e9) return `${format(value / 1e9)}B`;
      if (value >= 1e6) return `${format(value / 1e6)}M`;
      if (value >= 1e3) return `${format(value / 1e3)}K`;
      return format(value);
    }

    const normalizeName = (name) => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    function ruleSummary(rule) {
      const parts = [rule.name ? rule.name : 'Qualquer um'];
      if (rule.shinyOnly) parts.push('só shiny');
      if (rule.maxCoins) parts.push(`≤ ${formatAmount(rule.maxCoins)} coins`);
      if (rule.maxGems) parts.push(`≤ ${formatAmount(rule.maxGems)} gemas`);
      if (rule.belowAvg) parts.push(`${rule.belowAvg}% abaixo da média`);
      return parts.join(' · ');
    }

    function average(item, history) {
      const prices = history[`${normalizeName(item.name)}|${item.currency}`] || [];
      return prices.length >= 5 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null;
    }

    function matches(rule, item, avg) {
      if (!rule.enabled) return false;
      if (rule.name && !normalizeName(item.name).includes(normalizeName(rule.name))) return false;
      if (rule.shinyOnly && !item.shiny) return false;
      if (!rule.maxCoins && !rule.maxGems && !rule.belowAvg) return true;
      if (item.currency === 'coins' && rule.maxCoins && item.price <= rule.maxCoins) return true;
      if (item.currency === 'gems' && rule.maxGems && item.price <= rule.maxGems) return true;
      if (rule.belowAvg && avg != null && item.price <= avg * (1 - rule.belowAvg / 100)) return true;
      return false;
    }

    return { parseAmount, formatAmount, normalizeName, ruleSummary, average, matches };
  })();

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.PF = window.PF || {};
    window.PF.MarketAlertPolicy = api;
  }
})();
