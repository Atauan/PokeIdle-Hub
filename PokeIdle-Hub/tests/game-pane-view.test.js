'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGamePaneHeader } = require('../renderer/game-pane-view');

function createElement(tag, props = {}, ...children) {
  const events = {};
  for (const [key, handler] of Object.entries(props)) {
    if (key.startsWith('on')) events[key.slice(2)] = handler;
  }
  return {
    tag,
    props,
    events,
    children: children.flat().filter(child => child && typeof child === 'object'),
    addEventListener(name, callback) { events[name] = callback; },
  };
}

function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}

test('game pane header delegates selection, zoom, cockpit, focus, and reload actions', () => {
  const calls = [];
  const account = { id: 'alt', name: 'Secundária' };
  const webview = { id: 'webview' };
  const header = createGamePaneHeader({
    account,
    webview,
    isMarket: true,
    createElement,
    selectAccount: id => calls.push(['select', id]),
    setTab: tab => calls.push(['tab', tab]),
    getZoom: id => id === 'alt' ? 1.25 : 1,
    adjustZoom: (id, delta) => calls.push(['adjust', id, delta]),
    setZoom: (id, factor) => calls.push(['setZoom', id, factor]),
    openCockpit: (id, name) => calls.push(['cockpit', id, name]),
    focusAccount: id => calls.push(['focus', id]),
    reloadWebview: target => calls.push(['reload', target]),
  });
  const nodes = descendants(header);
  const buttons = nodes.filter(node => node.tag === 'button');
  const zoomLevel = nodes.find(node => node.props.class === 'game-pane-zoom-level');
  const event = () => ({ stopped: false, stopPropagation() { this.stopped = true; } });

  assert.equal(header.props.class, 'game-pane-header');
  assert.equal(nodes.find(node => node.props.class === 'game-pane-name').props.text, 'Secundária');
  assert.equal(nodes.find(node => node.props.class === 'game-pane-tag').props.text, 'Principal');
  assert.equal(zoomLevel.props.text, '125%');

  header.events.click();
  const actions = buttons.map(button => {
    const click = event();
    button.events.click(click);
    return click;
  });
  const reset = event();
  zoomLevel.events.click(reset);

  assert.deepEqual(calls, [
    ['select', 'alt'],
    ['tab', 'game'],
    ['adjust', 'alt', -0.05],
    ['adjust', 'alt', 0.05],
    ['cockpit', 'alt', 'Secundária'],
    ['focus', 'alt'],
    ['reload', webview],
    ['setZoom', 'alt', 1],
  ]);
  assert.equal(reset.stopped, true);
  assert.ok(actions.every(click => click.stopped));
});

test('game pane header omits the primary badge for a secondary pane', () => {
  const header = createGamePaneHeader({
    account: { id: 'alt', name: 'Conta' },
    webview: {},
    isMarket: false,
    createElement,
    selectAccount() {},
    setTab() {},
    getZoom: () => 1,
    adjustZoom() {},
    setZoom() {},
    openCockpit() {},
    focusAccount() {},
    reloadWebview() {},
  });

  assert.equal(descendants(header).some(node => node.props.class === 'game-pane-tag'), false);
});
