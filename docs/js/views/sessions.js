// docs/js/views/sessions.js
// Panell Sessions: filtres tipus + període, KPIs, gràfic de tendència, taula
// Dep: app.js (formatPace, toNumber, esc) | charts.js (CHART_COLORS)

let _sessSessions = [];
let _sessType     = 'all';
let _sessPeriod   = 180; // dies (0 = sempre, -1 = setmana actual)
let _sessChart    = null; // instància Chart.js activa al panell sessions

const SESS_GROUPS = {
  z2:        s => s.tipusKey === 'Z2',
  quality:   s => ['TEMPO', 'INTERVALS'].includes(s.tipusKey),
  long:      s => ['LLARGA', 'MARAT\u00d6', 'TRAIL', 'MITJA', 'MARATO'].includes(s.tipusKey),
  testrace:  s => ['TEST', 'CURSA'].includes(s.tipusKey),
  strength:  s => /^FOR[\u00c7C]A/i.test(s.tipusKey),
  other:     s => !['Z2','TEMPO','INTERVALS','LLARGA','MARAT\u00d6','TRAIL','MITJA','MARATO',
                    'TEST','CURSA'].includes(s.tipusKey) && !/^FOR[\u00c7C]A/i.test(s.tipusKey),
};

const SESS_TYPE_LABELS = {
  all:      'Totes les sessions',
  z2:       'Sessions Z2',
  quality:  'Sessions de qualitat',
  long:     'Tirades llargues',
  testrace: 'Test i curses',
  strength: 'Sessions de for\u00e7a',
  other:    'Altres activitats',
};

// ── Punt d'entrada ──────────────────────────────────────────────────────────
function renderSessionsView(sessions) {
  _sessSessions = sessions;
  initSessFilters();
  renderSessPanel();
}

// ── Inicialitza listeners dels filtres ──────────────────────────────────────
function initSessFilters() {
  const sel = document.getElementById('sess-type-select');
  if (sel) {
    const newSel = sel.cloneNode(true);
    sel.replaceWith(newSel);
    newSel.value = _sessType;
    newSel.addEventListener('change', () => {
      _sessType = newSel.value;
      renderSessPanel();
    });
  }

  document.querySelectorAll('.sess-period-btns [data-period]').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.sess-period-btns [data-period]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.period) === _sessPeriod);
    btn.addEventListener('click', () => {
      _sessPeriod = parseInt(btn.dataset.period);
      document.querySelectorAll('.sess-period-btns [data-period]')
        .forEach(b => b.classList.toggle('active', parseInt(b.dataset.period) === _sessPeriod));
      renderSessPanel();
    });
  });
}

// ── Render principal ────────────────────────────────────────────────────────
function renderSessPanel() {
  const filtered = applyFilters(_sessSessions);
  // Ordre: KPIs → gràfic → taula
  renderSessKPIs(filtered);
  renderSessTrendChart(filtered);
  renderSessTable(filtered);
}

// ── Filtratge ───────────────────────────────────────────────────────────────
function applyFilters(sessions) {
  let result = sessions;

  if (_sessPeriod === -1) {
    const today  = new Date();
    const dow    = today.getDay();
    const toMon  = (dow === 0 ? -6 : 1 - dow);
    const monday = new Date(today);
    monday.setDate(today.getDate() + toMon);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    result = result.filter(s => s.date >= monday && s.date <= sunday);
  } else if (_sessPeriod > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - _sessPeriod);
    cutoff.setHours(0, 0, 0, 0);
    result = result.filter(s => s.date >= cutoff);
  }

  if (_sessType !== 'all') {
    const fn = SESS_GROUPS[_sessType];
    if (fn) result = result.filter(fn);
  }
  return result;
}

// ── KPIs dinàmics ────────────────────────────────────────────────────────────
function renderSessKPIs(sessions) {
  const totalKm   = sessions.reduce((a, s) => a + (s.distancia || 0), 0);
  const totalMin  = sessions.reduce((a, s) => a + (s.durada    || 0), 0);
  const totalLoad = sessions.reduce((a, s) => a + (s.carrega   || 0), 0);
  const totalEpoc = sessions.reduce((a, s) => {
    const e = toNumber(s.raw['EPOC']);
    return a + (isFinite(e) && e > 0 ? e : 0);
  }, 0);

  const h   = Math.floor(totalMin / 60);
  const min = Math.round(totalMin % 60);
  const timeTxt = totalMin > 0
    ? (h > 0 ? `${h}h ${min}min` : `${min} min`)
    : '--';

  setSessText('kpi-km',   totalKm  > 0 ? `${fmtS(totalKm)} km`    : '--');
  setSessText('kpi-time', timeTxt);
  setSessText('kpi-load', totalLoad > 0 ? `${fmtS(totalLoad)} TSS` : '--');
  setSessText('kpi-epoc', totalEpoc > 0 ? fmtS(totalEpoc)           : '--');
}

// ── Gràfic de tendència ───────────────────────────────────────────────────────
function renderSessTrendChart(sessions) {
  const ctx = document.getElementById('chart-sess-trend');
  if (!ctx) return;

  // Destruir gràfic anterior si existeix
  if (_sessChart) { _sessChart.destroy(); _sessChart = null; }

  // Amb menys de 2 punts no te sentit dibuixar
  if (sessions.length < 2) {
    ctx.style.display = 'none';
    return;
  }
  ctx.style.display = '';

  // Agrupa per setmana ISO (dilluns) en ordre cronològic
  const byWeek = groupByWeek(sessions);
  const labels  = byWeek.map(w => w.label);

  _sessChart = new Chart(ctx, buildSessChartConfig(byWeek, labels));
}

// ── Agrupa sessions per setmana (dilluns com a clau) ──────────────────────
function groupByWeek(sessions) {
  const map = new Map();

  // Ordenem cronològicament (asc) — sessions ve en ordre desc
  const sorted = [...sessions].sort((a, b) => a.date - b.date);

  sorted.forEach(s => {
    const monday = getMondayOf(s.date);
    const key    = monday.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, { date: monday, sessions: [] });
    }
    map.get(key).sessions.push(s);
  });

  return Array.from(map.values()).map(w => {
    const ss = w.sessions;
    const totalKm    = ss.reduce((a, s) => a + (s.distancia || 0), 0);
    const totalLoad  = ss.reduce((a, s) => a + (s.carrega   || 0), 0);
    const totalEpoc  = ss.reduce((a, s) => {
      const e = toNumber(s.raw['EPOC']); return a + (isFinite(e) && e > 0 ? e : 0);
    }, 0);
    const avgPace    = avgValidPace(ss);
    const avgFC      = avgValid(ss, s => s.fcMitja);
    const avgPaceSeries = avgValid(ss, s => isFinite(s.ritmeMitjaSeries) && s.ritmeMitjaSeries > 0 ? s.ritmeMitjaSeries : null);

    // Etiqueta: setmana DD/MM
    const d  = w.date;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return {
      label: `${dd}/${mm}`,
      km:          Math.round(totalKm  * 10) / 10,
      load:        Math.round(totalLoad * 10) / 10,
      epoc:        Math.round(totalEpoc * 10) / 10,
      avgPace,
      avgFC:       avgFC   ? Math.round(avgFC)       : null,
      avgPaceSeries: avgPaceSeries ? Math.round(avgPaceSeries * 100) / 100 : null,
      count:       ss.length,
    };
  });
}

function getMondayOf(date) {
  const d   = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function avgValidPace(sessions) {
  const vals = sessions
    .map(s => s.ritme)
    .filter(v => isFinite(v) && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function avgValid(sessions, fn) {
  const vals = sessions.map(fn).filter(v => v != null && isFinite(v) && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// ── Configuració del gràfic segons tipus actiu ─────────────────────────────
function buildSessChartConfig(byWeek, labels) {
  const C = CHART_COLORS;
  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
    },
    scales: {
      x: { grid: { color: C.gridLine }, ticks: { font: { size: 11 } } },
    }
  };

  const yBase = {
    grid:     { color: C.gridLine },
    ticks:    { font: { size: 11 } },
    beginAtZero: true,
  };

  switch (_sessType) {

    // ─ Qualitat: ritme sèries (línia) + càrrega TSS (barres) ────────────────
    case 'quality': {
      const hasRitme = byWeek.some(w => w.avgPaceSeries !== null);
      const datasets = [{
        type: 'bar',
        label: 'C\u00e0rrega (TSS)',
        data: byWeek.map(w => w.load),
        backgroundColor: C.greenSoft,
        borderColor:     C.green,
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y',
      }];
      if (hasRitme) datasets.push({
        type: 'line',
        label: 'Ritme s\u00e8ries (min/km)',
        data: byWeek.map(w => w.avgPaceSeries),
        borderColor: C.blue,
        backgroundColor: C.blueSoft,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        yAxisID: 'y2',
        spanGaps: true,
      });
      return {
        type: 'bar',
        data: { labels, datasets },
        options: {
          ...baseOpts,
          plugins: {
            ...baseOpts.plugins,
            tooltip: { callbacks: { label: c => {
              if (c.dataset.yAxisID === 'y2') return ` Ritme: ${formatPace(c.parsed.y, '')}`;
              return ` C\u00e0rrega: ${c.parsed.y} TSS`;
            }}}
          },
          scales: {
            x: baseOpts.scales.x,
            y:  { ...yBase, position: 'left',  ticks: { ...yBase.ticks, callback: v => `${v} TSS` } },
            y2: { ...yBase, position: 'right', grid: { drawOnChartArea: false },
                  ticks: { ...yBase.ticks, callback: v => formatPace(v, '') }, reverse: true },
          }
        }
      };
    }

    // ─ Força: càrrega TSS + EPOC per sessió (barres) ─────────────────────
    case 'strength': {
      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'C\u00e0rrega (TSS)',
              data: byWeek.map(w => w.load),
              backgroundColor: C.greenSoft,
              borderColor:     C.green,
              borderWidth: 1,
              borderRadius: 6,
            },
            {
              label: 'EPOC',
              data: byWeek.map(w => w.epoc),
              backgroundColor: 'rgba(249,115,22,0.2)',
              borderColor:     'rgba(249,115,22,0.9)',
              borderWidth: 1,
              borderRadius: 6,
            }
          ]
        },
        options: {
          ...baseOpts,
          plugins: { ...baseOpts.plugins, tooltip: { callbacks: {
            label: c => ` ${c.dataset.label}: ${c.parsed.y}`
          }}},
          scales: { x: baseOpts.scales.x, y: { ...yBase } }
        }
      };
    }

    // ─ Tirada llarga: Km (barres) + ritme (línia) eix doble ───────────────
    case 'long': {
      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: 'Km',
              data: byWeek.map(w => w.km),
              backgroundColor: C.blueSoft,
              borderColor:     C.blue,
              borderWidth: 1,
              borderRadius: 6,
              yAxisID: 'y',
            },
            {
              type: 'line',
              label: 'Ritme mig (min/km)',
              data: byWeek.map(w => w.avgPace),
              borderColor:     C.green,
              backgroundColor: C.greenSoft,
              borderWidth: 2,
              pointRadius: 4,
              tension: 0.3,
              yAxisID: 'y2',
              spanGaps: true,
            }
          ]
        },
        options: {
          ...baseOpts,
          plugins: { ...baseOpts.plugins, tooltip: { callbacks: {
            label: c => c.dataset.yAxisID === 'y2'
              ? ` Ritme: ${formatPace(c.parsed.y, '')}`
              : ` Km: ${c.parsed.y} km`
          }}},
          scales: {
            x: baseOpts.scales.x,
            y:  { ...yBase, position: 'left',  ticks: { ...yBase.ticks, callback: v => `${v} km` } },
            y2: { ...yBase, position: 'right', grid: { drawOnChartArea: false },
                  ticks: { ...yBase.ticks, callback: v => formatPace(v, '') }, reverse: true },
          }
        }
      };
    }

    // ─ Z2: Km setmanal (barres) + FC mitja (línia) ──────────────────────
    case 'z2': {
      const hasFC = byWeek.some(w => w.avgFC !== null);
      const datasets = [{
        type: 'bar',
        label: 'Km Z2',
        data: byWeek.map(w => w.km),
        backgroundColor: C.greenSoft,
        borderColor:     C.green,
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y',
      }];
      if (hasFC) datasets.push({
        type: 'line',
        label: 'FC mitja (ppm)',
        data: byWeek.map(w => w.avgFC),
        borderColor:     C.blue,
        backgroundColor: C.blueSoft,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        yAxisID: 'y2',
        spanGaps: true,
      });
      return {
        type: 'bar',
        data: { labels, datasets },
        options: {
          ...baseOpts,
          plugins: { ...baseOpts.plugins, tooltip: { callbacks: {
            label: c => c.dataset.yAxisID === 'y2'
              ? ` FC: ${c.parsed.y} ppm`
              : ` Km Z2: ${c.parsed.y} km`
          }}},
          scales: {
            x: baseOpts.scales.x,
            y:  { ...yBase, position: 'left',  ticks: { ...yBase.ticks, callback: v => `${v} km` } },
            y2: hasFC
              ? { ...yBase, position: 'right', grid: { drawOnChartArea: false },
                  ticks: { ...yBase.ticks, callback: v => `${v} ppm` } }
              : { display: false },
          }
        }
      };
    }

    // ─ Test/Cursa: ritme (línia, cada sessió, no per setmana) ─────────────
    // Per aquest tipus és més útil una línia de sessió a sessió
    case 'testrace': {
      const sorted = [...sessions].sort((a, b) => a.date - b.date);
      const sessLabels = sorted.map(s => s.displayDate);
      const ritmes     = sorted.map(s => isFinite(s.ritme) && s.ritme > 0 ? s.ritme : null);
      return {
        type: 'line',
        data: {
          labels: sessLabels,
          datasets: [{
            label: 'Ritme (min/km)',
            data: ritmes,
            borderColor:     C.blue,
            backgroundColor: C.blueSoft,
            borderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.2,
            spanGaps: false,
          }]
        },
        options: {
          ...baseOpts,
          plugins: { ...baseOpts.plugins, tooltip: { callbacks: {
            label: c => c.parsed.y ? ` Ritme: ${formatPace(c.parsed.y, '')}` : ' --'
          }}},
          scales: {
            x: baseOpts.scales.x,
            y: { ...yBase, reverse: true,
              ticks: { ...yBase.ticks, callback: v => formatPace(v, '') } },
          }
        }
      };
    }

    // ─ All / Altres: Km setmanal (barres) + càrrega (línia) ───────────────
    default: {
      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: 'Km',
              data: byWeek.map(w => w.km),
              backgroundColor: C.blueSoft,
              borderColor:     C.blue,
              borderWidth: 1,
              borderRadius: 6,
              yAxisID: 'y',
            },
            {
              type: 'line',
              label: 'C\u00e0rrega (TSS)',
              data: byWeek.map(w => w.load),
              borderColor:     C.green,
              backgroundColor: 'transparent',
              borderWidth: 2,
              pointRadius: 3,
              tension: 0.3,
              yAxisID: 'y2',
              spanGaps: true,
            }
          ]
        },
        options: {
          ...baseOpts,
          plugins: { ...baseOpts.plugins, tooltip: { callbacks: {
            label: c => c.dataset.yAxisID === 'y2'
              ? ` C\u00e0rrega: ${c.parsed.y} TSS`
              : ` Km: ${c.parsed.y} km`
          }}},
          scales: {
            x: baseOpts.scales.x,
            y:  { ...yBase, position: 'left',  ticks: { ...yBase.ticks, callback: v => `${v} km` } },
            y2: { ...yBase, position: 'right', grid: { drawOnChartArea: false },
                  ticks: { ...yBase.ticks, callback: v => `${v} TSS` } },
          }
        }
      };
    }
  }
}

// ── Taula intel·ligent ──────────────────────────────────────────────────────
function renderSessTable(sessions) {
  const thead = document.getElementById('sess-thead');
  const tbody = document.getElementById('sess-tbody');
  const title = document.getElementById('sess-table-title');
  const badge = document.getElementById('sess-count-badge');
  if (!thead || !tbody) return;

  if (title) title.textContent = SESS_TYPE_LABELS[_sessType] || 'Sessions';
  if (badge) badge.textContent = `${sessions.length} sessions`;

  const cols = getSessCols(_sessType);
  thead.innerHTML = `<tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr>`;

  if (!sessions.length) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty-row">Cap sessi\u00f3 amb els filtres seleccionats.</td></tr>`;
    return;
  }

  tbody.innerHTML = sessions.map(s => {
    const cells = cols.map(c => `<td>${c.render(s)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
}

// ── Definició de columnes per tipus ─────────────────────────────────────────
function getSessCols(type) {
  const colData    = { label: 'Data',              render: s => escS(s.displayDate) };
  const colTipus   = { label: 'Tipus',              render: s => escS(s.tipus) };
  const colKm      = { label: 'Km',                 render: s => s.distancia > 0 ? `${fmtS(s.distancia)} km` : '\u2014' };
  const colDurada  = { label: 'Durada',             render: s => s.durada > 0 ? `${fmtS(s.durada)} min` : '\u2014' };
  const colRitme   = { label: 'Ritme',              render: s => formatPace(s.ritme) };
  const colFC      = { label: 'FC',                 render: s => isFinite(s.fcMitja) && s.fcMitja > 0 ? `${Math.round(s.fcMitja)} ppm` : '\u2014' };
  const colCarrega = { label: 'C\u00e0rrega TSS',   render: s => isFinite(s.carrega) && s.carrega > 0 ? `${fmtS(s.carrega)} TSS` : '\u2014' };
  const colZ2min   = { label: 'Z2 (min)',           render: s => s.z2min > 0 ? `${fmtS(s.z2min)} min` : '\u2014' };
  const colCad     = { label: 'Cad\u00e8ncia',      render: s => {
    const c = toNumber(s.raw['Cadencia(spm)']);
    return isFinite(c) && c > 0 ? `${Math.round(c)} spm` : '\u2014';
  }};
  const colDesnivell = { label: 'Desnivell',        render: s => {
    const d = toNumber(s.raw['Desnivell(m)']);
    return isFinite(d) && d > 0 ? `${Math.round(d)} m` : '\u2014';
  }};
  const colEpoc    = { label: 'EPOC',               render: s => {
    const e = toNumber(s.raw['EPOC']);
    return isFinite(e) && e > 0 ? fmtS(e) : '\u2014';
  }};
  const colRecup   = { label: 'Recup.',             render: s => {
    const r = toNumber(s.raw['Recup(h)']);
    return isFinite(r) && r > 0 ? `${fmtS(r)} h` : '\u2014';
  }};
  const colRitmeSeries = { label: 'Ritme s\u00e8ries', render: s =>
    formatPace(isFinite(s.ritmeMitjaSeries) ? s.ritmeMitjaSeries : null)
  };
  const colFCSeries = { label: 'FC s\u00e8ries',     render: s =>
    isFinite(s.fcMitjaSeries) && s.fcMitjaSeries > 0 ? `${Math.round(s.fcMitjaSeries)} ppm` : '\u2014'
  };
  const colSeries  = { label: 'S\u00e8ries',         render: s => {
    const n = toNumber(s.raw['Num_Series']);
    return isFinite(n) && n > 0 ? String(Math.round(n)) : '\u2014';
  }};
  const colPTE     = { label: 'PTE',                render: s => {
    const p = toNumber(s.raw['PTE']);
    return isFinite(p) && p > 0 ? fmtS(p) : '\u2014';
  }};

  switch (type) {
    case 'z2':       return [colData, colKm, colDurada, colRitme, colCad, colFC, colZ2min, colEpoc, colCarrega];
    case 'quality':  return [colData, colTipus, colKm, colDurada, colSeries, colRitmeSeries, colFCSeries, colPTE, colCarrega];
    case 'long':     return [colData, colTipus, colKm, colDurada, colRitme, colZ2min, colDesnivell, colFC, colCarrega];
    case 'testrace': return [colData, colTipus, colKm, colDurada, colRitme, colFC, colDesnivell, colEpoc, colCarrega];
    case 'strength': return [colData, colTipus, colDurada, colEpoc, colRecup, colCarrega];
    case 'other':    return [colData, colTipus, colDurada, colFC, colEpoc, colCarrega];
    default:         return [colData, colTipus, colKm, colDurada, colFC, colEpoc, colCarrega];
  }
}

// ── Helpers locals ───────────────────────────────────────────────────────────
function fmtS(value) {
  const n = parseFloat(value);
  if (!isFinite(n)) return '--';
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(n);
}

function setSessText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escS(v) {
  return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
