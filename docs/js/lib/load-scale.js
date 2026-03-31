// docs/js/lib/load-scale.js
// Lògica de barems de càrrega basada en model EPOC (Firstbeat)
// Reutilitzable per totes les vistes: overview, sessions, setmanal...
//
// ─ Barem sessió individual ───────────────────────────────────────────────────
//
// NIVELL       EPOC sessió    COLOR CSS
// Mínima       < 20           --load-vlow
// Baixa        20 – 50        --load-low
// Moderada     50 – 90        --load-mid
// Alta         90 – 150       --load-high
// Molt alta    > 150          --load-vhigh
//
// ─ Barem setmanal (score combinat) ──────────────────────────────────────────
//
// score = avg_epoc × sqrt(num_sessions)
//
// Pondera intensitat (avg) i volum (nº sessions) simultàniament.
// sqrt evita que el volum domini: 10 sessions no val el doble que 5.
//
// NIVELL       SCORE          EXEMPLE TÍPIC
// Molt baixa   < 60           1 sess lleugera
// Baixa        60 – 100       2 sess moderades
// Moderada     100 – 160      3-4 sess moderades
// Alta         160 – 240      setmana carregada normal
// Molt alta    > 240          setmana de màxim volum/intensitat
//
// Exemples de calibració:
//   2 sess × 59 avg  → score  83 → Baixa
//   3 sess × 59 avg  → score 102 → Moderada
//   4 sess × 70 avg  → score 140 → Moderada
//   5 sess × 90 avg  → score 202 → Alta
//   6 sess × 120 avg → score 294 → Molt alta
//   2 sess × 130 avg → score 184 → Alta  (setmana curta intensa)
//   1 sess × 160 avg → score 160 → Alta  (1 sessió molt dura)
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
 * Barem setmanal basat en un score combinat:
 *   score = avg_epoc × sqrt(num_sessions)
 *
 * Combina intensitat mitjana per sessió i volum setmanal (nº sessions)
 * sense que cap dels dos factors domini l'altre completament.
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
 * Badge complet: dot de color + valor numèric EPOC.
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
 * Dot de color sense text: indicador visual discret.
 * Usat a la columna Càrrega TSS — mostra el color d'intensitat
 * sense repetir el valor numèric (que ja surt com a TSS al costat).
 * @param {number} epoc
 * @returns {string} HTML string
 */
function loadDotHTML(epoc) {
  const lvl = getLoadLevelSession(epoc);
  if (!lvl) return '';
  return `<span class="load-dot load-dot--${lvl.cls}" title="${lvl.label}"></span>`;
}
