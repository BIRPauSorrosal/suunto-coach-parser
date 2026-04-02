// ─────────────────────────────────────────────────────────────
// planning-uploader.js — Lògica de File API, validació i merge
// Depèn de: (cap — standalone)
// NO conté cap manipulació del DOM ni render
// ─────────────────────────────────────────────────────────────


// ─── COLUMNES OBLIGATÒRIES ───────────────────────────────────

// Llista exhaustiva de columnes que ha de tenir qualsevol
// planning.csv vàlid. Permet detectar fitxers incomplets o
// de format incorrecte abans de fer cap merge.
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

// Resultat del merge pendent de confirmació per l'usuari.
// Forma: { rows: [], stats: { added, replaced, unchanged } }
let _pendingMerge = null;

function getPendingMerge()   { return _pendingMerge; }
function clearPendingMerge() { _pendingMerge = null; }


// ─── PARSING CSV ─────────────────────────────────────────────

/**
 * Parseja un string CSV amb capçalera i retorna un array
 * d'objectes { columna: valor }.
 * Separador: punt i coma (;). Ignora files buides.
 *
 * @param {string} text — contingut del fitxer CSV
 * @returns {Object[]}
 */
function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(";");
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  });
}


// ─── VALIDACIÓ DE COLUMNES ───────────────────────────────────

/**
 * Comprova que el CSV conté totes les columnes obligatòries.
 * Retorna { valid: bool, missing: string[] }
 *
 * @param {Object[]} rows — files parsejades del CSV entrant
 */
function validatePlanningColumns(rows) {
  if (!rows.length) {
    return { valid: false, missing: [], error: "El fitxer és buit o no té files de dades." };
  }
  const present = Object.keys(rows[0]);
  const missing = PLANNING_REQUIRED_COLUMNS.filter(c => !present.includes(c));
  return { valid: missing.length === 0, missing };
}


// ─── MERGE (UPSERT PER SETMANA) ──────────────────────────────

/**
 * Fusiona les files entrants amb les existents.
 * Clau de deduplicació: columna `Setmana`.
 *
 * Escenaris coberts:
 *   a) Setmana nova      → s'afegeix
 *   b) Setmana existent  → se substitueix
 *   c) Combinació de (a) i (b)
 *
 * Retorna:
 *   {
 *     rows:  Object[],   // planning complet resultant, ordenat per Data_Inici
 *     stats: { added: number, replaced: number, unchanged: number },
 *     incoming: { row: Object, status: 'added'|'replaced'|'unchanged' }[]
 *   }
 *
 * @param {Object[]} existing — files del planning.csv actual
 * @param {Object[]} incoming — files del CSV nou pujat per l'usuari
 */
function mergePlanning(existing, incoming) {
  // Mapa indexat per Setmana per a cerca O(1)
  const map = new Map();
  existing.forEach(row => map.set(row.Setmana, row));

  const stats    = { added: 0, replaced: 0, unchanged: 0 };
  const incomingAnnotated = [];

  for (const row of incoming) {
    const key = row.Setmana;
    if (!map.has(key)) {
      // Escenari a: setmana nova
      map.set(key, row);
      stats.added++;
      incomingAnnotated.push({ row, status: "added" });
    } else {
      const existing = map.get(key);
      // Comprovem si la fila és idèntica per marcar-la com unchanged
      const isIdentical = JSON.stringify(existing) === JSON.stringify(row);
      if (isIdentical) {
        stats.unchanged++;
        incomingAnnotated.push({ row, status: "unchanged" });
      } else {
        // Escenari b: mateixa setmana, contingut diferent → substituir
        map.set(key, row);
        stats.replaced++;
        incomingAnnotated.push({ row, status: "replaced" });
      }
    }
  }

  // Ordenar el resultat final per Data_Inici ascendent
  const rows = Array.from(map.values()).sort((a, b) => {
    return (a.Data_Inici ?? "").localeCompare(b.Data_Inici ?? "");
  });

  return { rows, stats, incoming: incomingAnnotated };
}


// ─── SERIALITZACIÓ CSV ───────────────────────────────────────

/**
 * Converteix un array d'objectes a string CSV (separador ;)
 * amb les columnes en l'ordre de PLANNING_REQUIRED_COLUMNS.
 *
 * @param {Object[]} rows
 * @returns {string}
 */
function serializePlanningCSV(rows) {
  if (!rows.length) return PLANNING_REQUIRED_COLUMNS.join(";") + "\n";
  const header = PLANNING_REQUIRED_COLUMNS.join(";");
  const lines  = rows.map(row =>
    PLANNING_REQUIRED_COLUMNS.map(col => row[col] ?? "").join(";")
  );
  return [header, ...lines].join("\n") + "\n";
}


// ─── LECTURA DE FITXERS ──────────────────────────────────────

/**
 * Llegeix un File com a text UTF-8. Retorna Promise<string>.
 */
function readPlanningFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Error llegint ${file.name}`));
    reader.readAsText(file, "utf-8");
  });
}


// ─── COORDINADOR PRINCIPAL ───────────────────────────────────

/**
 * Punt d'entrada cridat per planning-uploader-ui.js quan l'usuari
 * selecciona un fitxer CSV de planning.
 *
 * Flux:
 *   1. Valida extensió .csv
 *   2. Llegeix el contingut
 *   3. Parseja les files
 *   4. Valida columnes obligatòries
 *   5. Obté el planning actual (window.planningData, injectat per app.js)
 *   6. Fa el merge
 *   7. Desa l'estat intern i notifica la UI via onDone
 *
 * @param {File}     file    — fitxer CSV seleccionat
 * @param {Function} onDone  — callback({ ok, error, merge }) per actualitzar la UI
 */
async function handlePlanningFileSelection(file, onDone) {
  if (!file) return;

  // 1. Extensió
  if (!file.name.toLowerCase().endsWith(".csv")) {
    onDone({ ok: false, error: "El fitxer ha de tenir extensió .csv." });
    return;
  }

  // 2. Lectura
  let text;
  try {
    text = await readPlanningFileAsText(file);
  } catch (e) {
    onDone({ ok: false, error: e.message });
    return;
  }

  // 3. Parsing
  const incoming = parseCSVText(text);

  // 4. Validació de columnes
  const validation = validatePlanningColumns(incoming);
  if (!validation.valid) {
    const msg = validation.error
      ?? `Columnes que falten: ${validation.missing.join(", ")}`;
    onDone({ ok: false, error: msg });
    return;
  }

  // 5. Planning actual (pot ser buit si encara no s'ha carregat)
  const existing = Array.isArray(window.planningData) ? window.planningData : [];

  // 6. Merge
  const merge = mergePlanning(existing, incoming);

  // 7. Desar estat intern
  _pendingMerge = merge;

  onDone({ ok: true, error: null, merge });
}


/**
 * Punt d'entrada cridat per planning-uploader-ui.js quan l'usuari
 * confirma el merge. Genera el CSV resultant i el descarrega.
 *
 * @param {Function} onComplete — callback() quan acaba (per tancar modal, etc.)
 */
function confirmPlanningImport(onComplete) {
  if (!_pendingMerge) return;

  const csv = serializePlanningCSV(_pendingMerge.rows);

  // Descarrega el fitxer resultant
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "planning.csv";
  a.click();
  URL.revokeObjectURL(url);

  // Actualitzar les dades en memòria perquè el dashboard reflecteixi
  // el planning merged sense necessitat de recarregar la pàgina
  if (window.planningData !== undefined) {
    window.planningData = _pendingMerge.rows;
  }

  _pendingMerge = null;
  onComplete();
}
