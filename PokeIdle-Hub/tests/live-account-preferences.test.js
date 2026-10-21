'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getAccountLimits,
  setUniversalLimit,
  changeAccountLimit,
  toggleAccountFavorite,
} = require('../live-account-preferences');

test('reads saved per-account limits and falls back to the current universal defaults', () => {
  const state = {
    accountLimits: { main: { kick: 0 } },
    universalLimits: { kick: 4, twitch: 7 },
  };

  assert.deepEqual(getAccountLimits(state, 'main'), { kick: 0, twitch: 7 });
  assert.deepEqual(getAccountLimits(state, 'alt'), { kick: 4, twitch: 7 });
  assert.deepEqual(getAccountLimits({ accountLimits: {}, universalLimits: {} }, 'main'), { kick: 2, twitch: 3 });
});

test('sets universal limits using parseInt and propagates to every account', () => {
  const state = {
    accountLimits: { main: { kick: 1 }, alt: { kick: 2, twitch: 8 } },
    universalLimits: { kick: 2, twitch: 3 },
  };
  const result = setUniversalLimit(state, [{ id: 'main' }, { id: 'alt' }, { id: 'new' }], 'twitch', '6 lives');

  assert.equal(result.value, 6);
  assert.deepEqual(result.state.universalLimits, { kick: 2, twitch: 6 });
  assert.deepEqual(result.state.accountLimits, {
    main: { kick: 1, twitch: 6 },
    alt: { kick: 2, twitch: 6 },
    new: { kick: 2, twitch: 6 },
  });
  assert.equal(setUniversalLimit(state, [], 'twitch', 'invalid'), null);
  assert.deepEqual(state, {
    accountLimits: { main: { kick: 1 }, alt: { kick: 2, twitch: 8 } },
    universalLimits: { kick: 2, twitch: 3 },
  });
});

test('changes a per-account provider limit within the existing 0–99 bounds', () => {
  const state = { accountLimits: {}, universalLimits: { kick: 2, twitch: 3 } };
  const decreased = changeAccountLimit(state, 'main', 'kick', -1);
  const increased = changeAccountLimit(decreased.state, 'main', 'kick', 200);

  assert.equal(decreased.changed, true);
  assert.deepEqual(decreased.state.accountLimits.main, { kick: 1, twitch: 3 });
  assert.deepEqual(increased.state.accountLimits.main, { kick: 99, twitch: 3 });
  assert.equal(changeAccountLimit(increased.state, 'main', 'kick', 1).changed, false);
  assert.equal(changeAccountLimit({ accountLimits: { low: { kick: 0 } }, universalLimits: {} }, 'low', 'kick', -1).changed, false);
  assert.equal(changeAccountLimit(state, '', 'kick', 1).changed, false);
});

test('toggles lowercase favorites within one account without mutating saved state', () => {
  const state = { main: ['alpha'], alt: [] };
  const added = toggleAccountFavorite(state, 'main', 'Beta');
  const removed = toggleAccountFavorite(added.favorites, 'main', 'ALPHA');
  const unchanged = toggleAccountFavorite(state, '', 'Gamma');

  assert.deepEqual(added, { favorites: { main: ['alpha', 'beta'], alt: [] }, changed: true, favorite: true });
  assert.deepEqual(removed, { favorites: { main: ['beta'], alt: [] }, changed: true, favorite: false });
  assert.deepEqual(unchanged, { favorites: state, changed: false, favorite: false });
  assert.deepEqual(state, { main: ['alpha'], alt: [] });
});

test('active renderer delegates account preference rules and loads the module before app.js', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(app, /const liveAccountPreferences = window\.PokeIdleLiveAccountPreferences/);
  assert.match(app, /createLiveAccountPreferenceController/);
  assert.match(app, /liveAccountPreferenceController\.getAccountLimits\(accId\)/);
  assert.match(app, /liveAccountPreferenceController\.applyUniversalLimit\(platform, val\)/);
  assert.match(app, /liveAccountPreferenceController\.changeAccountLimit\(accId, platform, delta\)/);
  assert.match(app, /liveAccountPreferenceController\.toggleAccountFavorite\(channel, accId\)/);
  assert.ok(html.indexOf('<script src="../live-account-preferences.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(html.indexOf('<script src="live-account-preference-controller.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  assert.ok(packageJson.build.files.includes('live-account-preferences.js'));
  assert.ok(packageJson.build.files.includes('renderer/**'));
});
