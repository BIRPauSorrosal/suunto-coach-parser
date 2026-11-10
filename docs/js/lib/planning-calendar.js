// Una sola reconciliació per al calendari setmanal, mensual, Avui i imports.
(function (global) {
  const dayIndex = value => global.DashboardDataService.planningDayIndex(value);
  const isManual = item => item?.source === 'manual' || item?.kind === 'manual' || String(item?.id || '').includes('-manual-');
  const planId = item => item.planning_session_id || item.id;
  const format = value => new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(value);

  function linksFor(activity) {
    const canonical = activity.raw?.__activity || activity;
    try {
      const local = JSON.parse(localStorage.getItem('suunto-coach-session-links-v1') || '{}');
      if (Object.prototype.hasOwnProperty.call(local, canonical.id)) return local[canonical.id] || [];
    } catch (_) { /* Sense cache local. */ }
    return canonical.planning_links || [];
  }

  function linkedActivity(item, activities) {
    return (activities || []).find(activity => linksFor(activity).some(link =>
      link.confidence === 'confirmed' && link.planning_session_id === planId(item))) || null;
  }

  function linkedDay(activity, start) {
    if (!activity) return null;
    const date = new Date(typeof activity.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(activity.date)
      ? `${activity.date}T12:00:00` : activity.date);
    const first = new Date(start);
    const difference = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      - Date.UTC(first.getFullYear(), first.getMonth(), first.getDate())) / 86400000);
    return dayIndex(difference);
  }

  function reconcile(week, stored, activities = [], options = {}) {
    const plan = week.planning || week;
    const key = week.key || plan.start;
    const saved = stored?.items || [];
    const removed = new Set(stored?.removedPlanning || stored?.removed_planning_session_ids || []);
    const applyIds = new Set(options.applySessionIds || []);
    const used = new Set();
    const items = (plan.sessions || []).flatMap(session => {
      const previous = saved.find(item => !isManual(item) && !used.has(item.id) && planId(item) === session.id)
        // Migració de les primeres targetes, anteriors als IDs de sessió.
        || saved.find(item => !isManual(item) && !used.has(item.id)
          && String(item.id).startsWith(`${key}-`) && item.type === session.type);
      const real = linkedActivity(session, activities);
      const complete = previous?.status === 'done' || Boolean(real);
      // Aplicar el fitxer també recupera les sessions pendents ocultades al calendari.
      if (applyIds.has(session.id) && !complete) removed.delete(session.id);
      if (removed.has(session.id) && !complete) return [];
      if (previous) used.add(previous.id);
      const title = activityDisplayLabel(session, true) || activityPlanningLabel(session);
      const detail = [
        session.distance_km ? `${format(session.distance_km)} km` : '',
        session.duration_min ? `${format(session.duration_min)} min` : '',
        session.elevation_m != null ? `${format(session.elevation_m)} m D+` : '',
        session.description || session.label || '',
        session.series ? `${session.series} sèries` : '',
      ].filter(Boolean).join(' · ') || title;
      const importedDay = dayIndex(session.day);
      const savedDay = previous ? dayIndex(previous.day) : importedDay;
      const day = linkedDay(real, week.startDate || plan.start)
        ?? (applyIds.has(session.id) && !complete ? importedDay : savedDay);
      return [{ ...session, id: session.id, planning_session_id: session.id,
        kind: 'planned', source: 'planning', day, title, detail,
        status: complete ? 'done' : 'pending' }];
    });
    // Les activitats manuals i les targetes completades conserven la seva història.
    saved.filter(item => isManual(item) || (!used.has(item.id)
      && (item.status === 'done' || linkedActivity(item, activities))))
      .forEach(item => items.push({ ...item, day: dayIndex(item.day) }));
    return { ...stored, version: 6, week_id: key,
      week_code: plan.code || plan.setmana || stored?.week_code || key,
      items, removedPlanning: [...removed] };
  }

  function read(week, calendar, activities = []) {
    const key = week.key || global.WeekManager.key(week.startDate || week.start);
    const localWeeks = global.CalendarSync?.getLocalWeeks?.() || {};
    const local = localWeeks[key] || localWeeks[week.planning?.setmana || week.planning?.code || week.code];
    const remote = calendar?.weeks?.[key];
    const stored = global.CalendarSync?.preferLocal(local, remote) || remote || local;
    return reconcile({ ...week, key }, stored, activities);
  }

  global.PlanningCalendar = Object.freeze({ dayIndex, isManual, linksFor, linkedActivity, reconcile, read });
})(window);
