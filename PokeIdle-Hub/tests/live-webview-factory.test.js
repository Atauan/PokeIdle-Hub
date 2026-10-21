'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveWebviewFactory } = require('../renderer/live-webview-factory');

function setup() {
  const events = [];
  const timers = new Map();
  const queued = [];
  const webviews = [];
  let nextTimer = 1;
  let nextQueue = 1;
  const document = {
    createElement(tag) {
      const listeners = new Map();
      const attributes = new Map();
      const element = {
        tag,
        attributes,
        children: [],
        classList: {
          add: name => events.push(['class-add', name]),
          remove: name => events.push(['class-remove', name]),
        },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
        addEventListener(name, callback) {
          const callbacks = listeners.get(name) || [];
          callbacks.push(callback);
          listeners.set(name, callbacks);
        },
        dispatch(name, event = {}) {
          for (const callback of listeners.get(name) || []) callback(event);
        },
        append(...children) { this.children.push(...children); },
        loadURL(url) { this.loadedUrl = url; },
        reload() { this.reloads = (this.reloads || 0) + 1; },
        setAudioMuted(value) { this.audioMuted = value; },
        isLoading() { return this.loading === true; },
        isConnected: true,
      };
      if (tag === 'webview') webviews.push(element);
      return element;
    },
  };
  const createElement = (tag, props = {}, ...children) => {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(props)) {
      if (name === 'class') element.className = value;
      else if (name === 'text') element.textContent = value;
      else if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
      else element.setAttribute(name, value === true ? '' : String(value));
    }
    element.append(...children.flat().filter(child => child != null));
    return element;
  };
  const factory = createLiveWebviewFactory({
    document,
    el: createElement,
    primaryPartition: 'persist:pokeidlehub',
    enqueueLoad: run => {
      const id = nextQueue++;
      queued.push({ id, run, cancelled: false });
      return () => {
        queued.find(task => task.id === id).cancelled = true;
        events.push(['cancel-load', id]);
      };
    },
    setTimeoutFn: (callback, delay) => {
      const id = nextTimer++;
      timers.set(id, { callback, delay });
      return id;
    },
  });
  return { factory, events, timers, queued, webviews };
}

test('creates a queued webview with its partition, skeleton, audio state and ready callback', () => {
  const context = setup();
  const ready = [];
  const webview = context.factory.makeWebview('https://www.twitch.tv/channel', {
    partition: 'persist:pokeidlehub-acc-alt',
    muted: true,
    skeleton: 'chat',
    onReady: current => ready.push(current),
  });

  assert.equal(webview.getAttribute('partition'), 'persist:pokeidlehub-acc-alt');
  assert.equal(webview.getAttribute('allowpopups'), '');
  assert.equal(webview.getAttribute('webpreferences'), 'backgroundThrottling=no');
  assert.equal(webview.__pfSrc, 'https://www.twitch.tv/channel');
  assert.equal(webview.__ready, false);
  assert.equal(webview.__muted, true);
  assert.equal(webview.__skeleton.className, 'skeleton sk-chat');
  assert.equal(webview.getAttribute('src'), null);
  assert.equal(context.queued.length, 1);

  context.queued[0].run();
  assert.equal(webview.src, 'https://www.twitch.tv/channel');
  webview.dispatch('dom-ready');
  assert.equal(webview.__ready, true);
  assert.equal(webview.audioMuted, true);
  assert.deepEqual(ready, [webview]);

  const primary = context.factory.makeWebview('https://kick.com/main', { now: true });
  assert.equal(primary.getAttribute('partition'), 'persist:pokeidlehub');
});

test('retries only failed main-frame network requests after the existing delay', () => {
  const context = setup();
  const webview = context.factory.makeWebview('https://kick.com/channel', { now: true });

  webview.dispatch('did-fail-load', { isMainFrame: false, errorCode: -105 });
  webview.dispatch('did-fail-load', { isMainFrame: true, errorCode: -2 });
  assert.equal(context.timers.size, 0);

  webview.dispatch('did-fail-load', { isMainFrame: true, errorCode: -105, validatedURL: 'https://kick.com/redirected' });
  assert.equal(context.timers.size, 1);
  const retry = [...context.timers.values()][0];
  assert.equal(retry.delay, 30000);
  retry.callback();
  assert.equal(webview.loadedUrl, 'https://kick.com/redirected');

  webview.isConnected = false;
  webview.dispatch('did-fail-load', { isMainFrame: true, errorCode: -105 });
  [...context.timers.values()][0].callback();
  assert.equal(webview.loadedUrl, 'https://kick.com/redirected');
});

test('reloads unresponsive/crashed webviews and disposal cancels queued loads', () => {
  const context = setup();
  const webview = context.factory.makeWebview('https://www.twitch.tv/channel');

  webview.dispatch('unresponsive');
  assert.equal(webview.src, 'https://www.twitch.tv/channel');
  webview.dispatch('render-process-gone');
  const reload = [...context.timers.values()].find(timer => timer.delay === 2000);
  assert.ok(reload);
  webview.__ready = true;
  reload.callback();
  assert.equal(webview.reloads, 1);

  const pending = context.factory.makeWebview('https://www.twitch.tv/other');
  context.factory.disposeWebview(pending);
  assert.equal(context.queued[1].cancelled, true);
  assert.equal(pending.__pfCancelQueuedLoad, null);
});
