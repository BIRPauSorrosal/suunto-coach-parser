// Persistencia del calendari personal a Supabase.
(function (global) {
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
      const storageKey = 'suunto-coach-calendar-local-v1';
      const document = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!document?.weeks) return;
      delete document.weeks[key];
      localStorage.setItem(storageKey, JSON.stringify(document));
    } catch (_) {}
  };

  async function saveWeek(week, value, fromQueue = false) {
    try {
      const normalized = {
        ...value,
        items: (value.items || []).map(normalizeItem),
        removedPlanning: value.removedPlanning || value.removed_planning_session_ids || [],
      };
      const result = await global.SupabaseDataProvider?.saveCalendarWeek(week, normalized);
      if (result?.status === 'synced') {
        global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'synced', week: week.key, provider: 'supabase' } }));
        if (!fromQueue) global.SyncQueue?.complete({ kind: 'calendar', key: week.key });
        return { status: 'synced', provider: 'supabase' };
      }
      if (result?.status === 'conflict') {
        if (fromQueue) global.SyncQueue?.markConflict({ kind: 'calendar', key: week.key });
        else global.SyncQueue?.enqueue({ kind: 'calendar', key: week.key, week, value: normalized, conflict: true });
        global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'conflict', week: week.key, provider: 'supabase' } }));
        return { status: 'error', error: 'Conflict de revisio a Supabase' };
      }
    } catch (error) {
      console.warn('[calendar-sync] Supabase no disponible; el canvi queda pendent:', error.message);
    }
    if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'calendar', key: week.key, week, value });
    global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'pending', week: week.key, provider: 'supabase' } }));
    return { status: 'pending', provider: 'supabase' };
  }

  async function readSupabase() {
    return global.SupabaseDataProvider?.getCalendarWeeks?.() || { status: 'unavailable' };
  }

  global.CalendarSync = Object.freeze({ saveWeek, preferLocal, discardLocalWeek, readSupabase });
})(window);
