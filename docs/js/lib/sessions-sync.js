// Persistència de les associacions confirmades dins de sessions.json via GitHub.
(function (global) {
  const encode = value => {
    const bytes = new TextEncoder().encode(value); let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  };
  const decode = value => {
    const binary = atob(String(value || '').replace(/\n/g, ''));
    return new TextDecoder('utf-8').decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  };

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
    const config = global.DashboardConfig, token = global.getGitHubToken?.();
    if (!token) { if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'sessions', key: sessionId, links: planningLinks }); global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: 'pending', sessionId } })); return { status: 'pending' }; }
    try {
      const path = config.paths.sessions.repository, { owner, repo, branch } = config.github;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
      const get = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
      if (!get.ok) throw new Error(`Error llegint sessions.json: ${get.status}`);
      const remote = await get.json();
      const document = JSON.parse(decode(remote.content));
      const session = (document.sessions || []).find(item => item.id === sessionId || item.source_file === sessionId);
      if (!session) throw new Error(`No s'ha trobat la sessió ${sessionId} a sessions.json`);
      session.planning_links = Array.isArray(planningLinks) ? planningLinks : [];
      const put = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `[dashboard] Associa sessió ${sessionId} al planning`, content: encode(JSON.stringify(document, null, 2) + '\n'), branch, sha: remote.sha }) });
      if (!put.ok) { const error = new Error(`Error pujant sessions.json: ${put.status}`); error.conflict = put.status === 409; throw error; }
      global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: 'synced', sessionId } }));
      if (!fromQueue) global.SyncQueue?.complete({ kind: 'sessions', key: sessionId });
      return { status: 'synced' };
    } catch (error) {
      console.error('[sessions-sync]', error);
      if (fromQueue && error.conflict) global.SyncQueue?.markConflict({ kind: 'sessions', key: sessionId });
      if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'sessions', key: sessionId, links: planningLinks, conflict: Boolean(error.conflict) });
      global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: error.conflict ? 'conflict' : 'error', sessionId, error: error.message } }));
      return { status: 'error', error: error.message };
    }
  }

  global.SessionsSync = Object.freeze({ savePlanningLinks, queueLocalLinks, discardLocalLinks });
})(window);
