// ─────────────────────────────────────────────────────────────
// activity-types.js — Font única de veritat per a tipus d'activitat
// Usat per: parser.js, app.js, overview.js (i qualsevol futur mòdul)
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
  "padel":               "PADEL",
  "tennis":              "TENNIS",
  "hiking":              "HIKING",
  "natacio":             "NATACIÓ",
  "swim":                "NATACIÓ",
  "bici_estatica_test":  "TEST_BICI",
  "bici_estatica":       "BICI ESTÀTICA",
};

// ── Classificació de sessions (dashboard) ─────────────────────
// Equivalent als Sets de app.js — font única per a totes les vistes

const QUALITY_TYPES   = new Set(["TEMPO", "INTERVALS"]);
const LONG_TYPES      = new Set(["LLARGA", "MARATÓ", "TRAIL", "MITJA", "MARATO"]);
const RUNNING_TYPES   = new Set([...QUALITY_TYPES, ...LONG_TYPES, "Z2"]);
const TEST_RACE_TYPES = new Set(["TEST", "CURSA"]);
const TEST_BICI_TYPES = new Set(["TEST_BICI"]);
const BICI_TYPES      = new Set(["BICI ESTÀTICA", "TEST_BICI"]);
const PADEL_TYPES     = new Set(["PADEL", "TENIS", "TENNIS"]);
const STRENGTH_RE     = /^FOR[\u00c7C]A/i;

// Paleta compartida per a les vistes d'activitats i planificació.
const ACTIVITY_TONE_COLORS = Object.freeze({
  test: 'var(--color-danger)',
  quality: 'var(--orange)',
  z2: 'var(--accent)',
  long: 'var(--blue)',
  strength: 'var(--purple)',
  bici: 'var(--cyan)',
  other: 'var(--yellow)',
});

function activityToneKey(value) {
  const canonical = value?.raw?.__activity || value?.__activity || {};
  const rawType = String(canonical.type || '').toLowerCase();
  const label = String(value?.tipusKey || (typeof value === 'string' ? value : '')).toUpperCase();
  if (['test', 'race'].includes(rawType) || TEST_RACE_TYPES.has(label) || TEST_BICI_TYPES.has(label)) return 'test';
  if (['long-run', 'long'].includes(rawType) || LONG_TYPES.has(label)) return 'long';
  if (rawType === 'z2' || label === 'Z2') return 'z2';
  if (rawType === 'quality' || QUALITY_TYPES.has(label)) return 'quality';
  if (rawType === 'strength' || STRENGTH_RE.test(label)) return 'strength';
  if (['cycling', 'bici'].includes(rawType) || BICI_TYPES.has(label)) return 'bici';
  return 'other';
}

function activityToneColor(value) {
  return ACTIVITY_TONE_COLORS[activityToneKey(value)] || ACTIVITY_TONE_COLORS.other;
}
