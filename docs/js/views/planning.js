// docs/js/views/planning.js
// Dep: app.js (formatPace, enrichPlanningRow)
// Tots els camps del planning s'accedeixen via propietats enriquides (w.camp),
// mai via w.raw['Columna']. L'enriquiment es fa a enrichPlanningRow() (app.js).

const CYCLE_COLORS = {
  'BASE':         { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)'  },
  'CONSTRUCCIÓ':  { color: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
  'CONSTRUCCIO':  { color: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
  'RECUPERACIÓ':  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  'RECUPERACIO':  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  'PIC':          { color: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
  'COMPETICIÓ':   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  'COMPETICIO':   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
};
const CYCLE_DEFAULT = { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' };

const PHASE_COLORS = {
  'ACUMULACIÓ':   '#38bdf8',
  'ACUMULACIO':   '#38bdf8',
  'EXTENSIÓ':     '#f97316',
  'EXTENSIO':     '#f97316',
  'DESCÀRREGA':   '#f59e0b',
  'DESCARREGA':   '#f59e0b',
  'CONSOLIDACIÓ': '#a78bfa',
  'CONSOLIDACIO': '#a78bfa',
  'COMPETICIÓ':   '#ef4444',
  'COMPETICIO':   '#ef4444',
};
const PHASE_DEFAULT = '#94a3b8';

let planningViewLevel = 'weekly';
let planningYear      = new Date().getFullYear();
let planningMonth     = new Date().getMonth();
let planningWeekIndex = 0;

// Els valors del planning provenen d'un CSV editable per l'usuari.
// Escapem sempre el text abans d'inserir-lo en HTML.
const escapePlanningText = value => window.DashboardComponents?.escapeHtml
  ? window.DashboardComponents.escapeHtml(value)
  : String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

// ── Punt d'entrada ──────────────────────────────────────────────────────────────
function renderPlanningView(planning, sessions, calendar) {
  if (!planning.length) return;
  const today  = new Date(); today.setHours(12, 0, 0, 0);
  const selectedKey = window.getFlexibleWeekKey?.();
  const selected = selectedKey
    ? planning.find(w => window.WeekManager.key(w.startDate) === selectedKey)
    : null;
  const active = selected || planning.find(w => {
    const start = new Date(w.startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(w.endDate); end.setHours(23, 59, 59, 999);
    return today >= start && today <= end;
  })
               || planning[planning.length - 1];
  if (active) {
    planningMonth     = active.startDate.getMonth();
    planningYear      = active.startDate.getFullYear();
    planningWeekIndex = planning.indexOf(active);
  }
  initPlanningNav(planning, sessions, calendar);
  renderPlanningLevel(planning, sessions, calendar);
}

// ── Navegació de nivells ─────────────────────────────────────────────────────────
function initPlanningNav(planning, sessions, calendar) {
  ['btn-plan-yearly', 'btn-plan-monthly', 'btn-plan-weekly'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
  });
  document.getElementById('btn-plan-yearly')?.addEventListener('click', () => {
    planningViewLevel = 'yearly'; renderPlanningLevel(planning, sessions, calendar);
  });
  document.getElementById('btn-plan-monthly')?.addEventListener('click', () => {
    planningViewLevel = 'monthly'; renderPlanningLevel(planning, sessions, calendar);
  });
  document.getElementById('btn-plan-weekly')?.addEventListener('click', () => {
    planningViewLevel = 'weekly'; renderPlanningLevel(planning, sessions, calendar);
  });
}

function renderPlanningLevel(planning, sessions, calendar) {
  updateLevelButtons();
  const container = document.getElementById('planning-view-container');
  if (!container) return;
  if (planningViewLevel === 'yearly')  renderSeasonYearView(container, planning, sessions, calendar);
  if (planningViewLevel === 'monthly') renderContextMonthView(container, planning, sessions, calendar);
  if (planningViewLevel === 'weekly')  renderIntegratedWeeklyPlanView(container, planning, sessions, calendar);
}

function updateLevelButtons() {
  document.getElementById('btn-plan-yearly') ?.classList.toggle('active', planningViewLevel === 'yearly');
  document.getElementById('btn-plan-monthly')?.classList.toggle('active', planningViewLevel === 'monthly');
  document.getElementById('btn-plan-weekly')?.classList.toggle('active', planningViewLevel === 'weekly');
}

function renderIntegratedWeeklyPlanView(container, planning, sessions, calendar) {
  const selected = planning[planningWeekIndex];
  const selectedKey = selected ? window.WeekManager.key(selected.startDate) : null;
  container.innerHTML = `
    <div class="planning-week-shell">
      <header class="page-header planning-week-header">
        <div>
          <p class="eyebrow">Calendari flexible</p>
          <h2 id="flex-week-label">--</h2>
          <p class="page-subtitle"><span id="flex-week-range">--</span> · <span id="flex-week-context">--</span></p>
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost" id="flex-week-prev">◄ Anterior</button>
          <button class="btn btn-ghost" id="flex-week-current">Setmana actual</button>
          <span class="badge badge-muted" id="flex-week-counter">-- / --</span>
          <button class="btn btn-ghost" id="flex-week-next">Següent ►</button>
        </div>
      </header>
      <section class="flex-week-toolbar panel">
        <div>
          <p class="eyebrow">Organitza la setmana</p>
          <p class="flex-week-help">Mou les sessions entre dies. Les sessions reals es mostren a sota i no modifiquen l’històric.</p>
        </div>
        <button class="btn btn-primary" id="flex-add-session">+ Afegir activitat</button>
      </section>
      <section class="flex-week-summary" id="flex-week-summary"></section>
      <section class="flex-calendar" id="flex-calendar" aria-label="Calendari setmanal"></section>
      <section class="flex-unassigned panel" id="flex-unassigned" hidden></section>
      <section class="flex-unmatched panel" id="flex-unmatched" hidden></section>
    </div>`;
  if (selectedKey && typeof window.setFlexibleWeekByKey === 'function') window.setFlexibleWeekByKey(selectedKey, planning, sessions);
  window.renderFlexibleWeekView(sessions, planning, calendar);
}

// ── Genera les setmanes ISO de l'any (dilluns a diumenge) ──────────────────────
function buildISOWeeks(year) {
  const weeks = [];
  const jan1     = new Date(year, 0, 1);
  const dow      = jan1.getDay();
  const offset   = dow === 0 ? -6 : 1 - dow;
  let monday     = new Date(year, 0, 1 + offset);

  while (monday.getFullYear() <= year) {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    if (monday.getFullYear() < year) {
      const daysIn = (new Date(year, 0, 1) - monday) / -86400000;
      if (daysIn < 4) { monday = new Date(monday); monday.setDate(monday.getDate() + 7); continue; }
    }
    if (monday.getFullYear() > year) break;
    weeks.push({ isoStart: new Date(monday), isoEnd: new Date(sunday) });
    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
  }
  return weeks;
}

// ── Mes representatiu d'una setmana (dijous → convenció ISO) ───────────────────
function isoWeekMonth(isoStart) {
  const thu = new Date(isoStart);
  thu.setDate(thu.getDate() + 3);
  return thu.getMonth();
}

// ── Troba el planning entry que solapa amb una setmana ISO ─────────────────────
function findPlanningForWeek(isoStart, isoEnd, planning) {
  return planning.find(w => w.startDate <= isoEnd && w.endDate >= isoStart) || null;
}

// ── Planning contextual: agregacions reals per mes i temporada ────────────────
const PA_MONTH_NAMES = ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];
const PA_WEEK_NAMES = ['Dl','Dt','Dc','Dj','Dv','Ds','Dg'];

function paDateKey(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function paMonthRange(year, month) {
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59, 999) };
}
function paMonthSessions(sessions, year, month) {
  const range = paMonthRange(year, month);
  return sessions.filter(session => session.date >= range.start && session.date <= range.end);
}
function paValue(session, field) {
  const canonical = session?.raw?.__activity || session?.__activity || {};
  const values = {
    duration: [session?.durada, canonical.duration_min],
    distance: [session?.distancia, canonical.distance_km],
    load: [session?.carrega, canonical.training_effect?.load],
    elevation: [session?.desnivell, canonical.elevation_m],
  }[field] || [];
  const value = values.find(candidate => Number.isFinite(Number(candidate)));
  return value === undefined ? null : Number(value);
}
function paStats(sessions) {
  const total = field => sessions.reduce((sum, session) => sum + Math.max(0, paValue(session, field) || 0), 0);
  return {
    activities: sessions.length,
    duration: total('duration'),
    distance: total('distance'),
    load: total('load'),
    elevation: total('elevation'),
    hasLoad: sessions.some(session => paValue(session, 'load') !== null && paValue(session, 'load') > 0),
    hasDistance: sessions.some(session => paValue(session, 'distance') !== null && paValue(session, 'distance') > 0),
  };
}
function paPercent(current, previous) {
  return previous > 0 && Number.isFinite(current) ? `${current - previous >= 0 ? '+' : ''}${Math.round((current - previous) / previous * 100)}%` : null;
}
function paMetric(label, value, modifier = '') {
  return `<div class="pa-kpi ${modifier}"><span>${escapePlanningText(label)}</span><strong>${escapePlanningText(value)}</strong></div>`;
}
function paLoad(session) { return paValue(session, 'load') || 0; }
function paActivityType(session) {
  const canonical = session?.raw?.__activity || session?.__activity || {};
  const rawType = String(canonical.type || session?.tipusKey || '').toLowerCase();
  const label = String(session?.tipusKey || '').toUpperCase();
  if (['test', 'race'].includes(rawType) || ['TEST', 'CURSA'].includes(label)) return 'test';
  if (['long-run', 'long'].includes(rawType) || ['LLARGA', 'TRAIL'].includes(label)) return 'long';
  if (rawType === 'z2' || label === 'Z2') return 'z2';
  if (rawType === 'quality' || ['INTERVALS', 'TEMPO'].includes(label)) return 'quality';
  if (rawType === 'strength' || label.startsWith('FOR')) return 'strength';
  if (['cycling', 'bici'].includes(rawType) || label === 'BICI') return 'bici';
  return 'other';
}
function paActivityColor(session) {
  return {
    test: 'var(--color-danger)',
    quality: 'var(--orange)',
    z2: 'var(--accent)',
    long: 'var(--blue)',
    strength: 'var(--purple)',
    bici: 'var(--cyan)',
    other: 'var(--yellow)',
  }[paActivityType(session)];
}
function paLinks(session) {
  const canonical = session?.raw?.__activity || session?.__activity || {};
  try {
    const saved = JSON.parse(localStorage.getItem('suunto-coach-session-links-v1') || '{}');
    const id = canonical.id;
    if (id && Object.prototype.hasOwnProperty.call(saved, id)) return Array.isArray(saved[id]) ? saved[id] : [];
  } catch (_) {}
  return Array.isArray(canonical.planning_links) ? canonical.planning_links : [];
}
function paPlanLabel(plan) {
  const labels = { quality: 'Qualitat', z2: 'Z2', long: 'Tirada llarga', 'long-run': 'Tirada llarga', strength: 'Força', bici: 'Bici estàtica', cycling: 'Ciclisme', padel: 'Pàdel', other: 'Altres' };
  return plan?.title || plan?.detail || plan?.description || plan?.label || labels[plan?.type] || 'Sessió planificada';
}
function paDefaultDay(type) {
  return { quality: 1, z2: 3, long: 5, 'long-run': 5, strength: 2, bici: 5, cycling: 5, padel: 5 }[type] ?? null;
}
function paCalendarWeek(week, calendar) {
  const key = window.WeekManager.key(week.startDate);
  let local = null;
  try { local = JSON.parse(localStorage.getItem('suunto-coach-calendar-local-v1') || 'null')?.weeks?.[key] || null; } catch (_) {}
  return local || calendar?.weeks?.[key] || null;
}
function paPlanningDays(planning, calendar, month) {
  const result = [];
  planning.filter(week => week.startDate <= month.end && week.endDate >= month.start).forEach(week => {
    const stored = paCalendarWeek(week, calendar);
    const storedItems = Array.isArray(stored?.items) ? stored.items : [];
    const itemByPlan = new Map(storedItems.filter(item => item.source !== 'manual').map(item => [item.planning_session_id || item.id, item]));
    const removed = new Set(stored?.removedPlanning || stored?.removed_planning_session_ids || []);
    (week.sessions || []).forEach(plan => {
      if (removed.has(plan.id)) return;
      const item = itemByPlan.get(plan.id) || null;
      const day = item && Number.isInteger(item.day) ? item.day : paDefaultDay(plan.type);
      if (day === null) return;
      const date = new Date(week.startDate); date.setDate(date.getDate() + day);
      if (date < month.start || date > month.end) return;
      result.push({ dateKey: paDateKey(date), plan, item, real: null });
    });
    storedItems.filter(item => item.source === 'manual' && Number.isInteger(item.day)).forEach(item => {
      const date = new Date(week.startDate); date.setDate(date.getDate() + item.day);
      if (date >= month.start && date <= month.end) result.push({ dateKey: paDateKey(date), plan: null, item, real: null });
    });
  });
  return result;
}
function paFindPlanForActivity(activity, planning) {
  const link = paLinks(activity).find(item => item.confidence === 'confirmed');
  if (!link) return null;
  return (planning || []).flatMap(week => week.sessions || []).find(plan => plan.id === link.planning_session_id) || null;
}
function paDayCells(year, month) {
  const first = new Date(year, month, 1), last = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + last.getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month, index - offset + 1);
    return { date, inMonth: date.getMonth() === month, key: paDateKey(date) };
  });
}
function paDaySummary(dateKey, real, plans, planning) {
  const stats = paStats(real);
  const title = new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'long' }).format(new Date(`${dateKey}T12:00:00`));
  const activityList = real.length
    ? real.map(session => { const activityType = paActivityType(session); return `<button type="button" class="pa-day-activity${activityType === 'test' ? ' pa-day-activity--emphasis' : ''}" style="--pa-activity-color:${paActivityColor(session)}" data-month-activity="${escapeAttr(session.raw?.__activity?.id || '')}" data-plan-id="${escapeAttr(paFindPlanForActivity(session, planning)?.id || '')}"><span>${escapePlanningText(session.tipus || 'Activitat')}</span><small>${paValue(session, 'duration') === null ? '' : fmtMinutes(Math.round(paValue(session, 'duration')))}${paValue(session, 'distance') === null || paValue(session, 'distance') <= 0 ? '' : ` · ${fmtNumP(paValue(session, 'distance'))} km`}</small></button>`; }).join('')
    : '<p class="pa-muted">No hi ha activitats reals aquest dia.</p>';
  const plansOnly = plans.filter(entry => !entry.real).map(entry => `<div class="pa-day-plan"><span>Prevista</span><strong>${escapePlanningText(paPlanLabel(entry.plan || entry.item))}</strong></div>`).join('');
  return `<div class="pa-day-detail-head"><div><p class="eyebrow">Detall del dia</p><h3>${escapePlanningText(title)}</h3></div><div class="pa-day-detail-kpis">${paMetric('Activitats', stats.activities)}${stats.duration > 0 ? paMetric('Temps', fmtMinutes(Math.round(stats.duration))) : ''}${stats.hasLoad ? paMetric('Càrrega', fmtNumP(stats.load)) : ''}</div></div><div class="pa-day-activity-list">${activityList}${plansOnly}</div>`;
}

function renderContextMonthView(container, planning, sessions, calendar) {
  const monthSessions = paMonthSessions(sessions, planningYear, planningMonth);
  const previousMonth = planningMonth === 0 ? 11 : planningMonth - 1;
  const previousYear = planningMonth === 0 ? planningYear - 1 : planningYear;
  const currentStats = paStats(monthSessions), previousStats = paStats(paMonthSessions(sessions, previousYear, previousMonth));
  const range = paMonthRange(planningYear, planningMonth);
  const plans = paPlanningDays(planning, calendar, range);
  const byDay = new Map();
  plans.forEach(entry => { if (!byDay.has(entry.dateKey)) byDay.set(entry.dateKey, { plans: [], real: [] }); byDay.get(entry.dateKey).plans.push(entry); });
  monthSessions.forEach(session => { const key = paDateKey(session.date); if (!byDay.has(key)) byDay.set(key, { plans: [], real: [] }); byDay.get(key).real.push(session); });
  const dailyLoads = [...byDay.values()].map(day => day.real.reduce((sum, session) => sum + paLoad(session), 0));
  const maxLoad = Math.max(...dailyLoads, 1);
  const weekRows = [];
  const weekKeys = new Map();
  monthSessions.forEach(session => { const key = window.WeekManager.key(session.date); if (!weekKeys.has(key)) weekKeys.set(key, []); weekKeys.get(key).push(session); });
  plans.forEach(entry => { const key = window.WeekManager.key(new Date(`${entry.dateKey}T12:00:00`)); if (!weekKeys.has(key)) weekKeys.set(key, []); });
  [...weekKeys.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([key, items]) => {
    const stats = paStats(items), week = planning.find(item => window.WeekManager.key(item.startDate) === key);
    weekRows.push(`<button type="button" class="pa-week-row" data-planning-week="${week ? planning.indexOf(week) : ''}"><span>${escapePlanningText(week?.setmana || key)}</span><strong>${stats.activities}</strong><span>${stats.duration ? fmtMinutes(Math.round(stats.duration)) : '—'}</span><span>${stats.hasLoad ? fmtNumP(stats.load) : '—'}</span></button>`);
  });
  const cells = paDayCells(planningYear, planningMonth).map(cell => {
    if (!cell.inMonth) return '<span class="pa-calendar-day pa-calendar-day--empty" aria-hidden="true"></span>';
    const data = byDay.get(cell.key) || { plans: [], real: [] }, load = data.real.reduce((sum, session) => sum + paLoad(session), 0);
    const intensity = load > 0 ? Math.max(.08, load / maxLoad) : 0;
    const planText = data.plans.length ? `<span class="pa-day-plan-count">${data.plans.length} prev.</span>` : '';
    const realText = data.real.length ? `<span class="pa-day-real-count">${data.real.length} real.</span>` : '';
    const loadOpacity = load ? (0.04 + intensity * 0.16).toFixed(3) : '0';
    return `<article class="pa-calendar-day${data.plans.length ? ' has-plan' : ''}${data.real.length ? ' has-real' : ''}${load ? ' has-load' : ''}" style="--pa-load:${intensity};--pa-load-opacity:${loadOpacity}"><button type="button" class="pa-calendar-day-select" data-month-day="${cell.key}" aria-label="${escapeAttr(`${cell.date.getDate()} de ${PA_MONTH_NAMES[planningMonth]}`)}"><span class="pa-day-number">${cell.date.getDate()}</span><span class="pa-day-indicators">${planText}${realText}</span></button>${data.real.map(session => { const activityType = paActivityType(session); return `<button type="button" class="pa-calendar-activity${activityType === 'test' ? ' pa-calendar-activity--emphasis' : ''}" style="--pa-activity-color:${paActivityColor(session)}" data-month-activity="${escapeAttr(session.raw?.__activity?.id || '')}" aria-label="Obrir ${escapeAttr(session.tipus || 'activitat')}">${escapePlanningText(session.tipus || 'Activitat')}</button>`; }).join('')}</article>`;
  }).join('');
  const loadBars = paDayCells(planningYear, planningMonth).filter(cell => cell.inMonth).map(cell => { const load = (byDay.get(cell.key)?.real || []).reduce((sum, session) => sum + paLoad(session), 0); return `<span title="${escapeAttr(`${cell.date.getDate()} ${PA_MONTH_NAMES[planningMonth]} · ${fmtNumP(load)} càrrega`)}" style="height:${load ? Math.max(8, load / maxLoad * 100) : 2}%"></span>`; }).join('');
  const comparisonFields = [
    ['Activitats', currentStats.activities, previousStats.activities],
    ['Temps', currentStats.duration, previousStats.duration],
    currentStats.hasDistance && previousStats.hasDistance ? ['Distància', currentStats.distance, previousStats.distance] : null,
    currentStats.hasLoad && previousStats.hasLoad ? ['Càrrega', currentStats.load, previousStats.load] : null,
  ].filter(Boolean).map(([name, current, previous]) => `<div><span>${name}</span><strong>${name === 'Temps' ? (current > 0 ? fmtMinutes(Math.round(current)) : '0 min') : name === 'Activitats' ? current : fmtNumP(current)}</strong><em>${paPercent(current, previous) || '—'}</em></div>`).join('');
  const comparison = previousStats.activities && comparisonFields ? `<section class="pa-panel pa-comparison"><div class="pa-panel-heading"><div><p class="eyebrow">Evolució</p><h3>Vs ${PA_MONTH_NAMES[previousMonth]} ${previousYear}</h3></div></div><div class="pa-comparison-grid">${comparisonFields}</div></section>` : '';
  container.innerHTML = `<div class="pa-view-header"><div><p class="eyebrow">Context mensual</p><h2>${PA_MONTH_NAMES[planningMonth]} ${planningYear}</h2><p class="page-subtitle">Evolució real del mes</p></div><div class="pa-nav-actions"><button class="btn btn-ghost btn-sm" id="btn-month-prev" aria-label="Mes anterior">◄</button><button class="btn btn-ghost btn-sm" id="btn-month-today">Avui</button><button class="btn btn-ghost btn-sm" id="btn-month-next" aria-label="Mes següent">►</button></div></div><div class="pa-kpi-grid">${paMetric('Activitats', currentStats.activities)}${paMetric('Temps total', currentStats.duration ? fmtMinutes(Math.round(currentStats.duration)) : '—')}${currentStats.hasDistance ? paMetric('Distància', `${fmtNumP(currentStats.distance)} km`) : ''}${currentStats.hasLoad ? paMetric('Càrrega', fmtNumP(currentStats.load)) : ''}${currentStats.elevation > 0 ? paMetric('Desnivell', `${fmtNumP(currentStats.elevation)} m`) : ''}</div>${comparison}<div class="pa-month-layout"><section class="pa-panel pa-calendar-panel"><div class="pa-panel-heading"><div><p class="eyebrow">Calendari mensual</p><h3>Activitat i planificació</h3></div><div class="pa-legend"><span><i class="pa-legend-dot pa-legend-dot--plan"></i> Prevista</span><span><i class="pa-legend-dot pa-legend-dot--real"></i> Real</span></div></div><div class="pa-calendar-weekdays">${PA_WEEK_NAMES.map(name => `<span>${name}</span>`).join('')}</div><div class="pa-calendar-grid">${cells}</div><div class="pa-day-detail" id="pa-day-detail"><p class="pa-muted">Selecciona un dia amb activitat per veure’n el resum.</p></div></section><aside class="pa-month-side"><section class="pa-panel pa-load-panel"><div class="pa-panel-heading"><div><p class="eyebrow">Càrrega real</p><h3>Per dia</h3></div><span class="pa-panel-note">training_effect.load</span></div><div class="pa-load-bars" aria-label="Càrrega real diària">${loadBars || '<p class="pa-muted">Sense dades de càrrega.</p>'}</div></section><section class="pa-panel pa-weeks-panel"><div class="pa-panel-heading"><div><p class="eyebrow">Resum</p><h3>Per setmanes</h3></div></div><div class="pa-week-table-head"><span>Setmana</span><span>Act.</span><span>Temps</span><span>Càrrega</span></div><div class="pa-week-table">${weekRows.join('') || '<p class="pa-muted">No hi ha activitat aquest mes.</p>'}</div></section></aside></div>`;
  container.querySelector('#btn-month-prev')?.addEventListener('click', () => { planningMonth--; if (planningMonth < 0) { planningMonth = 11; planningYear--; } renderPlanningLevel(planning, sessions, calendar); });
  container.querySelector('#btn-month-next')?.addEventListener('click', () => { planningMonth++; if (planningMonth > 11) { planningMonth = 0; planningYear++; } renderPlanningLevel(planning, sessions, calendar); });
  container.querySelector('#btn-month-today')?.addEventListener('click', () => { const now = new Date(); planningMonth = now.getMonth(); planningYear = now.getFullYear(); renderPlanningLevel(planning, sessions, calendar); });
  const showDay = key => { const data = byDay.get(key) || { plans: [], real: [] }; container.querySelector('#pa-day-detail').innerHTML = paDaySummary(key, data.real, data.plans, planning); container.querySelectorAll('[data-month-day]').forEach(button => button.closest('.pa-calendar-day')?.classList.toggle('is-selected', button.dataset.monthDay === key)); };
  container.querySelectorAll('[data-month-day]').forEach(button => button.addEventListener('click', () => showDay(button.dataset.monthDay)));
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-month-activity]');
    if (!button || !container.contains(button)) return;
    event.stopPropagation();
    const activity = sessions.find(session => (session.raw?.__activity?.id || '') === button.dataset.monthActivity);
    if (!activity || typeof window.openSessionDetailDrawer !== 'function') return;
    const plan = paFindPlanForActivity(activity, planning);
    window.openSessionDetailDrawer(activity, plan, { planningItem: plans.find(entry => entry.plan?.id === plan?.id)?.item || null });
  });
  container.querySelectorAll('[data-planning-week]').forEach(button => button.addEventListener('click', () => { const index = Number(button.dataset.planningWeek); if (!Number.isInteger(index)) return; planningWeekIndex = index; planningViewLevel = 'weekly'; renderPlanningLevel(planning, sessions, calendar); }));
}

function paYearMonths(year, sessions) {
  return PA_MONTH_NAMES.map((name, month) => ({ name, month, sessions: paMonthSessions(sessions, year, month), stats: paStats(paMonthSessions(sessions, year, month)) }));
}
function renderSeasonYearView(container, planning, sessions, calendar) {
  const yearSessions = sessions.filter(session => session.date.getFullYear() === planningYear);
  const stats = paStats(yearSessions), months = paYearMonths(planningYear, sessions);
  const byDay = new Map(yearSessions.map(session => [paDateKey(session.date), []]));
  yearSessions.forEach(session => { const key = paDateKey(session.date); if (!byDay.has(key)) byDay.set(key, []); byDay.get(key).push(session); });
  const maxDailyLoad = Math.max(...[...byDay.values()].map(day => day.reduce((sum, session) => sum + paLoad(session), 0)), 1);
  const first = new Date(planningYear, 0, 1), offset = (first.getDay() + 6) % 7, daysInYear = (new Date(planningYear, 11, 31) - new Date(planningYear, 0, 1)) / 86400000 + 1;
  const heatmap = Array.from({ length: Math.ceil((offset + daysInYear) / 7) * 7 }, (_, index) => { const date = new Date(planningYear, 0, index - offset + 1), inYear = date.getFullYear() === planningYear; if (!inYear) return '<span class="py-heat-cell py-heat-cell--empty"></span>'; const day = byDay.get(paDateKey(date)) || [], load = day.reduce((sum, session) => sum + paLoad(session), 0), intensity = load ? Math.max(.1, load / maxDailyLoad) : 0; return `<span class="py-heat-cell${load ? ' has-load' : ''}" style="--py-load:${intensity}" title="${escapeAttr(`${date.getDate()} ${PA_MONTH_NAMES[date.getMonth()]} · ${fmtNumP(load)} càrrega`)}"></span>`; }).join('');
  const monthlyLoad = months.map(item => item.stats.load), maxMonthlyLoad = Math.max(...monthlyLoad, 1);
  const trend = months.map(item => `<button type="button" class="py-trend-bar${item.stats.activities ? ' has-data' : ''}" data-year-month="${item.month}" title="${escapeAttr(`${item.name}: ${fmtNumP(item.stats.load)} càrrega`)}"><span style="height:${item.stats.load ? Math.max(8, item.stats.load / maxMonthlyLoad * 100) : 2}%"></span><small>${item.name.slice(0, 3)}</small></button>`).join('');
  const monthlyRows = months.map(item => `<button type="button" class="py-month-row${item.stats.activities ? '' : ' is-empty'}" data-year-month="${item.month}"><span>${item.name}</span><strong>${item.stats.activities || '—'}</strong><span>${item.stats.duration ? fmtMinutes(Math.round(item.stats.duration)) : '—'}</span><span>${item.stats.hasDistance ? `${fmtNumP(item.stats.distance)} km` : '—'}</span><span>${item.stats.hasLoad ? fmtNumP(item.stats.load) : '—'}</span></button>`).join('');
  const planMonths = months.map(item => { const plan = planning.find(week => week.startDate.getMonth() === item.month && week.startDate.getFullYear() === planningYear) || planning.find(week => week.startDate <= new Date(planningYear, item.month, 15) && week.endDate >= new Date(planningYear, item.month, 15)); return plan ? `<span class="py-month-phase"><i style="background:${getCycleStyle(plan.cicle).color}"></i>${escapePlanningText(plan.cicle)} · ${escapePlanningText(plan.fase)}</span>` : ''; }).join('');
  container.innerHTML = `<div class="pa-view-header"><div><p class="eyebrow">Visió de temporada</p><h2>${planningYear}</h2><p class="page-subtitle">Evolució real de la temporada</p></div><div class="pa-nav-actions"><button class="btn btn-ghost btn-sm" id="btn-year-prev" aria-label="Any anterior">◄</button><button class="btn btn-ghost btn-sm" id="btn-year-today">Avui</button><button class="btn btn-ghost btn-sm" id="btn-year-next" aria-label="Any següent">►</button></div></div><div class="pa-kpi-grid pa-year-kpis">${paMetric('Activitats', stats.activities)}${paMetric('Temps total', stats.duration ? fmtMinutes(Math.round(stats.duration)) : '—')}${stats.hasDistance ? paMetric('Distància', `${fmtNumP(stats.distance)} km`) : ''}${stats.hasLoad ? paMetric('Càrrega', fmtNumP(stats.load)) : ''}</div><div class="py-layout"><section class="pa-panel py-trend-panel"><div class="pa-panel-heading"><div><p class="eyebrow">Evolució de càrrega</p><h3>Càrrega real per mes</h3></div><span class="pa-panel-note">training_effect.load</span></div><div class="py-trend-chart">${trend}</div></section><section class="pa-panel py-heat-panel"><div class="pa-panel-heading"><div><p class="eyebrow">Mapa de càrrega</p><h3>Càrrega real per dia</h3></div></div><div class="py-heat-months">${PA_MONTH_NAMES.map(name => `<span>${name.slice(0, 3)}</span>`).join('')}</div><div class="py-heatmap" aria-label="Mapa anual de càrrega">${heatmap}</div><p class="pa-panel-note">La intensitat del color representa la càrrega real acumulada de cada dia.</p></section></div><section class="pa-panel py-months-panel"><div class="pa-panel-heading"><div><p class="eyebrow">Desglossament</p><h3>Resum per mesos</h3></div></div><div class="py-month-table-head"><span>Mes</span><span>Act.</span><span>Temps</span><span>Distància</span><span>Càrrega</span></div><div class="py-month-table">${monthlyRows}</div></section><div class="py-phase-strip">${planMonths}</div>`;
  container.querySelector('#btn-year-prev')?.addEventListener('click', () => { planningYear--; renderPlanningLevel(planning, sessions, calendar); });
  container.querySelector('#btn-year-next')?.addEventListener('click', () => { planningYear++; renderPlanningLevel(planning, sessions, calendar); });
  container.querySelector('#btn-year-today')?.addEventListener('click', () => { planningYear = new Date().getFullYear(); renderPlanningLevel(planning, sessions, calendar); });
  container.querySelectorAll('[data-year-month]').forEach(button => button.addEventListener('click', () => { planningMonth = Number(button.dataset.yearMonth); planningViewLevel = 'monthly'; renderPlanningLevel(planning, sessions, calendar); }));
}

// ── Vista ANUAL — calendari 3 files × 4 columnes de mesos (versió anterior) ──
function renderYearlyView(container, planning, sessions) {
  const MONTH_NAMES_LONG  = ['Gener','Febrer','Març','Abril','Maig','Juny',
                              'Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];

  const legendCycles = [
    ['BASE',        CYCLE_COLORS['BASE'].color],
    ['CONSTRUCCIÓ', CYCLE_COLORS['CONSTRUCCIÓ'].color],
    ['RECUPERACIÓ', CYCLE_COLORS['RECUPERACIÓ'].color],
    ['PIC',         CYCLE_COLORS['PIC'].color],
    ['COMPETICIÓ',  CYCLE_COLORS['COMPETICIÓ'].color],
  ];
  const legendPhases = [
    ['Acumulació',   PHASE_COLORS['ACUMULACIÓ']],
    ['Extensió',     PHASE_COLORS['EXTENSIÓ']],
    ['Descàrrega',   PHASE_COLORS['DESCÀRREGA']],
    ['Consolidació', PHASE_COLORS['CONSOLIDACIÓ']],
    ['Competició',   PHASE_COLORS['COMPETICIÓ']],
  ];
  const legendCyclesHTML = legendCycles.map(([k,col]) =>
    `<span><span class="legend-dot" style="background:${col}"></span> ${k}</span>`).join('');
  const legendPhasesHTML = legendPhases.map(([k,col]) =>
    `<span><span class="legend-dot legend-dot--phase" style="background:${col}"></span> ${k}</span>`).join('');

  const isoWeeks = buildISOWeeks(planningYear);
  const today    = new Date(); today.setHours(0,0,0,0);

  const weekData = isoWeeks.map((w, i) => {
    const plan    = findPlanningForWeek(w.isoStart, w.isoEnd, planning);
    const planIdx = plan ? planning.indexOf(plan) : -1;
    const isActive = today >= w.isoStart && today <= w.isoEnd;
    return { ...w, plan, planIdx, isActive, isoNum: i + 1 };
  });

  const byMonth = Array.from({ length: 12 }, () => []);
  weekData.forEach(w => { byMonth[isoWeekMonth(w.isoStart)].push(w); });

  let cardsHTML = '';
  for (let m = 0; m < 12; m++) {
    const weeks  = byMonth[m];
    const N      = weeks.length;
    const hasAny = weeks.some(w => w.plan !== null);

    let lblRow = '', cycleRow = '', phaseRow = '';
    weeks.forEach(w => {
      const lbl = w.plan ? w.plan.setmana : `S${w.isoNum}`;
      const tip = escapeAttr(`${fmtDateShortP(w.isoStart)} → ${fmtDateShortP(w.isoEnd)}`);
      lblRow += `<span class="pcy-week-lbl${w.isActive ? ' pcy-week-lbl--active' : ''}" title="${tip}">${escapePlanningText(lbl)}</span>`;
      if (w.plan) {
        const c   = getCycleStyle(w.plan.cicle);
        const ph  = getPhaseColor(w.plan.fase);
        const act = w.isActive ? ' pcy-cell--active' : '';
        cycleRow += `<button type="button" class="pcy-cell${act}" data-week="${w.planIdx}"
          title="${escapeAttr(w.plan.setmana + ' · ' + w.plan.cicle)}"
          style="background:${c.color};outline-color:${c.color}"></button>`;
        phaseRow += `<button type="button" class="pcy-cell pcy-cell--phase${act}" data-week="${w.planIdx}"
          title="${escapeAttr(w.plan.setmana + ' · ' + w.plan.fase)}"
          style="background:${ph};outline-color:${ph}"></button>`;
      } else {
        cycleRow += `<span class="pcy-cell pcy-cell--empty" title="${tip}"></span>`;
        phaseRow += `<span class="pcy-cell pcy-cell--phase pcy-cell--empty" title="${tip}"></span>`;
      }
    });

    const firstPlan  = weeks.find(w => w.plan)?.plan;
    const monthColor = firstPlan ? getCycleStyle(firstPlan.cicle).color : 'var(--border)';
    const emptyClass = hasAny ? '' : ' pcy-month-card--empty';

    cardsHTML +=
      `<div class="pcy-month-card${emptyClass}" style="--month-color:${monthColor}">`
      + `<div class="pcy-month-header">`
      +   `<span class="pcy-month-name">${MONTH_NAMES_LONG[m]}</span>`
      +   `<span class="pcy-month-count">${hasAny ? weeks.filter(w=>w.plan).length + ' set.' : '—'}</span>`
      + `</div>`
      + `<div class="pcy-inner" style="--n-weeks:${N}">`
      +   `<div class="pcy-row pcy-row--lbl">${lblRow}</div>`
      +   `<div class="pcy-row pcy-row--cycle">${cycleRow}</div>`
      +   `<div class="pcy-row pcy-row--phase">${phaseRow}</div>`
      + `</div>`
      + `</div>`;
  }

  container.innerHTML =
    navHTML()
    + '<div class="plan-legend">'
    + '<div class="plan-legend-row"><span class="plan-legend-section">Cicles</span>' + legendCyclesHTML + '</div>'
    + '<div class="plan-legend-row"><span class="plan-legend-section">Fases</span>'  + legendPhasesHTML + '</div>'
    + '</div>'
    + `<div class="pcy-grid">${cardsHTML}</div>`;

  bindNavButtons(planning, sessions);

  container.querySelectorAll('.pcy-cell[data-week]').forEach(el => {
    el.addEventListener('click', () => {
      planningWeekIndex = parseInt(el.dataset.week, 10);
      planningViewLevel = 'weekly';
      renderPlanningLevel(planning, sessions, window.dashboardStore?.getState?.().calendar);
    });
  });

  function navHTML() {
    return '<div class="plan-year-nav">'
      + '<button class="btn btn-ghost btn-sm" id="btn-year-prev">◄</button>'
      + `<span class="plan-year-label">${planningYear}</span>`
      + '<button class="btn btn-ghost btn-sm" id="btn-year-next">►</button>'
      + '</div>';
  }
  function bindNavButtons(pl, sess) {
    document.getElementById('btn-year-prev')?.addEventListener('click', () => {
      planningYear--; renderPlanningLevel(pl, sess, window.dashboardStore?.getState?.().calendar);
    });
    document.getElementById('btn-year-next')?.addEventListener('click', () => {
      planningYear++; renderPlanningLevel(pl, sess, window.dashboardStore?.getState?.().calendar);
    });
  }
}

// ── Vista MENSUAL ───────────────────────────────────────────────────────────────
function renderMonthlyView(container, planning, sessions) {
  const monthNames = ['Gener','Febrer','Març','Abril','Maig','Juny',
                      'Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];

  const monthWeeks = planning.filter(w =>
    (w.startDate.getMonth() === planningMonth && w.startDate.getFullYear() === planningYear) ||
    (w.endDate.getMonth()   === planningMonth && w.endDate.getFullYear()   === planningYear)
  );

  const maxKm = Math.max(...planning.map(w => w.kmTotal || 0), 1);

  let cardsHTML = '';
  if (monthWeeks.length) {
    monthWeeks.forEach(w => {
      const c      = getCycleStyle(w.cicle);
      const pct    = Math.round(((w.kmTotal || 0) / maxKm) * 100);
      const mins   = estimatedMinutes(w);
      const ph     = getPhaseColor(w.fase);
      const idx    = planning.indexOf(w);
      const stats  = getWeekStats(w, sessions);
      const donePct = Math.min(stats.pctTotal, 100);

      const badgeHTML = stats.status === 'future'
        ? '<span class="pwc-badge pwc-badge--future">⏳ Pendent</span>'
        : stats.status === 'active'
        ? '<span class="pwc-badge pwc-badge--active">🔄 ' + stats.pctTotal + '%</span>'
        : stats.pctTotal >= 90
        ? '<span class="pwc-badge pwc-badge--done">✅ ' + stats.pctTotal + '%</span>'
        : '<span class="pwc-badge pwc-badge--partial">⚠️ ' + stats.pctTotal + '%</span>';

      const kmLabel = stats.status !== 'future'
        ? fmtNumP(stats.kmTotal) + ' / ' + fmtNumP(w.kmTotal) + ' km'
        : fmtNumP(w.kmTotal) + ' km pla';

      cardsHTML +=
        '<article class="plan-week-card" data-week="' + idx + '"'
        + ' style="border-top:3px solid ' + c.color + ';background:' + c.bg + '">'
        + '<div class="pwc-header">'
        +   '<div>'
        +     '<p class="pwc-setmana">' + escapePlanningText(w.setmana) + '</p>'
        +     '<p class="pwc-dates">' + fmtDateShortP(w.startDate) + ' → ' + fmtDateShortP(w.endDate) + '</p>'
        +   '</div>'
        +   '<div class="pwc-badges">'
        +     '<span class="pwc-cicle" style="color:' + c.color + '">' + escapePlanningText(w.cicle) + '</span>'
        +     badgeHTML
        +   '</div>'
        + '</div>'
        + '<div class="pwc-bar-wrap">'
        +   '<div class="pwc-bar-fill" style="width:' + pct + '%;background:' + c.color + ';opacity:0.3"></div>'
        +   '<div class="pwc-bar-done" style="width:' + donePct + '%"></div>'
        + '</div>'
        + '<div class="pwc-footer">'
        +   '<span class="pwc-km">' + kmLabel + '</span>'
        +   '<span class="pwc-time">~' + fmtMinutes(mins) + '</span>'
        + '</div>'
        + '<div class="pwc-phase-bar" style="background:' + ph + '">'
        +   '<span>' + escapePlanningText(w.fase) + '</span>'
        + '</div>'
        + '</article>';
    });
  } else {
    cardsHTML = '<p class="plan-no-data">Sense setmanes planificades aquest mes.</p>';
  }

  container.innerHTML =
    '<div class="plan-month-nav">'
    + '<button class="btn btn-ghost btn-sm" id="btn-month-prev">◄</button>'
    + '<span class="plan-month-title">' + monthNames[planningMonth] + ' ' + planningYear + '</span>'
    + '<button class="btn btn-ghost btn-sm" id="btn-month-next">►</button>'
    + '</div>'
    + '<div class="plan-month-cards">' + cardsHTML + '</div>';

  document.getElementById('btn-month-prev')?.addEventListener('click', () => {
    planningMonth--;
    if (planningMonth < 0) { planningMonth = 11; planningYear--; }
    renderPlanningLevel(planning, sessions, window.dashboardStore?.getState?.().calendar);
  });
  document.getElementById('btn-month-next')?.addEventListener('click', () => {
    planningMonth++;
    if (planningMonth > 11) { planningMonth = 0; planningYear++; }
    renderPlanningLevel(planning, sessions, window.dashboardStore?.getState?.().calendar);
  });
  container.querySelectorAll('.plan-week-card[data-week]').forEach(el => {
    el.addEventListener('click', () => {
      planningWeekIndex = parseInt(el.dataset.week, 10);
      planningViewLevel = 'weekly';
      renderPlanningLevel(planning, sessions, window.dashboardStore?.getState?.().calendar);
    });
  });
}

// ── Vista SETMANAL (pla + real) ───────────────────────────────────────────────────
// 5 panells: Qualitat · Z2 · Tirada llarga · Força · Altres (Pàdel...)
function renderWeeklyPlanView(container, planning, sessions) {
  const week = planning[planningWeekIndex];
  if (!week) return;
  const c     = getCycleStyle(week.cicle);
  const stats = getWeekStats(week, sessions);

  const kmBadge = stats.status !== 'future'
    ? ' <span class="pwv-real-val">' + fmtNumP(stats.kmTotal) + ' km fets (' + stats.pctTotal + '%)</span>'
    : '';

  // ── Reals per panell ────────────────────────────────────────────────────────
  const qReal = week.qKm > 0 && stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Real</span><strong>' + fmtNumP(stats.kmQuality) + ' km (' + (stats.pctQuality || 0) + '%)</strong></li>'
    : '';
  const z2Real = week.z2Km > 0 && stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Real</span><strong>' + fmtNumP(stats.kmZ2) + ' km (' + (stats.pctZ2 || 0) + '%)</strong></li>'
    : '';
  const llReal = week.llKm > 0 && stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Real</span><strong>' + fmtNumP(stats.kmLong) + ' km (' + (stats.pctLong || 0) + '%)</strong></li>'
    : '';

  // Força real: nº de sessions de força fetes
  const strengthReal = stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Fet</span><strong>'
      + (stats.strengthCount > 0 ? '✅ ' + stats.strengthCount + ' sess.' : '—')
      + '</strong></li>'
    : '';

  // Altres real: pàdel + tennis
  const altresReal = stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Pàdel fet</span><strong>'
      + (stats.padelCount > 0 ? '✅ ' + stats.padelCount + ' part.' : '—')
      + '</strong></li>'
    : '';

  // Ritmes formatats des dels camps enriquits (tipus number, no string)
  const qRitmePla  = formatPace(week.qRitme);
  const z2RitmePla = formatPace(week.z2RitmeMin, '') + '–' + formatPace(week.z2RitmeMax);

  container.innerHTML =
    '<div class="plan-week-nav">'
    + '<button class="btn btn-ghost btn-sm" id="btn-wplan-prev"' + (planningWeekIndex === 0 ? ' disabled' : '') + '>◄ Anterior</button>'
    + '<div class="plan-week-nav-center">'
    +   '<span class="plan-week-nav-label" style="color:' + c.color + '">' + escapePlanningText(week.setmana) + '</span>'
    +   '<span class="badge-muted plan-week-counter">' + (planningWeekIndex + 1) + ' / ' + planning.length + '</span>'
    + '</div>'
    + '<button class="btn btn-ghost btn-sm" id="btn-wplan-next"' + (planningWeekIndex === planning.length - 1 ? ' disabled' : '') + '>Següent ►</button>'
    + '</div>'

    + '<div class="panel" style="border-top:3px solid ' + c.color + '">'
    +   '<div class="pwv-header">'
    +     '<div>'
    +       '<p class="eyebrow">' + escapePlanningText(week.cicle) + ' · ' + escapePlanningText(week.fase) + '</p>'
    +       '<h3>' + escapePlanningText(week.setmana) + '</h3>'
    +       '<p class="card-note">' + fmtDateP(week.startDate) + ' → ' + fmtDateP(week.endDate) + '</p>'
    +     '</div>'
    +     '<div class="pwv-km-total">'
    +       '<p class="card-label">Km totals pla</p>'
    +       '<p class="hero-value">' + fmtNumP(week.kmTotal) + ' km</p>'
    +       kmBadge
    +     '</div>'
    +   '</div>'
    + '</div>'

    // ── 5 panells ──────────────────────────────────────────────────────────────────
    + '<div class="pwv-grid">'

    // 1 · Qualitat
    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🎯 Qualitat</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Sèries</span><strong>' + (isFinite(week.qSeries) ? week.qSeries : '--') + '</strong></li>'
    +     '<li><span>Durada sèrie</span><strong>' + (isFinite(week.qDuradaSerie) ? week.qDuradaSerie + ' min' : '--') + '</strong></li>'
    +     '<li><span>Ritme</span><strong>' + qRitmePla + '</strong></li>'
    +     '<li><span>Recuperació</span><strong>' + (isFinite(week.qRec) ? week.qRec + ' min' : '--') + '</strong></li>'
    +     '<li><span>FC</span><strong>' + formatFCRangeP(week.qFcMin, week.qFcMax) + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.qKm) + ' km</strong></li>'
    +     qReal
    +   '</ul>'
    + '</article>'

    // 2 · Z2
    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🫀 Z2</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Durada</span><strong>' + fmtNumP(week.z2Durada) + ' min</strong></li>'
    +     '<li><span>Ritme</span><strong>' + z2RitmePla + '</strong></li>'
    +     '<li><span>FC</span><strong>' + formatFCRangeP(week.z2FcMin, week.z2FcMax) + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.z2Km) + ' km</strong></li>'
    +     z2Real
    +   '</ul>'
    + '</article>'

    // 3 · Tirada llarga
    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🏃 Tirada llarga</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Tipus</span><strong>' + escapePlanningText(week.llTipus) + '</strong></li>'
    +     '<li><span>Durada</span><strong>' + (isFinite(week.llDurada) ? fmtNumP(week.llDurada) + ' min' : '--') + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.llKm) + ' km</strong></li>'
    +     llReal
    +   '</ul>'
    + '</article>'

    // 4 · Força  (només força, sense pàdel)
    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">💪 Força</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Pla</span><strong>' + escapePlanningText(week.forcaPlan) + '</strong></li>'
    +     strengthReal
    +   '</ul>'
    + '</article>'

    // 5 · Altres  (pàdel, tennis i futurs esports)
    + '<article class="panel pwv-block pwv-block--wide">'
    +   '<p class="eyebrow">🎾 Altres</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Pàdel pla</span><strong>' + escapePlanningText(week.padelPlan) + '</strong></li>'
    +     altresReal
    +   '</ul>'
    + '</article>'

    + '</div>';

  document.getElementById('btn-wplan-prev')?.addEventListener('click', () => {
    if (planningWeekIndex > 0) { planningWeekIndex--; renderPlanningLevel(planning, sessions, window.dashboardStore?.getState?.().calendar); }
  });
  document.getElementById('btn-wplan-next')?.addEventListener('click', () => {
    if (planningWeekIndex < planning.length - 1) { planningWeekIndex++; renderPlanningLevel(planning, sessions, window.dashboardStore?.getState?.().calendar); }
  });
}

// ── Stats per setmana (JOIN planning ↔ sessions) ──────────────────────────────────
function getWeekStats(week, sessions) {
  const ws = sessions.filter(s => s.date >= week.startDate && s.date <= week.endDate);

  const kmTotal    = ws.reduce((acc, s) => acc + (s.distancia || 0), 0);
  const kmQuality  = ws.filter(s => ['TEMPO','TEST','INTERVALS'].includes(s.tipusKey))
                       .reduce((acc, s) => acc + (s.distancia || 0), 0);
  const kmZ2       = ws.filter(s => s.tipusKey === 'Z2')
                       .reduce((acc, s) => acc + (s.distancia || 0), 0);
  const kmLong     = ws.filter(s => ['LLARGA','MARÀTÓ','TRAIL','MITJA','MARATO'].includes(s.tipusKey))
                       .reduce((acc, s) => acc + (s.distancia || 0), 0);

  // Força: sessions que comencen per FORÇA/FORCA
  const strengthSess  = ws.filter(s => s.tipusKey.startsWith('FORÇA') || s.tipusKey.startsWith('FORCA'));
  const hasStrength   = strengthSess.length > 0;
  const strengthCount = strengthSess.length;

  // Altres: pàdel + tennis (comptem partides, no km)
  const padelSess  = ws.filter(s => ['PADEL','TENIS','TENNIS'].includes(s.tipusKey));
  const hasPadel   = padelSess.length > 0;
  const padelCount = padelSess.length;

  const pctTotal   = week.kmTotal > 0 ? Math.round((kmTotal   / week.kmTotal) * 100) : 0;
  const pctQuality = week.qKm     > 0 ? Math.round((kmQuality / week.qKm)     * 100) : null;
  const pctZ2      = week.z2Km    > 0 ? Math.round((kmZ2      / week.z2Km)    * 100) : null;
  const pctLong    = week.llKm    > 0 ? Math.round((kmLong    / week.llKm)    * 100) : null;

  const today  = new Date(); today.setHours(0,0,0,0);
  const start  = new Date(week.startDate); start.setHours(0,0,0,0);
  const end    = new Date(week.endDate);   end.setHours(23,59,59,999);
  const status = today < start ? 'future' : today > end ? 'done' : 'active';

  return { ws, kmTotal, kmQuality, kmZ2, kmLong,
           hasStrength, strengthCount,
           hasPadel, padelCount,
           pctTotal, pctQuality, pctZ2, pctLong, status };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCycleStyle(cicle) {
  return CYCLE_COLORS[String(cicle || '').toUpperCase().trim()] || CYCLE_DEFAULT;
}
function getPhaseColor(fase) {
  return PHASE_COLORS[String(fase || '').toUpperCase().trim()] || PHASE_DEFAULT;
}
function formatFCRangeP(min, max) {
  if (!min && !max) return '--';
  if (min && max)   return min + '–' + max + ' bpm';
  return (min || max) + ' bpm';
}
function estimatedMinutes(w) {
  // Tots els valors ja són number (toNumber), no calen parseFloat
  const z2 = w.z2Durada   || 0;
  const q  = (w.qSeries   || 0) * ((w.qDuradaSerie || 0) + (w.qRec || 0));
  const ll = w.llDurada   || 0;
  return Math.round(z2 + q + ll);
}
function fmtMinutes(mins) {
  if (!mins) return '--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (h + 'h' + (m > 0 ? ' ' + m + 'min' : '')) : (m + ' min');
}
function fmtNumP(value) {
  const n = parseFloat(value);
  if (!isFinite(n)) return '--';
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(n);
}
function fmtDateP(date) {
  if (!date) return '--';
  return new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'long' }).format(date);
}
function fmtDateShortP(date) {
  if (!date) return '--';
  const d = date.getDate();
  const m = ['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'][date.getMonth()];
  return d + ' ' + m;
}
function escapeAttr(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
