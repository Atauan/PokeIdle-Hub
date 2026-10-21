'use strict';

(() => {
  function createLiveFollowController({ followTile, toast }) {
    async function followSingleTile(tile, button) {
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Seguindo...';
      button.classList.add('loading');
      try {
        const result = await followTile(tile);
        if (result.status === 'followed' || result.status === 'already_following') {
          button.textContent = '✓ Seguido';
          button.classList.remove('loading');
          button.classList.add('followed');
          button.title = `Você segue ${tile.item.channel} nesta conta`;
          toast(`✓ ${tile.item.channel} seguido com sucesso na conta ${tile.acc.name}!`);
        } else if (result.status === 'not_logged_in') {
          resetForRetry(button);
          toast(`Atenção: Entre na ${tile.p === 'kick' ? 'Kick' : 'Twitch'} para a conta "${tile.acc.name}" para poder seguir.`);
        } else if (result.status === 'not_ready') {
          resetForRetry(button);
          toast(`O canal ${tile.item.channel} ainda está carregando. Tente novamente em instantes.`);
        } else {
          resetForRetry(button);
          toast(`Não foi possível seguir ${tile.item.channel}.`);
        }
      } catch (_) {
        resetForRetry(button);
        toast(`Erro ao processar comando de seguir em ${tile.item.channel}.`);
      }
    }

    function resetForRetry(button) {
      button.disabled = false;
      button.textContent = '+ Seguir';
      button.classList.remove('loading');
    }

    return Object.freeze({ followSingleTile });
  }

  const api = Object.freeze({ createLiveFollowController });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveFollowController = api;
})();
