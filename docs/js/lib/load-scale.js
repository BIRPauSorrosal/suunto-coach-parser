// docs/js/lib/load-scale.js
// Lògica de barems de càrrega basada en model EPOC (Firstbeat)
// Reutilitzable per totes les vistes: overview, sessions, setmanal...
//
// ─ Barems de referència ───────────────────────────────────────────────────────
//
// NIVELL       SESSIÓ (EPOC ind.)   SESSIÓ MITJANA SET.   COLOR CSS
// Molt baixa   < 20                 < 20                  --load-vlow
// Baixa        20 – 50              20 – 50               --load-low
// Moderada     50 – 90              50 – 90               --load-mid
// Alta         90 – 150             90 – 150              --load-high
// Molt alta    > 150                > 150                 --load-vhigh
//
// El barem setmanal usa la MITJANA per sessió (epocTotal / numSessions) per
// evitar que setmanes curtes (1-2 sessions) apareguin com a "baixa càrrega"
// quan la intensitat de cada sortida és realment alta.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Barem per a una sessió individual.
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
 * Barem setmanal basat en l'EPOC MITJÀ per sessió.
 * Això evita que una setmana amb poques sessions d'alta intensitat
 * aparegui com a "baixa" pel sol fet de tenir menys volum total.
 *
 * @param {number} epocTotal    Suma EPOC dels últims 7 dies
 * @param {number} numSessions  Nombre de sessions de la finestra
 * @returns {{ key, label, cls, avg, total, count }}
 */
function getLoadLevelWeekly(epocTotal, numSessions) {
  const count = (numSessions > 0) ? numSessions : 0;
  const avg   = (count > 0 && isFinite(epocTotal) && epocTotal > 0)
                  ? epocTotal / count
                  : 0;

  let level;
  if (avg <= 0)   level = { key: 'vlow',  label: 'Molt baixa', cls: 'load-vlow'  };
  else if (avg < 20)  level = { key: 'vlow',  label: 'Molt baixa', cls: 'load-vlow'  };
  else if (avg < 50)  level = { key: 'low',   label: 'Baixa',      cls: 'load-low'   };
  else if (avg < 90)  level = { key: 'mid',   label: 'Moderada',   cls: 'load-mid'   };
  else if (avg < 150) level = { key: 'high',  label: 'Alta',       cls: 'load-high'  };
  else                level = { key: 'vhigh', label: 'Molt alta',  cls: 'load-vhigh' };

  return { ...level, avg, total: epocTotal, count };
}

/**
 * Retorna el HTML d'un badge de càrrega per a una sessió individual.
 * Requereix formatMetric() i esc() definits a formatters.js
 * @param {number} epoc
 * @returns {string} HTML string
 */
function loadBadgeHTML(epoc) {
  const lvl = getLoadLevelSession(epoc);
  if (!lvl) return (typeof formatMetric === 'function') ? formatMetric(epoc, '') : String(epoc || '--');
  return `<span class="load-badge load-badge--${lvl.cls}" title="${lvl.label}">${(typeof formatMetric === 'function') ? formatMetric(epoc, '') : epoc}</span>`;
}
