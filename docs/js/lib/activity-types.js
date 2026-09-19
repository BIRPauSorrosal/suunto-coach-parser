// activity-types.js — Taxonomia i compatibilitat de tipus d'activitat.
//
// El valor `type` dels documents ja sincronitzats és un contracte històric.
// No el reescrivim: totes les vistes obtenen aquí una classificació derivada
// compatible amb tipus i etiquetes legacy.

// Aquesta és l'única font de veritat de la taxonomia. La resta de constants
// i helpers d'aquest fitxer es deriven d'aquí per no replicar esports, tipus,
// variants, etiquetes ni comportaments a les vistes.
const ACTIVITY_CATALOG = Object.freeze({
  sports: {
    running:  { label: 'Running', aliases: ['run', 'cursa'], order: 10, color: '#55D6BE' },
    cycling:  { label: 'Cycling', aliases: ['ciclisme', 'bike', 'bici'], order: 20, color: '#39C6E6' },
    strength: { label: 'Strength', aliases: ['forca'], order: 30, color: '#B58CFF' },
    padel:    { label: 'Pàdel', aliases: [], order: 40, color: '#F5B942' },
    tennis:   { label: 'Tennis', aliases: ['tenis'], order: 50, color: '#F5B942' },
    hiking:   { label: 'Senderisme', aliases: [], order: 60, color: '#FF7A59' },
    swimming: { label: 'Natació', aliases: ['natacio', 'swim'], order: 70, color: '#38bdf8' },
    walking:  { label: 'Caminada', aliases: [], order: 80, color: '#A3E635' },
    other:    { label: 'Altres', aliases: ['altres'], order: 90, color: '#94A3B8' },
  },
  variants: {
    road:           { label: 'Carretera', filenameAliases: ['road', 'carretera'], filenamePriority: 60 },
    trail:          { label: 'Trail', filenameAliases: ['trail'], filenamePriority: 50 },
    treadmill:      { label: 'Cinta', filenameAliases: ['treadmill', 'cinta'], filenamePriority: 20 },
    indoor:         { label: 'Interior / estàtica', filenameAliases: ['bici-estatica', 'biciestatica', 'indoor', 'interior', 'estatica'], filenamePriority: 30 },
    outdoor:        { label: 'Exterior', filenameAliases: ['outdoor', 'exterior'], filenamePriority: 40 },
    pool:           { label: 'Piscina', filenameAliases: ['pool', 'piscina'], filenamePriority: 70 },
    'open-water':   { label: 'Aigües obertes', filenameAliases: ['open-water', 'aigues-obertes'], filenamePriority: 10 },
  },
  subtypes: {
    tempo:      { label: 'Tempo' },
    intervals:  { label: 'Intervals' },
    fartlek:    { label: 'Fartlek' },
    S1:         { label: 'S1' },
    S2:         { label: 'S2' },
    S3:         { label: 'S3' },
    S4:         { label: 'S4' },
    S5:         { label: 'S5' },
  },
  groups: {
    aerobic:  { color: 'var(--accent)',       analyticsLabel: 'Sessions aeròbiques', order: 10 },
    quality:  { color: 'var(--orange)',       analyticsLabel: 'Sessions de qualitat', order: 20 },
    long:     { color: 'var(--blue)',         analyticsLabel: 'Sessions de tirada llarga', order: 30 },
    test:     { color: 'var(--color-danger)', analyticsLabel: 'Tests i curses', filter: 'testrace', order: 40 },
    strength: { color: 'var(--purple)',       analyticsLabel: 'Sessions de força', order: 50 },
    bici:     { color: 'var(--cyan)',         analyticsLabel: 'Sessions de cycling', order: 60 },
    other:    { color: 'var(--yellow)',       analyticsLabel: 'Altres activitats', order: 70 },
  },
  categories: {
    aerobic:  { group: 'aerobic',  label: 'Aeròbic',       defaultDay: 3 },
    quality:  { group: 'quality',  label: 'Qualitat',      defaultDay: 1 },
    long:     { group: 'long',     label: 'Tirada llarga', defaultDay: 5 },
    race:     { group: 'test',     label: 'Cursa',         defaultDay: 5 },
    test:     { group: 'test',     label: 'Test',          defaultDay: 5 },
    strength: { group: 'strength', label: 'Força',         defaultDay: 2 },
    plyometrics: { group: 'strength', label: 'Pliometria', defaultDay: 2 },
    complementary: { group: 'strength', label: 'Complementari', defaultDay: 2 },
    general:  { group: 'other',    label: 'General',       defaultDay: 5 },
  },
  kinds: {
    aerobic:    { category: 'aerobic',  sport: 'running',  allowedSports: ['running', 'cycling'], aliases: ['z2', 'aerobica', 'aerobic-run'], variants: ['road', 'trail', 'treadmill', 'indoor', 'outdoor'], filenameAliases: ['z2'], legacy: 'Z2', parser: 'running-base' },
    quality:    { category: 'quality',  sport: 'running',  allowedSports: ['running', 'cycling'], aliases: ['qualitat', 'tempo', 'intervals', 'interval', 'series', 'fartlek'], variants: ['road', 'trail', 'treadmill', 'indoor', 'outdoor'], subtypes: ['tempo', 'intervals', 'fartlek'], filenameAliases: ['tempo', 'intervals', 'interval', 'series', 'fartlek'], filenameSubtypes: { tempo: 'tempo', intervals: 'intervals', interval: 'intervals', series: 'intervals', fartlek: 'fartlek' }, parser: 'quality' },
    'long-run': { category: 'long',     sport: 'running',  aliases: ['long', 'longrun', 'llarga', 'trail', 'marato', 'marathon', 'mitja', 'halfmarathon', 'half-marathon'], variants: ['road', 'trail', 'treadmill'], filenameAliases: ['llarga', 'longrun', 'long-run', 'marat', 'marato', 'marathon', 'trail', 'mitja', 'halfmarathon', 'half-marathon'], parser: 'long-run' },
    race:       { category: 'race',     sport: 'running',  aliases: ['cursa'], variants: ['road', 'trail'], filenameAliases: ['cursa', 'race'], legacy: 'CURSA', parser: 'long-run' },
    test:       { category: 'test',     sport: 'running',  allowedSports: ['running', 'cycling'], aliases: ['test-bici'], variants: ['road', 'trail', 'treadmill', 'indoor', 'outdoor'], filenameAliases: ['test', 'test_bici', 'test-bici', 'bici_estatica_test', 'bici-estatica-test'], parser: 'quality', parserAliases: { test: 'quality', test_bici: 'generic', 'test-bici': 'generic', bici_estatica_test: 'generic', 'bici-estatica-test': 'generic' } },
    strength:   { category: 'strength', sport: 'strength', aliases: ['forca'], variants: [], subtypes: ['S1', 'S2', 'S3', 'S4', 'S5'], filenameAliases: ['força', 'forca'], parser: 'strength' },
    plyometrics: { category: 'plyometrics', group: 'strength', sport: 'strength', aliases: ['pliometria'], variants: [], subtypes: [], filenameAliases: ['pliometria'], legacy: 'PLIOMETRIA', parser: 'strength' },
    complementary: { category: 'complementary', group: 'strength', sport: 'strength', aliases: ['complementari'], variants: [], subtypes: [], filenameAliases: ['complementari'], legacy: 'COMPLEMENTARI', parser: 'strength' },
    cycling:    { category: 'general',  group: 'bici',     sport: 'cycling',  aliases: ['ciclisme', 'bici', 'bici-estatica', 'biciestatica'], variants: ['indoor', 'outdoor', 'road', 'trail'], filenameAliases: ['bici_estatica', 'bici-estatica', 'biciestatica', 'cycling', 'ciclisme', 'bike'], parser: 'generic' },
    padel:      { category: 'general',  sport: 'padel',    aliases: [], variants: [], filenameAliases: ['padel'], legacy: 'PADEL', parser: 'generic' },
    tennis:     { category: 'general',  sport: 'tennis',   aliases: ['tenis'], variants: [], filenameAliases: ['tennis', 'tenis'], legacy: 'TENNIS', parser: 'generic' },
    hiking:     { category: 'general',  sport: 'hiking',   aliases: ['senderisme'], variants: ['trail'], filenameAliases: ['hiking', 'senderisme'], legacy: 'HIKING', parser: 'generic' },
    swimming:   { category: 'general',  sport: 'swimming', aliases: ['natacio', 'swim'], variants: ['pool', 'open-water'], filenameAliases: ['natacio', 'swim', 'swimming'], legacy: 'NATACIÓ', parser: 'generic' },
    walking:    { category: 'general',  sport: 'walking',  aliases: ['caminada'], variants: ['road', 'trail'], filenameAliases: ['caminada', 'walking'], legacy: 'WALKING', parser: 'generic' },
    other:      { category: 'general',  sport: 'other',    aliases: ['altres'], variants: [], filenameAliases: [], legacy: 'ALTRES', parser: 'generic' },
  },
});

const ACTIVITY_TAXONOMY = Object.freeze(Object.fromEntries(Object.entries(ACTIVITY_CATALOG.kinds).map(([type, kind]) => {
  const category = ACTIVITY_CATALOG.categories[kind.category];
  return [type, Object.freeze({
    group: kind.group || category.group, activityType: kind.category, activityLabel: category.label,
    subtype: kind.subtype, sport: kind.sport, label: kind.category === 'general'
      ? ACTIVITY_CATALOG.sports[kind.sport].label : category.label,
    variants: kind.variants,
  })];
})));

const ACTIVITY_TYPE_ALIASES = Object.freeze(Object.fromEntries(Object.entries(ACTIVITY_CATALOG.kinds)
  .flatMap(([type, kind]) => [type, ...(kind.aliases || [])].map(alias => [activitySlug(alias), type]))));
const ACTIVITY_SPORT_ALIASES = Object.freeze(Object.fromEntries(Object.entries(ACTIVITY_CATALOG.sports)
  .flatMap(([sport, definition]) => [sport, ...(definition.aliases || [])].map(alias => [activitySlug(alias), sport]))));
const ACTIVITY_SPORT_LABELS = Object.freeze(Object.fromEntries(Object.entries(ACTIVITY_CATALOG.sports)
  .map(([sport, definition]) => [sport, definition.label])));
const ACTIVITY_TYPE_LABELS = Object.freeze(Object.fromEntries(Object.entries(ACTIVITY_CATALOG.categories)
  .map(([type, definition]) => [type, definition.label])));
const ACTIVITY_SPORT_OPTIONS = Object.freeze(Object.entries(ACTIVITY_CATALOG.sports)
  .sort(([, a], [, b]) => a.order - b.order).map(([sport, definition]) => Object.freeze([sport, definition.label])));
const ACTIVITY_TYPE_OPTIONS = Object.freeze(Object.entries(ACTIVITY_CATALOG.categories)
  .map(([type, definition]) => Object.freeze([type, definition.label])));

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
function activitySportOptions() { return ACTIVITY_SPORT_OPTIONS.map(item => [...item]); }
function activityTypeOptions() { return ACTIVITY_TYPE_OPTIONS.map(item => [...item]); }
function activityDefaultDay(value) {
  const classification = activityClassification(value);
  return ACTIVITY_CATALOG.categories[classification.activityType]?.defaultDay ?? null;
}
function activityAnalyticsFilters() {
  return [{ value: 'all', label: 'Totes les sessions' }, ...Object.entries(ACTIVITY_CATALOG.groups)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([group, definition]) => ({ value: definition.filter || group, label: definition.analyticsLabel }))];
}
function activityMatchesAnalyticsFilter(value, filter) {
  if (filter === 'all') return true;
  return Object.entries(ACTIVITY_CATALOG.groups)
    .some(([group, definition]) => (definition.filter || group) === filter && activityToneKey(value) === group);
}
function activityCanonicalTypeFor(sport, activityType, currentType = null) {
  const sportKey = ACTIVITY_SPORT_ALIASES[activitySlug(sport)] || activitySlug(sport) || 'other';
  const current = ACTIVITY_TAXONOMY[currentType];
  const supportsSport = definition => definition.sport === sportKey || definition.allowedSports?.includes(sportKey);
  if (current && current.activityType === activityType && supportsSport(ACTIVITY_CATALOG.kinds[currentType] || {})) return currentType;
  if (activityType === 'general') return ACTIVITY_TAXONOMY[sportKey] ? sportKey : 'other';
  return Object.entries(ACTIVITY_CATALOG.kinds).find(([, definition]) => definition.category === activityType && supportsSport(definition))?.[0] || 'other';
}
function activityTypeOptionsForSport(sport) {
  const sportKey = ACTIVITY_SPORT_ALIASES[activitySlug(sport)] || activitySlug(sport) || 'other';
  const values = new Set(Object.values(ACTIVITY_CATALOG.kinds)
    .filter(definition => definition.sport === sportKey || definition.allowedSports?.includes(sportKey))
    .map(definition => definition.category));
  return ACTIVITY_TYPE_OPTIONS.filter(([value]) => values.has(value)).map(item => [...item]);
}
function activityPlanningVariant(value) {
  const source = activityCanonical(value);
  const classification = activityClassification(value);
  const definition = ACTIVITY_CATALOG.kinds[classification.type] || ACTIVITY_CATALOG.kinds.other;
  if (source.variant !== undefined && source.variant !== null && source.variant !== '') {
    return definition.subtypes?.includes(source.variant) ? null : source.variant;
  }
  return null;
}
function activityPlanningSubtype(value) {
  const source = activityCanonical(value);
  const classification = activityClassification(value);
  const definition = ACTIVITY_CATALOG.kinds[classification.type] || ACTIVITY_CATALOG.kinds.other;
  const candidate = source.subtype || (classification.type === 'strength' ? (source.session_type || source.variant) : null);
  return definition.subtypes?.includes(candidate) ? candidate : null;
}
function activitySubtypeLabel(value) {
  const subtype = activityPlanningSubtype(value);
  return ACTIVITY_CATALOG.subtypes[subtype]?.label || (subtype ? String(subtype) : '');
}
function activitySubtypeOptions(type, selected = null) {
  const canonicalType = activityClassification({ type }).type;
  const values = [...(ACTIVITY_CATALOG.kinds[canonicalType]?.subtypes || [])];
  if (selected && !values.includes(selected)) values.push(selected);
  return [{ value: '', label: 'Sense especificar' }, ...values.map(value => ({ value, label: ACTIVITY_CATALOG.subtypes[value]?.label || value }))];
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
    subtype: activityPlanningSubtype(source),
  };
}
function activityIsRunning(value) { return activityClassification(value).sport === 'running'; }
function activityIsStrength(value) { return activityClassification(value).group === 'strength'; }
function activityIsBici(value) { return activityClassification(value).sport === 'cycling'; }

const ACTIVITY_VARIANT_LABELS = Object.freeze(Object.fromEntries(Object.entries(ACTIVITY_CATALOG.variants)
  .map(([variant, definition]) => [variant, definition.label])));

function activityVariantLabel(value) {
  return ACTIVITY_VARIANT_LABELS[value] || (value ? String(value) : '');
}

function activityDisplayLabel(value, includeVariant = false) {
  const label = activityPlanningLabel(value);
  if (!includeVariant) return label;
  const subtype = activitySubtypeLabel(value);
  const variant = activityPlanningVariant(value);
  return [label, subtype, variant ? activityVariantLabel(variant) : ''].filter(Boolean).join(' · ');
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
  const match = Object.entries(ACTIVITY_CATALOG.variants)
    .sort(([, a], [, b]) => (a.filenamePriority || Infinity) - (b.filenamePriority || Infinity))
    .find(([, definition]) => definition.filenameAliases.some(alias => name.includes(activitySlug(alias))));
  return match && classification.variants.includes(match[0]) ? match[0] : null;
}

function activityLegacyLabel(value) {
  const source = activityCanonical(value);
  const classification = activityClassification(value);
  const kind = ACTIVITY_CATALOG.kinds[classification.type] || ACTIVITY_CATALOG.kinds.other;
  if (classification.type === 'quality') {
    const subtype = activitySlug(activityPlanningSubtype(source) || '');
    return subtype === 'tempo' ? 'TEMPO' : subtype === 'qualitat' ? 'QUALITAT' : 'INTERVALS';
  }
  if (classification.type === 'long-run') {
    const variant = activityPlanningVariant(source);
    return variant === 'trail' ? 'TRAIL' : 'LLARGA';
  }
  if (classification.type === 'strength') return `FORÇA${activityPlanningSubtype(source) ? ` ${activityPlanningSubtype(source)}` : ''}`;
  if (classification.type === 'cycling') return activityPlanningVariant(source) === 'indoor' ? 'BICI ESTÀTICA' : 'BICI';
  if (classification.type === 'test') return classification.sport === 'cycling' ? 'TEST_BICI' : 'TEST';
  return kind.legacy || 'ALTRES';
}

function activityClassificationFromLegacy(value) {
  const raw = String(value || '').trim();
  const classification = activityClassification({ tipus: raw });
  const subtype = classification.type === 'strength'
    ? raw.replace(/^FOR(?:Ç|C)A\s*/i, '') || null
    : classification.type === 'quality'
      ? (ACTIVITY_CATALOG.kinds.quality.filenameSubtypes?.[activitySlug(raw)] || null)
      : null;
  const sport = activitySlug(raw) === 'test-bici' ? 'cycling' : classification.sport;
  return { type: classification.type, sport, subtype };
}

function activityFilenameDefinition(filename) {
  const name = activitySlug(String(filename || '').replace(/\.json$/i, ''));
  const matches = Object.entries(ACTIVITY_CATALOG.kinds)
    .flatMap(([type, kind]) => (kind.filenameAliases || []).map(alias => ({
      type, kind, alias: activitySlug(alias), parser: kind.parserAliases?.[alias] || kind.parser,
    })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const match = matches.find(candidate => name.includes(candidate.alias));
  if (!match) return null;
  const sport = match.type === 'test' && /(?:test-bici|test_bici|bici-estatica-test|bici_estatica_test)/.test(name)
    ? 'cycling' : match.kind.sport;
  return { type: match.type, sport, parser: match.parser, alias: match.alias, subtype: match.kind.filenameSubtypes?.[match.alias] || null };
}

const ACTIVITY_TONE_COLORS = Object.freeze(Object.fromEntries(Object.entries(ACTIVITY_CATALOG.groups)
  .map(([group, definition]) => [group, definition.color])));

function activityToneKey(value) { return activityClassification(value).group; }
function activityToneColor(value) { return ACTIVITY_TONE_COLORS[activityToneKey(value)] || ACTIVITY_TONE_COLORS.other; }
