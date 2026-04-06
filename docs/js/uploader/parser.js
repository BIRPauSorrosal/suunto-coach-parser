// ─────────────────────────────────────────────────────────────
// parser.js — Traducció JS dels parsers Python de Suunto Coach
// Estructura mirall de src/parsers/ — NO modificar sense actualitzar
// el Python equivalent.
// ─────────────────────────────────────────────────────────────


// ─── HELPERS (equivalents a src/utils/helpers.py) ────────────

function msTominkm(speedMs) {
  if (!speedMs || speedMs <= 0) return 0.0;
  return Math.round((1000 / (speedMs * 60)) * 100) / 100;
}

function hzToSpm(cadenceHz) {
  if (!cadenceHz || cadenceHz <= 0) return 0;
  return Math.round(cadenceHz * 60 * 2);
}


// ─── PARSER REGISTRY (equivalent a main.py PARSER_REGISTRY) ──

const PARSER_REGISTRY = {
  "z2":            parseRunningBase,
  "tempo":         parseQuality,
  "test":          parseQuality,
  "intervals":     parseQuality,
  "llarga":        parseLongRun,
  "longrun":       parseLongRun,
  "marat":         parseLongRun,
  "trail":         parseLongRun,
  "mitja":         parseLongRun,
  "cursa":         parseLongRun,
  "força":         parseStrength,
  "forca":         parseStrength,   // fallback sense accent
  "bici_estatica": parseGeneric,
  "padel":         parseGeneric,
  "tennis":        parseGeneric,
  "hiking":        parseGeneric,
  "natacio":       parseGeneric,
  "swim":          parseGeneric,
};

// Detecta quina funció parser cal usar pel nom de fitxer
function detectParser(filename) {
  const nameLower = filename.toLowerCase().replace(".json", "");
  for (const [keyword, parserFn] of Object.entries(PARSER_REGISTRY)) {
    if (nameLower.includes(keyword)) return parserFn;
  }
  return null;
}


// ─── BASE PARSER (equivalent a base_parser.py) ───────────────

function parseBase(filename, data) {
  const header  = data?.DeviceLog?.Header  ?? {};
  const samples = data?.DeviceLog?.Samples ?? [];
  const zones   = header.HrZones ?? {};

  // FC ve en Hz (batecs/segon), cal × 60 per obtenir bpm
  const hrList = samples
    .filter(s => s.HR != null)
    .map(s => s.HR);

  const fcMitja = hrList.length
    ? Math.round((hrList.reduce((a, b) => a + b, 0) / hrList.length) * 60)
    : 0;
  const fcMax = hrList.length
    ? Math.round(Math.max(...hrList) * 60)
    : 0;

  // Data: ISO → dd/mm/yyyy
  let dataFormatada = "";
  if (header.DateTime) {
    const dt = new Date(header.DateTime);
    const d  = String(dt.getDate()).padStart(2, "0");
    const m  = String(dt.getMonth() + 1).padStart(2, "0");
    const y  = dt.getFullYear();
    dataFormatada = `${d}/${m}/${y}`;
  }

  return {
    Arxiu:           filename.replace(".json", ""),
    Data:            dataFormatada,
    Tipus:           "",   // sobreescrit pel parser específic
    "Durada(min)":   Math.round(((header.Duration ?? 0) / 60) * 10) / 10,
    "Dist(km)":      Math.round(((header.Distance ?? 0) / 1000) * 100) / 100,
    "Desnivell(m)":  Math.round(header.Ascent ?? 0),
    FCMitja:         fcMitja,
    FCMax:           fcMax,
    "Z1(min)":       Math.round(((zones.Zone1Duration ?? 0) / 60) * 10) / 10,
    "Z2(min)":       Math.round(((zones.Zone2Duration ?? 0) / 60) * 10) / 10,
    "Z3(min)":       Math.round(((zones.Zone3Duration ?? 0) / 60) * 10) / 10,
    "Z4(min)":       Math.round(((zones.Zone4Duration ?? 0) / 60) * 10) / 10,
    "Z5(min)":       Math.round(((zones.Zone5Duration ?? 0) / 60) * 10) / 10,
    PTE:             header.PeakTrainingEffect ?? 0,
    EPOC:            Math.round((header.EPOC ?? 0) * 10) / 10,
    Carrega:         Math.round((header.TraingingLoadPeak ?? 0) * 10) / 10,
    Calories:        Math.round((header.Energy ?? 0) / 4184),
    "Recup(h)":      Math.round(((header.RecoveryTime ?? 0) / 3600) * 10) / 10,
  };
}


// ─── BASE RUNNING PARSER (equivalent a base_running_parser.py) 

function parseRunningBase(filename, data) {
  const row     = parseBase(filename, data);
  const samples = data?.DeviceLog?.Samples ?? [];

  const speedList = samples
    .filter(s => s.Speed != null && s.Speed > 0)
    .map(s => s.Speed);

  const cadenceList = samples
    .filter(s => s.Cadence != null && s.Cadence > 0)
    .map(s => s.Cadence);

  row["Ritme(min/km)"] = speedList.length
    ? msTominkm(speedList.reduce((a, b) => a + b, 0) / speedList.length)
    : 0.0;

  row["Cadencia(spm)"] = cadenceList.length
    ? hzToSpm(cadenceList.reduce((a, b) => a + b, 0) / cadenceList.length)
    : 0;

  row.Tipus = "Z2";
  return row;
}


// ─── LONG RUN PARSER (equivalent a long_run_parser.py) ────────
function parseLongRun(filename, data) {
  const row      = parseRunningBase(filename, data);
  const nameLower = filename.toLowerCase();
  row.Tipus = Object.entries(ACTIVITY_LONG_RUN_TYPES).find(
    ([k]) => nameLower.includes(k)
  )?.[1] ?? "LLARGA";
  return row;
}


// ─── QUALITY PARSER (equivalent a quality_parser.py) ──────────

// Un interval es considera "recuperació" si dura menys d'aquest llindar (en segons)
const RECUPERACIO_MAX_DURADA = 210;
// Factor FC per distingir sèries de recuperacions quan totes superen RECUPERACIO_MAX_DURADA
const RECUPERACIO_FC_FACTOR  = 0.82;

function stdDev(arr) {
  if (arr.length < 2) return 0.0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

function avgArr(arr) {
  if (!arr.length) return 0.0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

function parseQuality(filename, data) {
  const row     = parseRunningBase(filename, data);
  const windows = data?.DeviceLog?.Windows ?? [];
  const nameLower = filename.toLowerCase();

  row.Tipus = Object.entries(ACTIVITY_QUALITY_TYPES).find(
    ([k]) => nameLower.includes(k)
  )?.[1] ?? "QUALITAT";

  // ── Extreu intervals bruts dels Windows de tipus "Interval" ──────────────
  // L'estructura real del JSON Suunto té els camps directament a l'arrel
  // de cada Window: SpeedAvg, HRAvg, HRMax, CadenceAvg (no dins sub-arrays).
  // Exemple: { Type:"Interval", Duration:600, SpeedAvg:2.865, HRAvg:2.825, ... }
  const rawIntervals = windows
    .map(w => w.Window ?? w)
    .filter(w => w.Type === "Interval")
    .map(w => {
      const dur     = w.Duration   ?? 0;
      const speed   = w.SpeedAvg   ?? 0;   // m/s directe a l'arrel
      const hrAvg   = w.HRAvg      ?? 0;   // Hz directe a l'arrel (× 60 = bpm)
      const hrMax   = w.HRMax      ?? hrAvg;
      const cadence = w.CadenceAvg ?? 0;   // Hz directe a l'arrel
      return {
        dur_s:    dur,
        dist_m:   Math.round(w.Distance ?? 0),
        dur_min:  Math.round((dur / 60) * 10) / 10,
        ritme:    msTominkm(speed),
        fc_mitja: Math.round(hrAvg * 60),
        fc_max:   Math.round(hrMax * 60),
        cadencia: hzToSpm(cadence),
      };
    });

  // ── Lògica 2 passades: separa sèries de recuperacions ────────────────────
  // Passada 1: intenta separar per durada (sèrie > RECUPERACIO_MAX_DURADA s)
  const intervalsLlargs = rawIntervals.filter(iv => iv.dur_s > RECUPERACIO_MAX_DURADA);

  // Passada 2: si tots els intervals són llargs (ex: TEMPO sense recuperació curta),
  // distingeix sèries de recuperacions per FC (les de FC alta = sèries)
  const fcMaxGlobal = Math.max(...rawIntervals.map(iv => iv.fc_max), 0);
  const llindatFC   = Math.round(fcMaxGlobal * RECUPERACIO_FC_FACTOR);

  let series;
  if (intervalsLlargs.length > 0) {
    // Cas normal: INTERVALS amb recuperació curta
    series = intervalsLlargs.filter(iv => iv.fc_mitja > llindatFC);
    if (series.length === 0) series = intervalsLlargs; // fallback: totes les llargues
  } else {
    // Cas TEMPO o intervals sense recuperació explícita: tots els intervals
    series = rawIntervals.filter(iv => iv.fc_mitja > llindatFC);
    if (series.length === 0) series = rawIntervals; // fallback: tot
  }

  series = series.map((s, i) => ({ ...s, serie: i + 1 }));

  // ── Extreu recuperacions: intervals curts entre sèries ────────────────────
  // Cada recuperació és el Window de tipus "Interval" entre dues sèries
  const recuperacions = rawIntervals.filter(
    iv => iv.dur_s > 0 && iv.dur_s <= RECUPERACIO_MAX_DURADA
  );

  const recMitjaMin = recuperacions.length
    ? avgArr(recuperacions.map(r => r.dur_min).filter(v => v > 0))
    : 0;

  // ── Elimina dur_s del detall final (igual que el Python) ─────────────────
  const seriesDetall = series.map(({ dur_s, ...rest }) => rest);

  // ── Omple la fila de sortida ───────────────────────────────────────────────
  row.Num_Series            = series.length;
  row.Durada_Mitja_Series   = avgArr(series.map(s => s.dur_min).filter(v => v > 0));
  row.Rec_Mitja_Min         = recMitjaMin;
  row.Ritme_Mitja_Series    = avgArr(series.map(s => s.ritme).filter(v => v > 0));
  row.Consistencia_Ritme    = stdDev(series.map(s => s.ritme).filter(v => v > 0));
  row.FC_Mitja_Series       = avgArr(series.map(s => s.fc_mitja).filter(v => v > 0));
  row.FC_Max_Mitja_Series   = avgArr(series.map(s => s.fc_max).filter(v => v > 0));
  row.Cadencia_Mitja_Series = avgArr(series.map(s => s.cadencia).filter(v => v > 0));
  row.Series_Detall         = JSON.stringify(seriesDetall);

  return row;
}


// ─── STRENGTH PARSER (equivalent a strength_parser.py) ────────

function parseStrength(filename, data) {
  const row  = parseBase(filename, data);
  const name = filename.replace(".json", "");
  const match = name.match(/[Ss](\d+)/);
  const code  = match ? `S${match[1]}` : "";
  row.Tipus = `FORÇA ${code}`.trim();
  return row;
}


// ─── GENERIC PARSER (equivalent a generic_parser.py) ──────────
function parseGeneric(filename, data) {
  const row      = parseBase(filename, data);
  const nameLower = filename.toLowerCase();
  row.Tipus = Object.entries(ACTIVITY_GENERIC_TYPES).find(
    ([k]) => nameLower.includes(k)
  )?.[1] ?? "ALTRES";
  return row;
}


// ─── PUNT D'ENTRADA PÚBLIC ────────────────────────────────────

/**
 * Parseja un fitxer JSON de Suunto i retorna un objecte amb
 * totes les columnes del sessions.csv.
 *
 * @param {string} filename  - Nom del fitxer (ex: "260323_running_z2.json")
 * @param {object} jsonData  - Contingut JSON ja parsejat (JSON.parse)
 * @returns {object|null}    - Fila CSV o null si el parser no és detectat
 */
function parseSuuntoFile(filename, jsonData) {
  const parserFn = detectParser(filename);
  if (!parserFn) return null;
  return parserFn(filename, jsonData);
}
