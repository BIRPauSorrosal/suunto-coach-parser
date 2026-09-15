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
load('docs/js/uploader/planning-uploader.js');

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
