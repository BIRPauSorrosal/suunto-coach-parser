// ─────────────────────────────────────────────────────────────
// csv-writer.js — Merge de files noves al sessions.csv
// Depèn de: parser.js, uploader.js
// Modes de guardat: descàrrega local | push GitHub API
// ─────────────────────────────────────────────────────────────


// ─── CONFIGURACIÓ GITHUB API ─────────────────────────────────
const GITHUB_CONFIG = {
  owner:  "BIRPauSorrosal",
  repo:   "suunto-coach-parser",
  branch: "main",
  path:   "docs/data/sessions.csv",
  get token() { return window.getGitHubToken ? window.getGitHubToken() : ''; },
};


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
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const obj    = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? "").trim(); });
    return obj;
  });
}

/**
 * Divideix una línia CSV respectant valors entre cometes
 * (necessari per a Series_Detall que conté JSON amb comes).
 */
function splitCsvLine(line) {
  const result = [];
  let current  = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
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

    let existingRows = [];
    let sha          = null;
    const token      = window.getGitHubToken ? window.getGitHubToken() : '';
    const useGitHub  = !!token;

    if (useGitHub) {
      const { content, sha: fileSha } = await fetchCurrentCSV();
      sha          = fileSha;
      existingRows = content ? csvToObjects(content) : [];
    }

    const { merged, duplicats } = mergeRows(existingRows, newRows);

    if (duplicats.length) {
      console.warn("⚠️ Duplicats ignorats:", duplicats);
    }

    const csvText = objectsToCsv(merged);

    if (useGitHub) {
      showNotice("Pujant al repositori...");
      await pushCSVToGitHub(csvText, sha);
      showNotice(`✅ ${newRows.length - duplicats.length} sessions afegides al repositori.`);
    } else {
      downloadCSV(csvText);
      showNotice(`✅ CSV descarregat. ${duplicats.length ? `(${duplicats.length} duplicats ignorats)` : ""}`);
    }

    if (typeof loadData === "function") loadData();

  } catch (err) {
    console.error(err);
    showNotice(`❌ Error: ${err.message}`, true);
  }
}


window.addEventListener('gh-token-changed', () => {
  GITHUB_CONFIG.token = window.getGitHubToken();
});