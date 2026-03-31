// docs/js/lib/fc-scale.js
// Barem de zones de FC per a badges visuals.
// Els llindars són relatius a FCMax (% de la freqüència cardíaca màxima).
// Colors extrets de CHART_COLORS.zones (charts.js) per consistència visual.
//
// ─ Zones FC (llindars per defecte) ───────────────────────────────────────────
//
// ZONA   % FCMax        BPM ref (FCMax 185)   DESCRIPCIÓ          COLOR
// Z1     < 60%          < 111                 Recuperació activa  #38bdf8  blau cel
// Z2     60% – 70%      111 – 129             Aeròbic base        #22c55e  verd
// Z3     70% – 80%      130 – 148             Aeròbic moderat     #facc15  groc
// Z4     80% – 90%      149 – 166             Llindar / Tempo     #f97316  taronja
// Z5     ≥ 90%          ≥ 167                 VO2max / Sprint     #ef4444  vermell
//
// NOTA: FC_CONFIG.fcMax és modificable per l'usuari (futura configuració).
// ─────────────────────────────────────────────────────────────────────────────

const FC_CONFIG = {
  fcMax: 185,   // ← valor per defecte, futura configuració d'usuari
};

const FC_SCALE = [
  { pct: 0.60, key: 'z1', label: 'Z1 · Recuperació', cls: 'fc-z1', textDark: true  },
  { pct: 0.70, key: 'z2', label: 'Z2 · Aeròbic',     cls: 'fc-z2', textDark: false },
  { pct: 0.80, key: 'z3', label: 'Z3 · Moderat',     cls: 'fc-z3', textDark: true  },
  { pct: 0.90, key: 'z4', label: 'Z4 · Tempo',       cls: 'fc-z4', textDark: false },
  { pct: 1.00, key: 'z5', label: 'Z5 · VO2max',      cls: 'fc-z5', textDark: false },
];

/**
 * Retorna el nivell de zona FC per a un valor de bpm donat.
 * @param {number} fc     Valor de FC en bpm
 * @param {number} [fcMax]  FCMax opcional (sobreescriu FC_CONFIG.fcMax)
 * @returns {{ key, label, cls, textDark } | null}
 */
function getFCZone(fc, fcMax) {
  if (!isFinite(fc) || fc <= 0) return null;
  const max = (isFinite(fcMax) && fcMax > 0) ? fcMax : FC_CONFIG.fcMax;
  const pct = fc / max;
  for (const tier of FC_SCALE) {
    if (pct < tier.pct) return { key: tier.key, label: tier.label, cls: tier.cls, textDark: tier.textDark };
  }
  return FC_SCALE[FC_SCALE.length - 1];  // Z5
}

/**
 * Badge FC complet: valor en bpm amb background de color de zona.
 * @param {number} fc     Valor de FC en bpm
 * @param {number} [fcMax]  FCMax opcional
 * @returns {string} HTML string
 */
function fcBadgeHTML(fc, fcMax) {
  const lvl = getFCZone(fc, fcMax);
  const val = isFinite(fc) && fc > 0 ? `${Math.round(fc)} bpm` : '--';
  if (!lvl) return val;
  return `<span class="metric-badge metric-badge--${lvl.cls}" title="${lvl.label}">${val}</span>`;
}