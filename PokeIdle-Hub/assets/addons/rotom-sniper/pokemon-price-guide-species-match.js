'use strict';

(function exposePriceGuideSpeciesMatcher(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RotomPokemonPriceGuideSpeciesMatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPriceGuideSpeciesMatcher() {
  function normalizeName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase();
  }

  function matchSpecies(targetSpeciesId, targetName, offerSpeciesId, offerName) {
    const targetId = Number(targetSpeciesId);
    const offerId = Number(offerSpeciesId);
    if (Number.isSafeInteger(targetId) && targetId > 0 && offerId === targetId) return 'id';
    const normalizedTargetName = normalizeName(targetName);
    if (normalizedTargetName && normalizedTargetName === normalizeName(offerName)) return 'name';
    return null;
  }

  return { matchSpecies };
});
