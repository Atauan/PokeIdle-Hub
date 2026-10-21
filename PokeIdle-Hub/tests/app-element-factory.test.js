'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createElementFactory } = require('../renderer/app-element-factory');

test('creates elements with existing class, text, event, attribute, and child semantics', () => {
  const created = [];
  const documentObject = {
    createElement(tag) {
      const node = {
        tag,
        attributes: new Map(),
        listeners: new Map(),
        children: [],
        append(child) { this.children.push(child); },
        addEventListener(name, callback) { this.listeners.set(name, callback); },
        setAttribute(name, value) { this.attributes.set(name, value); },
      };
      created.push(node);
      return node;
    },
  };
  const el = createElementFactory(documentObject);
  const onClick = () => {};
  const first = { id: 'first' };
  const second = { id: 'second' };
  const result = el('button', {
    class: 'primary', text: 'Open', onclick: onClick, disabled: true,
    'data-count': 0, ignored: false, absent: null,
  }, first, [second, null]);

  assert.equal(result, created[0]);
  assert.equal(result.className, 'primary');
  assert.equal(result.textContent, 'Open');
  assert.equal(result.listeners.get('click'), onClick);
  assert.equal(result.attributes.get('disabled'), '');
  assert.equal(result.attributes.get('data-count'), '0');
  assert.equal(result.attributes.has('ignored'), false);
  assert.equal(result.attributes.has('absent'), false);
  assert.deepEqual(result.children, [first, second]);
});
