// docs/js/views/sessions.js
// Panell Sessions: filtres, KPIs, gràfic tendència, PMC + exportació CSV, taula
// Dep: app.js (formatPace, toNumber) | charts.js (CHART_COLORS)

let _sessSessions = [];
let _sessType     = 'all';
let _sessPeriod   = 180;
let _sessChart    = null;
let _pmcChart     = null;
let _pmcDataCache = []; // cache per als botons d'exportació

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
  renderPMC(_sessSessions);
}

// ── Inicialitza listeners ────────────────────────────────────────────────────
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

// ── Render principal (filtrat) ───────────────────────────────────────────────
function renderSessPanel() {
  const filtered = applyFilters(_sessSessions);
  renderSessKPIs(filtered);
  renderSessTrendChart(filtered);
  renderSessTable(filtered);
}

// ── Filtratge ────────────────────────────────────────────────────────────────
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
    const e = toNumber(s.raw['EPOC']); return a + (isFinite(e)&&e>0?e:0);
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

  _pmcDataCache = buildPMCData(sessions); // guarda per exportació
  if (!_pmcDataCache.length) return;

  // Activa botons d'exportació ara que tenim dades
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
        {
          label: 'CTL — Forma',
          data:  _pmcDataCache.map(d => Math.round(d.ctl * 10) / 10),
          borderColor: C.green, backgroundColor: 'transparent',
          borderWidth: 2.5, pointRadius: 0, tension: 0.3, yAxisID: 'y',
        },
        {
          label: 'ATL — Fatiga',
          data:  _pmcDataCache.map(d => Math.round(d.atl * 10) / 10),
          borderColor: 'rgba(249,115,22,0.9)', backgroundColor: 'transparent',
          borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y',
        },
        {
          label: 'TSB — Frescor',
          data:  _pmcDataCache.map(d => Math.round(d.tsb * 10) / 10),
          borderColor: C.blue, backgroundColor: 'rgba(56,189,248,0.08)',
          fill: true, borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y2',
        },
      ]
    },
    plugins: [PMC_GRADIENT_PLUGIN],
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
        tooltip: { callbacks: { label: c => {
          const v = c.parsed.y;
          if (c.datasetIndex === 0) return ` CTL (Forma): ${v}`;
          if (c.datasetIndex === 1) return ` ATL (Fatiga): ${v}`;
          const estat = v > 5 ? '\u2605 Fresc' : v > -10 ? '\u2248 Neutral' : '\u26a0\ufe0f Fatigat';
          return ` TSB (Frescor): ${v}  ${estat}`;
        }}}
      },
      scales: {
        x: { grid: { color: CHART_COLORS.gridLine },
             ticks: { font: { size: 10 }, maxTicksLimit: 12, maxRotation: 0 } },
        y: { position: 'left', grid: { color: CHART_COLORS.gridLine },
             ticks: { font: { size: 11 } }, beginAtZero: true,
             title: { display: true, text: 'CTL / ATL', color: CHART_COLORS.text, font: { size: 11 } } },
        y2: { position: 'right', grid: { drawOnChartArea: false },
              ticks: { font: { size: 11 } },
              title: { display: true, text: 'TSB', color: CHART_COLORS.text, font: { size: 11 } } }
      }
    }
  });
}

function buildPMCData(sessions) {
  if (!sessions.length) return [];
  const tssByDay = new Map();
  sessions.forEach(s => {
    if (!s.date) return;
    const key = s.date.toISOString().slice(0, 10);
    tssByDay.set(key, (tssByDay.get(key) || 0) + (s.carrega || 0));
  });
  const allDates = [...tssByDay.keys()].sort();
  if (!allDates.length) return [];
  const startDate = new Date(allDates[0]);
  const endDate   = new Date(); endDate.setHours(0,0,0,0);
  const kCTL = Math.exp(-1 / PMC_CTL_TAU);
  const kATL = Math.exp(-1 / PMC_ATL_TAU);
  let ctl = 0, atl = 0;
  const result = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = s = d.toISOString().slice(0, 10);
    const tss = tssByDay.get(key) || 0;
    ctl = ctl * kCTL + tss * (1 - kCTL);
    atl = atl * kATL + tss * (1 - kATL);
    const tsb   = ctl - atl;
    const estat = tsb > 5 ? 'Fresc' : tsb > -10 ? 'Neutral' : 'Fatigat';
    const dd    = String(d.getDate()).padStart(2,'0');
    const mm    = String(d.getMonth()+1).padStart(2,'0');
    result.push({ label:`${dd}/${mm}`, date:key, tss, ctl, atl, tsb, estat });
  }
  return result;
}

// ── Exportació PMC CSV ─────────────────────────────────────────────────────
function exportPMCcsv(days) {
  if (!_pmcDataCache.length) return;

  // Agafa els darrers N dies del cache
  const rows = days > 0 ? _pmcDataCache.slice(-days) : _pmcDataCache;

  // Capçalera
  const header = 'Data,TSS,CTL,ATL,TSB,Estat';

  // Files: valors arrodonits a 1 decimal per llegibilitat
  const lines = rows.map(d => [
    d.date,
    Math.round(d.tss),
    (Math.round(d.ctl * 10) / 10).toFixed(1),
    (Math.round(d.atl * 10) / 10).toFixed(1),
    (Math.round(d.tsb * 10) / 10).toFixed(1),
    d.estat,
  ].join(','));

  const csv      = [header, ...lines].join('\n');
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const filename = `pmc_${days > 0 ? days + 'd' : 'complet'}_${new Date().toISOString().slice(0,10)}.csv`;

  // Descàrrega sense servidor: crea un link temporal, el clica i l'elimina
  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════════════════
// Gràfic de tendència (canvia per filtre)
// ════════════════════════════════════════════════════════════════════════════

function renderSessTrendChart(sessions) {
  const ctx = document.getElementById('chart-sess-trend');
  if (!ctx) return;
  const existing = Chart.getChart(ctx);
  if (existing) existing.destroy();
  _sessChart = null;
  if (sessions.length < 2) { ctx.style.display = 'none'; return; }
  ctx.style.display = '';
  const byWeek = groupByWeek(sessions);
  _sessChart = new Chart(ctx, buildSessChartConfig(byWeek, byWeek.map(w => w.label), sessions));
}

function groupByWeek(sessions) {
  const map = new Map();
  const sorted = [...sessions].sort((a,b) => a.date - b.date);
  sorted.forEach(s => {
    const monday = getMondayOf(s.date);
    const key    = monday.toISOString().slice(0,10);
    if (!map.has(key)) map.set(key, { date: monday, sessions: [] });
    map.get(key).sessions.push(s);
  });
  return Array.from(map.values()).map(w => {
    const ss = w.sessions;
    const totalKm   = ss.reduce((a,s) => a+(s.distancia||0), 0);
    const totalLoad = ss.reduce((a,s) => a+(s.carrega||0), 0);
    const totalEpoc = ss.reduce((a,s) => { const e=toNumber(s.raw['EPOC']); return a+(isFinite(e)&&e>0?e:0); }, 0);
    const totalZ1   = ss.reduce((a,s) => { const v=toNumber(s.raw['Z1(min)']); return a+(isFinite(v)&&v>0?v:0); }, 0);
    const totalZ2   = ss.reduce((a,s) => { const v=toNumber(s.raw['Z2(min)']); return a+(isFinite(v)&&v>0?v:0); }, 0);
    const avgPace   = avgValidPace(ss);
    const avgFC     = avgValid(ss, s => s.fcMitja);
    const avgPaceSeries = avgValid(ss, s => isFinite(s.ritmeMitjaSeries)&&s.ritmeMitjaSeries>0?s.ritmeMitjaSeries:null);
    const d  = w.date;
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    return {
      label:`${dd}/${mm}`, km:Math.round(totalKm*10)/10,
      load:Math.round(totalLoad*10)/10, epoc:Math.round(totalEpoc*10)/10,
      z1min:Math.round(totalZ1*10)/10, z2min:Math.round(totalZ2*10)/10,
      avgPace, avgFC:avgFC?Math.round(avgFC):null,
      avgPaceSeries:avgPaceSeries?Math.round(avgPaceSeries*100)/100:null,
      count:ss.length,
    };
  });
}

function getMondayOf(date) {
  const d = new Date(date), dow = d.getDay();
  d.setDate(d.getDate() - (dow===0?6:dow-1));
  d.setHours(0,0,0,0);
  return d;
}

function avgValidPace(sessions) {
  const vals = sessions.map(s=>s.ritme).filter(v=>isFinite(v)&&v>0);
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}

function avgValid(sessions, fn) {
  const vals = sessions.map(fn).filter(v=>v!=null&&isFinite(v)&&v>0);
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}

// ── Configuració gràfic tendència ─────────────────────────────────────────────
function buildSessChartConfig(byWeek, labels, sessions) {
  const C = CHART_COLORS;
  const baseOpts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } } },
    scales: { x: { grid: { color: C.gridLine }, ticks: { font: { size: 11 } } } }
  };
  const yBase = { grid: { color: C.gridLine }, ticks: { font: { size: 11 } }, beginAtZero: true };

  switch (_sessType) {
    case 'z2': {
      const hasFC = byWeek.some(w => w.avgFC !== null);
      const datasets = [
        { type:'bar', label:'Z1 (min)', data:byWeek.map(w=>w.z1min),
          backgroundColor:'rgba(56,189,248,0.35)', borderColor:'rgba(56,189,248,0.7)',
          borderWidth:1, borderRadius:0, stack:'zones', yAxisID:'y' },
        { type:'bar', label:'Z2 (min)', data:byWeek.map(w=>w.z2min),
          backgroundColor:'rgba(34,197,94,0.45)', borderColor:C.green,
          borderWidth:1, borderRadius:0, stack:'zones', yAxisID:'y' },
      ];
      if (hasFC) datasets.push({ type:'line', label:'FC mitja (ppm)', data:byWeek.map(w=>w.avgFC),
        borderColor:'rgba(249,115,22,0.9)', backgroundColor:'transparent',
        borderWidth:2, pointRadius:4, tension:0.3, yAxisID:'y2', spanGaps:true });
      return { type:'bar', data:{labels,datasets}, options:{ ...baseOpts,
        plugins:{...baseOpts.plugins, tooltip:{callbacks:{label:c=>{
          if(c.dataset.yAxisID==='y2') return ` FC: ${c.parsed.y} ppm`;
          return ` ${c.dataset.label}: ${c.parsed.y} min`;
        }}}},
        scales:{ x:{...baseOpts.scales.x,stacked:true},
          y:{...yBase,position:'left',stacked:true,ticks:{...yBase.ticks,callback:v=>`${v} min`}},
          y2:hasFC?{...yBase,position:'right',grid:{drawOnChartArea:false},ticks:{...yBase.ticks,callback:v=>`${v} ppm`}}:{display:false},
        }
      }};
    }
    case 'quality': {
      const hasRitme = byWeek.some(w => w.avgPaceSeries !== null);
      const datasets = [{type:'bar',label:'C\u00e0rrega (TSS)',data:byWeek.map(w=>w.load),
        backgroundColor:C.greenSoft,borderColor:C.green,borderWidth:1,borderRadius:6,yAxisID:'y'}];
      if (hasRitme) datasets.push({type:'line',label:'Ritme s\u00e8ries (min/km)',data:byWeek.map(w=>w.avgPaceSeries),
        borderColor:C.blue,backgroundColor:C.blueSoft,borderWidth:2,pointRadius:4,tension:0.3,yAxisID:'y2',spanGaps:true});
      return {type:'bar',data:{labels,datasets},options:{...baseOpts,
        plugins:{...baseOpts.plugins,tooltip:{callbacks:{label:c=>c.dataset.yAxisID==='y2'?` Ritme: ${formatPace(c.parsed.y,'')}`:`  C\u00e0rrega: ${c.parsed.y} TSS`}}},
        scales:{x:baseOpts.scales.x,
          y:{...yBase,position:'left',ticks:{...yBase.ticks,callback:v=>`${v} TSS`}},
          y2:{...yBase,position:'right',grid:{drawOnChartArea:false},ticks:{...yBase.ticks,callback:v=>formatPace(v,'')},reverse:true},
        }
      }};
    }
    case 'strength':
      return {type:'bar',data:{labels,datasets:[
        {label:'C\u00e0rrega (TSS)',data:byWeek.map(w=>w.load),backgroundColor:C.greenSoft,borderColor:C.green,borderWidth:1,borderRadius:6},
        {label:'EPOC',data:byWeek.map(w=>w.epoc),backgroundColor:'rgba(249,115,22,0.2)',borderColor:'rgba(249,115,22,0.9)',borderWidth:1,borderRadius:6},
      ]},options:{...baseOpts,
        plugins:{...baseOpts.plugins,tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.y}`}}},
        scales:{x:baseOpts.scales.x,y:yBase}
      }};
    case 'long':
      return {type:'bar',data:{labels,datasets:[
        {type:'bar',label:'Km',data:byWeek.map(w=>w.km),backgroundColor:C.blueSoft,borderColor:C.blue,borderWidth:1,borderRadius:6,yAxisID:'y'},
        {type:'line',label:'Ritme mig (min/km)',data:byWeek.map(w=>w.avgPace),borderColor:C.green,backgroundColor:C.greenSoft,borderWidth:2,pointRadius:4,tension:0.3,yAxisID:'y2',spanGaps:true},
      ]},options:{...baseOpts,
        plugins:{...baseOpts.plugins,tooltip:{callbacks:{label:c=>c.dataset.yAxisID==='y2'?` Ritme: ${formatPace(c.parsed.y,'')}`:`  Km: ${c.parsed.y} km`}}},
        scales:{x:baseOpts.scales.x,
          y:{...yBase,position:'left',ticks:{...yBase.ticks,callback:v=>`${v} km`}},
          y2:{...yBase,position:'right',grid:{drawOnChartArea:false},ticks:{...yBase.ticks,callback:v=>formatPace(v,'')},reverse:true},
        }
      }};
    case 'testrace': {
      const sorted = [...sessions].sort((a,b)=>a.date-b.date);
      return {type:'line',data:{labels:sorted.map(s=>s.displayDate),datasets:[{
        label:'Ritme (min/km)',data:sorted.map(s=>isFinite(s.ritme)&&s.ritme>0?s.ritme:null),
        borderColor:C.blue,backgroundColor:C.blueSoft,borderWidth:2,pointRadius:5,pointHoverRadius:7,tension:0.2,spanGaps:false,
      }]},options:{...baseOpts,
        plugins:{...baseOpts.plugins,tooltip:{callbacks:{label:c=>c.parsed.y?` Ritme: ${formatPace(c.parsed.y,'')}`:'  --'}}},
        scales:{x:baseOpts.scales.x,y:{...yBase,reverse:true,ticks:{...yBase.ticks,callback:v=>formatPace(v,'')}}}
      }};
    }
    default:
      return {type:'bar',data:{labels,datasets:[
        {type:'bar',label:'Km',data:byWeek.map(w=>w.km),backgroundColor:C.blueSoft,borderColor:C.blue,borderWidth:1,borderRadius:6,yAxisID:'y'},
        {type:'line',label:'C\u00e0rrega (TSS)',data:byWeek.map(w=>w.load),borderColor:C.green,backgroundColor:'transparent',borderWidth:2,pointRadius:3,tension:0.3,yAxisID:'y2',spanGaps:true},
      ]},options:{...baseOpts,
        plugins:{...baseOpts.plugins,tooltip:{callbacks:{label:c=>c.dataset.yAxisID==='y2'?` C\u00e0rrega: ${c.parsed.y} TSS`:`  Km: ${c.parsed.y} km`}}},
        scales:{x:baseOpts.scales.x,
          y:{...yBase,position:'left',ticks:{...yBase.ticks,callback:v=>`${v} km`}},
          y2:{...yBase,position:'right',grid:{drawOnChartArea:false},ticks:{...yBase.ticks,callback:v=>`${v} TSS`}},
        }
      }};
  }
}

// ── Taula ────────────────────────────────────────────────────────────────────
function renderSessTable(sessions) {
  const thead = document.getElementById('sess-thead');
  const tbody = document.getElementById('sess-tbody');
  const title = document.getElementById('sess-table-title');
  const badge = document.getElementById('sess-count-badge');
  if (!thead||!tbody) return;
  if (title) title.textContent = SESS_TYPE_LABELS[_sessType]||'Sessions';
  if (badge) badge.textContent = `${sessions.length} sessions`;
  const cols = getSessCols(_sessType);
  thead.innerHTML = `<tr>${cols.map(c=>`<th>${c.label}</th>`).join('')}</tr>`;
  if (!sessions.length) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty-row">Cap sessi\u00f3 amb els filtres seleccionats.</td></tr>`;
    return;
  }
  tbody.innerHTML = sessions.map(s=>`<tr>${cols.map(c=>`<td>${c.render(s)}</td>`).join('')}</tr>`).join('');
}

function getSessCols(type) {
  const colData      = {label:'Data',             render:s=>escS(s.displayDate)};
  const colTipus     = {label:'Tipus',             render:s=>escS(s.tipus)};
  const colKm        = {label:'Km',                render:s=>s.distancia>0?`${fmtS(s.distancia)} km`:'\u2014'};
  const colDurada    = {label:'Durada',            render:s=>s.durada>0?`${fmtS(s.durada)} min`:'\u2014'};
  const colRitme     = {label:'Ritme',             render:s=>formatPace(s.ritme)};
  const colFC        = {label:'FC',                render:s=>isFinite(s.fcMitja)&&s.fcMitja>0?`${Math.round(s.fcMitja)} ppm`:'\u2014'};
  const colCarrega   = {label:'C\u00e0rrega TSS',  render:s=>isFinite(s.carrega)&&s.carrega>0?`${fmtS(s.carrega)} TSS`:'\u2014'};
  const colZ2min     = {label:'Z2 (min)',          render:s=>s.z2min>0?`${fmtS(s.z2min)} min`:'\u2014'};
  const colCad       = {label:'Cad\u00e8ncia',     render:s=>{const c=toNumber(s.raw['Cadencia(spm)']);return isFinite(c)&&c>0?`${Math.round(c)} spm`:'\u2014';}};
  const colDesnivell = {label:'Desnivell',         render:s=>{const d=toNumber(s.raw['Desnivell(m)']);return isFinite(d)&&d>0?`${Math.round(d)} m`:'\u2014';}};
  const colEpoc      = {label:'EPOC',              render:s=>{const e=toNumber(s.raw['EPOC']);return isFinite(e)&&e>0?fmtS(e):'\u2014';}};
  const colRecup     = {label:'Recup.',            render:s=>{const r=toNumber(s.raw['Recup(h)']);return isFinite(r)&&r>0?`${fmtS(r)} h`:'\u2014';}};
  const colRitmeSeries={label:'Ritme s\u00e8ries',  render:s=>formatPace(isFinite(s.ritmeMitjaSeries)?s.ritmeMitjaSeries:null)};
  const colFCSeries  = {label:'FC s\u00e8ries',     render:s=>isFinite(s.fcMitjaSeries)&&s.fcMitjaSeries>0?`${Math.round(s.fcMitjaSeries)} ppm`:'\u2014'};
  const colSeries    = {label:'S\u00e8ries',         render:s=>{const n=toNumber(s.raw['Num_Series']);return isFinite(n)&&n>0?String(Math.round(n)):'\u2014';}};
  const colPTE       = {label:'PTE',               render:s=>{const p=toNumber(s.raw['PTE']);return isFinite(p)&&p>0?fmtS(p):'\u2014';}};
  switch (type) {
    case 'z2':       return [colData,colKm,colDurada,colRitme,colCad,colFC,colZ2min,colEpoc,colCarrega];
    case 'quality':  return [colData,colTipus,colKm,colDurada,colSeries,colRitmeSeries,colFCSeries,colPTE,colCarrega];
    case 'long':     return [colData,colTipus,colKm,colDurada,colRitme,colZ2min,colDesnivell,colFC,colCarrega];
    case 'testrace': return [colData,colTipus,colKm,colDurada,colRitme,colFC,colDesnivell,colEpoc,colCarrega];
    case 'strength': return [colData,colTipus,colDurada,colEpoc,colRecup,colCarrega];
    case 'other':    return [colData,colTipus,colDurada,colFC,colEpoc,colCarrega];
    default:         return [colData,colTipus,colKm,colDurada,colFC,colEpoc,colCarrega];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtS(value) {
  const n = parseFloat(value);
  if (!isFinite(n)) return '--';
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(n);
}
function setSessText(id, value) {
  const el = document.getElementById(id); if (el) el.textContent = value;
}
function escS(v) {
  return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
