// docs/js/lib/fc-scale.js
// Barem de zones de FC per a badges visuals i gràfics.
//
// ─ Zones FC (llindars superiors en BPM) ──────────────────────────────────────
//
// ZONA   % FCMax ref    BPM ref (FCMax 185)   DESCRIPCIÓ          COLOR
// Z1     < 60%          < 111                 Recuperació activa  #38bdf8  blau cel
// Z2     60% – 70%      111 – 129             Aeròbic base        #22c55e  verd
// Z3     70% – 80%      130 – 148             Aeròbic moderat     #facc15  groc
// Z4     80% – 90%      149 – 166             Llindar / Tempo     #f97316  taronja
// Z5     ≥ 90%          ≥ 167                 VO2max / Sprint     #ef4444  vermell
//
// La configuració es guarda al localStorage com a BPM absoluts.
// Si no hi ha configuració guardada, es calculen des dels percentatges per defecte.
// ─────────────────────────────────────────────────────────────────────────────

// Percentatges per defecte (usats per calcular BPM inicials)
const FC_DEFAULTS = {
  fcMax : 185,
  pcts  : [0.60, 0.70, 0.80, 0.90, 1.00],  // límit superior de cada zona
};

// Metadades visuals de les zones (invariants, no configurables)
const FC_SCALE = [
  { key: 'z1', label: 'Z1 · Recuperació', cls: 'fc-z1', textDark: true  },
  { key: 'z2', label: 'Z2 · Aeròbic',     cls: 'fc-z2', textDark: false },
  { key: 'z3', label: 'Z3 · Moderat',     cls: 'fc-z3', textDark: true  },
  { key: 'z4', label: 'Z4 · Tempo',       cls: 'fc-z4', textDark: false },
  { key: 'z5', label: 'Z5 · VO2max',      cls: 'fc-z5', textDark: false },
];

const FC_CONFIG_KEY = 'suunto_fc_config';

/**
 * Calcula els BPM per defecte a partir del fcMax i els percentatges.
 * Retorna un array de 5 enters [bpmZ1, bpmZ2, bpmZ3, bpmZ4, bpmZ5].
 */
function _defaultBpms(fcMax) {
  return FC_DEFAULTS.pcts.map(pct => Math.round(fcMax * pct));
}

/**
 * Carrega la configuració FC des del localStorage.
 * Si no existeix, genera els valors per defecte i els guarda.
 * @returns {{ fcMax: number, zones: number[] }}
 */
function loadFCConfig() {
  try {
    const raw = localStorage.getItem(FC_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validació mínima: ha de tenir fcMax i un array de 5 zones
      if (
        typeof parsed.fcMax === 'number' && parsed.fcMax > 0 &&
        Array.isArray(parsed.zones) && parsed.zones.length === 5 &&
        parsed.zones.every(v => typeof v === 'number' && v > 0)
      ) {
        return parsed;
      }
    }
  } catch (_) { /* localStorage no disponible o JSON corrupte */ }

  // Fallback: valors per defecte
  const defaults = {
    fcMax : FC_DEFAULTS.fcMax,
    zones : _defaultBpms(FC_DEFAULTS.fcMax),
  };
  saveFCConfig(defaults);
  return defaults;
}

/**
 * Guarda la configuració FC al localStorage.
 * @param {{ fcMax: number, zones: number[] }} cfg
 */
function saveFCConfig(cfg) {
  try {
    localStorage.setItem(FC_CONFIG_KEY, JSON.stringify(cfg));
  } catch (_) { /* mode privat o quota excedida */ }
}

/**
 * Retorna els BPM calculats per defecte per a un fcMax donat.
 * Útil per pre-emplenar el modal de configuració.
 * @param {number} fcMax
 * @returns {number[]}
 */
function calcDefaultBpms(fcMax) {
  return _defaultBpms(fcMax);
}

// Instància activa de la configuració (carregada un cop en iniciar)
let FC_CONFIG = loadFCConfig();

/**
 * Retorna el nivell de zona FC per a un valor de bpm donat.
 * Compara contra els BPM absoluts de FC_CONFIG.zones.
 * @param {number} fc  Valor de FC en bpm
 * @returns {{ key, label, cls, textDark } | null}
 */
function getFCZone(fc) {
  if (!isFinite(fc) || fc <= 0) return null;
  for (let i = 0; i < FC_SCALE.length; i++) {
    if (fc <= FC_CONFIG.zones[i]) return FC_SCALE[i];
  }
  return FC_SCALE[FC_SCALE.length - 1];  // per sobre de Z5: retorna Z5 igualment
}

/**
 * Badge FC complet: valor en bpm amb background de color de zona.
 * @param {number} fc  Valor de FC en bpm
 * @returns {string} HTML string
 */
function fcBadgeHTML(fc) {
  const lvl = getFCZone(fc);
  const val = isFinite(fc) && fc > 0 ? `${Math.round(fc)} bpm` : '--';
  if (!lvl) return val;
  return `<span class="metric-badge metric-badge--${lvl.cls}" title="${lvl.label}">${val}</span>`;
}