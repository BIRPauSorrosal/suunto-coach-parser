// views/planning.js — Vista Planning: anual, mensual, setmanal

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

let planningViewLevel  = 'monthly'; // 'yearly' | 'monthly' | 'weekly'
let planningYear       = new Date().getFullYear();
let planningMonth      = new Date().getMonth(); // 0-based
let planningWeekIndex  = 0;

// ── Punt d'entrada ────────────────────────────────────────────────────────────
function renderPlanningView(planning) {
  if (!planning.length) return;

  // Situa el mes actiu a la setmana del planning més recent
  const today = new Date();
  const active = planning.find(w => today >= w.startDate && today <= w.endDate)
               || planning[planning.length - 1];
  if (active) {
    planningMonth = active.startDate.getMonth();
    planningYear  = active.startDate.getFullYear();
    planningWeekIndex = planning.indexOf(active);
  }

  initPlanningNav(planning);
  renderPlanningLevel(planning);
}

// ── Navegació de nivells ──────────────────────────────────────────────────────
function initPlanningNav(planning) {
  ['btn-plan-yearly', 'btn-plan-monthly'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
  });

  document.getElementById('btn-plan-yearly')?.addEventListener('click', () => {
    planningViewLevel = 'yearly';
    renderPlanningLevel(planning);
  });
  document.getElementById('btn-plan-monthly')?.addEventListener('click', () => {
    planningViewLevel = 'monthly';
    renderPlanningLevel(planning);
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

  // Agrupa per mes
  const byMonth = {};
  yearPlanning.forEach(w => {
    const m = w.startDate.getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(w);
  });

  const monthNames = ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'];
  const maxKm = Math.max(...planning.map(w => w.kmTotal || 0), 1);

  const html = `
    <div class="plan-year-nav">
      <button class="btn btn-ghost btn-sm" id="btn-year-prev">◄</button>
      <span class="plan-year-label">${planningYear}</span>
      <button class="btn btn-ghost btn-sm" id="btn-year-next">►</button>
    </div>

    <div class="plan-legend">
      ${Object.entries(CYCLE_COLORS).filter(([k]) => !k.includes('IO') || k === 'COMPETICIÓ').map(([k, v]) =>
        `<span class="legend-dot" style="background:${v.color}"></span><span>${capitalize(k)}</span>`
      ).join('')}
    </div>

    <div class="plan-year-grid">
      ${monthNames.map((name, m) => {
        const weeks = byMonth[m] || [];
        return `
          <div class="plan-month-col" data-month="${m}">
            <p class="plan-month-name">${name}</p>
            <div class="plan-month-weeks">
              ${weeks.map(w => {
                const c = getCycleStyle(w.cicle);
                const pct = Math.round(((w.kmTotal || 0) / maxKm) * 100);
                return `
                  <div class="plan-week-bar" style="border-color:${c.color}" 
                       data-week="${planning.indexOf(w)}" title="${w.setmana} · ${w.cicle} · ${w.fase} · ${fmtNumP(w.kmTotal)} km">
                    <div class="plan-week-fill" style="width:${pct}%;background:${c.color}"></div>
                    <span class="plan-week-name">${w.setmana}</span>
                  </div>`;
              }).join('')}
              ${!weeks.length ? '<p class="plan-no-data">—</p>' : ''}
            </div>
          </div>`;
      }).join('')}
    </div>`;

  container.innerHTML = html;

  // Navegació d'any
  document.getElementById('btn-year-prev')?.addEventListener('click', () => {
    planningYear--; renderPlanningLevel(planning);
  });
  document.getElementById('btn-year-next')?.addEventListener('click', () => {
    planningYear++; renderPlanningLevel(planning);
  });

  // Clic a setmana → vista setmanal
  container.querySelectorAll('.plan-week-bar[data-week]').forEach(el => {
    el.addEventListener('click', () => {
      planningWeekIndex = parseInt(el.dataset.week);
      planningViewLevel = 'weekly';
      renderPlanningLevel(planning);
    });
  });

  // Clic a mes → vista mensual
  container.querySelectorAll('.plan-month-col[data-month]').forEach(el => {
    el.querySelector('.plan-month-name')?.addEventListener('click', () => {
      planningMonth = parseInt(el.dataset.month);
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

  const html = `
    <div class="plan-month-nav">
      <button class="btn btn-ghost btn-sm" id="btn-month-prev">◄</button>
      <span class="plan-month-title">${monthNames[planningMonth]} ${planningYear}</span>
      <button class="btn btn-ghost btn-sm" id="btn-month-next">►</button>
    </div>

    <div class="plan-month-cards">
      ${monthWeeks.length ? monthWeeks.map(w => {
        const c    = getCycleStyle(w.cicle);
        const pct  = Math.round(((w.kmTotal || 0) / maxKm) * 100);
        const mins = estimatedMinutes(w);

        return `
          <article class="plan-week-card" style="border-top:3px solid ${c.color};background:${c.bg}"
                   data-week="${planning.indexOf(w)}">
            <div class="pwc-header">
              <div>
                <p class="pwc-setmana">${w.setmana}</p>
                <p class="pwc-dates">${fmtDateP(w.startDate)} → ${fmtDateP(w.endDate)}</p>
              </div>
              <div class="pwc-badges">
                <span class="pwc-cicle" style="color:${c.color}">${w.cicle}</span>
                <span class="pwc-fase">${w.fase}</span>
              </div>
            </div>
            <div class="pwc-bar-wrap">
              <div class="pwc-bar-fill" style="width:${pct}%;background:${c.color}"></div>
            </div>
            <div class="pwc-footer">
              <span class="pwc-km">${fmtNumP(w.kmTotal)} km</span>
              <span class="pwc-time">~${fmtMinutes(mins)}</span>
            </div>
          </article>`;
      }).join('') : '<p class="plan-no-data">Sense setmanes planificades aquest mes.</p>'}
    </div>`;

  container.innerHTML = html;

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

  const html = `
    <div class="plan-week-nav">
      <button class="btn btn-ghost btn-sm" id="btn-wplan-prev" ${planningWeekIndex === 0 ? 'disabled' : ''}>◄ Anterior</button>
      <div class="plan-week-nav-center">
        <span class="plan-week-nav-label" style="color:${c.color}">${week.setmana}</span>
        <span class="badge-muted plan-week-counter">${planningWeekIndex + 1} / ${planning.length}</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-wplan-next" ${planningWeekIndex === planning.length - 1 ? 'disabled' : ''}>Següent ►</button>
      <button class="btn btn-ghost btn-sm" id="btn-wplan-month">Vista mensual</button>
    </div>

    <div class="panel" style="border-top:3px solid ${c.color}">
      <div class="pwv-header">
        <div>
          <p class="eyebrow">${week.cicle} · ${week.fase}</p>
          <h3>${week.setmana}</h3>
          <p class="card-note">${fmtDateP(week.startDate)} → ${fmtDateP(week.endDate)}</p>
        </div>
        <div class="pwv-km-total">
          <p class="card-label">Km totals</p>
          <p class="hero-value">${fmtNumP(week.kmTotal)} km</p>
        </div>
      </div>
    </div>

    <div class="pwv-grid">

      <article class="panel pwv-block">
        <p class="eyebrow">🎯 Qualitat</p>
        <ul class="sw-plan-list" style="margin-top:12px">
          <li><span>Sèries</span><strong>${week.qSeries || '--'}</strong></li>
          <li><span>Ritme</span><strong>${week.raw['Q_Ritme_min_km'] || '--'} min/km</strong></li>
          <li><span>Recuperació</span><strong>${week.raw['Q_Rec_min'] || '--'} min</strong></li>
          <li><span>FC</span><strong>${formatFCRangeP(week.raw['Q_FC_min'], week.raw['Q_FC_max'])}</strong></li>
          <li><span>Km pla</span><strong>${fmtNumP(week.qKm)} km</strong></li>
        </ul>
      </article>

      <article class="panel pwv-block">
        <p class="eyebrow">🫁 Z2</p>
        <ul class="sw-plan-list" style="margin-top:12px">
          <li><span>Durada</span><strong>${fmtNumP(week.z2Durada)} min</strong></li>
          <li><span>Ritme</span><strong>${week.z2PaceMin}–${week.z2PaceMax} min/km</strong></li>
          <li><span>FC</span><strong>${formatFCRangeP(week.raw['Z2_FC_min'], week.raw['Z2_FC_max'])}</strong></li>
          <li><span>Km pla</span><strong>${fmtNumP(week.raw['Z2_Km_Plan'])} km</strong></li>
        </ul>
      </article>

      <article class="panel pwv-block">
        <p class="eyebrow">🏃 Tirada llarga</p>
        <ul class="sw-plan-list" style="margin-top:12px">
          <li><span>Tipus</span><strong>${week.llTipus || '--'}</strong></li>
          <li><span>Durada</span><strong>${week.raw['LL_Durada_min'] ? fmtNumP(week.raw['LL_Durada_min']) + ' min' : '--'}</strong></li>
          <li><span>Km pla</span><strong>${fmtNumP(week.llKm)} km</strong></li>
        </ul>
      </article>

      <article class="panel pwv-block">
        <p class="eyebrow">💪 Força / Pàdel</p>
        <ul class="sw-plan-list" style="margin-top:12px">
          <li><span>Força</span><strong>${week.forcaPlan || '--'}</strong></li>
          <li><span>Pàdel</span><strong>${week.padelPlan || '--'}</strong></li>
        </ul>
      </article>

    </div>`;

  container.innerHTML = html;

  document.getElementById('btn-wplan-prev')?.addEventListener('click', () => {
    if (planningWeekIndex > 0) { planningWeekIndex--; renderPlanningLevel(planning); }
  });
  document.getElementById('btn-wplan-next')?.addEventListener('click', () => {
    if (planningWeekIndex < planning.length - 1) { planningWeekIndex++; renderPlanningLevel(planning); }
  });
  document.getElementById('btn-wplan-month')?.addEventListener('click', () => {
    planningMonth = planning[planningWeekIndex].startDate.getMonth();
    planningYear  = planning[planningWeekIndex].startDate.getFullYear();
    planningViewLevel = 'monthly';
    renderPlanningLevel(planning);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCycleStyle(cicle) {
  const key = String(cicle || '').toUpperCase().trim();
  return CYCLE_COLORS[key] || CYCLE_DEFAULT;
}

function getTrainingIcons(w) {
  const icons = [];
  if (w.qKm     > 0 || w.qSeries !== '--') icons.push('🎯');
  if (w.z2Durada > 0)                       icons.push('🫁');
  if (w.llKm    > 0)                        icons.push('🏃');
  if (w.forcaPlan && w.forcaPlan !== '--' && w.forcaPlan !== 'N') icons.push('💪');
  if (w.padelPlan && w.padelPlan !== '--' && w.padelPlan !== 'N') icons.push('🎾');
  return icons.join(' ');
}

function capitalize(str) {
  return str.charAt(0) + str.slice(1).toLowerCase();
}

function formatFCRangeP(min, max) {
  if (!min && !max) return '--';
  if (min && max)   return `${min}–${max} bpm`;
  return `${min || max} bpm`;
}

function fmtNumP(value) {
  const n = parseFloat(value);
  if (!isFinite(n)) return '--';
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(n);
}

function fmtDateP(date) {
  if (!date) return '--';
  return new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' }).format(date);
}

// Estima els minuts totals de la setmana sumant Z2 + sèries qualitat + tirada llarga
function estimatedMinutes(w) {
  const z2  = parseFloat(w.z2Durada)                    || 0;
  const q   = (parseFloat(w.qSeries) || 0)
            * ((parseFloat(w.raw['Q_Durada_Serie_min']) || 0)
             + (parseFloat(w.raw['Q_Rec_min'])          || 0));
  const ll  = parseFloat(w.raw['LL_Durada_min'])        || 0;
  return Math.round(z2 + q + ll);
}

function fmtMinutes(mins) {
  if (!mins) return '--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}`.trim() : `${m} min`;
}
