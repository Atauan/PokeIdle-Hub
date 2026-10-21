'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveAccountColumns, createAccountLimitControls } = require('../renderer/live-account-columns');

function fakeElement(tag, props = {}, ...children) {
  const element = {
    tag,
    props,
    children,
    style: {},
    removed: false,
    textContent: props.text || '',
    append(child) { this.children.push(child); child.parentElement = this; },
    replaceChildren(...nextChildren) { this.children = nextChildren; },
    remove() { this.removed = true; },
    querySelector(selector) {
      const className = selector.slice(1);
      const visit = nodes => {
        for (const child of nodes) {
          if (child?.props?.class?.split(/\s+/).includes(className)) return child;
          const nested = visit(child?.children || []);
          if (nested) return nested;
        }
        return null;
      };
      return visit(this.children);
    },
  };
  return element;
}

function setup() {
  const grid = fakeElement('grid');
  const events = [];
  const columns = createLiveAccountColumns({
    el: fakeElement,
    getGrid: () => grid,
    renderBadges: (account, header) => events.push(['badges', account.id, header]),
    renderLimits: (account, header, counts) => events.push(['limits', account.id, header, counts]),
  });
  return { columns, grid, events };
}

test('creates columns for visible accounts and updates connection badges and live limits', () => {
  const context = setup();
  const account = { id: 'main', name: 'Principal' };
  const counts = { kick: 1, twitch: 2 };
  context.columns.sync([account], [{ item: { id: 'live' } }], new Map([['main', counts]]));

  const column = context.columns.get('main');
  assert.ok(column);
  assert.equal(column.col.props['data-acc-id'], 'main');
  assert.equal(column.header.querySelector('.account-col-name').textContent, 'Principal');
  assert.equal(context.columns.getBody('main'), column.body);
  assert.equal(context.columns.getHeader('main'), column.header);
  assert.equal(context.grid.children[0], column.col);
  assert.deepEqual(context.events.map(([type]) => type), ['badges', 'limits']);
  assert.equal(context.events[1][3], counts);
});

test('reuses and renames a column, then removes it when its account disappears', () => {
  const context = setup();
  const account = { id: 'alt', name: 'Antiga' };
  context.columns.sync([account], [{ item: { id: 'live' } }], new Map([['alt', { kick: 1, twitch: 0 }]]));
  const previous = context.columns.get('alt');
  const updated = { id: 'alt', name: 'Nova' };
  context.columns.sync([updated], [{ item: { id: 'live' } }], new Map([['alt', { kick: 0, twitch: 1 }]]));

  assert.equal(context.columns.get('alt'), previous);
  assert.equal(previous.header.querySelector('.account-col-name').textContent, 'Nova');
  assert.equal(context.grid.children.length, 1);

  context.columns.sync([], [{ item: { id: 'live' } }], new Map());
  assert.equal(previous.col.removed, true);
  assert.equal(context.columns.get('alt'), undefined);
  assert.equal(context.columns.getHeader('alt'), undefined);
});

test('removes all columns when no channel is visible', () => {
  const context = setup();
  context.columns.sync([{ id: 'main', name: 'Principal' }], [{ item: { id: 'live' } }], new Map());
  const column = context.columns.get('main');
  context.columns.sync([{ id: 'main', name: 'Principal' }], [], new Map());
  assert.equal(column.col.removed, true);
  assert.equal(context.columns.values().length, 0);
});

test('renders per-account provider limits and delegates step changes without bubbling', () => {
  const changes = [];
  const { render: renderLimits } = createAccountLimitControls({
    el: fakeElement,
    getAccountLimits: accountId => ({ kick: accountId === 'main' ? 2 : 0, twitch: 99 }),
    onChangeLimit: (...args) => changes.push(args),
  });
  const header = fakeElement('header', { class: 'account-col-header' }, fakeElement('div', { class: 'account-col-limits' }));
  const counts = { kick: 1, twitch: 3 };

  renderLimits({ id: 'main' }, header, counts);

  const limits = header.querySelector('.account-col-limits');
  const kick = limits.children[1];
  const twitch = limits.children[2];
  assert.equal(limits.children[0].textContent, 'Máx lives:');
  assert.equal(kick.props.title, 'Limite Kick: 2 (abertas nesta conta: 1)');
  assert.equal(kick.children[2].textContent, '2');
  assert.equal(twitch.props.title, 'Limite Twitch: 99 (abertas nesta conta: 3)');
  assert.equal(twitch.children[2].textContent, '99');

  let stopped = false;
  kick.children[1].props.onclick({ stopPropagation() { stopped = true; } });
  twitch.children[3].props.onclick({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
  assert.deepEqual(changes, [['main', 'kick', -1], ['main', 'twitch', 1]]);
});

test('reuses the account limits container and reflects updated counts and values', () => {
  const { render: renderLimits } = createAccountLimitControls({
    el: fakeElement,
    getAccountLimits: () => ({ kick: 0, twitch: 1 }),
    onChangeLimit() {},
  });
  const limits = fakeElement('div', { class: 'account-col-limits' });
  const header = fakeElement('header', {}, limits);

  renderLimits({ id: 'alt' }, header, { kick: 0, twitch: 0 });
  renderLimits({ id: 'alt' }, header, { kick: 4, twitch: 2 });

  assert.equal(header.children.length, 1);
  assert.equal(limits.children[1].props.title, 'Limite Kick: 0 (abertas nesta conta: 4)');
  assert.equal(limits.children[2].props.title, 'Limite Twitch: 1 (abertas nesta conta: 2)');
});
