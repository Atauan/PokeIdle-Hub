'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveToolbarControls } = require('../renderer/live-toolbar-controls');

function makeElement(dataset = {}) {
  const listeners = new Map();
  const classes = new Set();
  return {
    dataset,
    value: '',
    innerHTML: '',
    classList: {
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : !!force;
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
      contains: name => classes.has(name),
    },
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatch(name, event = {}) { listeners.get(name)?.(event); },
    append(option) { (this.options ??= []).push(option); },
  };
}

function setup() {
  const events = [];
  const elements = new Map();
  const targetButtons = [makeElement({ target: 'kick' }), makeElement({ target: 'twitch' })];
  for (const id of ['channel-input', 'add-btn', 'columns', 'reset-layout', 'chat-toggle', 'toggle-video-view', 'grid', 'quality', 'auto-lives', 'live-poll', 'check-lives', 'badge-lives', 'live-summary', 'universal-limit-kick', 'universal-limit-twitch', 'empty-title', 'empty-detail']) {
    elements.set(id, makeElement());
  }
  const state = { target: 'kick', columns: 0, frames: {}, showChat: true, hideVideos: false, quality: 160, autoLives: true, livePoll: 60, universalLimits: { kick: 2, twitch: 3 } };
  const tile = { player: { __pfSrc: 'https://player.kick.com/channel' } };
  const liveStates = new Map([['one', { status: 'live', open: true }], ['two', { status: 'unknown', open: false }]]);
  let discovery = { checking: false, refreshing: false, manualDiscoveryPending: false };
  let items = [{ i: { id: 'one' } }, { i: { id: 'two' } }];
  let economyViews = 0;
  let tileCount = 1;
  const controller = createLiveToolbarControls({
    query: selector => elements.get(selector.slice(1)),
    queryAll: selector => selector === '#target button' ? targetButtons : [],
    createElement: (_tag, options) => ({ ...options }),
    state,
    persist: () => events.push('persist'),
    layout: () => events.push('layout'),
    addChannels: value => events.push(['add', value]),
    tiles: new Map([['kick:channel', tile]]),
    applyChatMode: key => events.push(['chat-mode', key]),
    applyQuality: player => events.push(['quality', player]),
    reloadWebview: player => events.push(['reload', player]),
    getItems: () => items,
    liveStates,
    getDiscoveryState: () => discovery,
    getEconomyViewCount: () => economyViews,
    getTileCount: () => tileCount,
    onAutoLivesChanged: value => events.push(['auto-lives', value]),
    onPollingIntervalChanged: value => events.push(['live-poll', value]),
    onUniversalLimitChanged: (provider, value) => events.push(['limit', provider, value]),
    onCheckLives: () => events.push('check-lives'),
  });
  controller.bind();
  return {
    controller, events, elements, state, targetButtons, tile, liveStates,
    setDiscovery: value => { discovery = value; },
    setItems: value => { items = value; },
    setEconomy: (views, tiles) => { economyViews = views; tileCount = tiles; },
  };
}

test('binds manual channel entry to click and Enter and clears the input', () => {
  const context = setup();
  const input = context.elements.get('channel-input');
  input.value = 'https://kick.com/channel';
  context.elements.get('add-btn').dispatch('click');
  assert.deepEqual(context.events[0], ['add', 'https://kick.com/channel']);
  assert.equal(input.value, '');
  input.value = 'twitch-channel';
  input.dispatch('keydown', { key: 'Enter' });
  assert.deepEqual(context.events[1], ['add', 'twitch-channel']);
  assert.equal(input.value, '');
});

test('binds discovery and universal-limit controls through their injected actions', () => {
  const context = setup();
  context.elements.get('auto-lives').dispatch('change', { target: { checked: false } });
  context.elements.get('live-poll').dispatch('change', { target: { value: '300' } });
  context.elements.get('universal-limit-kick').dispatch('change', { target: { value: '3' } });
  context.elements.get('universal-limit-twitch').dispatch('change', { target: { value: '5' } });
  context.elements.get('check-lives').dispatch('click');

  assert.deepEqual(context.events, [
    ['auto-lives', false],
    ['live-poll', '300'],
    ['limit', 'kick', '3'],
    ['limit', 'twitch', '5'],
    'check-lives',
  ]);
});

test('preserves target selection, column options and reset-layout behavior', () => {
  const context = setup();
  context.controller.setTarget('twitch');
  assert.equal(context.state.target, 'twitch');
  assert.equal(context.targetButtons[0].classList.contains('on'), false);
  assert.equal(context.targetButtons[1].classList.contains('on'), true);

  const columns = context.elements.get('columns');
  assert.deepEqual(columns.options.map(option => option.value), ['0', '1', '2', '3', '4', '5', '6', '7', '8']);
  columns.value = '3';
  columns.dispatch('change');
  assert.equal(context.state.columns, 3);
  assert.deepEqual(context.events.slice(0, 2), ['persist', 'layout']);

  context.state.frames = { tile: { x: 1 } };
  context.elements.get('reset-layout').dispatch('click');
  assert.deepEqual(context.state.frames, {});
  assert.deepEqual(context.events.slice(-2), ['persist', 'layout']);
});

test('toggles chat and hidden video UI with the existing persistence and layout effects', () => {
  const context = setup();
  const chatButton = context.elements.get('chat-toggle');
  assert.equal(chatButton.classList.contains('on'), true);
  chatButton.dispatch('click');
  assert.equal(context.state.showChat, false);
  assert.deepEqual(context.events.slice(0, 3), ['persist', 'layout', ['chat-mode', 'kick:channel']]);
  assert.equal(chatButton.classList.contains('on'), false);

  context.elements.get('toggle-video-view').dispatch('click');
  assert.equal(context.state.hideVideos, true);
  assert.equal(context.elements.get('grid').classList.contains('hide-videos'), true);
  assert.equal(context.elements.get('toggle-video-view').classList.contains('active'), true);
  assert.match(context.elements.get('toggle-video-view').innerHTML, /Mostrar Vídeos/);
});

test('updates the selected quality and retains automatic-quality Kick reload behavior', () => {
  const context = setup();
  const quality = context.elements.get('quality');
  assert.equal(quality.value, '160');
  quality.value = '0';
  quality.dispatch('change');
  assert.equal(context.state.quality, 0);
  assert.equal(context.events[0], 'persist');
  assert.deepEqual(context.events[1], ['reload', context.tile.player]);
});

test('renders live counts, unknown status, polling state, limits, and empty-state guidance', () => {
  const context = setup();
  context.controller.renderStatus();
  assert.equal(context.elements.get('auto-lives').checked, true);
  assert.equal(context.elements.get('live-poll').value, '60');
  assert.equal(context.elements.get('check-lives').disabled, false);
  assert.equal(context.elements.get('badge-lives').textContent, '1');
  assert.equal(context.elements.get('badge-lives').hidden, false);
  assert.equal(context.elements.get('live-summary').textContent, '1 abertas · 1 sem confirmação');
  assert.equal(context.elements.get('universal-limit-kick').value, '2');
  assert.equal(context.elements.get('universal-limit-twitch').value, '3');
  assert.equal(context.elements.get('empty-title').textContent, 'Nenhuma live aberta no momento');

  context.setDiscovery({ checking: true, refreshing: false, manualDiscoveryPending: false });
  context.controller.renderStatus();
  assert.equal(context.elements.get('check-lives').disabled, true);
  assert.equal(context.elements.get('live-summary').textContent, 'Verificando canais…');
});

test('renders pending discovery and economic empty-state without channel names', () => {
  const context = setup();
  context.setDiscovery({ checking: false, refreshing: false, manualDiscoveryPending: true });
  context.setItems([]);
  context.controller.renderStatus();
  assert.equal(context.elements.get('live-summary').textContent, 'Abra o Pokeidle para carregar os canais');
  assert.equal(context.elements.get('empty-detail').textContent, 'Os canais oficiais são reconhecidos pelo jogo. Use Verificar agora para abrir os online.');

  context.setEconomy(1, 0);
  context.controller.renderStatus();
  assert.equal(context.elements.get('empty-title').textContent, 'Twitch em modo econômico');
  assert.equal(context.elements.get('empty-detail').textContent, 'Os canais usam o chat compartilhado. Acompanhe a conexão acima e os bônus na aba Pokeidle.');
});
