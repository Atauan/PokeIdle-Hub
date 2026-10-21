'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const monitor = require('../assets/addons/rotom-sniper/shiny-flow-monitor');

test('records the seen counter with its triggering stage and timestamp', () => {
  const event = monitor.createSeenCounterEvent(
    { n: 'Smoochum', nv: 40, sh: true, t: 'campo' },
    2,
    'wild_visible',
    1234
  );

  assert.equal(event.stage, 'seen_counter');
  assert.equal(event.seenCount, 2);
  assert.equal(event.triggerStage, 'wild_visible');
  assert.equal(event.timestamp, 1234);
  assert.equal(event.shinySignal, 'true');
  assert.equal(event.species, 'Smoochum');
});

test('captures the seen count at an event so unchanged values remain visible in the timeline', () => {
  const event = monitor.createEvent('ball_attempt', { shiny: true }, 2000, 3);
  assert.equal(event.timestamp, 2000);
  assert.equal(event.shinySignal, 'true');
  assert.equal(event.seenCount, 3);
  assert.throws(() => monitor.createEvent('ball_attempt', {}, 2000, -1), TypeError);
});

test('rejects invalid counter values and trigger stages', () => {
  assert.throws(() => monitor.createSeenCounterEvent({}, -1, 'wild_visible'), TypeError);
  assert.throws(() => monitor.createSeenCounterEvent({}, 1.5, 'wild_visible'), TypeError);
  assert.throws(() => monitor.createSeenCounterEvent({}, 1, 'seen_counter'), TypeError);
});

test('retains seen counter events in the bounded diagnostic history', () => {
  const first = monitor.createSeenCounterEvent({ n: 'Smoochum', sh: true }, 1, 'wild_visible', 1000);
  const events = monitor.appendEvent([], first, 1);
  assert.deepEqual(events, [first]);
});
