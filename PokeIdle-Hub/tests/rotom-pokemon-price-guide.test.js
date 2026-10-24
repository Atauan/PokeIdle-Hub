'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const guide = require('../assets/addons/rotom-sniper/pokemon-price-guide.js');

test('normaliza campos de inventário e anúncios para um formato comum', () => {
  const pokemon = guide.normalizePokemon({
    id: 41,
    speciesId: 238,
    nome: 'Smoochum',
    level: 40,
    potencia: 2,
    qualidade: 70,
    nota: 6.4,
    shiny: false
  });

  assert.deepEqual(
    {
      id: pokemon.id,
      speciesId: pokemon.speciesId,
      name: pokemon.name,
      level: pokemon.level,
      potency: pokemon.potency,
      quality: pokemon.quality,
      note: pokemon.note,
      shiny: pokemon.shiny
    },
    {
      id: 41,
      speciesId: 238,
      name: 'Smoochum',
      level: 40,
      potency: 2,
      quality: 70,
      note: 6.4,
      shiny: false
    }
  );
});

test('preserva IVs individuais, stats atuais e tipos quando o jogo os envia', () => {
  const pokemon = guide.normalizePokemon({
    speciesId: 2021,
    ivs: { hp: 31, atk: 28, def: 20, spAtk: 24, spDef: 31, speed: 27 },
    stats: { hp: 221, atk: 207, def: 174, spAtk: 232, spDef: 217, speed: 243 },
    tipos: ['FIRE', 'FLYING']
  });

  assert.deepEqual(pokemon.ivs, { hp: 31, atk: 28, def: 20, spAtk: 24, spDef: 31, speed: 27 });
  assert.deepEqual(pokemon.stats, { hp: 221, atk: 207, def: 174, spAtk: 232, spDef: 217, speed: 243 });
  assert.deepEqual(pokemon.types, ['FIRE', 'FLYING']);
});

test('normaliza aliases de stats usados por fichas do jogo', () => {
  const pokemon = guide.normalizePokemon({
    speciesId: 2021,
    ivs: { hp: 1, attack: 2, defense: 3, spatk: 4, spdef: 5, speed: 6 },
    stats: { hp: 101, atk: 102, def: 103, sp_atk: 104, sp_def: 105, spd: 106 }
  });
  assert.deepEqual(pokemon.ivs, { hp: 1, atk: 2, def: 3, spAtk: 4, spDef: 5, speed: 6 });
  assert.deepEqual(pokemon.stats, { hp: 101, atk: 102, def: 103, spAtk: 104, spDef: 105, speed: 106 });
});

test('compara anúncios da mesma espécie sem aplicar filtros da lista da conta', () => {
  const target = { speciesId: 2021, potencia: 2, qualidade: 1.5, nota: 3.6 };
  const offers = [
    { id: 1, ficha: { speciesId: 2021, potencia: 2, nota: 3.5 }, preco: 10, moeda: 'gold' },
    { id: 2, ficha: { speciesId: 2021, potencia: 2, nota: 3.6 }, preco: 20, moeda: 'gold' },
    { id: 3, ficha: { speciesId: 2021, potencia: 2, nota: 3.7, shiny: true }, preco: 30, moeda: 'gold' },
    { id: 4, ficha: { speciesId: 2021, potencia: 5, nota: 4 }, preco: 40, moeda: 'gold' }
  ];

  assert.deepEqual(guide.getComparableOffers(target, offers).map(row => row.id), [1, 2, 3, 4]);
});

test('filtra a lista da conta por qualquer critério ativo: nota acima de 3,5, Shiny ou P5', () => {
  const pokemons = [
    { id: 1, speciesId: 25, nota: 3.6, potencia: 2 },
    { id: 2, speciesId: 25, nota: 2.2, potencia: 2, shiny: true },
    { id: 3, speciesId: 25, nota: 2.2, potencia: 5 },
    { id: 4, speciesId: 25, nota: 3.5, potencia: 2 },
    { id: 5, speciesId: 25, nota: 4, potencia: 2, idAnuncio: 8 }
  ];

  assert.deepEqual(guide.filterAccountPokemons(pokemons, { noteMin: 3.5, shinyOnly: true, p5Only: true }).map(pokemon => pokemon.id), [1, 2, 3, 5]);
  assert.deepEqual(guide.filterAccountPokemons(pokemons, { noteMin: null, shinyOnly: true, p5Only: false }).map(pokemon => pokemon.id), [2]);
  assert.deepEqual(guide.filterAccountPokemons(pokemons, { noteMin: null, shinyOnly: false, p5Only: false }).map(pokemon => pokemon.id), [1, 2, 3, 4, 5]);
});

test('filtra espécie e ordena todas as categorias de anúncio do mais fraco ao mais forte', () => {
  const selected = { id: 1, speciesId: 238, potencia: 2, qualidade: 70, nota: 6, level: 40 };
  const offers = [
    { id: 10, tipo: 'pokemon', ficha: { speciesId: 238, potencia: 3, qualidade: 80, nota: 7, level: 50 }, preco: 300, moeda: 'gold' },
    { id: 11, tipo: 'pokemon', ficha: { speciesId: 238, potencia: 1, qualidade: 55, nota: 5, level: 30 }, preco: 100, moeda: 'gold' },
    { id: 12, tipo: 'pokemon', ficha: { speciesId: 239, potencia: 2, qualidade: 70, nota: 6, level: 40 }, preco: 50, moeda: 'gold' },
    { id: 13, tipo: 'pokemon', ficha: { speciesId: 238, potencia: 2, qualidade: 70, nota: 6, level: 40, shiny: true }, preco: 999, moeda: 'gold' },
    { id: 14, tipo: 'pokemon', ficha: { speciesId: 238, potencia: 5, qualidade: 70, nota: 6, level: 40 }, preco: 10000, moeda: 'gold' }
  ];

  const comparable = guide.getComparableOffers(selected, offers);
  assert.deepEqual(comparable.map(row => row.id), [11, 13, 10, 14]);
  assert.deepEqual(guide.getNearestOfferIds(selected, offers), ['13', '10', '11', '14']);
  assert.equal(guide.getPositionIndex(selected, offers), 1);
});

test('calcula sugestão separada por moeda com mediana dos anúncios mais próximos e mínimo de amostra', () => {
  const selected = { speciesId: 238, potencia: 2, qualidade: 70, nota: 6, level: 40 };
  const offers = [
    { id: 1, tipo: 'pokemon', ficha: { speciesId: 238, potencia: 2, qualidade: 70, nota: 6, level: 40 }, preco: 100, moeda: 'gold' },
    { id: 2, tipo: 'pokemon', ficha: { speciesId: 238, potencia: 2, qualidade: 70, nota: 6, level: 40 }, preco: 300, moeda: 'gold' },
    { id: 3, tipo: 'pokemon', ficha: { speciesId: 238, potencia: 2, qualidade: 70, nota: 6, level: 40 }, preco: 200, moeda: 'gold' },
    { id: 4, tipo: 'pokemon', ficha: { speciesId: 238, potencia: 2, qualidade: 70, nota: 6, level: 40 }, preco: 12, moeda: 'orb' }
  ];

  const suggestions = guide.getPriceSuggestions(selected, offers);
  assert.deepEqual(suggestions.gold, { sampleSize: 3, suggestedPrice: 200, minPrice: 100, maxPrice: 300, conclusive: true });
  assert.deepEqual(suggestions.orb, { sampleSize: 1, suggestedPrice: null, minPrice: 12, maxPrice: 12, conclusive: false });
});

test('arredonda mediana de uma amostra par para uma unidade inteira', () => {
  const selected = { speciesId: 25, potencia: 2, qualidade: 70, nota: 6, level: 40 };
  const offers = [101, 102, 103, 104].map((preco, index) => ({
    id: index + 1,
    tipo: 'pokemon',
    ficha: { speciesId: 25, potencia: 2, qualidade: 70, nota: 6, level: 40 },
    preco,
    moeda: 'gold'
  }));
  assert.equal(guide.getPriceSuggestions(selected, offers).gold.suggestedPrice, 103);
});

test('ignora anúncios sem preço válido e normaliza moedas conhecidas', () => {
  assert.equal(guide.normalizeCurrency('coins'), 'gold');
  assert.equal(guide.normalizeCurrency('gemas'), 'orb');
  assert.equal(guide.normalizeCurrency('unknown'), null);
  assert.equal(guide.normalizeOffer({ speciesId: 1, preco: 0, moeda: 'gold' }), null);
});

test('filtra anúncios comparáveis pela moeda selecionada sem misturar Coins e Gemas', () => {
  const selected = { speciesId: 25, potencia: 2, qualidade: 70, nota: 6, level: 40 };
  const offers = [
    { id: 1, tipo: 'pokemon', ficha: { speciesId: 25, potencia: 2, qualidade: 70, nota: 6, level: 40 }, preco: 100, moeda: 'gold' },
    { id: 2, tipo: 'pokemon', ficha: { speciesId: 25, potencia: 2, qualidade: 70, nota: 6, level: 40 }, preco: 12, moeda: 'orb' },
    { id: 3, tipo: 'pokemon', ficha: { speciesId: 26, potencia: 2, qualidade: 70, nota: 6, level: 40 }, preco: 50, moeda: 'gold' }
  ];

  assert.deepEqual(guide.getComparableOffersByCurrency(selected, offers, 'gold').map(offer => offer.id), [1]);
  assert.deepEqual(guide.getComparableOffersByCurrency(selected, offers, 'orb').map(offer => offer.id), [2]);
  assert.deepEqual(guide.getComparableOffersByCurrency(selected, offers, 'invalid'), []);
  assert.deepEqual(guide.getNearestOfferIds(selected, offers, 'gold'), ['1']);
  assert.deepEqual(guide.getNearestOfferIds(selected, offers, 'orb'), ['2']);
});

test('alternância de moedas permite ambas e não deixa desligar a última ativa', () => {
  assert.deepEqual(guide.toggleCurrencyFilter(['gold', 'orb'], 'gold'), ['orb']);
  assert.deepEqual(guide.toggleCurrencyFilter(['orb'], 'gold'), ['gold', 'orb']);
  assert.deepEqual(guide.toggleCurrencyFilter(['gold'], 'gold'), ['gold']);
  assert.deepEqual(guide.toggleCurrencyFilter(['orb'], 'orb'), ['orb']);
});

test('calcula a posição do Pokémon próprio apenas entre anúncios da moeda escolhida', () => {
  const selected = { speciesId: 25, potencia: 2, qualidade: 70, nota: 6, level: 40 };
  const offers = [
    { id: 1, tipo: 'pokemon', ficha: { speciesId: 25, potencia: 1, qualidade: 65, nota: 5.5, level: 40 }, preco: 100, moeda: 'gold' },
    { id: 2, tipo: 'pokemon', ficha: { speciesId: 25, potencia: 2, qualidade: 72, nota: 6.2, level: 40 }, preco: 12, moeda: 'orb' },
    { id: 3, tipo: 'pokemon', ficha: { speciesId: 25, potencia: 3, qualidade: 75, nota: 7, level: 40 }, preco: 200, moeda: 'gold' }
  ];

  assert.equal(guide.getPositionIndexByCurrency(selected, offers, 'gold'), 1);
  assert.equal(guide.getPositionIndexByCurrency(selected, offers, 'orb'), 0);
});

test('ordena por atributos disponíveis sem comparar nota com IV em escalas diferentes', () => {
  const left = guide.normalizePokemon({ speciesId: 1, potencia: 2, qualidade: 50, nota: 8, level: 20 });
  const right = guide.normalizePokemon({ speciesId: 1, potencia: 2, qualidade: 50, ivTotal: 150, level: 30 });
  assert.equal(guide.compareStrength(left, right), -10);
});

test('filtra somente pela nota real do jogo e mantém a precisão para o limite 3,5', () => {
  assert.equal(guide.isAboveNoteThreshold({ speciesId: 1, nota: 3.5 }, 3.5), false);
  assert.equal(guide.isAboveNoteThreshold({ speciesId: 1, nota: 3.6 }, 3.5), true);
  assert.equal(guide.isAboveNoteThreshold({ speciesId: 1, ivTotal: 100, qualidade: 50 }, 3.5), false);
  assert.equal(guide.isAboveNoteThreshold({ speciesId: 1, qualidade: 50 }, 3.5), false);

  const charizard = guide.normalizePokemon({
    id: 274,
    speciesId: 2021,
    nome: 'Brave Charizard',
    level: 100,
    potencia: 2,
    qualidade: 1.534,
    ivTotal: 161,
    nota: 3.572,
    shiny: false
  });
  assert.equal(charizard.speciesId, 2021);
  assert.equal(charizard.note, 3.572);
  assert.equal(guide.isAboveNoteThreshold(charizard.raw, 3.5), true);
});
