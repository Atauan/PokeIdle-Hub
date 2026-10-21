'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAppChromeControls } = require('../renderer/app-chrome-controls');

function setup(saved = {}) {
  const classes = () => ({
    values: new Set(),
    toggle(name, force) {
      const enabled = force === undefined ? !this.values.has(name) : force;
      if (enabled) this.values.add(name);
      else this.values.delete(name);
    },
    remove(name) { this.values.delete(name); },
    contains(name) { return this.values.has(name); },
  });
  const listeners = new Map();
  const events = [];
  const menus = ['menu-1', 'menu-2'].map(id => {
    const menu = {
      id,
      classList: classes(),
      querySelector(selector) { return this[selector === '.menu-btn' ? 'button' : 'list']; },
    };
    menu.button = {
      addEventListener: (name, listener) => listeners.set(`${id}:button:${name}`, listener),
    };
    menu.list = {
      addEventListener: (name, listener) => listeners.set(`${id}:list:${name}`, listener),
    };
    return menu;
  });
  const elements = new Map(['sidebar', 'sidebar-toggle', 'bar', 'update-bar', 'game-actions-bar', 'lives-actions-bar', 'bars-floating-restore', 'btn-toggle-bars', 'btn-collapse-topbar']
    .map(id => [id, {
      classList: classes(), hidden: false, textContent: '', title: '',
      addEventListener: (name, listener) => listeners.set(`${id}:${name}`, listener),
    }]));
  const documentObject = {
    querySelector: selector => elements.get(selector.slice(1)) || null,
    querySelectorAll: selector => selector === '.menu' ? menus : [],
    addEventListener: (name, listener) => listeners.set(`document:${name}`, listener),
  };
  const controls = createAppChromeControls({
    query: selector => documentObject.querySelector(selector),
    queryAll: selector => documentObject.querySelectorAll(selector),
    save: (key, value) => { saved[key] = value; events.push(['save', key, value]); },
    load: (key, fallback) => saved[key] ?? fallback,
    getTab: () => saved.tab || 'lives',
    layout: () => events.push(['layout']),
    documentObject,
  });
  return { controls, elements, events, listeners, menus, saved };
}

test('restores a saved collapsed sidebar and persists subsequent toggles', () => {
  const context = setup({ 'pf.sidebarCollapsed': true });
  context.controls.bind();
  assert.equal(context.elements.get('sidebar').classList.contains('collapsed'), true);
  assert.equal(context.elements.get('sidebar-toggle').textContent, '▶');

  context.listeners.get('sidebar-toggle:click')();
  assert.equal(context.elements.get('sidebar').classList.contains('collapsed'), false);
  assert.deepEqual(context.events, [['save', 'pf.sidebarCollapsed', true], ['layout'], ['save', 'pf.sidebarCollapsed', false], ['layout']]);
});

test('restores clean mode, toggles all bars, and handles F10 while preserving the game tab layout behavior', () => {
  const context = setup({ 'pf.barsCollapsed': true, tab: 'game' });
  context.controls.bind();
  for (const id of ['bar', 'update-bar', 'game-actions-bar', 'lives-actions-bar']) {
    assert.equal(context.elements.get(id).classList.contains('bar-collapsed'), true);
  }
  assert.equal(context.elements.get('bars-floating-restore').hidden, false);

  const event = { key: 'F10', preventDefault: () => context.events.push(['prevent-default']) };
  context.listeners.get('document:keydown')(event);
  assert.equal(context.elements.get('bar').classList.contains('bar-collapsed'), false);
  assert.deepEqual(context.events.slice(-2), [['prevent-default'], ['save', 'pf.barsCollapsed', false]]);
  assert.equal(context.events.some(([name]) => name === 'layout'), false);
});

test('only reflows lives on sidebar and clean-mode changes while ignoring other shortcut keys', () => {
  const context = setup();
  context.controls.bind();
  context.listeners.get('sidebar-toggle:click')();
  context.listeners.get('btn-toggle-bars:click')();
  context.listeners.get('document:keydown')({ key: 'F9', preventDefault() {} });
  assert.equal(context.events.filter(([name]) => name === 'layout').length, 2);

  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const moduleSource = fs.readFileSync(path.join(root, 'renderer', 'app-chrome-controls.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  assert.match(app, /createAppChromeControls/);
  assert.match(moduleSource, /queryAll\('\.menu'\)/);
  assert.equal([...app.matchAll(/appChromeControls\.bind\(\)/g)].length, 1);
  assert.doesNotMatch(app, /\$\$\('\.menu'\)/);
  assert.ok(html.indexOf('app-chrome-controls.js') < html.indexOf('app.js'));
});

test('opens one dropdown at a time, keeps menu-list clicks open, and closes menus on outside click', () => {
  const context = setup();
  context.controls.bind();

  let stopped = 0;
  context.listeners.get('menu-1:button:click')({ stopPropagation: () => { stopped += 1; } });
  assert.equal(context.menus[0].classList.contains('open'), true);

  context.listeners.get('menu-2:button:click')({ stopPropagation: () => { stopped += 1; } });
  assert.equal(context.menus[0].classList.contains('open'), false);
  assert.equal(context.menus[1].classList.contains('open'), true);

  context.listeners.get('menu-2:list:click')({ stopPropagation: () => { stopped += 1; } });
  assert.equal(context.menus[1].classList.contains('open'), true);
  assert.equal(stopped, 3);

  context.listeners.get('document:click')();
  assert.equal(context.menus.some(menu => menu.classList.contains('open')), false);
});
