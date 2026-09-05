// ─────────────────────────────────────────────────────────────
// planning-uploader.js — Lògica de File API, validació i merge
// Depèn de: (cap — standalone)
// NO conté cap manipulació del DOM ni render
// ─────────────────────────────────────────────────────────────


// ─── CONFIGURACIÓ GITHUB API ───────────────────────────────────

const PLANNING_GITHUB_CONFIG = {
  ...window.DashboardConfig.github,
  path:   window.DashboardConfig.paths.planning.repository,
  get token() { return window.getGitHubToken ? window.getGitHubToken() : ''; },
};
const PLANNING_CSV_PATH = 'docs/data/planning.csv';


// ─── COLUMNES OBLIGATÒRIES ───────────────────────────────────────

const PLANNING_REQUIRED_COLUMNS = [
  "Setmana", "Data_Inici", "Data_Fi", "Cicle", "Fase",
  "Q_Series", "Q_Durada_Serie_min", "Q_Ritme_min_km",
  "Q_Rec_min", "Q_FC_min", "Q_FC_max", "Q_Km_Plan",
  "Z2_Durada_min", "Z2_Ritme_min_km_min", "Z2_Ritme_min_km_max",
  "Z2_FC_min", "Z2_FC_max", "Z2_Km_Plan",
  "LL_Tipus", "LL_Durada_min", "LL_Km_Plan",
  "Forca_Plan", "Padel_Plan", "Km_Total_Plan",
];


// ─── ESTAT INTERN ────────────────────────────────────────────

let _pendingMerge = null;

function getPendingMerge()   { return _pendingMerge; }
function clearPendingMerge() { _pendingMerge = null; }


// ─── AUTODETECTE DEL SEPARADOR ──────────────────────────────────

// ─── PARSING CSV ──────────────────────────────────────────────

function parseCSVText(text) {
  return window.DashboardCsv.parse(text, { separator: 'auto' });
}


// ─── VALIDACIÓ DE COLUMNES ─────────────────────────────────────

function validatePlanningColumns(rows) {
  if (!rows.length) {
    return { valid: false, missing: [], error: "El fitxer és buit o no té files de dades." };
  }
  const present = Object.keys(rows[0]);
  const missing = PLANNING_REQUIRED_COLUMNS.filter(c => !present.includes(c));
  return { valid: missing.length === 0, missing };
}


// ─── HELPERS DE DATA ─────────────────────────────────────────

function parseDateForSort(value) {
  if (!value) return 0;
  const s = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  return 0;
}


// ─── MERGE (UPSERT PER SETMANA) ──────────────────────────────────

function mergePlanning(existing, incoming) {
  const map = new Map();
  existing.forEach(row => map.set(row.Setmana, row));

  const stats             = { added: 0, replaced: 0, unchanged: 0 };
  const incomingAnnotated = [];

  for (const row of incoming) {
    const key = row.Setmana;
    if (!map.has(key)) {
      map.set(key, row);
      stats.added++;
      incomingAnnotated.push({ row, status: "added" });
    } else {
      const existingRow = map.get(key);
      const isIdentical = JSON.stringify(existingRow) === JSON.stringify(row);
      if (isIdentical) {
        stats.unchanged++;
        incomingAnnotated.push({ row, status: "unchanged" });
      } else {
        map.set(key, row);
        stats.replaced++;
        incomingAnnotated.push({ row, status: "replaced" });
      }
    }
  }

  const rows = Array.from(map.values()).sort((a, b) =>
    parseDateForSort(a.Data_Inici) - parseDateForSort(b.Data_Inici)
  );

  return { rows, stats, incoming: incomingAnnotated };
}


// ─── SERIALITZACIÓ CSV ────────────────────────────────────────────

function serializePlanningCSV(rows) {
  if (!rows.length) return PLANNING_REQUIRED_COLUMNS.join(",") + "\n";
  const header = PLANNING_REQUIRED_COLUMNS.join(",");
  const lines  = rows.map(row =>
    PLANNING_REQUIRED_COLUMNS.map(col => {
      const val = String(row[col] ?? "");
      return val.includes(",") || val.includes("\n")
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}


// ─── GITHUB API: helpers UTF-8 ──────────────────────────────────────
// Mateixos helpers que csv-writer.js per garantir accénts correctes

function _base64ToUtf8(base64) {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function _utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary  = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}


// ─── GITHUB API: llegir planning.csv actual ──────────────────────────

async function _fetchCurrentPlanningCSV() {
  const { owner, repo, branch, token } = PLANNING_GITHUB_CONFIG;
  const path = PLANNING_CSV_PATH;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/vnd.github+json",
    }
  });

  if (res.status === 404) return { content: "", sha: null };

  if (!res.ok) throw new Error(`Error llegint planning.csv: ${res.status} ${res.statusText}`);

  const json = await res.json();
  return { content: _base64ToUtf8(json.content), sha: json.sha };
}


// ─── GITHUB API: pujar planning.csv ─────────────────────────────────

async function _pushPlanningCSVToGitHub(csvText, sha, stats) {
  const { owner, repo, branch, token } = PLANNING_GITHUB_CONFIG;
  const path = PLANNING_CSV_PATH;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const added    = stats.added;
  const replaced = stats.replaced;
  const parts    = [];
  if (added)    parts.push(`${added} noves`);
  if (replaced) parts.push(`${replaced} substituïdes`);
  const summary = parts.length ? parts.join(", ") : "sense canvis";

  const body = {
    message: `[planning] ${new Date().toLocaleDateString("ca-ES")} — ${summary}`,
    content: _utf8ToBase64(csvText),
    branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(url, {
    method:  "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/vnd.github+json",
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error pujant planning.csv: ${res.status} — ${err.message ?? res.statusText}`);
  }
}


// ─── LECTURA DE FITXERS ────────────────────────────────────────────

function readPlanningFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader   = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Error llegint ${file.name}`));
    reader.readAsText(file, "utf-8");
  });
}


// ─── COORDINADOR PRINCIPAL ────────────────────────────────────────

function mergePlanningDocuments(existing, incoming) {
  const document = JSON.parse(JSON.stringify(existing || { schema_version: 1, season: incoming.season, cycles: [] }));
  const weeksById = new Map(document.cycles.flatMap(cycle => (cycle.weeks || []).map(week => [week.id, { cycle, week }])));
  const stats = { added: 0, replaced: 0, unchanged: 0 };
  const annotated = [];
  (incoming.cycles || []).forEach(incomingCycle => {
    let cycle = document.cycles.find(candidate => candidate.id === incomingCycle.id);
    if (!cycle) { cycle = { ...incomingCycle, weeks: [] }; document.cycles.push(cycle); }
    (incomingCycle.weeks || []).forEach(incomingWeek => {
      const existingEntry = weeksById.get(incomingWeek.id);
      const status = !existingEntry ? 'added' : JSON.stringify(existingEntry.week) === JSON.stringify(incomingWeek) ? 'unchanged' : 'replaced';
      if (existingEntry) existingEntry.cycle.weeks = existingEntry.cycle.weeks.map(week => week.id === incomingWeek.id ? incomingWeek : week);
      else { cycle.weeks = [...(cycle.weeks || []), incomingWeek]; weeksById.set(incomingWeek.id, { cycle, week: incomingWeek }); }
      stats[status]++;
      annotated.push({ row: { Setmana: incomingWeek.code, Data_Inici: incomingWeek.start, Data_Fi: incomingWeek.end }, status });
    });
  });
  document.cycles.forEach(cycle => cycle.weeks.sort((a, b) => a.start.localeCompare(b.start)));
  document.cycles.sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
  return { document, stats, incoming: annotated };
}

async function readPlanningJSONFromGitHub() {
  const { owner, repo, branch, path, token } = PLANNING_GITHUB_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
  if (res.status === 404) return { document: { schema_version: 1, season: new Date().getFullYear(), cycles: [] }, sha: null };
  if (!res.ok) throw new Error(`Error llegint planning.json: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return { document: window.DashboardDataService.parsePlanningJSON(_base64ToUtf8(json.content)), sha: json.sha };
}

function pushPlanningJSONToGitHub(document, sha, stats) {
  const { owner, repo, branch, path, token } = PLANNING_GITHUB_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const changes = (stats.added || 0) + (stats.replaced || 0);
  return fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `[planning] Import JSON ${new Date().toLocaleDateString('ca-ES')} — ${changes} setmanes modificades`, content: _utf8ToBase64(`${JSON.stringify(document, null, 2)}\n`), branch, ...(sha ? { sha } : {}) }) }).then(async res => { if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Error pujant planning.json: ${res.status} — ${err.message ?? res.statusText}`); } });
}

async function handlePlanningFileSelection(file, onDone) {
  if (!file) return;

  const isJson = file.name.toLowerCase().endsWith('.json');
  if (!isJson && !file.name.toLowerCase().endsWith(".csv")) {
    onDone({ ok: false, error: "El fitxer ha de tenir extensió .json o .csv." });
    return;
  }

  let text;
  try {
    text = await readPlanningFileAsText(file);
  } catch (e) {
    onDone({ ok: false, error: e.message });
    return;
  }

  if (isJson) {
    try {
      const incoming = window.DashboardDataService.parsePlanningJSON(text);
      const existing = window.dashboardStore?.getState?.()?.planningDocument;
      const merge = mergePlanningDocuments(existing, incoming);
      merge.format = 'json';
      _pendingMerge = merge;
      onDone({ ok: true, error: null, merge });
    } catch (error) {
      onDone({ ok: false, error: error.message });
    }
    return;
  }

  const incoming   = parseCSVText(text);
  const validation = validatePlanningColumns(incoming);

  if (!validation.valid) {
    const msg = validation.error
      ?? `Columnes que falten: ${validation.missing.join(", ")}`;
    onDone({ ok: false, error: msg });
    return;
  }

  const storeState = window.dashboardStore?.getState?.();
  const existing = Array.isArray(storeState?.planning)
    ? storeState.planning
    : [];
  const merge    = mergePlanning(existing, incoming);

  _pendingMerge = merge;
  onDone({ ok: true, error: null, merge });
}


/**
 * Confirma el merge: puja el planning.csv resultant a GitHub
 * (o descarrega localment si no hi ha token configurat).
 *
 * Flux idèntic al de appendRowsToCSV() de csv-writer.js:
 *   1. Llegir SHA actual del fitxer al repo
 *   2. Fer PUT amb el nou contingut
 *   3. Actualitzar l'estat del dashboard en memòria
 *   4. Mostrar notificació i tancar modal
 *
 * @param {Function} onComplete — callback quan acaba (per tancar el modal)
 */
async function confirmPlanningImport(onComplete) {
  if (!_pendingMerge) return;

  const merge = _pendingMerge;
  if (merge.format === 'json') {
    const token = window.getGitHubToken ? window.getGitHubToken() : '';
    const jsonText = `${JSON.stringify(merge.document, null, 2)}\n`;
    try {
      if (token) {
        showNotice('Llegint planning.json actual...');
        const { sha } = await readPlanningJSONFromGitHub();
        showNotice('Pujant planning.json al repositori...');
        await pushPlanningJSONToGitHub(merge.document, sha, merge.stats);
        showNotice(`✅ Planning importat: ${merge.stats.added} noves, ${merge.stats.replaced} actualitzades.`);
      } else {
        const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'planning.json'; a.click(); URL.revokeObjectURL(url);
        showNotice('✅ planning.json descarregat (configura el token per pujar directament).');
      }
      window.dashboardStore?.setPlanningDocument?.(merge.document);
      if (token && typeof window.refreshDashboard === 'function') await window.refreshDashboard();
    } catch (err) {
      console.error(err); showNotice(`❌ Error: ${err.message}`, true);
    } finally {
      _pendingMerge = null;
      onComplete();
    }
    return;
  }
  const csv   = serializePlanningCSV(merge.rows);
  const token = window.getGitHubToken ? window.getGitHubToken() : '';

  try {
    if (token) {
      // ── Mode GitHub: llegir SHA actual i fer push ──
      showNotice("Llegint planning.csv actual...");
      const { sha } = await _fetchCurrentPlanningCSV();

      showNotice("Pujant planning al repositori...");
      await _pushPlanningCSVToGitHub(csv, sha, merge.stats);

      const added    = merge.stats.added;
      const replaced = merge.stats.replaced;
      const parts    = [];
      if (added)    parts.push(`${added} setmanes noves`);
      if (replaced) parts.push(`${replaced} substituïdes`);
      showNotice(`✅ Planning importat: ${parts.join(", ") || "sense canvis nous"}.`);

    } else {
      // ── Mode fallback: descàrrega local ──
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "planning.csv";
      a.click();
      URL.revokeObjectURL(url);
      showNotice("✅ planning.csv descarregat (configura el token per pujar directament).");
    }

    // Actualitzar dades en memòria sense recarregar la pàgina
    if (window.dashboardStore?.setPlanning) {
      window.dashboardStore.setPlanning(merge.rows);
    }
    if (token && typeof window.refreshDashboard === 'function') {
      await window.refreshDashboard();
    }

  } catch (err) {
    console.error(err);
    showNotice(`❌ Error: ${err.message}`, true);
  } finally {
    _pendingMerge = null;
    onComplete();
  }
}


window.addEventListener('gh-token-changed', () => {
  PLANNING_GITHUB_CONFIG.token = window.getGitHubToken();
});
