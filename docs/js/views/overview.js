// docs/js/views/overview.js
// Vista Overview: hero-cards + metric-boxes + panells Test/Cursa + Altres
// Dep: app.js (constants, helpers, detectActiveWeek)

// ── Punt d'entrada ────────────────────────────────────────────────────────────
function renderOverviewView(sessions, planning) {
  const activeWeek     = detectActiveWeek(planning, sessions);
  const weeklySessions = activeWeek
    ? sessions.filter(s => s.date >= activeWeek.startDate && s.date <= activeWeek.endDate)
    : [];

  renderOverview(activeWeek, weeklySessions);
  renderSummary(activeWeek, weeklySessions);
  renderTestRacePanel(sessions);
  renderOthersPanel(sessions);

  setTimeout(() => initCharts(sessions, planning), 0);
}

// ── Hero-cards ────────────────────────────────────────────────────────────────
function renderOverview(activeWeek, weeklySessions) {
  const plannedKm  = activeWeek?.kmTotal ?? null;
  const realLoad   = sumNumbers(weeklySessions.map(s => s.carrega));
  const realKm     = sumNumbers(weeklySessions.map(s => s.distancia));
  const compliance = (plannedKm && plannedKm > 0) ? (realKm / plannedKm) * 100 : null;

  setText('active-week-label', activeWeek ? `${activeWeek.setmana} · ${activeWeek.cicle}` : '--');
  setText('active-week-range', activeWeek
    ? `${formatDate(activeWeek.startDate)} → ${formatDate(activeWeek.endDate)} · ${activeWeek.fase}`
    : "No s'ha pogut detectar cap setmana activa.");
  setText('planned-km-value',  formatMetric(plannedKm, 'km'));
  setText('real-load-value',   formatMetric(realLoad, ''));
  setText('compliance-value',  compliance == null ? '-- %' : `${Math.round(compliance)} %`);
}

// ── Metric-boxes (resum setmana activa) ──────────────────────────────────────
function renderSummary(activeWeek, weeklySessions) {
  const quality  = weeklySessions.filter(s => QUALITY_TYPES.has(s.tipusKey));
  const llong    = weeklySessions.filter(s => LONG_TYPES.has(s.tipusKey));
  const strength = weeklySessions.filter(s => isStrength(s));

  // Z1+Z2: només sessions de running
  const runningSessions = weeklySessions.filter(s => isRunning(s));
  const z1z2Minutes     = sumNumbers(runningSessions.map(s => (s.z1min || 0) + (s.z2min || 0)));

  const qualityKm   = sumNumbers(quality.map(s => s.distancia));
  const longKm      = sumNumbers(llong.map(s => s.distancia));
  const strengthMin = sumNumbers(strength.map(s => s.durada));

  // ─ Qualitat ─────────────────────────────────────────────────────
  if (activeWeek) {
    // Pla: sèries x duració i ritme objectiu
    setText('quality-summary', quality.length ? `${quality.length} sessions` : '—');
    setText('quality-detail',
      `Pla: ${activeWeek.qSeries} sèr · ${activeWeek.qDuradaSerie}' · ${activeWeek.qRitme} min/km`);
  } else {
    setText('quality-summary', quality.length ? `${quality.length} sessions` : '—');
    setText('quality-detail', 'Sense planning setmanal disponible');
  }
  // Real: si hi ha sessions de qualitat, afegir ritme i FC de sèries
  if (quality.length) {
    const ritmeMitja = quality.map(s => s.ritmeMitjaSeries).filter(v => isFinite(v));
    const fcMitja    = quality.map(s => s.fcMitjaSeries).filter(v => isFinite(v));
    const ritmeTxt   = ritmeMitja.length
      ? formatNumber(ritmeMitja.reduce((a, b) => a + b, 0) / ritmeMitja.length) + ' min/km'
      : '--';
    const fcTxt = fcMitja.length
      ? Math.round(fcMitja.reduce((a, b) => a + b, 0) / fcMitja.length) + ' ppm'
      : '--';
    setText('quality-real', `Real: ${formatNumber(qualityKm)} km · ${ritmeTxt} · ${fcTxt}`);
  } else {
    setText('quality-real', '');
  }

  // ─ Z1+Z2 running ───────────────────────────────────────────────
  setText('z2-summary', z1z2Minutes ? `${formatNumber(z1z2Minutes)} min` : '—');
  setText('z2-detail', activeWeek
    ? `Ritme objectiu Z2: ${activeWeek.z2PaceMin}–${activeWeek.z2PaceMax} min/km`
    : 'Sense rang de ritme planificat');

  // ─ Tirada llarga ───────────────────────────────────────────────
  setText('long-summary', longKm ? `${formatNumber(longKm)} km` : '—');
  if (activeWeek) {
    setText('long-detail', `Pla: ${activeWeek.llTipus} · ${formatNumber(activeWeek.llKm)} km`);
  } else {
    setText('long-detail', 'Sense tirada llarga planificada');
  }
  // Real: si hi ha activitat llarga, mostrar km, desnivell i FC
  if (llong.length) {
    const lastLong   = llong[0]; // ja ordenades de més recent
    const desnivell  = isFinite(lastLong.desnivell) ? `${formatNumber(lastLong.desnivell)} m` : '--';
    const fc         = isFinite(lastLong.fcMitja)   ? `${Math.round(lastLong.fcMitja)} ppm`  : '--';
    setText('long-real', `Real: ${formatNumber(longKm)} km · D+ ${desnivell} · FC ${fc}`);
  } else {
    setText('long-real', '');
  }

  // ─ Força ────────────────────────────────────────────────────────
  setText('strength-summary', strength.length ? `${strength.length} sessions` : '—');
  setText('strength-detail', activeWeek
    ? `Pla: ${activeWeek.forcaPlan} · ${formatNumber(strengthMin)} min reals`
    : 'Sense sessions de força aquesta setmana');
}

// ── Panell Test & Cursa ───────────────────────────────────────────────────────
function renderTestRacePanel(sessions) {
  const container = document.getElementById('test-race-container');
  if (!container) return;

  const lastTest  = sessions.find(s => s.tipusKey === 'TEST');
  const lastCursa = sessions.find(s => s.tipusKey === 'CURSA');

  function rowHTML(label, s) {
    if (!s) return `
      <tr class="tr-empty">
        <td colspan="5"><span class="eyebrow">${label}</span> — Sense registre</td>
      </tr>`;
    return `
      <tr>
        <td><span class="eyebrow">${label}</span></td>
        <td>${esc(s.displayDate)}</td>
        <td>${formatMetric(s.distancia, 'km')}</td>
        <td>${formatMetric(s.ritme, 'min/km')}</td>
        <td>${formatMetric(s.carrega, '')}</td>
      </tr>`;
  }

  container.innerHTML = `
    <table class="sw-mini-table">
      <thead>
        <tr>
          <th>Tipus</th>
          <th>Data</th>
          <th>Distància</th>
          <th>Ritme</th>
          <th>Càrrega</th>
        </tr>
      </thead>
      <tbody>
        ${rowHTML('Test', lastTest)}
        ${rowHTML('Cursa', lastCursa)}
      </tbody>
    </table>`;
}

// ── Panell Altres activitats ──────────────────────────────────────────────────
function renderOthersPanel(sessions) {
  const container = document.getElementById('others-container');
  if (!container) return;

  const others   = sessions.filter(s => isOther(s));
  const totalMin = sumNumbers(others.map(s => s.durada));

  setText('others-count', others.length
    ? `${others.length} sessions · ${formatNumber(totalMin)} min totals`
    : 'Sense activitats registrades');

  container.innerHTML = others.length
    ? `<table class="sw-mini-table">
        <thead>
          <tr><th>Data</th><th>Tipus</th><th>Durada</th><th>Càrrega</th></tr>
        </thead>
        <tbody>
          ${others.map(s => `
            <tr>
              <td>${esc(s.displayDate)}</td>
              <td>${esc(s.tipus)}</td>
              <td>${formatMetric(s.durada, 'min')}</td>
              <td>${formatMetric(s.carrega, '')}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="plan-no-data">Cap activitat alternativa registrada.</p>';
}
