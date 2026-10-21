'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGamePaneFactory } = require('../renderer/game-pane-factory');

function setup({ failZoom = false } = {}) {
  const calls = [];
  const account = { id: 'alt', name: 'Secundária' };
  const market = true;
  const skeleton = { type: 'skeleton' };
  let zoom = 1.15;
  let webviewOptions;
  let webview;
  const panel = { children: [], append(pane) { this.children.push(pane); } };
  const factory = createGamePaneFactory({
    gameUrl: 'https://pokeidle.io/',
    makeWebview: (url, options) => {
      webviewOptions = options;
      calls.push(['make-webview', url, options]);
      webview = {
        __skeleton: skeleton,
        listeners: new Map(),
        addEventListener(name, callback) { this.listeners.set(name, callback); },
        setZoomFactor(value) {
          calls.push(['zoom', value]);
          if (failZoom) throw new Error('destroyed');
        },
        executeJavaScript: async source => { calls.push(['script', source]); },
      };
      return webview;
    },
    accountPartition: value => `persist:${value.id}`,
    getZoom: () => zoom,
    getMarketPoll: () => 45,
    applyFpsLimits: () => calls.push(['fps-limits']),
    bindGameWebviewEvents: options => calls.push(['bind-events', options]),
    createHeader: (value, view, isMarket) => {
      const header = { type: 'header' };
      calls.push(['header', value, view, isMarket, header]);
      return header;
    },
    createElement: (tag, props, ...children) => ({ tag, props, children }),
    getPanel: () => panel,
  });
  return {
    account,
    calls,
    factory,
    market,
    panel,
    setZoom: value => { zoom = value; },
    getWebview: () => webview,
    getWebviewOptions: () => webviewOptions,
    skeleton,
  };
}

test('creates an account-bound game pane and preserves ready and DOM-ready effects', async () => {
  const context = setup();
  const result = context.factory.create(context.account, context.market);
  const webview = context.getWebview();

  assert.deepEqual(context.calls[0], ['make-webview', 'https://pokeidle.io/', context.getWebviewOptions()]);
  assert.equal(context.getWebviewOptions().partition, 'persist:alt');
  assert.equal(context.getWebviewOptions().muted, false);
  assert.equal(context.getWebviewOptions().now, true);
  assert.equal(context.getWebviewOptions().skeleton, 'game');
  assert.equal(result.wv, webview);
  assert.equal(result.market, true);
  assert.deepEqual(result.pane.children, [context.calls.find(([type]) => type === 'header')[4], webview, context.skeleton]);
  assert.equal(context.panel.children[0], result.pane);

  await context.getWebviewOptions().onReady(webview);
  assert.ok(context.calls.some(([type, source]) => type === 'script' && source === 'window.__pfPoll = 45'));
  assert.ok(context.calls.some(([type]) => type === 'fps-limits'));
  assert.ok(context.calls.some(([type, value]) => type === 'zoom' && value === 1.15));

  context.setZoom(1.3);
  webview.listeners.get('dom-ready')();
  assert.equal(context.calls.filter(([type]) => type === 'zoom').at(-1)[1], 1.3);

  const eventBinding = context.calls.find(([type]) => type === 'bind-events')[1];
  assert.equal(eventBinding.webview, webview);
  assert.equal(eventBinding.account, context.account);
  assert.equal(eventBinding.market, true);
});

test('ignores zoom failures when a game webview is already destroyed', async () => {
  const context = setup({ failZoom: true });
  context.factory.create(context.account, false);

  await assert.doesNotReject(context.getWebviewOptions().onReady(context.getWebview()));
  assert.doesNotThrow(() => context.getWebview().listeners.get('dom-ready')());
});
