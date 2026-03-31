// ─────────────────────────────────────────────────────────────
// uploader.js — Lògica de File API, validació i coordinació
// Depèn de: parser.js, csv-writer.js
// NO conté cap manipulació del DOM ni render
// ─────────────────────────────────────────────────────────────


// ─── CONSTANTS DE VALIDACIÓ ──────────────────────────────────

const SUUNTO_HEADER_KEYS = ["DateTime", "Duration"];


// ─── ESTAT INTERN ────────────────────────────────────────────

// Files parsejades pendents de confirmar per l'usuari
let _pendingRows = [];

function getPendingRows()   { return _pendingRows; }
function clearPendingRows() { _pendingRows = []; }


// ─── VALIDACIÓ ───────────────────────────────────────────────

/**
 * Comprova que un objecte JSON té l'estructura mínima de Suunto.
 * Retorna { valid: bool, error: string|null }
 */
function validateSuuntoJson(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "No és un objecte JSON vàlid." };
  }
  if (!data.DeviceLog) {
    return { valid: false, error: "Falta la clau arrel 'DeviceLog'." };
  }
  if (!data.DeviceLog.Header) {
    return { valid: false, error: "Falta 'DeviceLog.Header'." };
  }
  if (!data.DeviceLog.Samples) {
    return { valid: false, error: "Falta 'DeviceLog.Samples'." };
  }
  for (const key of SUUNTO_HEADER_KEYS) {
    if (!(key in data.DeviceLog.Header)) {
      return { valid: false, error: `Falta el camp '${key}' al Header.` };
    }
  }
  return { valid: true, error: null };
}


// ─── LECTURA DE FITXERS ──────────────────────────────────────

/**
 * Llegeix un File com a text. Retorna Promise<string>.
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Error llegint ${file.name}`));
    reader.readAsText(file, "utf-8");
  });
}

/**
 * Processa un array de File objects:
 *   1. Comprova extensió .json
 *   2. Llegeix contingut
 *   3. Valida estructura Suunto
 *   4. Detecta parser i parseja
 *
 * Retorna { ok: [{ name, row }], errors: [{ name, reason }] }
 */
async function processFiles(files) {
  const ok     = [];
  const errors = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      errors.push({ name: file.name, reason: "No és un fitxer .json." });
      continue;
    }

    let raw;
    try {
      raw = await readFileAsText(file);
    } catch (e) {
      errors.push({ name: file.name, reason: e.message });
      continue;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      errors.push({ name: file.name, reason: "JSON malformat, no es pot parsejar." });
      continue;
    }

    const validation = validateSuuntoJson(data);
    if (!validation.valid) {
      errors.push({ name: file.name, reason: validation.error });
      continue;
    }

    const parserFn = detectParser(file.name);   // definit a parser.js
    if (!parserFn) {
      errors.push({
        name: file.name,
        reason: "Tipus no reconegut. Paraules clau esperades: z2, tempo, intervals, llarga, trail, marat, força, padel...",
      });
      continue;
    }

    const row = parseSuuntoFile(file.name, data);  // definit a parser.js
    ok.push({ name: file.name, row });
  }

  return { ok, errors };
}


// ─── COORDINADOR PRINCIPAL ───────────────────────────────────

/**
 * Punt d'entrada cridat per uploader-ui.js quan l'usuari
 * selecciona o arrossega fitxers.
 * Processa, desa l'estat intern i notifica la UI via callback.
 *
 * @param {File[]}   files      — fitxers seleccionats
 * @param {Function} onDone     — callback(ok, errors) per actualitzar la UI
 */
async function handleFileSelection(files, onDone) {
  if (!files.length) return;
  const { ok, errors } = await processFiles(files);
  _pendingRows = ok.map(f => f.row);
  onDone(ok, errors);
}

/**
 * Punt d'entrada cridat per uploader-ui.js quan l'usuari confirma.
 * Delega a csv-writer.js i neteja l'estat intern.
 *
 * @param {Function} onComplete — callback() quan acaba (per tancar modal, etc.)
 */
async function confirmImport(onComplete) {
  if (!_pendingRows.length) return;
  await appendRowsToCSV(_pendingRows);   // definit a csv-writer.js
  _pendingRows = [];
  onComplete();
}