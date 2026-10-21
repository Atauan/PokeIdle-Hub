'use strict';

const productionConfig = require('./electron-builder.config.cjs');
const productName = 'PokeIdle Hub QA';

module.exports = {
  ...productionConfig,
  appId: 'com.pokeidlehub.app.qa',
  productName,
  extraMetadata: {
    ...productionConfig.extraMetadata,
    productName,
    pokeidleHubQaBuild: true,
  },
  win: {
    ...productionConfig.win,
    executableName: productName,
  },
  nsis: {
    ...productionConfig.nsis,
    artifactName: 'PokeIdle-Hub-QA-Setup-${version}.exe',
  },
  portable: {
    ...productionConfig.portable,
    artifactName: 'PokeIdle-Hub-QA-Portable-${version}.exe',
  },
};
