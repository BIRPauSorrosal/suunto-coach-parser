// Pantalla inicial contextual. Resumeix el dia i manté el calendari setmanal com a lloc d'edició.
(function () {
  let bound = false;
  let detailBound = false;
  let detailContext = null;
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmt = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(Number(value)) : '--';
  const dateKey = value => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
  const dateText = date => new Intl.DateTimeFormat('ca-ES', { weekday:'long', day:'numeric', month:'long' }).format(date);
  const typeLabels = { quality:'Qualitat', z2:'Z2', long:'Tirada llarga', 'long-run':'Tirada llarga', strength:'Força', bici:'Bici estàtica', cycling:'Bici', other:'Altres' };

  function readLocalCalendar() {
    try { return JSON.parse(localStorage.getItem('suunto-coach-calendar-local-v1') || '{}')?.weeks || {}; } catch (_) { return {}; }
  }

  function linksFor(session) {
    try {
      const links = JSON.parse(localStorage.getItem('suunto-coach-session-links-v1') || '{}');
      const id = session.raw?.__activity?.id;
      if (Object.prototype.hasOwnProperty.call(links, id)) return Array.isArray(links[id]) ? links[id] : [];
    } catch (_) { return []; }
    return session.raw?.__activity?.planning_links || [];
  }

  function plannedItems(week, calendarDocument) {
    const local = readLocalCalendar()[week.key];
    const remote = calendarDocument?.weeks?.[week.key];
    const source = window.CalendarSync?.preferLocal(local, remote) || remote;
    if (source && Array.isArray(source.items)) return source.items.filter(item => item.day !== null && item.day !== undefined);
    const sessions = week.planning?.sessions || [];
    return sessions.map((session, index) => ({
      id: session.id || `${week.key}-session-${index+1}`,
      planning_session_id: session.id || null,
      day: Number.isInteger(session.day) ? session.day : null,
      type: session.type,
      title: typeLabels[session.type] || 'Sessió',
      detail: session.session_type || session.description || session.label || typeLabels[session.type] || 'Sessió planificada',
      status: 'pending',
      source: 'planning'
    })).filter(item => item.day !== null);
  }

  function linkedActivity(item, sessions) {
    const planningId = item.planning_session_id || item.id;
    return sessions.find(session => linksFor(session).some(link => link.confidence === 'confirmed' && link.planning_session_id === planningId)) || null;
  }

  function plannedSessionForItem(item, week) {
    return (week.planning?.sessions || []).find(session => session.id === (item.planning_session_id || item.id)) || null;
  }

  function actualDetails(session) {
    return [session.distancia ? `${fmt(session.distancia)} km` : '', session.durada ? `${fmt(session.durada)} min` : ''].filter(Boolean).join(' · ') || 'Dades no disponibles';
  }

  function latestValue(sessions, key) {
    return [...sessions].filter(session => Number.isFinite(Number(session[key])) && Number(session[key]) > 0)
      .sort((a, b) => b.date - a.date)[0] || null;
  }

  function formAssessment(tsb) {
    const thresholds = typeof PMC_CONFIG !== 'undefined' ? PMC_CONFIG.TSB_THRESHOLDS : null;
    if (!thresholds || !Number.isFinite(tsb)) return 'Sense dades de forma';
    if (tsb > thresholds.fresc) return 'Fresc';
    if (tsb >= thresholds.optim_min) return 'Forma òptima';
    if (tsb >= thresholds.productiu_min) return 'Productiu';
    if (tsb >= thresholds.fatigat_min) return 'Fatigat';
    return 'Sobrecarregat';
  }

  function renderPerformance(sessions) {
    const grid = document.getElementById('today-kpi-grid');
    const feelingEl = document.getElementById('today-feeling');
    const chart = document.getElementById('chart-today-load');
    if (!grid || !feelingEl || !chart) return;

    const pmc = typeof buildPMCData === 'function' ? buildPMCData(sessions) : [];
    const current = pmc[pmc.length - 1] || null;
    const latestVo2 = latestValue(sessions, 'vo2max');
    const latestFeeling = latestValue(sessions, 'feeling');
    const metric = (label, value, context, className = '') => `<article class="today-kpi ${className}"><span class="today-kpi-label">${label}</span><strong class="today-kpi-value">${value}</strong><span class="today-kpi-context">${context}</span></article>`;
    grid.innerHTML = [
      metric('CTL', current ? current.ctl.toFixed(1) : '—', 'Forma', 'today-kpi--fitness'),
      metric('ATL', current ? current.atl.toFixed(1) : '—', 'Fatiga', 'today-kpi--fatigue'),
      metric('TSB', current ? `${current.tsb >= 0 ? '+' : ''}${current.tsb.toFixed(1)}` : '—', 'Estat', 'today-kpi--form'),
      metric('VO₂max', latestVo2 ? Number(latestVo2.vo2max).toFixed(1) : '—', latestVo2 ? 'Rendiment · ml/kg/min' : 'Rendiment · Sense dades', 'today-kpi--performance'),
      metric('TSS 7 dies', current ? Math.round(pmc.slice(-7).reduce((sum, day) => sum + day.tss, 0)) : '—', 'Càrrega', 'today-kpi--load')
    ].join('');

    const feelingValue = latestFeeling ? Number(latestFeeling.feeling) : null;
    const feelingLabel = feelingValue === null ? 'Sense registre' : feelingValue >= 4 ? 'Bona' : feelingValue === 3 ? 'Neutra' : 'Baixa';
    const last7Load = pmc.slice(-7).reduce((sum, day) => sum + day.tss, 0);
    const previous7Load = pmc.slice(-14, -7).reduce((sum, day) => sum + day.tss, 0);
    const loadDiff = previous7Load > 0 ? ((last7Load - previous7Load) / previous7Load) * 100 : null;
    const trendText = loadDiff === null ? 'Sense referència anterior' : loadDiff > 15 ? `Càrrega en augment (+${Math.round(loadDiff)}%)` : loadDiff < -15 ? `Setmana de descàrrega (${Math.round(loadDiff)}%)` : `Càrrega estable (${loadDiff >= 0 ? '+' : ''}${Math.round(loadDiff)}%)`;
    const formText = current ? formAssessment(current.tsb) : 'Sense dades de forma';
    feelingEl.innerHTML = `<div class="panel-header"><div><p class="eyebrow">Dada subjectiva</p><h3 id="today-feeling-title">Com et sents?</h3></div><span class="today-feeling-mark" aria-hidden="true">${feelingValue === null ? '—' : feelingValue >= 4 ? '☺' : feelingValue === 3 ? '◌' : '↓'}</span></div><div class="today-feeling-body"><strong>${feelingLabel}</strong>${feelingValue === null ? '<span>No registrat</span>' : `<span>${feelingValue} / 5</span>`}</div><div class="today-load-context"><div><span>Càrrega respecte als 7 dies anteriors</span><strong>${trendText}</strong></div><div><span>Lectura actual</span><strong>${formText}</strong></div></div>`;

    if (!current || typeof Chart === 'undefined' || !window.DashboardComponents) return;
    window.DashboardComponents.destroyChart('today-pmc');
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--color-accent').trim() || '#55D6BE';
    const danger = css.getPropertyValue('--color-danger').trim() || '#FF6B6B';
    const warning = css.getPropertyValue('--color-warning').trim() || '#F5B942';
    const muted = css.getPropertyValue('--color-text-muted').trim() || '#6F7C89';
    window.DashboardComponents.createChart('today-pmc', chart, {
      type: 'line',
      data: { labels: pmc.slice(-42).map(day => day.label), datasets: [
        { label: 'CTL', data: pmc.slice(-42).map(day => day.ctl), borderColor: accent, backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: .25 },
        { label: 'ATL', data: pmc.slice(-42).map(day => day.atl), borderColor: danger, backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: .25 },
        { label: 'TSB', data: pmc.slice(-42).map(day => day.tsb), borderColor: warning, backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: .25 }
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: muted, usePointStyle: true, boxWidth: 8 } } }, scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { color: muted, maxTicksLimit: 5 } } } }
    });
  }

  function plannedCard(item, real) {
    const title = item.title || typeLabels[item.type] || 'Sessió planificada';
    const detail = [item.detail && item.detail !== title ? item.detail : '', item.variant || '', item.distance_km ? `${fmt(item.distance_km)} km` : '', item.duration_min ? `${fmt(item.duration_min)} min` : ''].filter(Boolean).join(' · ') || title;
    return `<article class="today-session-card${real ? ' is-complete' : ''}"><div><span class="today-session-status">${real ? '✓ Completada' : 'Pendent'}</span><h4>${esc(title)}</h4><p>${esc(detail)}</p></div>${real ? `<div class="today-real-detail"><span>Activitat real</span><strong>${esc(real.tipus || 'Activitat')} · ${esc(actualDetails(real))}</strong></div>` : ''}</article>`;
  }

  function unplannedCard(session) {
    return `<article class="today-session-card today-session-card--unplanned"><div><span class="today-session-status">Activitat no planificada</span><h4>${esc(session.tipus || 'Activitat')}</h4><p>${esc(actualDetails(session))}</p></div></article>`;
  }

  const basePlannedCard = plannedCard;
  plannedCard = function (item, real, plannedSession = null) {
    const html = basePlannedCard(item, real);
    return html.replace('<article ', `<article data-today-planning-session-id="${esc(plannedSession?.id || item.planning_session_id || item.id)}" role="button" tabindex="0" aria-label="Obrir el detall de la sessió del dia" `);
  };
  const baseUnplannedCard = unplannedCard;
  unplannedCard = function (session) {
    const html = baseUnplannedCard(session);
    const id = session.raw?.__activity?.id || session.id || '';
    return html.replace('<article ', `<article data-today-activity-id="${esc(id)}" role="button" tabindex="0" aria-label="Obrir el detall de l’activitat" `);
  };

  function renderTodayView(sessions, planning) {
    renderPerformance(sessions);
    const weeks = window.WeekManager.timeline(planning, sessions), index = window.WeekManager.findCurrent(weeks), week = weeks[index];
    if (!week) return;
    const calendar = window.dashboardStore?.getState?.().calendar;
    const today = new Date(), todayKey = dateKey(today), actual = sessions.filter(session => dateKey(session.date) === todayKey);
    const day = Math.max(0, Math.min(6, Math.round((new Date(todayKey+'T12:00:00') - new Date(dateKey(week.startDate)+'T12:00:00')) / 86400000)));
    const planned = plannedItems(week, calendar)
      .filter(item => item.day === day)
      .filter(item => {
        const linked = linkedActivity(item, sessions);
        return !linked || dateKey(linked.date) === todayKey;
      });
    const plannedWithReal = planned.map(item => ({ item, plannedSession: plannedSessionForItem(item, week), real: linkedActivity(item, actual) }));
    const linkedIds = new Set(plannedWithReal.filter(row => row.real).map(row => row.real.raw?.__activity?.id));
    const unplanned = actual.filter(session => !linkedIds.has(session.raw?.__activity?.id));
    const dateEl = document.getElementById('today-date-label'); if (dateEl) dateEl.textContent = dateText(today);
    const badge = document.getElementById('today-status-badge');
    if (badge) badge.textContent = planned.length && plannedWithReal.every(row => row.real) ? 'Dia completat' : actual.length ? 'Activitat registrada' : planned.length ? 'Sessió pendent' : 'Descans';
    const hero = document.getElementById('today-hero');
    if (hero) {
      const content = [...plannedWithReal.map(row => plannedCard(row.item, row.real, row.plannedSession)), ...unplanned.map(unplannedCard)];
      hero.innerHTML = `<p class="eyebrow">Què toca avui?</p><h3>${planned.length ? (planned.length === 1 ? 'Sessió del dia' : `${planned.length} sessions del dia`) : (unplanned.length ? 'Activitat registrada' : 'Dia de descans')}</h3>${content.length ? `<div class="today-session-list">${content.join('')}</div>` : `<p class="today-hero-detail">No hi ha cap activitat planificada ni registrada.</p>`}<p class="today-hero-note">${unplanned.length ? 'Aquesta activitat no estava planificada, però queda registrada en la seva data.' : planned.length ? 'Les associacions amb activitats reals es gestionen des del calendari setmanal.' : 'Consulta el calendari si vols afegir o reorganitzar una activitat.'}</p>`;
    }
    detailContext = { plannedWithReal, unplanned, today, week };
    const realWeek = sessions.filter(session => session.date >= week.startDate && session.date <= week.endDate), summary = document.getElementById('today-week-summary');
    const allPlanned = plannedItems(week, calendar), completed = allPlanned.filter(item => item.status === 'done' || linkedActivity(item, realWeek)).length;
    const unplannedWeek = realWeek.filter(session => !linksFor(session).some(link => link.confidence === 'confirmed')).length;
    if (summary) summary.innerHTML = `<div class="today-week-grid"><div><span>Període</span><strong>${week.startDate.toLocaleDateString('ca-ES',{day:'numeric',month:'short'})} – ${week.endDate.toLocaleDateString('ca-ES',{day:'numeric',month:'short'})}</strong></div><div><span>Planning</span><strong>${week.planning ? esc(week.planning.setmana+' · '+(week.planning.fase||'')) : 'Sense planning'}</strong></div><div><span>Sessions</span><strong>${completed} / ${allPlanned.length} completades</strong></div><div><span>Pendents</span><strong>${Math.max(0, allPlanned.length - completed)}</strong></div><div><span>Activitats no planificades</span><strong>${unplannedWeek}</strong></div><div><span>Km reals</span><strong>${fmt(realWeek.reduce((total, session) => total + (session.distancia || 0), 0))} km</strong></div></div>`;
    const upcoming = document.getElementById('today-upcoming');
    if (upcoming) {
      const future = allPlanned.filter(item => item.day > day).sort((a, b) => a.day - b.day).slice(0, 3);
      upcoming.innerHTML = `<div class="panel-header"><div><p class="eyebrow">A continuació</p><h3>Properes sessions</h3></div></div>${future.length ? `<div class="today-upcoming-list">${future.map(item => { const real = linkedActivity(item, sessions); return `<div class="today-upcoming-item"><div><span>${['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'][item.day] || 'Properament'}</span><strong>${esc(item.title || typeLabels[item.type] || 'Sessió')}</strong><small>${esc(item.detail || '')}</small></div><b class="${real || item.status === 'done' ? 'is-complete' : ''}">${real || item.status === 'done' ? 'Completada' : 'Pendent'}</b></div>`; }).join('')}</div>` : '<p class="today-empty-upcoming">No hi ha més sessions assignades aquesta setmana.</p>'}`;
      upcoming.innerHTML = `<div class="panel-header"><div><p class="eyebrow">A continuació</p><h3>Properes sessions</h3></div></div>${future.length ? `<div class="today-upcoming-list">${future.map(item => { const real = linkedActivity(item, realWeek); return `<div class="today-upcoming-item"><div><span>${['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'][item.day] || 'Properament'}</span><strong>${esc(item.title || typeLabels[item.type] || 'Sessió')}</strong><small>${esc(item.detail || '')}</small></div><b class="${real || item.status === 'done' ? 'is-complete' : ''}">${real || item.status === 'done' ? 'Completada' : 'Pendent'}</b></div>`; }).join('')}</div>` : '<p class="today-empty-upcoming">No hi ha més sessions assignades aquesta setmana.</p>'}`;
    }
    if (!detailBound) {
      document.getElementById('today-hero')?.addEventListener('click', event => {
        const context = detailContext;
        const planningCard = event.target.closest('[data-today-planning-session-id]');
        if (planningCard && context) {
          const row = context.plannedWithReal.find(candidate => (candidate.item.planning_session_id || candidate.item.id) === planningCard.dataset.todayPlanningSessionId);
          const plannedSession = row?.plannedSession || row?.item;
          if (plannedSession) window.openPlannedSessionDetail?.(plannedSession, row?.real || null, { dateLabel: dateText(context.today), rangeLabel: context.week.planning?.setmana || '' });
          return;
        }
        const activityCard = event.target.closest('[data-today-activity-id]');
        if (activityCard && context) {
          const activity = context.unplanned.find(session => (session.raw?.__activity?.id || session.id || '') === activityCard.dataset.todayActivityId);
          if (activity) window.openSessionDetailDrawer?.(activity, { dateLabel: dateText(context.today) });
        }
      });
      document.getElementById('today-hero')?.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[data-today-planning-session-id],[data-today-activity-id]')) { event.preventDefault(); event.target.click(); }
      });
      detailBound = true;
    }
    if (!bound) { document.getElementById('today-open-week')?.addEventListener('click', () => window.navigateTo && window.navigateTo('planning')); bound = true; }
  }
  window.renderTodayView = renderTodayView;
})();
