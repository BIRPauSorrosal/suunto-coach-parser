// docs/js/app.js
// Orquestrador: càrrega de CSVs, estat global, router, helpers compartits.
// Dep: lib/formatters.js, lib/metrics.js (carregats abans via index.html)

const DATA_SOURCES = {
  sessions: ['./data/sessions.csv'],
  planning: ['./data/planning.csv']
};

// ── Constants de classificació de sessions ────────────────────────────────────
function isRunning(s)  { return RUNNING_TYPES.has(s.tipusKey); }
function isStrength(s) { return STRENGTH_RE.test(s.tipusKey); }
function isTestRace(s) { return TEST_RACE_TYPES.has(s.tipusKey); }
function isOther(s)    { return !isRunning(s) && !isStrength(s) && !isTestRace(s); }

const state = {
  sessions: [],
  planning: [],
  sources:  {}
};

// ── Router de vistes ─────────────────────────────────────────────────────────
// navigateTo: única funció que gestiona el canvi de vista.
// És cridada tant pels .nav-link (sidebar) com pels .bnav-item (bottom nav).
function navigateTo(target) {
  const views    = document.querySelectorAll('.view[data-view]');
  const navLinks = document.querySelectorAll('.nav-link[data-target]');
  const bnavItems = document.querySelectorAll('.bnav-item[data-target]');

  // — Actualitza classe active a sidebar i bottom-nav —
  navLinks.forEach(l  => l.classList.toggle('active',  l.dataset.target === target));
  bnavItems.forEach(l => l.classList.toggle('active',  l.dataset.target === target));

  // — Mostra/amaga vistes —
  views.forEach(v => v.classList.remove('view--active'));
  const activeView = document.querySelector(`.view[data-view="${target}"]`);
  if (activeView) activeView.classList.add('view--active');

  // — Notice bar: només visible a l'overview —
  const noticeBar = document.getElementById('notice-bar');
  if (noticeBar) noticeBar.style.display = target === 'overview' ? '' : 'none';

  // — Render de la vista corresponent —
  if (!window._chartData) return;
  const { sessions, planning } = window._chartData;
  if (target === 'overview')  renderOverviewView(sessions, planning);
  if (target === 'setmanal')  renderSetmanalView(sessions, planning);
  if (target === 'planning')  renderPlanningView(planning, sessions);
  if (target === 'sessions')  renderSessionsView(sessions);
}

function initRouter() {
  // — Sidebar nav —
  document.querySelectorAll('.nav-link[data-target]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.target);
    });
  });

  // — Bottom nav —
  document.querySelectorAll('.bnav-item[data-target]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.target);
    });
  });

  // — Drawer "Més" —
  const moreBtn  = document.getElementById('bnav-more-btn');
  const overlay  = document.getElementById('bnav-overlay');
  if (moreBtn) moreBtn.addEventListener('click', toggleBnavDrawer);
  if (overlay) overlay.addEventListener('click', closeBnavDrawer);
}

// ── Drawer helpers ─────────────────────────────────────────────────────
function toggleBnavDrawer() {
  const drawer  = document.getElementById('bnav-drawer');
  const overlay = document.getElementById('bnav-overlay');
  const btn     = document.getElementById('bnav-more-btn');
  const isOpen  = drawer && drawer.classList.contains('drawer-open');
  isOpen ? closeBnavDrawer() : openBnavDrawer();
}

function openBnavDrawer() {
  document.getElementById('bnav-drawer')?.classList.add('drawer-open');
  document.getElementById('bnav-overlay')?.classList.add('drawer-open');
  document.getElementById('bnav-more-btn')?.classList.add('drawer-open');
}

function closeBnavDrawer() {
  document.getElementById('bnav-drawer')?.classList.remove('drawer-open');
  document.getElementById('bnav-overlay')?.classList.remove('drawer-open');
  document.getElementById('bnav-more-btn')?.classList.remove('drawer-open');
}

// Exposar closeBnavDrawer globalment (cridada des del HTML del drawer)
window.closeBnavDrawer = closeBnavDrawer;

// ── Punt d'entrada ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  document.getElementById('reload-data-btn').addEventListener('click', loadDashboardData);
  loadDashboardData();
});

// ── Càrrega de dades ──────────────────────────────────────────────────
async function loadDashboardData() {
  setNotice('Llegint fitxers CSV...', 'info');
  setBadge('Carregant dades...');

  try {
    const [sessionsResult, planningResult] = await Promise.all([
      fetchFirstAvailable(DATA_SOURCES.sessions),
      fetchFirstAvailable(DATA_SOURCES.planning)
    ]);

    state.sessions = parseCSV(sessionsResult.text);
    state.planning = parseCSV(planningResult.text);
    state.sources  = {
      sessions: sessionsResult.path,
      planning: planningResult.path
    };

    renderDashboard();
    updateStatus();
    setBadge('Dades carregades');
    setNotice(
      `Dades carregades correctament. Sessions: ${state.sessions.length} · Planning: ${state.planning.length}`,
      'info'
    );
  } catch (error) {
    console.error(error);
    setBadge('Error de càrrega');
    setNotice(
      "No s'han pogut llegir els CSVs. Comprova que els fitxers existeixen.",
      'error'
    );
    updateStatus(error.message);
  }
}

// ── 🔧 FIX UTF-8: decodifica Base64 de l'API GitHub respectant UTF-8 ─────────────────
// atob() retorna Latin-1 i trenca accents (à, è, ç, etc.).
// Aquesta funció converteix correctament Base64 → UTF-8.
function base64ToUtf8(base64) {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

// ── Fetch ────────────────────────────────────────────────────────────────
async function fetchFirstAvailable(paths) {
  const token = window.getGitHubToken ? window.getGitHubToken() : '';

  if (token) {
    for (const path of paths) {
      try {
        const repoPath = path.replace(/^\.\//,  'docs/');
        const apiUrl   = `https://api.github.com/repos/BIRPauSorrosal/suunto-coach-parser/contents/${repoPath}?ref=main`;

        const res = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept':        'application/vnd.github+json',
          }
        });
        if (!res.ok) throw new Error(`API GitHub: ${res.status}`);

        const json = await res.json();
        const text = base64ToUtf8(json.content);
        if (!text.trim()) throw new Error(`Fitxer buit: ${repoPath}`);
        return { path, text };
      } catch (error) {
        console.warn('[fetchFirstAvailable] API fallback a Pages:', error.message);
      }
    }
  }

  let lastError = null;
  for (const path of paths) {
    try {
      const response = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status} a ${path}`);
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buffer);
      if (!text.trim()) throw new Error(`Fitxer buit a ${path}`);
      return { path, text };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Cap ruta vàlida per al CSV');
}

// ── Parser CSV ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], value = '', insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') { value += '"'; i++; }
      else insideQuotes = !insideQuotes;
      continue;
    }
    if (char === ',' && !insideQuotes) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(value); rows.push(row);
      row = []; value = '';
      continue;
    }
    value += char;
  }
  if (value.length > 0 || row.length > 0) { row.push(value); rows.push(row); }

  const cleanRows = rows.filter(cols => cols.some(cell => String(cell).trim() !== ''));
  if (!cleanRows.length) return [];

  const headers = cleanRows[0].map(h => String(h || '').replace(/^\uFEFF/, '').trim());
  return cleanRows.slice(1).map(cols => {
    const entry = {};
    headers.forEach((h, i) => { entry[h] = (cols[i] || '').trim(); });
    return entry;
  });
}

// ── Orquestració del render ─────────────────────────────────────────────────
function renderDashboard() {
  const planning = state.planning
    .map(enrichPlanningRow)
    .filter(Boolean)
    .sort((a, b) => a.startDate - b.startDate);

  const sessions = state.sessions
    .map(enrichSessionRow)
    .filter(Boolean)
    .sort((a, b) => b.date - a.date);

  window._chartData = { sessions, planning };

  // Exposar les files RAW del planning perquè planning-uploader.js
  // pugui fer el merge sense dependre de les dades enriquides.
  window.planningData = state.planning;

  renderOverviewView(sessions, planning);
  renderSetmanalView(sessions, planning);
  renderPlanningView(planning, sessions);
  renderSessionsView(sessions);
}

// ── Enriquiment de files ──────────────────────────────────────────────────
function enrichPlanningRow(row) {
  const startDate = parseDate(row['Data_Inici']);
  const endDate   = parseDate(row['Data_Fi']);
  if (!startDate || !endDate) return null;

  // ── Qualitat ─────────────────────────────────────────────────────────────
  const qSeries      = toNumber(row['Q_Series']);           // número de sèries
  const qDuradaSerie = toNumber(row['Q_Durada_Serie_min']); // minuts per sèrie
  const qRec         = toNumber(row['Q_Rec_min']);          // minuts recuperació entre sèries
  const qRitme       = toNumber(row['Q_Ritme_min_km']);     // ritme objectiu (min/km)
  const qFcMin       = toNumber(row['Q_FC_min']);
  const qFcMax       = toNumber(row['Q_FC_max']);
  const qKm          = toNumber(row['Q_Km_Plan']);

  // ── Z2 ───────────────────────────────────────────────────────────────────
  const z2Durada     = toNumber(row['Z2_Durada_min']);
  const z2RitmeMin   = toNumber(row['Z2_Ritme_min_km_min']);
  const z2RitmeMax   = toNumber(row['Z2_Ritme_min_km_max']);
  const z2FcMin      = toNumber(row['Z2_FC_min']);
  const z2FcMax      = toNumber(row['Z2_FC_max']);
  const z2Km         = toNumber(row['Z2_Km_Plan']);

  // ── Tirada llarga ────────────────────────────────────────────────────────
  const llTipus      = row['LL_Tipus']    || '--';
  const llDurada     = toNumber(row['LL_Durada_min']);
  const llKm         = toNumber(row['LL_Km_Plan']);

  // ── Km totals: primer intenta el camp explícit, si no suma parcials ─
  const kmTotal = firstFinite([
    toNumber(row['Km_Total_Plan']),
    sumNumbers([qKm, z2Km, llKm])
  ]);

  return {
    raw:          row,

    // Metadades
    setmana:      row['Setmana'] || '--',
    cicle:        row['Cicle']   || '--',
    fase:         row['Fase']    || '--',
    startDate,
    endDate,

    // Qualitat
    qSeries,
    qDuradaSerie,
    qRec,
    qRitme,
    qFcMin,
    qFcMax,
    qKm,

    // Z2
    z2Durada,
    z2RitmeMin,
    z2RitmeMax,
    z2FcMin,
    z2FcMax,
    z2Km,

    // Tirada llarga
    llTipus,
    llDurada,
    llKm,

    // Totals
    kmTotal,

    // Altres
    forcaPlan:    row['Forca_Plan'] || '--',
    padelPlan:    row['Padel_Plan'] || '--'
  };
}

function enrichSessionRow(row) {
  const date = parseDate(row['Data']);
  if (!date) return null;
  const tipus = String(row['Tipus'] || '').trim().toUpperCase();
  return {
    raw:                 row,
    date,
    displayDate:         formatDate(date),
    tipus:               row['Tipus'] || '--',
    tipusKey:            tipus,
    durada:              toNumber(row['Durada(min)']),
    distancia:           toNumber(row['Dist(km)']),
    desnivell:           toNumber(row['Desnivell(m)']),
    carrega:             toNumber(row['Carrega']),
    z1min:               toNumber(row['Z1(min)']),
    z2min:               toNumber(row['Z2(min)']),
    fcMitja:             toNumber(row['FCMitja']),
    ritme:               toNumber(row['Ritme(min/km)']),
    // ── Camps de qualitat (sèries) ──────────────────────────────────
    numSeries:           toNumber(row['Num_Series']),
    duradaMitjaSeries:   toNumber(row['Durada_Mitja_Series']),
    recMitjaMin:         toNumber(row['Rec_Mitja_Min']),
    ritmeMitjaSeries:    toNumber(row['Ritme_Mitja_Series']),
    consistenciaRitme:   toNumber(row['Consistencia_Ritme']),
    fcMitjaSeries:       toNumber(row['FC_Mitja_Series']),
    fcMaxMitjaSeries:    toNumber(row['FC_Max_Mitja_Series']),
    cadenciaMitjaSeries: toNumber(row['Cadencia_Mitja_Series']),
    // ── Altres ────────────────────────────────────────────────────────
    epoc:                toNumber(row['EPOC']),
    recuperacio:         toNumber(row['Recup(h)'])
  };
}

// ── Detecció setmana activa ───────────────────────────────────────────────
function detectActiveWeek(planning, sessions) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);

  const todayWeek = planning.find(w => today >= w.startDate && today <= w.endDate);
  if (todayWeek) return todayWeek;

  const latest = sessions[0];
  if (latest) {
    const match = planning.find(w =>
      latest.date >= w.startDate && latest.date <= w.endDate
    );
    if (match) return match;
  }

  return planning[planning.length - 1];
}

// ── Status sidebar ──────────────────────────────────────────────────────
function updateStatus(errorMessage = null) {
  setText('status-sessions', state.sessions.length
    ? `sessions.csv carregat (${state.sessions.length} files)`
    : 'sessions.csv no disponible');
  setText('status-planning', state.planning.length
    ? `planning.csv carregat (${state.planning.length} files)`
    : 'planning.csv no disponible');
  setText('status-source', errorMessage
    ? `Error: ${errorMessage}`
    : `sessions: ${state.sources.sessions || '--'} · planning: ${state.sources.planning || '--'}`);
  setText('status-last-update', `Actualitzat: ${new Date().toLocaleString('ca-ES')}`);
}

// ── Helpers UI ────────────────────────────────────────────────────────
function setNotice(message, type = 'info') {
  const bar = document.getElementById('notice-bar');
  bar.classList.remove('is-error', 'is-warning');
  if (type === 'error')   bar.classList.add('is-error');
  if (type === 'warning') bar.classList.add('is-warning');
  setText('notice-text', message);
  const activeView = document.querySelector('.view--active')?.dataset.view;
  bar.style.display = activeView === 'overview' || activeView == null ? '' : 'none';
}

// ── Helpers de dades ───────────────────────────────────────────────────
function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  const p = new Date(s);
  return isNaN(p.getTime()) ? null : p;
}

function sumNumbers(values) {
  return values.filter(v => isFinite(v)).reduce((acc, v) => acc + v, 0);
}

function firstFinite(values) {
  return values.find(v => isFinite(v)) ?? null;
}

function setBadge(text)     { setText('load-badge', text); }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

// Re-renderitza tot quan l'usuari canvia la configuració de FC
window.addEventListener('fc-config-changed', () => {
  if (!window._chartData) return;
  const { sessions, planning } = window._chartData;
  renderOverviewView(sessions, planning);
  renderSetmanalView(sessions, planning);
});
