// docs/js/views/planning.js
// Dep: app.js (formatPace)

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

let planningViewLevel = 'monthly';
let planningYear      = new Date().getFullYear();
let planningMonth     = new Date().getMonth();
let planningWeekIndex = 0;

// ── Punt d'entrada ────────────────────────────────────────────────────────────
function renderPlanningView(planning, sessions) {
  if (!planning.length) return;
  const today  = new Date();
  const active = planning.find(w => today >= w.startDate && today <= w.endDate)
               || planning[planning.length - 1];
  if (active) {
    planningMonth     = active.startDate.getMonth();
    planningYear      = active.startDate.getFullYear();
    planningWeekIndex = planning.indexOf(active);
  }
  initPlanningNav(planning, sessions);
  renderPlanningLevel(planning, sessions);
}

// ── Navegació de nivells ──────────────────────────────────────────────────────
function initPlanningNav(planning, sessions) {
  ['btn-plan-yearly', 'btn-plan-monthly'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
  });
  document.getElementById('btn-plan-yearly')?.addEventListener('click', () => {
    planningViewLevel = 'yearly'; renderPlanningLevel(planning, sessions);
  });
  document.getElementById('btn-plan-monthly')?.addEventListener('click', () => {
    planningViewLevel = 'monthly'; renderPlanningLevel(planning, sessions);
  });
}

function renderPlanningLevel(planning, sessions) {
  updateLevelButtons();
  const container = document.getElementById('planning-view-container');
  if (!container) return;
  if (planningViewLevel === 'yearly')  renderYearlyView(container, planning, sessions);
  if (planningViewLevel === 'monthly') renderMonthlyView(container, planning, sessions);
  if (planningViewLevel === 'weekly')  renderWeeklyPlanView(container, planning, sessions);
}

function updateLevelButtons() {
  document.getElementById('btn-plan-yearly') ?.classList.toggle('active', planningViewLevel === 'yearly');
  document.getElementById('btn-plan-monthly')?.classList.toggle('active', planningViewLevel === 'monthly');
}

// ── Vista ANUAL — timeline de temporada ──────────────────────────────────────
// Dues línies fixes: Cicle (dalt) i Fase (baix), una cel·la per setmana.
// Clic a qualsevol cel·la obre la vista setmanal corresponent.
function renderYearlyView(container, planning, sessions) {
  const yearPlanning = planning
    .filter(w =>
      w.startDate.getFullYear() === planningYear ||
      w.endDate.getFullYear()   === planningYear
    )
    .sort((a, b) => a.startDate - b.startDate);

  const monthNames = ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'];

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

  // Agrupa setmanes per mes per construir la capçalera de mesos
  const monthGroups = [];
  yearPlanning.forEach(w => {
    const m = w.startDate.getMonth();
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.month !== m) monthGroups.push({ month: m, count: 0 });
    monthGroups[monthGroups.length - 1].count++;
  });

  const totalWeeks = Math.max(yearPlanning.length, 1);

  const monthHeaderHTML = monthGroups.map(g =>
    `<div class="plan-season-month" style="grid-column:span ${g.count}">${monthNames[g.month]}</div>`
  ).join('');

  const today = new Date(); today.setHours(0,0,0,0);

  const cycleCellsHTML = yearPlanning.map(w => {
    const c   = getCycleStyle(w.cicle);
    const idx = planning.indexOf(w);
    const isActive = today >= w.startDate && today <= w.endDate;
    const tip = escapeAttr(`${w.setmana} · ${w.cicle} · ${fmtDateShortP(w.startDate)}→${fmtDateShortP(w.endDate)}`);
    return `<button type="button" class="plan-season-cell${isActive ? ' plan-season-cell--active' : ''}"
      data-week="${idx}" title="${tip}"
      style="--cell-color:${c.color};--cell-bg:${c.bg};"></button>`;
  }).join('');

  const phaseCellsHTML = yearPlanning.map(w => {
    const ph  = getPhaseColor(w.fase);
    const idx = planning.indexOf(w);
    const isActive = today >= w.startDate && today <= w.endDate;
    const tip = escapeAttr(`${w.setmana} · ${w.fase} · ${fmtDateShortP(w.startDate)}→${fmtDateShortP(w.endDate)}`);
    return `<button type="button" class="plan-season-cell plan-season-cell--phase${isActive ? ' plan-season-cell--active' : ''}"
      data-week="${idx}" title="${tip}"
      style="--cell-color:${ph};--cell-bg:${ph}22;"></button>`;
  }).join('');

  const weekLabelsHTML = yearPlanning.map((w, i) =>
    `<span class="plan-season-week" title="${escapeAttr(w.setmana)}">S${i + 1}</span>`
  ).join('');

  const legendCyclesHTML = legendCycles.map(([k, col]) =>
    `<span><span class="legend-dot" style="background:${col}"></span> ${k}</span>`
  ).join('');
  const legendPhasesHTML = legendPhases.map(([k, col]) =>
    `<span><span class="legend-dot legend-dot--phase" style="background:${col}"></span> ${k}</span>`
  ).join('');

  container.innerHTML =
    '<div class="plan-year-nav">'
    + '<button class="btn btn-ghost btn-sm" id="btn-year-prev">◄</button>'
    + '<span class="plan-year-label">' + planningYear + '</span>'
    + '<button class="btn btn-ghost btn-sm" id="btn-year-next">►</button>'
    + '</div>'

    + '<div class="plan-legend">'
    + '<div class="plan-legend-row"><span class="plan-legend-section">Cicles</span>' + legendCyclesHTML + '</div>'
    + '<div class="plan-legend-row"><span class="plan-legend-section">Fases</span>'  + legendPhasesHTML + '</div>'
    + '</div>'

    + (yearPlanning.length
      ? '<div class="plan-season-board" style="--season-cols:' + totalWeeks + '">'
        + '<div class="plan-season-months">' + monthHeaderHTML + '</div>'
        + '<div class="plan-season-row">'
        +   '<div class="plan-season-label">Cicle</div>'
        +   '<div class="plan-season-track">' + cycleCellsHTML + '</div>'
        + '</div>'
        + '<div class="plan-season-row">'
        +   '<div class="plan-season-label">Fase</div>'
        +   '<div class="plan-season-track">' + phaseCellsHTML + '</div>'
        + '</div>'
        + '<div class="plan-season-row plan-season-row--weeks">'
        +   '<div class="plan-season-label">Setm.</div>'
        +   '<div class="plan-season-weeks">' + weekLabelsHTML + '</div>'
        + '</div>'
        + '</div>'
      : '<p class="plan-no-data">Sense setmanes planificades aquest any.</p>');

  document.getElementById('btn-year-prev')?.addEventListener('click', () => {
    planningYear--; renderPlanningLevel(planning, sessions);
  });
  document.getElementById('btn-year-next')?.addEventListener('click', () => {
    planningYear++; renderPlanningLevel(planning, sessions);
  });
  container.querySelectorAll('.plan-season-cell[data-week]').forEach(el => {
    el.addEventListener('click', () => {
      planningWeekIndex = parseInt(el.dataset.week, 10);
      planningViewLevel = 'weekly';
      renderPlanningLevel(planning, sessions);
    });
  });
}

// ── Vista MENSUAL ─────────────────────────────────────────────────────────────
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
        +     '<p class="pwc-setmana">' + w.setmana + '</p>'
        +     '<p class="pwc-dates">' + fmtDateShortP(w.startDate) + ' → ' + fmtDateShortP(w.endDate) + '</p>'
        +   '</div>'
        +   '<div class="pwc-badges">'
        +     '<span class="pwc-cicle" style="color:' + c.color + '">' + w.cicle + '</span>'
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
        +   '<span>' + w.fase + '</span>'
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
    renderPlanningLevel(planning, sessions);
  });
  document.getElementById('btn-month-next')?.addEventListener('click', () => {
    planningMonth++;
    if (planningMonth > 11) { planningMonth = 0; planningYear++; }
    renderPlanningLevel(planning, sessions);
  });
  container.querySelectorAll('.plan-week-card[data-week]').forEach(el => {
    el.addEventListener('click', () => {
      planningWeekIndex = parseInt(el.dataset.week, 10);
      planningViewLevel = 'weekly';
      renderPlanningLevel(planning, sessions);
    });
  });
}

// ── Vista SETMANAL (pla + real) ───────────────────────────────────────────────
function renderWeeklyPlanView(container, planning, sessions) {
  const week = planning[planningWeekIndex];
  if (!week) return;
  const c     = getCycleStyle(week.cicle);
  const stats = getWeekStats(week, sessions);

  const kmBadge = stats.status !== 'future'
    ? ' <span class="pwv-real-val">' + fmtNumP(stats.kmTotal) + ' km fets (' + stats.pctTotal + '%)</span>'
    : '';

  const qReal = week.qKm > 0 && stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Real</span><strong>' + fmtNumP(stats.kmQuality) + ' km (' + (stats.pctQuality || 0) + '%)</strong></li>'
    : '';
  const z2Real = parseFloat(week.raw['Z2_Km_Plan']) > 0 && stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Real</span><strong>' + fmtNumP(stats.kmZ2) + ' km (' + (stats.pctZ2 || 0) + '%)</strong></li>'
    : '';
  const llReal = week.llKm > 0 && stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Real</span><strong>' + fmtNumP(stats.kmLong) + ' km (' + (stats.pctLong || 0) + '%)</strong></li>'
    : '';
  const extraReal = stats.status !== 'future'
    ? '<li class="sw-plan-real"><span>Força</span><strong>' + (stats.hasStrength ? '✅' : '—') + '</strong></li>'
    + '<li class="sw-plan-real"><span>Pàdel</span><strong>' + (stats.hasPadel ? '✅' : '—') + '</strong></li>'
    : '';

  const qRitmePla  = formatPace(week.raw['Q_Ritme_min_km']);
  const z2RitmePla = formatPace(week.raw['Z2_Ritme_min_km_min'], '') + '–' + formatPace(week.raw['Z2_Ritme_min_km_max']);

  container.innerHTML =
    '<div class="plan-week-nav">'
    + '<button class="btn btn-ghost btn-sm" id="btn-wplan-prev"' + (planningWeekIndex === 0 ? ' disabled' : '') + '>◄ Anterior</button>'
    + '<div class="plan-week-nav-center">'
    +   '<span class="plan-week-nav-label" style="color:' + c.color + '">' + week.setmana + '</span>'
    +   '<span class="badge-muted plan-week-counter">' + (planningWeekIndex + 1) + ' / ' + planning.length + '</span>'
    + '</div>'
    + '<button class="btn btn-ghost btn-sm" id="btn-wplan-next"' + (planningWeekIndex === planning.length - 1 ? ' disabled' : '') + '>Següent ►</button>'
    + '</div>'

    + '<div class="panel" style="border-top:3px solid ' + c.color + '">'
    +   '<div class="pwv-header">'
    +     '<div>'
    +       '<p class="eyebrow">' + week.cicle + ' · ' + week.fase + '</p>'
    +       '<h3>' + week.setmana + '</h3>'
    +       '<p class="card-note">' + fmtDateP(week.startDate) + ' → ' + fmtDateP(week.endDate) + '</p>'
    +     '</div>'
    +     '<div class="pwv-km-total">'
    +       '<p class="card-label">Km totals pla</p>'
    +       '<p class="hero-value">' + fmtNumP(week.kmTotal) + ' km</p>'
    +       kmBadge
    +     '</div>'
    +   '</div>'
    + '</div>'

    + '<div class="pwv-grid">'

    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🎯 Qualitat</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Sèries</span><strong>' + (week.qSeries || '--') + '</strong></li>'
    +     '<li><span>Ritme</span><strong>' + qRitmePla + '</strong></li>'
    +     '<li><span>Recuperació</span><strong>' + (week.raw['Q_Rec_min'] || '--') + ' min</strong></li>'
    +     '<li><span>FC</span><strong>' + formatFCRangeP(week.raw['Q_FC_min'], week.raw['Q_FC_max']) + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.qKm) + ' km</strong></li>'
    +     qReal
    +   '</ul>'
    + '</article>'

    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🫁 Z2</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Durada</span><strong>' + fmtNumP(week.z2Durada) + ' min</strong></li>'
    +     '<li><span>Ritme</span><strong>' + z2RitmePla + '</strong></li>'
    +     '<li><span>FC</span><strong>' + formatFCRangeP(week.raw['Z2_FC_min'], week.raw['Z2_FC_max']) + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.raw['Z2_Km_Plan']) + ' km</strong></li>'
    +     z2Real
    +   '</ul>'
    + '</article>'

    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🏃 Tirada llarga</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Tipus</span><strong>' + (week.llTipus || '--') + '</strong></li>'
    +     '<li><span>Durada</span><strong>' + (week.raw['LL_Durada_min'] ? fmtNumP(week.raw['LL_Durada_min']) + ' min' : '--') + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.llKm) + ' km</strong></li>'
    +     llReal
    +   '</ul>'
    + '</article>'

    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">💪 Força / Pàdel</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Força</span><strong>' + (week.forcaPlan || '--') + '</strong></li>'
    +     '<li><span>Pàdel</span><strong>' + (week.padelPlan || '--') + '</strong></li>'
    +     extraReal
    +   '</ul>'
    + '</article>'

    + '</div>';

  document.getElementById('btn-wplan-prev')?.addEventListener('click', () => {
    if (planningWeekIndex > 0) { planningWeekIndex--; renderPlanningLevel(planning, sessions); }
  });
  document.getElementById('btn-wplan-next')?.addEventListener('click', () => {
    if (planningWeekIndex < planning.length - 1) { planningWeekIndex++; renderPlanningLevel(planning, sessions); }
  });
}

// ── Stats per setmana (JOIN planning ↔ sessions) ──────────────────────────────
function getWeekStats(week, sessions) {
  const ws = sessions.filter(s => s.date >= week.startDate && s.date <= week.endDate);

  const kmTotal    = ws.reduce((acc, s) => acc + (s.distancia || 0), 0);
  const kmQuality  = ws.filter(s => ['TEMPO','TEST','INTERVALS'].includes(s.tipusKey))
                       .reduce((acc, s) => acc + (s.distancia || 0), 0);
  const kmZ2       = ws.filter(s => s.tipusKey === 'Z2')
                       .reduce((acc, s) => acc + (s.distancia || 0), 0);
  const kmLong     = ws.filter(s => ['LLARGA','MARATÓ','TRAIL','MITJA','MARATO'].includes(s.tipusKey))
                       .reduce((acc, s) => acc + (s.distancia || 0), 0);
  const hasStrength = ws.some(s => s.tipusKey.startsWith('FORÇA') || s.tipusKey.startsWith('FORCA'));
  const hasPadel    = ws.some(s => ['PADEL','TENIS','TENNIS'].includes(s.tipusKey));

  const pctTotal   = week.kmTotal > 0 ? Math.round((kmTotal   / week.kmTotal) * 100) : 0;
  const pctQuality = week.qKm     > 0 ? Math.round((kmQuality / week.qKm)     * 100) : null;
  const pctZ2      = parseFloat(week.raw['Z2_Km_Plan']) > 0
                   ? Math.round((kmZ2  / parseFloat(week.raw['Z2_Km_Plan']))   * 100) : null;
  const pctLong    = week.llKm    > 0 ? Math.round((kmLong    / week.llKm)    * 100) : null;

  const today  = new Date(); today.setHours(0,0,0,0);
  const start  = new Date(week.startDate); start.setHours(0,0,0,0);
  const end    = new Date(week.endDate);   end.setHours(23,59,59,999);
  const status = today < start ? 'future' : today > end ? 'done' : 'active';

  return { ws, kmTotal, kmQuality, kmZ2, kmLong,
           hasStrength, hasPadel,
           pctTotal, pctQuality, pctZ2, pctLong, status };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCycleStyle(cicle) {
  return CYCLE_COLORS[String(cicle || '').toUpperCase().trim()] || CYCLE_DEFAULT;
}
function getPhaseColor(fase) {
  return PHASE_COLORS[String(fase || '').toUpperCase().trim()] || PHASE_DEFAULT;
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
function formatFCRangeP(min, max) {
  if (!min && !max) return '--';
  if (min && max)   return min + '–' + max + ' bpm';
  return (min || max) + ' bpm';
}
function estimatedMinutes(w) {
  const z2 = parseFloat(w.z2Durada) || 0;
  const q  = (parseFloat(w.qSeries) || 0)
           * ((parseFloat(w.raw['Q_Durada_Serie_min']) || 0)
            + (parseFloat(w.raw['Q_Rec_min'])          || 0));
  const ll = parseFloat(w.raw['LL_Durada_min']) || 0;
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
