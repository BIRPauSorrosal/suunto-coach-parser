// docs/js/views/overview.js
// Vista Overview: hero-cards + metric-boxes + gràfics
// Dep: app.js (state, QUALITY_TYPES, LONG_TYPES, EXTRA_TYPES, helpers)

// ── Punt d'entrada ────────────────────────────────────────────────────────────
function renderOverviewView(sessions, planning) {
  const activeWeek = detectActiveWeek(planning, sessions);
  const weeklySessions = activeWeek
    ? sessions.filter(s => s.date >= activeWeek.startDate && s.date <= activeWeek.endDate)
    : [];

  renderOverview(activeWeek, weeklySessions);
  renderSummary(activeWeek, weeklySessions);

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

// ── Metric-boxes ──────────────────────────────────────────────────────────────
function renderSummary(activeWeek, weeklySessions) {
  const quality = weeklySessions.filter(s => QUALITY_TYPES.has(s.tipusKey));
  const z2      = weeklySessions.filter(s => s.tipusKey === 'Z2');
  const llong   = weeklySessions.filter(s => LONG_TYPES.has(s.tipusKey));
  const extra   = weeklySessions.filter(s =>
    s.tipusKey.startsWith('FORÇA') || s.tipusKey.startsWith('FORCA') || EXTRA_TYPES.has(s.tipusKey)
  );

  const qualityKm = sumNumbers(quality.map(s => s.distancia));
  const z2Minutes = sumNumbers(weeklySessions.map(s => s.z2min));
  const longKm    = sumNumbers(llong.map(s => s.distancia));

  setText('quality-summary', `${quality.length} sessions`);
  setText('quality-detail', activeWeek
    ? `Pla: ${activeWeek.qSeries} sèries · Km reals: ${formatNumber(qualityKm)}`
    : 'Sense planning setmanal disponible');

  setText('z2-summary', `${formatNumber(z2Minutes)} min`);
  setText('z2-detail', activeWeek
    ? `Ritme objectiu: ${activeWeek.z2PaceMin}–${activeWeek.z2PaceMax} min/km`
    : 'Sense rang de ritme planificat');

  setText('long-summary', `${formatNumber(longKm)} km`);
  setText('long-detail', activeWeek
    ? `Pla: ${activeWeek.llTipus} · ${formatNumber(activeWeek.llKm)} km`
    : 'Sense tirada llarga planificada');

  setText('extra-summary', `${extra.length} sessions`);
  setText('extra-detail', activeWeek
    ? `Força: ${activeWeek.forcaPlan} · Pàdel: ${activeWeek.padelPlan}`
    : 'Sense treball complementari planificat');
}
