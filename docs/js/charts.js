// charts.js — Fase 3: visualitzacions Chart.js
// Rep les dades ja processades des de app.js via initCharts()
// DEP: app.js ha d'estar carregat abans (usa CHART_COLORS des d'aquí)

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

  renderZonesChart(enrichedSessions);
}

function destroyAll() {
  Object.values(chartInstances).forEach(chart => chart.destroy());
  Object.keys(chartInstances).forEach(key => delete chartInstances[key]);
}

// ── Gràfic: Zones cardíaques — últims 30 dies ────────────────────────────────
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
