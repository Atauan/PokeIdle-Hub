'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planGameWorkspace } = require('../renderer/game-workspace-policy');

test('plans one market-reading primary pane and reuses unchanged account panes', () => {
  const primary = { id: 'main', name: 'Principal' };
  const secondary = { id: 'alt', name: 'Alternativa' };
  const existingMain = { market: true };
  const existingAlt = { market: false };
  const existing = new Map([['main', existingMain], ['alt', existingAlt]]);

  const plan = planGameWorkspace([primary, secondary], existing);

  assert.deepEqual(plan.removeIds, []);
  assert.deepEqual(plan.actions, [
    { type: 'reuse', account: primary, resource: existingMain, market: true },
    { type: 'reuse', account: secondary, resource: existingAlt, market: false },
  ]);
  assert.equal(plan.primaryAccountId, 'main');
});

test('recreates panes when the primary role changes and removes deleted accounts', () => {
  const promoted = { id: 'alt', name: 'Alternativa' };
  const existing = new Map([
    ['main', { market: true }],
    ['alt', { market: false }],
    ['deleted', { market: false }],
  ]);

  const plan = planGameWorkspace([promoted], existing);

  assert.deepEqual(plan.removeIds, ['main', 'deleted']);
  assert.deepEqual(plan.actions, [{ type: 'replace', account: promoted, resource: existing.get('alt'), market: true }]);
  assert.equal(plan.primaryAccountId, 'alt');
});

test('plans new panes and a null primary for an empty account list', () => {
  const first = { id: 'one' };
  const second = { id: 'two' };

  const populated = planGameWorkspace([first, second], new Map());
  const empty = planGameWorkspace([], new Map([['orphan', { market: false }]]));

  assert.deepEqual(populated.actions, [
    { type: 'create', account: first, resource: undefined, market: true },
    { type: 'create', account: second, resource: undefined, market: false },
  ]);
  assert.deepEqual(populated.removeIds, []);
  assert.equal(populated.primaryAccountId, 'one');
  assert.deepEqual(empty.removeIds, ['orphan']);
  assert.equal(empty.primaryAccountId, null);
});
