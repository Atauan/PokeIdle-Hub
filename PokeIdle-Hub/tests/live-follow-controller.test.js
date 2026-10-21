'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLiveFollowController } = require('../renderer/live-follow-controller');

function setup({ result, error } = {}) {
  const events = [];
  const button = {
    disabled: false,
    textContent: '+ Seguir',
    title: '',
    classList: {
      values: new Set(),
      add(name) { this.values.add(name); },
      remove(name) { this.values.delete(name); },
      contains(name) { return this.values.has(name); },
    },
  };
  const tile = { p: 'kick', item: { channel: 'alpha' }, acc: { name: 'Conta 2' } };
  const controller = createLiveFollowController({
    followTile: async value => {
      events.push(['follow', value]);
      if (error) throw error;
      return result;
    },
    toast: message => events.push(['toast', message]),
  });
  return { button, controller, events, tile };
}

test('marks a pending follow and reports success with the existing button state', async () => {
  const context = setup({ result: { status: 'followed' } });
  await context.controller.followSingleTile(context.tile, context.button);

  assert.equal(context.button.disabled, true);
  assert.equal(context.button.textContent, '✓ Seguido');
  assert.equal(context.button.classList.contains('loading'), false);
  assert.equal(context.button.classList.contains('followed'), true);
  assert.equal(context.button.title, 'Você segue alpha nesta conta');
  assert.deepEqual(context.events.map(([type]) => type), ['follow', 'toast']);
  assert.match(context.events[1][1], /Conta 2/);
});

test('handles already-following as success and unlocks the button for retryable outcomes', async () => {
  const already = setup({ result: { status: 'already_following' } });
  await already.controller.followSingleTile(already.tile, already.button);
  assert.equal(already.button.classList.contains('followed'), true);

  for (const [status, message] of [
    ['not_logged_in', /Entre na Kick para a conta "Conta 2"/],
    ['not_ready', /ainda está carregando/],
    ['other', /Não foi possível seguir alpha/],
  ]) {
    const context = setup({ result: { status } });
    await context.controller.followSingleTile(context.tile, context.button);
    assert.equal(context.button.disabled, false);
    assert.equal(context.button.textContent, '+ Seguir');
    assert.equal(context.button.classList.contains('loading'), false);
    assert.match(context.events.at(-1)[1], message);
  }
});

test('recovers the button and shows the existing message when the follow service throws', async () => {
  const context = setup({ error: new Error('internal-only') });
  await context.controller.followSingleTile(context.tile, context.button);
  assert.equal(context.button.disabled, false);
  assert.equal(context.button.textContent, '+ Seguir');
  assert.equal(context.button.classList.contains('loading'), false);
  assert.match(context.events.at(-1)[1], /Erro ao processar comando de seguir em alpha/);
  assert.doesNotMatch(context.events.at(-1)[1], /internal-only/);
});

test('does not submit the same tile twice while its button is disabled', async () => {
  let resolveFollow;
  const events = [];
  const button = {
    disabled: false, textContent: '+ Seguir', title: '',
    classList: { add() {}, remove() {} },
  };
  const controller = createLiveFollowController({
    followTile: () => { events.push('follow'); return new Promise(resolve => { resolveFollow = resolve; }); },
    toast: () => {},
  });
  const tile = { p: 'twitch', item: { channel: 'beta' }, acc: { name: 'Main' } };

  const first = controller.followSingleTile(tile, button);
  await controller.followSingleTile(tile, button);
  assert.deepEqual(events, ['follow']);
  resolveFollow({ status: 'followed' });
  await first;
});

test('active renderer delegates single-tile follow presentation to the controller', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(app, /PokeIdleLiveFollowController\.createLiveFollowController/);
  assert.match(app, /follow: \(tile, button\) => liveFollowController\.followSingleTile\(tile, button\)/);
  assert.doesNotMatch(app, /async function followSingleTile\(/);
  assert.ok(html.indexOf('live-follow-controller.js') < html.indexOf('app.js'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
