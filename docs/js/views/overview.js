// docs/js/views/overview.js
// Vista Overview: hero-cards + metric-boxes + panells Test/Cursa + Altres
// Dep: app.js (constants, helpers, detectActiveWeek, formatPace)

// ── Barems de càrrega (Firstbeat/EPOC) ──────────────────────────────────────
// Basats en el model EPOC de Firstbeat per a atletes aficionats consistents
// (~20-30 km/setmana, cicle de construcció aeròbica).
//
// NIVELL         SESSIÓ        SETMANAL     COLOR CSS
// Molt baixa     < 20          < 60         --load-vlow
// Baixa          20 – 50       60 – 120     --load-low
// Moderada       50 – 90       120 – 200    --load-mid
// Alta           90 – 150      200 – 280    --load-high
// Molt alta      > 150         > 280        --load-vhigh

function getLoadLevelSession(epoc) {
  if (!isFinite(epoc) || epoc <= 0) return null;
  if (epoc < 20)  return { key: 'vlow',  label: 'Mínima',     cls: 'load-vlow'  };
  if (epoc < 50)  return { key: 'low',   label: 'Baixa',      cls: 'load-low'   };
  if (epoc < 90)  return { key: 'mid',   label: 'Moderada',   cls: 'load-mid'   };
  if (epoc < 150) return { key: 'high',  label: 'Alta',       cls: 'load-high'  };
  return              { key: 'vhigh', label: 'Molt alta',  cls: 'load-vhigh' };
}

function getLoadLevelWeekly(epoc) {
  if (!isFinite(epoc) || epoc <= 0) return { key: 'vlow', label: 'Molt baixa', cls: 'load-vlow' };
  if (epoc < 60)  return { key: 'vlow',  label: 'Molt baixa',  cls: 'load-vlow'  };
  if (epoc < 120) return { key: 'low',   label: 'Baixa',       cls: 'load-low'   };
  if (epoc < 200) return { key: 'mid',   label: 'Moderada',    cls: 'load-mid'   };
  if (epoc < 280) return { key: 'high',  label: 'Alta',        cls: 'load-high'  };
  return              { key: 'vhigh', label: 'Molt alta',   cls: 'load-vhigh' };
}

// Retorna el HTML d'un badge de càrrega per a una sessió individual
function loadBadgeHTML(epoc) {
  const lvl = getLoadLevelSession(epoc);
  if (!lvl) return formatMetric(epoc, '');
  return `<span class="load-badge load-badge--${lvl.cls}" title="${lvl.label}">${formatMetric(epoc, '')}</span>`;
}

// ── Punt d'entrada ──────────────────────────────────────────────────────────
function renderOverviewView(sessions, planning) {
  const activeWeek     = detectActiveWeek(planning, sessions);
  const weeklySessions = activeWeek
    ? sessions.filter(s => s.date >= activeWeek.startDate && s.date <= activeWeek.endDate)
    : [];

  renderOverview(activeWeek, weeklySessions);
  renderCycleProgress(activeWeek, planning);
  renderSummary(activeWeek, weeklySessions);
  renderEpocPanel(sessions);
  renderTestRacePanel(sessions);
  renderOthersPanel(sessions);

  setTimeout(() => initCharts(sessions, planning), 0);
}

// ── Hero-cards ────────────────────────────────────────────────────────────────
function renderOverview(activeWeek, weeklySessions) {
  const plannedKm  = activeWeek?.kmTotal ?? null;
  const realLoad   = sumNumbers(weeklySessions.map(s => s.carrega));
  const realKm     = sumNumbers(weeklySessions.map(s => s.distancia));
  const compliance = (plannedKm && plannedKm > 0) ? (realKm / plannedKm) * 100 : null;

  setText('active-week-label', activeWeek ? `${activeWeek.setmana} · ${activeWeek.cicle}` : '--');
  setText('active-week-range', activeWeek
    ? `${formatDate(activeWeek.startDate)} \u2192 ${formatDate(activeWeek.endDate)} \u00b7 ${activeWeek.fase}`
    : "No s'ha pogut detectar cap setmana activa.");
  setText('planned-km-value',  formatMetric(plannedKm, 'km'));
  setText('real-load-value',   formatMetric(realLoad, ''));
  setText('compliance-value',  compliance == null ? '-- %' : `${Math.round(compliance)} %`);
}

// ── Progrés del cicle (#P2) ─────────────────────────────────────────────────────
function renderCycleProgress(activeWeek, planning) {
  const barEl     = document.getElementById('cycle-bar-fill');
  const titleEl   = document.getElementById('cycle-title');
  const counterEl = document.getElementById('cycle-week-counter');
  const phasesEl  = document.getElementById('cycle-phases');
  if (!barEl || !titleEl || !counterEl || !phasesEl) return;

  if (!activeWeek) {
    titleEl.textContent   = 'Sense cicle detectat';
    counterEl.textContent = '-- / --';
    barEl.style.width     = '0%';
    phasesEl.innerHTML    = '';
    return;
  }

  const currentCycle = activeWeek.cicle;
  const cycleWeeks   = planning
    .filter(w => w.cicle === currentCycle)
    .sort((a, b) => a.startDate - b.startDate);

  const totalWeeks   = cycleWeeks.length;
  const currentIndex = cycleWeeks.findIndex(
    w => w.startDate.getTime() === activeWeek.startDate.getTime()
  );
  const weekNum = currentIndex >= 0 ? currentIndex + 1 : 1;
  const pct     = totalWeeks > 0 ? Math.round((weekNum / totalWeeks) * 100) : 0;

  titleEl.textContent   = currentCycle;
  counterEl.textContent = `Setmana ${weekNum} / ${totalWeeks}`;
  barEl.style.width     = `${pct}%`;

  const phases = [];
  cycleWeeks.forEach(w => {
    const last     = phases[phases.length - 1];
    const isActive = w.startDate.getTime() === activeWeek.startDate.getTime();
    if (last && last.fase === w.fase) {
      last.count++;
      if (isActive) last.active = true;
    } else {
      phases.push({ fase: w.fase, count: 1, active: isActive });
    }
  });

  phasesEl.innerHTML = phases.map(p => {
    const cls = p.active ? 'cycle-phase-pill cycle-phase-pill--active' : 'cycle-phase-pill';
    return `<span class="${cls}">${esc(p.fase)}<em>${p.count}s</em></span>`;
  }).join('');
}

// ── Metric-boxes (resum setmana activa) ────────────────────────────────────────────
function renderSummary(activeWeek, weeklySessions) {
  const quality  = weeklySessions.filter(s => QUALITY_TYPES.has(s.tipusKey));
  const llong    = weeklySessions.filter(s => LONG_TYPES.has(s.tipusKey));
  const strength = weeklySessions.filter(s => isStrength(s));

  const runningSessions = weeklySessions.filter(s => isRunning(s));
  const z1z2Minutes     = sumNumbers(runningSessions.map(s => (s.z1min || 0) + (s.z2min || 0)));
  const longKm          = sumNumbers(llong.map(s => s.distancia));
  const strengthMin     = sumNumbers(strength.map(s => s.durada));

  // ─ Qualitat ──────────────────────────────────────────────────────────────────
  if (quality.length) {
    const ritmeMitja = quality.map(s => s.ritmeMitjaSeries).filter(v => isFinite(v));
    const fcMitja    = quality.map(s => s.fcMitjaSeries).filter(v => isFinite(v));
    const ritmeTxt   = ritmeMitja.length
      ? formatPace(ritmeMitja.reduce((a, b) => a + b, 0) / ritmeMitja.length)
      : '--';
    const fcTxt = fcMitja.length
      ? Math.round(fcMitja.reduce((a, b) => a + b, 0) / fcMitja.length) + ' ppm'
      : '--';
    const el = document.getElementById('quality-summary');
    if (el) el.innerHTML = `${esc(ritmeTxt)}<br><span style="font-size:0.85em;opacity:0.8">${esc(fcTxt)}</span>`;
  } else {
    setText('quality-summary', '\u2014');
  }
  setText('quality-detail', activeWeek
    ? `Pla: ${activeWeek.qSeries} s\u00e8r \u00b7 ${activeWeek.qDuradaSerie}' \u00b7 ${formatPace(activeWeek.qRitme)}`
    : 'Sense planning setmanal disponible');

  // ─ Z1+Z2 ─────────────────────────────────────────────────────────────────────
  setText('z2-summary', z1z2Minutes ? `${formatNumber(z1z2Minutes)} min` : '\u2014');
  setText('z2-detail', activeWeek
    ? `Ritme Z2: ${formatPace(activeWeek.z2PaceMin, '')}\u2013${formatPace(activeWeek.z2PaceMax)}`
    : 'Sense rang de ritme planificat');

  // ─ Tirada llarga ───────────────────────────────────────────────────────────
  setText('long-summary', longKm ? `${formatNumber(longKm)} km` : '\u2014');
  setText('long-detail', activeWeek
    ? `Pla: ${activeWeek.llTipus} \u00b7 ${formatNumber(activeWeek.llKm)} km`
    : 'Sense tirada llarga planificada');
  if (llong.length) {
    const lastLong  = llong[0];
    const desnivell = isFinite(lastLong.desnivell) ? `${formatNumber(lastLong.desnivell)} m` : '--';
    const fc        = isFinite(lastLong.fcMitja)   ? `${Math.round(lastLong.fcMitja)} ppm`  : '--';
    setText('long-real', `Real: ${formatNumber(longKm)} km \u00b7 D+ ${desnivell} \u00b7 FC ${fc}`);
  } else {
    setText('long-real', '');
  }

  // ─ For\u00e7a ───────────────────────────────────────────────────────────────────
  setText('strength-summary', strength.length ? `${strength.length} sessions` : '\u2014');
  setText('strength-detail', activeWeek
    ? `Pla: ${activeWeek.forcaPlan} \u00b7 ${formatNumber(strengthMin)} min reals`
    : 'Sense sessions de for\u00e7a aquesta setmana');
}

// ── Panell EPOC & Recuperació (#P3) ──────────────────────────────────────────────
// Finestra: últims 7 dies. Sessions assumides finalitzades a les 20:00h.
// EPOC: suma de tots els valors EPOC dels últims 7 dies.
// Recuperació: màxim de (Recup(h) - hores_transcorregudes) per sessió, mínim 0.
// Barem setmanal: <60 molt baixa | 60-120 baixa | 120-200 moderada | 200-280 alta | >280 molt alta
function renderEpocPanel(sessions) {
  const container = document.getElementById('epoc-panel-content');
  if (!container) return;

  const now    = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);

  const recent = sessions.filter(s => s.date >= cutoff);

  // ─ EPOC acumulat ───────────────────────────────────────────────────────
  const epocTotal = sumNumbers(recent.map(s => s.epoc).filter(v => v !== null));
  const lvl       = getLoadLevelWeekly(epocTotal);

  // Escala visual: 280 = llindar màxim recomanat (zona "molt alta")
  const epocMax = 280;
  const epocPct = Math.min(100, Math.round((epocTotal / epocMax) * 100));

  // ─ Recuperació pendent ────────────────────────────────────────────────
  let maxPendent = 0;
  let origenTipus = '--';
  let origenData  = '--';

  recent.forEach(s => {
    if (s.recuperacio == null || !isFinite(s.recuperacio)) return;
    const sessionEnd = new Date(s.date);
    sessionEnd.setHours(20, 0, 0, 0);
    const horaPassades = (now - sessionEnd) / (1000 * 60 * 60);
    const pendent      = Math.max(0, s.recuperacio - horaPassades);
    if (pendent > maxPendent) {
      maxPendent  = pendent;
      origenTipus = s.tipus;
      origenData  = s.displayDate;
    }
  });

  const recuperacioText   = maxPendent > 0
    ? `${Math.round(maxPendent)}h restants`
    : 'Recuperat \u2713';
  const recuperacioOrigen = maxPendent > 0
    ? `Origen: ${esc(origenTipus)} \u00b7 ${esc(origenData)}`
    : 'Cap sessi\u00f3 pendent de recuperaci\u00f3';

  container.innerHTML = `
    <div class="epoc-block">
      <div class="epoc-block-header">
        <span class="epoc-block-title">EPOC acumulat</span>
        <span class="epoc-value load-${lvl.key}">${formatNumber(epocTotal)}</span>
      </div>
      <div class="epoc-bar-wrap">
        <div class="epoc-bar-fill load-${lvl.key}" style="width:${epocPct}%"></div>
      </div>
      <p class="epoc-label">
        <span class="load-badge load-badge--load-${lvl.key}">${esc(lvl.label)}</span>
      </p>
    </div>
    <div class="epoc-divider"></div>
    <div class="epoc-block">
      <div class="epoc-block-header">
        <span class="epoc-block-title">Recuperaci\u00f3 pendent</span>
        <span class="epoc-recup-value">${esc(recuperacioText)}</span>
      </div>
      <p class="epoc-label">${recuperacioOrigen}</p>
    </div>
  `;
}

// ── Panell Test & Cursa ────────────────────────────────────────────────────────────
function renderTestRacePanel(sessions) {
  const container = document.getElementById('test-race-container');
  if (!container) return;

  const lastTest  = sessions.find(s => s.tipusKey === 'TEST');
  const lastCursa = sessions.find(s => s.tipusKey === 'CURSA');

  function rowHTML(label, s) {
    if (!s) return `
      <tr class="tr-empty">
        <td colspan="7"><span class="eyebrow">${label}</span> \u2014 Sense registre</td>
      </tr>`;

    const isTest = s.tipusKey === 'TEST';
    const ritme  = isTest ? s.ritmeMitjaSeries : s.ritme;
    const fc     = isTest ? s.fcMitjaSeries    : s.fcMitja;
    const fcTxt  = isFinite(fc) ? `${Math.round(fc)} ppm` : '--';
    const desTxt = isFinite(s.desnivell) ? `${formatNumber(s.desnivell)} m` : '--';

    return `
      <tr>
        <td><span class="eyebrow">${label}</span></td>
        <td>${esc(s.displayDate)}</td>
        <td>${formatMetric(s.distancia, 'km')}</td>
        <td>${formatPace(ritme)}</td>
        <td>${fcTxt}</td>
        <td>${desTxt}</td>
        <td>${loadBadgeHTML(s.carrega)}</td>
      </tr>`;
  }

  container.innerHTML = `
    <table class="sw-mini-table">
      <thead>
        <tr>
          <th>Tipus</th>
          <th>Data</th>
          <th>Dist\u00e0ncia</th>
          <th>Ritme</th>
          <th>FC</th>
          <th>Desnivell</th>
          <th>C\u00e0rrega</th>
        </tr>
      </thead>
      <tbody>
        ${rowHTML('Test', lastTest)}
        ${rowHTML('Cursa', lastCursa)}
      </tbody>
    </table>`;
}

// ── Panell Altres activitats — últims 30 dies ───────────────────────────────────
function renderOthersPanel(sessions) {
  const container = document.getElementById('others-container');
  if (!container) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  cutoff.setHours(0, 0, 0, 0);

  const others   = sessions.filter(s => isOther(s) && s.date >= cutoff);
  const totalMin = sumNumbers(others.map(s => s.durada));

  setText('others-count', others.length
    ? `${others.length} sessions \u00b7 ${formatNumber(totalMin)} min`
    : 'Sense activitats els \u00faltims 30 dies');

  container.innerHTML = others.length
    ? `<table class="sw-mini-table">
        <thead>
          <tr><th>Data</th><th>Tipus</th><th>Durada</th><th>C\u00e0rrega</th></tr>
        </thead>
        <tbody>
          ${others.map(s => `
            <tr>
              <td>${esc(s.displayDate)}</td>
              <td>${esc(s.tipus)}</td>
              <td>${formatMetric(s.durada, 'min')}</td>
              <td>${loadBadgeHTML(s.carrega)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="plan-no-data">Cap activitat alternativa els \u00faltims 30 dies.</p>';
}
