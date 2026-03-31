// docs/js/lib/load-scale.js
// Barems de càrrega: EPOC (Firstbeat) i TSS (Coggan & Allen)
//
// ─ Barem EPOC · sessió ───────────────────────────────────────────────────────
// Mínima    < 20     load-vlow   #64748b  gris
// Baixa     20–49    load-low    #22c55e  verd
// Moderada  50–89    load-mid    #eab308  groc
// Alta      90–149   load-high   #f97316  taronja
// Molt alta ≥ 150    load-vhigh  #ef4444  vermell
//
// ─ Barem EPOC · setmanal — score = avg_epoc × sqrt(num_sessions) ─────────────
// Molt baixa  < 60   Baixa  60–99   Moderada  100–159
// Alta  160–239      Molt alta  ≥ 240
//
// ─ Barem TSS · sessió (hrTSS Suunto, ref: 100 = 1h a llindar) ───────────────
// Recuperació < 30   tss-recovery  #86efac  verd suau
// Fàcil       30–59  tss-easy      #22c55e  verd
// Moderada    60–99  tss-moderate  #facc15  groc
// Dura        100–149 tss-hard     #f97316  taronja
// Extrem      ≥ 150  tss-extreme   #ef4444  vermell
// ─────────────────────────────────────────────────────────────────────────────

// ── Funció genèrica interna ───────────────────────────────────────────────────
// Evalua un valor contra una taula de llindars i retorna el nivell corresponent.
// @param {number} val
// @param {Array<{max, key, label, cls}>} scale  ordenada de menor a major
// @returns {{ key, label, cls } | null}
function _evalScale(val, scale) {
  if (!isFinite(val) || val <= 0) return null;
  for (const tier of scale) {
    if (val < tier.max) return { key: tier.key, label: tier.label, cls: tier.cls };
  }
  return scale[scale.length - 1];
}

// ── Funció genèrica de badge ──────────────────────────────────────────────────
// Genera un <span class="metric-badge metric-badge--{cls}"> amb el valor formatat.
// @param {string} displayVal  Text ja formatat a mostrar
// @param {{ key, label, cls } | null} lvl
// @returns {string} HTML string
function _badgeHTML(displayVal, lvl) {
  if (!lvl) return displayVal;
  return `<span class="metric-badge metric-badge--${lvl.cls}" title="${lvl.label}">${displayVal}</span>`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// BAREM EPOC
// ═══════════════════════════════════════════════════════════════════════════════

const EPOC_SCALE = [
  { max:  20, key: 'vlow',  label: 'Mínima',    cls: 'load-vlow'  },
  { max:  50, key: 'low',   label: 'Baixa',     cls: 'load-low'   },
  { max:  90, key: 'mid',   label: 'Moderada',  cls: 'load-mid'   },
  { max: 150, key: 'high',  label: 'Alta',      cls: 'load-high'  },
  { max: Infinity, key: 'vhigh', label: 'Molt alta', cls: 'load-vhigh' },
];

function getLoadLevelSession(epoc) {
  return _evalScale(epoc, EPOC_SCALE);
}

function getLoadLevelWeekly(epocTotal, numSessions) {
  const count = numSessions > 0 ? numSessions : 0;
  const avg   = count > 0 && isFinite(epocTotal) && epocTotal > 0 ? epocTotal / count : 0;
  const score = avg * Math.sqrt(count);

  const WEEKLY_SCALE = [
    { max:  60, key: 'vlow',  label: 'Molt baixa', cls: 'load-vlow'  },
    { max: 100, key: 'low',   label: 'Baixa',      cls: 'load-low'   },
    { max: 160, key: 'mid',   label: 'Moderada',   cls: 'load-mid'   },
    { max: 240, key: 'high',  label: 'Alta',       cls: 'load-high'  },
    { max: Infinity, key: 'vhigh', label: 'Molt alta', cls: 'load-vhigh' },
  ];
  const level = score <= 0 ? WEEKLY_SCALE[0] : _evalScale(score, WEEKLY_SCALE);
  return { ...level, score: Math.round(score), avg, total: epocTotal, count };
}

function loadBadgeHTML(epoc) {
  const lvl = getLoadLevelSession(epoc);
  const val = (typeof formatMetric === 'function') ? formatMetric(epoc, '') : String(epoc || '--');
  return _badgeHTML(val, lvl);
}


// ═══════════════════════════════════════════════════════════════════════════════
// BAREM TSS
// ═══════════════════════════════════════════════════════════════════════════════

const TSS_SCALE = [
  { max:  30, key: 'recovery', label: 'Recuperació', cls: 'tss-recovery' },
  { max:  60, key: 'easy',     label: 'Fàcil',       cls: 'tss-easy'     },
  { max: 100, key: 'moderate', label: 'Moderada',    cls: 'tss-moderate' },
  { max: 150, key: 'hard',     label: 'Dura',        cls: 'tss-hard'     },
  { max: Infinity, key: 'extreme', label: 'Extrem',  cls: 'tss-extreme'  },
];

function getTSSLevel(tss) {
  return _evalScale(tss, TSS_SCALE);
}

function tssDotHTML(tss) {
  const lvl = getTSSLevel(tss);
  const val = (typeof fmtNum === 'function') ? fmtNum(tss) : String(tss || '--');
  return _badgeHTML(val, lvl);
}