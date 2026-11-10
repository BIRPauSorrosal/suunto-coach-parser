// Importació i persistència del planning personal a Supabase.
// No conté manipulació del DOM ni cap escriptura a GitHub o CSV.

let _pendingMerge = null;
let _planningSelectionVersion = 0;

function getPendingMerge() {
  return _pendingMerge;
}

function clearPendingMerge() {
  _pendingMerge = null;
  _planningSelectionVersion++;
}

// Comparació semàntica: l'ordre de les propietats i els camps derivats no són canvis.
function planningComparable(value) {
  if (Array.isArray(value)) return value.map(planningComparable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => !key.startsWith('__') && value[key] !== undefined)
    .map(key => [key, planningComparable(value[key])]));
  return value;
}

function planningEqual(left, right) {
  return JSON.stringify(planningComparable(left)) === JSON.stringify(planningComparable(right));
}

function planningWeekSnapshot(document, id) {
  const normalized = window.DashboardDataService.normalizePlanningDocument(document);
  const cycle = normalized.cycles.find(item => item.weeks.some(week => week.id === id));
  if (!cycle) return null;
  const week = cycle.weeks.find(item => item.id === id);
  return {
    cycle: { id: cycle.id, name: cycle.name, start: cycle.start || null, end: cycle.end || null },
    week: { id: week.id, code: week.code, start: week.start, end: week.end, phase: week.phase,
      summary: week.summary || {}, sessions: [...week.sessions].sort((a, b) => a.id.localeCompare(b.id)) },
  };
}

function planningCalendarSnapshot(value) {
  return { items: [...(value?.items || [])].sort((a, b) => a.id.localeCompare(b.id)),
    removedPlanning: [...(value?.removedPlanning || [])].sort() };
}

function mergePlanningDocuments(existing, incoming, options = {}) {
  const normalize = value => window.DashboardDataService.normalizePlanningDocument(value);
  const normalizedIncoming = normalize(incoming);
  const document = normalize(existing || { schema_version: 1, season: incoming.season, cycles: [] });
  const mode = options.mode === 'replace-weeks' ? 'replace-weeks' : 'update-sessions';
  const stats = { added: 0, replaced: 0, unchanged: 0 };
  const sessionStats = { added: 0, updated: 0, deleted: 0 };
  const annotated = [];
  normalizedIncoming.cycles.forEach(incomingCycle => {
    let cycle = document.cycles.find(item => item.id === incomingCycle.id);
    if (!cycle) {
      cycle = { ...incomingCycle, weeks: [] };
      document.cycles.push(cycle);
    }
    incomingCycle.weeks.forEach(incomingWeek => {
      const owner = document.cycles.find(item => item.weeks.some(week => week.id === incomingWeek.id));
      const oldWeek = owner?.weeks.find(week => week.id === incomingWeek.id);
      const oldSessions = new Map((oldWeek?.sessions || []).map(session => [session.id, session]));
      const incomingIds = new Set(incomingWeek.sessions.map(session => session.id));
      const changes = incomingWeek.sessions.map(session => {
        const old = oldSessions.get(session.id);
        const status = !old ? 'added' : planningEqual(old, session) ? 'unchanged' : 'updated';
        if (status !== 'unchanged') sessionStats[status]++;
        return { session, status };
      });
      const deleted = mode === 'replace-weeks'
        ? (oldWeek?.sessions || []).filter(session => !incomingIds.has(session.id)) : [];
      sessionStats.deleted += deleted.length;
      const week = mode === 'replace-weeks' || !oldWeek ? incomingWeek : {
        ...oldWeek, ...incomingWeek,
        summary: { ...oldWeek.summary, ...incomingWeek.summary },
        sessions: [...incomingWeek.sessions, ...oldWeek.sessions.filter(session => !incomingIds.has(session.id))],
      };
      const status = !oldWeek ? 'added'
        : planningEqual(oldWeek, week) && owner.id === cycle.id ? 'unchanged' : 'replaced';
      if (owner) owner.weeks = owner.weeks.filter(item => item.id !== week.id);
      cycle.weeks.push(week);
      stats[status]++;
      const distances = week.sessions.filter(session => activityClassification(session).sport === 'running')
        .map(session => session.distance_km).filter(Number.isFinite);
      const totalKm = distances.reduce((sum, value) => sum + value, 0);
      const target = week.summary?.weekly_km_target;
      annotated.push({ row: { Setmana: week.code, Data_Inici: week.start, Data_Fi: week.end },
        status, cycle, week, changes, deleted,
        kmWarning: Number.isFinite(target) && distances.length && Math.abs(target - totalKm) > 0.05
          ? { target, total: totalKm } : null,
        importedIds: [...incomingIds] });
    });
  });
  document.cycles = document.cycles.filter(cycle => cycle.weeks.length);
  document.cycles.forEach(cycle => cycle.weeks.sort((a, b) => a.start.localeCompare(b.start)));
  document.cycles.sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
  return { document, stats, sessionStats, incoming: annotated, mode,
    dayPolicy: options.dayPolicy === 'preserve' ? 'preserve' : 'apply' };
}

function preparePlanningMerge(incoming, options = {}, state = window.dashboardStore.getState()) {
  const merge = mergePlanningDocuments(state.planningDocument, incoming, options);
  window.DashboardDataService.assertPlanningDocument(merge.document);
  merge.original = state.planningDocument || { schema_version: 1, cycles: [] };
  merge.input = incoming;
  merge.calendarBefore = state.calendar || { weeks: {} };
  merge.calendarChanges = merge.incoming.map(item => {
    const key = item.week.start;
    const week = { key, startDate: new Date(`${key}T12:00:00`), planning: item.week };
    const previous = merge.calendarBefore.weeks?.[key];
    const next = window.PlanningCalendar.reconcile(week, previous, state.sessionsDocument?.sessions || [], {
      applySessionIds: merge.dayPolicy === 'apply' ? item.importedIds : [],
    });
    const before = new Map((previous?.items || []).map(card => [card.planning_session_id || card.id, card]));
    item.days = next.items.filter(card => before.has(card.id) && before.get(card.id).day !== card.day)
      .map(card => ({ id: card.id, from: before.get(card.id).day, to: card.day }));
    return { key, week, previous, next,
      changed: !planningEqual(planningCalendarSnapshot(previous), planningCalendarSnapshot(next)) };
  });
  merge.hasChanges = merge.stats.added + merge.stats.replaced > 0 || merge.calendarChanges.some(item => item.changed);
  return merge;
}

function updatePlanningImportOptions(options) {
  if (!_pendingMerge) return null;
  _pendingMerge = preparePlanningMerge(_pendingMerge.input, options);
  return _pendingMerge;
}

async function handlePlanningFileSelection(file, onDone, options = {}) {
  const version = ++_planningSelectionVersion;
  _pendingMerge = null;
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.json')) {
    onDone({ ok: false, error: 'El fitxer ha de tenir extensió .json.' });
    return;
  }
  try {
    const text = await readPlanningFileAsText(file);
    if (version !== _planningSelectionVersion) return;
    const incoming = window.DashboardDataService.parsePlanningJSON(text);
    _pendingMerge = preparePlanningMerge(incoming, options);
    onDone({ ok: true, merge: _pendingMerge });
  } catch (error) {
    if (version === _planningSelectionVersion) onDone({ ok: false, error: error.message });
  }
}

async function confirmPlanningImport(onComplete) {
  if (!_pendingMerge?.hasChanges) return { ok: false };
  const merge = _pendingMerge;
  let success = false;
  try {
    const provider = window.SupabaseDataProvider;
    const freshPlanning = await provider.getPlanning();
    const freshCalendar = await provider.getCalendarWeeks();
    if (![freshPlanning, freshCalendar].every(result => ['loaded', 'empty'].includes(result.status))) {
      throw new Error('Cal una sessió activa i connexió amb Supabase per importar.');
    }
    for (const item of merge.incoming) {
      if (!planningEqual(planningWeekSnapshot(merge.original, item.week.id),
        planningWeekSnapshot(freshPlanning.document, item.week.id))) {
        throw new Error(`La setmana ${item.week.code} ha canviat. Torna a seleccionar el fitxer per revisar els canvis.`);
      }
    }
    for (const change of merge.calendarChanges) {
      const local = window.CalendarSync?.getLocalWeeks?.()[change.key];
      const remote = freshCalendar.weeks?.[change.key];
      if (local?.sync_status === 'pending') throw new Error(`Hi ha moviments pendents de sincronitzar a ${change.key}.`);
      if (!planningEqual(planningCalendarSnapshot(change.previous), planningCalendarSnapshot(remote))
        || (change.previous?.revision ?? null) !== (remote?.revision ?? null)) {
        throw new Error(`El calendari de ${change.key} ha canviat. Torna a seleccionar el fitxer.`);
      }
    }
    const changedWeekIds = merge.incoming.filter(item => item.status !== 'unchanged').map(item => item.week.id);
    if (changedWeekIds.length) {
      const result = await provider.upsertPlanning(merge.document, {
        weekIds: changedWeekIds, replaceWeeks: merge.mode === 'replace-weeks',
      });
      if (result?.status !== 'synced') throw new Error('No s’ha pogut desar el planning a Supabase.');
    }
    for (const change of merge.calendarChanges.filter(item => item.changed)) {
      const result = await provider.saveCalendarWeek(change.week, change.next);
      if (result?.status !== 'synced') {
        throw new Error(`No s’ha pogut actualitzar el calendari de ${change.key}${result?.status === 'conflict' ? ' per un canvi concurrent' : ''}. Revisa les dades abans de repetir la importació.`);
      }
      window.CalendarSync?.acceptRemoteWeek(change.key, { ...change.next, ...result, sync_status: 'synced' });
    }
    const verifiedPlanning = await provider.getPlanning();
    const verifiedCalendar = await provider.getCalendarWeeks();
    if (![verifiedPlanning, verifiedCalendar].every(result => ['loaded', 'empty'].includes(result.status))) {
      throw new Error('No s’ha pogut verificar la importació llegint Supabase. Torna a carregar les dades.');
    }
    for (const item of merge.incoming) {
      if (!planningEqual(planningWeekSnapshot(merge.document, item.week.id),
        planningWeekSnapshot(verifiedPlanning.document, item.week.id))) {
        throw new Error(`La verificació del planning ha fallat a ${item.week.code}. Revisa les dades abans de repetir la importació.`);
      }
    }
    for (const change of merge.calendarChanges) {
      const remote = verifiedCalendar.weeks?.[change.key];
      if (!planningEqual(planningCalendarSnapshot(change.next), planningCalendarSnapshot(remote))) {
        throw new Error(`La verificació del calendari ha fallat a ${change.key}.`);
      }
      window.CalendarSync?.acceptRemoteWeek(change.key, remote);
    }
    const state = window.dashboardStore.getState();
    window.dashboardStore.setData({ ...state, planningDocument: verifiedPlanning.document,
      planning: window.DashboardDataService.normalizePlanningJSON(verifiedPlanning.document),
      calendar: { schema_version: 1, weeks: verifiedCalendar.weeks || {} },
      sources: { ...state.sources, planning: 'supabase', calendar: 'supabase' } });
    window.refreshDashboardUI?.();
    success = true;
    showNotice(`Planning verificat a Supabase: ${merge.stats.added} setmanes noves, ${merge.stats.replaced} actualitzades.`);
    _pendingMerge = null;
    onComplete?.();
  } catch (error) {
    console.error(error);
    showNotice(`❌ ${error.message}`, true);
  }
  window.DashboardComponents?.showToast({ type: success ? 'success' : 'error',
    message: success ? 'Planning i calendari importats i verificats.' : 'La importació no s’ha completat. Revisa el missatge d’error.' });
  return { ok: success, stats: merge.stats };
}

function readPlanningFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = () => reject(new Error(`Error llegint ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}
