'use strict';

(function exposePokemonPriceGuide(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RotomPokemonPriceGuide = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPokemonPriceGuide() {
  const MIN_SAMPLE_SIZE = 3;
  const MAX_NEAREST_OFFERS = 5;
  const STAT_KEYS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeCurrency(value) {
    const currency = String(value || '').toLowerCase();
    if (['gold', 'coin', 'coins', 'gp'].includes(currency)) return 'gold';
    if (['orb', 'orbs', 'gem', 'gems', 'gema', 'gemas', 'diamante', 'diamantes', 'ponto', 'pontos'].includes(currency)) return 'orb';
    return null;
  }

  function toggleCurrencyFilter(selectedCurrencies, currency) {
    const normalized = normalizeCurrency(currency);
    if (!normalized || !Array.isArray(selectedCurrencies)) return ['gold', 'orb'];
    const selected = new Set(selectedCurrencies.map(normalizeCurrency).filter(Boolean));
    if (!selected.has(normalized)) {
      selected.add(normalized);
    } else if (selected.size > 1) {
      selected.delete(normalized);
    }
    return ['gold', 'orb'].filter(value => selected.has(value));
  }

  function normalizeStatMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const aliases = {
      hp: ['hp'],
      atk: ['atk', 'attack'],
      def: ['def', 'defense'],
      spAtk: ['spAtk', 'spatk', 'sp_atk', 'specialAttack'],
      spDef: ['spDef', 'spdef', 'sp_def', 'specialDefense'],
      speed: ['speed', 'spd']
    };
    const entries = STAT_KEYS
      .map(key => [key, numberOrNull(aliases[key].map(alias => value[alias]).find(entry => entry !== undefined))])
      .filter(([, number]) => number !== null);
    return entries.length ? Object.fromEntries(entries) : null;
  }

  function normalizePokemon(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw.ficha || raw.poke || raw.pokemon || raw;
    const speciesId = numberOrNull(source.speciesId || source.pokemonId || source.pId || source.idEspecie);
    if (speciesId === null) return null;

    const ivs = source.ivs && typeof source.ivs === 'object' ? source.ivs : null;
    const ivTotal = numberOrNull(source.ivTotal) ?? (ivs
      ? Object.values(ivs).reduce((sum, value) => sum + (numberOrNull(value) || 0), 0)
      : null);
    const note = numberOrNull(source.nota);
    const potency = numberOrNull(source.potencia || source.power);

    return {
      id: raw.id ?? source.id ?? null,
      speciesId,
      name: String(source.nome || source.name || raw.pokemonNome || raw.nome || raw.name || `Pokémon #${speciesId}`),
      level: numberOrNull(source.level || source.lvl),
      potency,
      quality: numberOrNull(source.qualidade ?? source.quality),
      note,
      ivTotal,
      ivs: normalizeStatMap(source.ivs),
      stats: normalizeStatMap(source.stats),
      types: Array.isArray(source.tipos || source.types)
        ? (source.tipos || source.types).filter(type => typeof type === 'string').slice(0, 2)
        : [],
      shiny: Boolean(source.shiny || source.isShiny || source.lookShiny),
      isP5: potency !== null && potency >= 5,
      raw
    };
  }

  function normalizeOffer(raw) {
    const pokemon = normalizePokemon(raw);
    const price = numberOrNull(raw && (raw.preco ?? raw.unitPrice ?? raw.price));
    const currency = normalizeCurrency(raw && raw.moeda);
    if (!pokemon || price === null || price <= 0 || !currency) return null;
    if (raw.estado && raw.estado !== 'aberto') return null;
    if (raw.comprador) return null;
    return {
      ...pokemon,
      id: raw.id ?? pokemon.id,
      price,
      currency,
      seller: String(raw.vendedor || raw.vendedorNome || raw.seller || raw.dono || ''),
      offer: raw
    };
  }

  function getPokemonNote(raw) {
    const pokemon = normalizePokemon(raw);
    return pokemon ? pokemon.note : null;
  }

  function isAboveNoteThreshold(raw, threshold) {
    const note = getPokemonNote(raw);
    const minimum = numberOrNull(threshold);
    return note !== null && minimum !== null && note > minimum;
  }

  function compareNullableAscending(left, right) {
    const a = left === null ? -1 : left;
    const b = right === null ? -1 : right;
    return a - b;
  }

  function compareStrength(left, right) {
    const noteComparison = left.note !== null && right.note !== null
      ? compareNullableAscending(left.note, right.note)
      : left.ivTotal !== null && right.ivTotal !== null
        ? compareNullableAscending(left.ivTotal, right.ivTotal)
        : 0;
    return compareNullableAscending(left.potency, right.potency) ||
      compareNullableAscending(left.quality, right.quality) ||
      noteComparison ||
      compareNullableAscending(left.level, right.level);
  }

  function attributeDistance(left, right) {
    const deltas = [];
    if (left.potency !== null && right.potency !== null) deltas.push(Math.abs(left.potency - right.potency) / 4);
    if (left.quality !== null && right.quality !== null) deltas.push(Math.abs(left.quality - right.quality) / 100);
    if (left.note !== null && right.note !== null) deltas.push(Math.abs(left.note - right.note) / 10);
    else if (left.ivTotal !== null && right.ivTotal !== null) deltas.push(Math.abs(left.ivTotal - right.ivTotal) / 192);
    if (left.level !== null && right.level !== null) deltas.push(Math.abs(left.level - right.level) / 500);
    return deltas.length ? deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length : Number.POSITIVE_INFINITY;
  }

  function filterAccountPokemons(pokemons, filters = {}) {
    if (!Array.isArray(pokemons)) return [];
    const noteMin = numberOrNull(filters.noteMin);
    const shinyOnly = Boolean(filters.shinyOnly);
    const p5Only = Boolean(filters.p5Only);
    const hasCriteria = noteMin !== null || shinyOnly || p5Only;
    if (!hasCriteria) return pokemons.slice();

    return pokemons.filter(pokemon => {
      if (!pokemon || pokemon.id === null || pokemon.id === undefined) return false;
      const matches = [];
      if (noteMin !== null) matches.push(isAboveNoteThreshold(pokemon, noteMin));
      if (shinyOnly) matches.push(Boolean(pokemon.shiny || pokemon.isShiny || pokemon.lookShiny));
      if (p5Only) matches.push(Number(pokemon.potencia || pokemon.power || 0) >= 5);
      return matches.some(Boolean);
    });
  }

  function isComparable(target, offer) {
    return offer.speciesId === target.speciesId;
  }

  function getComparableOffers(targetRaw, rawOffers) {
    const target = normalizePokemon(targetRaw);
    if (!target || !Array.isArray(rawOffers)) return [];
    return rawOffers
      .map(normalizeOffer)
      .filter(offer => offer && isComparable(target, offer))
      .map(offer => ({ ...offer, distance: attributeDistance(target, offer) }))
      .sort((left, right) => compareStrength(left, right) || left.price - right.price);
  }

  function getComparableOffersByCurrency(targetRaw, rawOffers, currency) {
    const normalizedCurrency = normalizeCurrency(currency);
    if (!normalizedCurrency) return [];
    return getComparableOffers(targetRaw, rawOffers)
      .filter(offer => offer.currency === normalizedCurrency);
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function getPriceSuggestions(targetRaw, rawOffers) {
    const target = normalizePokemon(targetRaw);
    const comparable = getComparableOffers(targetRaw, rawOffers);
    const suggestions = { gold: null, orb: null };
    if (!target) return suggestions;

    for (const currency of ['gold', 'orb']) {
      const nearest = comparable
        .filter(offer => offer.currency === currency)
        .sort((left, right) => left.distance - right.distance || compareStrength(left, right))
        .slice(0, MAX_NEAREST_OFFERS);
      const prices = nearest.map(offer => offer.price);
      suggestions[currency] = {
        sampleSize: prices.length,
        suggestedPrice: prices.length >= MIN_SAMPLE_SIZE ? Math.round(median(prices)) : null,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        conclusive: prices.length >= MIN_SAMPLE_SIZE
      };
    }
    return suggestions;
  }

  function getNearestOfferIds(targetRaw, rawOffers, currency) {
    const target = normalizePokemon(targetRaw);
    if (!target || !Array.isArray(rawOffers)) return [];
    const normalizedCurrency = currency ? normalizeCurrency(currency) : null;
    if (currency && !normalizedCurrency) return [];
    return rawOffers
      .map(normalizeOffer)
      .filter(offer => offer && isComparable(target, offer) && (!normalizedCurrency || offer.currency === normalizedCurrency))
      .map(offer => ({ ...offer, distance: attributeDistance(target, offer) }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, MAX_NEAREST_OFFERS)
      .map(offer => String(offer.id));
  }

  function getPositionIndex(targetRaw, rawOffers) {
    const target = normalizePokemon(targetRaw);
    const comparable = getComparableOffers(targetRaw, rawOffers);
    if (!target) return 0;
    const index = comparable.findIndex(offer => compareStrength(target, offer) <= 0);
    return index === -1 ? comparable.length : index;
  }

  function getPositionIndexByCurrency(targetRaw, rawOffers, currency) {
    const target = normalizePokemon(targetRaw);
    const comparable = getComparableOffersByCurrency(targetRaw, rawOffers, currency);
    if (!target) return 0;
    const index = comparable.findIndex(offer => compareStrength(target, offer) <= 0);
    return index === -1 ? comparable.length : index;
  }

  return {
    MIN_SAMPLE_SIZE,
    MAX_NEAREST_OFFERS,
    normalizeCurrency,
    toggleCurrencyFilter,
    normalizePokemon,
    normalizeOffer,
    getPokemonNote,
    isAboveNoteThreshold,
    filterAccountPokemons,
    compareStrength,
    getComparableOffers,
    getComparableOffersByCurrency,
    getPriceSuggestions,
    getNearestOfferIds,
    getPositionIndex,
    getPositionIndexByCurrency
  };
});
