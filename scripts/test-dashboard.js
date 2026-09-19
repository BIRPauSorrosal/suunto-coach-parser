#!/usr/bin/env node

// Proves unitàries bàsiques sense dependències externes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console, window: {}, TextDecoder, TextEncoder, addEventListener() {} };
context.window = context;
vm.createContext(context);

function load(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

load('docs/js/lib/csv.js');
load('docs/js/lib/formatters.js');
load('docs/js/lib/dashboard-store.js');
load('docs/js/lib/metrics.js');
load('docs/js/lib/activity-types.js');
load('docs/js/lib/data-service.js');
load('docs/js/uploader/parser.js');
load('docs/js/uploader/uploader.js');
load('docs/js/uploader/planning-uploader.js');
load('docs/js/lib/calendar-sync.js');
load('docs/js/views/planning-export.js');

const csv = context.DashboardCsv;
assert.equal(context.dateKey(new Date(2026, 8, 4, 23)), '2026-09-04');
const parsed = csv.parse('Nom,Comentari\nPau,"ritme, control\nsegona línia"\n');
assert.equal(JSON.stringify(parsed), JSON.stringify([
  { Nom: 'Pau', Comentari: 'ritme, control\nsegona línia' },
]));

const semicolon = csv.parse('Setmana;Fase\n1;Base\n', { separator: 'auto' });
assert.equal(JSON.stringify(semicolon), JSON.stringify([{ Setmana: '1', Fase: 'Base' }]));

const merged = context.mergePlanningDocuments(
  {
    schema_version: 1,
    season: 2026,
    cycles: [{
      id: 'base',
      name: 'Base',
      weeks: [{ id: 'week-1', code: '2026-S01', start: '2026-01-01', end: '2026-01-07', sessions: [] }],
    }],
  },
  {
    schema_version: 1,
    season: 2026,
    cycles: [{
      id: 'base',
      name: 'Base',
      weeks: [
        { id: 'week-1', code: '2026-S01', start: '2026-01-01', end: '2026-01-07', sessions: [{ id: 'session-1', type: 'quality' }] },
        { id: 'week-2', code: '2026-S02', start: '2026-01-08', end: '2026-01-14', sessions: [] },
      ],
    }],
  }
);
assert.equal(JSON.stringify(merged.stats), JSON.stringify({ added: 1, replaced: 1, unchanged: 0 }));
assert.equal(merged.document.cycles[0].weeks[0].sessions[0].type, 'quality');
assert.equal(merged.document.cycles[0].weeks[1].code, '2026-S02');

const normalizedPlanning = context.DashboardDataService.normalizePlanningDocument({
  schema_version: 1,
  cycles: [{
    id: 'base', name: 'Base', weeks: [{
      id: '2026-01-01', code: '2026-S01', start: '2026-01-01', end: '2026-01-07', phase: 'Base',
      sessions: [{ id: '2026-S01-aerobic-01', type: 'aerobic', sport: 'run', variant: null }],
    }],
  }],
});
assert.deepEqual(
  [normalizedPlanning.cycles[0].weeks[0].sessions[0].type, normalizedPlanning.cycles[0].weeks[0].sessions[0].sport],
  ['aerobic', 'running'],
);

const normalizedCycleNames = context.DashboardDataService.normalizePlanningDocument({
  schema_version: 1,
  cycles: [
    {
      id: '2026-construccio-01', name: 'CONSTRUCCIO', weeks: [{
        id: 'week-1', code: '2026-S01', start: '2026-01-01', end: '2026-01-07', phase: 'DESCARREGA', sessions: [],
      }],
    },
    {
      id: '2026-base-02', name: 'BASE', weeks: [{
        id: 'week-2', code: '2026-S02', start: '2026-01-08', end: '2026-01-14', phase: 'RECUPERACIO', sessions: [],
      }],
    },
  ],
});
assert.equal(normalizedCycleNames.cycles[0].name, 'Construcci\u00f3');
assert.equal(normalizedCycleNames.cycles[0].__cycleKey, 'construccio');
assert.equal(normalizedCycleNames.cycles[0].weeks[0].phase, 'Desc\u00e0rrega');
assert.equal(normalizedCycleNames.cycles[0].weeks[0].__phaseKey, 'descarrega');
assert.equal(normalizedCycleNames.cycles[1].name, 'Base');
assert.equal(normalizedCycleNames.cycles[1].weeks[0].phase, 'Recuperaci\u00f3');

const productionPlanning = JSON.parse(fs.readFileSync(path.join(root, 'docs/data/planning.json'), 'utf8'));
const productionPhases = [...new Set(
  context.DashboardDataService
    .normalizePlanningDocument(productionPlanning)
    .cycles.flatMap(cycle => cycle.weeks.map(week => week.phase))
)].sort();
assert.deepEqual(productionPhases, [
  'Acumulaci\u00f3',
  'Competici\u00f3',
  'Consolidaci\u00f3',
  'Desc\u00e0rrega',
  'Extensi\u00f3',
  'Recuperaci\u00f3',
].sort());

assert.equal(context.activityPlanningVariant({ type: 'strength', sport: 'strength', variant: null, session_type: 'S2' }), null);
assert.equal(context.activityPlanningSubtype({ type: 'strength', sport: 'strength', variant: null, session_type: 'S2' }), 'S2');

const today = new Date();
today.setHours(12, 0, 0, 0);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const pmc = context.buildPMCData([{ date: yesterday, carrega: 100 }]);
const loadedPmcDay = pmc.find(day => day.tss === 100);
assert.ok(loadedPmcDay);
assert.ok(loadedPmcDay.ctl > 0);
assert.ok(loadedPmcDay.atl > 0);

let storeReason = null;
context.dashboardStore.subscribe((_, reason) => { storeReason = reason; });
context.dashboardStore.setSessions([{ id: 1 }]);
assert.equal(storeReason, 'sessions-updated');
assert.equal(context.dashboardStore.getState().sessions.length, 1);

// Taxonomia: conserva la compatibilitat amb les etiquetes legacy i no depèn
// d'una resincronització de les activitats que ja són a Supabase.
const classifications = JSON.parse(vm.runInContext(`JSON.stringify([
  activityClassification({ tipusKey: 'MARATÓ' }),
  activityClassification({ raw: { __activity: { type: 'cycling', sport: 'cycling' } }, tipusKey: 'BICI' }),
  activityClassification({ tipusKey: 'TENNIS' })
])`, context));
assert.deepEqual(classifications.map(item => [item.type, item.sport, item.activityType, item.group]), [
  ['long-run', 'running', 'long', 'long'],
  ['cycling', 'cycling', 'general', 'bici'],
  ['tennis', 'tennis', 'general', 'other'],
]);
const legacyZ2 = JSON.parse(vm.runInContext(`JSON.stringify(activityClassification({ tipusKey: 'Z2' }))`, context));
assert.deepEqual([legacyZ2.type, legacyZ2.sport, legacyZ2.activityType, legacyZ2.subtype], ['aerobic', 'running', 'aerobic', null]);
const bikeTest = JSON.parse(vm.runInContext(`JSON.stringify(activityClassification({ tipusKey: 'TEST_BICI' }))`, context));
assert.deepEqual([bikeTest.sport, bikeTest.activityType], ['cycling', 'test']);
assert.equal(vm.runInContext(`activityCanonicalTypeFor('running', 'aerobic')`, context), 'aerobic');
assert.equal(vm.runInContext(`activityCanonicalTypeFor('cycling', 'test')`, context), 'test');
assert.equal(vm.runInContext(`activityCanonicalTypeFor('strength', 'plyometrics')`, context), 'plyometrics');
assert.equal(vm.runInContext(`activityPlanningLabel({ type: 'aerobic', sport: 'running' })`, context), 'Aeròbic');
assert.equal(vm.runInContext(`activityPlanningLabel({ type: 'aerobic', sport: 'cycling' })`, context), 'Aeròbic');
assert.equal(vm.runInContext(`activityPlanningLabel({ type: 'cycling', sport: 'cycling' })`, context), 'Cycling');
assert.equal(vm.runInContext(`activityDisplayLabel({ type: 'strength', sport: 'strength', session_type: 'S3' }, true)`, context), 'Força · S3');
assert.equal(vm.runInContext(`activityDisplayLabel({ type: 'quality', sport: 'running', subtype: 'intervals', variant: 'road' }, true)`, context), 'Qualitat · Intervals · Carretera');
assert.equal(vm.runInContext(`activityDisplayLabel({ type: 'plyometrics', sport: 'strength' }, true)`, context), 'Pliometria');
assert.equal(vm.runInContext(`activityDisplayLabel({ type: 'cycling', sport: 'cycling', variant: 'indoor' }, true)`, context), 'Cycling · Interior / estàtica');
assert.deepEqual(
  JSON.parse(vm.runInContext(`JSON.stringify(activityTypeOptionsForSport('running').map(([value]) => value))`, context)),
  ['aerobic', 'quality', 'long', 'race', 'test'],
);
assert.deepEqual(
  JSON.parse(vm.runInContext(`JSON.stringify(activityTypeOptionsForSport('cycling').map(([value]) => value))`, context)),
  ['aerobic', 'quality', 'test', 'general'],
);
assert.deepEqual(
  JSON.parse(vm.runInContext(`JSON.stringify(activityTypeOptionsForSport('strength').map(([value]) => value))`, context)),
  ['strength', 'plyometrics', 'complementary'],
);
assert.equal(vm.runInContext(`activityDefaultDay({ type: 'strength', sport: 'strength' })`, context), 2);
assert.deepEqual(
  JSON.parse(vm.runInContext(`JSON.stringify(activityAnalyticsFilters().map(filter => filter.value))`, context)),
  ['all', 'aerobic', 'quality', 'long', 'testrace', 'strength', 'bici', 'other'],
);
const filenameClassification = JSON.parse(vm.runInContext(`JSON.stringify(activityFilenameDefinition('20260917_test_bici_indoor.json'))`, context));
assert.deepEqual([filenameClassification.type, filenameClassification.sport, filenameClassification.parser], ['test', 'cycling', 'generic']);
const looseBikeFilename = JSON.parse(vm.runInContext(`JSON.stringify(activityFilenameDefinition('260919_bici.json'))`, context));
assert.deepEqual([looseBikeFilename.type, looseBikeFilename.sport, looseBikeFilename.parser, looseBikeFilename.inferred], ['cycling', 'cycling', 'generic', true]);
const unknownFilename = JSON.parse(vm.runInContext(`JSON.stringify(activityFilenameDefinition('exportacio-manual.json'))`, context));
assert.deepEqual([unknownFilename.type, unknownFilename.sport, unknownFilename.parser, unknownFilename.inferred], ['other', 'other', 'generic', true]);
assert.equal(vm.runInContext(`activityValidateClassification({ type: 'cycling', sport: 'cycling', subtype: null, variant: null }).valid`, context), true);
assert.equal(vm.runInContext(`activityValidateClassification({ type: 'cycling', sport: 'running', subtype: null, variant: null }).valid`, context), false);
assert.equal(vm.runInContext(`activityValidateClassification({ type: 'strength', sport: 'strength', subtype: 'S2', variant: 'road' }).valid`, context), false);
assert.equal(vm.runInContext(`activityLegacyLabel({ type: 'cycling', sport: 'cycling', variant: 'indoor' })`, context), 'BICI ESTÀTICA');

const parsedVariants = JSON.parse(vm.runInContext(`JSON.stringify([
  sessionFromParsedRow('20260915_marato-road.json', { Tipus: 'MARATÓ', Data: '15/09/2026' }),
  sessionFromParsedRow('20260916_tennis.json', { Tipus: 'TENNIS', Data: '16/09/2026' }),
  Boolean(detectParser('20260917_bici-estatica-indoor.json')),
  Boolean(detectParser('20260918_half-marathon-trail.json'))
])`, context));
assert.deepEqual(parsedVariants[0].type, 'long-run');
assert.deepEqual(parsedVariants[0].variant, 'road');
assert.deepEqual([parsedVariants[1].type, parsedVariants[1].sport], ['tennis', 'tennis']);
assert.equal(parsedVariants[2], true);
assert.equal(parsedVariants[3], true);

const parsedBici = JSON.parse(vm.runInContext(`JSON.stringify(
  parseSuuntoFile('20260917_bici-estatica-indoor.json', {
    DeviceLog: { Header: { DateTime: '2026-09-17T18:00:00+02:00', Duration: 1800 }, Samples: [] }
  }).__session
)`, context));
assert.deepEqual([parsedBici.type, parsedBici.sport, parsedBici.variant], ['cycling', 'cycling', 'indoor']);

const validImportedSession = JSON.parse(vm.runInContext(`JSON.stringify({
  id: '260919-bici', date: '2026-09-19', type: 'cycling', sport: 'cycling', variant: null,
  subtype: null, duration_min: 60, heart_rate: { average: null, max: null }, zones: {},
  training_effect: {}, recovery: {}, intervals: []
})`, context));
assert.equal(context.DashboardDataService.validateCanonicalSession(validImportedSession).valid, true);
assert.equal(context.DashboardDataService.validateCanonicalSession({ ...validImportedSession, date: '2026-02-30' }).valid, false);
assert.equal(context.DashboardDataService.validateCanonicalSession({ ...validImportedSession, duration_min: 0 }).valid, false);
assert.equal(vm.runInContext(`validateSuuntoJson({ DeviceLog: { Header: { DateTime: '2026-09-19T10:00:00Z', Duration: 60 }, Samples: [] } }).valid`, context), true);
assert.equal(vm.runInContext(`validateSuuntoJson({ DeviceLog: { Header: { DateTime: 'invalid', Duration: 60 }, Samples: [] } }).valid`, context), false);
assert.equal(vm.runInContext(`validateSuuntoJson({ DeviceLog: { Header: { DateTime: '2026-09-19T10:00:00Z', Duration: 0 }, Samples: {} } }).valid`, context), false);

const exportPlanning = {
  schema_version: 1,
  season: 2026,
  cycles: [{ id: 'cycle-1', name: 'Base', weeks: [{
    id: '2026-09-14', code: '2026-S38', start: '2026-09-14', end: '2026-09-20', phase: 'Base',
    sessions: [
      { id: 'plan-a', type: 'aerobic', sport: 'running', variant: null },
      { id: 'plan-b', type: 'quality', sport: 'running', variant: null },
    ],
  }] }],
};
const exportEntries = context.planningExportEntries(exportPlanning, {
  weeks: { '2026-09-14': { items: [
    { id: 'plan-a', source: 'planning', day: 0 },
    { id: 'plan-b', source: 'planning', day: 2 },
  ] } },
});
assert.deepEqual(JSON.parse(JSON.stringify(exportEntries.map(entry => [entry.date, entry.sessions.length]))), [['2026-09-14', 1], ['2026-09-16', 1]]);
const exportRangeEntries = context.planningExportEntriesForRange(exportPlanning, {
  weeks: { '2026-09-14': { items: [
    { id: 'plan-a', source: 'planning', day: 0 },
    { id: 'plan-b', source: 'planning', day: 2 },
  ] } },
}, 7, new Date('2026-09-19T12:00:00'));
assert.deepEqual(JSON.parse(JSON.stringify(exportRangeEntries.map(entry => entry.date))), ['2026-09-14', '2026-09-16']);
const emptyExportRange = context.planningExportEntriesForRange(exportPlanning, {
  weeks: { '2026-09-14': { items: [
    { id: 'plan-a', source: 'planning', day: 0 },
    { id: 'plan-b', source: 'planning', day: 2 },
  ] } },
}, 7, new Date('2026-09-30T12:00:00'));
assert.equal(emptyExportRange.length, 0);
const exportedSubset = context.planningDocumentForSelection(exportPlanning, exportEntries, ['2026-09-16']);
assert.deepEqual(JSON.parse(JSON.stringify(exportedSubset.cycles[0].weeks[0].sessions.map(session => [session.id, session.day]))), [['plan-b', 'wednesday']]);

// El Service Worker no pot interceptar dades de Supabase: una resposta GET
// cachejada d'una setmana o de la seva revisió provocaria conflictes falsos.
const swListeners = {};
const swContext = {
  URL,
  Promise,
  self: {
    location: { hostname: 'coach.example' },
    registration: { scope: 'https://coach.example/' },
    addEventListener(name, listener) { swListeners[name] = listener; },
  },
  caches: {
    match: async () => null,
    open: async () => ({ addAll: async () => {}, put: async () => {} }),
    keys: async () => [],
    delete: async () => true,
  },
  fetch: async () => ({ status: 200, clone() { return this; } }),
};
vm.createContext(swContext);
vm.runInContext(fs.readFileSync(path.join(root, 'docs/sw.js'), 'utf8'), swContext, { filename: 'docs/sw.js' });
let handledDynamicRequest = false;
swListeners.fetch({
  request: { method: 'GET', url: 'https://project.supabase.co/rest/v1/calendar_weeks?select=*' },
  respondWith() { handledDynamicRequest = true; },
});
assert.equal(handledDynamicRequest, false);
let handledStaticRequest = false;
swListeners.fetch({
  request: { method: 'GET', url: 'https://coach.example/js/app.js' },
  respondWith() { handledStaticRequest = true; },
});
assert.equal(handledStaticRequest, true);

// Les escriptures consecutives de la mateixa setmana s'han de serialitzar i
// la segona ha d'usar la revisió confirmada per la primera.
(async () => {
  const calendarStorage = new Map();
  const calendarContext = {
    console,
    Map,
    Promise,
    Date,
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    localStorage: {
      getItem(key) { return calendarStorage.get(key) || null; },
      setItem(key, value) { calendarStorage.set(key, value); },
    },
    dispatchEvent() {},
  };
  calendarContext.window = calendarContext;
  const revisions = [];
  let activeWrites = 0, maximumActiveWrites = 0;
  calendarContext.SupabaseDataProvider = {
    async saveCalendarWeek(_week, value) {
      revisions.push(value.revision);
      activeWrites += 1;
      maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
      await Promise.resolve();
      activeWrites -= 1;
      return { status: 'synced', revision: Number(value.revision) + 1, updated_at: new Date().toISOString() };
    },
  };
  vm.createContext(calendarContext);
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/js/lib/calendar-sync.js'), 'utf8'), calendarContext, { filename: 'docs/js/lib/calendar-sync.js' });
  const week = { key: '2026-09-14' };
  await Promise.all([
    calendarContext.CalendarSync.saveWeek(week, { revision: 4, updated_at: 'first', items: [] }),
    calendarContext.CalendarSync.saveWeek(week, { revision: 4, updated_at: 'second', items: [] }),
  ]);
  assert.deepEqual(revisions, [4, 5]);
  assert.equal(maximumActiveWrites, 1);
  console.log('Dashboard unit checks OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
