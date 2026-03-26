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
  renderTestRacePanel(sessions);   // totes les sessions per trobar la darrera
  renderOthersPanel(sessions);     // totes les sessions pel filtre per exclusió

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
  // Qualitat: TEMPO + INTERVALS (sense TEST)
  const quality    = weeklySessions.filter(s => QUALITY_TYPES.has(s.tipusKey));
  const llong      = weeklySessions.filter(s => LONG_TYPES.has(s.tipusKey));
  const strength   = weeklySessions.filter(s => isStrength(s));

  // Z1+Z2: només sessions de running
  const runningSessions = weeklySessions.filter(s => isRunning(s));
  const z1z2Minutes     = sumNumbers(runningSessions.map(s => (s.z1min || 0) + (s.z2min || 0)));

  const qualityKm  = sumNumbers(quality.map(s => s.distancia));
  const longKm     = sumNumbers(llong.map(s => s.distancia));
  const strengthMin = sumNumbers(strength.map(s => s.durada));

  // Qualitat
  setText('quality-summary', quality.length ? `${quality.length} sessions` : '—');
  setText('quality-detail', activeWeek
    ? `Pla: ${activeWeek.qSeries} sèries · Km reals: ${formatNumber(qualityKm)}`
    : 'Sense planning setmanal disponible');

  // Z1+Z2 running
  setText('z2-summary', z1z2Minutes ? `${formatNumber(z1z2Minutes)} min` : '—');
  setText('z2-detail', activeWeek
    ? `Ritme objectiu Z2: ${activeWeek.z2PaceMin}–${activeWeek.z2PaceMax} min/km`
    : 'Sense rang de ritme planificat');

  // Tirada llarga
  setText('long-summary', longKm ? `${formatNumber(longKm)} km` : '—');
  setText('long-detail', activeWeek
    ? `Pla: ${activeWeek.llTipus} · ${formatNumber(activeWeek.llKm)} km`
    : 'Sense tirada llarga planificada');

  // Força
  setText('strength-summary', strength.length ? `${strength.length} sessions` : '—');
  setText('strength-detail', activeWeek
    ? `Pla: ${activeWeek.forcaPlan} · ${formatNumber(strengthMin)} min reals`
    : 'Sense sessions de força aquesta setmana');
}

// ── Panell Test & Cursa ───────────────────────────────────────────────────────
function renderTestRacePanel(sessions) {
  const container = document.getElementById('test-race-container');
  if (!container) return;

  // Darrera sessió de cada tipus (sessions ja ordenades de més recent a més antiga)
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

  // Filtre per exclusió: no running, no força, no test/cursa
  const others = sessions.filter(s => isOther(s));

  const totalMin = sumNumbers(others.map(s => s.durada));
  setText('others-count', others.length
    ? `${others.length} sessions · ${formatNumber(totalMin)} min totals`
    : 'Sense activitats registrades');

  container.innerHTML = others.length
    ? `<table class="sw-mini-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipus</th>
            <th>Durada</th>
            <th>Càrrega</th>
          </tr>
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
