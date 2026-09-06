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

  async function savePlanningLinks(sessionId, planningLinks) {
    const config = global.DashboardConfig, token = global.getGitHubToken?.();
    if (!token) { global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: 'local-only', sessionId } })); return { status: 'local-only' }; }
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
      if (!put.ok) throw new Error(`Error pujant sessions.json: ${put.status}`);
      global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: 'synced', sessionId } }));
      return { status: 'synced' };
    } catch (error) {
      console.error('[sessions-sync]', error);
      global.dispatchEvent(new CustomEvent('sessions-sync-status', { detail: { status: 'error', sessionId, error: error.message } }));
      return { status: 'error', error: error.message };
    }
  }

  global.SessionsSync = Object.freeze({ savePlanningLinks });
})(window);
