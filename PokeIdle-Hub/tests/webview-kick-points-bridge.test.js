'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'webview-preload.js'), 'utf8');

function createPreloadContext({ hostname = 'kick.com', pathname = '/popout/channel/chat' } = {}) {
  const listeners = new Map();
  const injected = [];
  const sent = [];
  const documentListeners = new Map();
  const windowObject = {
    addEventListener(name, listener) {
      const handlers = listeners.get(name) || [];
      handlers.push(listener);
      listeners.set(name, handlers);
    },
  };
  const documentObject = {
    addEventListener(name, listener) {
      const handlers = documentListeners.get(name) || [];
      handlers.push(listener);
      documentListeners.set(name, handlers);
    },
    documentElement: { classList: { contains: () => false } },
  };
  const electron = {
    contextBridge: { executeInMainWorld: ({ func }) => injected.push(func) },
    ipcRenderer: { sendToHost: (...args) => sent.push(args) },
    webFrame: { executeJavaScript: async () => {} },
  };
  const context = {
    document: documentObject,
    location: { hostname, pathname },
    window: windowObject,
    require: name => {
      if (name === 'electron') return electron;
      throw new Error(`sandboxed preload cannot require ${name}`);
    },
  };
  vm.runInNewContext(preloadSource, context, { filename: 'webview-preload.js' });
  return { injected, listeners, sent, documentListeners, windowObject };
}

test('Kick popout preload injects the point observer and validates host reports before IPC', () => {
  const context = createPreloadContext();
  assert.ok(context.injected.some(fn => fn.name === 'installKickPointsMonitor'));
  const handler = context.listeners.get('message').at(-1);

  handler({ source: context.windowObject, data: { __pfKickPoints: { channel: 'channel', points: 1000 } } });
  handler({ source: context.windowObject, data: { __pfKickPoints: { channel: 'other', points: 9999 } } });
  handler({ source: context.windowObject, data: { __pfKickPoints: { channel: 'channel', points: -1 } } });
  handler({ source: {}, data: { __pfKickPoints: { channel: 'channel', points: 10 } } });

  assert.deepEqual(context.sent, [[
    'kick-points', { channel: 'channel', points: 1000 },
  ]]);
});

test('Kick chat still forwards clicks to open the expanded chat in a sandboxed preload', () => {
  const context = createPreloadContext();
  const pointerdown = context.documentListeners.get('pointerdown')?.[0];
  assert.equal(typeof pointerdown, 'function');
  pointerdown();
  assert.ok(context.sent.some(([channel]) => channel === 'chat-click'));
});

test('non-Kick webviews do not inject the Kick points observer', () => {
  const context = createPreloadContext({ hostname: 'www.twitch.tv', pathname: '/popout/channel/chat' });
  assert.equal(context.injected.some(fn => fn.name === 'installKickPointsMonitor'), false);
  assert.equal(context.listeners.has('message'), false);
});
