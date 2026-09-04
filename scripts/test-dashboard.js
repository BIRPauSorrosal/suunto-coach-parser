#!/usr/bin/env node

// Proves unitàries bàsiques sense dependències externes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console, window: {}, TextDecoder, TextEncoder, addEventListener() {} };
context.window = context;
context.DashboardConfig = context.window.DashboardConfig = {
  github: { owner: 'test', repo: 'test', branch: 'main' },
  paths: { planning: { repository: 'docs/data/planning.csv' } },
};
vm.createContext(context);

function load(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

load('docs/js/lib/csv.js');
load('docs/js/lib/formatters.js');
load('docs/js/lib/metrics.js');
load('docs/js/uploader/planning-uploader.js');

const csv = context.DashboardCsv;
const parsed = csv.parse('Nom,Comentari\nPau,"ritme, control\nsegona línia"\n');
assert.equal(JSON.stringify(parsed), JSON.stringify([
  { Nom: 'Pau', Comentari: 'ritme, control\nsegona línia' },
]));

const semicolon = csv.parse('Setmana;Fase\n1;Base\n', { separator: 'auto' });
assert.equal(JSON.stringify(semicolon), JSON.stringify([{ Setmana: '1', Fase: 'Base' }]));

const merged = context.mergePlanning(
  [{ Setmana: '1', Data_Inici: '2026-01-01', Fase: 'Base' }],
  [
    { Setmana: '1', Data_Inici: '2026-01-01', Fase: 'Qualitat' },
    { Setmana: '2', Data_Inici: '2026-01-08', Fase: 'Base' },
  ]
);
assert.equal(JSON.stringify(merged.stats), JSON.stringify({ added: 1, replaced: 1, unchanged: 0 }));
assert.equal(merged.rows[0].Fase, 'Qualitat');
assert.equal(merged.rows[1].Setmana, '2');

const today = new Date();
today.setHours(12, 0, 0, 0);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const pmc = context.buildPMCData([{ date: yesterday, carrega: 100 }]);
assert.equal(pmc.at(-1).tss, 100);
assert.ok(pmc.at(-1).ctl > 0);
assert.ok(pmc.at(-1).atl > 0);

console.log('Dashboard unit checks OK');
