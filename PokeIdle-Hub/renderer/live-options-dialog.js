'use strict';

(() => {
  function createLiveOptionsDialog({ query }) {
    function bind() {
      const openButton = query('#live-options-open');
      const dialog = query('#live-options-dialog');
      const closeButton = query('#live-options-close');

      openButton.addEventListener('click', () => {
        dialog.showModal();
        closeButton.focus();
      });
      closeButton.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
      });
    }

    return Object.freeze({ bind });
  }

  const api = Object.freeze({ createLiveOptionsDialog });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveOptionsDialog = api;
})();
