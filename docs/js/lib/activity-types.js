// activity-types.js — Taxonomia i compatibilitat de tipus d'activitat.
//
// El valor `type` dels documents ja sincronitzats és un contracte històric.
// No el reescrivim: totes les vistes obtenen aquí una classificació derivada
// compatible amb tipus i etiquetes legacy.

const ACTIVITY_QUALITY_TYPES = Object.freeze({
  tempo: 'TEMPO', test: 'TEST', intervals: 'INTERVALS', interval: 'INTERVALS',
  series: 'INTERVALS', fartlek: 'INTERVALS',
});

const ACTIVITY_LONG_RUN_TYPES = Object.freeze({
  llarga: 'LLARGA', longrun: 'LLARGA', 'long-run': 'LLARGA', marato: 'MARATÓ',
  marat: 'MARATÓ', marathon: 'MARATÓ', trail: 'TRAIL', mitja: 'MITJA',
  halfmarathon: 'MITJA', 'half-marathon': 'MITJA', cursa: 'CURSA', race: 'CURSA',
});

const ACTIVITY_GENERIC_TYPES = Object.freeze({
  bici_estatica_test: 'TEST_BICI', 'bici-estatica-test': 'TEST_BICI', test_bici: 'TEST_BICI', 'test-bici': 'TEST_BICI',
  bici_estatica: 'BICI ESTÀTICA', 'bici-estatica': 'BICI ESTÀTICA', biciestatica: 'BICI ESTÀTICA',
  cycling: 'BICI', ciclisme: 'BICI', bike: 'BICI', padel: 'PADEL', tennis: 'TENNIS', tenis: 'TENNIS',
  hiking: 'HIKING', senderisme: 'HIKING', natacio: 'NATACIÓ', swimming: 'NATACIÓ',
  swim: 'NATACIÓ', caminada: 'WALKING', walking: 'WALKING',
});

const ACTIVITY_TAXONOMY = Object.freeze({
  z2:         { group: 'z2',       activityType: 'aerobic',  activityLabel: 'Aeròbic',       subtype: 'z2', sport: 'running',  label: 'Aeròbic',         variants: ['road', 'trail', 'treadmill'] },
  quality:    { group: 'quality',  activityType: 'quality',  activityLabel: 'Qualitat',      sport: 'running',  label: 'Qualitat',      variants: ['road', 'trail', 'treadmill'] },
  'long-run': { group: 'long',     activityType: 'long',     activityLabel: 'Tirada llarga', sport: 'running',  label: 'Tirada llarga', variants: ['road', 'trail', 'treadmill'] },
  race:       { group: 'test',     activityType: 'race',     activityLabel: 'Cursa',         sport: 'running',  label: 'Cursa',          variants: ['road', 'trail'] },
  test:       { group: 'test',     activityType: 'test',     activityLabel: 'Test',          sport: 'running',  label: 'Test',           variants: ['road', 'trail', 'treadmill', 'indoor', 'outdoor'] },
  strength:   { group: 'strength', activityType: 'strength', activityLabel: 'Força',         sport: 'strength', label: 'Força',          variants: ['S1', 'S2', 'S3', 'S4', 'S5', 'Pliometria', 'Complementari'] },
  cycling:    { group: 'bici',     activityType: 'general',  activityLabel: 'General',       sport: 'cycling',  label: 'Cycling',         variants: ['indoor', 'outdoor', 'road', 'trail'] },
  padel:      { group: 'other',    activityType: 'general',  activityLabel: 'General',       sport: 'padel',    label: 'Pàdel',          variants: [] },
  tennis:     { group: 'other',    activityType: 'general',  activityLabel: 'General',       sport: 'tennis',   label: 'Tennis',         variants: [] },
  hiking:     { group: 'other',    activityType: 'general',  activityLabel: 'General',       sport: 'hiking',   label: 'Senderisme',     variants: ['trail'] },
  swimming:   { group: 'other',    activityType: 'general',  activityLabel: 'General',       sport: 'swimming', label: 'Natació',        variants: ['pool', 'open-water'] },
  walking:    { group: 'other',    activityType: 'general',  activityLabel: 'General',       sport: 'walking',  label: 'Caminada',       variants: ['road', 'trail'] },
  other:      { group: 'other',    activityType: 'general',  activityLabel: 'General',       sport: 'other',    label: 'Altres',         variants: [] },
});

const ACTIVITY_TYPE_ALIASES = Object.freeze({
  z2: 'z2', aerobic: 'z2', aerobica: 'z2', 'aerobic-run': 'z2',
  quality: 'quality', qualitat: 'quality', tempo: 'quality', intervals: 'quality', interval: 'quality', series: 'quality', fartlek: 'quality',
  long: 'long-run', 'long-run': 'long-run', longrun: 'long-run', llarga: 'long-run', trail: 'long-run', marato: 'long-run', marathon: 'long-run', mitja: 'long-run', halfmarathon: 'long-run', 'half-marathon': 'long-run',
  race: 'race', cursa: 'race', test: 'test', 'test-bici': 'test',
  strength: 'strength', forca: 'strength',
  cycling: 'cycling', ciclisme: 'cycling', bici: 'cycling', 'bici-estatica': 'cycling', biciestatica: 'cycling',
  padel: 'padel', tennis: 'tennis', tenis: 'tennis', hiking: 'hiking', senderisme: 'hiking',
  swimming: 'swimming', natacio: 'swimming', swim: 'swimming', walking: 'walking', caminada: 'walking',
  other: 'other', altres: 'other',
});

const ACTIVITY_SPORT_ALIASES = Object.freeze({
  running: 'running', run: 'running', cursa: 'running', cycling: 'cycling', ciclisme: 'cycling', bike: 'cycling', bici: 'cycling',
  strength: 'strength', forca: 'strength', padel: 'padel', tennis: 'tennis', tenis: 'tennis',
  hiking: 'hiking', senderisme: 'hiking', swimming: 'swimming', natacio: 'swimming', swim: 'swimming',
  walking: 'walking', caminada: 'walking',
});

const ACTIVITY_SPORT_LABELS = Object.freeze({
  running: 'Running', cycling: 'Cycling', strength: 'Strength', padel: 'Pàdel', tennis: 'Tennis',
  hiking: 'Senderisme', swimming: 'Natació', walking: 'Caminada', other: 'Altres',
});

const ACTIVITY_TYPE_LABELS = Object.freeze({
  aerobic: 'Aeròbic', quality: 'Qualitat', long: 'Tirada llarga', race: 'Cursa',
  test: 'Test', strength: 'Força', general: 'General',
});

const ACTIVITY_SPORT_OPTIONS = Object.freeze([
  ['running', 'Running'], ['cycling', 'Cycling'], ['strength', 'Strength'], ['padel', 'Pàdel'],
  ['tennis', 'Tennis'], ['hiking', 'Senderisme'], ['swimming', 'Natació'], ['walking', 'Caminada'],
  ['other', 'Altres'],
]);

const ACTIVITY_TYPE_OPTIONS = Object.freeze([
  ['aerobic', 'Aeròbic'], ['quality', 'Qualitat'], ['long', 'Tirada llarga'], ['race', 'Cursa'],
  ['test', 'Test'], ['strength', 'Força'], ['general', 'General'],
]);

function activitySlug(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function activityCanonical(value) { return value?.raw?.__activity || value?.__activity || value || {}; }
function activityTypeFromLegacyLabel(value) {
  const label = activitySlug(value);
  if (label.startsWith('forca')) return 'strength';
  return ACTIVITY_TYPE_ALIASES[label] || 'other';
}

function activityClassification(value) {
  const canonical = activityCanonical(value);
  const legacyLabel = typeof value === 'string' ? value : value?.tipusKey || value?.tipus || '';
  const rawType = activitySlug(canonical.type || '');
  const type = ACTIVITY_TYPE_ALIASES[rawType] || activityTypeFromLegacyLabel(legacyLabel);
  const definition = ACTIVITY_TAXONOMY[type] || ACTIVITY_TAXONOMY.other;
  const rawSport = activitySlug(canonical.sport || '');
  const legacySlug = activitySlug(legacyLabel);
  const inferredSport = legacySlug === 'test-bici' ? 'cycling' : definition.sport;
  const sport = ACTIVITY_SPORT_ALIASES[rawSport] || inferredSport;
  const subtype = canonical.subtype || definition.subtype || null;
  const activityType = definition.activityType || 'general';
  return Object.freeze({
    type, sport, group: definition.group, label: definition.label,
    activityType, activityLabel: definition.activityLabel || ACTIVITY_TYPE_LABELS[activityType],
    subtype, variants: definition.variants,
  });
}

function activityTypeLabel(value) { return activityClassification(value).activityLabel; }
function activityPlanningLabel(value) {
  const classification = activityClassification(value);
  return classification.activityType === 'general'
    ? activitySportLabel(value)
    : classification.activityLabel;
}
function activitySportLabel(value) {
  const classification = typeof value === 'string' ? { sport: value } : activityClassification(value);
  return ACTIVITY_SPORT_LABELS[classification.sport] || classification.sport || 'Altres';
}
function activitySubtypeLabel(value) {
  const classification = activityClassification(value);
  return classification.subtype ? String(classification.subtype).replaceAll('-', ' ') : '';
}
function activitySportOptions() { return ACTIVITY_SPORT_OPTIONS.map(item => [...item]); }
function activityTypeOptions() { return ACTIVITY_TYPE_OPTIONS.map(item => [...item]); }
function activityCanonicalTypeFor(sport, activityType, currentType = null) {
  const sportKey = ACTIVITY_SPORT_ALIASES[activitySlug(sport)] || activitySlug(sport) || 'other';
  const current = ACTIVITY_TAXONOMY[currentType];
  if (current && current.activityType === activityType && (current.sport === sportKey || (activityType === 'test' && sportKey === 'cycling'))) return currentType;
  if (activityType === 'test' && sportKey === 'cycling') return 'test';
  if (activityType === 'general') return ACTIVITY_TAXONOMY[sportKey] ? sportKey : 'other';
  return Object.entries(ACTIVITY_TAXONOMY).find(([, definition]) => definition.sport === sportKey && definition.activityType === activityType)?.[0] || 'other';
}
function activityTypeOptionsForSport(sport) {
  const sportKey = ACTIVITY_SPORT_ALIASES[activitySlug(sport)] || activitySlug(sport) || 'other';
  const values = new Set(Object.values(ACTIVITY_TAXONOMY)
    .filter(definition => definition.sport === sportKey)
    .map(definition => definition.activityType));
  if (sportKey === 'cycling') values.add('test');
  return ACTIVITY_TYPE_OPTIONS.filter(([value]) => values.has(value)).map(item => [...item]);
}
function activityPlanningVariant(value) {
  const source = activityCanonical(value);
  if (source.variant !== undefined && source.variant !== null && source.variant !== '') return source.variant;
  const classification = activityClassification(value);
  const candidate = source.session_type;
  return classification.type === 'strength' && ACTIVITY_TAXONOMY.strength.variants.includes(candidate) ? candidate : null;
}
function normalizeActivityPlanningSession(value) {
  const source = activityCanonical(value);
  const base = activityClassification(source);
  const sport = ACTIVITY_SPORT_ALIASES[activitySlug(source.sport || '')] || base.sport || 'other';
  const requestedType = activitySlug(source.activityType || '');
  const activityType = ACTIVITY_TYPE_LABELS[requestedType] ? requestedType : base.activityType;
  const type = activityCanonicalTypeFor(sport, activityType, base.type);
  return {
    ...source,
    type,
    sport,
    variant: source.variant ?? null,
  };
}
function activityIsRunning(value) { return activityClassification(value).sport === 'running'; }
function activityIsStrength(value) { return activityClassification(value).group === 'strength'; }
function activityIsBici(value) { return activityClassification(value).sport === 'cycling'; }

const ACTIVITY_VARIANT_LABELS = Object.freeze({
  road: 'Carretera', trail: 'Trail', treadmill: 'Cinta', indoor: 'Interior / estàtica',
  outdoor: 'Exterior', pool: 'Piscina', 'open-water': 'Aigües obertes',
  S1: 'S1', S2: 'S2', S3: 'S3', S4: 'S4', S5: 'S5', Pliometria: 'Pliometria', Complementari: 'Complementari',
});

function activityVariantLabel(value) {
  return ACTIVITY_VARIANT_LABELS[value] || (value ? String(value) : '');
}

function activityDisplayLabel(value, includeVariant = false) {
  const label = activityPlanningLabel(value);
  if (!includeVariant) return label;
  const variant = activityPlanningVariant(value);
  return variant ? `${label} · ${activityVariantLabel(variant)}` : label;
}

function activityVariantOptions(type, selected = null) {
  const canonicalType = activityClassification({ type }).type;
  const variants = [...(ACTIVITY_TAXONOMY[canonicalType]?.variants || [])];
  if (selected && !variants.includes(selected)) variants.push(selected);
  return [{ value: '', label: 'Sense especificar' }, ...variants.map(value => ({ value, label: ACTIVITY_VARIANT_LABELS[value] || value }))];
}

function activityVariantFromFilename(filename, value) {
  const name = activitySlug(filename.replace(/\.json$/i, ''));
  const classification = activityClassification(value);
  const candidates = [
    ['open-water', ['open-water', 'aigues-obertes']], ['treadmill', ['treadmill', 'cinta']],
    ['indoor', ['bici-estatica', 'biciestatica', 'indoor', 'interior', 'estatica']],
    ['outdoor', ['outdoor', 'exterior']], ['trail', ['trail']], ['road', ['road', 'carretera']], ['pool', ['pool', 'piscina']],
  ];
  const match = candidates.find(([, aliases]) => aliases.some(alias => name.includes(alias)));
  return match && classification.variants.includes(match[0]) ? match[0] : null;
}

// Compatibilitat temporal amb les vistes legacy que encara consumeixen tipus plans.
const QUALITY_TYPES = new Set(['TEMPO', 'INTERVALS', 'QUALITAT']);
const LONG_TYPES = new Set(['LLARGA', 'MARATÓ', 'MARATO', 'TRAIL', 'MITJA']);
const RUNNING_TYPES = new Set([...QUALITY_TYPES, ...LONG_TYPES, 'Z2', 'TEST', 'CURSA']);
const TEST_RACE_TYPES = new Set(['TEST', 'TEST_BICI', 'CURSA']);
const TEST_BICI_TYPES = new Set(['TEST_BICI']);
const BICI_TYPES = new Set(['BICI', 'BICI ESTÀTICA', 'TEST_BICI']);
const PADEL_TYPES = new Set(['PADEL', 'TENIS', 'TENNIS']);
const STRENGTH_RE = /^FOR[ÇC]A/i;

const ACTIVITY_TONE_COLORS = Object.freeze({
  test: 'var(--color-danger)', quality: 'var(--orange)', z2: 'var(--accent)',
  long: 'var(--blue)', strength: 'var(--purple)', bici: 'var(--cyan)', other: 'var(--yellow)',
});

function activityToneKey(value) { return activityClassification(value).group; }
function activityToneColor(value) { return ACTIVITY_TONE_COLORS[activityToneKey(value)] || ACTIVITY_TONE_COLORS.other; }
