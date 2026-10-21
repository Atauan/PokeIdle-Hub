'use strict';

(() => {
  function createAppStorage(storage) {
    function load(key, fallback) {
      try {
        const value = JSON.parse(storage.getItem(key));
        return value ?? fallback;
      } catch (_) {
        return fallback;
      }
    }

    function save(key, value) {
      storage.setItem(key, JSON.stringify(value));
    }

    return Object.freeze({ load, save });
  }

  const api = Object.freeze({ createAppStorage });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleAppStorage = api;
})();
