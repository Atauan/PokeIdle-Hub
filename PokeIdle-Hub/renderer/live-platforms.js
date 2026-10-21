'use strict';

(() => {
  const platforms = Object.freeze({
    kick: Object.freeze({
      title: 'Kick',
      color: 'var(--kick)',
      host: 'kick.com',
      player: channel => `https://player.kick.com/${channel}?autoplay=true&muted=true`,
      chat: channel => `https://kick.com/popout/${channel}/chat`,
    }),
    twitch: Object.freeze({
      title: 'Twitch',
      color: 'var(--twitch)',
      host: 'www.twitch.tv',
      // Página completa mantém o player e reaproveita o chat nativo do canal.
      player: channel => `https://www.twitch.tv/${channel}`,
      chat: channel => `https://www.twitch.tv/popout/${channel}/chat?popout=`,
    }),
  });

  const api = Object.freeze({ platforms });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLivePlatforms = api;
})();
