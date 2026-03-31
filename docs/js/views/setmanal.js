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
  const sess   = weekSessions.filter(s => qualityTypesSetmanal.has(s.tipusKey));
  const realKm = sess.reduce((a, s) => a + (s.distancia || 0), 0);

  const ritmeReal = sess.length
    ? sess.reduce((best, s) => {
        const r = isFinite(s.ritmeMitjaSeries) ? s.ritmeMitjaSeries : s.ritme;
        return (!best || r < best) ? r : best;
      }, null)
    : null;
  const fcReal = sess.length
    ? Math.round(sess.reduce((acc, s) => {
        const fc = isFinite(s.fcMitjaSeries) && s.fcMitjaSeries > 0 ? s.fcMitjaSeries : (s.fcMitja || 0);
        return acc + fc;
      }, 0) / sess.length)
    : null;

  setTextV('sw-q-series',  week.qSeries || '--');
  setTextV('sw-q-ritme',   formatPace(week.raw['Q_Ritme_min_km']));
  setTextV('sw-q-rec',     week.raw['Q_Rec_min'] ? week.raw['Q_Rec_min'] + ' min' : '--');
  setTextV('sw-q-fc',      formatFCRange(week.raw['Q_FC_min'], week.raw['Q_FC_max']));
  setTextV('sw-q-km-plan', `${fmtNum(week.qKm)} km`);

  setTextV('sw-q-ritme-real',    ritmeReal ? formatPace(ritmeReal) : '—');
  setTextV('sw-q-fc-real',       fcReal && fcReal > 0 ? fcReal + ' bpm' : '—');
  setTextV('sw-q-km-real',       sess.length ? `${fmtNum(realKm)} km` : '—');
  setTextV('sw-q-sessions-real', sess.length ? `${sess.length} sess.` : '—');

  const tbody = document.getElementById('sw-q-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowQuality(s)).join('')
      : `<tr><td colspan="4" class="empty-row muted-msg">Sense sessions de qualitat</td></tr>`;
  }
  setBlockStatus('sw-q-block', sess.length > 0);
}

// ── Bloc Z2 ───────────────────────────────────────────────────────────────────
function renderZ2Block(week, weekSessions) {
  const sess = weekSessions.filter(s => s.tipusKey === 'Z2');

  const realDuradaTotal = sess.reduce((a, s) => a + (s.durada || 0), 0);
  const realZ1Z2min = sess.reduce((a, s) => {
    const z1 = toNumber(s.raw['Z1(min)']) || 0;
    const z2 = toNumber(s.raw['Z2(min)']) || s.z2min || 0;
    return a + z1 + z2;
  }, 0);
  const realKm = sess.reduce((a, s) => a + (s.distancia || 0), 0);

  const ritmeReal = sess.length
    ? sess.reduce((acc, s) => acc + (isFinite(s.ritme) ? s.ritme : 0), 0) / sess.length
    : null;
  const fcReal = sess.length
    ? Math.round(sess.reduce((acc, s) => acc + (s.fcMitja || 0), 0) / sess.length)
    : null;

  setTextV('sw-z2-durada-plan', `${fmtNum(week.z2Durada)} min`);
  setTextV('sw-z2-ritme-plan',
    `${formatPace(week.raw['Z2_Ritme_min_km_min'], '')}–${formatPace(week.raw['Z2_Ritme_min_km_max'])}`);
  setTextV('sw-z2-fc-plan',   formatFCRange(week.raw['Z2_FC_min'], week.raw['Z2_FC_max']));
  setTextV('sw-z2-km-plan',   `${fmtNum(week.raw['Z2_Km_Plan'])} km`);

  let duradaRealText = '—';
  if (realDuradaTotal > 0) {
    duradaRealText = `${fmtNum(realDuradaTotal)} min`;
    if (realZ1Z2min > 0) duradaRealText += ` (${fmtNum(realZ1Z2min)} Z1+Z2)`;
  }
  setTextV('sw-z2-durada-real', duradaRealText);
  setTextV('sw-z2-ritme-real',  ritmeReal && ritmeReal > 0 ? formatPace(ritmeReal) : '—');
  setTextV('sw-z2-fc-real',     fcReal && fcReal > 0 ? fcReal + ' bpm' : '—');
  setTextV('sw-z2-km-real',     realKm > 0 ? `${fmtNum(realKm)} km` : '—');

  const tbody = document.getElementById('sw-z2-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowZ2(s)).join('')
      : `<tr><td colspan="4" class="empty-row muted-msg">Sense sessions Z2</td></tr>`;
  }
  setBlockStatus('sw-z2-block', realDuradaTotal >= (week.z2Durada || 0) * 0.8);
}

// ── Bloc Tirada llarga ────────────────────────────────────────────────────────
function renderLongBlock(week, weekSessions) {
  const sess   = weekSessions.filter(s => LONG_TYPES.has(s.tipusKey));
  const realKm = sess.reduce((a, s) => a + (s.distancia || 0), 0);

  const ritmeReal = sess.length
    ? sess.reduce((best, s) => (!best || (isFinite(s.ritme) && s.ritme < best)) ? s.ritme : best, null)
    : null;

  setTextV('sw-ll-tipus-plan',  week.llTipus || '--');
  setTextV('sw-ll-durada-plan', week.raw['LL_Durada_min'] ? `${fmtNum(week.raw['LL_Durada_min'])} min` : '--');
  setTextV('sw-ll-km-plan',     `${fmtNum(week.llKm)} km`);

  setTextV('sw-ll-ritme-real', ritmeReal ? formatPace(ritmeReal) : '—');
  setTextV('sw-ll-km-real',    realKm > 0 ? `${fmtNum(realKm)} km` : '—');

  const tbody = document.getElementById('sw-ll-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowLong(s)).join('')
      : `<tr><td colspan="5" class="empty-row muted-msg">Sense tirada llarga</td></tr>`;
  }
  setBlockStatus('sw-ll-block', sess.length > 0);
}

// ── Bloc Força ────────────────────────────────────────────────────────────────
function renderForcaBlock(week, weekSessions) {
  const sess = weekSessions.filter(s => STRENGTH_RE.test(s.tipusKey));

  setTextV('sw-forca-plan', week.forcaPlan || '--');
  setTextV('sw-forca-real', sess.length ? `${sess.length} sess.` : '—');

  const tbody = document.getElementById('sw-forca-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowExtra(s)).join('')
      : `<tr><td colspan="4" class="empty-row muted-msg">Sense sessions de força</td></tr>`;
  }
  setBlockStatus('sw-forca-block', sess.length > 0);
}

// ── Bloc Altres ───────────────────────────────────────────────────────────────
function renderAltresBlock(week, weekSessions) {
  const sess        = weekSessions.filter(s => PADEL_TYPES.has(s.tipusKey));
  const totalDurada = sess.reduce((a, s) => a + (s.durada || 0), 0);

  setTextV('sw-altres-padel-plan',    week.padelPlan || '--');
  setTextV('sw-altres-sessions-real', sess.length ? `${sess.length} part.` : '—');
  setTextV('sw-altres-durada-real',   totalDurada > 0 ? `${fmtNum(totalDurada)} min` : '—');

  const tbody = document.getElementById('sw-altres-sessions-list');
  if (tbody) {
    tbody.innerHTML = sess.length
      ? sess.map(s => sessionRowExtra(s)).join('')
      : `<tr><td colspan="4" class="empty-row muted-msg">Sense activitats complementàries</td></tr>`;
  }
  setBlockStatus('sw-altres-block', sess.length > 0);
}

// ── Rows de taula ─────────────────────────────────────────────────────────────
// Totes les columnes TSS usen tssDotHTML(s.carrega) per coherència visual
// amb la pestanya Sessions. El dot de color indica la intensitat relativa
// (Recuperació / Fàcil / Moderada / Dura / Extrem) del barem TSS.

function tssCell(carrega) {
  if (!(typeof carrega === 'number' && carrega > 0)) return '—';
  return `${tssDotHTML(carrega)} ${fmtNum(carrega)}`;
}

// Qualitat: Data | Ritme sèries | FC sèries | TSS
function sessionRowQuality(s) {
  const ritme = isFinite(s.ritmeMitjaSeries) ? s.ritmeMitjaSeries : s.ritme;
  const fc    = isFinite(s.fcMitjaSeries)    ? s.fcMitjaSeries    : s.fcMitja;
  return `<tr>
    <td>${esc(s.displayDate)}</td>
    <td>${formatPace(ritme)}</td>
    <td>${isFinite(fc) && fc > 0 ? Math.round(fc) + ' bpm' : '—'}</td>
    <td>${tssCell(s.carrega)}</td>
  </tr>`;
}

// Z2: Data | Ritme | Cadència | TSS
function sessionRowZ2(s) {
  const cadencia = toNumber(s.raw['Cadencia(spm)']);
  return `<tr>
    <td>${esc(s.displayDate)}</td>
    <td>${formatPace(s.ritme)}</td>
    <td>${isFinite(cadencia) && cadencia > 0 ? Math.round(cadencia) + ' spm' : '—'}</td>
    <td>${tssCell(s.carrega)}</td>
  </tr>`;
}

// Llarga: Data | Ritme | Z2 | Desnivell | TSS
function sessionRowLong(s) {
  const desnivell = toNumber(s.raw['Desnivell(m)']);
  return `<tr>
    <td>${esc(s.displayDate)}</td>
    <td>${formatPace(s.ritme)}</td>
    <td>${s.z2min > 0 ? fmtNum(s.z2min) + ' min Z2' : '—'}</td>
    <td>${isFinite(desnivell) && desnivell > 0 ? Math.round(desnivell) + ' m' : '—'}</td>
    <td>${tssCell(s.carrega)}</td>
  </tr>`;
}

// Força / Altres: Data | Tipus | Durada | TSS
function sessionRowExtra(s) {
  return `<tr>
    <td>${esc(s.displayDate)}</td>
    <td>${esc(s.tipus)}</td>
    <td>${s.durada > 0 ? fmtNum(s.durada) + ' min' : '—'}</td>
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
