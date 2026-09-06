// Persistència de settings.json via GitHub.
(function (global) {
  const encode = value => { const bytes = new TextEncoder().encode(value); let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary); };
  const decode = value => { const binary = atob(String(value || '').replace(/\n/g, '')); return new TextDecoder('utf-8').decode(Uint8Array.from(binary, char => char.charCodeAt(0))); };
  async function saveHeartRate(config) {
    const token = global.getGitHubToken?.(), cfg = global.DashboardConfig;
    if (!token) return { status: 'local-only' };
    try {
      const path = cfg.paths.settings.repository, { owner, repo, branch } = cfg.github;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
      const get = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
      if (!get.ok) throw new Error(`Error llegint settings.json: ${get.status}`);
      const remote = await get.json(), document = JSON.parse(decode(remote.content));
      document.schema_version = 1; document.settings = document.settings || {}; document.settings.heart_rate = { fcMax: config.fcMax, zones: [...config.zones] };
      const put = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '[dashboard] Actualitza zones cardiaques', content: encode(JSON.stringify(document, null, 2) + '\n'), branch, sha: remote.sha }) });
      if (!put.ok) throw new Error(`Error pujant settings.json: ${put.status}`);
      global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: 'synced' } })); return { status: 'synced' };
    } catch (error) { console.error('[settings-sync]', error); global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: 'error', error: error.message } })); return { status: 'error', error: error.message }; }
  }
  global.SettingsSync = Object.freeze({ saveHeartRate });
})(window);
