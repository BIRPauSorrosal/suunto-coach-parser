// views/setmanal.js — Fase 4: vista detallada setmana actual
// Funció principal: renderSetmanalView(sessions, planning)

const QUALITY_TYPES_V = new Set(['TEMPO', 'TEST', 'INTERVALS']);
const LONG_TYPES_V    = new Set(['LLARGA', 'MARATÓ', 'TRAIL', 'MITJA', 'MARATO']);
const EXTRA_TYPES_V   = new Set(['PADEL', 'TENIS', 'TENNIS']);

// Índex de la setmana visible (0 = primera del planning)
let currentWeekIndex = 0;

// ── Punt d'entrada ────────────────────────────────────────────────────────────
function renderSetmanalView(sessions, planning) {
  if (!planning.length) return;

  // La primera vegada, situem l'índex a la setmana activa
  if (currentWeekIndex === 0) {
    currentWeekIndex = detectActiveWeekIndex(sessions, planning);
  }

  renderWeek(sessions, planning);
  initWeekNav(sessions, planning);
}

// ── Detecció setmana activa ───────────────────────────────────────────────────
function detectActiveWeekIndex(sessions, planning) {
  const latest = sessions[0];
  if (latest) {
    const idx = planning.findIndex(w =>
      latest.date >= w.startDate && latest.date <= w.endDate
    );
    if (idx !== -1) return idx;
  }
  const today = new Date();
  const idx = planning.findIndex(w => today >= w.startDate && today <= w.endDate);
  return idx !== -1 ? idx : planning.length - 1;
}

// ── Navegació ────────────────────────────────────────────────────────────────
function initWeekNav(sessions, planning) {
  const btnPrev = document.getElementById('week-nav-prev');
  const btnNext = document.getElementById('week-nav-next');
  if (!btnPrev || !btnNext) return;

  // Clonem per eliminar listeners antics
  btnPrev.replaceWith(btnPrev.cloneNode(true));
  btnNext.replaceWith(btnNext.cloneNode(true));

  document.getElementById('week-nav-prev').addEventListener('click', () => {
    if (currentWeekIndex > 0) {
      currentWeekIndex--;
      renderWeek(sessions, planning);
      updateNavButtons(planning);
    }
  });

  document.getElementById('week-nav-next').addEventListener('click', () => {
    if (currentWeekIndex < planning.length - 1) {
      currentWeekIndex++;
      renderWeek(sessions, planning);
      updateNavButtons(planning);
    }
  });

  updateNavButtons(planning);
}

function updateNavButtons(planning) {
  const btnPrev = document.getElementById('week-nav-prev');
  const btnNext = document.getElementById('week-nav-next');
  if (btnPrev) btnPrev.disabled = currentWeekIndex === 0;
  if (btnNext) btnNext.disabled = currentWeekIndex === planning.length - 1;
}

// ── Render de la setmana ──────────────────────────────────────────────────────
function renderWeek(sessions, planning) {
  const week = planning[currentWeekIndex];
  if (!week) return;

  const weekSessions = sessions.filter(s =>
    s.date >= week.startDate && s.date <= week.endDate
  );

  renderWeekHeader(week, planning);
  renderWeekProgress(week, weekSessions);
  renderQualityBlock(week, weekSessions);
  renderZ2Block(week, weekSessions);
  renderLongBlock(week, weekSessions);
  renderExtraBlock(week, weekSessions);
}

// ── Capçalera de setmana ──────────────────────────────────────────────────────
function renderWeekHeader(week, planning) {
  setTextV('sw-week-label',  `${week.setmana} · ${week.cicle}`);
  setTextV('sw-week-fase',   week.fase);
  setTextV('sw-week-range',  `${fmtDate(week.startDate)} → ${fmtDate(week.endDate)}`);
  setTextV('sw-week-counter',`${currentWeekIndex + 1} / ${planning.length}`);
}

// ── Barra de progrés global ───────────────────────────────────────────────────
function renderWeekProgress(week, weekSessions) {
  const realKm    = weekSessions.reduce((a, s) => a + (s.distancia || 0), 0);
  const plannedKm = week.kmTotal || 0;
  const pct       = plannedKm > 0 ? Math.min((realKm / plannedKm) * 100, 100) : 0;

  setTextV('sw-progress-real',    `${fmtNum(realKm)} km`);
  setTextV('sw-progress-planned', `${fmtNum(plannedKm)} km`);
  setTextV('sw-progress-pct',     `${Math.round(pct)} %`);

  const bar = document.getElementById('sw-progress-bar');
  if (bar) bar.style.width = `${pct}%`;
}

// ── Bloc Qualitat ─────────────────────────────────────────────────────────────
function renderQualityBlock(week, weekSessions) {
  const sessions = weekSessions.filter(s => QUALITY_TYPES_V.has(s.tipusKey));
  const realKm   = sessions.reduce((a, s) => a + (s.distancia || 0), 0);

  // Pla
  setTextV('sw-q-series',  week.qSeries  || '--');
  setTextV('sw-q-ritme',   week.raw['Q_Ritme_min_km'] || '--');
  setTextV('sw-q-rec',     week.raw['Q_Rec_min']      || '--');
  setTextV('sw-q-fc',      formatFCRange(week.raw['Q_FC_min'], week.raw['Q_FC_max']));
  setTextV('sw-q-km-plan', `${fmtNum(week.qKm)} km`);

  // Real
  setTextV('sw-q-sessions-real', sessions.length ? `${sessions.length} sessió${sessions.length > 1 ? 'ns' : ''}` : '—');
  setTextV('sw-q-km-real',       sessions.length ? `${fmtNum(realKm)} km` : '—');

  const tbody = document.getElementById('sw-q-sessions-list');
  if (tbody) {
    tbody.innerHTML = sessions.length
      ? sessions.map(s => sessionRow(s)).join('')
      : `<tr><td colspan="4" class="empty-row muted-msg">Sense sessions de qualitat aquesta setmana</td></tr>`;
  }

  setBlockStatus('sw-q-block', sessions.length > 0);
}

// ── Bloc Z2 ───────────────────────────────────────────────────────────────────
function renderZ2Block(week, weekSessions) {
  const sessions  = weekSessions.filter(s => s.tipusKey === 'Z2');
  const realZ2min = weekSessions.reduce((a, s) => a + (s.z2min || 0), 0);
  const realKm    = sessions.reduce((a, s) => a + (s.distancia || 0), 0);

  // Pla
  setTextV('sw-z2-durada-plan', `${fmtNum(week.z2Durada)} min`);
  setTextV('sw-z2-ritme-plan',  `${week.z2PaceMin}–${week.z2PaceMax} min/km`);
  setTextV('sw-z2-fc-plan',     formatFCRange(week.raw['Z2_FC_min'], week.raw['Z2_FC_max']));
  setTextV('sw-z2-km-plan',     `${fmtNum(week.raw['Z2_Km_Plan'])} km`);

  // Real
  setTextV('sw-z2-min-real', realZ2min > 0 ? `${fmtNum(realZ2min)} min Z2` : '—');
  setTextV('sw-z2-km-real',  realKm    > 0 ? `${fmtNum(realKm)} km` : '—');

  const tbody = document.getElementById('sw-z2-sessions-list');
  if (tbody) {
    tbody.innerHTML = sessions.length
      ? sessions.map(s => sessionRow(s)).join('')
      : `<tr><td colspan="4" class="empty-row muted-msg">Sense sessions Z2 aquesta setmana</td></tr>`;
  }

  setBlockStatus('sw-z2-block', realZ2min >= (week.z2Durada || 0) * 0.8);
}

// ── Bloc Tirada llarga ────────────────────────────────────────────────────────
function renderLongBlock(week, weekSessions) {
  const sessions = weekSessions.filter(s => LONG_TYPES_V.has(s.tipusKey));
  const realKm   = sessions.reduce((a, s) => a + (s.distancia || 0), 0);

  // Pla
  setTextV('sw-ll-tipus-plan',  week.llTipus || '--');
  setTextV('sw-ll-durada-plan', week.raw['LL_Durada_min'] ? `${fmtNum(week.raw['LL_Durada_min'])} min` : '--');
  setTextV('sw-ll-km-plan',     `${fmtNum(week.llKm)} km`);

  // Real
  setTextV('sw-ll-km-real', realKm > 0 ? `${fmtNum(realKm)} km` : '—');

  const tbody = document.getElementById('sw-ll-sessions-list');
  if (tbody) {
    tbody.innerHTML = sessions.length
      ? sessions.map(s => sessionRow(s)).join('')
      : `<tr><td colspan="4" class="empty-row muted-msg">Sense tirada llarga aquesta setmana</td></tr>`;
  }

  setBlockStatus('sw-ll-block', sessions.length > 0);
}

// ── Bloc Extra (Força + Pàdel) ────────────────────────────────────────────────
function renderExtraBlock(week, weekSessions) {
  const forca  = weekSessions.filter(s =>
    s.tipusKey.startsWith('FORÇA') || s.tipusKey.startsWith('FORCA')
  );
  const extra  = weekSessions.filter(s => EXTRA_TYPES_V.has(s.tipusKey));

  // Pla
  setTextV('sw-extra-forca-plan', week.forcaPlan || '--');
  setTextV('sw-extra-padel-plan', week.padelPlan || '--');

  // Real
  setTextV('sw-extra-forca-real', forca.length ? `${forca.length} sessió${forca.length > 1 ? 'ns' : ''}` : '—');
  setTextV('sw-extra-padel-real', extra.length  ? `${extra.length} sessió${extra.length  > 1 ? 'ns' : ''}` : '—');

  const tbody = document.getElementById('sw-extra-sessions-list');
  if (tbody) {
    tbody.innerHTML = [...forca, ...extra].length
      ? [...forca, ...extra].map(s => sessionRow(s)).join('')
      : `<tr><td colspan="4" class="empty-row muted-msg">Sense sessions complementàries</td></tr>`;
  }

  setBlockStatus('sw-extra-block', forca.length > 0 || extra.length > 0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sessionRow(s) {
  return `
    <tr>
      <td>${escV(s.displayDate)}</td>
      <td>${escV(s.tipus)}</td>
      <td>${s.distancia > 0 ? fmtNum(s.distancia) + ' km' : '—'}</td>
      <td>${fmtNum(s.carrega)}</td>
    </tr>`;
}

function setBlockStatus(id, done) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('block--done',    done);
  el.classList.toggle('block--pending', !done);
}

function formatFCRange(min, max) {
  if (!min && !max) return '--';
  if (min && max)   return `${min}–${max} bpm`;
  return `${min || max} bpm`;
}

function setTextV(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escV(v) {
  return String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function fmtNum(value) {
  const n = parseFloat(value);
  if (!isFinite(n)) return '--';
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(n);
}

function fmtDate(date) {
  return new Intl.DateTimeFormat('ca-ES').format(date);
}
