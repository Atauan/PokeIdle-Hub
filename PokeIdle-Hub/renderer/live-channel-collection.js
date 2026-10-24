'use strict';

(() => {
  function createLiveChannelCollection({
    state,
    policy,
    preferences,
    uid,
    liveStates,
    nextLiveState,
    persist,
    syncTiles,
    scheduleLiveChecks,
    isLiveRefreshing,
    isManualDiscoveryPending,
    checkLivesNow,
    queryAll,
    onAddLive,
    toast,
  }) {
    function listAll() {
      return [
        ...state.kick.map(item => ({ p: 'kick', i: item })),
        ...state.twitch.map(item => ({ p: 'twitch', i: item })),
      ];
    }

    function findChannelById(id, provider) {
      return listAll().find(entry => entry.i.id === id && (!provider || entry.p === provider));
    }

    function importGameChannels() {
      let added = 0;
      const ignored = new Set(state.ignoredGameChannels);
      for (const { platform, channel } of state.gameChannels) {
        if (ignored.has(`${platform}:${channel}`) || state[platform].some(item => item.channel === channel)) continue;
        state[platform].push({ id: uid(), channel, muted: true });
        added++;
      }
      syncTiles();
      if (added && state.autoLives && !isLiveRefreshing()) scheduleLiveChecks();
    }

    function receiveGameChannels(rows) {
      state.gameChannels = policy.normalizeGameChannels([
        ...state.gameChannels,
        ...policy.normalizeGameChannels(rows),
      ]);
      importGameChannels();
      if (isManualDiscoveryPending() && listAll().length) void checkLivesNow();
    }

    function addChannels(text) {
      for (const raw of String(text).split(/[,\s]+/)) {
        const channel = policy.cleanChannel(raw);
        if (!channel) continue;
        const lower = raw.toLowerCase();
        const platform = lower.includes('twitch.tv') ? 'twitch' : (lower.includes('kick.com') ? 'kick' : state.target);
        state.ignoredGameChannels = state.ignoredGameChannels.filter(key => key !== `${platform}:${channel}`);
        state.accountIgnoredGameChannels = preferences.clearChannelExclusionAcrossAccounts(
          state.accountIgnoredGameChannels,
          platform,
          channel,
        );
        if (!state[platform].some(item => item.channel === channel)) {
          state[platform].push({ id: uid(), channel, muted: true });
        }
        if (!state.autoLives) {
          const item = state[platform].find(entry => entry.channel === channel);
          liveStates.set(item.id, nextLiveState(null, 'unknown', true));
        }
      }
      persist();
      syncTiles();
      scheduleLiveChecks();
    }

    function clearChannels(platform) {
      const removed = listAll()
        .filter(entry => platform === 'all' || entry.p === platform)
        .map(entry => `${entry.p}:${entry.i.channel}`);
      state.ignoredGameChannels = [...new Set([...state.ignoredGameChannels, ...removed])];
      if (platform === 'kick' || platform === 'all') state.kick = [];
      if (platform === 'twitch' || platform === 'all') state.twitch = [];
      syncTiles();
    }

    function removeChannel(id, accountId, provider) {
      const entry = findChannelById(id, provider);
      if (entry && accountId) {
        state.accountIgnoredGameChannels = preferences.setAccountChannelExcluded(
          state.accountIgnoredGameChannels,
          accountId,
          entry.p,
          entry.i.channel,
          true,
        );
      }
      persist();
      syncTiles();
    }

    function receiveGameLink(link) {
      const name = link.split('/').pop();
      const platform = link.includes('twitch.tv') ? 'Twitch' : 'Kick';
      const before = listAll().length;
      addChannels(link);
      toast(listAll().length > before
        ? `✓ ${name} (${platform}) adicionado às Lives`
        : `${name} já está nas Lives`);
    }

    function bind() {
      queryAll('[data-clear]').forEach(button => {
        button.addEventListener('click', () => clearChannels(button.dataset.clear));
      });
      onAddLive(receiveGameLink);
    }

    return Object.freeze({ addChannels, bind, clearChannels, findChannelById, importGameChannels, listAll, receiveGameChannels, removeChannel });
  }

  const api = Object.freeze({ createLiveChannelCollection });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveChannelCollection = api;
})();
