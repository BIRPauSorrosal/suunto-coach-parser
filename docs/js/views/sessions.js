// docs/js/views/sessions.js
// Panell Sessions: filtres, KPIs, gràfic tendència, PMC + exportació CSV, taula
// Dep: lib/formatters.js (formatPace, fmtNum, toNumber, esc)
//      lib/metrics.js    (buildPMCData, groupByWeek, groupByDay, parseDurSeries)
//      lib/load-scale.js (loadBadgeHTML, loadDotHTML, getLoadLevelSession,
//                         getTSSLevel, tssBadgeHTML, tssDotHTML)
//      app.js            (CHART_COLORS via charts.js, STRENGTH_RE, PADEL_TYPES,
//                         QUALITY_TYPES, LONG_TYPES, TEST_RACE_TYPES, BICI_TYPES)
//      comment-editor.js (openSessionCommentEditor)
// NOTA: No declarar aquí constants de tipus — usar les de app.js

let _sessSessions = [];
let _sessType     = 'all';
let _sessPeriod   = 90;
let _sessChart    = null;
let _pmcChart     = null;
let _pmcDataCache = [];

// SESS_GROUPS: usa les constants centralitzades de app.js
const SESS_GROUPS = {
  z2:        s => s.tipusKey === 'Z2',
  quality:   s => QUALITY_TYPES.has(s.tipusKey),
  long:      s => LONG_TYPES.has(s.tipusKey),
  testrace:  s => TEST_RACE_TYPES.has(s.tipusKey),
  strength:  s => STRENGTH_RE.test(s.tipusKey),
  bici:      s => BICI_TYPES.has(s.tipusKey),
  other:     s => !RUNNING_TYPES.has(s.tipusKey) && !STRENGTH_RE.test(s.tipusKey)
               && !TEST_RACE_TYPES.has(s.tipusKey) && !PADEL_TYPES.has(s.tipusKey)
               && !BICI_TYPES.has(s.tipusKey),
};

const SESS_TYPE_LABELS = {
  all:      'Totes les sessions',
  z2:       'Sessions Z2',
  quality:  'Sessions de qualitat',
  long:     'Tirades llargues',
  testrace: 'Test i curses',
  strength: 'Sessions de força',
  bici:     'Bicicleta estàtica',
  other:    'Altres activitats',
};

// ── Llindar: <= 30 dies → agrupació diària, > 30 dies → setmanal ──────────────
const DAY_VIEW_THRESHOLD = 30;

// ── Punt d'entrada ──────────────────────────────────────────────────────────────
function renderSessionsView(sessions) {
  _sessSessions = Array.isArray(sessions) ? sessions : [];
  initSessFilters();
  renderSessPanel();
}

// ── Inicialitza listeners ──────────────────────────────────────────────────────
function initSessFilters() {
  const sel = document.getElementById('sess-type-select');
  if (sel) {
    const newSel = sel.cloneNode(true);
    sel.replaceWith(newSel);
    newSel.value = _sessType;
    newSel.addEventListener('change', () => { _sessType = newSel.value; renderSessPanel(); });
  }
  document.querySelectorAll('.sess-period-btns [data-period]').forEach(btn => {
    const clone = btn.cloneNode(true); btn.replaceWith(clone);
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

// ── Render principal ──────────────────────────────────────────────────────────
function renderSessPanel() {
  const filtered = applyFilters(_sessSessions);
  const pmcData = getSelectedPMCData();
  renderSessKPIs(filtered, pmcData);
  renderSessTrendChart(filtered);
  renderPMC();
  renderAnalyticsPerformance(filtered);
  renderAnalyticsPerformanceCharts(filtered);
  renderAnalyticsZones(filtered);
  renderAnalyticsMix(filtered);
  renderAnalyticsFeeling(filtered);
}

// ── Filtratge ──────────────────────────────────────────────────────────────────
function applyFilters(sessions) {
  let result = sessions;
  if (_sessPeriod === -1) {
    const today = new Date(), dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    result = result.filter(s => s.date >= monday && s.date <= sunday);
  } else if (_sessPeriod > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - _sessPeriod);
    cutoff.setHours(0,0,0,0);
    result = result.filter(s => s.date >= cutoff);
  }
  if (_sessType !== 'all') {
    const fn = SESS_GROUPS[_sessType];
    if (fn) result = result.filter(fn);
  }
  return result;
}

// ── KPIs ───────────────────────────────────────────────────────────────────────
function renderSessKPIs(sessions, pmcData) {
  const totalKm   = sessions.reduce((a,s) => a + (s.distancia||0), 0);
  const totalMin  = sessions.reduce((a,s) => a + (s.durada||0), 0);
  const totalLoad = sessions.reduce((a,s) => a + (s.carrega||0), 0);
  const totalEpoc = sessions.reduce((a,s) => {
    const e = toNumber(s.raw['EPOC']); return a + (typeof e==='number'&&e>0?e:0);
  }, 0);
  const h = Math.floor(totalMin/60), min = Math.round(totalMin%60);
  const timeTxt = totalMin>0 ? (h>0?`${h}h ${min}min`:`${min} min`) : '--';
  setSessText('kpi-km',   totalKm>0  ? `${fmtNum(totalKm)} km`    : '--');
  setSessText('kpi-time', timeTxt);
  setSessText('kpi-load', totalLoad>0 ? fmtNum(totalLoad) : '--');
  setSessText('kpi-epoc', totalEpoc>0 ? fmtNum(totalEpoc)          : '--');

  const latest = pmcData.length ? pmcData[pmcData.length - 1] : null;
  setSessText('analytics-ctl-value', latest ? fmtAnalyticsNumber(latest.ctl) : '—');
  setSessText('analytics-atl-value', latest ? fmtAnalyticsNumber(latest.atl) : '—');
  setSessText('analytics-tsb-value', latest ? formatSignedNumber(latest.tsb) : '—');
  setSessText('analytics-tsb-status', latest ? analyticsFormAssessment(latest.tsb) : 'Sense dades de forma');
}

function fmtAnalyticsNumber(value) {
  return typeof value === 'number' && isFinite(value) ? fmtNum(Math.round(value * 10) / 10) : '—';
}

function formatSignedNumber(value) {
  if (typeof value !== 'number' || !isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${fmtNum(rounded)}`;
}

// Mateixa interpretació de TSB que Today, llegint els llindars centralitzats.
function analyticsFormAssessment(tsb) {
  const t = PMC_CONFIG.TSB_THRESHOLDS;
  if (tsb > t.fresc) return 'Fresc';
  if (tsb >= t.optim_min) return 'Forma òptima';
  if (tsb >= t.productiu_min) return 'Productiu';
  if (tsb >= t.fatigat_min) return 'Fatigat';
  return 'Sobrecarregat';
}

function getSelectedPMCData() {
  const full = buildPMCData(_sessSessions);
  return _sessPeriod > 0 ? full.slice(-_sessPeriod) : full;
}

// ══════════════════════════════════════════════════════════════════════════════
// PMC — Performance Management Chart (CTL / ATL / TSB)
// Usa buildPMCData() de lib/metrics.js
// ══════════════════════════════════════════════════════════════════════════════

const PMC_GRADIENT_PLUGIN = {
  id: 'pmcTsbGradient',
  afterLayout(chart) {
    const { chartArea, scales } = chart;
    if (!chartArea || !scales.y2) return;
    const { top, bottom, height } = chartArea;
    if (!isFinite(top) || !isFinite(bottom) || height <= 0) return;

    const pxAt = v => Math.max(0, Math.min(1, (scales.y2.getPixelForValue(v) - top) / height));

    const p10  = pxAt(10);
    const p0   = pxAt(0);
    const pN20 = pxAt(-20);
    const pN57 = pxAt(-57);

    const grad = chart.ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0,     'rgba(168,85,247,0.25)');
    grad.addColorStop(p10,   'rgba(34,197,94,0.22)');
    grad.addColorStop(p0,    'rgba(56,189,248,0.18)');
    grad.addColorStop(pN20,  'rgba(245,158,11,0.20)');
    grad.addColorStop(pN57,  'rgba(239,68,68,0.22)');
    grad.addColorStop(1,     'rgba(239,68,68,0.32)');

    chart.data.datasets[2].backgroundColor = grad;
  }
};

function renderPMC() {
  const canvas = document.getElementById('chart-pmc');
  if (!canvas) return;
  window.DashboardComponents.destroyChart('sessions-pmc');
  _pmcChart = null;
  const empty = document.getElementById('analytics-pmc-empty');
  const fullData = buildPMCData(_sessSessions);
  _pmcDataCache = _sessPeriod > 0 ? fullData.slice(-_sessPeriod) : fullData;
  const hasData = _pmcDataCache.length > 0;
  canvas.hidden = !hasData;
  if (empty) empty.hidden = hasData;

  const btn90 = document.getElementById('pmc-export-90');
  const btn7  = document.getElementById('pmc-export-7');
  if (btn90) btn90.disabled = !hasData;
  if (btn7)  btn7.disabled  = !hasData;
  if (!hasData) return;

  const C      = CHART_COLORS;
  const labels = _pmcDataCache.map(d => d.label);

  _pmcChart = window.DashboardComponents.createChart('sessions-pmc', canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'CTL — Forma', data:_pmcDataCache.map(d=>Math.round(d.ctl*10)/10),
          borderColor:C.green, backgroundColor:'transparent',
          borderWidth:2.5, pointRadius:0, tension:0.3, yAxisID:'y' },
        { label:'ATL — Fatiga', data:_pmcDataCache.map(d=>Math.round(d.atl*10)/10),
          borderColor:'rgba(249,115,22,0.9)', backgroundColor:'transparent',
          borderWidth:2, pointRadius:0, tension:0.3, yAxisID:'y' },
        { label:'TSB — Frescor', data:_pmcDataCache.map(d=>Math.round(d.tsb*10)/10),
          borderColor:C.blue, backgroundColor:'rgba(56,189,248,0.08)',
          fill:true, borderWidth:2, pointRadius:0, tension:0.3, yAxisID:'y2' },
      ]
    },
    plugins: [PMC_GRADIENT_PLUGIN],
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ position:'top', labels:{ boxWidth:12, padding:16 } },
        tooltip:{ callbacks:{ label:c => {
          const v = c.parsed.y;
          if (c.datasetIndex===0) return ` CTL (Forma): ${v}`;
          if (c.datasetIndex===1) return ` ATL (Fatiga): ${v}`;
          let estat;
          if      (v > 10)  estat = '★ Fresc';
          else if (v > 0)   estat = '✓ Forma òptima';
          else if (v > -20) estat = '≈ Productiu';
          else if (v > -57) estat = '⚠ Fatigat';
          else              estat = '✗ Sobrecarregat';
          return ` TSB (Frescor): ${v}  ${estat}`;
        }}}
      },
      scales:{
        x:{ grid:{color:CHART_COLORS.gridLine}, ticks:{font:{size:10},maxTicksLimit:12,maxRotation:0} },
        y:{ position:'left', grid:{color:CHART_COLORS.gridLine}, ticks:{font:{size:11}},
            beginAtZero:true,
            title:{display:true,text:'CTL / ATL',color:CHART_COLORS.text,font:{size:11}} },
        y2:{ position:'right', grid:{drawOnChartArea:false}, ticks:{font:{size:11}},
             title:{display:true,text:'TSB',color:CHART_COLORS.text,font:{size:11}} }
      }
    }
  });
}

// ── Exportació PMC CSV ────────────────────────────────────────────────────────
function exportPMCcsv(days) {
  if (!_pmcDataCache.length) return;
  const rows   = days>0 ? _pmcDataCache.slice(-days) : _pmcDataCache;
  const header = 'Data,Càrrega,CTL,ATL,TSB,Estat';
  const lines  = rows.map(d => [
    d.date, Math.round(d.tss),
    (Math.round(d.ctl*10)/10).toFixed(1),
    (Math.round(d.atl*10)/10).toFixed(1),
    (Math.round(d.tsb*10)/10).toFixed(1),
    d.estat,
  ].join(','));
  triggerCsvDownload([header,...lines].join('\n'),
    `pmc_${days>0?days+'d':'complet'}_${new Date().toISOString().slice(0,10)}.csv`);
}

function triggerCsvDownload(csvContent, filename) {
  const blob = new Blob([csvContent], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════════════════
// Gràfic de tendència
// ══════════════════════════════════════════════════════════════════════════════

function analyticsActivity(s) {
  return s?.raw?.__activity || {};
}

function analyticsDateLabel(s) {
  return s.displayDate || (s.date instanceof Date ? s.date.toLocaleDateString('ca-ES') : String(s.date || ''));
}

function setAnalyticsChartState(canvasId, emptyId, hasData) {
  const canvas = document.getElementById(canvasId);
  const empty = document.getElementById(emptyId);
  if (canvas) canvas.hidden = !hasData;
  if (empty) empty.hidden = hasData;
}

function analyticsChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: { legend: { display: false }, tooltip: { padding: 10, displayColors: false } },
    scales: {
      x: { grid: { color: CHART_COLORS.gridLine }, ticks: { color: CHART_COLORS.text, maxRotation: 0, maxTicksLimit: 8 } },
      y: { grid: { color: CHART_COLORS.gridLine }, ticks: { color: CHART_COLORS.text } },
    },
    ...extra,
  };
}

function renderAnalyticsPerformance(sessions) {
  const vo2 = sessions.filter(s => typeof s.vo2max === 'number' && isFinite(s.vo2max) && s.vo2max > 0).sort((a, b) => a.date - b.date);
  const summary = document.getElementById('analytics-vo2-summary');
  if (summary) summary.textContent = vo2.length
    ? `${fmtNum(vo2[vo2.length - 1].vo2max)} ml/kg/min · ${vo2.length} ${vo2.length === 1 ? 'registre' : 'registres'}`
    : 'Sense registres';
}

function renderAnalyticsPerformanceCharts(sessions) {
  window.DashboardComponents.destroyChart('analytics-vo2');
  window.DashboardComponents.destroyChart('analytics-pace');
  const vo2 = sessions.filter(s => typeof s.vo2max === 'number' && isFinite(s.vo2max) && s.vo2max > 0).sort((a, b) => a.date - b.date);
  const pace = sessions.filter(s => analyticsActivity(s).sport === 'running' && typeof s.ritme === 'number' && isFinite(s.ritme) && s.ritme > 0).sort((a, b) => a.date - b.date);
  setAnalyticsChartState('chart-analytics-vo2', 'analytics-vo2-empty', vo2.length >= 2);
  setAnalyticsChartState('chart-analytics-pace', 'analytics-pace-empty', pace.length >= 2);

  if (vo2.length >= 2) {
    window.DashboardComponents.createChart('analytics-vo2', document.getElementById('chart-analytics-vo2'), {
      type: 'line',
      data: { labels: vo2.map(analyticsDateLabel), datasets: [{ label: 'VO₂max', data: vo2.map(s => s.vo2max), borderColor: CHART_COLORS.blue, backgroundColor: 'rgba(56,189,248,.12)', fill: true, tension: .25, pointRadius: 4, pointHoverRadius: 6 }] },
      options: analyticsChartOptions({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` VO₂max: ${fmtNum(c.parsed.y)} ml/kg/min` } } }, scales: { y: { grid: { color: CHART_COLORS.gridLine }, ticks: { color: CHART_COLORS.text }, beginAtZero: false } } }),
    });
  }
  if (pace.length >= 2) {
    window.DashboardComponents.createChart('analytics-pace', document.getElementById('chart-analytics-pace'), {
      type: 'line',
      data: { labels: pace.map(analyticsDateLabel), datasets: [{ label: 'Ritme', data: pace.map(s => s.ritme), borderColor: CHART_COLORS.green, backgroundColor: 'rgba(34,197,94,.12)', fill: true, tension: .25, pointRadius: 4, pointHoverRadius: 6 }] },
      options: analyticsChartOptions({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` Ritme: ${formatPace(c.parsed.y, '')} min/km` } } }, scales: { y: { reverse: true, grid: { color: CHART_COLORS.gridLine }, ticks: { color: CHART_COLORS.text, callback: v => formatPace(v, '') } } } }),
    });
  }
}

function renderAnalyticsFeeling(sessions) {
  window.DashboardComponents.destroyChart('analytics-feeling');
  const points = sessions.filter(s => Number.isInteger(s.feeling) && s.feeling >= 1 && s.feeling <= 5).sort((a, b) => a.date - b.date);
  const summary = document.getElementById('analytics-feeling-summary');
  if (summary) {
    if (!points.length) summary.textContent = 'Sense registres';
    else {
      const avg = points.reduce((sum, s) => sum + s.feeling, 0) / points.length;
      summary.textContent = `${fmtNum(avg)}/5 de mitjana · ${points.length} ${points.length === 1 ? 'registre' : 'registres'}`;
    }
  }
  setAnalyticsChartState('chart-analytics-feeling', 'analytics-feeling-empty', points.length >= 2);
  if (points.length < 2) return;
  const labels = ['Molt baixa', 'Baixa', 'Neutra', 'Bona', 'Molt bona'];
  window.DashboardComponents.createChart('analytics-feeling', document.getElementById('chart-analytics-feeling'), {
    type: 'line',
    data: { labels: points.map(analyticsDateLabel), datasets: [{ label: 'Feeling', data: points.map(s => s.feeling), borderColor: '#55D6BE', backgroundColor: 'rgba(85,214,190,.12)', fill: true, tension: 0, showLine: false, pointRadius: 5, pointHoverRadius: 7 }] },
    options: analyticsChartOptions({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` Feeling: ${c.parsed.y}/5 · ${labels[c.parsed.y - 1] || 'Sense etiqueta'}` } } }, scales: { y: { min: 1, max: 5, ticks: { stepSize: 1, color: CHART_COLORS.text, callback: v => labels[v - 1] || v }, grid: { color: CHART_COLORS.gridLine } } } }),
  });
}

function renderAnalyticsZones(sessions) {
  window.DashboardComponents.destroyChart('analytics-zones');
  const totals = [1, 2, 3, 4, 5].map(zone => sessions.reduce((sum, s) => {
    const activity = analyticsActivity(s);
    const value = Number(activity.zones?.[`z${zone}_min`] ?? s.raw?.[`Z${zone}(min)`]);
    return sum + (isFinite(value) && value > 0 ? value : 0);
  }, 0));
  const total = totals.reduce((a, b) => a + b, 0);
  setAnalyticsChartState('chart-analytics-zones', 'analytics-zones-empty', total > 0);
  if (total <= 0) return;
  window.DashboardComponents.createChart('analytics-zones', document.getElementById('chart-analytics-zones'), {
    type: 'bar', data: { labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'], datasets: [{ label: 'Temps', data: totals, backgroundColor: CHART_COLORS.zones, borderRadius: 5 }] },
    options: analyticsChartOptions({ indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fmtNum(c.parsed.x)} min · ${fmtNum(c.parsed.x / total * 100)}%` } } }, scales: { x: { beginAtZero: true, grid: { color: CHART_COLORS.gridLine }, ticks: { color: CHART_COLORS.text, callback: v => `${v} min` } }, y: { grid: { display: false }, ticks: { color: CHART_COLORS.text } } } }),
  });
}

function renderAnalyticsMix(sessions) {
  window.DashboardComponents.destroyChart('analytics-mix');
  const order = ['running', 'cycling', 'strength', 'swimming', 'padel', 'hiking', 'other'];
  const labels = { running: 'Cursa', cycling: 'Ciclisme', strength: 'Força', swimming: 'Natació', padel: 'Pàdel', hiking: 'Senderisme', other: 'Altres' };
  const colors = { running: '#55D6BE', cycling: '#39C6E6', strength: '#B58CFF', swimming: '#38bdf8', padel: '#F5B942', hiking: '#FF7A59', other: '#94A3B8' };
  const sportKey = s => {
    const sport = String(analyticsActivity(s).sport || '').toLowerCase();
    return order.includes(sport) ? sport : 'other';
  };
  const entries = order
    .map(key => ({ key, count: sessions.filter(s => sportKey(s) === key).length }))
    .filter(entry => entry.count > 0);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  setAnalyticsChartState('chart-analytics-mix', 'analytics-mix-empty', total > 0);
  if (!total) return;
  window.DashboardComponents.createChart('analytics-mix', document.getElementById('chart-analytics-mix'), {
    type: 'doughnut', data: { labels: entries.map(entry => labels[entry.key]), datasets: [{ data: entries.map(entry => entry.count), backgroundColor: entries.map(entry => colors[entry.key]), borderColor: '#121820', borderWidth: 3 }] },
    options: analyticsChartOptions({ cutout: '62%', plugins: { legend: { display: true, position: 'bottom', labels: { color: CHART_COLORS.text, boxWidth: 11, padding: 12 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed} activitats · ${fmtNum(c.parsed / total * 100)}%` } } } }),
  });
}

function renderSessTrendChart(sessions) {
  const ctx = document.getElementById('chart-sess-trend');
  if (!ctx) return;
  window.DashboardComponents.destroyChart('sessions-trend');
  _sessChart = null;
  const badge = document.getElementById('sess-chart-badge');
  if (badge) badge.textContent = _sessType === 'testrace'
    ? 'Per activitat'
    : (_sessPeriod > 0 && _sessPeriod <= DAY_VIEW_THRESHOLD ? 'Per dies' : 'Per setmanes');
  setAnalyticsChartState('chart-sess-trend', 'analytics-trend-empty', sessions.length > 0);
  if (sessions.length < 1) return;

  let byWeek;
  if (_sessType === 'testrace') {
    byWeek = sessions.map(s => ({ ...s, label: s.displayDate }));
  } else if (_sessPeriod > 0 && _sessPeriod <= DAY_VIEW_THRESHOLD) {
    byWeek = groupByDay(sessions);
  } else {
    byWeek = groupByWeek(sessions);
  }

  _sessChart = window.DashboardComponents.createChart(
    'sessions-trend', ctx, buildSessChartConfig(byWeek, byWeek.map(w=>w.label), sessions)
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// buildSessChartConfig
// ══════════════════════════════════════════════════════════════════════════════

function buildSessChartConfig(byWeek, labels, sessions) {
  const C = CHART_COLORS;
  const COL = {
    km:   { bar:'rgba(56,189,248,0.35)',  line:'rgba(56,189,248,0.9)'  },
    desn: { line:'rgba(148,163,184,0.9)' },
    ritme:{ line:'rgba(34,197,94,0.9)'   },
    fc:   { line:'rgba(249,115,22,0.9)'  },
    cad:  { line:'rgba(168,85,247,0.85)' },
    epoc: { bar:'rgba(251,191,36,0.35)', line:'rgba(251,191,36,0.9)'  },
    load: { bar:'rgba(34,197,94,0.25)',  line:'rgba(34,197,94,0.9)'   },
    dur:  { bar:'rgba(56,189,248,0.35)', line:'rgba(56,189,248,0.7)'  },
    watts:{ line:'rgba(250,204,21,0.9)'  },
  };
  const baseOpts = {
    responsive:true, maintainAspectRatio:false,
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ boxWidth:12, padding:14 } } },
    scales:{ x:{ grid:{color:C.gridLine}, ticks:{font:{size:11}} } },
  };
  const yBase = { grid:{color:C.gridLine}, ticks:{font:{size:11}}, beginAtZero:true };

  const scaleKm    = (lbl='km')  => ({ ...yBase, position:'left',  title:{ display:true, text:lbl,      color:C.text, font:{size:10} } });
  const scaleDurS  = ()          => ({ ...yBase, position:'left', offset:true,
    grid:{ drawOnChartArea:false },
    ticks:{ ...yBase.ticks, callback: v => `${v} min` },
    title:{ display:true, text:'min sèr.', color:COL.dur.line, font:{size:10} } });
  const scaleRitme = ()          => ({ ...yBase, position:'right', reverse:true, min:3, max:10,
    grid:{ drawOnChartArea:false },
    ticks:{ ...yBase.ticks, callback: v => formatPace(v,'') },
    title:{ display:true, text:'min/km', color:C.text, font:{size:10} } });
  const scaleFC    = ()          => ({ ...yBase, position:'right', offset:true, beginAtZero:false,
    grid:{ drawOnChartArea:false },
    ticks:{ ...yBase.ticks, callback: v => `${v}` },
    title:{ display:true, text:'ppm / spm', color:C.text, font:{size:10} } });
  const scaleDesn  = ()          => ({ ...yBase, position:'left',  offset:true,
    grid:{ drawOnChartArea:false },
    ticks:{ ...yBase.ticks, callback: v => `${v} m` },
    title:{ display:true, text:'m D+', color:C.text, font:{size:10} } });
  const scaleDur   = ()          => ({ ...yBase, position:'left',
    ticks:{ ...yBase.ticks, callback: v => `${v} min` },
    title:{ display:true, text:'min', color:COL.dur.line, font:{size:10} } });
  const scaleWatts = ()          => ({ ...yBase, position:'right', offset:true, beginAtZero:false,
    grid:{ drawOnChartArea:false },
    ticks:{ ...yBase.ticks, callback: v => `${v} W` },
    title:{ display:true, text:'Watts', color:COL.watts.line, font:{size:10} } });

  function tooltipLabel(c) {
    const v = c.parsed.y; if (v == null) return null;
    const lbl = c.dataset.label || '';
    if (lbl.includes('Ritme'))             return `  Ritme: ${formatPace(v,'')}`;
    if (lbl.includes('FC'))                return `  FC: ${v} ppm`;
    if (lbl.includes('Cad'))               return `  Cadència: ${v} spm`;
    if (lbl.includes('EPOC'))              return `  EPOC: ${v}`;
    if (lbl === 'Càrrega')                return `  Càrrega: ${v}`;
    if (lbl.includes('Desnivell'))         return `  Desnivell: ${v} m`;
    if (lbl.includes('Km'))               return `  Km: ${v} km`;
    if (lbl.includes('Temps sèries'))      return `  Temps sèries: ${v} min`;
    if (lbl.includes('Durada'))            return `  Durada: ${v} min`;
    if (lbl.includes('Watts'))             return `  Watts: ${v} W`;
    return ` ${lbl}: ${v}`;
  }

  switch (_sessType) {

    case 'all':
    default: {
      const hasLoad = byWeek.some(w=>w.load>0);
      const hasEpoc = byWeek.some(w=>w.epoc>0);
      const datasets = [
        { type:'bar', label:'Km', data:byWeek.map(w=>w.km),
          backgroundColor:COL.km.bar, borderColor:COL.km.line,
          borderWidth:1, borderRadius:4, yAxisID:'y' },
      ];
      if (hasLoad) datasets.push({ type:'line', label:'Càrrega',
        data:byWeek.map(w=>w.load), borderColor:COL.load.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:3, tension:0.3, yAxisID:'y2', spanGaps:true });
      if (hasEpoc) datasets.push({ type:'line', label:'EPOC',
        data:byWeek.map(w=>w.epoc), borderColor:COL.epoc.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:3, tension:0.3, yAxisID:'y2', spanGaps:true });
      return { type:'bar', data:{labels,datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:scaleKm('km'),
          y2:{ ...yBase, position:'right', grid:{drawOnChartArea:false},
               ticks:{...yBase.ticks,callback:v=>`${v}`},
               title:{display:true,text:'Càrrega / EPOC',color:C.text,font:{size:10}} } }
      }};
    }

    case 'z2': {
      const hasRitme = byWeek.some(w => w.avgPace !== null);
      const hasFC    = byWeek.some(w => w.avgFC   !== null);
      const hasCad   = byWeek.some(w => w.avgCad  !== null);
      const datasets = [
        { type:'bar', label:'Km', data:byWeek.map(w=>w.km),
          backgroundColor:COL.km.bar, borderColor:COL.km.line,
          borderWidth:1, borderRadius:4, yAxisID:'y' },
      ];
      if (hasRitme) datasets.push({ type:'line', label:'Ritme mig (min/km)',
        data:byWeek.map(w=>w.avgPace), borderColor:COL.ritme.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y2', spanGaps:true });
      if (hasFC) datasets.push({ type:'line', label:'FC mitja (ppm)',
        data:byWeek.map(w=>w.avgFC), borderColor:COL.fc.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y3', spanGaps:true });
      if (hasCad) datasets.push({ type:'line', label:'Cadència (spm)',
        data:byWeek.map(w=>w.avgCad), borderColor:COL.cad.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y3', spanGaps:true });
      return { type:'bar', data:{labels,datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:scaleKm('km'),
          y2: hasRitme        ? scaleRitme() : { display:false },
          y3: (hasFC||hasCad) ? scaleFC()    : { display:false } }
      }};
    }

    case 'quality': {
      const hasDurS  = byWeek.some(w => w.totalDurSeries > 0);
      const hasPaceS = byWeek.some(w => w.avgPaceSeries  !== null);
      const hasFCS   = byWeek.some(w => w.avgFCSeries    !== null);
      const hasCadS  = byWeek.some(w => w.avgCadSeries   !== null);

      const datasets = [
        { type:'bar', label:'Km', data:byWeek.map(w => w.km > 0 ? w.km : null),
          backgroundColor:COL.km.bar, borderColor:COL.km.line,
          borderWidth:1, borderRadius:4, yAxisID:'y' },
      ];

      if (hasDurS) datasets.push({
        type: 'line', label: 'Temps sèries (min)',
        data: byWeek.map(w => w.totalDurSeries > 0 ? w.totalDurSeries : null),
        borderColor: COL.dur.line, backgroundColor: 'transparent',
        borderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
        tension: 0.3, spanGaps: true, yAxisID: 'y4',
      });

      if (hasPaceS) datasets.push({ type:'line', label:'Ritme sèries (min/km)',
        data:byWeek.map(w=>w.avgPaceSeries), borderColor:COL.ritme.line,
        backgroundColor:'transparent', borderWidth:2, pointRadius:4,
        tension:0.3, yAxisID:'y2', spanGaps:true });
      if (hasFCS) datasets.push({ type:'line', label:'FC sèries (ppm)',
        data:byWeek.map(w=>w.avgFCSeries), borderColor:COL.fc.line,
        backgroundColor:'transparent', borderWidth:2, pointRadius:4,
        tension:0.3, yAxisID:'y3', spanGaps:true });
      if (hasCadS) datasets.push({ type:'line', label:'Cadència sèries (spm)',
        data:byWeek.map(w=>w.avgCadSeries), borderColor:COL.cad.line,
        backgroundColor:'transparent', borderWidth:2, pointRadius:4,
        tension:0.3, yAxisID:'y3', spanGaps:true });

      return { type:'bar', data:{labels,datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{
          x:  baseOpts.scales.x,
          y:  scaleKm('km'),
          y2: hasPaceS           ? scaleRitme() : { display:false },
          y3: (hasFCS||hasCadS)  ? scaleFC()    : { display:false },
          y4: hasDurS            ? scaleDurS()  : { display:false },
        }
      }};
    }

    case 'long': {
      const hasDesn  = byWeek.some(w => w.desnivell > 0);
      const hasRitme = byWeek.some(w => w.avgPace !== null);
      const hasFC    = byWeek.some(w => w.avgFC   !== null);
      const hasCad   = byWeek.some(w => w.avgCad  !== null);
      const datasets = [
        { type:'bar', label:'Km', data:byWeek.map(w=>w.km),
          backgroundColor:COL.km.bar, borderColor:COL.km.line,
          borderWidth:1, borderRadius:4, yAxisID:'y' },
      ];
      if (hasDesn) datasets.push({
        type:'line', label:'Desnivell (m)',
        data:byWeek.map(w=>w.desnivell),
        borderColor:COL.desn.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, pointHoverRadius:6,
        tension:0.3, yAxisID:'y4', spanGaps:true
      });
      if (hasRitme) datasets.push({ type:'line', label:'Ritme mig (min/km)',
        data:byWeek.map(w=>w.avgPace), borderColor:COL.ritme.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y2', spanGaps:true });
      if (hasFC) datasets.push({ type:'line', label:'FC mitja (ppm)',
        data:byWeek.map(w=>w.avgFC), borderColor:COL.fc.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y3', spanGaps:true });
      if (hasCad) datasets.push({ type:'line', label:'Cadència (spm)',
        data:byWeek.map(w=>w.avgCad), borderColor:COL.cad.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y3', spanGaps:true });
      return { type:'bar', data:{labels,datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{
          x:  baseOpts.scales.x,
          y:  scaleKm('km'),
          y2: hasRitme           ? scaleRitme() : { display:false },
          y3: (hasFC||hasCad)    ? scaleFC()    : { display:false },
          y4: hasDesn            ? scaleDesn()  : { display:false },
        }
      }};
    }

    case 'testrace': {
      const sorted   = [...sessions].sort((a,b)=>a.date-b.date);
      const sLabels  = sorted.map(s=>s.displayDate);
      const hasDesn  = sorted.some(s => { const d=toNumber(s.raw['Desnivell(m)']); return typeof d==='number'&&d>0; });
      const hasRitme = sorted.some(s => typeof s.ritme==='number'&&s.ritme>0);
      const hasFC    = sorted.some(s => typeof s.fcMitja==='number'&&s.fcMitja>0);
      const datasets = [
        { type:'bar', label:'Km',
          data:sorted.map(s=>(typeof s.distancia==='number'&&s.distancia>0)?s.distancia:null),
          backgroundColor:COL.km.bar, borderColor:COL.km.line,
          borderWidth:1, borderRadius:4, yAxisID:'y' },
      ];
      if (hasDesn) datasets.push({ type:'bar', label:'Desnivell (m)',
        data:sorted.map(s=>{ const d=toNumber(s.raw['Desnivell(m)']); return (typeof d==='number'&&d>0)?d:null; }),
        backgroundColor:'rgba(148,163,184,0.3)', borderColor:'rgba(148,163,184,0.9)',
        borderWidth:1, borderRadius:4, yAxisID:'y' });
      if (hasRitme) datasets.push({ type:'line', label:'Ritme (min/km)',
        data:sorted.map(s=>(typeof s.ritme==='number'&&s.ritme>0)?s.ritme:null),
        borderColor:COL.ritme.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:5, pointHoverRadius:7, tension:0.2,
        yAxisID:'y2', spanGaps:false });
      if (hasFC) datasets.push({ type:'line', label:'FC mitja (ppm)',
        data:sorted.map(s=>(typeof s.fcMitja==='number'&&s.fcMitja>0)?s.fcMitja:null),
        borderColor:COL.fc.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:5, pointHoverRadius:7, tension:0.2,
        yAxisID:'y3', spanGaps:false });
      return { type:'bar', data:{labels:sLabels,datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:scaleKm('km / m'),
          y2: hasRitme ? scaleRitme() : { display:false },
          y3: hasFC    ? scaleFC()    : { display:false } }
      }};
    }

    case 'strength':
      return { type:'bar', data:{labels, datasets:[
        { label:'Càrrega', data:byWeek.map(w=>w.load),
          backgroundColor:COL.load.bar, borderColor:COL.load.line, borderWidth:1, borderRadius:4 },
        { label:'EPOC', data:byWeek.map(w=>w.epoc),
          backgroundColor:COL.epoc.bar, borderColor:COL.epoc.line, borderWidth:1, borderRadius:4 },
      ]}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:yBase }
      }};

    case 'bici': {
      // Durada com a barra principal (no km, ja que bici estàtica no té distància real)
      const hasFC    = byWeek.some(w => w.avgFC  !== null);
      const hasLoad  = byWeek.some(w => w.load   >  0);
      const hasWatts = byWeek.some(w => {
        // Watts mig setmanal: mirem si alguna sessió de la setmana té Watts
        return false; // placeholder — s'activarà quan el parser exposi watts
      });
      const datasets = [
        { type:'bar', label:'Durada (min)', data:byWeek.map(w=>w.dur > 0 ? w.dur : null),
          backgroundColor:COL.dur.bar, borderColor:COL.dur.line,
          borderWidth:1, borderRadius:4, yAxisID:'y' },
      ];
      if (hasFC) datasets.push({ type:'line', label:'FC mitja (ppm)',
        data:byWeek.map(w=>w.avgFC), borderColor:COL.fc.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y2', spanGaps:true });
      if (hasLoad) datasets.push({ type:'line', label:'Càrrega',
        data:byWeek.map(w=>w.load > 0 ? w.load : null), borderColor:COL.load.line,
        backgroundColor:'transparent', borderWidth:2, pointRadius:3,
        tension:0.3, yAxisID:'y2', spanGaps:true });
      return { type:'bar', data:{labels, datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{
          x:  baseOpts.scales.x,
          y:  scaleDur(),
          y2: (hasFC||hasLoad) ? {
                ...yBase, position:'right', beginAtZero:false,
                grid:{ drawOnChartArea:false },
                ticks:{ ...yBase.ticks, callback: v => `${v}` },
                title:{ display:true, text:'FC / càrrega', color:C.text, font:{size:10} }
              } : { display:false },
        }
      }};
    }

    case 'other':
      return { type:'bar', data:{labels, datasets:[
        { label:'Càrrega', data:byWeek.map(w=>w.load),
          backgroundColor:COL.load.bar, borderColor:COL.load.line, borderWidth:1, borderRadius:4 },
        { label:'EPOC', data:byWeek.map(w=>w.epoc),
          backgroundColor:COL.epoc.bar, borderColor:COL.epoc.line, borderWidth:1, borderRadius:4 },
      ]}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:yBase }
      }};
  }
}

// ── Taula (desktop) ────────────────────────────────────────────────────────────
function renderSessTable(sessions) {
  const table=document.getElementById('sess-table');
  const title=document.getElementById('sess-table-title');
  const badge=document.getElementById('sess-count-badge');
  if (!table) return;
  if (title) title.textContent=SESS_TYPE_LABELS[_sessType]||'Sessions';
  if (badge) badge.textContent=`${sessions.length} sessions`;
  const sb7  = document.getElementById('sess-export-7');
  const sb90 = document.getElementById('sess-export-90');
  if (sb7)  sb7.disabled  = !_sessSessions.length;
  if (sb90) sb90.disabled = !_sessSessions.length;
  const cols = getSessCols(_sessType);
  table.innerHTML = window.DashboardComponents.renderDataTable({
    columns: cols,
    rows: sessions,
    emptyMessage: 'Cap sessió amb els filtres seleccionats.',
    theadId: 'sess-thead',
    tbodyId: 'sess-tbody',
    wrap: false,
  });

  if (!sessions.length) return;

  bindSessCommentButtons();
  bindSessDetailTriggers(sessions);
}

// ══════════════════════════════════════════════════════════════════════════════
// Cards de sessions (mòbil)
// Renderitza les sessions com a targetes compactes sota el gràfic.
// Cada tipus de sessió mostra les mètriques més rellevants.
// ══════════════════════════════════════════════════════════════════════════════

function renderSessCards(sessions) {
  const container = document.getElementById('sess-cards');
  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = window.DashboardComponents.renderEmptyState(
      'Cap sessió amb els filtres seleccionats.',
      { className: 'sess-cards-empty' }
    );
    return;
  }

  container.innerHTML = sessions.map(s => buildSessCard(s)).join('');
  bindSessCommentButtons();
  bindSessDetailTriggers(sessions);
}

function buildSessCard(s) {
  const comentari  = s.raw['Comentari'] || '';
  const hasComment = !!comentari;
  const safeName   = esc(s.raw['Arxiu'] || '');
  const titleAttr  = hasComment
    ? `Comentari: ${esc(comentari.slice(0, 80))}${comentari.length > 80 ? '...' : ''}`
    : 'Afegir comentari';

  const commentBtn = `<button
    class="ced-btn${hasComment ? ' ced-btn--has-comment' : ''} sess-card-comment"
    data-comment-arxiu="${safeName}"
    data-comment-data="${esc(s.displayDate || '')}"
    data-comment-tipus="${esc(s.tipus || '')}"
    title="${titleAttr}"
    aria-label="${titleAttr}"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </button>`;

  const metrics = getSessCardMetrics(s);
  const metricsHTML = metrics.map(m =>
    `<div class="sess-card-metric${m.wide ? ' sess-card-metric--wide' : ''}${m.full ? ' sess-card-metric--full' : ''}">
      <span class="sess-card-metric-label">${m.label}</span>
      <span class="sess-card-metric-value">${m.value}</span>
    </div>`
  ).join('');

  const activityId = s.raw?.__activity?.id || s.raw?.id || s.raw?.Arxiu || '';
  return `
    <div class="sess-card session-detail-trigger" data-activity-id="${esc(activityId)}" role="button" tabindex="0" aria-label="Obrir el detall de ${esc(s.tipus || 'l’activitat')}">
      <div class="sess-card-header">
        <span class="sess-card-date">${esc(s.displayDate)}</span>
        <span class="sess-card-tipus">${esc(s.tipus)}</span>
        ${commentBtn}
      </div>
      <div class="sess-card-metrics">
        ${metricsHTML}
      </div>
    </div>`;
}

function sessionDetailPlanningItem(session) {
  const canonical = session?.raw?.__activity || session?.__activity || {};
  const link = (canonical.planning_links || []).find(item => item.confidence === 'confirmed' && item.planning_session_id);
  if (!link) return null;
  const planning = window.dashboardStore?.getState?.()?.planning || [];
  return planning.flatMap(week => Array.isArray(week.__sessions) ? week.__sessions : []).find(item => item.id === link.planning_session_id) || null;
}

function openSessionDetailFromList(session) {
  if (!session || typeof window.openSessionDetailDrawer !== 'function') return;
  window.openSessionDetailDrawer(session, sessionDetailPlanningItem(session));
}

function bindSessDetailTriggers(sessions) {
  const body = document.getElementById('sess-tbody');
  if (body) {
    [...body.querySelectorAll('tr:not(.empty-row)')].forEach((row, index) => {
      const session = sessions[index];
      if (!session || row.dataset.detailBound) return;
      row.dataset.detailBound = '1';
      row.classList.add('session-detail-trigger');
      row.tabIndex = 0;
      row.setAttribute('aria-label', `Obrir el detall de ${session.tipus || 'l’activitat'}`);
      row.addEventListener('click', event => { if (!event.target.closest('[data-comment-arxiu]')) openSessionDetailFromList(session); });
      row.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('[data-comment-arxiu]')) { event.preventDefault(); openSessionDetailFromList(session); } });
    });
  }
  const cards = document.getElementById('sess-cards');
  cards?.querySelectorAll('.session-detail-trigger').forEach(card => {
    if (card.dataset.detailBound) return;
    card.dataset.detailBound = '1';
    const session = sessions.find(item => String(item.raw?.__activity?.id || item.raw?.id || item.raw?.Arxiu || '') === card.dataset.activityId);
    card.addEventListener('click', event => { if (!event.target.closest('[data-comment-arxiu]')) openSessionDetailFromList(session); });
    card.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('[data-comment-arxiu]')) { event.preventDefault(); openSessionDetailFromList(session); } });
  });
}

// Mètriques per tipus de sessió — prioritzem les més rellevants en mòbil
function getSessCardMetrics(s) {
  const km    = s.distancia > 0 ? `${fmtNum(s.distancia)} km` : '—';
  const dur   = s.durada    > 0 ? `${fmtNum(s.durada)} min`  : '—';
  const ritme = formatPace(s.ritme);
  const fc    = (typeof s.fcMitja === 'number' && s.fcMitja > 0) ? `${Math.round(s.fcMitja)} ppm` : '—';
  const tss   = (typeof s.carrega === 'number' && s.carrega > 0) ? `${fmtNum(s.carrega)}`     : '—';
  const epocRaw = toNumber(s.raw['EPOC']);
  const epoc  = (typeof epocRaw === 'number' && epocRaw > 0)     ? fmtNum(epocRaw) : '—';
  const cadRaw = toNumber(s.raw['Cadencia(spm)']);
  const cad   = (typeof cadRaw === 'number' && cadRaw > 0)       ? `${Math.round(cadRaw)} spm` : '—';
  const desnRaw = toNumber(s.raw['Desnivell(m)']);
  const desn  = (typeof desnRaw === 'number' && desnRaw > 0)     ? `${Math.round(desnRaw)} m` : '—';
  const recupRaw = toNumber(s.raw['Recup(h)']);
  const recup = (typeof recupRaw === 'number' && recupRaw > 0)   ? `${fmtNum(recupRaw)} h` : '—';
  const numSeries = toNumber(s.raw['Num_Series']);
  const series = (typeof numSeries === 'number' && numSeries > 0) ? String(Math.round(numSeries)) : '—';
  const ritmeSer = formatPace(typeof s.ritmeMitjaSeries === 'number' ? s.ritmeMitjaSeries : null);
  const fcSer  = (typeof s.fcMitjaSeries === 'number' && s.fcMitjaSeries > 0) ? `${Math.round(s.fcMitjaSeries)} ppm` : '—';
  const z2min  = s.z2min > 0 ? `${fmtNum(s.z2min)} min` : '—';
  const wattsRaw = toNumber(s.raw['Watts'] || s.raw['Potencia(W)'] || s.raw['Potència(W)']);
  const watts = (typeof wattsRaw === 'number' && wattsRaw > 0) ? `${Math.round(wattsRaw)} W` : '—';

  switch (_sessType) {
    case 'z2':
      return [
        { label: 'Km',        value: km },
        { label: 'Durada',    value: dur },
        { label: 'Ritme',     value: ritme },
        { label: 'FC',        value: fc },
        { label: 'Z2',        value: z2min },
        { label: 'TSS',       value: tss },
      ];
    case 'quality':
      return [
        { label: 'Sèries',    value: series },
        { label: 'Ritme sèr.',value: ritmeSer },
        { label: 'FC sèr.',   value: fcSer },
        { label: 'Km total',  value: km },
        { label: 'TSS',       value: tss },
        { label: 'Cadència',  value: cad },
      ];
    case 'long':
      return [
        { label: 'Km',        value: km },
        { label: 'Ritme',     value: ritme },
        { label: 'FC',        value: fc },
        { label: 'Durada',    value: dur },
        { label: 'D+',        value: desn },
        { label: 'TSS',       value: tss },
      ];
    case 'testrace':
      return [
        { label: 'Km',        value: km },
        { label: 'Ritme',     value: ritme },
        { label: 'FC',        value: fc },
        { label: 'D+',        value: desn },
        { label: 'Durada',    value: dur },
        { label: 'TSS',       value: tss },
      ];
    case 'strength':
      return [
        { label: 'Durada',    value: dur },
        { label: 'FC',        value: fc },
        { label: 'TSS',       value: tss },
        { label: 'EPOC',      value: epoc },
        { label: 'Recup.',    value: recup },
      ];
    case 'bici':
      return [
        { label: 'Durada',    value: dur },
        { label: 'FC',        value: fc },
        { label: 'TSS',       value: tss },
        { label: 'EPOC',      value: epoc },
        { label: 'Watts',     value: watts },
        { label: 'Cadència',  value: cad },
      ];
    case 'other':
      return [
        { label: 'Durada',    value: dur },
        { label: 'FC',        value: fc },
        { label: 'TSS',       value: tss },
        { label: 'EPOC',      value: epoc },
      ];
    default: // 'all'
      return [
        { label: 'Km',        value: km },
        { label: 'Durada',    value: dur },
        { label: 'Ritme',     value: ritme },
        { label: 'FC',        value: fc },
        { label: 'TSS',       value: tss },
        { label: 'EPOC',      value: epoc },
      ];
  }
}

// ── Columna comentari (shared entre tots els tipus) ───────────────────────────
function makeColComentari() {
  return {
    label: '✏',
    cls:   'sess-col-comment',
    render: s => {
      const comentari  = s.raw['Comentari'] || '';
      const hasComment = !!comentari;
      const safeName   = esc(s.raw['Arxiu'] || '');
      const titleAttr  = hasComment
        ? `Comentari: ${esc(comentari.slice(0, 80))}${comentari.length > 80 ? '...' : ''}`
        : 'Afegir comentari';
      return `<button
        class="ced-btn${hasComment ? ' ced-btn--has-comment' : ''}"
        data-comment-arxiu="${safeName}"
        data-comment-data="${esc(s.displayDate || '')}"
        data-comment-tipus="${esc(s.tipus || '')}"
        title="${titleAttr}"
        aria-label="${titleAttr}"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>`;
    }
  };
}

function getSessCols(type) {
  const colComentari  = makeColComentari();
  const colData       = {label:'Data',            render:s=>esc(s.displayDate)};
  const colTipus      = {label:'Tipus',            render:s=>esc(s.tipus)};
  const colKm         = {label:'Km',               render:s=>s.distancia>0?`${fmtNum(s.distancia)} km`:'—'};
  const colDurada     = {label:'Durada',           render:s=>s.durada>0?`${fmtNum(s.durada)} min`:'—'};
  const colRitme      = {label:'Ritme',            render:s=>formatPace(s.ritme)};
  const colFC         = {label:'FC',               render:s=>fcBadgeHTML(s.fcMitja)};
  const colCarrega = {
    label: 'TSS',
    render: s => (typeof s.carrega === 'number' && s.carrega > 0) ? tssDotHTML(s.carrega) : '—'
  };
  const colEpoc = {
    label: 'EPOC',
    render: s => { const e = toNumber(s.raw['EPOC']); return (typeof e === 'number' && e > 0) ? loadBadgeHTML(e) : '—'; }
  };
  const colRecup      = {label:'Recup.',            render:s=>{const r=toNumber(s.raw['Recup(h)']);return typeof r==='number'&&r>0?`${fmtNum(r)} h`:'—';}};
  const colZ2min      = {label:'Z2 (min)',          render:s=>s.z2min>0?`${fmtNum(s.z2min)} min`:'—'};
  const colCad        = {label:'Cadència',          render:s=>{const c=toNumber(s.raw['Cadencia(spm)']);return typeof c==='number'&&c>0?`${Math.round(c)} spm`:'—';}};
  const colDesnivell  = {label:'Desnivell',         render:s=>{const d=toNumber(s.raw['Desnivell(m)']);return typeof d==='number'&&d>0?`${Math.round(d)} m`:'—';}};
  const colRitmeSeries= {label:'Ritme sèries',      render:s=>formatPace(typeof s.ritmeMitjaSeries==='number'?s.ritmeMitjaSeries:null)};
  const colFCSeries   = {label:'FC sèries',         render:s=>fcBadgeHTML(s.fcMitjaSeries)};
  const colSeries     = {label:'Sèries',            render:s=>{const n=toNumber(s.raw['Num_Series']);return typeof n==='number'&&n>0?String(Math.round(n)):'—';}};
  const colPTE        = {label:'PTE',               render:s=>{const p=toNumber(s.raw['PTE']);return typeof p==='number'&&p>0?fmtNum(p):'—';}};
  const colFeeling    = {label:'Feeling',           render:s=>{const f=toNumber(s.raw.Feeling);return typeof f==='number'&&f>0?fmtNum(f):'--';}};
  const colVo2max     = {label:'VO2max',            render:s=>{const v=toNumber(s.raw.VO2max);return typeof v==='number'&&v>0?fmtNum(v):'--';}};
  const colWatts      = {label:'Watts',             render:s=>{
    const w=toNumber(s.raw['Watts']||s.raw['Potencia(W)']||s.raw['Potència(W)']);
    return typeof w==='number'&&w>0?`${Math.round(w)} W`:'—';
  }};

  const colDurSerie = {
    label: 'Dur/Sèrie',
    render: s => {
      const dur = s.duradaMitjaSeries;
      return (typeof dur === 'number' && isFinite(dur) && dur > 0)
        ? `${fmtNum(Math.round(dur * 10) / 10)} min`
        : '—';
    }
  };

  switch (type) {
    case 'z2':       return [colData,colKm,colDurada,colRitme,colCad,colFC,colZ2min,colEpoc,colCarrega,colComentari];
    case 'quality':  return [colData,colTipus,colSeries,colDurSerie,colRitmeSeries,colFCSeries,colKm,colCarrega,colPTE,colComentari];
    case 'long':     return [colData,colTipus,colKm,colDurada,colRitme,colFC,colDesnivell,colFeeling,colVo2max,colZ2min,colCarrega,colComentari];
    case 'testrace': return [colData,colTipus,colKm,colDurada,colRitme,colFC,colDesnivell,colFeeling,colVo2max,colCarrega,colComentari];
    case 'strength': return [colData,colTipus,colDurada,colFC,colCarrega,colEpoc,colRecup,colComentari];
    case 'bici':     return [colData,colTipus,colDurada,colFC,colCarrega,colEpoc,colWatts,colCad,colComentari];
    case 'other':    return [colData,colTipus,colDurada,colFC,colCarrega,colEpoc,colComentari];
    default:         return [colData,colTipus,colKm,colDurada,colRitme,colFC,colFeeling,colVo2max,colCarrega,colEpoc,colComentari];
  }
}

function setSessText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Helpers de comentari ──────────────────────────────────────────────────────

function commentPreview(comment, max = 36) {
  const txt = String(comment ?? '').trim();
  if (!txt) return '';
  return txt.length > max ? `${esc(txt.slice(0, max))}…` : esc(txt);
}

function bindSessCommentButtons() {
  const roots = [
    document.getElementById('sess-tbody'),
    document.getElementById('sess-cards'),
  ].filter(Boolean);

  roots.forEach(root => root.querySelectorAll('[data-comment-arxiu]').forEach(btn => {
    if (btn.dataset.commentBound) return;
    btn.dataset.commentBound = '1';
    btn.addEventListener('click', () => {
      if (typeof window.openSessionCommentEditor !== 'function') return;
      window.openSessionCommentEditor({
        arxiu: btn.dataset.commentArxiu || '',
        data: btn.dataset.commentData || '',
        tipus: btn.dataset.commentTipus || '',
      });
    });
  }));
}
