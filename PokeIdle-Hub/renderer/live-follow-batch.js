'use strict';

(() => {
  function createLiveFollowBatch({ getOpenTiles, getButton, followTile, toast, logError, wait }) {
    async function followAllOpenChannels() {
      const button = getButton();
      const tiles = getOpenTiles();
      if (!tiles.size) {
        toast('Nenhum canal de live aberto no momento.');
        return;
      }

      if (button) {
        button.classList.add('loading');
        button.disabled = true;
        button.innerHTML = '<span class="icon-svg icon-follow"></span> Seguindo...';
      }

      let followed = 0;
      let alreadyFollowing = 0;
      let notLoggedIn = 0;
      let notReady = 0;

      try {
        for (const [, tile] of tiles) {
          const result = await followTile(tile);
          if (result.status === 'followed') followed++;
          else if (result.status === 'already_following') alreadyFollowing++;
          else if (result.status === 'not_logged_in') notLoggedIn++;
          else if (result.status === 'not_ready') notReady++;
          await wait(250);
        }

        if (followed > 0) {
          const extra = alreadyFollowing ? ` (${alreadyFollowing} já eram seguidos)` : '';
          toast(`✓ ${followed} canal(is) seguido(s) com sucesso!${extra}`);
        } else if (alreadyFollowing > 0 && notLoggedIn === 0) {
          toast(`Você já segue todos os ${alreadyFollowing} canais abertos.`);
        } else if (notLoggedIn > 0) {
          toast(`Atenção: ${notLoggedIn} canal(is) não puderam ser seguidos por falta de login na plataforma.`);
        } else if (notReady > 0) {
          toast('Alguns canais ainda estavam carregando. Aguarde e tente novamente.');
        } else {
          toast('Comando de seguir concluído.');
        }
      } catch (error) {
        logError('Falha ao processar seguir todos:', error);
        toast('Falha ao processar comando de seguir.');
      } finally {
        if (button) {
          button.classList.remove('loading');
          button.disabled = false;
          button.innerHTML = '<span class="icon-svg icon-follow"></span> Seguir Todos';
        }
      }
    }

    return Object.freeze({ followAllOpenChannels });
  }

  const api = Object.freeze({ createLiveFollowBatch });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveFollowBatch = api;
})();
