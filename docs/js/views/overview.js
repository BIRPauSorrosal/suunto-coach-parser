// docs/js/views/overview.js
// Vista Overview: hero-cards + metric-boxes + panells Test/Cursa + Altres
// Dep: formatters.js, metrics.js, load-scale.js, app.js

// ── Punt d'entrada ──────────────────────────────────────────────────────────────────
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

  // ② i ④ nous widgets
  renderLoadTrend(sessions, planning);
  renderCtlTrend(sessions);

  setTimeout(() => initCharts(sessions, planning), 0);
}

// ── Hero-cards ────────────────────────────────────────────────────────────────────────
function renderOverview(activeWeek, weeklySessions) {
  const plannedKm  = activeWeek?.kmTotal ?? null;
  const realLoad   = sumNumbers(weeklySessions.map(s => s.carrega));
  const realKm     = sumNumbers(weeklySessions.map(s => s.distancia));
  const compliance = (plannedKm && plannedKm > 0) ? (realKm / plannedKm) * 100 : null;

  setText('active-week-label', activeWeek ? `${activeWeek.setmana} \u00b7 ${activeWeek.cicle}` : '--');
  setText('active-week-range', activeWeek
    ? `${formatDate(activeWeek.startDate)} \u2192 ${formatDate(activeWeek.endDate)} \u00b7 ${activeWeek.fase}`
    : "No s'ha pogut detectar cap setmana activa.");
  setText('planned-km-value',  formatMetric(plannedKm, 'km'));
  setText('real-load-value',   formatMetric(realLoad, ''));
  setText('compliance-value',  compliance == null ? '-- %' : `${Math.round(compliance)} %`);
}

// ── Progrés del cicle ──────────────────────────────────────────────────────────────────
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

  // ─ Qualitat ─────────────────────────────────────────────────────────────────────
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
    ? `Pla: ${activeWeek.qSeries} sèr \u00b7 ${activeWeek.qDuradaSerie}' \u00b7 ${formatPace(activeWeek.qRitme)}`
    : 'Sense planning setmanal disponible');

  // ─ Z1+Z2 ────────────────────────────────────────────────────────────────────────
  setText('z2-summary', z1z2Minutes ? `${formatNumber(z1z2Minutes)} min` : '\u2014');
  setText('z2-detail', activeWeek
    ? `Ritme Z2: ${formatPace(activeWeek.z2PaceMin, '')}\u2013${formatPace(activeWeek.z2PaceMax)}`
    : 'Sense rang de ritme planificat');

  // ─ Tirada llarga ──────────────────────────────────────────────────────────────────
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

  // ─ Força ──────────────────────────────────────────────────────────────────────────
  setText('strength-summary', strength.length ? `${strength.length} sessions` : '\u2014');
  setText('strength-detail', activeWeek
    ? `Pla: ${activeWeek.forcaPlan} \u00b7 ${formatNumber(strengthMin)} min reals`
    : 'Sense sessions de for\u00e7a aquesta setmana');
}

// ── Panell EPOC & Recuperació ───────────────────────────────────────────────────────────
function renderEpocPanel(sessions) {
  const container = document.getElementById('epoc-panel-content');
  if (!container) return;

  const now    = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);

  const recent = sessions.filter(s => s.date >= cutoff);

  // ── EPOC ──────────────────────────────────────────────────────────────────
  const epocValues  = recent.map(s => s.epoc).filter(v => v !== null && isFinite(v));
  const epocTotal   = epocValues.reduce((a, b) => a + b, 0);
  const numSessions = recent.length;
  const epocLvl     = getLoadLevelWeekly(epocTotal, numSessions);

  const epocBarMax = 150;
  const epocPct    = Math.min(100, Math.round((epocLvl.avg / epocBarMax) * 100));
  const epocAvgTxt = epocLvl.count > 0 ? `${Math.round(epocLvl.avg)} EPOC/sessió` : '--';
  const countTxt = `${epocLvl.count} ${epocLvl.count !== 1 ? 'sessions' : 'sessió'}`;

  // ── TSS ───────────────────────────────────────────────────────────────────
  const tssValues  = recent.map(s => s.carrega).filter(v => v !== null && isFinite(v) && v > 0);
  const tssTotal   = tssValues.reduce((a, b) => a + b, 0);
  const tssAvg     = tssValues.length > 0 ? tssTotal / tssValues.length : 0;
  const tssScore   = tssAvg * Math.sqrt(tssValues.length);  // mateixa fórmula que EPOC weekly

  // Barem TSS setmanal (calibrat sobre score combinat, escala ~1.5x la sessió)
  const TSS_WEEKLY_SCALE = [
    { max:  45, key: 'recovery', label: 'Recuperació', cls: 'tss-recovery' },
    { max:  90, key: 'easy',     label: 'Fàcil',       cls: 'tss-easy'     },
    { max: 150, key: 'moderate', label: 'Moderada',    cls: 'tss-moderate' },
    { max: 225, key: 'hard',     label: 'Dura',        cls: 'tss-hard'     },
    { max: Infinity, key: 'extreme', label: 'Extrem',  cls: 'tss-extreme'  },
  ];
  let tssLvl = TSS_WEEKLY_SCALE[0];
  if (tssScore > 0) {
    for (const tier of TSS_WEEKLY_SCALE) {
      if (tssScore < tier.max) { tssLvl = tier; break; }
    }
  }

  const tssBarMax = 225;
  const tssPct    = Math.min(100, Math.round((tssScore / tssBarMax) * 100));
  const tssAvgTxt = tssValues.length > 0 ? `${Math.round(tssAvg)} TSS/sessió` : '--';

  // ── Recuperació pendent ───────────────────────────────────────────────────
  let maxPendent  = 0;
  let origenTipus = '--';
  let origenData  = '--';

  recent.forEach(s => {
    if (s.recuperacio == null || !isFinite(s.recuperacio)) return;
    const sessionEnd   = new Date(s.date);
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
    : 'Recuperat ✓';
  const recuperacioOrigen = maxPendent > 0
    ? `Origen: ${esc(origenTipus)} · ${esc(origenData)}`
    : 'Cap sessió pendent de recuperació';

  // ── Render ────────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="epoc-block">
      <div class="epoc-block-header">
        <span class="epoc-block-title">TSS acumulat</span>
        <span class="epoc-value">${Math.round(tssTotal)}</span>
      </div>
      <div class="epoc-bar-wrap">
        <div class="epoc-bar-fill tss-${tssLvl.key}" style="width:${tssPct}%"></div>
      </div>
      <p class="epoc-label">
        <span class="metric-badge metric-badge--${tssLvl.cls}">${esc(tssLvl.label)}</span>
        <span class="epoc-avg-detail">${countTxt} · mitjana ${tssAvgTxt}</span>
      </p>
    </div>
    <div class="epoc-divider"></div>
    <div class="epoc-block">
      <div class="epoc-block-header">
        <span class="epoc-block-title">EPOC acumulat</span>
        <span class="epoc-value">${formatNumber(epocTotal)}</span>
      </div>
      <div class="epoc-bar-wrap">
        <div class="epoc-bar-fill load-${epocLvl.key}" style="width:${epocPct}%"></div>
      </div>
      <p class="epoc-label">
        <span class="metric-badge metric-badge--load-${epocLvl.key}">${esc(epocLvl.label)}</span>
        <span class="epoc-avg-detail">${countTxt} · mitjana ${epocAvgTxt}</span>
      </p>
    </div>
    <div class="epoc-divider"></div>
    <div class="epoc-block">
      <div class="epoc-block-header">
        <span class="epoc-block-title">Recuperació pendent</span>
        <span class="epoc-recup-value">${esc(recuperacioText)}</span>
      </div>
      <p class="epoc-label">${recuperacioOrigen}</p>
    </div>
  `;
}

// ── Panell Test & Cursa ───────────────────────────────────────────────────────────────────
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
        <td>${tssDotHTML(s.carrega)}</td>
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
          <th>TSS</th>
        </tr>
      </thead>
      <tbody>
        ${rowHTML('Test', lastTest)}
        ${rowHTML('Cursa', lastCursa)}
      </tbody>
    </table>`;
}

// ── Panell Altres activitats — últims 30 dies ───────────────────────────────────────────
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
          <tr><th>Data</th><th>Tipus</th><th>Durada</th><th>TSS</th></tr>
        </thead>
        <tbody>
          ${others.map(s => `
            <tr>
              <td>${esc(s.displayDate)}</td>
              <td>${esc(s.tipus)}</td>
              <td>${formatMetric(s.durada, 'min')}</td>
              <td>${tssDotHTML(s.carrega)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="plan-no-data">Cap activitat alternativa els \u00faltims 30 dies.</p>';
}

// ============================================================
// #P-TREND A — Tendència de càrrega (últimes 7 setmanes)
// ============================================================
function renderLoadTrend(sessions, planning) {
  const canvas = document.getElementById('chart-load-trend');
  const pillEl = document.getElementById('load-trend-pill');
  if (!canvas || !pillEl) return;

  if (canvas._chartInstance) { canvas._chartInstance.destroy(); }

  function blockLabel(endDate) {
    const months = ['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'];
    return `${endDate.getDate()} ${months[endDate.getMonth()]}`;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const weeks = [];
  for (let i = 6; i >= 0; i--) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 7);

    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const isActive = i === 0;
    const label    = isActive ? 'Avui' : blockLabel(end);
    weeks.push({ mon: start, sun: end, label, isActive });
  }

  const loads = weeks.map(w => {
    const total = sessions
      .filter(s => s.date >= w.mon && s.date <= w.sun)
      .reduce((sum, s) => sum + (isFinite(s.carrega) ? s.carrega : 0), 0);
    return Math.round(total);
  });

  const labels = weeks.map(w => w.label);

  const CSS        = getComputedStyle(document.documentElement);
  const clrAccent  = CSS.getPropertyValue('--accent').trim()    || '#22c55e';
  const clrSurface = CSS.getPropertyValue('--surface-2').trim() || '#263349';
  const clrMuted   = CSS.getPropertyValue('--text-muted').trim()|| '#94a3b8';

  const barColors    = loads.map((_, i) => i === loads.length - 1 ? clrAccent : clrSurface);
  const borderColors = loads.map((_, i) =>
    i === loads.length - 1
      ? clrAccent
      : CSS.getPropertyValue('--border').trim() || '#334155'
  );

  const pastLoads = loads.slice(0, 6).filter(v => v > 0);
  const avgPast   = pastLoads.length
    ? Math.round(pastLoads.reduce((a, b) => a + b, 0) / pastLoads.length)
    : 0;

  const currentLoad = loads[loads.length - 1];
  let pillClass, pillIcon, pillText;

  if (avgPast === 0 && currentLoad === 0) {
    pillClass = 'neutral'; pillIcon = '\u2192'; pillText = 'Sense dades de TSS';
  } else if (avgPast === 0) {
    pillClass = 'neutral'; pillIcon = '\u2192'; pillText = `${currentLoad} TSS \u00b7 Sense refer\u00e8ncia anterior`;
  } else {
    const diffPct = ((currentLoad - avgPast) / avgPast) * 100;
    if (diffPct > 15) {
      pillClass = 'up';      pillIcon = '\u2191';
      pillText  = `Pujada +${Math.round(diffPct)}% (Mij. ${avgPast})`;
    } else if (diffPct < -15) {
      pillClass = 'down';    pillIcon = '\u2193';
      pillText  = `Desc\u00e0rrega ${Math.round(diffPct)}% (Mij. ${avgPast})`;
    } else {
      pillClass = 'neutral'; pillIcon = '\u2192';
      pillText  = `En l\u00ednia ${diffPct >= 0 ? '+' : ''}${Math.round(diffPct)}% (Mij. ${avgPast})`;
    }
  }

  pillEl.innerHTML = `
    <span class="trend-pill trend-pill--${pillClass}">${pillIcon} ${esc(pillText)}</span>
    <span class="trend-context">\u00b115% = en l\u00ednia | >+15% = pujada | <-15% = desc\u00e0rrega</span>
  `;

  canvas._chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'TSS',
          data: loads,
          backgroundColor: barColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: 'bottom',
        },
        {
          type: 'line',
          label: `Mij. ${avgPast}`,
          data: new Array(loads.length).fill(avgPast),
          borderColor: clrMuted,
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? ` TSS: ${ctx.raw}`
              : ` Mitjana 6 blocs: ${avgPast}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(51,65,85,0.4)' },
          ticks: { color: clrMuted, font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(51,65,85,0.4)' },
          ticks: { color: clrMuted, font: { size: 11 } },
          beginAtZero: true,
        },
      },
    },
  });
}

// ============================================================
// #P-TREND B — Forma actual: CTL (últims 42 dies)
// ============================================================
function renderCtlTrend(sessions) {
  const canvas = document.getElementById('chart-ctl-trend');
  const pillEl = document.getElementById('ctl-trend-pill');
  if (!canvas || !pillEl) return;

  if (canvas._chartInstance) { canvas._chartInstance.destroy(); }

  const CSS        = getComputedStyle(document.documentElement);
  const clrAccent  = CSS.getPropertyValue('--accent').trim()    || '#22c55e';
  const clrMuted   = CSS.getPropertyValue('--text-muted').trim()|| '#94a3b8';
  const clrOrange  = CSS.getPropertyValue('--orange').trim()    || '#f97316';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 41);

  const sorted = [...sessions]
    .filter(s => s.date instanceof Date && isFinite(s.date))
    .sort((a, b) => a.date - b.date);

  const dayLoad = new Map();
  sorted.forEach(s => {
    const key = s.date.toISOString().slice(0, 10);
    dayLoad.set(key, (dayLoad.get(key) || 0) + (isFinite(s.carrega) ? s.carrega : 0));
  });

  const TAU_CTL = 42;
  const k_ctl   = Math.exp(-1 / TAU_CTL);

  let firstDay = sorted.length ? new Date(sorted[0].date) : new Date(rangeStart);
  firstDay.setHours(0, 0, 0, 0);

  let ctl = 0;
  const ctlByDate = new Map();

  for (let d = new Date(firstDay); d <= today; d.setDate(d.getDate() + 1)) {
    const key  = d.toISOString().slice(0, 10);
    const load = dayLoad.get(key) || 0;
    ctl = ctl * k_ctl + load * (1 - k_ctl);
    ctlByDate.set(key, +ctl.toFixed(1));
  }

  const labels  = [];
  const ctlData = [];
  const months  = ['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'];

  for (let d = new Date(rangeStart); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const diff = Math.round((today - d) / 86400000);
    const showLabel = diff % 7 === 0;
    labels.push(showLabel ? `${d.getDate()} ${months[d.getMonth()]}` : '');
    ctlData.push(ctlByDate.get(key) ?? 0);
  }

  const ctlAvui = ctlData[ctlData.length - 1] || 0;
  const d7ago   = new Date(today); d7ago.setDate(d7ago.getDate() - 7);
  const ctl7ago = ctlByDate.get(d7ago.toISOString().slice(0, 10)) || 0;
  const ctlDiff = +(ctlAvui - ctl7ago).toFixed(1);

  let pillClass, pillIcon, pillText;
  if (ctlDiff > 1) {
    pillClass = 'up';      pillIcon = '\u2191';
    pillText  = `Guany +${ctlDiff} pts CTL (\u2192 ${ctlAvui})`;
  } else if (ctlDiff < -1) {
    pillClass = 'down';    pillIcon = '\u2193';
    pillText  = `P\u00e8rdua ${ctlDiff} pts CTL (\u2192 ${ctlAvui})`;
  } else {
    pillClass = 'neutral'; pillIcon = '\u2192';
    pillText  = `Estable ${ctlDiff >= 0 ? '+' : ''}${ctlDiff} pts CTL (\u2192 ${ctlAvui})`;
  }

  pillEl.innerHTML = `
    <span class="trend-pill trend-pill--${pillClass}">${pillIcon} ${esc(pillText)}</span>
    <span class="trend-context">\u00b11 pt = estable | >+1 = guany de forma | <-1 = p\u00e8rdua forma</span>
  `;

  const pointColors = ctlData.map((_, i) => {
    if (i === 0)                  return clrMuted;
    if (i === ctlData.length - 1) return ctlDiff >= 0 ? clrAccent : clrOrange;
    return 'transparent';
  });
  const pointRadius = ctlData.map((_, i) =>
    (i === 0 || i === ctlData.length - 1) ? 5 : 0
  );

  canvas._chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'CTL',
        data: ctlData,
        borderColor: clrAccent,
        borderWidth: 2,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius,
        pointHoverRadius: 5,
        fill: {
          target: 'origin',
          above: 'rgba(34,197,94,0.07)',
        },
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` CTL: ${ctx.raw} pts`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(51,65,85,0.4)' },
          ticks: { color: clrMuted, font: { size: 11 }, maxRotation: 0 },
        },
        y: {
          grid: { color: 'rgba(51,65,85,0.4)' },
          ticks: { color: clrMuted, font: { size: 11 } },
          beginAtZero: false,
        },
      },
    },
  });
}
