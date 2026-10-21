'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createProviderConnectionBadges } = require('../renderer/provider-connection-badges');

function setup({ status, cachedStatus = status, isSelected = false } = {}) {
  const calls = [];
  const account = { id: 'alt', name: 'Secundária' };
  const gameBarButtons = new Map(['twitch', 'kick'].flatMap(provider => [
    [`login-${provider}`, { textContent: '', style: {}, title: '', hidden: true }],
    [`clear-${provider}`, { hidden: true }],
  ]));
  const badgeNodes = [];
  const header = {
    children: [],
    querySelector(selector) {
      if (selector === '.account-col-badges') return this.badges || null;
      return null;
    },
    append(node) {
      this.children.push(node);
      if (node.className === 'account-col-badges') this.badges = node;
    },
  };
  const el = (tag, props = {}) => {
    const node = {
      tag,
      ...props,
      className: props.class || '',
      children: [],
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = [...children]; badgeNodes.splice(0, badgeNodes.length, ...children); },
    };
    return node;
  };
  const connectionState = { value: status };
  const connections = {
    getCached: id => { calls.push(['cached', id]); return cachedStatus; },
    read: async (value, options) => { calls.push(['read', value.id, options]); return connectionState.value; },
    invalidate: id => calls.push(['invalidate', id]),
  };
  const view = createProviderConnectionBadges({
    el,
    getElement: selector => gameBarButtons.get(selector.replace(/^#account-/, '')),
    getCurrentAccount: () => account,
    connections,
    getProviderState: (value, provider) => value?.unavailableProviders?.includes(provider)
      ? 'unavailable'
      : value?.[provider] === true ? 'connected' : 'disconnected',
    partitionForAccount: value => `persist:pokeidlehub-acc-${value.id}`,
    openLogin: (...args) => calls.push(['login', ...args]),
    getHeader: id => { calls.push(['header', id]); return header; },
    isSelectedAccount: id => isSelected && id === account.id,
    syncTiles: () => calls.push(['sync-tiles']),
    queueMicrotask: callback => { calls.push(['queue-sync']); callback(); },
  });
  return { account, badgeNodes, calls, connectionState, gameBarButtons, header, view };
}

test('renders connected and disconnected badges with account-specific login action', async () => {
  const context = setup({ status: { twitch: true, kick: false, unavailableProviders: [] } });
  await context.view.render(context.account, context.header);

  assert.deepEqual(context.header.badges.children.map(node => [node.tag, node.textContent || node.text]), [
    ['span', 'Twitch ✓'],
    ['button', '+ Kick'],
  ]);
  assert.match(context.header.badges.children[0].title, /Secundária/);
  let stopped = false;
  context.header.badges.children[1].onclick({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.ok(context.calls.some(call => call[0] === 'login' && call[1] === 'kick' && call[2] === 'persist:pokeidlehub-acc-alt' && call[3] === 'Secundária'));
});

test('renders unavailable as retry and refreshes only the affected account', async () => {
  const unavailable = { twitch: false, kick: false, unavailableProviders: ['twitch', 'kick'] };
  const context = setup({ status: unavailable });
  await context.view.render(context.account, context.header);

  const retry = context.header.badges.children[0];
  assert.equal(retry.text, 'Twitch ?');
  assert.match(retry.title, /Clique para tentar novamente/);
  retry.onclick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(context.calls.some(call => call[0] === 'invalidate' && call[1] === 'alt'));
  assert.ok(context.calls.some(call => call[0] === 'read' && call[1] === 'alt' && call[2]?.refresh === true));
  assert.ok(context.calls.some(call => call[0] === 'sync-tiles'));
  assert.equal(context.calls.some(call => call[0] === 'login'), false);
});

test('updates game bar login and disconnect controls for connected, unavailable, and disconnected providers', async () => {
  const context = setup({ status: { twitch: true, kick: false, unavailableProviders: ['kick'] } });

  await context.view.updateGameBarConnections();

  assert.deepEqual(context.calls.find(call => call[0] === 'read'), ['read', 'alt', undefined]);
  assert.deepEqual(
    [context.gameBarButtons.get('login-twitch').textContent, context.gameBarButtons.get('login-twitch').style.color,
      context.gameBarButtons.get('login-twitch').title, context.gameBarButtons.get('clear-twitch').hidden],
    ['Twitch ✓ Conectada', '#86efac', 'Twitch conectada nesta conta', false],
  );
  assert.deepEqual(
    [context.gameBarButtons.get('login-kick').textContent, context.gameBarButtons.get('login-kick').style.color,
      context.gameBarButtons.get('login-kick').title, context.gameBarButtons.get('clear-kick').hidden],
    ['Verificar Kick', '#fbbf24', 'Não foi possível verificar a conexão. Clique para tentar novamente.', true],
  );

  context.connectionState.value = { twitch: false, kick: false, unavailableProviders: [] };
  await context.view.updateGameBarConnections();
  assert.deepEqual(
    [context.gameBarButtons.get('login-twitch').textContent, context.gameBarButtons.get('login-twitch').style.color,
      context.gameBarButtons.get('login-twitch').title, context.gameBarButtons.get('clear-twitch').hidden],
    ['Entrar na Twitch', '', 'Entrar na Twitch nesta conta', true],
  );
  assert.deepEqual(
    [context.gameBarButtons.get('login-kick').textContent, context.gameBarButtons.get('login-kick').style.color,
      context.gameBarButtons.get('login-kick').title, context.gameBarButtons.get('clear-kick').hidden],
    ['Entrar na Kick', '', 'Entrar na Kick nesta conta', true],
  );
});

test('refresh updates the selected game bar and syncs tiles once; nonselected accounts do not update the game bar', async () => {
  const selected = setup({ status: { twitch: true, kick: false, unavailableProviders: [] }, isSelected: true });
  await selected.view.refresh(selected.account);
  assert.equal(selected.gameBarButtons.get('login-twitch').textContent, 'Twitch ✓ Conectada');
  assert.equal(selected.gameBarButtons.get('clear-twitch').hidden, false);
  assert.equal(selected.calls.filter(call => call[0] === 'sync-tiles').length, 1);

  const other = setup({ status: { twitch: false, kick: true, unavailableProviders: [] } });
  await other.view.refresh(other.account);
  assert.equal(other.gameBarButtons.get('login-twitch').textContent, '');
  assert.equal(other.gameBarButtons.get('login-kick').textContent, '');
  assert.equal(other.calls.filter(call => call[0] === 'sync-tiles').length, 1);
  assert.deepEqual(await other.view.refresh(null), undefined);
});

test('active renderer delegates account badges and loads the view before app.js', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(app, /PokeIdleProviderConnectionBadges\.createProviderConnectionBadges\(/);
  assert.match(app, /updateGameBarConnections: \(\) => providerConnectionBadges\.updateGameBarConnections\(\)/);
  assert.doesNotMatch(app, /async function updateGameBarConnections\(/);
  assert.match(app, /const updateAccountHeaderBadges = \(account, header\) => providerConnectionBadges\.render\(account, header\)/);
  assert.match(app, /renderBadges: \(account, header\) => updateAccountHeaderBadges\(account, header\)/);
  assert.match(app, /providerConnectionBadges\.refresh\(account\)/);
  assert.ok(html.indexOf('<script src="provider-connection-badges.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('renderer/**'));

  const connectionsInitialization = app.indexOf(
    'const providerConnections = PokeIdleProviderConnections.createProviderConnections(',
  );
  const badgesInitialization = app.indexOf(
    'const providerConnectionBadges = window.PokeIdleProviderConnectionBadges.createProviderConnectionBadges(',
  );
  assert.ok(connectionsInitialization >= 0, 'provider connection service should be composed');
  assert.ok(badgesInitialization >= 0, 'provider badges should be composed');
  assert.ok(
    connectionsInitialization < badgesInitialization,
    'provider connection service must be initialized before the badges that consume it',
  );
});
