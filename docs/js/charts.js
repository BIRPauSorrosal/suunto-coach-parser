// charts.js — Fase 3: visualitzacions Chart.js
// Rep les dades ja processades des de app.js via initCharts()
// DEP: app.js ha d'estar carregat abans (usa CHART_COLORS des d'aquí)

// FC_SCALE ve de fc-scale.js (carregat abans a index.html)
// Genera els colors del gràfic dinàmicament des de la mateixa font que els badges.
function _fcZoneColors(alpha = 0.85) {
  const HEX = {
    'fc-z1': '#38bdf8',
    'fc-z2': '#22c55e',
    'fc-z3': '#facc15',
    'fc-z4': '#f97316',
    'fc-z5': '#ef4444',
  };
  return FC_SCALE.map(tier => {
    const hex = HEX[tier.cls];
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  });
}

const CHART_COLORS = {
  green:    '#22c55e',
  greenSoft:'rgba(34, 197, 94, 0.25)',
  blue:     '#38bdf8',
  blueSoft: 'rgba(56, 189, 248, 0.25)',
  muted:    'rgba(148, 163, 184, 0.15)',
  gridLine: 'rgba(148, 163, 184, 0.1)',
  text:     '#94a3b8',
  get zones() { return _fcZoneColors(0.85); },
};

const chartInstances = {};

// Referència a les sessions actuals per poder re-renderitzar sense recarregar dades
let _lastSessions  = null;
let _lastPlanning  = null;

// ── Punt d'entrada ───────────────────────────────────────────────────────────
function initCharts(enrichedSessions, enrichedPlanning) {
  _lastSessions = enrichedSessions;
  _lastPlanning = enrichedPlanning;

  destroyAll();
  Chart.defaults.color = CHART_COLORS.text;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

  renderZonesChart(enrichedSessions);
  _injectZonesConfigButton();
}

function destroyAll() {
  Object.values(chartInstances).forEach(chart => chart.destroy());
  Object.keys(chartInstances).forEach(key => delete chartInstances[key]);
}

// ── Botó ⚙ al panell de zones ────────────────────────────────────────────────
function _injectZonesConfigButton() {
  // Evita duplicats si initCharts es crida diverses vegades
  if (document.getElementById('btn-fc-config')) return;

  // Troba el panel-header del panell de zones (el que conté #chart-zones)
  const canvas = document.getElementById('chart-zones');
  if (!canvas) return;
  const panelHeader = canvas.closest('.panel')?.querySelector('.panel-header');
  if (!panelHeader) return;

  const btn = document.createElement('button');
  btn.id        = 'btn-fc-config';
  btn.className = 'btn btn-ghost btn-sm btn-fc-config';
  btn.title     = 'Configurar zones de FC';
  btn.innerHTML = '⚙ Zones FC';
  btn.addEventListener('click', () => openFCConfigModal());

  // Insereix el botó dins del badge existent (al costat del "Últims 30 dies")
  const badgeEl = panelHeader.querySelector('.badge');
  if (badgeEl) {
    badgeEl.insertAdjacentElement('afterend', btn);
  } else {
    panelHeader.appendChild(btn);
  }
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
  const zoneLabels = FC_SCALE.map((z, i) => `${z.label.split('·')[0].trim()} · ${FC_CONFIG.zones[i]} bpm`);

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