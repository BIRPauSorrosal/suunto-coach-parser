// docs/js/app.js
// Orquestrador: càrrega de dades, estat global, router, helpers compartits.
// Dep: lib/dashboard-config.js, lib/dashboard-store.js, lib/data-service.js,
//      lib/view-utils.js,
//      lib/ui-components.js,
//      lib/formatters.js i lib/metrics.js (carregats abans via index.html)

// ── Constants de classificació de sessions ────────────────────────────────────────────
function isRunning(s)  { return RUNNING_TYPES.has(s.tipusKey); }
function isStrength(s) { return STRENGTH_RE.test(s.tipusKey); }
function isTestRace(s) { return TEST_RACE_TYPES.has(s.tipusKey); }
function isBici(s)     { return BICI_TYPES.has(s.tipusKey); }
function isOther(s)    { return !isRunning(s) && !isStrength(s) && !isTestRace(s) && !isBici(s); }

// L'estat i la càrrega de dades viuen en mòduls independents.
const state = window.dashboardStore.getState();
let chartData = null;
let loadRequestId = 0;

// Estat compartit mínim per als mòduls d'importació i d'edició.
// L'aplicació continua utilitzant scripts clàssics, però aquesta referència
// evita que els mòduls hagin de dependre de variables lèxiques d'aquest fitxer.

// ── Router de vistes ─────────────────────────────────────────────────────────────────────────────
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
  window.DashboardComponents.destroyAllCharts();

  // — Notice bar: només visible a l'overview —
  const noticeBar = document.getElementById('notice-bar');
  if (noticeBar) noticeBar.style.display = target === 'overview' ? '' : 'none';

  // — Render de la vista corresponent —
  if (!chartData) return;
  const { sessions, planning } = chartData;
  if (target === 'overview')  renderOverviewView(sessions, planning);
  if (target === 'avui')      renderTodayView(sessions, planning);
  if (target === 'planning')  renderPlanningView(planning, sessions, state.calendar);
  if (target === 'activities') renderActivitiesView(sessions, planning);
  if (target === 'sessions')  renderSessionsView(sessions);
}

window.navigateTo = navigateTo;

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

  // — Drawer «Més» —
  const moreBtn  = document.getElementById('bnav-more-btn');
  const overlay  = document.getElementById('bnav-overlay');
  if (moreBtn) moreBtn.addEventListener('click', toggleBnavDrawer);
  if (overlay) overlay.addEventListener('click', closeBnavDrawer);
}

// ── Drawer helpers ─────────────────────────────────────────────────────────────────
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

// ── Punt d'entrada ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  document.getElementById('reload-data-btn').addEventListener('click', loadDashboardData);
  document.getElementById('data-state-import')?.addEventListener('click', () => window.openUploaderModal?.());
  document.getElementById('sync-now-btn')?.addEventListener('click', event => runSyncFromButton(event.currentTarget));
  document.getElementById('sync-now-btn-mobile')?.addEventListener('click', event => runSyncFromButton(event.currentTarget));
  document.getElementById('sync-resolve-btn')?.addEventListener('click', resolveSyncConflicts);
  document.getElementById('sync-resolve-btn-mobile')?.addEventListener('click', resolveSyncConflicts);
  updateSyncStatus();
  lastAutoRefreshAt = Date.now();
  loadDashboardData();
});

async function runSyncFromButton(button) {
  if (!button) return;
  if (!window.getGitHubToken?.()) {
    window.DashboardComponents?.showToast({ type: 'warning', message: 'Connecta GitHub abans de sincronitzar.' });
    window.openGitHubTokenModal?.();
    return;
  }
  button.classList.add('is-syncing');
  button.disabled = true;
  button.textContent = 'Sincronitzant...';
  try {
    await window.SyncQueue?.retry();
    const pending = window.SyncQueue?.pending?.() || 0;
    window.DashboardComponents?.showToast({
      type: pending ? 'warning' : 'success',
      message: pending ? `${pending} canvi${pending === 1 ? '' : 's'} pendent${pending === 1 ? '' : 's'} per sincronitzar.` : 'Sincronització completada.',
    });
  } catch (error) {
    console.error('[sync]', error);
    window.DashboardComponents?.showToast({ type: 'error', message: 'No s’ha pogut sincronitzar. Revisa la connexió i el token de GitHub.' });
  }
  finally {
    button.classList.remove('is-syncing');
    button.disabled = false;
    button.textContent = 'Sincronitzar canvis';
  }
}

function updateSyncStatus(detail = {}) {
  const status = document.getElementById('status-sync');
  const statusItem = document.getElementById('sync-status-item');
  const resolveButton = document.getElementById('sync-resolve-btn');
  const mobileStatus = document.getElementById('mobile-sync-status');
  const mobileResolveButton = document.getElementById('sync-resolve-btn-mobile');
  if (!status) return;
  const pending = detail.pending ?? window.SyncQueue?.pending?.() ?? 0;
  const conflict = detail.status === 'conflict' || (window.SyncQueue?.list?.() || []).some(item => item.conflict);
  const connected = Boolean(window.getGitHubToken?.());
  const state = conflict ? 'conflict' : detail.status === 'error' ? 'error' : detail.status === 'syncing' ? 'syncing' : pending ? 'pending' : detail.status === 'synced' ? 'synced' : connected ? 'connected' : 'disconnected';
  statusItem?.setAttribute('data-sync-state', state);
  status.textContent = conflict
    ? `Conflictes pendents (${pending})`
    : state === 'syncing'
      ? 'Sincronitzant canvis...'
    : pending
      ? `${pending} canvi${pending === 1 ? '' : 's'} pendent${pending === 1 ? '' : 's'}`
      : state === 'error' ? 'Error de sincronització'
      : state === 'synced' ? 'Canvis sincronitzats' : 'Sense canvis pendents';
  if (state === 'connected') status.textContent = 'GitHub connectat';
  if (state === 'disconnected') status.textContent = 'GitHub no connectat';
  if (state === 'synced') status.textContent = 'Sincronització completada';
  if (state === 'error') status.textContent = 'No s’ha pogut sincronitzar';
  resolveButton?.toggleAttribute('hidden', !conflict);
  mobileResolveButton?.toggleAttribute('hidden', !conflict);
  if (mobileStatus) {
    mobileStatus.textContent = status.textContent;
    mobileStatus.classList.toggle('is-conflict', conflict || state === 'error');
    mobileStatus.classList.toggle('is-pending', state === 'pending' || state === 'syncing');
  }
}

async function resolveSyncConflicts() {
  const conflicts = (window.SyncQueue?.list?.() || []).filter(item => item.conflict);
  let remoteSelected = false;
  for (const operation of conflicts) {
    const description = operation.kind === 'calendar'
      ? `la setmana ${operation.key}`
      : operation.kind === 'sessions' ? `la sessió ${operation.key}` : 'les zones cardíaques';
    const keepLocal = await window.DashboardComponents?.confirmMessage?.(
      `Hi ha un conflicte amb ${description}.\n\n` +
      `Accepta per conservar el canvi local o Cancel·la per descartar-lo i conservar la versió remota.`
    );
    if (!keepLocal) remoteSelected = true;
    await window.SyncQueue?.resolve(operation.queue_key, keepLocal ? 'local' : 'remote');
  }
  if (conflicts.length) await loadDashboardData({ silent: true, force: remoteSelected });
  updateSyncStatus();
}

['sync-queue-status', 'calendar-sync-status', 'sessions-sync-status', 'settings-sync-status']
  .forEach(eventName => window.addEventListener(eventName, event => updateSyncStatus(event.detail)));
window.addEventListener('gh-token-changed', () => {
  updateSyncStatus();
  window.DashboardComponents?.showToast({
    type: window.getGitHubToken?.() ? 'success' : 'info',
    message: window.getGitHubToken?.() ? 'GitHub connectat.' : 'GitHub desconnectat.',
  });
});

window.addEventListener('supabase-auth-changed', async event => {
  if (!event.detail?.user) return;
  try {
    const result = await window.SupabaseDataProvider?.getHeartRate();
    if (result?.status === 'loaded' && typeof applyFCConfig === 'function') {
      applyFCConfig(result.config);
    }
    await window.refreshDashboard?.({ silent: true, force: true });
    window.refreshDashboardUI?.();
  } catch (error) {
    console.warn('[supabase-settings] No s’han pogut carregar les preferències:', error.message);
  }
});

let realtimeRefreshTimer = null;
window.addEventListener('supabase-realtime-changed', () => {
  if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = window.setTimeout(async () => {
    realtimeRefreshTimer = null;
    try {
      const settings = await window.SupabaseDataProvider?.getHeartRate();
      if (settings?.status === 'loaded' && typeof applyFCConfig === 'function') applyFCConfig(settings.config);
      await window.refreshDashboard?.({ silent: true, force: true });
      window.refreshDashboardUI?.();
    } catch (error) {
      console.warn('[supabase-realtime] No s’han pogut actualitzar les dades:', error.message);
    }
  }, 150);
});

// ── Càrrega de dades ──────────────────────────────────────────────────────────────────
async function loadDashboardData({ silent = false, force = false } = {}) {
  const requestId = ++loadRequestId;
  if (!silent) {
    lastAutoRefreshAt = Date.now();
    setDataState('loading');
    setNotice('Llegint fitxers de dades...', 'info');
    setBadge('Carregant dades...');
  }

  try {
    const loaded = await window.DashboardDataService.refreshRemoteData();
    if (requestId !== loadRequestId) return;
    let supabaseCalendar = { status: 'unavailable' };
    let supabaseActivities = { status: 'unavailable' };
    let supabaseSettings = { status: 'unavailable' };
    try {
      supabaseCalendar = await window.CalendarSync?.readSupabase?.() || supabaseCalendar;
    } catch (error) {
      console.warn('[supabase-calendar] No s’han pogut llegir les setmanes; es manté el fallback JSON:', error.message);
    }
    try {
      supabaseActivities = await window.SupabaseDataProvider?.getActivities?.() || supabaseActivities;
    } catch (error) {
      console.warn('[supabase-activities] No s’han pogut llegir les activitats; es manté el fallback JSON:', error.message);
    }
    try {
      supabaseSettings = await window.SupabaseDataProvider?.getHeartRate?.() || supabaseSettings;
    } catch (error) {
      console.warn('[supabase-settings] No s’han pogut llegir les preferències; es manté el fallback JSON:', error.message);
    }

    const supabaseCalendarPrimary = ['loaded', 'empty'].includes(supabaseCalendar.status);
    if (supabaseCalendarPrimary) {
      loaded.calendar = {
        ...loaded.calendar,
        weeks: supabaseCalendar.weeks || {},
      };
      loaded.sources = { ...loaded.sources, calendar: 'supabase' };
    }
    const supabaseActivitiesPrimary = ['loaded', 'empty'].includes(supabaseActivities.status);
    if (supabaseActivitiesPrimary) {
      loaded.sessionsDocument = { ...loaded.sessionsDocument, sessions: supabaseActivities.activities || [] };
      loaded.sessions = window.DashboardDataService.normalizeSessionsJSON(loaded.sessionsDocument);
      loaded.sources = { ...loaded.sources, sessions: 'supabase' };
    }
    const supabaseSettingsPrimary = ['loaded', 'empty'].includes(supabaseSettings.status);
    if (supabaseSettingsPrimary) {
      loaded.settings = {
        ...loaded.settings,
        settings: {
          ...(loaded.settings?.settings || {}),
          heart_rate: supabaseSettings.status === 'loaded' ? supabaseSettings.config : null,
        },
      };
      loaded.sources = { ...loaded.sources, settings: 'supabase' };
    }
    const supabasePrimary = supabaseCalendarPrimary || supabaseActivitiesPrimary || supabaseSettingsPrimary;
    if (!force && silent && !supabasePrimary && hasSameRemoteRevisions(loaded.revisions, lastRemoteRevisions)) {
      window.SessionsSync?.queueLocalLinks(loaded.sessions);
      return;
    }
    lastRemoteRevisions = loaded.revisions || null;
    window.dashboardStore.setData(loaded);
    const remoteHeartRate = loaded.settings?.settings?.heart_rate;
    const preferredHeartRate = window.SettingsSync?.preferredHeartRate(remoteHeartRate) || remoteHeartRate;
    if (preferredHeartRate) applyFCConfig(preferredHeartRate);
    window.SessionsSync?.queueLocalLinks(loaded.sessions);

    renderDashboard();
    updateStatus();
    setDataState(state.sessions.length || state.planning.length ? 'ready' : 'empty');
    if (!silent) setBadge('Dades carregades');
    if (!silent) setNotice(
      `Dades carregades correctament. Sessions: ${state.sessions.length} · Planning: ${state.planning.length}`,
      'info'
    );
  } catch (error) {
    if (requestId !== loadRequestId) return;
    console.error(error);
    if (!chartData) setDataState('error');
    if (!silent) setBadge('Error de càrrega');
    if (!silent) setNotice(
      "No s'han pogut llegir les dades. Comprova planning.json i sessions.json.",
      'error'
    );
    updateStatus(error.message);
  }
}

// API pública de refresc utilitzada pels importadors i l'editor de comentaris.
// `refreshDashboard()` torna a llegir la font de dades; `refreshDashboardUI()`
// només torna a renderitzar l'estat que ja tenim en memòria (mode local).
const AUTO_REFRESH_MIN_INTERVAL = 30 * 1000;
const PLANNING_POLL_INTERVAL = 60 * 1000;
let lastAutoRefreshAt = 0;
let autoRefreshPromise = null;
let lastRemoteRevisions = null;

async function refreshWhenVisible(reason) {
  if (document.visibilityState === 'hidden') return;
  const now = Date.now();
  if (autoRefreshPromise || now - lastAutoRefreshAt < AUTO_REFRESH_MIN_INTERVAL) return;
  lastAutoRefreshAt = now;
  autoRefreshPromise = loadDashboardData({ silent: true, reason });
  try { await autoRefreshPromise; }
  finally { autoRefreshPromise = null; }
}

function hasSameRemoteRevisions(next, previous) {
  if (!next || !previous) return false;
  const keys = ['sessions', 'planning', 'calendar', 'settings'];
  return keys.every(key => next[key] && previous[key] && next[key] === previous[key]);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshWhenVisible('visibilitychange');
});
window.addEventListener('focus', () => refreshWhenVisible('focus'));
window.addEventListener('pageshow', () => refreshWhenVisible('pageshow'));
window.setInterval(() => {
  if (document.querySelector('.view--active')?.dataset.view === 'planning') {
    refreshWhenVisible('planning-poll');
  }
}, PLANNING_POLL_INTERVAL);

window.refreshDashboard = loadDashboardData;

function refreshDashboardUI() {
  renderDashboard();
  updateStatus();
  setBadge('Dades carregades');
}

window.refreshDashboardUI = refreshDashboardUI;

// Les edicions del calendari i les associacions confirmades es guarden
// primer al navegador. Notifiquem també aquestes mutacions perquè Avui,
// Overview i Sessions reflecteixin immediatament el mateix estat que Planning.
window.addEventListener('dashboard-local-change', () => {
  if (!chartData) return;
  renderAllViews();
  updateStatus();
});

// Les actualitzacions locals dels importadors passen pel store i provoquen
// un únic render de la vista activa. La càrrega inicial continua sent explícita
// perquè permet mostrar els estats de loading/error abans de renderitzar.
window.dashboardStore.subscribe((_, reason) => {
  if (reason === 'data-loaded' || !chartData) return;
  renderDashboard();
  updateStatus();
  setBadge('Dades carregades');
});

// ── 🔧 FIX UTF-8: decodifica Base64 de l'API GitHub respectant UTF-8 ──────────────────────
// atob() retorna Latin-1 i trenca accents (à, è, ç, etc.).
// Aquesta funció converteix correctament Base64 → UTF-8.
// ── Fetch ──────────────────────────────────────────────────────────────────────
function base64ToUtf8(base64) {
  return window.DashboardDataService.base64ToUtf8(base64);
}

/* Obsolete implementation kept disabled for one release; DashboardDataService is the single loader. */
/*
async function removedFetchFirstAvailable(paths) {
  const token = window.getGitHubToken ? window.getGitHubToken() : '';

  if (token) {
    for (const path of paths) {
      try {
        const repoPath = path.replace(/^\.\//,  'docs/');
        const { owner, repo, branch } = window.DashboardConfig.github;
        const apiUrl   = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}?ref=${branch}`;

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

// ── Parser CSV ───────────────────────────────────────────────────────────────────────────
function removedParseCSV(text) {
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
*/

// ── Orquestració del render ─────────────────────────────────────────────────────────────────
// Compatibilitat amb codi extern: les implementacions reals viuen a
// DashboardDataService.
async function fetchFirstAvailable(paths) {
  return window.DashboardDataService.fetchFirstAvailable(paths);
}

function parseCSV(text) {
  return window.DashboardDataService.parseCSV(text);
}

function renderDashboard() {
  const planning = state.planning
    .map(enrichPlanningRow)
    .filter(Boolean)
    .sort((a, b) => a.startDate - b.startDate);

  const sessions = state.sessions
    .map(enrichSessionRow)
    .filter(Boolean)
    .sort((a, b) => b.date - a.date);

  chartData = { sessions, planning };

  // Exposar les files RAW del planning perquè planning-uploader.js
  // pugui fer el merge sense dependre de les dades enriquides.
  // Les files RAW es consulten directament des del store pels importadors.

  // Les dades poden haver canviat en una altra pestanya o dispositiu mentre
  // l'usuari continua mirant la vista actual. Refresquem totes les vistes
  // perquè cap d'elles conservi una fotografia antiga de l'estat.
  renderAllViews();
}

function renderActiveView() {
  if (!chartData) return;
  const { sessions, planning } = chartData;
  const target = document.querySelector('.view--active')?.dataset.view || 'overview';
  if (target === 'overview') renderOverviewView(sessions, planning);
  if (target === 'avui')     renderTodayView(sessions, planning);
  if (target === 'planning') renderPlanningView(planning, sessions, state.calendar);
  if (target === 'activities') renderActivitiesView(sessions, planning);
  if (target === 'sessions') renderSessionsView(sessions);
}

function renderAllViews() {
  if (!chartData) return;

  // Els gràfics tenen instàncies associades al canvas. Destruïm-les una sola
  // vegada abans de reconstruir qualsevol vista, incloses les ocultes.
  window.DashboardComponents?.destroyAllCharts();

  const { sessions, planning } = chartData;
  renderOverviewView(sessions, planning);
  renderTodayView(sessions, planning);
  renderPlanningView(planning, sessions, state.calendar);
  renderActivitiesView(sessions, planning);
  renderSessionsView(sessions);
}

// ── Enriquiment de files ──────────────────────────────────────────────────────────────────
function enrichPlanningRow(row) {
  const startDate = parseDate(row['Data_Inici']);
  const endDate   = parseDate(row['Data_Fi']);
  if (!startDate || !endDate) return null;

  // ── Qualitat ─────────────────────────────────────────────────────────────────────
  const qSeries      = toNumber(row['Q_Series']);           // número de sèries
  const qDuradaSerie = toNumber(row['Q_Durada_Serie_min']); // minuts per sèrie
  const qRec         = toNumber(row['Q_Rec_min']);          // minuts recuperació entre sèries
  const qRitme       = toNumber(row['Q_Ritme_min_km']);     // ritme objectiu (min/km)
  const qFcMin       = toNumber(row['Q_FC_min']);
  const qFcMax       = toNumber(row['Q_FC_max']);
  const qKm          = toNumber(row['Q_Km_Plan']);

  // ── Z2 ───────────────────────────────────────────────────────────────────────
  const z2Durada     = toNumber(row['Z2_Durada_min']);
  const z2RitmeMin   = toNumber(row['Z2_Ritme_min_km_min']);
  const z2RitmeMax   = toNumber(row['Z2_Ritme_min_km_max']);
  const z2FcMin      = toNumber(row['Z2_FC_min']);
  const z2FcMax      = toNumber(row['Z2_FC_max']);
  const z2Km         = toNumber(row['Z2_Km_Plan']);

  // ── Tirada llarga ───────────────────────────────────────────────────────────────────
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
    code:         row['Setmana'] || '--',
    sessions:     Array.isArray(row.__sessions) ? row.__sessions : [],
    planningId:   row.__weekId || null,

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
    feeling:             toNumber(row.Feeling),
    vo2max:              toNumber(row.VO2max),
    carrega:             toNumber(row['Carrega']),
    z1min:               toNumber(row['Z1(min)']),
    z2min:               toNumber(row['Z2(min)']),
    fcMitja:             toNumber(row['FCMitja']),
    fcMax:               toNumber(row['FCMax']),
    ritme:               toNumber(row['Ritme(min/km)']),
    // ── Camps de qualitat (sèries) ───────────────────────────────────────────────────
    numSeries:           toNumber(row['Num_Series']),
    duradaMitjaSeries:   toNumber(row['Durada_Mitja_Series']),
    recMitjaMin:         toNumber(row['Rec_Mitja_Min']),
    ritmeMitjaSeries:    toNumber(row['Ritme_Mitja_Series']),
    consistenciaRitme:   toNumber(row['Consistencia_Ritme']),
    fcMitjaSeries:       toNumber(row['FC_Mitja_Series']),
    fcMaxMitjaSeries:    toNumber(row['FC_Max_Mitja_Series']),
    cadenciaMitjaSeries: toNumber(row['Cadencia_Mitja_Series']),
    // ── Altres ──────────────────────────────────────────────────────────────────────────────────
    epoc:                toNumber(row['EPOC']),
    recuperacio:         toNumber(row['Recup(h)'])
  };
}

// ── Detecció setmana activa ──────────────────────────────────────────────────────────────────
function detectActiveWeek(planning, sessions) {
  const now   = new Date();
  // Les dates del planning es parsegen a mitjanit. Utilitzar també mitjanit
  // aquí evita perdre la setmana activa durant el diumenge al vespre.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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

// ── Status sidebar ──────────────────────────────────────────────────────────────────────
function updateStatus(errorMessage = null) {
  const sessionsStatus = document.getElementById('status-sessions');
  const planningStatus = document.getElementById('status-planning');
  const sourceLabel = source => source === 'supabase'
    ? 'Supabase'
    : source === 'github-api'
      ? 'GitHub Contents API'
      : source === 'pages'
        ? 'JSON local / Pages'
        : source || '--';
  const sources = state.sources || {};
  setText('status-sessions', state.sessions.length ? `${state.sessions.length} activitats` : 'Sessions no disponibles');
  setText('status-planning', state.planning.length ? `${state.planning.length} setmanes` : 'Planning no disponible');
  if (sessionsStatus) sessionsStatus.title = sourceLabel(sources.sessions);
  if (planningStatus) planningStatus.title = sourceLabel(sources.planning);
  setText('status-source-sessions', `Activitats: ${sourceLabel(sources.sessions)}`);
  setText('status-source-calendar', `Calendari: ${sourceLabel(sources.calendar)}`);
  setText('status-source-settings', `Configuracio: ${sourceLabel(sources.settings)}`);
  setText('status-source-planning', `Planning: ${sourceLabel(sources.planning)}`);
  setText('status-source', errorMessage
    ? `Error: ${errorMessage}`
    : `sessions: ${state.sources.sessions || '--'} · planning: ${state.sources.planning || '--'}`);
  setText('status-last-update', `Actualitzat: ${new Date().toLocaleString('ca-ES')}`);
  if (errorMessage) {
    const source = document.getElementById('status-source');
    if (source) source.title = errorMessage;
    setText('status-source', 'No s’han pogut carregar les dades');
  }
}

// ── Helpers UI ──────────────────────────────────────────────────────────────────────
function setNotice(message, type = 'info') {
  const bar = document.getElementById('notice-bar');
  bar.classList.remove('is-error', 'is-warning');
  if (type === 'error')   bar.classList.add('is-error');
  if (type === 'warning') bar.classList.add('is-warning');
  setText('notice-text', message);
  const activeView = document.querySelector('.view--active')?.dataset.view;
  bar.style.display = activeView === 'overview' || activeView == null ? '' : 'none';
}

// ── Helpers de dades ───────────────────────────────────────────────────────────────────
function setDataState(status) {
  const panel = document.getElementById('data-state-panel');
  if (!panel) return;
  const title = document.getElementById('data-state-title');
  const message = document.getElementById('data-state-message');
  const action = document.getElementById('data-state-import');
  const content = {
    loading: ['Carregant dades...', 'Estem llegint les dades del dashboard.', '◌'],
    empty: ['No hi ha dades disponibles', 'Importa activitats per començar a construir el teu historial.', '!'],
    error: ['No s’han pogut carregar les dades', 'Revisa les fonts de dades o torna-ho a provar.', '!'],
    ready: ['', '', ''],
  }[status] || ['No s’han pogut carregar les dades', 'Revisa les fonts de dades o torna-ho a provar.', '!'];
  panel.dataset.state = status;
  panel.hidden = status === 'ready';
  if (title) title.textContent = content[0];
  if (message) message.textContent = content[1];
  panel.querySelector('.data-state-panel__icon')?.replaceChildren(document.createTextNode(content[2]));
  if (action) action.hidden = status !== 'empty';
}

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
function setText(id, value) { return window.DashboardViewUtils.setText(id, value); }

// Re-renderitza tot quan l'usuari canvia la configuració de FC
window.addEventListener('fc-config-changed', () => {
  renderAllViews();
});
