// Pantalla inicial contextual. Resumeix el dia i manté el calendari setmanal com a lloc d'edició.
(function () {
  let bound = false;
  const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmt = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(Number(value)) : '--';
  const dateKey = value => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
  const dateText = date => new Intl.DateTimeFormat('ca-ES', { weekday:'long', day:'numeric', month:'long' }).format(date);
  const typeLabels = { quality:'Qualitat', z2:'Z2', long:'Tirada llarga', 'long-run':'Tirada llarga', strength:'Força', bici:'Bici estàtica', cycling:'Bici', other:'Altres' };

  function readLocalCalendar() {
    try { return JSON.parse(localStorage.getItem('suunto-coach-calendar-local-v1') || '{}')?.weeks || {}; } catch (_) { return {}; }
  }

  function linksFor(session) {
    if (session.raw?.__activity?.planning_links?.length) return session.raw.__activity.planning_links;
    try {
      const links = JSON.parse(localStorage.getItem('suunto-coach-session-links-v1') || '{}');
      return links[session.raw?.__activity?.id] || [];
    } catch (_) { return []; }
  }

  function plannedItems(week, calendarDocument) {
    const local = readLocalCalendar()[week.key];
    const source = local || calendarDocument?.weeks?.[week.key];
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

  function actualDetails(session) {
    return [session.distancia ? `${fmt(session.distancia)} km` : '', session.durada ? `${fmt(session.durada)} min` : ''].filter(Boolean).join(' · ') || 'Dades no disponibles';
  }

  function plannedCard(item, real) {
    const title = item.title || typeLabels[item.type] || 'Sessió planificada';
    const detail = [item.detail && item.detail !== title ? item.detail : '', item.variant || '', item.distance_km ? `${fmt(item.distance_km)} km` : '', item.duration_min ? `${fmt(item.duration_min)} min` : ''].filter(Boolean).join(' · ') || title;
    return `<article class="today-session-card${real || item.status === 'done' ? ' is-complete' : ''}"><div><span class="today-session-status">${real || item.status === 'done' ? '✓ Completada' : 'Pendent'}</span><h4>${esc(title)}</h4><p>${esc(detail)}</p></div>${real ? `<div class="today-real-detail"><span>Activitat real</span><strong>${esc(real.tipus || 'Activitat')} · ${esc(actualDetails(real))}</strong></div>` : ''}</article>`;
  }

  function unplannedCard(session) {
    return `<article class="today-session-card today-session-card--unplanned"><div><span class="today-session-status">Activitat no planificada</span><h4>${esc(session.tipus || 'Activitat')}</h4><p>${esc(actualDetails(session))}</p></div></article>`;
  }

  function renderTodayView(sessions, planning) {
    const weeks = window.WeekManager.timeline(planning, sessions), index = window.WeekManager.findCurrent(weeks), week = weeks[index];
    if (!week) return;
    const calendar = window.dashboardStore?.getState?.().calendar;
    const today = new Date(), todayKey = dateKey(today), actual = sessions.filter(session => dateKey(session.date) === todayKey);
    const day = Math.max(0, Math.min(6, Math.round((new Date(todayKey+'T12:00:00') - new Date(dateKey(week.startDate)+'T12:00:00')) / 86400000)));
    const planned = plannedItems(week, calendar).filter(item => item.day === day);
    const plannedWithReal = planned.map(item => ({ item, real: linkedActivity(item, sessions) }));
    const linkedIds = new Set(plannedWithReal.filter(row => row.real).map(row => row.real.raw?.__activity?.id));
    const unplanned = actual.filter(session => !linkedIds.has(session.raw?.__activity?.id));
    const dateEl = document.getElementById('today-date-label'); if (dateEl) dateEl.textContent = dateText(today);
    const badge = document.getElementById('today-status-badge');
    if (badge) badge.textContent = planned.length && plannedWithReal.every(row => row.real || row.item.status === 'done') ? 'Dia completat' : actual.length ? 'Activitat registrada' : planned.length ? 'Sessió pendent' : 'Descans';
    const hero = document.getElementById('today-hero');
    if (hero) {
      const content = [...plannedWithReal.map(row => plannedCard(row.item, row.real)), ...unplanned.map(unplannedCard)];
      hero.innerHTML = `<p class="eyebrow">Què toca avui?</p><h3>${planned.length ? (planned.length === 1 ? 'Sessió del dia' : `${planned.length} sessions del dia`) : (unplanned.length ? 'Activitat registrada' : 'Dia de descans')}</h3>${content.length ? `<div class="today-session-list">${content.join('')}</div>` : `<p class="today-hero-detail">No hi ha cap activitat planificada ni registrada.</p>`}<p class="today-hero-note">${unplanned.length ? 'Aquesta activitat no estava planificada, però queda registrada en la seva data.' : planned.length ? 'Les associacions amb activitats reals es gestionen des del calendari setmanal.' : 'Consulta el calendari si vols afegir o reorganitzar una activitat.'}</p>`;
    }
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
    if (!bound) { document.getElementById('today-open-week')?.addEventListener('click', () => window.navigateTo && window.navigateTo('planning')); bound = true; }
  }
  window.renderTodayView = renderTodayView;
})();
