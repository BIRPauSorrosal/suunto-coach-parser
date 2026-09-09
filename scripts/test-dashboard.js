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

console.log('Dashboard unit checks OK');
