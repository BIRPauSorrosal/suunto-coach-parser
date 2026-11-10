#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console };
c.window = c;
vm.createContext(c);
for (const file of ['docs/js/lib/activity-types.js', 'docs/js/views/activities.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file });
}

const activity = { date: new Date(), type: 'aerobic', sport: 'running', variant: 'road',
  distancia: 5, durada: 35, ritme: 7, carrega: 40, feeling: 4, vo2max: 48, fcMitja: 145,
  raw: { __activity: { id: 'run', type: 'aerobic', sport: 'running', variant: 'road',
    distance_km: 5, duration_min: 35, notes: { comment: 'Conservar el detall complet' } } } };
const snapshot = JSON.stringify(activity);
const card = c.activityLogCard(activity);
const metrics = card.match(/<div class="activity-log-metrics">([\s\S]*?)<\/div>\s*<div class="activity-log-card__footer">/)[1];
assert.equal((metrics.match(/<span>/g) || []).length, 3);
assert.match(metrics, /Distància|Durada|Ritme/);
assert.doesNotMatch(metrics, /VO₂max|Feeling|FC|Càrrega/);
assert.match(card, /data-activity-comment="run"/);
assert.equal(JSON.stringify(activity), snapshot);

let toolbar = c.activityLogToolbar([activity]);
assert.ok(toolbar.indexOf('id="activity-log-range"') < toolbar.indexOf('id="activity-log-filter-controls"'));
assert.match(toolbar, /aria-expanded="false"/);
assert.match(toolbar, /id="activity-log-filter-controls" hidden/);
vm.runInContext('activityLogFiltersOpen = true; activityLogState.range = 30; activityLogState.sport = "running"', c);
toolbar = c.activityLogToolbar([activity]);
assert.match(toolbar, /aria-expanded="true"/);
assert.doesNotMatch(toolbar, /id="activity-log-filter-controls" hidden/);
assert.match(toolbar, /Filtres · 1/);
assert.match(toolbar, /2 filtres actius/);
assert.match(toolbar, /value="30" selected/);
assert.match(toolbar, /value="running" selected/);
const filtered = c.activityLogFilter([activity]);
assert.equal(filtered.length, 1);
assert.equal(JSON.stringify(activity), snapshot);
console.log('Compact view checks OK');
