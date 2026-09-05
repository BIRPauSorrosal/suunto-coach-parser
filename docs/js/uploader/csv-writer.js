// ─────────────────────────────────────────────────────────────
// csv-writer.js — Merge de files noves al sessions.csv
// Depèn de: parser.js, uploader.js
// Modes de guardat: descàrrega local | push GitHub API
// ─────────────────────────────────────────────────────────────


// ─── CONFIGURACIÓ GITHUB API ─────────────────────────────────
const GITHUB_CONFIG = {
  ...window.DashboardConfig.github,
  // Aquest escriptor continua sent legacy fins que l'importador es migri a JSON.
  path:   'docs/data/sessions.csv',
  get token() { return window.getGitHubToken ? window.getGitHubToken() : ''; },
};
const JSON_SESSIONS_PATH = 'docs/data/sessions.json';


// ─── 🔧 FIX UTF-8: helpers de codificació ────────────────────

/**
 * Base64 (GitHub API) → string UTF-8 correcte.
 * atob() retorna Latin-1 i trenca accents (à, è, ç...).
 */
function base64ToUtf8(base64) {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * String UTF-8 → Base64 per pujar a la GitHub API.
 * btoa() només suporta Latin-1; TextEncoder + Uint8Array ho fa bé.
 */
function utf8ToBase64(str) {
  const bytes  = new TextEncoder().encode(str);
  let binary   = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}


// ─── CSV PARSER (text → array de objectes) ───────────────────

/**
 * Converteix un string CSV en un array d'objectes JS.
 * Primera fila = capçalera (claus).
 */
function csvToObjects(csvText) {
  return window.DashboardCsv.parse(csvText, { separator: ',' });
}


// ─── CSV SERIALIZER (array d'objectes → text) ────────────────

/**
 * Converteix un array d'objectes JS en un string CSV.
 * Posa entre cometes qualsevol valor que contingui comes o cometes.
 */
function objectsToCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const escape  = val => {
    const str = val == null ? "" : String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const lines = [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(","))
  ];
  return lines.join("\n");
}


// ─── MERGE ───────────────────────────────────────────────────

/**
 * Combina les files existents amb les noves.
 * Control de duplicats per columna 'Arxiu' (igual que el Python).
 * Retorna { merged: [], duplicats: [] }
 */
function mergeRows(existingRows, newRows) {
  const existingKeys = new Set(existingRows.map(r => r["Arxiu"]));
  const duplicats    = [];
  const toAdd        = [];

  for (const row of newRows) {
    if (existingKeys.has(row["Arxiu"])) {
      duplicats.push(row["Arxiu"]);
    } else {
      toAdd.push(row);
    }
  }

  const allKeys = Array.from(new Set([
    ...Object.keys(existingRows[0] ?? {}),
    ...Object.keys(newRows[0]      ?? {}),
  ]));

  const normalize = row => {
    const obj = {};
    allKeys.forEach(k => { obj[k] = row[k] ?? ""; });
    return obj;
  };

  const merged = [
    ...existingRows.map(normalize),
    ...toAdd.map(normalize),
  ];

  return { merged, duplicats };
}


// ─── LLEGIR CSV EXISTENT DES DE GITHUB ───────────────────────

/**
 * Llegeix el sessions.csv actual del repositori via GitHub API.
 * Retorna { content: string UTF-8, sha: string }
 */
async function fetchCurrentCSV() {
  const { owner, repo, branch, path, token } = GITHUB_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/vnd.github+json",
    }
  });

  if (res.status === 404) {
    return { content: "", sha: null };
  }

  if (!res.ok) {
    throw new Error(`Error llegint CSV: ${res.status} ${res.statusText}`);
  }

  const json    = await res.json();
  // 🔧 FIX UTF-8: substituïm atob() per base64ToUtf8()
  const decoded = base64ToUtf8(json.content);
  return { content: decoded, sha: json.sha };
}

// Llegeix el CSV local quan no hi ha token de GitHub.
async function fetchLocalCSV() {
  const localPath = './data/sessions.csv';
  const response = await fetch(`${localPath}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Error llegint el CSV local: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new TextDecoder('utf-8').decode(buffer);
}

// Retorna la font de sessions adequada al mode actual.
async function readCurrentSessionsCSV() {
  const token = window.getGitHubToken ? window.getGitHubToken() : '';
  if (token) return fetchCurrentCSV();

  const storeState = window.dashboardStore?.getState?.();
  const sessions = Array.isArray(storeState?.sessions)
    ? storeState.sessions
    : [];

  if (Array.isArray(sessions) && sessions.length) {
    return { content: objectsToCsv(sessions), sha: null };
  }

  return { content: await fetchLocalCSV(), sha: null };
}


// ─── PUSH CSV A GITHUB ───────────────────────────────────────

/**
 * Fa un PUT al GitHub Contents API per actualitzar el sessions.csv.
 * Si sha és null, crea el fitxer per primera vegada.
 */
async function pushCSVToGitHub(csvText, sha) {
  const { owner, repo, branch, path, token } = GITHUB_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const body = {
    message: `[dashboard] Afegides ${new Date().toLocaleDateString("ca-ES")} sessions via uploader`,
    // 🔧 FIX UTF-8: substituïm btoa(unescape(encodeURIComponent(...))) per utf8ToBase64()
    content: utf8ToBase64(csvText),
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
    throw new Error(`Error pujant CSV: ${res.status} — ${err.message ?? res.statusText}`);
  }
}


// ─── DESCÀRREGA LOCAL (mode alternatiu) ──────────────────────

/**
 * Descàrrega el CSV resultant com a fitxer local.
 * Útil per testejar sense token de GitHub configurat.
 */
function downloadCSV(csvText) {
  // 🔧 FIX UTF-8: Blob amb BOM (\uFEFF) garanteix que Excel/editors obrin bé el fitxer
  const blob = new Blob(['\uFEFF' + csvText], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "sessions.csv";
  a.click();
  URL.revokeObjectURL(url);
}


// ─── NOTIFICACIÓ A L'USUARI ──────────────────────────────────

function showNotice(msg, isError = false) {
  const bar  = document.getElementById("notice-bar");
  const text = document.getElementById("notice-text");
  if (!bar || !text) return;
  text.textContent      = msg;
  bar.style.display     = "block";
  bar.style.background  = isError ? "var(--color-error, #c0392b)" : "";
  setTimeout(() => { bar.style.display = "none"; }, 5000);
}


// ─── PUNT D'ENTRADA PÚBLIC ───────────────────────────────────

/**
 * Crida des de uploader.js quan l'usuari confirma.
 * Llegeix el CSV actual, fa el merge i guarda.
 *
 * Mode auto:
 *   - Si GITHUB_CONFIG.token està configurat → push a GitHub
 *   - Si no → descàrrega local com a fallback
 *
 * @param {object[]} newRows — files parsejades per parser.js
 */
async function appendRowsToCSV(newRows) {
  if (!newRows.length) return;

  try {
    showNotice("Llegint CSV actual...");

    const token      = window.getGitHubToken ? window.getGitHubToken() : '';
    const useGitHub  = !!token;

    const current      = await readCurrentSessionsCSV();
    const sha          = current.sha;
    const existingRows = current.content ? csvToObjects(current.content) : [];

    const { merged, duplicats } = mergeRows(existingRows, newRows);

    if (duplicats.length) {
      console.warn("⚠️ Duplicats ignorats:", duplicats);
    }

    const csvText = objectsToCsv(merged);

    if (useGitHub) {
      showNotice("Pujant al repositori...");
      await pushCSVToGitHub(csvText, sha);
      if (typeof window.refreshDashboard === 'function') {
        await window.refreshDashboard();
      }
      showNotice(`✅ ${newRows.length - duplicats.length} sessions afegides al repositori.`);
    } else {
      if (window.dashboardStore?.setSessions) {
        window.dashboardStore.setSessions(merged);
      }
      downloadCSV(csvText);
      showNotice(`✅ CSV descarregat. ${duplicats.length ? `(${duplicats.length} duplicats ignorats)` : ""}`);
    }

  } catch (err) {
    console.error(err);
    showNotice(`❌ Error: ${err.message}`, true);
  }
}

function sessionDocumentFromRows(rows) {
  return rows.map(row => row.__session).filter(session => session && session.id);
}

async function readCurrentSessionsJSON() {
  const token = window.getGitHubToken ? window.getGitHubToken() : '';
  if (token) {
    const { owner, repo, branch } = GITHUB_CONFIG;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${JSON_SESSIONS_PATH}?ref=${branch}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
    if (res.status !== 404) {
      if (!res.ok) throw new Error(`Error llegint sessions.json: ${res.status}`);
      const payload = await res.json();
      const document = JSON.parse(base64ToUtf8(payload.content));
      if (!document || document.schema_version !== 1 || document.source !== 'suunto' || !Array.isArray(document.sessions)) {
        throw new Error('El sessions.json del repositori no té un esquema vàlid');
      }
      return { document, sha: payload.sha };
    }
    // La branca pot no tenir encara el fitxer. Continuem amb el document
    // carregat localment, que conserva l'històric, i la pujada el crearà després.
  }
  const storeDocument = window.dashboardStore?.getState?.()?.sessionsDocument;
  if (storeDocument) {
    if (storeDocument.schema_version !== 1 || storeDocument.source !== 'suunto' || !Array.isArray(storeDocument.sessions)) {
      throw new Error('El sessions.json carregat no té un esquema vàlid');
    }
    return { document: storeDocument, sha: null };
  }
  const response = await fetch(`./data/sessions.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Error llegint sessions.json local: ${response.status}`);
  const document = await response.json();
  if (!document || document.schema_version !== 1 || document.source !== 'suunto' || !Array.isArray(document.sessions)) {
    throw new Error('El sessions.json local no té un esquema vàlid');
  }
  return { document, sha: null };
}

async function pushSessionsJSONToGitHub(document, sha) {
  const { owner, repo, branch, token } = GITHUB_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${JSON_SESSIONS_PATH}`;
  const body = {
    message: `[dashboard] Afegides ${new Date().toLocaleDateString('ca-ES')} sessions via uploader`,
    content: utf8ToBase64(JSON.stringify(document, null, 2) + '\n'), branch,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Error pujant sessions.json: ${res.status} — ${error.message ?? res.statusText}`);
  }
}

function downloadSessionsJSON(sessionsDocument) {
  const blob = new Blob([JSON.stringify(sessionsDocument, null, 2) + '\n'], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'sessions.json'; link.click(); URL.revokeObjectURL(url);
}

async function appendRowsToJSON(newRows) {
  if (!newRows.length) return;
  try {
    showNotice('Llegint sessions.json actual...');
    const current = await readCurrentSessionsJSON();
    const existing = Array.isArray(current.document.sessions) ? current.document.sessions : [];
    const loadedSessions = window.dashboardStore?.getState?.()?.sessions;
    if (!existing.length && Array.isArray(loadedSessions) && loadedSessions.length) {
      throw new Error('S’ha aturat la importació: el document base no conté l’històric carregat');
    }
    const existingIds = new Set(existing.map(session => session.id));
    const duplicates = [];
    const additions = [];
    const parsedSessions = sessionDocumentFromRows(newRows);
    if (parsedSessions.length !== newRows.length) {
      throw new Error('S’ha aturat la importació: falta la conversió JSON d’una activitat');
    }
    parsedSessions.forEach(session => {
      if (existingIds.has(session.id)) duplicates.push(session.id);
      else { additions.push(session); existingIds.add(session.id); }
    });
    const document = { ...current.document, schema_version: 1, source: 'suunto', sessions: [...existing, ...additions] };
    const token = window.getGitHubToken ? window.getGitHubToken() : '';
    if (token) {
      showNotice('Pujant sessions.json al repositori...');
      await pushSessionsJSONToGitHub(document, current.sha);
      if (typeof window.refreshDashboard === 'function') await window.refreshDashboard();
      showNotice(`✅ ${additions.length} sessions afegides al repositori${duplicates.length ? ` (${duplicates.length} duplicats ignorats)` : ''}.`);
    } else {
      window.dashboardStore?.setData?.({ ...window.dashboardStore.getState(), sessions: window.DashboardDataService.normalizeSessionsJSON(document), sessionsDocument: document });
      downloadSessionsJSON(document);
      showNotice(`✅ sessions.json descarregat. ${additions.length} sessions afegides${duplicates.length ? ` (${duplicates.length} duplicats ignorats)` : ''}.`);
    }
  } catch (err) {
    console.error(err); showNotice(`❌ Error: ${err.message}`, true);
  }
}


window.addEventListener('gh-token-changed', () => {
  GITHUB_CONFIG.token = window.getGitHubToken();
});
