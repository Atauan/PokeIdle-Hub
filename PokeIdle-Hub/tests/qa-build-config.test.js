'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const packageJson = require('../package.json');
const qaConfig = require('../electron-builder.qa.config.cjs');

test('QA build has a distinct product identity and isolated-profile marker', () => {
  assert.equal(qaConfig.appId, 'com.pokeidlehub.app.qa');
  assert.equal(qaConfig.productName, 'PokeIdle Hub QA');
  assert.equal(qaConfig.extraMetadata.productName, 'PokeIdle Hub QA');
  assert.equal(qaConfig.extraMetadata.pokeidleHubQaBuild, true);
  assert.equal(qaConfig.win.executableName, 'PokeIdle Hub QA');
  assert.match(qaConfig.portable.artifactName, /QA-Portable/);
  assert.ok(packageJson.build.files.includes('qa-profile.js'));
  assert.match(packageJson.scripts['dist:win:qa'], /electron-builder\.qa\.config\.cjs/);
});
