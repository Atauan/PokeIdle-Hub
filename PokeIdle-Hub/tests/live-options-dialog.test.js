'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveOptionsDialog } = require('../renderer/live-options-dialog');

function element() {
  const listeners = new Map();
  return {
    focused: false,
    open: false,
    addEventListener(type, callback) { listeners.set(type, callback); },
    dispatch(type, event = {}) { listeners.get(type)?.(event); },
    showModal() { this.open = true; },
    close() { this.open = false; },
    focus() { this.focused = true; },
  };
}

function setup() {
  const items = new Map(['live-options-open', 'live-options-dialog', 'live-options-close'].map(id => [id, element()]));
  const dialog = createLiveOptionsDialog({ query: selector => items.get(selector.slice(1)) });
  dialog.bind();
  return { dialog, items };
}

test('opens the options dialog and focuses its close button', () => {
  const context = setup();
  context.items.get('live-options-open').dispatch('click');
  assert.equal(context.items.get('live-options-dialog').open, true);
  assert.equal(context.items.get('live-options-close').focused, true);
});

test('closes from the close button and from a backdrop click', () => {
  const context = setup();
  const dialog = context.items.get('live-options-dialog');
  context.items.get('live-options-open').dispatch('click');
  context.items.get('live-options-close').dispatch('click');
  assert.equal(dialog.open, false);

  context.items.get('live-options-open').dispatch('click');
  dialog.dispatch('click', { target: dialog });
  assert.equal(dialog.open, false);
});

test('does not close when the click comes from inside the dialog', () => {
  const context = setup();
  const dialog = context.items.get('live-options-dialog');
  context.items.get('live-options-open').dispatch('click');
  dialog.dispatch('click', { target: {} });
  assert.equal(dialog.open, true);
});
