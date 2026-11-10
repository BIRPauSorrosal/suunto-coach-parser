// Avui prioritza l'entrenament del dia; l'anàlisi viu a Overview.
(function (global) {
  let detailContext = null;
  let bound = false;
  const esc = value => global.DashboardComponents.escapeHtml(value);
  const fmt = value => new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(value);
  const dateKey = value => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const dateText = date => new Intl.DateTimeFormat('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  const shortDate = date => new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' }).format(date);
  const activityId = session => session.raw?.__activity?.id || session.id;
  const linksFor = session => global.PlanningCalendar.linksFor(session);
  const itemsFor = (week, calendar, sessions) => global.PlanningCalendar.read(week, calendar, sessions).items;
  const linkedActivity = (item, sessions) => global.PlanningCalendar.linkedActivity(item, sessions);

  function sessionMetrics(session) {
    return [
      session.distance_km > 0 ? `${fmt(session.distance_km)} km` : '',
      session.duration_min > 0 ? `${fmt(session.duration_min)} min` : '',
      session.series > 0 ? `${fmt(session.series)} sèries` : '',
    ].filter(Boolean).join(' · ');
  }

  function actualDetails(session) {
    return [session.distancia > 0 ? `${fmt(session.distancia)} km` : '',
      session.durada > 0 ? `${fmt(session.durada)} min` : ''].filter(Boolean).join(' · ');
  }

  function plannedRow(item, week, sessions, date) {
    const plan = week.planning?.sessions?.find(session => session.id === (item.planning_session_id || item.id)) || item;
    return { item, plan, week, date, real: linkedActivity(item, sessions) };
  }

  function plannedCard(row) {
    const { item, plan, real } = row;
    const complete = item.status === 'done' || Boolean(real);
    const title = item.title || activityDisplayLabel(plan, true) || 'Sessió planificada';
    const metrics = sessionMetrics(plan);
    const objective = plan.objective || plan.goal || plan.focus || plan.description || plan.label
      || (item.source === 'manual' ? item.detail : '');
    const id = item.planning_session_id || item.id;
    return `<article class="today-session-card${complete ? ' is-complete' : ''}">
      <div class="today-session-content">
        <span class="today-session-status">${complete ? '✓ Completada' : 'Pendent'}</span>
        <h4>${esc(title)}</h4>
        ${metrics ? `<p class="today-session-metrics">${esc(metrics)}</p>` : ''}
        ${objective && objective !== title ? `<p class="today-session-objective">${esc(objective)}</p>` : ''}
        ${real ? `<div class="today-real-detail"><span>Activitat real</span><strong>${esc(activityDisplayLabel(real, true) || 'Activitat')}${actualDetails(real) ? ` · ${esc(actualDetails(real))}` : ''}</strong></div>` : ''}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-today-planning-session-id="${esc(id)}" aria-label="Veure detall de ${esc(title)}">Veure detall</button>
    </article>`;
  }

  function unplannedCard(session) {
    const title = activityDisplayLabel(session, true) || session.tipus || 'Activitat';
    const metrics = actualDetails(session);
    return `<article class="today-session-card today-session-card--unplanned">
      <div class="today-session-content"><span class="today-session-status">Activitat no planificada</span>
        <h4>${esc(title)}</h4>${metrics ? `<p class="today-session-metrics">${esc(metrics)}</p>` : ''}</div>
      <button type="button" class="btn btn-ghost btn-sm" data-today-activity-id="${esc(activityId(session))}" aria-label="Veure detall de ${esc(title)}">Veure detall</button>
    </article>`;
  }

  function bindActions() {
    if (bound) return;
    const handleClick = event => {
      const context = detailContext;
      if (!context) return;
      if (event.target.closest('[data-today-open-calendar]')) {
        global.openPlanningWeek(context.week.key, context.planning, context.sessions);
        return;
      }
      const plannedButton = event.target.closest('[data-today-planning-session-id]');
      if (plannedButton) {
        const row = context.rows.find(candidate => (candidate.item.planning_session_id || candidate.item.id)
          === plannedButton.dataset.todayPlanningSessionId);
        if (row) global.openPlannedSessionDetail?.(row.plan, row.real, {
          planningItem: row.item, dateLabel: dateText(row.date), rangeLabel: row.week.planning?.setmana || '',
        });
        return;
      }
      const activityButton = event.target.closest('[data-today-activity-id]');
      if (activityButton) {
        const activity = context.unplanned.find(session => String(activityId(session)) === activityButton.dataset.todayActivityId);
        if (activity) global.openSessionDetailDrawer?.(activity, null, { dateLabel: dateText(context.today) });
      }
    };
    document.getElementById('today-hero').addEventListener('click', handleClick);
    document.getElementById('today-upcoming').addEventListener('click', handleClick);
    bound = true;
  }

  function renderTodayView(sessions, planning) {
    const weeks = global.WeekManager.timeline(planning, sessions);
    const week = weeks[global.WeekManager.findCurrent(weeks)];
    if (!week) return;
    const calendar = global.dashboardStore.getState().calendar;
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const todayKey = dateKey(today);
    const day = (today.getDay() + 6) % 7;
    const actual = sessions.filter(session => dateKey(session.date) === todayKey);
    const allPlanned = itemsFor(week, calendar, sessions);
    const planned = allPlanned.filter(item => item.day === day).map(item => plannedRow(item, week, sessions, today))
      .filter(row => !row.real || dateKey(row.real.date) === todayKey);
    const linkedIds = new Set(planned.filter(row => row.real).map(row => activityId(row.real)));
    const unplanned = actual.filter(session => !linkedIds.has(activityId(session)));
    const complete = planned.length > 0 && planned.every(row => row.item.status === 'done' || row.real);
    document.getElementById('today-date-label').textContent = dateText(today);
    document.getElementById('today-status-badge').textContent = complete ? 'Dia completat'
      : actual.length ? 'Activitat registrada' : planned.length ? 'Sessió pendent' : 'Descans';

    const title = planned.length > 1 ? `${planned.length} sessions del dia`
      : planned.length ? 'Sessió del dia' : unplanned.length ? 'Activitat registrada' : 'Dia de descans';
    const content = [...planned.map(plannedCard), ...unplanned.map(unplannedCard)].join('');
    document.getElementById('today-hero').innerHTML = `<p class="eyebrow">Què toca avui?</p><h3>${title}</h3>
      ${content ? `<div class="today-session-list">${content}</div>` : '<p class="today-hero-detail">No hi ha sessions assignades per avui. Pots consultar o organitzar la setmana al calendari.</p>'}
      <div class="today-actions"><button type="button" class="btn btn-primary" data-today-open-calendar>Obrir calendari</button></div>`;

    const realWeek = sessions.filter(session => session.date >= week.startDate && session.date <= week.endDate);
    const completed = allPlanned.filter(item => item.status === 'done' || linkedActivity(item, sessions)).length;
    const unplannedWeek = realWeek.filter(session => !linksFor(session).some(link => link.confidence === 'confirmed')).length;
    const countLabel = allPlanned.length ? `${completed} de ${allPlanned.length} sessions completades` : 'Sense sessions previstes';
    document.getElementById('today-week-context').textContent = [
      `${shortDate(week.startDate)} – ${shortDate(week.endDate)}`,
      week.planning?.setmana, week.planning?.fase,
    ].filter(Boolean).join(' · ');
    document.getElementById('today-week-summary').innerHTML = `
      <p class="today-progress-label">${esc(countLabel)}</p>
      ${allPlanned.length ? `<progress class="today-week-progress" max="${allPlanned.length}" value="${completed}" aria-label="Sessions setmanals completades"></progress>` : ''}
      <div class="today-week-grid">
        <div><span>Pendents</span><strong>${Math.max(0, allPlanned.length - completed)}</strong></div>
        <div><span>Activitats registrades</span><strong>${realWeek.length}</strong></div>
        <div><span>Km reals</span><strong>${fmt(realWeek.reduce((total, session) => total + (session.distancia || 0), 0))} km</strong></div>
        <div><span>No planificades</span><strong>${unplannedWeek}</strong></div>
      </div>`;

    // Les properes sessions també inclouen la setmana següent, especialment en diumenge.
    const upcoming = weeks.filter(candidate => candidate.endDate > today).flatMap(candidate =>
      itemsFor(candidate, calendar, sessions).flatMap(item => {
        if (!Number.isInteger(item.day) || item.status === 'done' || linkedActivity(item, sessions)) return [];
        const date = new Date(candidate.startDate); date.setDate(date.getDate() + item.day); date.setHours(12, 0, 0, 0);
        return date > today ? [plannedRow(item, candidate, sessions, date)] : [];
      })).sort((a, b) => a.date - b.date).slice(0, 3);
    document.getElementById('today-upcoming').innerHTML = `<div class="panel-header"><div><p class="eyebrow">A continuació</p><h3>Properes sessions</h3></div></div>
      ${upcoming.length ? `<div class="today-upcoming-list">${upcoming.map(row => {
        const title = row.item.title || activityDisplayLabel(row.plan, true) || 'Sessió planificada';
        const metrics = sessionMetrics(row.plan);
        return `<article class="today-upcoming-item"><div><span>${esc(dateText(row.date))}</span><strong>${esc(title)}</strong>${metrics ? `<small>${esc(metrics)}</small>` : ''}</div>
          <button type="button" class="btn btn-ghost btn-sm" data-today-planning-session-id="${esc(row.item.planning_session_id || row.item.id)}" aria-label="Veure detall de ${esc(title)}, ${esc(dateText(row.date))}">Veure detall</button></article>`;
      }).join('')}</div>` : '<p class="today-empty-upcoming">No hi ha més sessions pendents assignades. Consulta el calendari per organitzar les properes.</p>'}`;
    detailContext = { rows: [...planned, ...upcoming], unplanned, today, week, sessions, planning };
    bindActions();
  }

  global.renderTodayView = renderTodayView;
})(window);
