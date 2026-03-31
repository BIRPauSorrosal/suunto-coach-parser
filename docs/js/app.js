// docs/js/app.js
// Orquestrador: càrrega de CSVs, estat global, router, helpers compartits.
// Dep: lib/formatters.js, lib/metrics.js (carregats abans via index.html)

const DATA_SOURCES = {
  sessions: ['../data/output/sessions.csv'],
  planning: ['../data/output/planning.csv']
};

// ── Constants de classificació de sessions ────────────────────────────────────
// Font única de veritat per a totes les vistes. No duplicar en cap vista.
const QUALITY_TYPES   = new Set(['TEMPO', 'INTERVALS']);
const LONG_TYPES      = new Set(['LLARGA', 'MARATÓ', 'TRAIL', 'MITJA', 'MARATO']);
const RUNNING_TYPES   = new Set([...QUALITY_TYPES, ...LONG_TYPES, 'Z2']);
const TEST_RACE_TYPES = new Set(['TEST', 'CURSA']);
const PADEL_TYPES     = new Set(['PADEL', 'TENIS', 'TENNIS']);
const STRENGTH_RE     = /^FOR[\u00c7C]A/i;

function isRunning(s)  { return RUNNING_TYPES.has(s.tipusKey); }
function isStrength(s) { return STRENGTH_RE.test(s.tipusKey); }
function isTestRace(s) { return TEST_RACE_TYPES.has(s.tipusKey); }
function isOther(s)    { return !isRunning(s) && !isStrength(s) && !isTestRace(s); }

const state = {
  sessions: [],
  planning: [],
  sources:  {}
};

// ── Router de vistes ──────────────────────────────────────────────────────────
function initRouter() {
  const navLinks = document.querySelectorAll('.nav-link[data-target]');
  const views    = document.querySelectorAll('.view[data-view]');

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.dataset.target;

      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const noticeBar = document.getElementById('notice-bar');
      if (noticeBar) noticeBar.style.display = target === 'overview' ? '' : 'none';

      views.forEach(v => v.classList.remove('view--active'));
      const activeView = document.querySelector(`.view[data-view="${target}"]`);
      if (activeView) activeView.classList.add('view--active');

      if (!window._chartData) return;
      const { sessions, planning } = window._chartData;

      if (target === 'overview')  renderOverviewView(sessions, planning);
      if (target === 'setmanal')  renderSetmanalView(sessions, planning);
      if (target === 'planning')  renderPlanningView(planning, sessions);
      if (target === 'sessions')  renderSessionsView(sessions);
    });
  });
}

// ── Punt d'entrada ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  document.getElementById('reload-data-btn').addEventListener('click', loadDashboardData);
  loadDashboardData();
});

// ── Càrrega de dades ──────────────────────────────────────────────────────────
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

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchFirstAvailable(paths) {
  let lastError = null;
  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status} a ${path}`);
      const text = await response.text();
      if (!text.trim()) throw new Error(`Fitxer buit a ${path}`);
      return { path, text };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Cap ruta vàlida per al CSV');
}

// ── Parser CSV ────────────────────────────────────────────────────────────────
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

// ── Orquestració del render ───────────────────────────────────────────────────
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

  renderOverviewView(sessions, planning);
  renderSetmanalView(sessions, planning);
  renderPlanningView(planning, sessions);
  renderSessionsView(sessions);
}

// ── Enriquiment de files ──────────────────────────────────────────────────────
function enrichPlanningRow(row) {
  const startDate = parseDate(row['Data_Inici']);
  const endDate   = parseDate(row['Data_Fi']);
  if (!startDate || !endDate) return null;

  return {
    raw:          row,
    setmana:      row['Setmana']   || '--',
    cicle:        row['Cicle']     || '--',
    fase:         row['Fase']      || '--',
    startDate,
    endDate,
    qKm:          toNumber(row['Q_Km_Plan']),
    z2Durada:     toNumber(row['Z2_Durada_min']),
    llKm:         toNumber(row['LL_Km_Plan']),
    kmTotal:      firstFinite([
      toNumber(row['Km_Total_Plan']),
      sumNumbers([toNumber(row['Q_Km_Plan']), toNumber(row['Z2_Km_Plan']), toNumber(row['LL_Km_Plan'])])
    ]),
    llTipus:      row['LL_Tipus']             || '--',
    qSeries:      row['Q_Series']             || '--',
    qDuradaSerie: row['Q_Durada_Serie_min']   || '--',
    qRitme:       row['Q_Ritme_min_km']       || '--',
    z2PaceMin:    row['Z2_Ritme_min_km_min']  || '--',
    z2PaceMax:    row['Z2_Ritme_min_km_max']  || '--',
    forcaPlan:    row['Forca_Plan']           || '--',
    padelPlan:    row['Padel_Plan']           || '--'
  };
}

function enrichSessionRow(row) {
  const date = parseDate(row['Data']);
  if (!date) return null;
  const tipus = String(row['Tipus'] || '').trim().toUpperCase();
  return {
    raw:              row,
    date,
    displayDate:      formatDate(date),
    tipus:            row['Tipus'] || '--',
    tipusKey:         tipus,
    durada:           toNumber(row['Durada(min)']),
    distancia:        toNumber(row['Dist(km)']),
    desnivell:        toNumber(row['Desnivell(m)']),
    carrega:          toNumber(row['Carrega']),
    z1min:            toNumber(row['Z1(min)']),
    z2min:            toNumber(row['Z2(min)']),
    fcMitja:          toNumber(row['FCMitja']),
    ritme:            toNumber(row['Ritme(min/km)']),
    ritmeMitjaSeries: toNumber(row['Ritme_Mitja_Series']),
    fcMitjaSeries:    toNumber(row['FC_Mitja_Series']),
    epoc:             toNumber(row['EPOC']),
    recuperacio:      toNumber(row['Recup(h)'])
  };
}

// ── Detecció setmana activa ───────────────────────────────────────────────────
function detectActiveWeek(planning, sessions) {
  // PRIORITAT 1: setmana del calendari que conté AVUI.
  // Assumim que les sessions acaben a les 20:00h, per tant fins les 20:00h
  // del primer dia de la nova setmana encara estem "dins" la setmana anterior.
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);

  const todayWeek = planning.find(w => today >= w.startDate && today <= w.endDate);
  if (todayWeek) return todayWeek;

  // PRIORITAT 2: setmana de la última sessió registrada
  const latest = sessions[0];
  if (latest) {
    const match = planning.find(w =>
      latest.date >= w.startDate && latest.date <= w.endDate
    );
    if (match) return match;
  }

  // FALLBACK: última setmana del planning
  return planning[planning.length - 1];
}

// ── Status sidebar ────────────────────────────────────────────────────────────
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

// ── Helpers UI ────────────────────────────────────────────────────────────────
function setNotice(message, type = 'info') {
  const bar = document.getElementById('notice-bar');
  bar.classList.remove('is-error', 'is-warning');
  if (type === 'error')   bar.classList.add('is-error');
  if (type === 'warning') bar.classList.add('is-warning');
  setText('notice-text', message);
  const activeView = document.querySelector('.view--active')?.dataset.view;
  bar.style.display = activeView === 'overview' || activeView == null ? '' : 'none';
}

// ── Helpers de dades ──────────────────────────────────────────────────────────
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
// PER AIXÒ:
window.addEventListener('fc-config-changed', () => {
  if (!window._chartData) return;          // ✅
  const { sessions, planning } = window._chartData;
  renderOverviewView(sessions, planning);
  renderSetmanalView(sessions, planning);
});