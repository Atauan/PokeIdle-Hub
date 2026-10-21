'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../renderer/market-alert-policy');

test('parseAmount preserves supported separators and suffixes', () => {
  assert.equal(policy.parseAmount('6.039.587'), 6039587);
  assert.equal(policy.parseAmount('4,4M'), 4400000);
  assert.equal(policy.parseAmount(''), null);
  assert.equal(policy.parseAmount('-3'), null);
});

test('ruleSummary keeps existing Portuguese labels and order', () => {
  assert.equal(policy.ruleSummary({
    name: 'Charizard',
    shinyOnly: true,
    maxCoins: 1500,
    maxGems: 2,
    belowAvg: 20,
  }), 'Charizard · só shiny · ≤ 1,5K coins · ≤ 2 gemas · 20% abaixo da média');
  assert.equal(policy.ruleSummary({}), 'Qualquer um');
});

test('average uses at least five previous prices for the same normalized item and currency', () => {
  const history = { 'caterpie|coins': [10, 20, 30, 40, 50, 60] };
  assert.equal(policy.average({ name: 'Caterpié', currency: 'coins' }, history), 35);
  assert.equal(policy.average({ name: 'Caterpie', currency: 'gems' }, history), null);
  assert.equal(policy.average({ name: 'Caterpie', currency: 'coins' }, {}), null);
});

test('matches preserves name, shiny, currency caps and below-average rules', () => {
  const item = { name: 'Charizard', currency: 'coins', price: 80, shiny: true };
  assert.equal(policy.matches({ enabled: true, name: 'char', shinyOnly: true, maxCoins: 100 }, item, null), true);
  assert.equal(policy.matches({ enabled: true, shinyOnly: true }, { ...item, shiny: false }, null), false);
  assert.equal(policy.matches({ enabled: true, maxGems: 100 }, item, null), false);
  assert.equal(policy.matches({ enabled: true, belowAvg: 20 }, item, 100), true);
  assert.equal(policy.matches({ enabled: false }, item, null), false);
});
