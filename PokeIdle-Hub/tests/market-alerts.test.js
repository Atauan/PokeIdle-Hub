'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketAlerts } = require('../renderer/market-alerts');
const policy = require('../renderer/market-alert-policy');
const engine = require('../renderer/market-alert-engine');

function setup(initial = {}) {
  const stored = new Map(Object.entries(initial));
  const selectors = [
    '#alerts-on', '#poll', '#market-status', '#rules', '#seen', '#hits',
    '#r-below', '#r-name', '#r-coins', '#r-gems', '#r-shiny',
    '#test-notif', '#open-samples', '#r-add', '#hits-clear',
  ];
  const nodes = Object.fromEntries(selectors.map((selector) => {
    const listeners = new Map();
    return [selector, {
      value: '', checked: false, textContent: '', children: [],
      replaceChildren(...children) { this.children = children; },
      addEventListener(name, listener) { listeners.set(name, listener); },
      dispatch(name, event = {}) { listeners.get(name)?.(event); },
    }];
  }));
  const effects = { samples: [], notifications: [], attentions: 0 };
  const alerts = createMarketAlerts({
    load: (key, fallback) => stored.has(key) ? stored.get(key) : fallback,
    save: (key, value) => stored.set(key, value),
    $: (selector) => nodes[selector],
    el: (tag, props = {}, ...children) => ({ tag, props, children: children.flat() }),
    uid: () => 'rule-1',
    policy,
    engine,
    notify: (title, body) => effects.notifications.push({ title, body }),
    attention: () => { effects.attentions += 1; },
    writeSample: (url, sample) => effects.samples.push({ url, sample }),
  });
  return { alerts, stored, nodes, effects };
}

test('market alert module loads existing settings and renders the initial state', () => {
  const { alerts, nodes } = setup({
    'pf.alertsOn': false,
    'pf.poll': 30,
    'pf.rules': [{ id: 'existing', enabled: true, name: 'Pikachu' }],
    'pf.hits': [{ date: 1, name: 'Pikachu', price: 10, currency: 'coins', rule: 'Pikachu' }],
  });

  alerts.render();

  assert.equal(alerts.poll, 30);
  assert.equal(nodes['#alerts-on'].checked, false);
  assert.equal(nodes['#poll'].value, '30');
  assert.equal(nodes['#rules'].children.length, 1);
  assert.equal(nodes['#hits'].children.length, 1);
  assert.match(nodes['#market-status'].textContent, /Ainda não li o mercado/);
});

test('market alert module persists setting changes and adds a rule using existing form semantics', () => {
  const { alerts, stored, nodes } = setup();
  nodes['#r-name'].value = '  Charizard  ';
  nodes['#r-coins'].value = '6.039.587';
  nodes['#r-gems'].value = '4,4M';
  nodes['#r-below'].value = '15';
  nodes['#r-shiny'].checked = true;

  alerts.setEnabled(false);
  alerts.setPoll('120');
  alerts.addRule();

  assert.equal(stored.get('pf.alertsOn'), false);
  assert.equal(stored.get('pf.poll'), 120);
  assert.deepEqual(stored.get('pf.rules'), [{
    id: 'rule-1', name: 'Charizard', maxCoins: 6039587, maxGems: 4400000,
    belowAvg: 15, shinyOnly: true, enabled: true,
  }]);
  assert.equal(nodes['#r-name'].value, '');
  assert.equal(nodes['#r-below'].value, '0');
  assert.equal(nodes['#r-shiny'].checked, false);
});

test('market alert feature owns control listeners and delegates shell side effects', () => {
  const { alerts, stored, nodes } = setup({
    'pf.hits': [{ date: 1, name: 'old', price: 5, currency: 'coins', rule: 'old' }],
  });
  const sideEffects = [];
  alerts.bind({
    onPollChanged: value => sideEffects.push(['poll', value]),
    testNotification: () => sideEffects.push('notification'),
    openSamples: () => sideEffects.push('samples'),
  });

  nodes['#alerts-on'].dispatch('change', { target: { checked: false } });
  nodes['#poll'].dispatch('change', { target: { value: '120' } });
  nodes['#test-notif'].dispatch('click');
  nodes['#open-samples'].dispatch('click');
  nodes['#r-add'].dispatch('click');
  nodes['#r-name'].dispatch('keydown', { key: 'Enter' });
  nodes['#hits-clear'].dispatch('click');

  assert.equal(stored.get('pf.alertsOn'), false);
  assert.equal(stored.get('pf.poll'), 120);
  assert.equal(stored.get('pf.rules').length, 2);
  assert.deepEqual(stored.get('pf.hits'), []);
  assert.deepEqual(sideEffects, [['poll', 120], 'notification', 'samples']);
});

test('market capture bounds samples, normalizes items, renders status, and delegates effects', () => {
  const { alerts, nodes, effects } = setup({
    'pf.rules': [{ enabled: true, name: '', maxCoins: 100, maxGems: null, belowAvg: null, shinyOnly: false }],
  });
  for (let index = 0; index < 4; index += 1) {
    alerts.capture({
      url: 'https://market.example/api',
      sample: `sample-${index}`,
      items: [{ id: `listing-${index}`, name: 'Pikachu', price: 20, currency: 'coins' }],
    });
  }

  assert.equal(effects.samples.length, 3);
  assert.equal(effects.notifications.length, 4);
  assert.equal(effects.attentions, 4);
  assert.equal(nodes['#seen'].children.length, 4);
  assert.match(nodes['#market-status'].textContent, /4 anúncios lidos · 1 fonte\(s\) de rede/);
});

test('market capture ignores invalid messages and clearHits empties only saved alert history', () => {
  const existingHits = [{ date: 1, name: 'old', price: 10, currency: 'coins', rule: 'x' }];
  const { alerts, stored, nodes } = setup({ 'pf.hits': existingHits, 'pf.rules': [{ id: 'keep', enabled: true }] });
  alerts.capture(null);
  alerts.capture({ items: [{ name: '', price: -1 }] });
  alerts.clearHits();

  assert.deepEqual(stored.get('pf.hits'), []);
  assert.deepEqual(stored.get('pf.rules'), [{ id: 'keep', enabled: true }]);
  assert.equal(nodes['#hits'].children.length, 1);
  assert.match(nodes['#hits'].children[0].props.text, /Nada ainda/);
});
