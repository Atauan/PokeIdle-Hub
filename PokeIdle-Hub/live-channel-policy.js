'use strict';

(() => {
  function normalizeGameChannels(rows) {
    const channels = new Map();
    if (!Array.isArray(rows)) return [];
    for (const row of rows.slice(0, 200)) {
      if (!row || !['kick', 'twitch'].includes(row.platform) || typeof row.channel !== 'string') continue;
      const channel = row.channel.trim().toLowerCase();
      if (!/^[a-z0-9_-]{2,40}$/.test(channel)) continue;
      channels.set(`${row.platform}:${channel}`, { platform: row.platform, channel });
    }
    return [...channels.values()];
  }

  function cleanChannel(raw) {
    let channel = String(raw).trim().toLowerCase();
    if (!channel) return null;
    channel = channel.split(/[?#]/)[0];
    channel = channel.split('/').filter(Boolean).pop() || '';
    return /^[a-z0-9_-]{2,40}$/.test(channel) ? channel : null;
  }

  const api = Object.freeze({ normalizeGameChannels, cleanChannel });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveChannelPolicy = api;
})();
