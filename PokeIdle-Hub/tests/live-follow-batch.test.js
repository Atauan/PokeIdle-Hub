'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveFollowBatch } = require('../renderer/live-follow-batch');

function setup({ tiles = [], statuses = [], error, button = true } = {}) {
  const events = [];
  const delays = [];
  const errors = [];
  const calls = [];
  const followButton = button ? {
    classList: {
      add: name => events.push(['class-add', name]),
      remove: name => events.push(['class-remove', name]),
    },
    disabled: false,
    innerHTML: '<span class="icon-svg icon-follow"></span> Seguir Todos',
  } : null;
  const batch = createLiveFollowBatch({
    getOpenTiles: () => new Map(tiles.map((tile, index) => [`tile-${index}`, tile])),
    getButton: () => followButton,
    followTile: async tile => {
      calls.push(tile);
      if (error) throw error;
      return statuses[calls.length - 1] || { status: 'other' };
    },
    toast: message => events.push(['toast', message]),
    logError: (...args) => errors.push(args),
    wait: async delay => delays.push(delay),
  });
  return { batch, calls, delays, errors, events, button: followButton };
}

test('reports empty state without changing the button or running follow requests', async () => {
  const context = setup();
  await context.batch.followAllOpenChannels();

  assert.deepEqual(context.events, [['toast', 'Nenhum canal de live aberto no momento.']]);
  assert.equal(context.button.disabled, false);
  assert.equal(context.calls.length, 0);
});

test('follows tiles sequentially, waits 250ms after each and summarizes mixed results', async () => {
  const tiles = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
  const context = setup({
    tiles,
    statuses: [
      { status: 'followed' },
      { status: 'already_following' },
      { status: 'not_logged_in' },
      { status: 'not_ready' },
      { status: 'exec_error' },
    ],
  });
  await context.batch.followAllOpenChannels();

  assert.deepEqual(context.calls, tiles);
  assert.deepEqual(context.delays, [250, 250, 250, 250, 250]);
  assert.deepEqual(context.events.filter(([type]) => type === 'toast'), [
    ['toast', '✓ 1 canal(is) seguido(s) com sucesso! (1 já eram seguidos)'],
  ]);
  assert.equal(context.button.disabled, false);
  assert.equal(context.button.innerHTML, '<span class="icon-svg icon-follow"></span> Seguir Todos');
  assert.ok(context.events.some(([type, value]) => type === 'class-remove' && value === 'loading'));
});

test('preserves the existing no-success summary priority', async () => {
  const already = setup({ tiles: [{}], statuses: [{ status: 'already_following' }] });
  await already.batch.followAllOpenChannels();
  assert.ok(already.events.some(([type, message]) => type === 'toast' && message === 'Você já segue todos os 1 canais abertos.'));

  const loggedOut = setup({ tiles: [{}], statuses: [{ status: 'not_logged_in' }] });
  await loggedOut.batch.followAllOpenChannels();
  assert.ok(loggedOut.events.some(([type, message]) => type === 'toast' && message.includes('falta de login na plataforma')));

  const notReady = setup({ tiles: [{}], statuses: [{ status: 'not_ready' }] });
  await notReady.batch.followAllOpenChannels();
  assert.ok(notReady.events.some(([type, message]) => type === 'toast' && message.includes('ainda estavam carregando')));

  const other = setup({ tiles: [{}], statuses: [{ status: 'exec_error' }] });
  await other.batch.followAllOpenChannels();
  assert.ok(other.events.some(([type, message]) => type === 'toast' && message === 'Comando de seguir concluído.'));
});

test('logs thrown batch errors and always restores the button', async () => {
  const error = new Error('simulated follow failure');
  const context = setup({ tiles: [{}], error });
  await context.batch.followAllOpenChannels();

  assert.deepEqual(context.errors, [['Falha ao processar seguir todos:', error]]);
  assert.ok(context.events.some(([type, message]) => type === 'toast' && message === 'Falha ao processar comando de seguir.'));
  assert.equal(context.button.disabled, false);
  assert.equal(context.button.innerHTML, '<span class="icon-svg icon-follow"></span> Seguir Todos');
});
