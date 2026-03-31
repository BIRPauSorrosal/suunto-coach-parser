// ─────────────────────────────────────────────────────────────
// activity-types.js — Font única de veritat per a tipus d'activitat
// Usat per: parser.js, app.js (i qualsevol futur mòdul)
// ─────────────────────────────────────────────────────────────

// ── Detecció de tipus per nom de fitxer (parser) ──────────────

const ACTIVITY_QUALITY_TYPES = {
  "tempo":     "TEMPO",
  "test":      "TEST",
  "intervals": "INTERVALS",
};

const ACTIVITY_LONG_RUN_TYPES = {
  "llarga":  "LLARGA",
  "longrun": "LLARGA",
  "marat":   "MARATÓ",
  "trail":   "TRAIL",
  "mitja":   "MITJA",
  "cursa":   "CURSA",
};

const ACTIVITY_GENERIC_TYPES = {
  "padel":          "PADEL",
  "tennis":         "TENNIS",
  "hiking":         "HIKING",
  "natacio":        "NATACIÓ",
  "swim":           "NATACIÓ",
  "bici_estatica":  "BICI ESTÀTICA",
};

// ── Classificació de sessions (dashboard) ─────────────────────
// Equivalent als Sets de app.js — font única per a totes les vistes

const QUALITY_TYPES   = new Set(["TEMPO", "INTERVALS"]);
const LONG_TYPES      = new Set(["LLARGA", "MARATÓ", "TRAIL", "MITJA", "MARATO"]);
const RUNNING_TYPES   = new Set([...QUALITY_TYPES, ...LONG_TYPES, "Z2"]);
const TEST_RACE_TYPES = new Set(["TEST", "CURSA"]);
const PADEL_TYPES     = new Set(["PADEL", "TENIS", "TENNIS"]);
const STRENGTH_RE     = /^FOR[\u00c7C]A/i;