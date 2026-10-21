'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createElectronSessionService } = require('../electron-session-service');

function setup({ packaged = false, existing = new Set(['game-channels.js', 'game-session.js', 'pokeidle-hunt.js', 'twitch-economy.js', 'kick-economy.js', 'rotom-addon.js']) } = {}) {
  const sessions = new Map();
  const registrations = [];
  const exists = [];
  const purposes = new Map();
  const service = createElectronSessionService({
    session: {
      fromPartition: partition => {
        if (!sessions.has(partition)) {
          const current = {
            userAgents: [],
            beforeRequest: [],
            unregistered: [],
            preloads: [],
            setUserAgent: userAgent => current.userAgents.push(userAgent),
            webRequest: {
              onBeforeRequest: callback => current.beforeRequest.push(callback),
            },
            unregisterPreloadScript: id => current.unregistered.push(id),
            registerPreloadScript: preload => current.preloads.push(preload),
          };
          sessions.set(partition, current);
        }
        return sessions.get(partition);
      },
    },
    isPackaged: packaged,
    resourcesPath: 'C:/App/resources',
    appDirectory: 'C:/App/app',
    existsSync: filePath => {
      exists.push(filePath);
      return existing.has(filePath.split(/[\\/]/).pop());
    },
    joinPath: (...parts) => parts.join('/'),
    userAgent: 'test-UA',
    getContentPurpose: id => purposes.get(id) || null,
  });
  return { service, sessions, registrations, exists, purposes };
}

test('configures each account partition once with user-agent and live request filter', () => {
  const context = setup();
  context.service.setupSession('persist:pokeidlehub');
  context.service.setupSession('persist:pokeidlehub');
  context.service.setupSession('persist:pokeidlehub-acc-alpha');
  const primary = context.sessions.get('persist:pokeidlehub');
  const extra = context.sessions.get('persist:pokeidlehub-acc-alpha');
  assert.notEqual(extra, primary);
  assert.deepEqual([...context.service.configuredPartitions], ['persist:pokeidlehub', 'persist:pokeidlehub-acc-alpha']);
  for (const session of [primary, extra]) {
    assert.deepEqual(session.userAgents, ['test-UA']);
    assert.equal(session.beforeRequest.length, 1);
    assert.equal(session.preloads.length, 6);
  }
});

test('does not install a request-header rewriting hook', () => {
  const context = setup();
  const { service } = context;
  service.setupSession('persist:pokeidlehub');
  const session = context.sessions.get('persist:pokeidlehub');
  assert.equal('beforeSendHeaders' in session, false);
});

test('applies request filters only to registered live contents and permits other content', () => {
  const context = setup();
  const { service, purposes } = context;
  service.setupSession('persist:pokeidlehub');
  const session = context.sessions.get('persist:pokeidlehub');
  const decide = (url, resourceType = 'image', webContentsId) => {
    let result;
    session.beforeRequest[0]({ url, resourceType, webContentsId }, value => { result = value; });
    return result;
  };
  purposes.set(21, 'live-player');
  assert.deepEqual(decide('https://www.facebook.com/track', 'image', 21), { cancel: true });
  assert.deepEqual(decide('https://use1-turn.fpjs.io/api', 'image', 21), { cancel: true });
  assert.deepEqual(decide('https://s.amazon-adsystem.com/ads', 'subFrame', 21), { cancel: true });
  assert.deepEqual(decide('https://s.amazon-adsystem.com/ads', 'mainFrame', 21), { cancel: false });
  assert.deepEqual(decide('https://twitch.tv/channel', 'image', 21), { cancel: false });
  assert.deepEqual(decide('invalid-url', 'image', 21), { cancel: false });
  purposes.set(22, 'auth-window');
  assert.deepEqual(decide('https://www.facebook.com/track', 'image', 22), { cancel: false });
  assert.deepEqual(decide('https://www.facebook.com/track', 'image', 23), { cancel: false });
  assert.deepEqual(decide('https://www.facebook.com/track', 'image', undefined), { cancel: false });
});

test('uses unpacked preloads when packaged and source paths in development', () => {
  const packaged = setup({ packaged: true, existing: new Set(['game-channels.js']) });
  packaged.service.setupSession('persist:pokeidlehub');
  const session = packaged.sessions.get('persist:pokeidlehub');
  assert.deepEqual(session.preloads, [{ id: 'pf-game-channels', type: 'frame', filePath: 'C:/App/resources/app.asar.unpacked/game-channels.js' }]);
  assert.deepEqual(session.unregistered, ['pf-game-channels']);

  const development = setup({ existing: new Set(['game-session.js']) });
  development.service.setupSession('persist:pokeidlehub');
  const devSession = development.sessions.get('persist:pokeidlehub');
  assert.deepEqual(devSession.preloads, [{ id: 'pf-game-session', type: 'frame', filePath: 'C:/App/app/game-session.js' }]);
});
