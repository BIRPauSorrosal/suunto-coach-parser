const DATA_SOURCES = {
  sessions: [
    '../data/output/sessions.csv'
  ],
  planning: [
    '../data/output/planning.csv'
  ]
};


const QUALITY_TYPES = new Set(['TEMPO', 'TEST', 'INTERVALS']);
const LONG_TYPES    = new Set(['LLARGA', 'MARATÓ', 'TRAIL', 'MITJA', 'MARATO']);
const EXTRA_TYPES   = new Set(['PADEL', 'TENIS', 'TENNIS']);

const state = {
  sessions: [],
  planning: [],
  sources: {}
};

// ── Punt d'entrada ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reload-data-btn').addEventListener('click', loadDashboardData);
  loadDashboardData();
});

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
      "No s'han pogut llegir els CSVs. Comprova que data/sessions.csv i data/planning.csv existeixen al repositori.",
      'error'
    );
    renderErrorTables(error.message);
    updateStatus(error.message);
  }
}

// ── Fetch ────────────────────────────────────────────────────────────────────
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

// ── Parser CSV robust (suporta cometes, comes i salts de línia) ──────────────
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

  const activeWeek = detectActiveWeek(planning, sessions);
  const weeklySessions = activeWeek
    ? sessions.filter(s => s.date >= activeWeek.startDate && s.date <= activeWeek.endDate)
    : [];

  renderOverview(activeWeek, weeklySessions);
  renderSummary(activeWeek, weeklySessions);
  renderSessionsTable(sessions);
  renderPlanningTable(planning);
}

// ── Enriquiment de files ───────────────────────────────────────────────────
function enrichPlanningRow(row) {
  const startDate = parseDate(row['Data_Inici']);
  const endDate   = parseDate(row['Data_Fi']);
  if (!startDate || !endDate) return null;

  return {
    raw: row,
    setmana:    row['Setmana']   || '--',
    cicle:      row['Cicle']     || '--',
    fase:       row['Fase']      || '--',
    startDate,
    endDate,
    qKm:        toNumber(row['Q_Km_Plan']),
    z2Durada:   toNumber(row['Z2_Durada_min']),
    llKm:       toNumber(row['LL_Km_Plan']),
    kmTotal:    firstFinite([
      toNumber(row['Km_Total_Plan']),
      sumNumbers([toNumber(row['Q_Km_Plan']), toNumber(row['Z2_Km_Plan']), toNumber(row['LL_Km_Plan'])])
    ]),
    llTipus:    row['LL_Tipus']            || '--',
    qSeries:    row['Q_Series']            || '--',
    z2PaceMin:  row['Z2_Ritme_min_km_min'] || '--',
    z2PaceMax:  row['Z2_Ritme_min_km_max'] || '--',
    forcaPlan:  row['Forca_Plan']          || '--',
    padelPlan:  row['Padel_Plan']          || '--'
  };
}

function enrichSessionRow(row) {
  const date = parseDate(row['Data']);
  if (!date) return null;
  const tipus = String(row['Tipus'] || '').trim().toUpperCase();
  return {
    raw: row,
    date,
    displayDate: formatDate(date),
    tipus:       row['Tipus'] || '--',
    tipusKey:    tipus,
    durada:      toNumber(row['Durada(min)']),
    distancia:   toNumber(row['Dist(km)']),
    carrega:     toNumber(row['Carrega'])
  };
}

// ── Detecció setmana activa ───────────────────────────────────────────────
function detectActiveWeek(planning, sessions) {
  if (!planning.length) return null;

  // 1. Setmana que conté la sessió més recent
  const latest = sessions[0];
  if (latest) {
    const match = planning.find(w => latest.date >= w.startDate && latest.date <= w.endDate);
    if (match) return match;
  }

  // 2. Setmana actual
  const today = new Date();
  const todayWeek = planning.find(w => today >= w.startDate && today <= w.endDate);
  if (todayWeek) return todayWeek;

  // 3. Última setmana del planning
  return planning[planning.length - 1];
}

// ── Renders ───────────────────────────────────────────────────────────────
function renderOverview(activeWeek, weeklySessions) {
  const plannedKm  = activeWeek?.kmTotal ?? null;
  const realLoad   = sumNumbers(weeklySessions.map(s => s.carrega));
  const realKm     = sumNumbers(weeklySessions.map(s => s.distancia));
  const compliance = (plannedKm && plannedKm > 0) ? (realKm / plannedKm) * 100 : null;

  setText('active-week-label', activeWeek ? `${activeWeek.setmana} · ${activeWeek.cicle}` : '--');
  setText('active-week-range', activeWeek
    ? `${formatDate(activeWeek.startDate)} → ${formatDate(activeWeek.endDate)} · ${activeWeek.fase}`
    : "No s'ha pogut detectar cap setmana activa.");
  setText('planned-km-value',  formatMetric(plannedKm, 'km'));
  setText('real-load-value',   formatMetric(realLoad, ''));
  setText('compliance-value',  compliance == null ? '-- %' : `${Math.round(compliance)} %`);
}

function renderSummary(activeWeek, weeklySessions) {
  const quality = weeklySessions.filter(s => QUALITY_TYPES.has(s.tipusKey));
  const z2      = weeklySessions.filter(s => s.tipusKey === 'Z2');
  const llong   = weeklySessions.filter(s => LONG_TYPES.has(s.tipusKey));
  const extra   = weeklySessions.filter(s =>
    s.tipusKey.startsWith('FORÇA') || s.tipusKey.startsWith('FORCA') || EXTRA_TYPES.has(s.tipusKey)
  );

  const qualityKm  = sumNumbers(quality.map(s => s.distancia));
  const z2Minutes  = sumNumbers(z2.map(s => s.durada));
  const longKm     = sumNumbers(llong.map(s => s.distancia));

  setText('quality-summary', `${quality.length} sessions`);
  setText('quality-detail', activeWeek
    ? `Pla: ${activeWeek.qSeries} sèries · Km reals: ${formatNumber(qualityKm)}`
    : 'Sense planning setmanal disponible');

  setText('z2-summary', `${formatNumber(z2Minutes)} min`);
  setText('z2-detail', activeWeek
    ? `Ritme objectiu: ${activeWeek.z2PaceMin}–${activeWeek.z2PaceMax} min/km`
    : 'Sense rang de ritme planificat');

  setText('long-summary', `${formatNumber(longKm)} km`);
  setText('long-detail', activeWeek
    ? `Pla: ${activeWeek.llTipus} · ${formatNumber(activeWeek.llKm)} km`
    : 'Sense tirada llarga planificada');

  setText('extra-summary', `${extra.length} sessions`);
  setText('extra-detail', activeWeek
    ? `Força: ${activeWeek.forcaPlan} · Pàdel: ${activeWeek.padelPlan}`
    : 'Sense treball complementari planificat');
}

function renderSessionsTable(sessions) {
  const rows = sessions.slice(0, 12);
  setText('sessions-count-badge', `${sessions.length} files`);

  document.getElementById('sessions-table-body').innerHTML = rows.length
    ? rows.map(s => `
        <tr>
          <td>${esc(s.displayDate)}</td>
          <td>${esc(s.tipus)}</td>
          <td>${formatMetric(s.durada, 'min')}</td>
          <td>${formatMetric(s.distancia, 'km')}</td>
          <td>${formatMetric(s.carrega, '')}</td>
        </tr>`).join('')
    : '<tr><td colspan="5" class="empty-row">No hi ha sessions disponibles.</td></tr>';
}

function renderPlanningTable(planning) {
  const rows = [...planning].reverse().slice(0, 12);
  setText('planning-count-badge', `${planning.length} files`);

  document.getElementById('planning-table-body').innerHTML = rows.length
    ? rows.map(w => `
        <tr>
          <td>${esc(w.setmana)}</td>
          <td>${esc(w.cicle)}</td>
          <td>${esc(w.fase)}</td>
          <td>${formatMetric(w.qKm, 'km')}</td>
          <td>${formatMetric(w.z2Durada, 'min')}</td>
          <td>${formatMetric(w.llKm, 'km')}</td>
        </tr>`).join('')
    : '<tr><td colspan="6" class="empty-row">No hi ha setmanes planificades.</td></tr>';
}

function renderErrorTables(message) {
  document.getElementById('sessions-table-body').innerHTML =
    `<tr><td colspan="5" class="empty-row">Error: ${esc(message)}</td></tr>`;
  document.getElementById('planning-table-body').innerHTML =
    `<tr><td colspan="6" class="empty-row">Error: ${esc(message)}</td></tr>`;
}

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

// ── Helpers UI ────────────────────────────────────────────────────────────
function setNotice(message, type = 'info') {
  const bar = document.getElementById('notice-bar');
  bar.classList.remove('is-error', 'is-warning');
  if (type === 'error')   bar.classList.add('is-error');
  if (type === 'warning') bar.classList.add('is-warning');
  setText('notice-text', message);
}
function setBadge(text)         { setText('load-badge', text); }
function setText(id, value)     { const el = document.getElementById(id); if (el) el.textContent = value; }
function esc(v) {
  return String(v)
    .replaceAll('&',  '&amp;')
    .replaceAll('<',  '&lt;')
    .replaceAll('>',  '&gt;')
    .replaceAll('"',  '&quot;')
    .replaceAll("'",  '&#039;');
}

// ── Helpers de dades ──────────────────────────────────────────────────────
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

function formatDate(date) {
  return new Intl.DateTimeFormat('ca-ES').format(date);
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).trim().replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}

function sumNumbers(values) {
  return values.filter(v => isFinite(v)).reduce((acc, v) => acc + v, 0);
}

function firstFinite(values) {
  return values.find(v => isFinite(v)) ?? null;
}

function formatNumber(value) {
  if (!isFinite(value)) return '--';
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(value);
}

function formatMetric(value, unit) {
  if (!isFinite(value)) return unit ? `-- ${unit}` : '--';
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
}
