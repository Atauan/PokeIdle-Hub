'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../renderer/market-alert-engine');
const policy = require('../renderer/market-alert-policy');

function createState(overrides = {}) {
  return {
    rules: [{ enabled: true, name: '', maxCoins: 100, maxGems: null, belowAvg: null, shinyOnly: false }],
    hits: [],
    enabled: true,
    seen: [],
    totalSeen: 0,
    alerted: new Set(),
    history: {},
    ...overrides,
  };
}

function captureEffects() {
  return { saves: 0, notifications: [], attentions: 0 };
}

function process(state, items, effects, now = 1000) {
  return engine.processItems(state, items, {
    policy,
    now,
    saveHits: () => { effects.saves += 1; },
    notify: (title, body) => effects.notifications.push({ title, body }),
    attention: () => { effects.attentions += 1; },
  });
}

test('deduplicates fresh market items by listing ID and normalized fallback key', () => {
  const state = createState();
  const effects = captureEffects();
  const items = [
    { id: 'lot-1', name: 'Caterpie', price: 20, currency: 'coins', shiny: false, source: 'rede' },
    { id: 'lot-1', name: 'Caterpie', price: 20, currency: 'coins', shiny: false, source: 'tela' },
    { id: null, name: 'Pikachu', price: 25, currency: 'coins', shiny: false, source: 'rede' },
    { id: null, name: 'PIKACHÚ', price: 25, currency: 'coins', shiny: false, source: 'tela' },
  ];

  process(state, items, effects);

  assert.equal(state.totalSeen, 2);
  assert.equal(state.seen.length, 2);
  assert.equal(effects.notifications.length, 2);
  assert.equal(effects.saves, 2);
  assert.equal(effects.attentions, 2);
});

test('records history while alerts are disabled and expires duplicate keys after ten minutes', () => {
  const state = createState({ enabled: false });
  const effects = captureEffects();
  const item = { id: 'lot-2', name: 'Eevee', price: 10, currency: 'coins', shiny: false, source: 'rede' };

  process(state, [item], effects, 1000);
  process(state, [item], effects, 600000);
  assert.equal(state.totalSeen, 1);
  process(state, [item], effects, 601001);

  assert.equal(state.totalSeen, 2);
  assert.deepEqual(state.history['eevee|coins'], [10, 10]);
  assert.equal(effects.notifications.length, 0);
  assert.equal(effects.saves, 0);
});

test('uses prior prices for average rules and keeps seen/history/hit retention limits', () => {
  const state = createState({
    rules: [{ enabled: true, name: '', maxCoins: null, maxGems: null, belowAvg: 20, shinyOnly: false }],
    history: { 'ditto|coins': [100, 100, 100, 100, 100] },
    hits: Array.from({ length: 300 }, (_, index) => ({ name: `old-${index}` })),
    seen: Array.from({ length: 60 }, (_, index) => ({ item: { name: `old-${index}` } })),
  });
  const effects = captureEffects();
  const items = Array.from({ length: 61 }, (_, index) => ({
    id: `lot-${index}`,
    name: 'Ditto',
    price: index === 0 ? 80 : 500,
    currency: 'coins',
    shiny: false,
    source: 'rede',
  }));

  process(state, items, effects, 5000);

  assert.equal(state.totalSeen, 61);
  assert.equal(state.seen.length, 60);
  assert.equal(state.seen[0].item.id, 'lot-0');
  assert.equal(state.history['ditto|coins'].length, 50);
  assert.equal(state.hits.length, 300);
  assert.equal(state.hits[0].average, 100);
  assert.equal(effects.notifications.length, 1);
  assert.equal(effects.notifications[0].body, '80 coins (média 100) · regra: Qualquer um · 20% abaixo da média');
});
