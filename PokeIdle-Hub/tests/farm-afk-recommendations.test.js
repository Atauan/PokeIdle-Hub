'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFarmAfk() {
  const window = { PF: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'src', 'modules', 'farm-afk.js'), 'utf8');
  vm.runInNewContext(source, { window, console, setTimeout, clearTimeout });
  return window.PF.FarmAfk;
}

test('imported Pokemon recommendations exclude hunts above the Pokemon level', () => {
  const farmAfk = loadFarmAfk();
  const ranking = farmAfk.simularRanking({
    level: 40,
    hpMax: 10000,
    stats: { atk: 500, spAtk: 500, def: 500, spDef: 500 },
  }, [
    { slug: 'lower', nome: 'Hunt inferior', nivel: 25 },
    { slug: 'same', nome: 'Hunt do nível', nivel: 40 },
    { slug: 'higher', nome: 'Hunt acima', nivel: 45 },
  ]);

  assert.deepEqual(ranking.todas.map((hunt) => hunt.slug), ['lower', 'same']);
  assert.ok(ranking.melhoresXp.every((hunt) => hunt.nivel <= 40));
  assert.ok(ranking.melhoresOuro.every((hunt) => hunt.nivel <= 40));
});

test('imported Pokemon below the first hunt has no recommendations instead of falling back to another level', () => {
  const farmAfk = loadFarmAfk();
  const ranking = farmAfk.simularRanking({
    level: 3,
    hpMax: 10000,
    stats: { atk: 500, spAtk: 500, def: 500, spDef: 500 },
  }, [
    { slug: 'first', nome: 'Primeira hunt', nivel: 5 },
  ]);

  assert.equal(ranking.todas.length, 0);
  assert.equal(ranking.melhoresXp.length, 0);
  assert.equal(ranking.melhoresOuro.length, 0);
});
