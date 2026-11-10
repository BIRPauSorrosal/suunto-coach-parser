#!/usr/bin/env node
// Comportament d'Avui: estats del dia, accions, progrés i trasllat de l'anàlisi.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const today = new Date(2026, 10, 10, 12);
const nextMonday = new Date(2026, 10, 16, 12);

function setup() {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [today.getTime()])); }
    static now() { return today.getTime(); }
  }
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', events: {},
      addEventListener(type, callback) { this.events[type] = callback; } });
    return nodes.get(id);
  };
  const calls = [];
  const c = { console, Date: FixedDate, localStorage: { getItem: () => null },
    document: { getElementById: node },
    openPlannedSessionDetail: (...args) => calls.push(['planned', ...args]),
    openSessionDetailDrawer: (...args) => calls.push(['actual', ...args]),
    setFlexibleWeekByKey: (...args) => calls.push(['week', ...args]),
    navigateTo: (...args) => calls.push(['navigate', ...args]),
  };
  c.window = c;
  vm.createContext(c);
  for (const file of ['docs/js/lib/formatters.js', 'docs/js/lib/activity-types.js', 'docs/js/lib/data-service.js',
    'docs/js/lib/ui-components.js', 'docs/js/lib/dashboard-store.js', 'docs/js/lib/week-manager.js',
    'docs/js/lib/planning-calendar.js', 'docs/js/views/planning.js', 'docs/js/views/today.js', 'docs/js/views/overview.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file });
  }
  const click = (container, selector, dataset = {}) => node(container).events.click({
    target: { closest: value => value === selector ? { dataset } : null },
  });
  return { c, node, calls, click };
}
const plan = (id, day, fields = {}) => ({ id, day, type: 'aerobic', sport: 'running', variant: 'road',
  distance_km: 5, duration_min: 35, description: 'Rodatge còmode', ...fields });
const week = sessions => ({ startDate: new Date(2026, 10, 9), endDate: new Date(2026, 10, 15, 23, 59),
  setmana: '2026-S46', fase: 'Recuperació', sessions });
const actual = (id, links = []) => ({ date: today, distance_km: 5, distancia: 5, durada: 35,
  type: 'aerobic', sport: 'running', variant: 'road', raw: { __activity: { id, planning_links: links } } });

const env = setup(), { c, node, click, calls } = env;
const planning = [week([plan('run', 1, { description: '<img src=x onerror=alert(1)>' }), plan('thursday', 3)]),
  { ...week([plan('next-week', 0)]), startDate: nextMonday, endDate: new Date(2026, 10, 22, 23, 59), setmana: '2026-S47' }];
c.renderTodayView([], planning);
assert.equal(node('today-status-badge').textContent, 'Sessió pendent');
assert.match(node('today-hero').innerHTML, /Sessió del dia/);
assert.match(node('today-hero').innerHTML, /5 km · 35 min/);
assert.match(node('today-hero').innerHTML, /Veure detall/);
assert.match(node('today-hero').innerHTML, /Obrir calendari/);
assert.match(node('today-hero').innerHTML, /&lt;img/);
assert.doesNotMatch(node('today-hero').innerHTML, /<img|CTL|VO₂max/);
assert.match(node('today-week-summary').innerHTML, /0 de 2 sessions completades/);
assert.match(node('today-upcoming').innerHTML, /next-week/);
click('today-hero', '[data-today-planning-session-id]', { todayPlanningSessionId: 'run' });
assert.equal(calls.at(-1)[0], 'planned');
assert.equal(calls.at(-1)[1].id, 'run');
click('today-hero', '[data-today-open-calendar]');
assert.deepEqual(calls.slice(-2).map(call => call[0]), ['week', 'navigate']);
assert.equal(calls.at(-2)[1], '2026-11-09');
assert.equal(vm.runInContext('planningViewLevel', c), 'weekly');
click('today-upcoming', '[data-today-planning-session-id]', { todayPlanningSessionId: 'next-week' });
assert.equal(calls.at(-1)[1].id, 'next-week');
assert.match(calls.at(-1)[3].dateLabel, /16/);

// Sense sessions, descans i absència de planificació no bloquegen l'accés al calendari.
c.renderTodayView([], []);
assert.match(node('today-hero').innerHTML, /Dia de descans/);
assert.match(node('today-hero').innerHTML, /data-today-open-calendar/);
assert.match(node('today-week-summary').innerHTML, /Sense sessions previstes/);
assert.doesNotMatch(node('today-week-summary').innerHTML, /<progress/);

// Activitat completada i múltiples sessions: estat, recompte i actualització dels botons.
const completed = actual('actual-run', [{ confidence: 'confirmed', planning_session_id: 'run' }]);
c.renderTodayView([completed], planning);
assert.equal(node('today-status-badge').textContent, 'Dia completat');
assert.match(node('today-hero').innerHTML, /✓ Completada/);
assert.match(node('today-week-summary').innerHTML, /1 de 2 sessions completades/);
assert.doesNotMatch(node('today-hero').innerHTML, /Activitat no planificada/);
click('today-hero', '[data-today-planning-session-id]', { todayPlanningSessionId: 'run' });
assert.equal(calls.at(-1)[2].raw.__activity.id, 'actual-run');
c.renderTodayView([], [week([plan('one', 1), plan('two', 1)])]);
assert.match(node('today-hero').innerHTML, /2 sessions del dia/);

c.renderTodayView([actual('unplanned')], []);
assert.equal(node('today-status-badge').textContent, 'Activitat registrada');
assert.match(node('today-hero').innerHTML, /Activitat no planificada/);
click('today-hero', '[data-today-activity-id]', { todayActivityId: 'unplanned' });
assert.equal(calls.at(-1)[0], 'actual');
assert.equal(calls.at(-1)[1].raw.__activity.id, 'unplanned');

// Un refresh ha d'actualitzar els contextos sense conservar la sessió anterior.
c.renderTodayView([], [week([plan('replacement', 1)])]);
click('today-hero', '[data-today-planning-session-id]', { todayPlanningSessionId: 'replacement' });
assert.equal(calls.at(-1)[1].id, 'replacement');

// Les sensacions i els indicadors només es renderitzen a Overview.
const history = c.overviewPerformanceSeries([{ date: new Date(2026, 10, 9), carrega: 30 }]);
assert.equal(history.length, 2);
assert.equal(history.at(-1).date, '2026-11-10');
assert.equal(history.at(-1).tss, 0);
assert.ok(history.at(-1).atl < history[0].atl);
c.renderOverviewPerformance([{ date: today, feeling: 4, vo2max: 48 }]);
assert.match(node('overview-kpi-grid').innerHTML, /CTL|48.0/);
assert.match(node('overview-feeling').innerHTML, /4 \/ 5/);
c.renderOverviewPerformance([]);
assert.match(node('overview-feeling').innerHTML, /Sense registre/);
assert.doesNotMatch(node('overview-feeling').innerHTML, /4 \/ 5/);

const html = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
const todayHtml = html.slice(html.indexOf('<!-- Vista: Avui -->'), html.indexOf('<!-- Vista: Planning -->'));
assert.ok(todayHtml.indexOf('id="today-hero"') < todayHtml.indexOf('id="today-week-summary"'));
assert.ok(todayHtml.indexOf('id="today-week-summary"') < todayHtml.indexOf('id="today-upcoming"'));
assert.doesNotMatch(todayHtml, /overview-kpi|today-kpi|chart-today|feeling/);
assert.equal((html.match(/id="chart-ctl-trend"/g) || []).length, 1);
console.log('Today view checks OK');
