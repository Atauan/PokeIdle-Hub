'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppToast } = require('../renderer/app-toast');

test('shows the latest message and replaces the previous dismissal timer', () => {
  const node = { textContent: '', hidden: true };
  const scheduled = [];
  const cleared = [];
  const toast = createAppToast({
    query: selector => selector === '#toast' ? node : null,
    setTimeoutFn: callback => { scheduled.push(callback); return scheduled.length; },
    clearTimeoutFn: id => cleared.push(id),
  });

  toast.show('Primeira mensagem');
  toast.show('Mensagem atual');

  assert.deepEqual(cleared, [null, 1]);
  assert.equal(node.textContent, 'Mensagem atual');
  assert.equal(node.hidden, false);
  assert.equal(scheduled.length, 2);
  scheduled[1]();
  assert.equal(node.hidden, true);
});
