'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const addonDir = path.join(__dirname, '..', 'assets', 'addons', 'rotom-sniper');
const html = fs.readFileSync(path.join(addonDir, 'cockpit.html'), 'utf8');
const cockpit = fs.readFileSync(path.join(addonDir, 'cockpit.js'), 'utf8');
const injected = fs.readFileSync(path.join(addonDir, 'injected.js'), 'utf8');
const bridge = fs.readFileSync(path.join(addonDir, 'chrome-bridge.js'), 'utf8');
const contentScript = fs.readFileSync(path.join(addonDir, 'content_script.js'), 'utf8');
const builder = fs.readFileSync(path.join(__dirname, '..', 'tools', 'build-rotom.js'), 'utf8');
const speciesMatcher = fs.readFileSync(path.join(addonDir, 'pokemon-price-guide-species-match.js'), 'utf8');
const addon = fs.readFileSync(path.join(__dirname, '..', 'rotom-addon.js'), 'utf8');

test('cockpit loads the price comparator and exposes account market controls', () => {
  assert.ok(html.indexOf('src="pokemon-price-guide.js"') < html.indexOf('src="cockpit.js"'));
  for (const id of ['subtab-pokemon-price', 'select-price-pokemon', 'btn-compare-price-pokemon', 'price-guide-filter-coins', 'price-guide-filter-gems', 'price-guide-offers']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /class="market-cards-grid price-guide-list"/);
  assert.match(html, /#price-guide-offers \.price-guide-cards\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(html, /@media \(max-width: 1200px\)[\s\S]*?#price-guide-offers \.price-guide-cards[^}]*repeat\(3,/);
  assert.match(html, /@media \(max-width: 900px\)[\s\S]*?#price-guide-offers \.price-guide-cards[^}]*repeat\(2,/);
  assert.match(html, /@media \(max-width: 560px\)[\s\S]*?#price-guide-offers \.price-guide-cards[^}]*minmax\(0, 1fr\)/);
  assert.match(cockpit, /cards\.className = 'price-guide-cards'/);
  assert.match(cockpit, /card\.className = 'community-item-card cm-card poke price-guide-row price-guide-row-own'/);
  assert.match(cockpit, /ownLabel\.textContent = 'Seu Pokémon'/);
  assert.match(cockpit, /title\.append\(ownLabel, name\)/);
  assert.match(cockpit, /card\.className = 'community-item-card cm-card poke price-guide-row'/);
  assert.match(cockpit, /priceGuideCurrencyIcon\(currency\)/);
  assert.match(cockpit, /priceGuideCurrencyIconDataUrls\[currency\]/);
  assert.match(cockpit, /price-guide-attribute-row/);
  assert.match(html, /\.price-guide-art/);
  assert.match(html, /\.price-guide-art\s*\{[^}]*min-height:\s*64px;[^}]*height:\s*64px/s);
  assert.match(html, /\.price-guide-art \.price-guide-sprite\s*\{[^}]*width:\s*56px;[^}]*height:\s*56px/s);
  assert.match(html, /\.price-guide-row\s*\{[^}]*height:\s*auto;/s);
  for (const attribute of ['potency', 'iv', 'quality', 'note']) {
    assert.match(html, new RegExp(`\\.price-guide-seal-${attribute} \\{[^}]*background:`, 's'));
  }
  assert.match(html, /\.price-guide-attribute-row\s*\{/);
  assert.match(html, /\.price-guide-card-footer/);
  for (const icon of ['ouro.svg', 'orbe.svg']) assert.ok(fs.existsSync(path.join(addonDir, 'icons', icon)));
  assert.match(cockpit, /priceGuideFilterCoins\.addEventListener\('click'/);
  assert.match(cockpit, /priceGuideFilterGems\.addEventListener\('click'/);
  assert.match(cockpit, /priceGuideCurrencies = \['gold', 'orb'\]/);
  assert.match(cockpit, /priceGuideCurrencies\.map\(currency => \[/);
  assert.match(cockpit, /guide\.getComparableOffersByCurrency\(selected, priceGuideOffers, currency\)/);
  assert.match(cockpit, /window\.RotomPokemonPriceGuide\.toggleCurrencyFilter\(priceGuideCurrencies, 'gold'\)/);
  assert.match(cockpit, /window\.RotomPokemonPriceGuide\.toggleCurrencyFilter\(priceGuideCurrencies, 'orb'\)/);
  assert.match(cockpit, /price-guide-currency-section/);
  assert.match(html, /id="price-guide-filter-gems" class="btn btn-mini on" title="Mostrar ou ocultar anúncios em Gemas" aria-pressed="true"/);
  assert.match(cockpit, /FETCH_POKEMON_PRICE_GUIDE_INVENTORY/);
  assert.match(cockpit, /FETCH_POKEMON_PRICE_GUIDE_OFFERS/);
  assert.match(html, /id="price-guide-ficha-backdrop"/);
  assert.match(html, /price-guide-ficha-modal/);
  assert.match(cockpit, /function openPriceGuideFicha/);
  assert.match(cockpit, /Ver ficha/);
  assert.match(cockpit, /getPositionIndexByCurrency/);
  for (const id of ['price-guide-filter-note', 'price-guide-filter-shiny', 'price-guide-filter-p5']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(cockpit, /guide\.filterAccountPokemons\(identified, priceGuideAccountFilters\)/);
  assert.match(cockpit, /function describePriceGuideAccountFilters/);
  assert.match(cockpit, /\$\{eligible\} de \$\{total\} Pokémon recebidos atendem aos filtros/);
  assert.doesNotMatch(cockpit.slice(cockpit.indexOf('function analyzeSelectedPokemonPrice'), cockpit.indexOf('function switchMarketSubtab')), /filters: \{ \.\.\.priceGuideAccountFilters \}/);
});

test('game bridge returns inventory and unfiltered market offers without entering buy or listing actions', () => {
  assert.match(injected, /POKEMON_PRICE_GUIDE_INVENTORY_UPDATE/);
  assert.match(injected, /POKEMON_PRICE_GUIDE_OFFERS_UPDATE/);
  assert.match(injected, /ivs: priceGuideStatMap\(ficha\.ivs\)/);
  assert.match(injected, /stats: priceGuideStatMap\(ficha\.stats\)/);
  assert.match(injected, /tipos: Array\.isArray\(ficha\.tipos \|\| ficha\.types\)/);
  assert.match(injected, /priceGuideVisualFromRenderedOffer\(pending\.offers, pending\.target\)/);
  assert.match(injected, /\.eco-pk\[data-especie\]/);
  assert.match(injected, /\.eco-pk-arte canvas/);
  assert.match(injected, /\.colb-card\[data-chave\]/);
  assert.match(injected, /\.cm-pk-escolha\[data-chave\]/);
  assert.match(injected, /\.mk-ico canvas/);
  assert.match(injected, /target\.looktype/);
  assert.match(injected, /spriteDataUrls: visual\.spriteDataUrls/);
  assert.match(injected, /currencyIconDataUrls: visual\.currencyIconDataUrls/);
  assert.match(injected, /\.cm-rodape \.cm-preco\.orb img/);
  assert.match(injected, /\.cm-rodape \.cm-preco:not\(\.orb\) img/);
  assert.match(injected, /const variant = isShiny \? 'shiny' : 'normal'/);
  assert.match(injected, /busca: pending\.target\.name/);
  assert.match(injected, /ordem: 'menor_preco'/);
  assert.doesNotMatch(injected.slice(injected.indexOf("event.data.type === 'FETCH_POKEMON_PRICE_GUIDE_OFFERS'"), injected.indexOf("event.data.type === 'CANCEL_MARKET_OFFER'")), /ordem: 'baratos'/);
  assert.match(injected, /marketRowsAdded\+\+/);
  assert.match(injected, /pokemonPriceGuidePending\.offers\.push\(\{[^}]*nota: note,/);
  assert.match(injected, /marketRowsParseErrors\+\+/);
  assert.match(injected, /marketRowsLastErrorIdentifier/);
  assert.match(injected, /error\?\.name === 'ReferenceError'/);
  assert.match(injected, /is not defined\$\/\)/);
  assert.match(injected, /marketRowsMissingSpeciesInfo\+\+/);
  assert.match(injected, /function priceGuideMarketRows/);
  assert.match(injected, /'linhas', 'anuncios', 'itens', 'pokemons', 'ofertas', 'lista', 'results'/);
  assert.match(injected, /RotomPokemonPriceGuideSpeciesMatch\?\.matchSpecies/);
  assert.match(injected, /marketRowsMatchedByName\+\+/);
  assert.match(injected, /marketRowsMatchedById\+\+/);
  assert.match(builder, /priceGuideSpeciesMatch/);
  assert.match(addon, /RotomPokemonPriceGuideSpeciesMatch/);
  assert.match(speciesMatcher, /normalize\('NFD'\)/);
  assert.doesNotMatch(injected.slice(injected.indexOf('function emitFarmStats'), injected.indexOf('function recordShinyFlow')), /priceGuideVisualFromRenderedOffer/);
  assert.match(bridge, /spriteDataUrl:/);
  assert.match(contentScript, /spriteDataUrl:/);
  assert.match(injected, /tipo: 'pokemon',[\s\S]*?moeda,[\s\S]*?ordem: 'menor_preco'/);
  assert.match(bridge, /rotom_price_guide_pokemons/);
  assert.match(bridge, /rotom_price_guide_offers/);
  assert.match(contentScript, /spriteDataUrls: \{/);
  assert.match(bridge, /spriteDataUrls: \{/);
  assert.match(contentScript, /currencyIconDataUrls: \{/);
  assert.match(bridge, /currencyIconDataUrls: \{/);
  assert.match(cockpit, /const variant = pokemon\.shiny \? 'shiny' : 'normal'/);
  assert.match(cockpit, /priceGuideSpriteDataUrls\[variant\]/);
  assert.match(contentScript, /marketRowsReceived: Number\(event\.data\.marketRowsReceived\) \|\| 0/);
  assert.match(bridge, /marketRowsReceived: Number\(data\.marketRowsReceived\) \|\| 0/);
  assert.match(contentScript, /marketRowsMatchedByName: Number\(event\.data\.marketRowsMatchedByName\) \|\| 0/);
  assert.match(bridge, /marketRowsMatchedByName: Number\(data\.marketRowsMatchedByName\) \|\| 0/);
  assert.match(contentScript, /marketRowsAdded: Number\(event\.data\.marketRowsAdded\) \|\| 0/);
  assert.match(bridge, /marketRowsAdded: Number\(data\.marketRowsAdded\) \|\| 0/);
  assert.match(contentScript, /marketRowsLastErrorIdentifier: String\(event\.data\.marketRowsLastErrorIdentifier/);
  assert.match(bridge, /marketRowsLastErrorIdentifier: String\(data\.marketRowsLastErrorIdentifier/);
  assert.match(cockpit, /\$\{Number\(result\.marketRowsAdded\) \|\| 0\} ofertas incluídas/);
  assert.match(cockpit, /nome exato: \$\{Number\(result\.marketRowsMatchedByName\) \|\| 0\}/);
  assert.doesNotMatch(injected.slice(injected.indexOf("event.data.type === 'FETCH_POKEMON_PRICE_GUIDE_OFFERS'"), injected.indexOf("event.data.type === 'CANCEL_MARKET_OFFER'")), /market\.criar|market\.comprar/);
});

test('content script forwards inventory and offer actions to the injected game engine', () => {
  for (const action of ['FETCH_POKEMON_PRICE_GUIDE_INVENTORY', 'FETCH_POKEMON_PRICE_GUIDE_OFFERS']) {
    assert.match(contentScript, new RegExp(`request\\.action === '${action}'`));
    assert.match(contentScript, new RegExp(`type: '${action}'`));
  }
});

test('market query is unfiltered by account-list filters', () => {
  const forwarding = contentScript.slice(contentScript.indexOf("request.action === 'FETCH_POKEMON_PRICE_GUIDE_OFFERS'"), contentScript.indexOf("request.action === 'CANCEL_MARKET_OFFER'"));
  assert.doesNotMatch(forwarding, /filters/);
  assert.doesNotMatch(injected.slice(injected.indexOf("event.data.type === 'FETCH_POKEMON_PRICE_GUIDE_OFFERS'"), injected.indexOf("event.data.type === 'CANCEL_MARKET_OFFER'")), /pending\.filters/);
});

test('price guide allows slower market replies before showing a timeout', () => {
  assert.match(injected, /expiresAt: Date\.now\(\) \+ 12000/);
  assert.match(injected, /\}, 12000\);/);
  assert.match(cockpit, /\}, 15000\);/);
});

test('price guide inventory refresh sends a direct IPC request scoped to the cockpit account', () => {
  assert.match(cockpit, /const accountId = new URLSearchParams\(window\.location\.search\)\.get\('acc'\)/);
  assert.match(cockpit, /window\.rotomIpc\.sendToGame\(accountId, request\)/);
  assert.match(cockpit, /sendToActiveTab\(request\)/);
  assert.match(addon, /event\.data\.type === 'FETCH_POKEMON_PRICE_GUIDE_INVENTORY'/);
  assert.match(cockpit, /requestId: priceGuideInventoryRequestId/);
  assert.match(addon, /POKEMON_PRICE_GUIDE_INVENTORY_DIAGNOSTIC/);
  assert.match(injected, /POKEMON_PRICE_GUIDE_INVENTORY_DIAGNOSTIC/);
  assert.match(bridge, /rotom_price_guide_diagnostic/);
  assert.match(cockpit, /rotom_price_guide_diagnostic/);
});

test('inventory reader supports nested player state and the cockpit times out missing responses', () => {
  assert.match(injected, /function findPokemonList\(state\)/);
  assert.match(injected, /pokemonCollection.*pokemon_collection.*pokemonsColecao/);
  assert.match(injected, /pk\.idEspecie \|\| pk\.species_id/);
  assert.match(injected, /collection|colecao|coleção/);
  assert.match(injected, /idEspecie/);
  assert.match(cockpit, /priceGuideInventoryTimeout/);
  assert.match(cockpit, /describePriceGuideInventoryFailure/);
  assert.match(cockpit, /confirmação do addon na aba do jogo/);
});

test('inventory reader rebuilds game state deltas and marks Collection membership from canonical IDs', () => {
  assert.match(injected, /shared\/estado-delta\.mjs/);
  assert.match(injected, /criarMescladorDeEstado/);
  assert.match(injected, /pokemonTravado/);
  assert.match(injected, /inCollection/);
  assert.match(injected, /inCollection: pk\.slot == null && playerPokemonCollectionIds\.has\(Number\(pk\.id\)\)/);
  assert.match(cockpit, /Equipe.*Coleção.*Depósito/);
});

test('price comparator filters the account list and keeps all locations eligible', () => {
  const eligibility = cockpit.slice(cockpit.indexOf('function eligiblePriceGuidePokemons'), cockpit.indexOf('function formatPricePokemon'));
  assert.match(eligibility, /pokemon\.id !== null && pokemon\.id !== undefined/);
  assert.doesNotMatch(eligibility, /pokemon\.inTeam|pokemon\.inCollection/);
  assert.match(eligibility, /guide\.filterAccountPokemons\(identified, priceGuideAccountFilters\)/);
  assert.match(cockpit, /Nenhum Pokémon recebido desta conta/);
  assert.match(html, /Qualquer critério ativo/);
  assert.match(cockpit, /Equipe.*Coleção.*Depósito/);
});

test('inventory diagnosis confirms command, game state and aggregate collection counts per request', () => {
  assert.match(addon, /stage: 'webview_received'/);
  assert.match(injected, /stage,\s*webSocketOpen: Boolean\(activeWebSocket/);
  assert.match(injected, /gameStateReceived: playerGameStateReceived/);
  assert.match(injected, /collectionCount: inventory\.filter\(pokemon => pokemon\.inCollection\)\.length/);
  assert.match(injected, /teamCount: inventory\.filter\(pokemon => pokemon\.inTeam\)\.length/);
  assert.match(injected, /depotCount: inventory\.filter\(pokemon => !pokemon\.inTeam && !pokemon\.inCollection\)\.length/);
  assert.match(injected, /emitInventoryDiagnostic\('inventory_prepared', diagnostic\)/);
  assert.match(injected, /emitInventoryDiagnostic\('engine_error'/);
  assert.match(injected, /missingIdentifier/);
  assert.match(cockpit, /diagnostic\.missingIdentifier/);
  assert.match(bridge, /rotom_price_guide_diagnostic/);
  assert.match(cockpit, /diagnostic\.requestId !== priceGuideInventoryRequestId/);
  assert.match(cockpit, /describePriceGuideInventoryFailure/);
});

test('inventory mapping assigns the extracted potency to the Portuguese payload field', () => {
  assert.match(injected, /return \{[\s\S]{0,260}potencia:\s*potency,/);
});

test('market icons referenced by the cockpit exist in the packaged addon', () => {
  for (const icon of ['ouro.svg', 'orbe.svg']) {
    assert.ok(fs.existsSync(path.join(addonDir, 'icons', icon)), `${icon} should be included in addon assets`);
  }
  const cockpitSource = fs.readFileSync(path.join(addonDir, 'cockpit.js'), 'utf8');
  assert.doesNotMatch(cockpitSource, /icons\/(?:ouro|orbe)\.png/);
});
