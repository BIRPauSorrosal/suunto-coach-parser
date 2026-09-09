// Persistència compartida del calendari flexible a calendar.json via GitHub.
(function (global) {
  const encode = value => {
    const bytes = new TextEncoder().encode(value); let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  };
  const decode = value => {
    const binary = atob(String(value || '').replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  };
  const normalizeItem = item => ({
    ...item,
    kind: item.kind || (item.source === 'manual' ? 'manual' : 'planned'),
    planning_session_id: item.planning_session_id ?? (item.source === 'manual' ? null : item.id),
  });
  const toRemoteWeek = (week, value) => ({
    version: value.version || 5,
    week_id: value.week_id || week.key,
    week_code: value.week_code || week.planning?.setmana || week.key,
    updated_at: value.updated_at || new Date().toISOString(),
    items: (value.items || []).map(normalizeItem),
    removed_planning_session_ids: value.removedPlanning || value.removed_planning_session_ids || [],
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

  async function readRemote() {
    const config = global.DashboardConfig, token = global.getGitHubToken?.();
    if (!config?.github || !token) return { document: null, sha: null, localOnly: true };
    const path = config.paths.calendar.repository, { owner, repo, branch } = config.github;
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
    if (response.status === 404) return { document: { schema_version: 1, planning_source: 'planning.json', weeks: {} }, sha: null };
    if (!response.ok) throw new Error(`Error llegint calendar.json: ${response.status}`);
    const json = await response.json();
    return { document: JSON.parse(decode(json.content)), sha: json.sha };
  }

  async function saveWeek(week, value, fromQueue = false) {
    try {
      const supabaseResult = await global.SupabaseDataProvider?.saveCalendarWeek(week, value);
      if (supabaseResult?.status === 'synced') {
        global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'synced', week: week.key, provider: 'supabase' } }));
        if (!fromQueue) global.SyncQueue?.complete({ kind: 'calendar', key: week.key });
        return { status: 'synced', provider: 'supabase' };
      }
      if (supabaseResult?.status === 'conflict') {
        if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'calendar', key: week.key, week, value, conflict: true });
        global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'conflict', week: week.key, provider: 'supabase' } }));
        return { status: 'error', error: 'Conflicte de revisió a Supabase' };
      }
    } catch (error) {
      console.warn('[calendar-sync] Supabase no disponible; es prova el fallback GitHub:', error.message);
    }

    const token = global.getGitHubToken?.();
    if (!token) { if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'calendar', key: week.key, week, value }); global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'pending', week: week.key } })); return { status: 'pending' }; }
    try {
      const remote = await readRemote();
      const document = remote.document || { schema_version: 1, planning_source: 'planning.json', weeks: {} };
      document.schema_version = 1; document.planning_source = 'planning.json'; document.weeks = document.weeks || {};
      document.weeks[week.key] = toRemoteWeek(week, value);
      const config = global.DashboardConfig, { owner, repo, branch } = config.github, path = config.paths.calendar.repository;
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `[dashboard] Actualitza calendari ${week.planning?.setmana || week.key}`, content: encode(JSON.stringify(document, null, 2) + '\n'), branch, ...(remote.sha ? { sha: remote.sha } : {}) }) });
      if (!response.ok) { const error = new Error(`Error pujant calendar.json: ${response.status}`); error.conflict = response.status === 409; throw error; }
      global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: 'synced', week: week.key } }));
      if (!fromQueue) global.SyncQueue?.complete({ kind: 'calendar', key: week.key });
      return { status: 'synced' };
    } catch (error) {
      console.error('[calendar-sync]', error);
      if (fromQueue && error.conflict) global.SyncQueue?.markConflict({ kind: 'calendar', key: week.key });
      if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'calendar', key: week.key, week, value, conflict: Boolean(error.conflict) });
      global.dispatchEvent(new CustomEvent('calendar-sync-status', { detail: { status: error.conflict ? 'conflict' : 'error', error: error.message, week: week.key } }));
      return { status: 'error', error: error.message };
    }
  }

  async function readSupabase() {
    return global.SupabaseDataProvider?.getCalendarWeeks?.() || { status: 'unavailable' };
  }

  global.CalendarSync = Object.freeze({ saveWeek, preferLocal, discardLocalWeek, readSupabase });
})(window);
