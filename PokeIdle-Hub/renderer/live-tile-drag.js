'use strict';

(() => {
  const MIN_W = 180;
  const MIN_H = 120;
  const CURSORS = Object.freeze({
    move: 'grabbing',
    right: 'ew-resize',
    bottom: 'ns-resize',
    corner: 'nwse-resize',
  });

  function createLiveTileDragController({ state, tiles, getGrid, getShield, layout, persist, windowObject }) {
    let drag = null;
    let bound = false;

    function startDrag(event, id) {
      const handle = event.target.closest('[data-drag]');
      if (!handle || event.button !== 0 || event.target.closest('button')) return;
      const tile = tiles.get(id);
      if (!tile || !tile.rect) return;

      event.preventDefault();
      drag = {
        id,
        kind: handle.dataset.drag,
        x0: event.clientX,
        y0: event.clientY,
        r0: { ...tile.rect },
      };
      const shield = getShield();
      shield.style.cursor = CURSORS[drag.kind];
      shield.hidden = false;
    }

    function onPointerMove(event) {
      if (!drag) return;
      const grid = getGrid();
      const width = grid.clientWidth;
      const height = grid.clientHeight;
      const dx = event.clientX - drag.x0;
      const dy = event.clientY - drag.y0;
      const rect = { ...drag.r0 };
      if (drag.kind === 'move') { rect.x += dx; rect.y += dy; }
      if (drag.kind === 'right' || drag.kind === 'corner') rect.w += dx;
      if (drag.kind === 'bottom' || drag.kind === 'corner') rect.h += dy;
      const snap = value => Math.round(value / 8) * 8;
      rect.w = Math.min(Math.max(snap(rect.w), MIN_W), width);
      rect.h = Math.min(Math.max(snap(rect.h), MIN_H), height);
      rect.x = Math.min(Math.max(snap(rect.x), 0), width - rect.w);
      rect.y = Math.min(Math.max(snap(rect.y), 0), height - rect.h);
      state.frames[drag.id] = [rect.x / width, rect.y / height, rect.w / width, rect.h / height];
      layout();
    }

    function onPointerUp() {
      if (!drag) return;
      drag = null;
      getShield().hidden = true;
      persist();
    }

    function cancelForTile(id) {
      if (drag?.id !== id) return;
      drag = null;
      getShield().hidden = true;
    }

    function bind() {
      if (bound) return;
      bound = true;
      windowObject.addEventListener('pointermove', onPointerMove);
      windowObject.addEventListener('pointerup', onPointerUp);
    }

    function dispose() {
      if (bound) {
        windowObject.removeEventListener('pointermove', onPointerMove);
        windowObject.removeEventListener('pointerup', onPointerUp);
        bound = false;
      }
      if (drag) {
        drag = null;
        getShield().hidden = true;
      }
    }

    return Object.freeze({ bind, startDrag, cancelForTile, dispose });
  }

  const api = Object.freeze({ createLiveTileDragController });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveTileDrag = api;
})();
