#!/usr/bin/env node
// Regressions d'importació amb el proveïdor real i un Supabase en memòria.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const copy = value => JSON.parse(JSON.stringify(value));

function setup() {
  const storage = new Map(), notices = [], calls = [];
  const tables = { planning_weeks: [], planning_sessions: [], calendar_weeks: [] };
  let nextId = 1;
  const faults = {};
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'athlete' } } }) },
    from(table) {
      let operation = 'select', values, filters = [], order;
      const query = {
        select() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        order(key) { order = key; return query; },
        upsert(rows) { operation = 'upsert'; values = rows; return query; },
        insert(row) { operation = 'insert'; values = Array.isArray(row) ? row : [row]; return query; },
        update(row) { operation = 'update'; values = row; return query; },
        delete() { operation = 'delete'; return query; },
        single() { return execute(true); },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      async function execute(single) {
        calls.push({ table, operation });
        if (faults[`${table}:${operation}`]) return { data: null, error: new Error('Simulated database failure') };
        let rows = tables[table].filter(row => filters.every(test => test(row)));
        if (operation === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
        if (operation === 'update') rows.forEach(row => Object.assign(row, copy(values), { updated_at: '2026-11-10T10:00:00Z' }));
        if (operation === 'upsert' || operation === 'insert') {
          rows = values.map(value => {
            let row = operation === 'upsert' && tables[table].find(row => row.user_id === value.user_id && row.external_id === value.external_id);
            if (!row) { row = { id: `row-${nextId++}` }; tables[table].push(row); }
            Object.assign(row, copy(value), { updated_at: '2026-11-10T10:00:00Z' });
            return row;
          });
        }
        if (order) rows.sort((a, b) => String(a[order]).localeCompare(String(b[order]), 'en', { numeric: true }));
        return { data: copy(single ? rows[0] || null : rows), error: null };
      }
      return query;
    },
  };
  const context = {
    console: { ...console, error() {} },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    SupabaseClient: { getClient: () => client },
    showNotice: (message, error) => notices.push({ message, error }),
    refreshDashboardUI() { context.renders = (context.renders || 0) + 1; },
    document: { addEventListener() {} },
  };
  context.window = context;
  vm.createContext(context);
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  [
    'docs/js/lib/activity-types.js', 'docs/js/lib/data-service.js', 'docs/js/lib/dashboard-store.js',
    'docs/js/lib/week-manager.js', 'docs/js/lib/calendar-sync.js', 'docs/js/lib/planning-calendar.js',
    'docs/js/lib/supabase-data-provider.js', 'docs/js/views/planning.js',
    'docs/js/uploader/planning-uploader.js', 'docs/js/uploader/planning-uploader-ui.js',
  ].forEach(load);
  return { c: context, tables, notices, calls, faults, storage };
}

const session = (id, day, km = 5) => ({ id, type: 'aerobic', sport: 'running', variant: 'road', day, distance_km: km });
const week = (id, sessions, summary = {}) => ({ id, code: id === '2026-11-09' ? '2026-S46' : '2026-S45', start: id,
  end: id === '2026-11-09' ? '2026-11-15' : '2026-11-08', phase: 'Recuperació', summary, sessions });
const documentFor = weeks => ({ schema_version: 1, season: 2026,
  cycles: [{ id: 'base', name: 'Base', start: '2026-11-02', end: '2026-11-15', weeks }] });
const current = documentFor([
  week('2026-11-02', [session('history', 'monday')]),
  week('2026-11-09', [session('run', 'monday'), session('obsolete', 'tuesday'), session('completed', 'wednesday')]),
]);
const incoming = documentFor([week('2026-11-09', [session('run', 'thursday', 6), session('new', 'saturday', 7)], { weekly_km_target: 12 })]);

async function seed(env) {
  const { c } = env;
  await c.SupabaseDataProvider.upsertPlanning(current);
  const calendarWeek = { key: '2026-11-09', planning: {} };
  await c.SupabaseDataProvider.saveCalendarWeek(calendarWeek, { items: [
    { id: 'run', planning_session_id: 'run', day: 0, type: 'aerobic', source: 'planning', status: 'pending', title: 'Old title' },
    { id: 'obsolete', day: 1, source: 'planning', status: 'pending' },
    { id: 'completed', day: 2, source: 'planning', status: 'done' },
    { id: 'manual', day: 4, source: 'manual', status: 'pending', title: 'Tennis' },
  ], removedPlanning: [] });
  const planning = await c.SupabaseDataProvider.getPlanning(), calendar = await c.SupabaseDataProvider.getCalendarWeeks();
  c.dashboardStore.setData({ planningDocument: planning.document,
    planning: c.DashboardDataService.normalizePlanningJSON(planning.document), calendar,
    sessions: [], sessionsDocument: { sessions: [] } });
  env.calls.length = 0;
}

async function main() {
  const env = setup(), { c } = env;
  await seed(env);
  const update = c.mergePlanningDocuments(current, incoming);
  assert.deepEqual(copy(update.document.cycles[0].weeks[1].sessions.map(s => s.id)), ['run', 'new', 'obsolete', 'completed']);
  const replacement = c.preparePlanningMerge(incoming, { mode: 'replace-weeks', dayPolicy: 'apply' });
  assert.equal(replacement.sessionStats.deleted, 2);
  assert.deepEqual(copy(replacement.incoming[0].kmWarning), { target: 12, total: 13 });
  const cards = replacement.calendarChanges[0].next.items;
  assert.equal(cards.find(s => s.id === 'run').day, 3);
  assert.equal(cards.find(s => s.id === 'new').day, 5);
  assert.equal(cards.find(s => s.id === 'completed').day, 2);
  assert.equal(cards.find(s => s.id === 'manual').title, 'Tennis');
  assert.equal(cards.some(s => s.id === 'obsolete'), false);
  const preserve = c.preparePlanningMerge(incoming, { mode: 'replace-weeks', dayPolicy: 'preserve' });
  assert.equal(preserve.calendarChanges[0].next.items.find(s => s.id === 'run').day, 0);
  const unassigned = documentFor([week('2026-11-09', [session('run', null)])]);
  assert.equal(c.preparePlanningMerge(unassigned).calendarChanges[0].next.items.find(s => s.id === 'run').day, null);

  const parsed = c.DashboardDataService.parsePlanningJSON(JSON.stringify(incoming));
  assert.equal(parsed.cycles[0].weeks[0].sessions[0].day, 3);
  assert.throws(() => c.DashboardDataService.parsePlanningJSON(JSON.stringify(documentFor([week('2026-11-09', [session('bad', 7)])]))), /Dia invàlid/);
  assert.equal(c.mergePlanningDocuments(incoming, parsed).stats.unchanged, 1);
  assert.equal(c.planningEqual({ z: { b: 1, a: 2 } }, { z: { a: 2, b: 1 } }), true);

  // El modal mostra conseqüències i no reactiva el botó després d'un error.
  const elements = new Map();
  c.document = { querySelectorAll: () => [], getElementById(id) {
    if (!elements.has(id)) elements.set(id, { style: {}, addEventListener() {} });
    return elements.get(id);
  } };
  c.renderPlanningResults({ ok: true, merge: replacement });
  assert.match(elements.get('planning-session-summary').textContent, /2 eliminades/);
  assert.match(elements.get('planning-uploader-ok-list').innerHTML, /objectiu 12 km/);
  assert.match(elements.get('planning-uploader-ok-list').innerHTML, /Dilluns → Dijous/);
  const preview = elements.get('planning-uploader-ok-list').innerHTML;
  assert.match(preview, /data-planning-disclosure="week:2026-11-09">/);
  assert.match(preview, /Classificació i identificador/);
  assert.match(preview, /<code>run<\/code>/);
  assert.ok(preview.indexOf('planning-deletions') < preview.indexOf('planning-week-details'));
  assert.ok(preview.indexOf('objectiu 12 km') < preview.indexOf('planning-week-details'));
  vm.runInContext('_planningDisclosureState.set("week:2026-11-09", true)', c);
  c.renderPlanningResults({ ok: true, merge: replacement });
  assert.match(elements.get('planning-uploader-ok-list').innerHTML, /data-planning-disclosure="week:2026-11-09" open>/);
  c.FileReader = class {
    readAsText(file) { this.onload({ target: { result: file.contents } }); }
  };
  await c.handlePlanningFileSelection({ name: 'invalid.json', contents: '{}' }, result => c.renderPlanningResults(result));
  c.setPlanningConfirmState('idle');
  assert.equal(elements.get('planning-uploader-confirm-btn').disabled, true);
  assert.equal(c.getPendingMerge(), null);

  // Import complet: persistència, eliminació delimitada, verificació i render immediat.
  vm.runInContext('_pendingMerge = preparePlanningMerge(window.testIncoming, { mode: "replace-weeks", dayPolicy: "apply" })',
    Object.assign(c, { testIncoming: incoming }));
  assert.equal((await c.confirmPlanningImport()).ok, true);
  assert.equal(c.renders, 1);
  assert.equal(env.tables.planning_sessions.some(s => s.external_id === 'history'), true);
  assert.equal(env.tables.planning_sessions.some(s => s.external_id === 'obsolete'), false);
  assert.equal(env.tables.planning_sessions.some(s => s.external_id === 'completed'), false);
  const savedState = c.dashboardStore.getState();
  assert.equal(savedState.calendar.weeks['2026-11-09'].items.find(s => s.id === 'completed').status, 'done');
  assert.equal(env.notices.some(n => !n.error), true);
  const plan = savedState.planningDocument.cycles[0].weeks.find(w => w.id === '2026-11-09');
  const enriched = { key: plan.id, startDate: new Date(`${plan.start}T12:00:00`), endDate: new Date(`${plan.end}T23:59:59`), sessions: plan.sessions };
  const visible = c.PlanningCalendar.read(enriched, savedState.calendar, []);
  assert.equal(visible.items.find(s => s.id === 'run').day, 3);
  const month = c.paPlanningDays([enriched], savedState.calendar, { start: new Date('2026-11-01'), end: new Date('2026-11-30') });
  assert.equal(month.find(row => row.item.id === 'run').dateKey, '2026-11-12');
  assert.equal(month.find(row => row.item.id === 'completed').dateKey, '2026-11-11');
  const noSaved = c.PlanningCalendar.read({ ...enriched, key: 'other' }, {}, []);
  assert.equal(noSaved.items.find(s => s.id === 'run').day, 3);
  const nullSaved = c.PlanningCalendar.reconcile({ ...enriched, planning: { sessions: [session('run', 'thursday')] } },
    { items: [{ id: 'run', source: 'planning', day: null }] });
  assert.equal(nullSaved.items[0].day, null);

  // Una sessió confirmada respecta la data real i no es mou amb la importació.
  const confirmed = c.PlanningCalendar.reconcile({ ...enriched, planning: { sessions: [session('run', 'thursday')] } }, null,
    [{ id: 'activity', date: '2026-11-10', planning_links: [{ planning_session_id: 'run', confidence: 'confirmed' }] }], { applySessionIds: ['run'] });
  assert.equal(confirmed.items[0].day, 1);
  assert.equal(confirmed.items[0].status, 'done');

  // Canvis concurrents i cache pendent: aturar abans d'escriure.
  const concurrent = setup(); await seed(concurrent);
  concurrent.c.testIncoming = incoming;
  vm.runInContext('_pendingMerge = preparePlanningMerge(testIncoming)', concurrent.c);
  concurrent.tables.planning_sessions.find(s => s.external_id === 'run').payload.distance_km = 99;
  assert.equal((await concurrent.c.confirmPlanningImport()).ok, false);
  assert.equal(concurrent.calls.some(call => call.operation !== 'select'), false);
  assert.match(concurrent.notices.at(-1).message, /ha canviat/);

  const pending = setup(); await seed(pending);
  pending.c.testIncoming = incoming;
  vm.runInContext('_pendingMerge = preparePlanningMerge(testIncoming)', pending.c);
  pending.storage.set('suunto-coach-calendar-local-v1', JSON.stringify({ weeks: { '2026-11-09': { sync_status: 'pending' } } }));
  assert.equal((await pending.c.confirmPlanningImport()).ok, false);
  assert.equal(pending.calls.some(call => call.operation !== 'select'), false);

  const failed = setup(); await seed(failed);
  failed.c.testIncoming = incoming;
  vm.runInContext('_pendingMerge = preparePlanningMerge(testIncoming, { mode: "replace-weeks" })', failed.c);
  failed.faults['planning_sessions:delete'] = true;
  assert.equal((await failed.c.confirmPlanningImport()).ok, false);
  assert.equal(failed.notices.some(n => !n.error), false);
  assert.equal(failed.tables.planning_sessions.some(s => s.external_id === 'obsolete'), true);

  const mismatched = setup(); await seed(mismatched);
  mismatched.c.testIncoming = incoming;
  vm.runInContext('_pendingMerge = preparePlanningMerge(testIncoming)', mismatched.c);
  const original = mismatched.c.SupabaseDataProvider;
  mismatched.c.SupabaseDataProvider = { ...original, upsertPlanning: async () => ({ status: 'synced' }) };
  assert.equal((await mismatched.c.confirmPlanningImport()).ok, false);
  assert.match(mismatched.notices.at(-1).message, /verificació/);

  // Una setmana buida explícita elimina només el seu planning pendent.
  const empty = setup(); await seed(empty);
  empty.c.testIncoming = documentFor([week('2026-11-09', [])]);
  vm.runInContext('_pendingMerge = preparePlanningMerge(testIncoming, { mode: "replace-weeks" })', empty.c);
  empty.tables.planning_sessions.push({ user_id: 'another-user', external_id: 'obsolete', week_id: 'foreign-week', payload: {} });
  assert.equal((await empty.c.confirmPlanningImport()).ok, true);
  assert.equal(empty.tables.planning_sessions.filter(s => s.user_id === 'athlete').length, 1);
  assert.equal(empty.tables.planning_sessions.some(s => s.user_id === 'another-user'), true);
  assert.deepEqual(empty.tables.calendar_weeks[0].items.map(s => s.id).sort(), ['completed', 'manual']);

  // Quan només canvien els dies del calendari, també s'ha de poder importar.
  const daysOnly = setup(); await seed(daysOnly);
  const samePlanning = daysOnly.c.dashboardStore.getState().planningDocument;
  const onlyWeek = copy(samePlanning);
  onlyWeek.cycles[0].weeks = onlyWeek.cycles[0].weeks.filter(w => w.id === '2026-11-09');
  daysOnly.tables.calendar_weeks[0].items.find(s => s.id === 'run').day = 4;
  daysOnly.c.dashboardStore.getState().calendar.weeks['2026-11-09'].items.find(s => s.id === 'run').day = 4;
  daysOnly.c.testIncoming = onlyWeek;
  vm.runInContext('_pendingMerge = preparePlanningMerge(testIncoming)', daysOnly.c);
  assert.equal(daysOnly.c.getPendingMerge().stats.unchanged, 1);
  assert.equal(daysOnly.c.getPendingMerge().hasChanges, true);
  assert.equal((await daysOnly.c.confirmPlanningImport()).ok, true);
  assert.equal(daysOnly.calls.some(call => call.table === 'planning_weeks' && call.operation === 'upsert'), false);
  assert.equal(daysOnly.tables.calendar_weeks[0].items.find(s => s.id === 'run').day, 0);

  // Es pot passar un JSON extern per provar-lo sense tocar Supabase real.
  if (process.argv[2]) {
    const real = setup();
    const originalPlanning = JSON.parse(fs.readFileSync(path.join(root, 'docs/data/planning.json'), 'utf8'));
    await real.c.SupabaseDataProvider.upsertPlanning(originalPlanning);
    const initial = await real.c.SupabaseDataProvider.getPlanning();
    real.c.dashboardStore.setData({ planningDocument: initial.document, calendar: { weeks: {} }, sessionsDocument: { sessions: [] } });
    real.c.testIncoming = real.c.DashboardDataService.parsePlanningJSON(fs.readFileSync(process.argv[2], 'utf8'));
    vm.runInContext('_pendingMerge = preparePlanningMerge(testIncoming, { mode: "replace-weeks" })', real.c);
    const untouched = real.c.getPendingMerge().original.cycles.flatMap(cycle => cycle.weeks)
      .filter(w => !real.c.testIncoming.cycles.some(cycle => cycle.weeks.some(inc => inc.id === w.id)));
    assert.equal((await real.c.confirmPlanningImport()).ok, true);
    const result = real.c.dashboardStore.getState().planningDocument;
    for (const week of untouched) assert.equal(real.c.planningEqual(
      real.c.planningWeekSnapshot(initial.document, week.id), real.c.planningWeekSnapshot(result, week.id)), true);
    assert.equal(real.c.preparePlanningMerge(real.c.testIncoming, { mode: 'replace-weeks' }).hasChanges, false);
    console.log(`External JSON verified: ${real.c.testIncoming.cycles.flatMap(cycle => cycle.weeks).length} weeks; ${untouched.length} absent weeks preserved`);
  }

  console.log('Planning import checks OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
