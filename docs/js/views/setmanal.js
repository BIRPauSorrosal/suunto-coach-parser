// docs/js/views/setmanal.js — Fase 4: vista detallada setmana actual
// Funció principal: renderSetmanalView(sessions, planning)
// Dep: lib/formatters.js (formatPace, fmtNum, formatDate, toNumber, esc)
//      lib/load-scale.js (tssDotHTML)
//      app.js (detectActiveWeek, QUALITY_TYPES, LONG_TYPES, PADEL_TYPES, STRENGTH_RE)
// NOTA: No declarar aquí constants de tipus — usar les de app.js

let currentWeekIndex = 0;

// ── Punt d'entrada ────────────────────────────────────────────────────────────
function renderSetmanalView(sessions, planning) {
  if (!planning.length) return;
  if (currentWeekIndex === 0) {
    currentWeekIndex = detectActiveWeekIndex(sessions, planning);
  }
  renderWeek(sessions, planning);
  initWeekNav(sessions, planning);
}

// ── Detecció setmana activa ───────────────────────────────────────────────────
function detectActiveWeekIndex(sessions, planning) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIdx = planning.findIndex(w => today >= w.startDate && today <= w.endDate);
  if (todayIdx !== -1) return todayIdx;

  const latest = sessions[0];
  if (latest) {
    const idx = planning.findIndex(w =>
      latest.date >= w.startDate && latest.date <= w.endDate
    );
    if (idx !== -1) return idx;
  }

  return planning.length - 1;
}

// ── Navegació ─────────────────────────────────────────────────────────────────
function initWeekNav(sessions, planning) {
  const btnPrev = document.getElementById('week-nav-prev');
  const btnNext = document.getElementById('week-nav-next');
  if (!btnPrev || !btnNext) return;
  btnPrev.replaceWith(btnPrev.cloneNode(true));
  btnNext.replaceWith(btnNext.cloneNode(true));
  document.getElementById('week-nav-prev').addEventListener('click', () => {
    if (currentWeekIndex > 0) { currentWeekIndex--; renderWeek(sessions, planning); updateNavButtons(planning); }
  });
  document.getElementById('week-nav-next').addEventListener('click', () => {
    if (currentWeekIndex < planning.length - 1) { currentWeekIndex++; renderWeek(sessions, planning); updateNavButtons(planning); }
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
  renderForcaBlock(week, weekSessions);
  renderAltresBlock(week, weekSessions);
}

// ── Capçalera ─────────────────────────────────────────────────────────────────
function renderWeekHeader(week, planning) {
  setTextV('sw-week-label',   `${week.setmana} · ${week.cicle}`);
  setTextV('sw-week-fase',    week.fase);
  setTextV('sw-week-range',   `${formatDate(week.startDate)} → ${formatDate(week.endDate)}`);
  setTextV('sw-week-counter', `${currentWeekIndex + 1} / ${planning.length}`);
}

// ── Barra de progrés ──────────────────────────────────────────────────────────
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
  const qualityTypesSetmanal = new Set([...QUALITY_TYPES, 'TEST']);
  const sess = weekSessions.filter(s => qualityTypesSetmanal.has(s.tipusKey));

  // Fila Pla (camps enriquits de enrichPlanningRow)
  setTextV('sw-q-series',       isFinite(week.qSeries) && week.qSeries > 0 ? week.qSeries : '--');
  setTextV('sw-q-durada-serie', isFinite(week.qDuradaSerie) && week.qDuradaSerie > 0 ? week.qDuradaSerie + ' min' : '--');
  setTextV('sw-q-ritme',        formatPace(week.qRitme));
  setTextV('sw-q-rec',          isFinite(week.qRec) && week.qRec > 0 ? week.qRec + ' min' : '--');
  setTextV('sw-q-fc',           formatFCRange(week.qFcMin, week.qFcMax));
  setTextV('sw-q-km-plan',      `${fmtNum(week.qKm)} km`);

  const tbody = document.getElementById('sw-q-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowQuality(s)).join('')
      : `<tr><td colspan="9" class="empty-row muted-msg">Sense sessions de qualitat</td></tr>`;
  }
  setBlockStatus('sw-q-block', sess.length > 0);
}

// ── Bloc Z2 ───────────────────────────────────────────────────────────────────
function renderZ2Block(week, weekSessions) {
  const sess = weekSessions.filter(s => s.tipusKey === 'Z2');

  // Fila Pla
  setTextV('sw-z2-durada-plan', `${fmtNum(week.z2Durada)} min`);
  setTextV('sw-z2-ritme-plan',
    `${formatPace(week.z2RitmeMin, '')}–${formatPace(week.z2RitmeMax)}`);
  setTextV('sw-z2-fc-plan',   formatFCRange(week.z2FcMin, week.z2FcMax));
  setTextV('sw-z2-km-plan',   `${fmtNum(week.z2Km)} km`);

  const tbody = document.getElementById('sw-z2-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowZ2(s)).join('')
      : `<tr><td colspan="7" class="empty-row muted-msg">Sense sessions Z2</td></tr>`;
  }
  setBlockStatus('sw-z2-block', sess.length > 0);
}

// ── Bloc Tirada llarga ────────────────────────────────────────────────────────
function renderLongBlock(week, weekSessions) {
  const sess = weekSessions.filter(s => LONG_TYPES.has(s.tipusKey));

  // Fila Pla
  setTextV('sw-ll-tipus-plan',  week.llTipus || '--');
  setTextV('sw-ll-durada-plan', isFinite(week.llDurada) && week.llDurada > 0 ? `${fmtNum(week.llDurada)} min` : '--');
  setTextV('sw-ll-km-plan',     `${fmtNum(week.llKm)} km`);

  const tbody = document.getElementById('sw-ll-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowLong(s)).join('')
      : `<tr><td colspan="8" class="empty-row muted-msg">Sense tirada llarga</td></tr>`;
  }
  setBlockStatus('sw-ll-block', sess.length > 0);
}

// ── Bloc Força ────────────────────────────────────────────────────────────────
function renderForcaBlock(week, weekSessions) {
  const sess = weekSessions.filter(s => STRENGTH_RE.test(s.tipusKey));

  setTextV('sw-forca-plan', week.forcaPlan || '--');

  const tbody = document.getElementById('sw-forca-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowExtra(s)).join('')
      : `<tr><td colspan="5" class="empty-row muted-msg">Sense sessions de força</td></tr>`;
  }
  setBlockStatus('sw-forca-block', sess.length > 0);
}

// ── Bloc Altres ───────────────────────────────────────────────────────────────
function renderAltresBlock(week, weekSessions) {
  const sess = weekSessions.filter(s => PADEL_TYPES.has(s.tipusKey));

  setTextV('sw-altres-padel-plan', week.padelPlan || '--');

  const tbody = document.getElementById('sw-altres-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowExtra(s)).join('')
      : `<tr><td colspan="5" class="empty-row muted-msg">Sense activitats complementàries</td></tr>`;
  }
  setBlockStatus('sw-altres-block', sess.length > 0);
}

// ── Rows de taula ─────────────────────────────────────────────────────────────

function tssCell(carrega) {
  if (!(typeof carrega === 'number' && carrega > 0)) return '—';
  return tssDotHTML(carrega);
}

// Qualitat: Data | Sèries | Dur.sèrie | Ritme | Rec. | Cadència | FC | TSS | Km
function sessionRowQuality(s) {
  const ritme = isFinite(s.ritmeMitjaSeries) && s.ritmeMitjaSeries > 0
    ? s.ritmeMitjaSeries : s.ritme;
  const fc = isFinite(s.fcMitjaSeries) && s.fcMitjaSeries > 0
    ? s.fcMitjaSeries : s.fcMitja;
  const n   = s.numSeries;
  const seriesCell = isFinite(n) && n > 0 ? n : '—';
  const dur = s.duradaMitjaSeries;
  const durCell = isFinite(dur) && dur > 0 ? `${fmtNum(dur)} min` : '—';
  const rec = s.recMitjaMin;
  const recCell = isFinite(rec) && rec > 0 ? `${fmtNum(rec)} min` : '—';
  const cad = s.cadenciaMitjaSeries;
  const cadCell = isFinite(cad) && cad > 0 ? `${Math.round(cad)} spm` : '—';

  return `<tr>
    <td>${esc(s.displayDate)}</td>
    <td>${seriesCell}</td>
    <td>${durCell}</td>
    <td>${formatPace(ritme)}</td>
    <td>${recCell}</td>
    <td>${cadCell}</td>
    <td>${fcBadgeHTML(fc)}</td>
    <td>${tssCell(s.carrega)}</td>
    <td>${isFinite(s.distancia) && s.distancia > 0 ? fmtNum(s.distancia) + ' km' : '—'}</td>
  </tr>`;
}

// Z2: Data | Durada | Ritme | Cadència | FC | TSS | Km
function sessionRowZ2(s) {
  const cadencia = toNumber(s.raw['Cadencia(spm)']);
  return `<tr>
    <td>${esc(s.displayDate)}</td>
    <td>${isFinite(s.durada) && s.durada > 0 ? fmtNum(s.durada) + ' min' : '—'}</td>
    <td>${formatPace(s.ritme)}</td>
    <td>${isFinite(cadencia) && cadencia > 0 ? Math.round(cadencia) + ' spm' : '—'}</td>
    <td>${fcBadgeHTML(s.fcMitja)}</td>
    <td>${tssCell(s.carrega)}</td>
    <td>${isFinite(s.distancia) && s.distancia > 0 ? fmtNum(s.distancia) + ' km' : '—'}</td>
  </tr>`;
}

// Llarga: Data | Durada | Ritme | Min Z2 | Desnivell | FC | TSS | Km
// NOTA: s'elimina Cadència (irrellevant en tirades llargues) per alliberar espai
//       i es reordena: Durada primer, Ritme segon, sense columna buida de Ritme al Pla.
function sessionRowLong(s) {
  const desnivell = toNumber(s.raw['Desnivell(m)']);
  const duradaCell = isFinite(s.durada) && s.durada > 0
    ? fmtNum(s.durada) + ' min'
    : '—';

  return `<tr>
    <td>${esc(s.displayDate)}</td>
    <td>${duradaCell}</td>
    <td>${formatPace(s.ritme)}</td>
    <td>${isFinite(s.z2min) && s.z2min > 0 ? fmtNum(s.z2min) + ' min' : '—'}</td>
    <td>${isFinite(desnivell) && desnivell > 0 ? Math.round(desnivell) + ' m' : '—'}</td>
    <td>${fcBadgeHTML(s.fcMitja)}</td>
    <td>${tssCell(s.carrega)}</td>
    <td>${isFinite(s.distancia) && s.distancia > 0 ? fmtNum(s.distancia) + ' km' : '—'}</td>
  </tr>`;
}

// Força / Altres: Data | Tipus | Durada | FC | TSS
function sessionRowExtra(s) {
  return `<tr>
    <td>${esc(s.displayDate)}</td>
    <td>${esc(s.tipus)}</td>
    <td>${isFinite(s.durada) && s.durada > 0 ? fmtNum(s.durada) + ' min' : '—'}</td>
    <td>${fcBadgeHTML(s.fcMitja)}</td>
    <td>${tssCell(s.carrega)}</td>
  </tr>`;
}

// ── Helpers locals ────────────────────────────────────────────────────────────
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
