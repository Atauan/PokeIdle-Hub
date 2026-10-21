'use strict';

const { randomUUID } = require('node:crypto');

const LOGIN_URLS = Object.freeze({
  twitch: 'https://www.twitch.tv/login',
  kick: 'https://kick.com/',
});

function registerProviderConnectionHandlers({
  ipcMain,
  primaryPartition,
  isAdditionalPartition,
  isTrustedSender,
  setupSession,
  loginWindowService,
  providerConnectionService,
  createFlowId = randomUUID,
  logStage = entry => console.info('[auth-flow]', entry),
}) {
  function beginFlow(event, provider) {
    const flowId = createFlowId();
    const reportStage = (stage, details = {}) => {
      const payload = { flowId, provider, stage };
      if (Number.isInteger(details.errorCode)) payload.errorCode = details.errorCode;
      try { event.sender.send('login-flow-stage', payload); } catch (_) {}
      try { logStage(payload); } catch (_) {}
    };
    reportStage('request_received');
    return { flowId, reportStage };
  }

  function openWindow(event, { url, title, partition, provider }) {
    const { flowId, reportStage } = beginFlow(event, provider);
    try {
      setupSession(partition);
      reportStage('session_ready');
    } catch (_) {
      reportStage('session_setup_failed');
      return;
    }
    try {
      loginWindowService.openLoginWindow(url, title, partition, provider, { flowId, reportStage });
    } catch (_) {
      reportStage('window_creation_failed');
    }
  }

  ipcMain.on('open-login', (event, platform, partition, label) => {
    const url = LOGIN_URLS[platform];
    if (!isTrustedSender(event) || !url) return;
    const targetPartition = isAdditionalPartition(partition || '') ? partition : primaryPartition;
    const platformName = platform === 'twitch' ? 'Twitch' : 'Kick';
    const cleanLabel = typeof label === 'string' && label.trim()
      ? ` (${label.trim().slice(0, 30)})`
      : '';
    openWindow(event, {
      url,
      title: `Entrar na ${platformName}${cleanLabel}`,
      partition: targetPartition,
      provider: platform,
    });
  });

  ipcMain.on('open-game-login', (event, partition) => {
    if (!isTrustedSender(event)) return;
    const targetPartition = isAdditionalPartition(partition || '') ? partition : primaryPartition;
    openWindow(event, {
      url: 'https://pokeidle.io/app',
      title: 'Entrar no Pokeidle',
      partition: targetPartition,
      provider: 'game',
    });
  });

  ipcMain.handle('check-connections', async (event, partition) => {
    if (!isTrustedSender(event)) {
      return { twitch: false, kick: false, unavailableProviders: ['twitch', 'kick'] };
    }
    const targetPartition = isAdditionalPartition(partition || '') ? partition : primaryPartition;
    return providerConnectionService.checkConnections(targetPartition);
  });

  ipcMain.handle('clear-connection', async (event, platform, partition) => {
    if (!isTrustedSender(event) || !['twitch', 'kick'].includes(platform)) return false;
    const targetPartition = !partition || partition === primaryPartition || isAdditionalPartition(partition)
      ? (partition || primaryPartition)
      : null;
    if (!targetPartition) return false;
    return providerConnectionService.clearConnection(platform, targetPartition);
  });
}

module.exports = { registerProviderConnectionHandlers };
