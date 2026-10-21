'use strict';

function createProviderConnectionService({ session }) {
  async function checkConnections(partition) {
    const ses = session.fromPartition(partition);
    let twitch = false;
    let kick = false;
    const unavailableProviders = [];
    try {
      const cookies = await ses.cookies.get({ domain: 'twitch.tv' });
      twitch = cookies.some(cookie => cookie.name === 'auth-token' && !!cookie.value);
    } catch (_) { unavailableProviders.push('twitch'); }
    try {
      const cookies = await ses.cookies.get({ domain: 'kick.com' });
      kick = cookies.some(cookie => ['session', 'kick_session', 'session_token', 'token'].includes(cookie.name.toLowerCase()) || (cookie.name.includes('session') && !!cookie.value));
    } catch (_) { unavailableProviders.push('kick'); }
    return { twitch, kick, unavailableProviders };
  }

  async function clearConnection(platform, partition) {
    const domain = platform === 'twitch' ? 'twitch.tv' : platform === 'kick' ? 'kick.com' : null;
    if (!domain || typeof partition !== 'string' || !partition) return false;
    try {
      const ses = session.fromPartition(partition);
      const cookies = await ses.cookies.get({ domain });
      await Promise.all(cookies.map(cookie => {
        const host = cookie.domain.replace(/^\./, '');
        const url = `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path || '/'}`;
        return ses.cookies.remove(url, cookie.name);
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  return Object.freeze({ checkConnections, clearConnection });
}

module.exports = { createProviderConnectionService };
