'use strict';

(() => {
  function createLiveGridLayout({
    state,
    getGrid,
    getEmpty,
    getAccounts,
    getTiles,
    getAccountColumns,
    isAccountFavorite,
  }) {
    function layout() {
      const grid = getGrid();
      const columns = getAccountColumns();
      const tiles = getTiles();
      const accounts = getAccounts();
      grid.classList.toggle('nochat', !state.showChat);
      getEmpty().hidden = tiles.size > 0;
      const width = grid.clientWidth;
      const height = grid.clientHeight;

      if (!tiles.size || !width || !height) {
        columns.values().forEach(column => { column.col.style.display = 'none'; });
        return;
      }
      columns.values().forEach(column => { column.col.style.display = 'flex'; });

      const accountCount = accounts.length;
      accounts.forEach(account => {
        const column = columns.get(account.id);
        if (!column) return;

        const accountTiles = [...tiles.values()].filter(tile => tile.acc.id === account.id).sort((left, right) => {
          const leftFavorite = isAccountFavorite(left.item.channel, account.id) ? 1 : 0;
          const rightFavorite = isAccountFavorite(right.item.channel, account.id) ? 1 : 0;
          return rightFavorite - leftFavorite;
        });
        const tileCount = accountTiles.length;
        if (!tileCount) return;

        const bodyWidth = column.body.clientWidth || Math.floor(width / accountCount);
        let gridColumns = 1;
        if (accountCount === 1) {
          if (state.columns > 0) {
            gridColumns = Math.min(state.columns, tileCount);
          } else {
            gridColumns = bodyWidth >= 1200 ? Math.min(3, tileCount) : (bodyWidth >= 720 ? Math.min(2, tileCount) : 1);
          }
        }
        column.body.style.gridTemplateColumns = `repeat(${gridColumns}, minmax(0, 1fr))`;

        const gap = 8;
        const tileWidth = Math.max(260, Math.floor((bodyWidth - gap * (gridColumns - 1) - 16) / gridColumns));
        const videoHeight = Math.round((tileWidth * 9) / 16);
        const headerHeight = 22;
        const chatHeight = state.showChat ? 46 : 0;
        const naturalTileHeight = headerHeight + videoHeight + chatHeight;
        const minTileHeight = state.showChat ? 270 : 210;
        const maxTileHeight = state.showChat ? 460 : 400;
        const tileHeight = state.hideVideos
          ? (state.showChat ? 74 : 36)
          : Math.min(maxTileHeight, Math.max(minTileHeight, naturalTileHeight));

        accountTiles.forEach(tile => {
          tile.root.style.height = `${tileHeight}px`;
          tile.rect = { w: tileWidth, h: tileHeight };
        });
      });
    }

    return Object.freeze({ layout });
  }

  const api = Object.freeze({ createLiveGridLayout });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveGridLayout = api;
})();
