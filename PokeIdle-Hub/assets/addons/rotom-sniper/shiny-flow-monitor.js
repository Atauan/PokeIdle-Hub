(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RotomShinyFlowMonitor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SHINY_FIELDS = ['sh', 'Sh', 'shiny', 'isShiny', 'lookShiny', 'LookShiny'];
  const SUCCESS_FIELDS = ['sucesso', 'success'];
  const STAGES = new Set(['wild_visible', 'defeat', 'ball_attempt', 'capture_event', 'capture_success', 'seen_counter']);

  function readBooleanSignal(source, fields) {
    const present = fields.filter((field) => Object.prototype.hasOwnProperty.call(source, field));
    if (present.length === 0) return { value: 'unreported', fields: [] };

    const values = present.map((field) => source[field]).filter((value) => value !== null && value !== undefined && value !== '');
    if (values.length === 0) return { value: 'unreported', fields: present };
    if (values.some((value) => value === true || value === 1 || value === '1' || value === 'true')) {
      return { value: 'true', fields: present };
    }
    if (values.every((value) => value === false || value === 0 || value === '0' || value === 'false')) {
      return { value: 'false', fields: present };
    }
    return { value: 'unrecognized', fields: present };
  }

  function readSignalDetails(source, prefix, fields) {
    return fields.filter((field) => Object.prototype.hasOwnProperty.call(source, field)).map((field) => {
      const value = source[field];
      const detail = { field: `${prefix}${field}`, type: value === null ? 'null' : typeof value };
      if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
        detail.value = value;
      } else if (typeof value === 'string') {
        detail.value = value.slice(0, 32);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        detail.keys = Object.keys(value).slice(0, 20).map((key) => String(key).slice(0, 48));
      }
      return detail;
    });
  }

  function createEvent(stage, source, timestamp = Date.now(), seenCount = null) {
    if (!STAGES.has(stage)) throw new TypeError('Unknown shiny flow stage');
    const safeSeenCount = seenCount === null || seenCount === undefined ? null : Number(seenCount);
    if (safeSeenCount !== null && (!Number.isInteger(safeSeenCount) || safeSeenCount < 0)) {
      throw new TypeError('Invalid seen counter snapshot');
    }
    const event = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    const pokemon = event.pokemon && typeof event.pokemon === 'object' ? event.pokemon : {};
    const species = String(event.n || event.nome || pokemon.nome || '').trim().slice(0, 48);
    const slotValue = Number(event.s !== undefined ? event.s : event.slot);
    const slot = Number.isInteger(slotValue) && slotValue >= 0 && slotValue <= 500 ? slotValue : null;
    const levelValue = Number(event.nv !== undefined ? event.nv : event.level);
    const level = Number.isInteger(levelValue) && levelValue >= 0 ? levelValue : null;
    let shiny = readBooleanSignal(event, SHINY_FIELDS);
    if (shiny.value === 'unreported' && pokemon && typeof pokemon === 'object') {
      const nestedShiny = readBooleanSignal(pokemon, SHINY_FIELDS);
      shiny = { ...nestedShiny, fields: nestedShiny.fields.map((field) => `pokemon.${field}`) };
    }
    const success = stage === 'ball_attempt' ? readBooleanSignal(event, SUCCESS_FIELDS) : null;
    const shinyValues = [
      ...readSignalDetails(event, '', SHINY_FIELDS),
      ...readSignalDetails(pokemon, 'pokemon.', SHINY_FIELDS),
    ];

    return {
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
      stage,
      seenCount: safeSeenCount,
      eventKey: String(event.k || event.t || '').slice(0, 32),
      sourceFields: Object.keys(event).slice(0, 80).map((field) => String(field).slice(0, 48)),
      pokemonFields: Object.keys(pokemon).slice(0, 40).map((field) => String(field).slice(0, 48)),
      species,
      slot,
      level,
      shinySignal: shiny.value,
      shinyFields: shiny.fields,
      shinyValues,
      captureResult: success ? success.value : (stage === 'capture_success' ? 'success' : 'unreported'),
    };
  }

  function createSeenCounterEvent(source, count, triggerStage, timestamp = Date.now()) {
    const safeCount = Number(count);
    if (!Number.isInteger(safeCount) || safeCount < 0) throw new TypeError('Invalid seen counter');
    if (!STAGES.has(triggerStage) || triggerStage === 'seen_counter') throw new TypeError('Invalid seen counter trigger');
    return {
      ...createEvent('seen_counter', source, timestamp),
      seenCount: safeCount,
      triggerStage,
    };
  }

  function appendEvent(events, event, limit = 100) {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 100)));
    const next = [...(Array.isArray(events) ? events : []), event];
    while (next.length > safeLimit) {
      const removableIndex = next.findIndex((entry) => !entry || entry.shinySignal !== 'true');
      next.splice(removableIndex >= 0 ? removableIndex : 0, 1);
    }
    return next;
  }

  function shouldRecordObservation(previous, signal, timestamp, ttlMs = 30000) {
    if (!previous || previous.signal !== signal) return true;
    return !Number.isFinite(previous.timestamp) || timestamp - previous.timestamp >= ttlMs;
  }

  function shouldRecordEventSample(events, event) {
    if (!event || event.shinySignal === 'true') return true;
    const signature = [event.stage, event.eventKey, (event.shinyFields || []).join(','), event.shinySignal, event.captureResult].join('|');
    return !(Array.isArray(events) ? events : []).some((saved) => {
      if (!saved) return false;
      const savedSignature = [saved.stage, saved.eventKey, (saved.shinyFields || []).join(','), saved.shinySignal, saved.captureResult].join('|');
      return savedSignature === signature;
    });
  }

  return Object.freeze({ createEvent, createSeenCounterEvent, appendEvent, shouldRecordObservation, shouldRecordEventSample });
});
