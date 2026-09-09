// Persistencia dels enllacos activitat-planning a Supabase.
(function (global) {
  const sameLinks = (left, right) => JSON.stringify(left || []) === JSON.stringify(right || []);

  function localLinks() {
    try {
      const value = JSON.parse(localStorage.getItem('suunto-coach-session-links-v1') || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  }

  function sessionIdentity(session) {
    return session?.raw?.__activity?.id || session?.raw?.__activity?.source_file || session?.id || session?.Arxiu;
  }

  function queueLocalLinks(sessions) {
    const saved = localLinks();
    const operations = [];
    Object.entries(saved).forEach(([sessionId, links]) => {
      if (!Array.isArray(links)) return;
      const session = (sessions || []).find(item => String(sessionIdentity(item)) === String(sessionId));
      if (!session) return;
      const remoteLinks = session.raw?.__activity?.planning_links || [];
      if (!sameLinks(remoteLinks, links)) {
        const operation = { kind: 'sessions', key: sessionId, links };
        global.SyncQueue?.enqueue(operation);
        operations.push(operation);
      }
    });
    if (operations.length) global.SyncQueue?.retry();
    return operations.length;
  }

  function discardLocalLinks(sessionId) {
    try {
      const key = 'suunto-coach-session-links-v1';
      const links = JSON.parse(localStorage.getItem(key) || '{}');
      delete links[sessionId];
      localStorage.setItem(key, JSON.stringify(links));
    } catch (_) {}
  }

  async function savePlanningLinks(sessionId, planningLinks, fromQueue = false) {
    try {
      const result = await global.SupabaseDataProvider?.saveActivityLinks(sessionId, planningLinks);
      if (result?.status === 'synced') {
        global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: 'synced', sessionId, provider: 'supabase' } }));
        if (!fromQueue) global.SyncQueue?.complete({ kind: 'sessions', key: sessionId });
        return { status: 'synced', provider: 'supabase' };
      }
      if (result?.status === 'conflict') {
        if (fromQueue) global.SyncQueue?.markConflict({ kind: 'sessions', key: sessionId });
        else global.SyncQueue?.enqueue({ kind: 'sessions', key: sessionId, links: planningLinks, conflict: true });
        global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: 'conflict', sessionId, provider: 'supabase' } }));
        return { status: 'error', error: 'Conflict de revisio a Supabase' };
      }
    } catch (error) {
      console.warn('[sessions-sync] Supabase no disponible; el canvi queda pendent:', error.message);
    }
    if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'sessions', key: sessionId, links: planningLinks });
    global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: 'pending', sessionId, provider: 'supabase' } }));
    return { status: 'pending', provider: 'supabase' };
  }

  global.SessionsSync = Object.freeze({ savePlanningLinks, queueLocalLinks, discardLocalLinks });
})(window);
