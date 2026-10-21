'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLivePlan, createResourcePlan, canReceiveResources, filterEligibleChannels } = require('../live-policy');

const accounts = [
  { id: 'main' },
  { id: 'secondary' },
];

const channels = [
  { provider: 'twitch', name: 'axtlol' },
  { provider: 'twitch', name: 'rodil' },
  { provider: 'kick', name: 'axt' },
];

test('live plan makes no discovery or account resources without connected providers', () => {
  const plan = createLivePlan({ accounts, channels, connectionStatuses: {} });

  assert.deepEqual(plan.channelsByProvider, { kick: [], twitch: [] });
  assert.deepEqual(plan.eligibleAccountIdsByProvider, { kick: [], twitch: [] });
});

test('a Twitch connection enables Twitch discovery and only its account resources', () => {
  const plan = createLivePlan({
    accounts,
    channels,
    connectionStatuses: { main: { twitch: true }, secondary: { twitch: false, kick: false } },
  });

  assert.deepEqual(plan.channelsByProvider, { kick: [], twitch: ['axtlol', 'rodil'] });
  assert.deepEqual(plan.eligibleAccountIdsByProvider, { kick: [], twitch: ['main'] });
});

test('Kick and Twitch eligibility are independent across multiple accounts', () => {
  const plan = createLivePlan({
    accounts,
    channels,
    connectionStatuses: { main: { twitch: true, kick: false }, secondary: { twitch: false, kick: true } },
  });

  assert.deepEqual(plan.channelsByProvider, { kick: ['axt'], twitch: ['axtlol', 'rodil'] });
  assert.deepEqual(plan.eligibleAccountIdsByProvider, { kick: ['secondary'], twitch: ['main'] });
});

test('same-provider connections authorize several accounts but keep discovery deduplicated', () => {
  const plan = createLivePlan({
    accounts,
    channels: [...channels, { provider: 'twitch', name: 'AXTLOL' }],
    connectionStatuses: { main: { twitch: true }, secondary: { twitch: true } },
  });

  assert.deepEqual(plan.channelsByProvider, { kick: [], twitch: ['axtlol', 'rodil'] });
  assert.deepEqual(plan.eligibleAccountIdsByProvider, { kick: [], twitch: ['main', 'secondary'] });
});

test('invalid accounts, providers, channels, and non-true statuses are not eligible', () => {
  const plan = createLivePlan({
    accounts: [{ id: 'main' }, { id: '' }, { id: 'main' }],
    channels: [...channels, { provider: 'twitch', name: 'bad name' }, { provider: 'other', name: 'x' }],
    connectionStatuses: { main: { twitch: 'true', kick: 1 } },
  });

  assert.deepEqual(plan.channelsByProvider, { kick: [], twitch: [] });
  assert.deepEqual(plan.eligibleAccountIdsByProvider, { kick: [], twitch: [] });
});

test('resource eligibility is account- and provider-specific', () => {
  const eligibility = { kick: ['secondary'], twitch: ['main'] };

  assert.equal(canReceiveResources('main', 'twitch', eligibility), true);
  assert.equal(canReceiveResources('main', 'kick', eligibility), false);
  assert.equal(canReceiveResources('secondary', 'kick', eligibility), true);
  assert.equal(canReceiveResources('secondary', 'twitch', eligibility), false);
  assert.equal(canReceiveResources('secondary', 'other', eligibility), false);
});

test('resource reconciliation returns only channels authorized for that account', () => {
  const eligibility = { kick: ['secondary'], twitch: ['main'] };
  const openChannels = [
    { provider: 'twitch', name: 'axtlol' },
    { provider: 'kick', name: 'axt' },
  ];

  assert.deepEqual(filterEligibleChannels('main', openChannels, eligibility), [openChannels[0]]);
  assert.deepEqual(filterEligibleChannels('secondary', openChannels, eligibility), [openChannels[1]]);
  assert.deepEqual(filterEligibleChannels('unlinked', openChannels, eligibility), []);
});

test('resource plan applies account limits, favorites, existing tiles, and economy mode per account', () => {
  const accounts = [{ id: 'main' }, { id: 'secondary' }];
  const channels = [
    { provider: 'kick', item: { id: 'k1', channel: 'kickone' } },
    { provider: 'kick', item: { id: 'k2', channel: 'kicktwo' } },
    { provider: 'twitch', item: { id: 't1', channel: 'twitchone' } },
    { provider: 'twitch', item: { id: 't2', channel: 'twitchtwo' } },
    { provider: 'twitch', item: { id: 't3', channel: 'twitchthree' } },
  ];
  const plan = createResourcePlan({
    accounts,
    channels,
    eligibleAccountIdsByProvider: { kick: ['secondary'], twitch: ['main'] },
    accountLimitsById: { main: { kick: 2, twitch: 2 }, secondary: { kick: 1, twitch: 2 } },
    favoriteChannelsByAccount: { main: ['twitchtwo'], secondary: ['kicktwo'] },
    existingTileKeys: new Set(['main:t1']),
  });

  assert.deepEqual(plan.visibleChannels.map(({ item }) => item.id), ['k1', 'k2', 't1', 't2', 't3']);
  assert.deepEqual(plan.allowedByAccount.get('main').map(({ item }) => item.id), ['t2', 't1']);
  assert.deepEqual(plan.allowedByAccount.get('secondary').map(({ item }) => item.id), ['k2']);
  assert.deepEqual(plan.countsByAccount.get('main'), { kick: 0, twitch: 2 });
  assert.deepEqual(plan.countsByAccount.get('secondary'), { kick: 1, twitch: 0 });
  assert.deepEqual([...plan.desiredTiles.keys()], ['main:t2', 'main:t1', 'secondary:k2']);

  const economyPlan = createResourcePlan({
    accounts,
    channels,
    eligibleAccountIdsByProvider: { kick: ['secondary'], twitch: ['main'] },
    accountLimitsById: { main: { twitch: 2 }, secondary: { kick: 1 } },
    economyProviders: ['twitch'],
  });
  assert.deepEqual(economyPlan.allowedByAccount.get('main'), []);
  assert.deepEqual(economyPlan.allowedByAccount.get('secondary').map(({ item }) => item.id), ['k1']);

  const stalePlan = createResourcePlan({
    accounts: [{ id: 'main' }],
    channels,
    eligibleAccountIdsByProvider: { kick: ['removed'], twitch: [] },
    accountLimitsById: { main: { kick: 2, twitch: 2 } },
  });
  assert.deepEqual(stalePlan.visibleChannels, []);
});
