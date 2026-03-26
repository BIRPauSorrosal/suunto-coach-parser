// docs/js/views/sessions.js
// Panell Sessions: filtres tipus + període, KPIs dinàmics, taula intel·ligent
// Dep: app.js (formatPace, toNumber, esc)

let _sessSessions = [];
let _sessType     = 'all';
let _sessPeriod   = 180; // dies (0 = sempre, -1 = setmana actual dilluns-diumenge)

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
  renderSessKPIs(filtered);
  renderSessTable(filtered);
}

// ── Filtratge ───────────────────────────────────────────────────────────────
function applyFilters(sessions) {
  let result = sessions;

  if (_sessPeriod === -1) {
    // Setmana actual: dilluns 00:00 → diumenge 23:59
    const today  = new Date();
    const dow    = today.getDay();          // 0=dg, 1=dl, ..., 6=ds
    const toMon  = (dow === 0 ? -6 : 1 - dow); // dies fins al dilluns
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
  // _sessPeriod === 0 → sense filtre de data

  if (_sessType !== 'all') {
    const fn = SESS_GROUPS[_sessType];
    if (fn) result = result.filter(fn);
  }
  return result;
}

// ── KPIs dinàmics (dalt: km + temps | baix: TSS + EPOC) ──────────────────────
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

  // Dalt: km i temps
  setSessText('kpi-km',   totalKm  > 0 ? `${fmtS(totalKm)} km`    : '--');
  setSessText('kpi-time', timeTxt);
  // Baix: TSS (amb unitat) i EPOC
  setSessText('kpi-load', totalLoad > 0 ? `${fmtS(totalLoad)} TSS` : '--');
  setSessText('kpi-epoc', totalEpoc > 0 ? fmtS(totalEpoc)           : '--');
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
  const colData    = { label: 'Data',           render: s => escS(s.displayDate) };
  const colTipus   = { label: 'Tipus',           render: s => escS(s.tipus) };
  const colKm      = { label: 'Km',              render: s => s.distancia > 0 ? `${fmtS(s.distancia)} km` : '\u2014' };
  const colDurada  = { label: 'Durada',          render: s => s.durada > 0 ? `${fmtS(s.durada)} min` : '\u2014' };
  const colRitme   = { label: 'Ritme',           render: s => formatPace(s.ritme) };
  const colFC      = { label: 'FC',              render: s => isFinite(s.fcMitja) && s.fcMitja > 0 ? `${Math.round(s.fcMitja)} ppm` : '\u2014' };
  const colCarrega = { label: 'C\u00e0rrega TSS', render: s => isFinite(s.carrega) && s.carrega > 0 ? `${fmtS(s.carrega)} TSS` : '\u2014' };
  const colZ2min   = { label: 'Z2 (min)',        render: s => s.z2min > 0 ? `${fmtS(s.z2min)} min` : '\u2014' };
  const colCad     = { label: 'Cad\u00e8ncia',   render: s => {
    const c = toNumber(s.raw['Cadencia(spm)']);
    return isFinite(c) && c > 0 ? `${Math.round(c)} spm` : '\u2014';
  }};
  const colDesnivell = { label: 'Desnivell',     render: s => {
    const d = toNumber(s.raw['Desnivell(m)']);
    return isFinite(d) && d > 0 ? `${Math.round(d)} m` : '\u2014';
  }};
  const colEpoc    = { label: 'EPOC',            render: s => {
    const e = toNumber(s.raw['EPOC']);
    return isFinite(e) && e > 0 ? fmtS(e) : '\u2014';
  }};
  const colRecup   = { label: 'Recup.',          render: s => {
    const r = toNumber(s.raw['Recup(h)']);
    return isFinite(r) && r > 0 ? `${fmtS(r)} h` : '\u2014';
  }};
  const colRitmeSeries = { label: 'Ritme s\u00e8ries', render: s =>
    formatPace(isFinite(s.ritmeMitjaSeries) ? s.ritmeMitjaSeries : null)
  };
  const colFCSeries = { label: 'FC s\u00e8ries',   render: s =>
    isFinite(s.fcMitjaSeries) && s.fcMitjaSeries > 0 ? `${Math.round(s.fcMitjaSeries)} ppm` : '\u2014'
  };
  const colSeries  = { label: 'S\u00e8ries',       render: s => {
    const n = toNumber(s.raw['Num_Series']);
    return isFinite(n) && n > 0 ? String(Math.round(n)) : '\u2014';
  }};
  const colPTE     = { label: 'PTE',             render: s => {
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
