'use strict';

(() => {
  function createAppToast({ query, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) {
    let toastTimer = null;

    function show(message) {
      const toast = query('#toast');
      toast.textContent = message;
      toast.hidden = false;
      clearTimeoutFn(toastTimer);
      toastTimer = setTimeoutFn(() => { toast.hidden = true; }, 3000);
    }

    return Object.freeze({ show });
  }

  const api = Object.freeze({ createAppToast });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleAppToast = api;
})();
