// Persistencia del calendari personal a Supabase.
(function (global) {
  const STORE_KEY = 'suunto-coach-calendar-local-v1';
  const LEGACY_STORE_KEY = 'suunto-coach-weekly-calendar-v2';
  const saveChains = new Map();
  const acknowledgedRevisions = new Map();
  const normalizeItem = item => ({
    ...item,
    kind: item.kind || (item.source === 'manual' ? 'manual' : 'planned'),
    planning_session_id: item.planning_session_id ?? (item.source === 'manual' ? null : item.id),
  });

  const preferLocal = (local, remote) => {
    if (!local) return remote;
    if (!remote) return local;
    return local.sync_status === 'pending' || (local.updated_at && local.updated_at > remote.updated_at) ? local : remote;
  };

  const discardLocalWeek = key => {
    try {
      const document = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!document?.weeks) return;
      delete document.weeks[key];
      localStorage.setItem(STORE_KEY, JSON.stringify(document));
    } catch (_) {}
  };

  function getLocalWeeks() {
    try {
      const document = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (document?.weeks && typeof document.weeks === 'object') return document.weeks;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY) || 'null');
      return legacy && typeof legacy === 'object' ? legacy : {};
    } catch (_) { return {}; }
  }

  function updateLocalWeek(weekId, value) {
    try {
      const document = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!document?.weeks) return;
      document.weeks[weekId] = value;
      localStorage.setItem(STORE_KEY, JSON.stringify(document));
    } catch (_) {}
  }

  function optionsFor(value) {
    return typeof value === 'object' && value !== null
      ? value
      : { fromQueue: Boolean(value) };
  }

  async function persistWeek(week, value, options = {}) {
    const { fromQueue = false, intent = null } = options;
    const knownRevision = acknowledgedRevisions.get(week.key);
    const valueRevision = Number(value.revision);
    const normalized = {
      ...value,
      // Si aquesta escriptura espera una altra escriptura local ja confirmada,
      // actualitzem la seva base. La fotografia de la UI pot haver estat
      // creada abans de rebre la resposta de la primera escriptura.
      ...(Number.isInteger(knownRevision) && knownRevision > valueRevision ? { revision: knownRevision } : {}),
      items: (value.items || []).map(normalizeItem),
      removedPlanning: value.removedPlanning || value.removed_planning_session_ids || [],
    };
    try {
      const result = await global.SupabaseDataProvider?.saveCalendarWeek(week, normalized);
      if (result?.status === 'synced') {
        if (Number.isInteger(Number(result.revision))) acknowledgedRevisions.set(week.key, Number(result.revision));
        // El servidor és l'autoritat per a data i revisió. Guardar-les evita
        // que una hora local desajustada prevalgui sobre una versió remota.
        const local = (() => {
          try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null')?.weeks?.[week.key]; } catch (_) { return null; }
        })();
        if (local?.updated_at === normalized.updated_at) {
          updateLocalWeek(week.key, {
            ...local,
            revision: result.revision,
            updated_at: result.updated_at,
            sync_status: 'synced',
          });
        }
        global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'synced', week: week.key, provider: 'supabase' } }));
        if (!fromQueue) global.SyncQueue?.complete({ kind: 'calendar', key: week.key });
        return { status: 'synced', provider: 'supabase', revision: result.revision, updated_at: result.updated_at };
      }
      if (result?.status === 'conflict') {
        if (fromQueue) global.SyncQueue?.markConflict({ kind: 'calendar', key: week.key });
        else global.SyncQueue?.enqueue({ kind: 'calendar', key: week.key, week, value: normalized, intent, conflict: true });
        global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'conflict', week: week.key, provider: 'supabase' } }));
        return { status: 'error', error: 'Conflict de revisio a Supabase' };
      }
    } catch (error) {
      console.warn('[calendar-sync] Supabase no disponible; el canvi queda pendent:', error.message);
    }
    if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'calendar', key: week.key, week, value: normalized, intent });
    global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'pending', week: week.key, provider: 'supabase' } }));
    return { status: 'pending', provider: 'supabase' };
  }

  // Cada setmana té una sola escriptura activa. Això evita conflictes creats
  // pel propi navegador quan l'usuari fa dos moviments ràpids consecutius.
  function saveWeek(week, value, options = false) {
    const saveOptions = optionsFor(options);
    const previous = saveChains.get(week.key) || Promise.resolve();
    const task = previous
      .catch(() => undefined)
      .then(() => persistWeek(week, value, saveOptions));
    saveChains.set(week.key, task);
    task.finally(() => {
      if (saveChains.get(week.key) === task) saveChains.delete(week.key);
    });
    return task;
  }

  function rebaseCalendarIntent(remote, intent) {
    if (!intent?.operations?.length) return null;
    const value = {
      ...remote,
      items: [...(remote.items || [])].map(normalizeItem),
      removedPlanning: [...(remote.removedPlanning || remote.removed_planning_session_ids || [])],
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    };
    for (const operation of intent.operations) {
      const index = value.items.findIndex(item => item.id === operation.id);
      if (operation.type === 'add') {
        if (index < 0) value.items.push(normalizeItem(operation.item));
        continue;
      }
      if (operation.type === 'remove') {
        if (index >= 0) value.items.splice(index, 1);
        if (operation.removedPlanningId && !value.removedPlanning.includes(operation.removedPlanningId)) {
          value.removedPlanning.push(operation.removedPlanningId);
        }
        continue;
      }
      if (index < 0) return null;
      if (operation.type === 'move') value.items[index].day = operation.day;
      if (operation.type === 'status') value.items[index].status = operation.status;
    }
    return value;
  }

  async function rebaseOperation(operation) {
    const result = await readSupabase();
    if (!['loaded', 'empty'].includes(result?.status)) return { status: 'unavailable' };
    const remote = result.weeks?.[operation.key];
    if (!remote) return { status: 'unavailable' };
    const value = rebaseCalendarIntent(remote, operation.intent);
    if (!value) return { status: 'unrebaseable' };
    updateLocalWeek(operation.key, value);
    global.dispatchEvent(new CustomEvent('dashboard-local-change', {
      detail: { kind: 'calendar', key: operation.key, rebased: true },
    }));
    return { status: 'rebased', value };
  }

  async function readSupabase() {
    return global.SupabaseDataProvider?.getCalendarWeeks?.() || { status: 'unavailable' };
  }

  global.CalendarSync = Object.freeze({ saveWeek, preferLocal, discardLocalWeek, getLocalWeeks, readSupabase, rebaseOperation });
})(window);
