// charts.js — Fase 3: visualitzacions Chart.js
// Rep les dades ja processades des de app.js via initCharts()

const CHART_COLORS = {
  green:       '#22c55e',
  greenSoft:   'rgba(34, 197, 94, 0.25)',
  blue:        '#38bdf8',
  blueSoft:    'rgba(56, 189, 248, 0.25)',
  muted:       'rgba(148, 163, 184, 0.15)',
  gridLine:    'rgba(148, 163, 184, 0.1)',
  text:        '#94a3b8',
  zones: [
    'rgba(56, 189, 248, 0.85)',
    'rgba(34, 197, 94, 0.85)',
    'rgba(250, 204, 21, 0.85)',
    'rgba(249, 115, 22, 0.85)',
    'rgba(239, 68, 68, 0.85)',
  ]
};

const chartInstances = {};

// ── Punt d'entrada ───────────────────────────────────────────────────────────
function initCharts(enrichedSessions, enrichedPlanning) {
  destroyAll();
  Chart.defaults.color = CHART_COLORS.text;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

  const weeklyData = buildWeeklyData(enrichedSessions, enrichedPlanning);

  renderKmChart(weeklyData);
  renderLoadChart(weeklyData);
  renderZonesChart(enrichedSessions);
}

function destroyAll() {
  Object.values(chartInstances).forEach(chart => chart.destroy());
  Object.keys(chartInstances).forEach(key => delete chartInstances[key]);
}

// ── Dades setmanals ──────────────────────────────────────────────────────────
function buildWeeklyData(sessions, planning) {
  return planning.map(week => {
    const weekSessions = sessions.filter(s =>
      s.date >= week.startDate && s.date <= week.endDate
    );
    const realKm   = weekSessions.reduce((acc, s) => acc + (s.distancia || 0), 0);
    const realLoad = weekSessions.reduce((acc, s) => acc + (s.carrega   || 0), 0);
    return {
      label:     week.setmana,
      plannedKm: week.kmTotal   || 0,
      realKm:    Math.round(realKm   * 10) / 10,
      realLoad:  Math.round(realLoad * 10) / 10,
    };
  });
}

// ── Gràfic 1: Km Pla vs Real ────────────────────────────────────────────────
function renderKmChart(weeklyData) {
  const ctx = document.getElementById('chart-km');
  if (!ctx) return;

  chartInstances['km'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeklyData.map(w => w.label),
      datasets: [
        {
          label: 'Planificat',
          data: weeklyData.map(w => w.plannedKm),
          backgroundColor: CHART_COLORS.blueSoft,
          borderColor:     CHART_COLORS.blue,
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: 'Real',
          data: weeklyData.map(w => w.realKm),
          backgroundColor: CHART_COLORS.greenSoft,
          borderColor:     CHART_COLORS.green,
          borderWidth: 1,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} km` } }
      },
      scales: {
        x: { grid: { color: CHART_COLORS.gridLine }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: CHART_COLORS.gridLine },
          ticks: { callback: v => `${v} km`, font: { size: 11 } },
          beginAtZero: true
        }
      }
    }
  });
}

// ── Gràfic 2: Càrrega setmanal ───────────────────────────────────────────────
function renderLoadChart(weeklyData) {
  const ctx = document.getElementById('chart-load');
  if (!ctx) return;

  const maxLoad = Math.max(...weeklyData.map(w => w.realLoad));

  chartInstances['load'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeklyData.map(w => w.label),
      datasets: [{
        label: 'Càrrega real',
        data: weeklyData.map(w => w.realLoad),
        backgroundColor: weeklyData.map(w =>
          w.realLoad === 0 ? CHART_COLORS.muted
          : w.realLoad === maxLoad ? 'rgba(249, 115, 22, 0.7)'
          : CHART_COLORS.greenSoft
        ),
        borderColor: weeklyData.map(w =>
          w.realLoad === 0 ? 'rgba(148, 163, 184, 0.3)'
          : w.realLoad === maxLoad ? 'rgba(249, 115, 22, 1)'
          : CHART_COLORS.green
        ),
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Càrrega: ${ctx.parsed.y}` } }
      },
      scales: {
        x: { grid: { color: CHART_COLORS.gridLine }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: CHART_COLORS.gridLine },
          ticks: { font: { size: 11 } },
          beginAtZero: true
        }
      }
    }
  });
}

// ── Gràfic 3: Zones cardíaques — últims 30 dies ─────────────────────────────
function renderZonesChart(sessions) {
  const ctx = document.getElementById('chart-zones');
  if (!ctx) return;

  // Filtre: només els últims 30 dies
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  cutoff.setHours(0, 0, 0, 0);
  const recent = sessions.filter(s => s.date >= cutoff);

  const zoneKeys   = ['Z1(min)', 'Z2(min)', 'Z3(min)', 'Z4(min)', 'Z5(min)'];
  const zoneLabels = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

  const totals = zoneKeys.map(key =>
    recent.reduce((acc, s) => {
      const v = parseFloat(s.raw[key]);
      return acc + (isFinite(v) ? v : 0);
    }, 0)
  );

  const totalMinutes = totals.reduce((a, b) => a + b, 0);
  if (totalMinutes === 0) return;

  chartInstances['zones'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: zoneLabels,
      datasets: [{
        data: totals.map(v => Math.round(v * 10) / 10),
        backgroundColor: CHART_COLORS.zones,
        borderColor:     'rgba(15, 23, 42, 0.8)',
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, padding: 14 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = ((ctx.parsed / totalMinutes) * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.parsed} min (${pct}%)`;
            }
          }
        }
      }
    }
  });
}
