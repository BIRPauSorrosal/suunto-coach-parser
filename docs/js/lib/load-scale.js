// docs/js/lib/load-scale.js
// Lògica de barems de càrrega:
//   · EPOC (model Firstbeat) — per a intensitat fisiològica
//   · TSS  (model Coggan)    — per a càrrega de sessió/setmana
//
// ─ Barem EPOC · sessió individual ────────────────────────────────────────────
//
// NIVELL       EPOC sessió    CLASSE CSS
// Mínima       < 20           load-vlow
// Baixa        20 – 49        load-low
// Moderada     50 – 89        load-mid
// Alta         90 – 149       load-high
// Molt alta    ≥ 150          load-vhigh
//
// ─ Barem EPOC · setmanal (score combinat) ─────────────────────────────────────
//
// score = avg_epoc × sqrt(num_sessions)
//
// NIVELL       SCORE
// Molt baixa   < 60
// Baixa        60 – 99
// Moderada     100 – 159
// Alta         160 – 239
// Molt alta    ≥ 240
//
// ─ Barem TSS · sessió individual ─────────────────────────────────────────────
//
// Referència: 1h a llindar (LTHR/FTP) = 100 TSS  (Coggan & Allen)
// Ajustat per hrTSS de Suunto (lleugerament inferior al TSS de potència)
//
// NIVELL       TSS sessió     CLASSE CSS         COLOR
// Recuperació  < 30           tss-recovery       #86efac  verd suau
// Fàcil        30 – 59        tss-easy           #22c55e  verd
// Moderada     60 – 99        tss-moderate       #facc15  groc
// Dura         100 – 149      tss-hard           #f97316  taronja
// Extrem       ≥ 150          tss-extreme        #ef4444  vermell
// ─────────────────────────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════════════
// BAREM EPOC
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Barem EPOC per a una sessió individual.
 * @param {number} epoc  Valor EPOC de la sessió
 * @returns {{ key, label, cls } | null}
 */
function getLoadLevelSession(epoc) {
  if (!isFinite(epoc) || epoc <= 0) return null;
  if (epoc < 20)  return { key: 'vlow',  label: 'Mínima',    cls: 'load-vlow'  };
  if (epoc < 50)  return { key: 'low',   label: 'Baixa',     cls: 'load-low'   };
  if (epoc < 90)  return { key: 'mid',   label: 'Moderada',  cls: 'load-mid'   };
  if (epoc < 150) return { key: 'high',  label: 'Alta',      cls: 'load-high'  };
  return              { key: 'vhigh', label: 'Molt alta', cls: 'load-vhigh' };
}

/**
 * Barem setmanal EPOC basat en score combinat:
 *   score = avg_epoc × sqrt(num_sessions)
 *
 * @param {number} epocTotal    Suma EPOC dels últims 7 dies
 * @param {number} numSessions  Nombre de sessions de la finestra
 * @returns {{ key, label, cls, score, avg, total, count }}
 */
function getLoadLevelWeekly(epocTotal, numSessions) {
  const count = (numSessions > 0) ? numSessions : 0;
  const avg   = (count > 0 && isFinite(epocTotal) && epocTotal > 0)
                  ? epocTotal / count
                  : 0;
  const score = avg * Math.sqrt(count);

  let level;
  if (score <= 0)        level = { key: 'vlow',  label: 'Molt baixa', cls: 'load-vlow'  };
  else if (score <  60)  level = { key: 'vlow',  label: 'Molt baixa', cls: 'load-vlow'  };
  else if (score < 100)  level = { key: 'low',   label: 'Baixa',      cls: 'load-low'   };
  else if (score < 160)  level = { key: 'mid',   label: 'Moderada',   cls: 'load-mid'   };
  else if (score < 240)  level = { key: 'high',  label: 'Alta',       cls: 'load-high'  };
  else                   level = { key: 'vhigh', label: 'Molt alta',  cls: 'load-vhigh' };

  return { ...level, score: Math.round(score), avg, total: epocTotal, count };
}

/**
 * Badge EPOC complet: dot de color + valor numèric.
 * Usat a la columna EPOC de la taula de sessions.
 * @param {number} epoc
 * @returns {string} HTML string
 */
function loadBadgeHTML(epoc) {
  const lvl = getLoadLevelSession(epoc);
  if (!lvl) return (typeof formatMetric === 'function') ? formatMetric(epoc, '') : String(epoc || '--');
  return `<span class="load-badge load-badge--${lvl.cls}" title="${lvl.label}">${(typeof formatMetric === 'function') ? formatMetric(epoc, '') : epoc}</span>`;
}

/**
 * Dot EPOC sol (sense text): indicador visual discret.
 * Usat al costat del valor TSS a la columna TSS.
 * @param {number} epoc
 * @returns {string} HTML string
 */
function loadDotHTML(epoc) {
  const lvl = getLoadLevelSession(epoc);
  if (!lvl) return '';
  return `<span class="load-dot load-dot--${lvl.cls}" title="${lvl.label}"></span>`;
}


// ═════════════════════════════════════════════════════════════════════════════
// BAREM TSS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Barem TSS per a una sessió individual.
 * Referència: 100 TSS = 1h a llindar (Coggan & Allen).
 * Calibrat per a hrTSS de Suunto.
 *
 * @param {number} tss  Valor TSS de la sessió (columna Carrega)
 * @returns {{ key, label, cls } | null}
 */
function getTSSLevel(tss) {
  if (!isFinite(tss) || tss <= 0) return null;
  if (tss <  30) return { key: 'recovery', label: 'Recuperació', cls: 'tss-recovery' };
  if (tss <  60) return { key: 'easy',     label: 'Fàcil',       cls: 'tss-easy'     };
  if (tss < 100) return { key: 'moderate', label: 'Moderada',    cls: 'tss-moderate' };
  if (tss < 150) return { key: 'hard',     label: 'Dura',        cls: 'tss-hard'     };
  return             { key: 'extreme',  label: 'Extrem',      cls: 'tss-extreme'  };
}

/**
 * Badge TSS complet: dot de color + valor numèric TSS.
 * Ús opcional per a panels que mostrin el TSS com a indicador principal.
 * @param {number} tss
 * @returns {string} HTML string
 */
function tssBadgeHTML(tss) {
  const lvl = getTSSLevel(tss);
  const val = (typeof fmtNum === 'function') ? fmtNum(tss) : String(tss || '--');
  if (!lvl) return val;
  return `<span class="tss-badge tss-badge--${lvl.cls}" title="${lvl.label}">${val} TSS</span>`;
}

/**
 * Dot TSS sol (sense text): indicador visual discret.
 * Usat a la columna TSS de la taula — mostra la intensitat de la sessió
 * sense repetir el valor numèric (que ja surt com a TSS al costat).
 * @param {number} tss
 * @returns {string} HTML string
 */
function tssDotHTML(tss) {
  const lvl = getTSSLevel(tss);
  if (!lvl) return '';
  return `<span class="tss-dot tss-dot--${lvl.cls}" title="${lvl.label}"></span>`;
}
