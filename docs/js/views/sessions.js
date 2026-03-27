// docs/js/views/sessions.js
// Panell Sessions: filtres, KPIs, gràfic tendència, PMC + exportació CSV, taula
// Dep: app.js (formatPace, toNumber) | charts.js (CHART_COLORS)

let _sessSessions = [];
let _sessType     = 'all';
let _sessPeriod   = 180;
let _sessChart    = null;
let _pmcChart     = null;
let _pmcDataCache = [];

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

// ── Punt d'entrada ─────────────────────────────────────────────────────────
function renderSessionsView(sessions) {
  _sessSessions = sessions;
  initSessFilters();
  renderSessPanel();
  renderPMC(_sessSessions);
}

// ── Inicialitza listeners ──────────────────────────────────────────────────
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
  renderSessKPIs(filtered);
  renderSessTrendChart(filtered);
  renderSessTable(filtered);
}

// ── Filtratge ───────────────────────────────────────────────────────────────
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

// ── KPIs ───────────────────────────────────────────────────────────────────
function renderSessKPIs(sessions) {
  const totalKm   = sessions.reduce((a,s) => a + (s.distancia||0), 0);
  const totalMin  = sessions.reduce((a,s) => a + (s.durada||0), 0);
  const totalLoad = sessions.reduce((a,s) => a + (s.carrega||0), 0);
  const totalEpoc = sessions.reduce((a,s) => {
    const e = toNumber(s.raw['EPOC']); return a + (typeof e==='number'&&e>0?e:0);
  }, 0);
  const h = Math.floor(totalMin/60), min = Math.round(totalMin%60);
  const timeTxt = totalMin>0 ? (h>0?`${h}h ${min}min`:`${min} min`) : '--';
  setSessText('kpi-km',   totalKm>0  ? `${fmtS(totalKm)} km`    : '--');
  setSessText('kpi-time', timeTxt);
  setSessText('kpi-load', totalLoad>0 ? `${fmtS(totalLoad)} TSS` : '--');
  setSessText('kpi-epoc', totalEpoc>0 ? fmtS(totalEpoc)           : '--');
}

// ════════════════════════════════════════════════════════════════════════════
// PMC — Performance Management Chart (CTL / ATL / TSB)
// ════════════════════════════════════════════════════════════════════════════

const PMC_CTL_TAU = 42;
const PMC_ATL_TAU = 7;

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

  _pmcDataCache = buildPMCData(sessions);
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
        { label:'CTL \u2014 Forma', data:_pmcDataCache.map(d=>Math.round(d.ctl*10)/10),
          borderColor:C.green, backgroundColor:'transparent',
          borderWidth:2.5, pointRadius:0, tension:0.3, yAxisID:'y' },
        { label:'ATL \u2014 Fatiga', data:_pmcDataCache.map(d=>Math.round(d.atl*10)/10),
          borderColor:'rgba(249,115,22,0.9)', backgroundColor:'transparent',
          borderWidth:2, pointRadius:0, tension:0.3, yAxisID:'y' },
        { label:'TSB \u2014 Frescor', data:_pmcDataCache.map(d=>Math.round(d.tsb*10)/10),
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

function buildPMCData(sessions) {
  if (!sessions.length) return [];
  const tssByDay = new Map();
  sessions.forEach(s => {
    if (!s.date) return;
    const key = s.date.toISOString().slice(0,10);
    tssByDay.set(key, (tssByDay.get(key)||0) + (s.carrega||0));
  });
  const allDates = [...tssByDay.keys()].sort();
  if (!allDates.length) return [];
  const startDate = new Date(allDates[0]);
  const endDate   = new Date(); endDate.setHours(0,0,0,0);
  const kCTL = Math.exp(-1/PMC_CTL_TAU);
  const kATL = Math.exp(-1/PMC_ATL_TAU);
  let ctl=0, atl=0;
  const result=[];
  for (let d=new Date(startDate); d<=endDate; d.setDate(d.getDate()+1)) {
    const key = d.toISOString().slice(0,10);
    const tss = tssByDay.get(key)||0;
    ctl = ctl*kCTL + tss*(1-kCTL);
    atl = atl*kATL + tss*(1-kATL);
    const tsb   = ctl-atl;
    const estat = tsb>5?'Fresc':tsb>-10?'Neutral':'Fatigat';
    const dd    = String(d.getDate()).padStart(2,'0');
    const mm    = String(d.getMonth()+1).padStart(2,'0');
    result.push({ label:`${dd}/${mm}`, date:key, tss, ctl, atl, tsb, estat });
  }
  return result;
}

// ── Exportació PMC CSV ──────────────────────────────────────────────────
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

// ── Exportació Sessions CSV ────────────────────────────────────────────────
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
  const esc = v => { const s=String(v??''); return (s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s.replaceAll('"','""')}"`:s; };
  const lines = rows.map(s => headers.map(h => esc(s.raw[h]??'')).join(','));
  triggerCsvDownload([headers.map(esc).join(','),...lines].join('\n'),
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

// ════════════════════════════════════════════════════════════════════════════
// Gràfic de tendència
// ════════════════════════════════════════════════════════════════════════════

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
    : groupByWeek(sessions);
  _sessChart = new Chart(ctx, buildSessChartConfig(byWeek, byWeek.map(w=>w.label), sessions));
}

// ── avgValid: null-safe (typeof number) ──────────────────────────────────
function avgValid(sessions, fn) {
  const vals = sessions.map(fn).filter(v => typeof v === 'number' && isFinite(v) && v > 0);
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
}

function getMondayOf(date) {
  const d=new Date(date), dow=d.getDay();
  d.setDate(d.getDate()-(dow===0?6:dow-1)); d.setHours(0,0,0,0); return d;
}

// ── parseDurSeries: suma dur_min de Series_Detall (JSON) ─────────────────────
function parseDurSeries(session) {
  const raw = session.raw['Series_Detall'];
  if (!raw || raw === '') return 0;
  try {
    const detall = JSON.parse(raw);
    if (!Array.isArray(detall)) return 0;
    return detall.reduce((a, s) => {
      const v = typeof s.dur_min === 'number' ? s.dur_min : parseFloat(s.dur_min);
      return a + (isFinite(v) && v > 0 ? v : 0);
    }, 0);
  } catch { return 0; }
}

// ── groupByWeek ───────────────────────────────────────────────────────────────
function groupByWeek(sessions) {
  const map = new Map();
  const sorted = [...sessions].sort((a,b)=>a.date-b.date);
  sorted.forEach(s => {
    const monday = getMondayOf(s.date);
    const key    = monday.toISOString().slice(0,10);
    if (!map.has(key)) map.set(key,{date:monday,sessions:[]});
    map.get(key).sessions.push(s);
  });
  return Array.from(map.values()).map(w => {
    const ss = w.sessions;
    const totalKm        = ss.reduce((a,s)=>a+(typeof s.distancia==='number'&&s.distancia>0?s.distancia:0),0);
    const totalLoad      = ss.reduce((a,s)=>a+(typeof s.carrega==='number'&&s.carrega>0?s.carrega:0),0);
    const totalEpoc      = ss.reduce((a,s)=>{const e=toNumber(s.raw['EPOC']);   return a+(typeof e==='number'&&e>0?e:0);},0);
    const totalDesnivell = ss.reduce((a,s)=>{const d=toNumber(s.raw['Desnivell(m)']); return a+(typeof d==='number'&&d>0?d:0);},0);
    const totalZ1        = ss.reduce((a,s)=>{const v=toNumber(s.raw['Z1(min)']); return a+(typeof v==='number'&&v>0?v:0);},0);
    const totalZ2        = ss.reduce((a,s)=>{const v=toNumber(s.raw['Z2(min)']); return a+(typeof v==='number'&&v>0?v:0);},0);
    const avgPace        = avgValid(ss, s => (typeof s.ritme==='number'&&s.ritme>0) ? s.ritme : null);
    const avgFC          = avgValid(ss, s => (typeof s.fcMitja==='number'&&s.fcMitja>0) ? s.fcMitja : null);
    const avgCad         = avgValid(ss, s => { const c=toNumber(s.raw['Cadencia(spm)']); return (typeof c==='number'&&c>0)?c:null; });
    const avgPaceSeries  = avgValid(ss, s => (typeof s.ritmeMitjaSeries==='number'&&s.ritmeMitjaSeries>0) ? s.ritmeMitjaSeries : null);
    const avgFCSeries    = avgValid(ss, s => (typeof s.fcMitjaSeries==='number'&&s.fcMitjaSeries>0) ? s.fcMitjaSeries : null);
    const avgCadSeries   = avgValid(ss, s => { const c=toNumber(s.raw['Cadencia_Mitja_Series']); return (typeof c==='number'&&c>0)?c:null; });
    const totalDurSeries = Math.round(ss.reduce((a,s) => a + parseDurSeries(s), 0) * 10) / 10;
    const d=w.date, dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0');
    return {
      label: `${dd}/${mm}`,
      km:    Math.round(totalKm*10)/10,
      load:  Math.round(totalLoad*10)/10,
      epoc:  Math.round(totalEpoc*10)/10,
      desnivell: Math.round(totalDesnivell),
      z1min: Math.round(totalZ1*10)/10,
      z2min: Math.round(totalZ2*10)/10,
      avgPace,
      avgFC:         typeof avgFC==='number'         ? Math.round(avgFC)               : null,
      avgCad:        typeof avgCad==='number'        ? Math.round(avgCad)              : null,
      avgPaceSeries: typeof avgPaceSeries==='number' ? Math.round(avgPaceSeries*100)/100 : null,
      avgFCSeries:   typeof avgFCSeries==='number'   ? Math.round(avgFCSeries)         : null,
      avgCadSeries:  typeof avgCadSeries==='number'  ? Math.round(avgCadSeries)        : null,
      totalDurSeries,
      count: ss.length,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// buildSessChartConfig
// ════════════════════════════════════════════════════════════════════════════

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
    dur:  { bar:'rgba(56,189,248,0.35)', line:'rgba(56,189,248,0.9)'  },
  };
  const baseOpts = {
    responsive:true, maintainAspectRatio:false,
    interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{ position:'top', labels:{ boxWidth:12, padding:14 } } },
    scales:{ x:{ grid:{color:C.gridLine}, ticks:{font:{size:11}} } },
  };
  const yBase = { grid:{color:C.gridLine}, ticks:{font:{size:11}}, beginAtZero:true };

  const scaleKm = (lbl='km') => ({ ...yBase, position:'left',
    title:{ display:true, text:lbl, color:C.text, font:{size:10} } });
  const scaleDur = (lbl='min') => ({ ...yBase, position:'left',
    title:{ display:true, text:lbl, color:C.text, font:{size:10} } });
  const scaleRitme = () => ({ ...yBase, position:'right', reverse:true, min:3, max:8,
    grid:{ drawOnChartArea:false },
    ticks:{ ...yBase.ticks, callback: v => formatPace(v,'') },
    title:{ display:true, text:'min/km', color:C.text, font:{size:10} } });
  const scaleFC = () => ({ ...yBase, position:'right', offset:true, beginAtZero:false,
    grid:{ drawOnChartArea:false },
    ticks:{ ...yBase.ticks, callback: v => `${v}` },
    title:{ display:true, text:'ppm / spm', color:C.text, font:{size:10} } });
  const scaleDesn = () => ({ ...yBase, position:'left', offset:true,
    grid:{ drawOnChartArea:false },
    ticks:{ ...yBase.ticks, callback: v => `${v} m` },
    title:{ display:true, text:'m D+', color:C.text, font:{size:10} } });

  function tooltipLabel(c) {
    const v = c.parsed.y; if (v == null) return null;
    const lbl = c.dataset.label || '';
    if (lbl.includes('Ritme'))             return `  Ritme: ${formatPace(v,'')}`;
    if (lbl.includes('FC'))                return `  FC: ${v} ppm`;
    if (lbl.includes('Cad'))               return `  Cad\u00e8ncia: ${v} spm`;
    if (lbl.includes('EPOC'))              return `  EPOC: ${v}`;
    if (lbl.includes('C\u00e0rrega'))      return `  C\u00e0rrega: ${v} TSS`;
    if (lbl.includes('Desnivell'))         return `  Desnivell: ${v} m`;
    if (lbl.includes('Km'))                return `  Km: ${v} km`;
    if (lbl.includes('Temps s\u00e8ries')) return `  Temps s\u00e8ries: ${v} min`;
    return ` ${lbl}: ${v}`;
  }

  switch (_sessType) {

    // ── TOTES ───────────────────────────────────────────────────────────────
    case 'all':
    default: {
      const hasLoad = byWeek.some(w=>w.load>0);
      const hasEpoc = byWeek.some(w=>w.epoc>0);
      const datasets = [
        { type:'bar', label:'Km', data:byWeek.map(w=>w.km),
          backgroundColor:COL.km.bar, borderColor:COL.km.line,
          borderWidth:1, borderRadius:4, yAxisID:'y' },
      ];
      if (hasLoad) datasets.push({ type:'line', label:'C\u00e0rrega TSS',
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

    // ── Z2 ─────────────────────────────────────────────────────────────────
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
      if (hasCad) datasets.push({ type:'line', label:'Cad\u00e8ncia (spm)',
        data:byWeek.map(w=>w.avgCad), borderColor:COL.cad.line, backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y3', spanGaps:true });
      return { type:'bar', data:{labels,datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:scaleKm('km'),
          y2: hasRitme        ? scaleRitme() : { display:false },
          y3: (hasFC||hasCad) ? scaleFC()    : { display:false } }
      }};
    }

    // ── QUALITAT ────────────────────────────────────────────────────────────
    case 'quality': {
      const hasDurS  = byWeek.some(w => w.totalDurSeries > 0);
      const hasPaceS = byWeek.some(w => w.avgPaceSeries  !== null);
      const hasFCS   = byWeek.some(w => w.avgFCSeries    !== null);
      const hasCadS  = byWeek.some(w => w.avgCadSeries   !== null);
      const datasets = [];
      if (hasDurS) datasets.push({
        type:'bar', label:'Temps s\u00e8ries (min)',
        data:byWeek.map(w => w.totalDurSeries > 0 ? w.totalDurSeries : null),
        backgroundColor:COL.dur.bar, borderColor:COL.dur.line,
        borderWidth:1, borderRadius:4, yAxisID:'y'
      });
      if (hasPaceS) datasets.push({ type:'line', label:'Ritme s\u00e8ries (min/km)',
        data:byWeek.map(w=>w.avgPaceSeries), borderColor:COL.ritme.line,
        backgroundColor:'transparent', borderWidth:2, pointRadius:4,
        tension:0.3, yAxisID:'y2', spanGaps:true });
      if (hasFCS) datasets.push({ type:'line', label:'FC s\u00e8ries (ppm)',
        data:byWeek.map(w=>w.avgFCSeries), borderColor:COL.fc.line,
        backgroundColor:'transparent', borderWidth:2, pointRadius:4,
        tension:0.3, yAxisID:'y3', spanGaps:true });
      if (hasCadS) datasets.push({ type:'line', label:'Cad\u00e8ncia s\u00e8ries (spm)',
        data:byWeek.map(w=>w.avgCadSeries), borderColor:COL.cad.line,
        backgroundColor:'transparent', borderWidth:2, pointRadius:4,
        tension:0.3, yAxisID:'y3', spanGaps:true });
      return { type:'bar', data:{labels,datasets}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x,
          y:  hasDurS            ? scaleDur('min')  : { display:false },
          y2: hasPaceS           ? scaleRitme()     : { display:false },
          y3: (hasFCS||hasCadS)  ? scaleFC()        : { display:false } }
      }};
    }

    // ── TIRADA LLARGA ─────────────────────────────────────────────────────────
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

    // ── TEST / CURSA ─────────────────────────────────────────────────────────
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

    // ── FORÇA ───────────────────────────────────────────────────────────────
    case 'strength':
      return { type:'bar', data:{labels, datasets:[
        { label:'C\u00e0rrega (TSS)', data:byWeek.map(w=>w.load),
          backgroundColor:COL.load.bar, borderColor:COL.load.line, borderWidth:1, borderRadius:4 },
        { label:'EPOC', data:byWeek.map(w=>w.epoc),
          backgroundColor:COL.epoc.bar, borderColor:COL.epoc.line, borderWidth:1, borderRadius:4 },
      ]}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:yBase }
      }};

    // ── ALTRES ──────────────────────────────────────────────────────────────
    case 'other':
      return { type:'bar', data:{labels, datasets:[
        { label:'C\u00e0rrega (TSS)', data:byWeek.map(w=>w.load),
          backgroundColor:COL.load.bar, borderColor:COL.load.line, borderWidth:1, borderRadius:4 },
        { label:'EPOC', data:byWeek.map(w=>w.epoc),
          backgroundColor:COL.epoc.bar, borderColor:COL.epoc.line, borderWidth:1, borderRadius:4 },
      ]}, options:{...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:tooltipLabel}}},
        scales:{ x:baseOpts.scales.x, y:yBase }
      }};
  }
}

// ── Taula ─────────────────────────────────────────────────────────────────
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
  thead.innerHTML = `<tr>${cols.map(c=>`<th>${c.label}</th>`).join('')}</tr>`;
  if (!sessions.length) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty-row">Cap sessi\u00f3 amb els filtres seleccionats.</td></tr>`;
    return;
  }
  tbody.innerHTML = sessions.map(s=>`<tr>${cols.map(c=>`<td>${c.render(s)}</td>`).join('')}</tr>`).join('');
}

function getSessCols(type) {
  const colData       = {label:'Data',              render:s=>escS(s.displayDate)};
  const colTipus      = {label:'Tipus',              render:s=>escS(s.tipus)};
  const colKm         = {label:'Km',                 render:s=>s.distancia>0?`${fmtS(s.distancia)} km`:'\u2014'};
  const colDurada     = {label:'Durada',             render:s=>s.durada>0?`${fmtS(s.durada)} min`:'\u2014'};
  const colRitme      = {label:'Ritme',              render:s=>formatPace(s.ritme)};
  const colFC         = {label:'FC',                 render:s=>typeof s.fcMitja==='number'&&s.fcMitja>0?`${Math.round(s.fcMitja)} ppm`:'\u2014'};
  const colCarrega    = {label:'C\u00e0rrega TSS',   render:s=>typeof s.carrega==='number'&&s.carrega>0?`${fmtS(s.carrega)} TSS`:'\u2014'};
  const colZ2min      = {label:'Z2 (min)',           render:s=>s.z2min>0?`${fmtS(s.z2min)} min`:'\u2014'};
  const colCad        = {label:'Cad\u00e8ncia',      render:s=>{const c=toNumber(s.raw['Cadencia(spm)']);return typeof c==='number'&&c>0?`${Math.round(c)} spm`:'\u2014';}};
  const colDesnivell  = {label:'Desnivell',          render:s=>{const d=toNumber(s.raw['Desnivell(m)']);return typeof d==='number'&&d>0?`${Math.round(d)} m`:'\u2014';}};
  const colEpoc       = {label:'EPOC',               render:s=>{const e=toNumber(s.raw['EPOC']);return typeof e==='number'&&e>0?fmtS(e):'\u2014';}};
  const colRecup      = {label:'Recup.',             render:s=>{const r=toNumber(s.raw['Recup(h)']);return typeof r==='number'&&r>0?`${fmtS(r)} h`:'\u2014';}};
  const colRitmeSeries= {label:'Ritme s\u00e8ries',  render:s=>formatPace(typeof s.ritmeMitjaSeries==='number'?s.ritmeMitjaSeries:null)};
  const colFCSeries   = {label:'FC s\u00e8ries',      render:s=>typeof s.fcMitjaSeries==='number'&&s.fcMitjaSeries>0?`${Math.round(s.fcMitjaSeries)} ppm`:'\u2014'};
  const colSeries     = {label:'S\u00e8ries',         render:s=>{const n=toNumber(s.raw['Num_Series']);return typeof n==='number'&&n>0?String(Math.round(n)):'\u2014';}};
  const colPTE        = {label:'PTE',                render:s=>{const p=toNumber(s.raw['PTE']);return typeof p==='number'&&p>0?fmtS(p):'\u2014';}};
  // Durada mitja per sèrie: totalDurSeries / Num_Series
  const colDurSerie   = {
    label: 'Dur/S\u00e8rie',
    render: s => {
      const n   = toNumber(s.raw['Num_Series']);
      const dur = parseDurSeries(s);
      if (typeof n !== 'number' || n <= 0 || dur <= 0) return '\u2014';
      const mitja = Math.round((dur / n) * 10) / 10;
      return `${fmtS(mitja)} min`;
    }
  };
  switch (type) {
    case 'z2':       return [colData,colKm,colDurada,colRitme,colCad,colFC,colZ2min,colEpoc,colCarrega];
    case 'quality':  return [colData,colTipus,colKm,colDurada,colSeries,colDurSerie,colRitmeSeries,colFCSeries,colPTE,colCarrega];
    case 'long':     return [colData,colTipus,colKm,colDurada,colRitme,colZ2min,colDesnivell,colFC,colCarrega];
    case 'testrace': return [colData,colTipus,colKm,colDurada,colRitme,colFC,colDesnivell,colEpoc,colCarrega];
    case 'strength': return [colData,colTipus,colDurada,colEpoc,colRecup,colCarrega];
    case 'other':    return [colData,colTipus,colDurada,colFC,colEpoc,colCarrega];
    default:         return [colData,colTipus,colKm,colDurada,colFC,colEpoc,colCarrega];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtS(value) {
  const n = parseFloat(value); if (!isFinite(n)) return '--';
  return new Intl.NumberFormat('ca-ES', {maximumFractionDigits:1}).format(n);
}
function setSessText(id, value) { const el=document.getElementById(id); if(el) el.textContent=value; }
function escS(v) { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
