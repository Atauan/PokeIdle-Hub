'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveChatOverlay } = require('../renderer/live-chat-overlay');

function setup() {
  const calls = [];
  const listeners = new Map();
  const backdrop = {
    hidden: true,
    addEventListener: (name, listener) => listeners.set(`backdrop:${name}`, listener),
  };
  const documentObject = {
    addEventListener: (name, listener) => listeners.set(`document:${name}`, listener),
  };
  let zTop = 10;
  const tiles = new Map([
    ['main:a', { root: { style: {} }, chatBox: { classList: { add: name => calls.push(['add', 'a', name]), remove: name => calls.push(['remove', 'a', name]) } } }],
    ['main:b', { root: { style: {} }, chatBox: { classList: { add: name => calls.push(['add', 'b', name]), remove: name => calls.push(['remove', 'b', name]) } } }],
  ]);
  const overlay = createLiveChatOverlay({
    tiles,
    getBackdrop: () => backdrop,
    applyChatMode: key => calls.push(['mode', key]),
    nextZIndex: () => String(++zTop),
    documentObject,
  });
  return { overlay, tiles, backdrop, calls, listeners };
}

test('expands one tile and collapses the previously expanded tile', () => {
  const { overlay, tiles, backdrop, calls } = setup();

  overlay.expand('main:a');
  assert.equal(overlay.isExpanded('main:a'), true);
  assert.equal(tiles.get('main:a').root.style.zIndex, '9500');
  assert.equal(backdrop.hidden, false);

  overlay.expand('main:b');
  assert.equal(overlay.isExpanded('main:a'), false);
  assert.equal(overlay.isExpanded('main:b'), true);
  assert.deepEqual(calls.filter(([type]) => type === 'mode'), [['mode', 'main:a'], ['mode', 'main:a'], ['mode', 'main:b']]);
});

test('collapse clears expanded state, restores compact mode and advances z-index', () => {
  const { overlay, tiles, backdrop, calls } = setup();
  overlay.expand('main:a');

  overlay.collapse();
  assert.equal(overlay.isExpanded('main:a'), false);
  assert.equal(backdrop.hidden, true);
  assert.equal(tiles.get('main:a').root.style.zIndex, '11');
  assert.deepEqual(calls.slice(-2), [['remove', 'a', 'expanded'], ['mode', 'main:a']]);
});

test('keeps an existing expansion unchanged for the same tile and tolerates a removed tile', () => {
  const { overlay, tiles, calls } = setup();
  overlay.expand('main:a');
  const count = calls.length;
  overlay.expand('main:a');
  assert.equal(calls.length, count);

  tiles.delete('main:a');
  overlay.collapse();
  assert.equal(overlay.isExpanded('main:a'), false);
});

test('binds backdrop click and Escape to collapse the expanded chat only', () => {
  const { overlay, backdrop, listeners } = setup();
  overlay.bind();

  overlay.expand('main:a');
  listeners.get('document:keydown')({ key: 'Enter' });
  assert.equal(overlay.isExpanded('main:a'), true);

  listeners.get('backdrop:click')();
  assert.equal(overlay.isExpanded('main:a'), false);
  assert.equal(backdrop.hidden, true);

  overlay.expand('main:b');
  listeners.get('document:keydown')({ key: 'Escape' });
  assert.equal(overlay.isExpanded('main:b'), false);
});
