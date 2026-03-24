// docs/js/views/planning.js

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

function renderPlanningView(planning) {
  if (!planning.length) return;
  const today  = new Date();
  const active = planning.find(w => today >= w.startDate && today <= w.endDate)
               || planning[planning.length - 1];
  if (active) {
    planningMonth     = active.startDate.getMonth();
    planningYear      = active.startDate.getFullYear();
    planningWeekIndex = planning.indexOf(active);
  }
  initPlanningNav(planning);
  renderPlanningLevel(planning);
}

function initPlanningNav(planning) {
  ['btn-plan-yearly', 'btn-plan-monthly'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.getElementById('btn-plan-yearly')?.addEventListener('click', () => {
    planningViewLevel = 'yearly'; renderPlanningLevel(planning);
  });
  document.getElementById('btn-plan-monthly')?.addEventListener('click', () => {
    planningViewLevel = 'monthly'; renderPlanningLevel(planning);
  });
}

function renderPlanningLevel(planning) {
  updateLevelButtons();
  const container = document.getElementById('planning-view-container');
  if (!container) return;
  if (planningViewLevel === 'yearly')  renderYearlyView(container, planning);
  if (planningViewLevel === 'monthly') renderMonthlyView(container, planning);
  if (planningViewLevel === 'weekly')  renderWeeklyPlanView(container, planning);
}

function updateLevelButtons() {
  document.getElementById('btn-plan-yearly') ?.classList.toggle('active', planningViewLevel === 'yearly');
  document.getElementById('btn-plan-monthly')?.classList.toggle('active', planningViewLevel === 'monthly');
}

// ── Vista ANUAL ───────────────────────────────────────────────────────────────
function renderYearlyView(container, planning) {
  const yearPlanning = planning.filter(w =>
    w.startDate.getFullYear() === planningYear ||
    w.endDate.getFullYear()   === planningYear
  );

  const byMonth = {};
  yearPlanning.forEach(w => {
    const m = w.startDate.getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(w);
  });

  const monthNames = ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'];
  const maxKm = Math.max(...planning.map(w => w.kmTotal || 0), 1);

  const legendCycles = [
    ['BASE',         CYCLE_COLORS['BASE'].color],
    ['CONSTRUCCIÓ',  CYCLE_COLORS['CONSTRUCCIÓ'].color],
    ['RECUPERACIÓ',  CYCLE_COLORS['RECUPERACIÓ'].color],
    ['PIC',          CYCLE_COLORS['PIC'].color],
    ['COMPETICIÓ',   CYCLE_COLORS['COMPETICIÓ'].color],
  ];
  const legendPhases = [
    ['Acumulació',   PHASE_COLORS['ACUMULACIÓ']],
    ['Extensió',     PHASE_COLORS['EXTENSIÓ']],
    ['Descàrrega',   PHASE_COLORS['DESCÀRREGA']],
    ['Consolidació', PHASE_COLORS['CONSOLIDACIÓ']],
  ];

  // Construïm el HTML de les barres mes a mes
  let weeksHTML = '';
  monthNames.forEach((name, m) => {
    const weeks = byMonth[m] || [];
    let barsHTML = '';
    weeks.forEach(w => {
      const c   = getCycleStyle(w.cicle);
      const pct = Math.round(((w.kmTotal || 0) / maxKm) * 100);
      const ph  = getPhaseColor(w.fase);
      const idx = planning.indexOf(w);
      barsHTML += '<div class="plan-week-bar" style="border-color:' + c.color + '"'
               +  ' data-week="' + idx + '"'
               +  ' title="' + w.setmana + ' · ' + w.cicle + ' · ' + w.fase + ' · ' + fmtNumP(w.kmTotal) + ' km">'
               +  '<div class="plan-week-fill" style="width:' + pct + '%;background:' + c.color + '"></div>'
               +  '<span class="plan-week-name">' + w.setmana + '</span>'
               +  '<span class="plan-week-phase-sq" style="background:' + ph + '" title="' + w.fase + '"></span>'
               +  '</div>';
    });

    weeksHTML += '<div class="plan-month-col" data-month="' + m + '">'
              +  '<p class="plan-month-name">' + name + '</p>'
              +  '<div class="plan-month-weeks">'
              +  (barsHTML || '<p class="plan-no-data">—</p>')
              +  '</div></div>';
  });

  // Llegenda en dues files
  let legendCyclesHTML = '';
  legendCycles.forEach(function(item) {
    legendCyclesHTML += '<span class="legend-dot" style="background:' + item[1] + '"></span>'
                     +  '<span>' + capitalize(item[0]) + '</span>';
  });
  let legendPhasesHTML = '';
  legendPhases.forEach(function(item) {
    legendPhasesHTML += '<span class="legend-dot legend-dot--phase" style="background:' + item[1] + '"></span>'
                     +  '<span>' + item[0] + '</span>';
  });

  container.innerHTML =
    '<div class="plan-year-nav">'
    + '<button class="btn btn-ghost btn-sm" id="btn-year-prev">◄</button>'
    + '<span class="plan-year-label">' + planningYear + '</span>'
    + '<button class="btn btn-ghost btn-sm" id="btn-year-next">►</button>'
    + '</div>'
    + '<div class="plan-legend">'
    + '<div class="plan-legend-row"><span class="plan-legend-section">Cicles:</span>' + legendCyclesHTML + '</div>'
    + '<div class="plan-legend-row"><span class="plan-legend-section">Fases:</span>'  + legendPhasesHTML + '</div>'
    + '</div>'
    + '<div class="plan-year-grid">' + weeksHTML + '</div>';

  document.getElementById('btn-year-prev')?.addEventListener('click', () => {
    planningYear--; renderPlanningLevel(planning);
  });
  document.getElementById('btn-year-next')?.addEventListener('click', () => {
    planningYear++; renderPlanningLevel(planning);
  });
  container.querySelectorAll('.plan-week-bar[data-week]').forEach(el => {
    el.addEventListener('click', () => {
      planningWeekIndex = parseInt(el.dataset.week);
      planningViewLevel = 'weekly';
      renderPlanningLevel(planning);
    });
  });
  container.querySelectorAll('.plan-month-col[data-month]').forEach(el => {
    el.querySelector('.plan-month-name')?.addEventListener('click', () => {
      planningMonth     = parseInt(el.dataset.month);
      planningViewLevel = 'monthly';
      renderPlanningLevel(planning);
    });
  });
}

// ── Vista MENSUAL ─────────────────────────────────────────────────────────────
function renderMonthlyView(container, planning) {
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
      const c    = getCycleStyle(w.cicle);
      const pct  = Math.round(((w.kmTotal || 0) / maxKm) * 100);
      const mins = estimatedMinutes(w);
      const ph   = getPhaseColor(w.fase);
      const idx  = planning.indexOf(w);
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
        +   '</div>'
        + '</div>'
        + '<div class="pwc-bar-wrap">'
        +   '<div class="pwc-bar-fill" style="width:' + pct + '%;background:' + c.color + '"></div>'
        + '</div>'
        + '<div class="pwc-footer">'
        +   '<span class="pwc-km">' + fmtNumP(w.kmTotal) + ' km</span>'
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
    renderPlanningLevel(planning);
  });
  document.getElementById('btn-month-next')?.addEventListener('click', () => {
    planningMonth++;
    if (planningMonth > 11) { planningMonth = 0; planningYear++; }
    renderPlanningLevel(planning);
  });
  container.querySelectorAll('.plan-week-card[data-week]').forEach(el => {
    el.addEventListener('click', () => {
      planningWeekIndex = parseInt(el.dataset.week);
      planningViewLevel = 'weekly';
      renderPlanningLevel(planning);
    });
  });
}

// ── Vista SETMANAL (només pla) ────────────────────────────────────────────────
function renderWeeklyPlanView(container, planning) {
  const week = planning[planningWeekIndex];
  if (!week) return;
  const c = getCycleStyle(week.cicle);

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
    +       '<p class="card-label">Km totals</p>'
    +       '<p class="hero-value">' + fmtNumP(week.kmTotal) + ' km</p>'
    +     '</div>'
    +   '</div>'
    + '</div>'

    + '<div class="pwv-grid">'

    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🎯 Qualitat</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Sèries</span><strong>' + (week.qSeries || '--') + '</strong></li>'
    +     '<li><span>Ritme</span><strong>' + (week.raw['Q_Ritme_min_km'] || '--') + ' min/km</strong></li>'
    +     '<li><span>Recuperació</span><strong>' + (week.raw['Q_Rec_min'] || '--') + ' min</strong></li>'
    +     '<li><span>FC</span><strong>' + formatFCRangeP(week.raw['Q_FC_min'], week.raw['Q_FC_max']) + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.qKm) + ' km</strong></li>'
    +   '</ul>'
    + '</article>'

    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🫁 Z2</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Durada</span><strong>' + fmtNumP(week.z2Durada) + ' min</strong></li>'
    +     '<li><span>Ritme</span><strong>' + week.z2PaceMin + '–' + week.z2PaceMax + ' min/km</strong></li>'
    +     '<li><span>FC</span><strong>' + formatFCRangeP(week.raw['Z2_FC_min'], week.raw['Z2_FC_max']) + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.raw['Z2_Km_Plan']) + ' km</strong></li>'
    +   '</ul>'
    + '</article>'

    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">🏃 Tirada llarga</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Tipus</span><strong>' + (week.llTipus || '--') + '</strong></li>'
    +     '<li><span>Durada</span><strong>' + (week.raw['LL_Durada_min'] ? fmtNumP(week.raw['LL_Durada_min']) + ' min' : '--') + '</strong></li>'
    +     '<li><span>Km pla</span><strong>' + fmtNumP(week.llKm) + ' km</strong></li>'
    +   '</ul>'
    + '</article>'

    + '<article class="panel pwv-block">'
    +   '<p class="eyebrow">💪 Força / Pàdel</p>'
    +   '<ul class="sw-plan-list" style="margin-top:12px">'
    +     '<li><span>Força</span><strong>' + (week.forcaPlan || '--') + '</strong></li>'
    +     '<li><span>Pàdel</span><strong>' + (week.padelPlan || '--') + '</strong></li>'
    +   '</ul>'
    + '</article>'

    + '</div>';

  document.getElementById('btn-wplan-prev')?.addEventListener('click', () => {
    if (planningWeekIndex > 0) { planningWeekIndex--; renderPlanningLevel(planning); }
  });
  document.getElementById('btn-wplan-next')?.addEventListener('click', () => {
    if (planningWeekIndex < planning.length - 1) { planningWeekIndex++; renderPlanningLevel(planning); }
  });
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
