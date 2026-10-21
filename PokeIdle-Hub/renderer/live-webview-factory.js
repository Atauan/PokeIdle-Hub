'use strict';

(() => {
  const NET_ERRORS = new Set([-7, -21, -100, -101, -102, -103, -104, -105, -106, -109, -118, -130, -137]);

  function createLiveWebviewFactory({ document, el, enqueueLoad, primaryPartition, setTimeoutFn = setTimeout }) {
    function skeleton(style) {
      const bone = cls => el('div', { class: `bone ${cls}` });
      const children = {
        video: [bone('screen'), bone('play'), bone('l1'), bone('l2')],
        chat: [bone('avatar'), bone('bar'), bone('btn')],
        game: [bone('top'), ...Array.from({ length: 6 }, (_, index) => bone(`side s${index}`)),
          el('div', { class: 'cards' }, ...Array.from({ length: 8 }, () => bone('card')))],
      }[style] || [];
      return el('div', { class: `skeleton sk-${style}`, 'aria-hidden': 'true' }, ...children);
    }

    function reloadWebview(webview) {
      if (!webview.isConnected) return;
      try { webview.__ready ? webview.reload() : (webview.src = webview.__pfSrc); }
      catch (_) { webview.src = webview.__pfSrc; }
    }

    function disposeWebview(webview) {
      if (!webview) return;
      webview.__pfCancelQueuedLoad?.();
      webview.__pfCancelQueuedLoad = null;
    }

    function makeWebview(src, options = {}) {
      const webview = document.createElement('webview');
      webview.setAttribute('partition', options.partition || primaryPartition);
      webview.setAttribute('allowpopups', '');
      webview.setAttribute('webpreferences', 'backgroundThrottling=no');
      webview.__pfSrc = src;
      webview.__ready = false;
      webview.__muted = options.muted ?? false;
      webview.__skeleton = skeleton(options.skeleton || 'video');
      webview.addEventListener('did-start-loading', () => webview.__skeleton.classList.remove('gone'));
      webview.addEventListener('did-stop-loading', () => setTimeoutFn(() => {
        let loading = false;
        try { loading = webview.isLoading(); } catch (_) { /* ainda não anexada */ }
        if (!loading) webview.__skeleton.classList.add('gone');
      }, 800));
      webview.addEventListener('dom-ready', () => {
        webview.__ready = true;
        try { webview.setAudioMuted(webview.__muted); } catch (_) { /* ignora */ }
        if (options.onReady) options.onReady(webview);
      });
      webview.addEventListener('render-process-gone', () => setTimeoutFn(() => reloadWebview(webview), 2000));
      webview.addEventListener('unresponsive', () => reloadWebview(webview));
      webview.addEventListener('did-fail-load', event => {
        if (!event.isMainFrame || !NET_ERRORS.has(event.errorCode)) return;
        setTimeoutFn(() => {
          if (!webview.isConnected) return;
          try { webview.loadURL(event.validatedURL || webview.__pfSrc); }
          catch (_) { webview.src = webview.__pfSrc; }
        }, 30000);
      });
      if (options.now) webview.src = src;
      else webview.__pfCancelQueuedLoad = enqueueLoad(() => {
        if (!webview.isConnected || webview.getAttribute('src')) return false;
        webview.src = src;
        return true;
      });
      return webview;
    }

    return Object.freeze({ disposeWebview, makeWebview, reloadWebview });
  }

  const api = Object.freeze({ createLiveWebviewFactory });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveWebviewFactory = api;
})();
