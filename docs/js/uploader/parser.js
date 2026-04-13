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

// ─── FIX: recalcula mètriques d'un interval des dels Samples ──────────────
// Quan els Windows de Suunto no porten SpeedAvg/HRAvg/CadenceAvg (valor 0),
// creuem el rang temporal del Window amb els Samples per calcular-les.
//
// samples:    array de Samples del DeviceLog (cada un té TimeISO8601 + mètriques)
// startIso:   string ISO8601 de l'inici del Window  (camp "StartTime")
// durationS:  durada en segons del Window           (camp "Duration")
//
// Retorna { speedAvg, hrAvg, hrMax, cadenceAvg } en unitats natives (m/s, Hz).
function enrichFromSamples(samples, startIso, durationS) {
  if (!startIso || !durationS) return { speedAvg: 0, hrAvg: 0, hrMax: 0, cadenceAvg: 0 };

  const t0 = new Date(startIso).getTime();
  const t1 = t0 + durationS * 1000;

  // Cada Sample pot tenir TimeISO8601 (string) o un offset en ms (número).
  // El JSON Suunto usa la clau "TimeISO8601" al Sample.
  const inRange = samples.filter(s => {
    const ts = s.TimeISO8601 ? new Date(s.TimeISO8601).getTime() : null;
    return ts !== null && ts >= t0 && ts <= t1;
  });

  const speeds    = inRange.filter(s => s.Speed    != null && s.Speed    > 0).map(s => s.Speed);
  const hrs       = inRange.filter(s => s.HR       != null && s.HR       > 0).map(s => s.HR);
  const cadences  = inRange.filter(s => s.Cadence  != null && s.Cadence  > 0).map(s => s.Cadence);

  const speedAvg   = speeds.length   ? speeds.reduce((a,b)=>a+b,0)   / speeds.length   : 0;
  const hrAvg      = hrs.length      ? hrs.reduce((a,b)=>a+b,0)      / hrs.length      : 0;
  const hrMax      = hrs.length      ? Math.max(...hrs)                                 : 0;
  const cadenceAvg = cadences.length ? cadences.reduce((a,b)=>a+b,0) / cadences.length : 0;

  return { speedAvg, hrAvg, hrMax, cadenceAvg };
}

function parseQuality(filename, data) {
  const row     = parseRunningBase(filename, data);
  const windows = data?.DeviceLog?.Windows ?? [];
  const samples = data?.DeviceLog?.Samples ?? [];
  const nameLower = filename.toLowerCase();

  row.Tipus = Object.entries(ACTIVITY_QUALITY_TYPES).find(
    ([k]) => nameLower.includes(k)
  )?.[1] ?? "QUALITAT";

  // ── Extreu intervals bruts dels Windows de tipus "Interval" ──────────────
  // L'estructura real del JSON Suunto té els camps directament a l'arrel
  // de cada Window: SpeedAvg, HRAvg, HRMax, CadenceAvg (no dins sub-arrays).
  // Exemple: { Type:"Interval", Duration:600, SpeedAvg:2.865, HRAvg:2.825, ... }
  //
  // FIX: Alguns dispositius Suunto no poblen SpeedAvg/HRAvg/CadenceAvg als Windows.
  // En aquest cas (valor 0 o absent), recalculem des dels Samples individuals
  // creuant el rang temporal [StartTime, StartTime + Duration].
  const rawIntervals = windows
    .map(w => w.Window ?? w)
    .filter(w => w.Type === "Interval")
    .map(w => {
      const dur     = w.Duration   ?? 0;
      let speed     = w.SpeedAvg   ?? 0;
      let hrAvg     = w.HRAvg      ?? 0;
      let hrMax     = w.HRMax      ?? 0;
      let cadence   = w.CadenceAvg ?? 0;

      // Si les mètriques agregades del Window estan buides, les recalculem
      // des dels Samples individuals per rang de temps.
      if ((speed === 0 || hrAvg === 0) && samples.length > 0 && w.StartTime) {
        const enriched = enrichFromSamples(samples, w.StartTime, dur);
        if (speed   === 0) speed   = enriched.speedAvg;
        if (hrAvg   === 0) hrAvg   = enriched.hrAvg;
        if (hrMax   === 0) hrMax   = enriched.hrMax;
        if (cadence === 0) cadence = enriched.cadenceAvg;
      }

      return {
        dur_s:    dur,
        dist_m:   Math.round(w.Distance ?? 0),
        dur_min:  Math.round((dur / 60) * 10) / 10,
        ritme:    msTominkm(speed),
        fc_mitja: Math.round(hrAvg * 60),
        fc_max:   Math.round((hrMax || hrAvg) * 60),
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
