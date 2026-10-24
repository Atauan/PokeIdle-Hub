'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const matcher = require('../assets/addons/rotom-sniper/pokemon-price-guide-species-match.js');

test('aceita ID igual ou nome exato quando o ID diverge entre conta e Mercado', () => {
  assert.equal(matcher.matchSpecies(2021, 'Brave Charizard', 2021, 'Charizard'), 'id');
  assert.equal(matcher.matchSpecies(2021, 'Brave Charizard', 6, 'Brave Charizard'), 'name');
  assert.equal(matcher.matchSpecies(2021, 'Brave Charizard', 6, 'Brave Charizard Mega'), null);
});

test('normaliza caixa, acentos e espaços sem aceitar correspondência parcial', () => {
  assert.equal(matcher.matchSpecies(25, 'Pikachu', 26, '  PIKACHU  '), 'name');
  assert.equal(matcher.matchSpecies(25, 'Pikachu', 26, 'Pikachu Shiny'), null);
});
