'use strict';

(() => {
  const TWITCH_FOLLOW_SCRIPT = `
    (() => {
      try {
        const unfollow = document.querySelector(
          'button[data-a-target="unfollow-button"], button[data-test-selector="unfollow-button"], [data-a-target="followed-button"]'
        );
        if (unfollow) return { ok: true, status: 'already_following' };

        const follow = document.querySelector(
          'button[data-a-target="follow-button"], button[data-test-selector="follow-button"]'
        ) || Array.from(document.querySelectorAll('button')).find(b => {
          const txt = (b.textContent || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          return (txt === 'seguir' || txt === 'follow' || aria.includes('seguir') || aria.includes('follow')) && !aria.includes('deixar');
        });

        if (follow) {
          if (follow.disabled) return { ok: false, status: 'disabled' };
          follow.click();
          return { ok: true, status: 'followed' };
        }

        const isAuth = !!document.querySelector(
          '[data-a-target="user-display-name"], [data-a-target="user-menu-toggle"], [data-a-target="avatar-image"], .tw-avatar'
        );
        if (!isAuth) return { ok: false, status: 'not_logged_in' };

        return { ok: false, status: 'btn_not_found' };
      } catch (e) {
        return { ok: false, status: 'error', error: String(e) };
      }
    })()
  `;

  function createKickFollowScript(channel) {
    return `
      (async (canal) => {
        try {
          const btn = document.querySelector('button[data-testid="follow-button"], .follow-btn');
          if (btn) {
            btn.click();
            return { ok: true, status: 'followed' };
          }

          const csrf = document.cookie.split('; ').find(r => r.startsWith('XSRF-TOKEN='))?.split('=')[1] || '';
          const r = await fetch('/api/v2/channels/' + canal + '/follow', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-XSRF-TOKEN': decodeURIComponent(csrf)
            },
            credentials: 'include'
          });

          if (r.ok || r.status === 200 || r.status === 201) return { ok: true, status: 'followed' };
          if (r.status === 409 || r.status === 422) return { ok: true, status: 'already_following' };
          if (r.status === 401 || r.status === 403) return { ok: false, status: 'not_logged_in' };
          return { ok: false, status: 'api_' + r.status };
        } catch (e) {
          return { ok: false, status: 'error', error: String(e) };
        }
      })(${JSON.stringify(String(channel))})
    `;
  }

  function isWebviewReady(webview) {
    return !!webview && !!webview.__ready && !!webview.isConnected;
  }

  async function followTile(tile) {
    if (!tile || !tile.item) return { ok: false, status: 'no_tile' };

    if (tile.p === 'twitch') {
      const webview = tile.player;
      if (!isWebviewReady(webview)) {
        return { ok: false, status: 'not_ready', channel: tile.item.channel };
      }
      try {
        const result = await webview.executeJavaScript(TWITCH_FOLLOW_SCRIPT);
        return { ...result, channel: tile.item.channel, platform: 'twitch' };
      } catch (error) {
        return { ok: false, status: 'exec_error', channel: tile.item.channel, error: String(error) };
      }
    }

    if (tile.p === 'kick') {
      const webview = tile.chat || tile.player;
      if (!isWebviewReady(webview)) {
        return { ok: false, status: 'not_ready', channel: tile.item.channel };
      }
      try {
        const result = await webview.executeJavaScript(createKickFollowScript(tile.item.channel));
        return { ...result, channel: tile.item.channel, platform: 'kick' };
      } catch (error) {
        return { ok: false, status: 'exec_error', channel: tile.item.channel, error: String(error) };
      }
    }

    return { ok: false, status: 'unsupported' };
  }

  const api = Object.freeze({ createLiveFollowService });
  function createLiveFollowService() {
    return Object.freeze({ followTile });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveFollow = api;
})();
