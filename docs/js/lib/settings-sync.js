// Persistència de settings.json via GitHub.
(function (global) {
  const LOCAL_STATE_KEY = 'suunto-coach-settings-state-v1';
  const encode = value => { const bytes = new TextEncoder().encode(value); let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary); };
  const decode = value => { const binary = atob(String(value || '').replace(/\n/g, '')); return new TextDecoder('utf-8').decode(Uint8Array.from(binary, char => char.charCodeAt(0))); };
  const cloneConfig = config => ({ fcMax: config.fcMax, zones: [...config.zones] });
  const readLocalState = () => { try { return JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || 'null'); } catch (_) { return null; } };
  const writeLocalState = (config, status) => { try { localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({ config: cloneConfig(config), status, updated_at: new Date().toISOString() })); } catch (_) {} };
  const preferredHeartRate = remote => {
    const local = readLocalState();
    return local?.status === 'pending' && local.config ? local.config : remote;
  };
  const discardLocal = () => { try { localStorage.removeItem(LOCAL_STATE_KEY); } catch (_) {} };
  async function saveHeartRate(config, fromQueue = false) {
    const token = global.getGitHubToken?.(), cfg = global.DashboardConfig;
    if (!fromQueue) writeLocalState(config, 'pending');

    // Les dades personals van primer a Supabase quan hi ha una sessió activa.
    // Si no hi ha sessió o Supabase encara no està disponible, es manté el
    // fallback existent a GitHub i a la cua offline.
    try {
      const supabaseResult = await global.SupabaseDataProvider?.saveHeartRate(config);
      if (supabaseResult?.status === 'synced') {
        writeLocalState(config, 'synced');
        global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: 'synced', provider: 'supabase' } }));
        return { status: 'synced', provider: 'supabase' };
      }
      if (supabaseResult?.status === 'conflict') {
        if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'settings', key: 'heart_rate', config: cloneConfig(config), conflict: true });
        global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: 'conflict', provider: 'supabase' } }));
        return { status: 'error', error: 'Conflicte de revisió a Supabase' };
      }
    } catch (error) {
      console.warn('[settings-sync] Supabase no disponible; es prova el fallback GitHub:', error.message);
    }

    if (!token) { if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'settings', key: 'heart_rate', config: cloneConfig(config) }); return { status: 'pending' }; }
    try {
      const path = cfg.paths.settings.repository, { owner, repo, branch } = cfg.github;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
      const get = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
      if (!get.ok) throw new Error(`Error llegint settings.json: ${get.status}`);
      const remote = await get.json(), document = JSON.parse(decode(remote.content));
      document.schema_version = 1; document.settings = document.settings || {}; document.settings.heart_rate = { fcMax: config.fcMax, zones: [...config.zones] };
      const put = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '[dashboard] Actualitza zones cardiaques', content: encode(JSON.stringify(document, null, 2) + '\n'), branch, sha: remote.sha }) });
      if (!put.ok) { const error = new Error(`Error pujant settings.json: ${put.status}`); error.conflict = put.status === 409; throw error; }
      writeLocalState(config, 'synced');
      global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: 'synced' } })); if (!fromQueue) global.SyncQueue?.complete({ kind: 'settings', key: 'heart_rate' }); return { status: 'synced' };
    } catch (error) { console.error('[settings-sync]', error); if (fromQueue && error.conflict) global.SyncQueue?.markConflict({ kind: 'settings', key: 'heart_rate' }); if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'settings', key: 'heart_rate', config: { fcMax: config.fcMax, zones: [...config.zones] }, conflict: Boolean(error.conflict) }); global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: error.conflict ? 'conflict' : 'error', error: error.message } })); return { status: 'error', error: error.message }; }
  }
  global.SettingsSync = Object.freeze({ saveHeartRate, preferredHeartRate, discardLocal });
})(window);
