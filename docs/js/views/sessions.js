// docs/js/views/sessions.js
// Panell Sessions: filtres, KPIs, gràfic tendència, PMC + exportació CSV, taula
// Dep: lib/formatters.js (formatPace, fmtNum, toNumber, esc)
//      lib/metrics.js    (buildPMCData, groupByWeek, parseDurSeries)
//      lib/load-scale.js (loadBadgeHTML, loadDotHTML, getLoadLevelSession,
//                         getTSSLevel, tssBadgeHTML, tssDotHTML)
//      app.js            (CHART_COLORS via charts.js, STRENGTH_RE, PADEL_TYPES,
//                         QUALITY_TYPES, LONG_TYPES, TEST_RACE_TYPES)
//      comment-editor.js (openSessionCommentEditor)
// NOTA: No declarar aquí constants de tipus — usar les de app.js

let _sessSessions = [];
let _sessType     = 'all';
let _sessPeriod   = 180;
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
  other:     s => !RUNNING_TYPES.has(s.tipusKey) && !STRENGTH_RE.test(s.tipusKey)
               && !TEST_RACE_TYPES.has(s.tipusKey) && !PADEL_TYPES.has(s.tipusKey),
};

const SESS_TYPE_LABELS = {
  all:      'Totes les sessions',
  z2:       'Sessions Z2',
  quality:  'Sessions de qualitat',
  long:     'Tirades llargues',
  testrace: 'Test i curses',
  strength: 'Sessions de força',
  other:    'Altres activitats',
};

// ── Punt d'entrada ─────────────────────────────────────────────────────────────────────
function renderSessionsView(sessions) {
  _sessSessions = sessions;
  initSessFilters();
  renderSessPanel();
  renderPMC(_sessSessions);
}

// ── Inicialitza listeners ─────────────────────────────────────────────────────
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

// ── Render principal ───────────────────────────────────────────────────────────────────
function renderSessPanel() {
  const filtered = applyFilters(_sessSessions);
  renderSessKPIs(filtered);
  renderSessTrendChart(filtered);
  renderSessTable(filtered);
}

// ── Filtratge ──────────────────────────────────────────────────────────────────────
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

// ── KPIs ─────────────────────────────────────────────────────────────────────────────
function renderSessKPIs(sessions) {
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
  setSessText('kpi-load', totalLoad>0 ? `${fmtNum(totalLoad)} TSS` : '--');
  setSessText('kpi-epoc', totalEpoc>0 ? fmtNum(totalEpoc)          : '--');
}

// ════════════════════════════════════════════════════════════════════════
// PMC — Performance Management Chart (CTL / ATL / TSB)
// Usa buildPMCData() de lib/metrics.js
// ════════════════════════════════════════════════════════════════════════

const PMC_GRADIENT_PLUGIN = {
  id: 'pmcTsbGradient',
  afterLayout(chart) {
    const { chartArea, scales } = chart;
    if (!chartArea || !scales.y2) return;
    const { top, bottom, height } = chartArea;
    if (!isFinite(top) || !isFinite(bottom) || height <= 0) return;
    const zeroY = scales.y2.getPixelForValue(0);
    const pct   = Math.max(0, Math.min(1, (zeroY - top) / height));
    const grad  = chart.ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0,   'rgba(34,197,94,0.18)');
    grad.addColorStop(pct, 'rgba(34,197,94,0.05)');
    grad.addColorStop(pct, 'rgba(239,68,68,0.05)');
    grad.addColorStop(1,   'rgba(239,68,68,0.18)');
    chart.data.datasets[2].backgroundColor = grad;
  }
};

function renderPMC(sessions) {
  const canvas = document.getElementById('chart-pmc');
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  _pmcChart = null;
  if (!sessions.length) return;

  _pmcDataCache = buildPMCData(sessions);   // ← lib/metrics.js
  if (!_pmcDataCache.length) return;

  const btn90 = document.getElementById('pmc-export-90');
  const btn7  = document.getElementById('pmc-export-7');
  if (btn90) btn90.disabled = false;
  if (btn7)  btn7.disabled  = false;

  const C      = CHART_COLORS;
  const labels = _pmcDataCache.map(d => d.label);

  _pmcChart = new Chart(canvas, {
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
          const estat = v>5?'\u2605 Fresc':v>-10?'\u2248 Neutral':'\u26a0\ufe0f Fatigat';
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

// ── Exportació PMC CSV ───────────────────────────────────────────────────────────────────
function exportPMCcsv(days) {
  if (!_pmcDataCache.length) return;
  const rows   = days>0 ? _pmcDataCache.slice(-days) : _pmcDataCache;
  const header = 'Data,TSS,CTL,ATL,TSB,Estat';
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

// ── Exportació Sessions CSV ──────────────────────────────────────────────────────────────
function exportSessionsCSV(days) {
  let rows = _sessSessions;
  if (days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0,0,0,0);
    rows = rows.filter(s => s.date >= cutoff);
  }
  rows = [...rows].sort((a,b) => a.date - b.date);
  if (!rows.length) return;
  const headers = Object.keys(rows[0].raw);
  // FIX: escCsv sense backtick fantasma — ternari correctament tancat
  const escCsv = v => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replaceAll('"', '""')}"`
      : s;
  };
  const lines = rows.map(s => headers.map(h => escCsv(s.raw[h] ?? '')).join(','));
  triggerCsvDownload([headers.map(escCsv).join(','), ...lines].join('\n'),
    `sessions_${days>0?days+'d':'complet'}_${new Date().toISOString().slice(0,10)}.csv`);
}

function triggerCsvDownload(csvContent, filename) {
  const blob = new Blob([csvContent], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════════════
// Gràfic de tendència — usa groupByWeek() de lib/metrics.js
// ════════════════════════════════════════════════════════════════════════

function renderSessTrendChart(sessions) {
  const ctx = document.getElementById('chart-sess-trend');
  if (!ctx) return;
  const existing = Chart.getChart(ctx);
  if (existing) existing.destroy();
  _sessChart = null;
  if (sessions.length < 1) { ctx.style.display='none'; return; }
  ctx.style.display = '';
  const byWeek = (_sessType === 'testrace')
    ? sessions.map(s => ({ ...s, label: s.displayDate }))
    : groupByWeek(sessions);           // ← lib/metrics.js
  _sessChart = new Chart(ctx, buildSessChartConfig(byWeek, byWeek.map(w=>w.label), sessions));
}

// ════════════════════════════════════════════════════════════════════════
// buildSessChartConfig
// ════════════════════════════════════════════════════════════════════════

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
  const scaleRitme = ()          => ({ ...yBase, position:'right', reverse:true, min:3, max:8,
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

  function tooltipLabel(c) {
    const v = c.parsed.y; if (v == null) return null;
    const lbl = c.dataset.label || '';
    if (lbl.includes('Ritme'))             return `  Ritme: ${formatPace(v,'')}`;
    if (lbl.includes('FC'))                return `  FC: ${v} ppm`;
    if (lbl.includes('Cad'))               return `  Cadència: ${v} spm`;
    if (lbl.includes('EPOC'))              return `  EPOC: ${v}`;
    if (lbl === 'TSS')                     return `  TSS: ${v}`;
    if (lbl.includes('Desnivell'))         return `  Desnivell: ${v} m`;
    if (lbl.includes('Km'))               return `  Km: ${v} km`;
    if (lbl.includes('Temps sèries'))      return `  Temps sèries: ${v} min`;
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
      if (hasLoad) datasets.push({ type:'line', label:'TSS',
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
               title:{display:true,text:'TSS / EPOC',color:C.text,font:{size:10}} } }
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

    // ── QUALITY ──────────────────────────────────────────────────────────────────────
    // Temps sèries: era type:'bar' a l'eix km (y). Ara és type:'line' a
    // un eix y4 propi (esquerra, offset) perquè té unitat «min» independent
    // dels km i no distorsiona les barres de volum.
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

      // Temps sèries → línia a eix dedicat y4
      if (hasDurS) datasets.push({
        type: 'line',
        label: 'Temps sèries (min)',
        data: byWeek.map(w => w.totalDurSeries > 0 ? w.totalDurSeries : null),
        borderColor:     COL.dur.line,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        spanGaps: true,
        yAxisID: 'y4',
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
      return { type:'bar', data:{labels,datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{
          x:  baseOpts.scales.x,
          y:  scaleKm('km'),
          y2: hasRitme ? scaleRitme() : { display:false },
          y3: hasFC    ? scaleFC()    : { display:false },
          y4: hasDesn  ? scaleDesn()  : { display:false },
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
        { label:'TSS', data:byWeek.map(w=>w.load),
          backgroundColor:COL.load.bar, borderColor:COL.load.line, borderWidth:1, borderRadius:4 },
        { label:'EPOC', data:byWeek.map(w=>w.epoc),
          backgroundColor:COL.epoc.bar, borderColor:COL.epoc.line, borderWidth:1, borderRadius:4 },
      ]}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:yBase }
      }};

    case 'other':
      return { type:'bar', data:{labels, datasets:[
        { label:'TSS', data:byWeek.map(w=>w.load),
          backgroundColor:COL.load.bar, borderColor:COL.load.line, borderWidth:1, borderRadius:4 },
        { label:'EPOC', data:byWeek.map(w=>w.epoc),
          backgroundColor:COL.epoc.bar, borderColor:COL.epoc.line, borderWidth:1, borderRadius:4 },
      ]}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:yBase }
      }};
  }
}

// ── Taula ─────────────────────────────────────────────────────────────────────────────
function renderSessTable(sessions) {
  const thead=document.getElementById('sess-thead');
  const tbody=document.getElementById('sess-tbody');
  const title=document.getElementById('sess-table-title');
  const badge=document.getElementById('sess-count-badge');
  if (!thead||!tbody) return;
  if (title) title.textContent=SESS_TYPE_LABELS[_sessType]||'Sessions';
  if (badge) badge.textContent=`${sessions.length} sessions`;
  const sb7  = document.getElementById('sess-export-7');
  const sb90 = document.getElementById('sess-export-90');
  if (sb7)  sb7.disabled  = !_sessSessions.length;
  if (sb90) sb90.disabled = !_sessSessions.length;
  const cols = getSessCols(_sessType);
  thead.innerHTML = `<tr>${cols.map(c=>`<th${c.cls?` class="${c.cls}"`:''}>${c.label}</th>`).join('')}</tr>`;
  if (!sessions.length) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty-row">Cap sessió amb els filtres seleccionats.</td></tr>`;
    return;
  }
  tbody.innerHTML = sessions
    .map(s => `<tr>${cols.map(c=>`<td${c.cls?` class="${c.cls}"`:''}>${c.render(s)}</td>`).join('')}</tr>`)
    .join('');

  bindSessCommentButtons();
}

// ── Columna comentari (shared entre tots els tipus) ──────────────────────────────
function makeColComentari() {
  return {
    label: '&#x270F;',
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
        title="${titleAttr}"
        onclick="openSessionCommentEditor({ arxiu: '${esc(s.raw['Arxiu']||'')}', data: '${esc(s.displayDate||'')}', tipus: '${esc(s.tipus||'')}' })"
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
  const colKm         = {label:'Km',               render:s=>s.distancia>0?`${fmtNum(s.distancia)} km`:'\u2014'};
  const colDurada     = {label:'Durada',           render:s=>s.durada>0?`${fmtNum(s.durada)} min`:'\u2014'};
  const colRitme      = {label:'Ritme',            render:s=>formatPace(s.ritme)};
  const colFC         = {label:'FC',               render:s=>fcBadgeHTML(s.fcMitja)};
  const colCarrega = {
    label: 'TSS',
    render: s => (typeof s.carrega === 'number' && s.carrega > 0) ? tssDotHTML(s.carrega) : '\u2014'
  };
  const colEpoc = {
    label: 'EPOC',
    render: s => { const e = toNumber(s.raw['EPOC']); return (typeof e === 'number' && e > 0) ? loadBadgeHTML(e) : '\u2014'; }
  };
  const colRecup      = {label:'Recup.',            render:s=>{const r=toNumber(s.raw['Recup(h)']);return typeof r==='number'&&r>0?`${fmtNum(r)} h`:'\u2014';}};
  const colZ2min      = {label:'Z2 (min)',          render:s=>s.z2min>0?`${fmtNum(s.z2min)} min`:'\u2014'};
  const colCad        = {label:'Cadència',          render:s=>{const c=toNumber(s.raw['Cadencia(spm)']);return typeof c==='number'&&c>0?`${Math.round(c)} spm`:'\u2014';}};
  const colDesnivell  = {label:'Desnivell',         render:s=>{const d=toNumber(s.raw['Desnivell(m)']);return typeof d==='number'&&d>0?`${Math.round(d)} m`:'\u2014';}};
  const colRitmeSeries= {label:'Ritme sèries',      render:s=>formatPace(typeof s.ritmeMitjaSeries==='number'?s.ritmeMitjaSeries:null)};
  const colFCSeries   = {label:'FC sèries',         render:s=>fcBadgeHTML(s.fcMitjaSeries)};
  const colSeries     = {label:'Sèries',            render:s=>{const n=toNumber(s.raw['Num_Series']);return typeof n==='number'&&n>0?String(Math.round(n)):'\u2014';}};
  const colPTE        = {label:'PTE',               render:s=>{const p=toNumber(s.raw['PTE']);return typeof p==='number'&&p>0?fmtNum(p):'\u2014';}};

  // FIX 1: usa s.duradaMitjaSeries (ja enriquit per enrichSessionRow) en lloc de
  // recalcular via parseDurSeries(s), que depèn del JSON Series_Detall i pot fallar.
  const colDurSerie = {
    label: 'Dur/Sèrie',
    render: s => {
      const dur = s.duradaMitjaSeries;
      return (typeof dur === 'number' && isFinite(dur) && dur > 0)
        ? `${fmtNum(Math.round(dur * 10) / 10)} min`
        : '\u2014';
    }
  };

  switch (type) {
    case 'z2':       return [colData,colKm,colDurada,colRitme,colCad,colFC,colZ2min,colEpoc,colCarrega,colComentari];
    case 'quality':  return [colData,colTipus,colSeries,colDurSerie,colRitmeSeries,colFCSeries,colKm,colCarrega,colPTE,colComentari];
    case 'long':     return [colData,colTipus,colKm,colDurada,colRitme,colFC,colDesnivell,colZ2min,colCarrega,colComentari];
    case 'testrace': return [colData,colTipus,colKm,colDurada,colRitme,colFC,colDesnivell,colCarrega,colComentari];
    case 'strength': return [colData,colTipus,colDurada,colFC,colCarrega,colEpoc,colRecup,colComentari];
    case 'other':    return [colData,colTipus,colDurada,colFC,colCarrega,colEpoc,colComentari];
    default:         return [colData,colTipus,colKm,colDurada,colRitme,colFC,colCarrega,colEpoc,colComentari];
  }
}

function setSessText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Helpers de comentari ──────────────────────────────────────────────────────────────

function commentPreview(comment, max = 36) {
  const txt = String(comment ?? '').trim();
  if (!txt) return '';
  return txt.length > max ? `${esc(txt.slice(0, max))}\u2026` : esc(txt);
}

function bindSessCommentButtons() {
  const tbody = document.getElementById('sess-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('[data-comment-arxiu]').forEach(btn => {
    if (btn.dataset.commentBound) return;
    btn.dataset.commentBound = '1';
  });
}
