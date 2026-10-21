'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLiveTileDragController } = require('../renderer/live-tile-drag');

function setup({ width = 500, height = 400 } = {}) {
  const state = { frames: {} };
  const tiles = new Map([
    ['main:one', { rect: { x: 20, y: 24, w: 200, h: 160 } }],
    ['main:two', { rect: { x: 40, y: 48, w: 300, h: 200 } }],
  ]);
  const grid = { clientWidth: width, clientHeight: height };
  const shield = { hidden: true, style: {} };
  const listeners = new Map();
  const events = [];
  const controller = createLiveTileDragController({
    state,
    tiles,
    getGrid: () => grid,
    getShield: () => shield,
    layout: () => events.push(['layout']),
    persist: () => events.push(['persist']),
    windowObject: {
      addEventListener: (name, listener) => listeners.set(name, listener),
      removeEventListener: (name, listener) => {
        if (listeners.get(name) === listener) listeners.delete(name);
      },
    },
  });
  const start = (kind, id = 'main:one', { button = 0, inButton = false } = {}) => {
    const handle = { dataset: { drag: kind } };
    controller.startDrag({
      target: { closest: selector => selector === '[data-drag]' ? handle : (inButton && selector === 'button' ? {} : null) },
      button,
      clientX: 5,
      clientY: 3,
      preventDefault: () => events.push(['prevent-default']),
    }, id);
  };
  return { controller, events, grid, listeners, shield, start, state, tiles };
}

test('starts only a primary-button drag from a handle outside buttons', () => {
  const context = setup();
  context.controller.bind();

  context.start('move', 'main:one', { button: 1 });
  context.start('move', 'main:one', { inButton: true });
  context.start('move', 'missing');
  assert.equal(context.shield.hidden, true);
  assert.equal(context.events.length, 0);

  context.start('move');
  assert.equal(context.shield.hidden, false);
  assert.equal(context.shield.style.cursor, 'grabbing');
  assert.deepEqual(context.events, [['prevent-default']]);
});

test('moves and resizes tiles with the existing snapping, bounds, persistence, and layout rules', () => {
  const context = setup();
  context.controller.bind();
  context.start('move');
  context.listeners.get('pointermove')({ clientX: 21, clientY: 16 });

  assert.deepEqual(context.state.frames['main:one'], [0.08, 0.1, 0.4, 0.4]);
  assert.deepEqual(context.events.filter(([name]) => name === 'layout'), [['layout']]);

  context.listeners.get('pointerup')();
  assert.equal(context.shield.hidden, true);
  assert.deepEqual(context.events.filter(([name]) => name === 'persist'), [['persist']]);

  context.start('corner', 'main:two');
  assert.equal(context.shield.style.cursor, 'nwse-resize');
  context.listeners.get('pointermove')({ clientX: 23, clientY: -6 });
  assert.deepEqual(context.state.frames['main:two'], [0.08, 0.12, 0.64, 0.48]);
  context.listeners.get('pointerup')();

  context.start('move');
  context.listeners.get('pointermove')({ clientX: 1000, clientY: 1000 });
  assert.deepEqual(context.state.frames['main:one'], [0.6, 0.6, 0.4, 0.4]);
});

test('cancels a removed tile drag and detaches pointer listeners on disposal', () => {
  const context = setup();
  context.controller.bind();
  context.start('move');
  context.controller.cancelForTile('main:two');
  assert.equal(context.shield.hidden, false);

  context.controller.cancelForTile('main:one');
  assert.equal(context.shield.hidden, true);
  context.listeners.get('pointermove')({ clientX: 80, clientY: 80 });
  assert.deepEqual(context.state.frames, {});

  context.controller.dispose();
  assert.equal(context.listeners.has('pointermove'), false);
  assert.equal(context.listeners.has('pointerup'), false);
});

test('active renderer composes the drag controller and loads its module before app.js', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(app, /PokeIdleLiveTileDrag\.createLiveTileDragController\(/);
  assert.match(app, /liveTileDragController\.cancelForTile\(key\)/);
  assert.doesNotMatch(app, /window\.addEventListener\('pointermove'/);
  assert.ok(html.indexOf('<script src="live-tile-drag.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
