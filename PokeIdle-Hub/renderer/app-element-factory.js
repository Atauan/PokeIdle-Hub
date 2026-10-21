'use strict';

(() => {
  function createElementFactory(documentObject) {
    return function el(tag, props = {}, ...children) {
      const element = documentObject.createElement(tag);
      for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === 'class') element.className = value;
        else if (key === 'text') element.textContent = value;
        else if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
        else element.setAttribute(key, value === true ? '' : String(value));
      }
      children.flat().forEach(child => { if (child != null) element.append(child); });
      return element;
    };
  }

  const api = Object.freeze({ createElementFactory });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleElementFactory = api;
})();
