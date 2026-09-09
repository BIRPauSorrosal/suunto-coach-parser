// Persistencia de la configuracio personal a Supabase.
(function (global) {
  const LOCAL_STATE_KEY = 'suunto-coach-settings-state-v1';
  const cloneConfig = config => ({ fcMax: config.fcMax, zones: [...config.zones] });
  const readLocalState = () => {
    try { return JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || 'null'); } catch (_) { return null; }
  };
  const writeLocalState = (config, status) => {
    try { localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({ config: cloneConfig(config), status, updated_at: new Date().toISOString() })); } catch (_) {}
  };
  const preferredHeartRate = remote => {
    const local = readLocalState();
    return local?.status === 'pending' && local.config ? local.config : remote;
  };
  const discardLocal = () => {
    try { localStorage.removeItem(LOCAL_STATE_KEY); } catch (_) {}
  };

  async function saveHeartRate(config, fromQueue = false) {
    if (!fromQueue) writeLocalState(config, 'pending');
    try {
      const result = await global.SupabaseDataProvider?.saveHeartRate(config);
      if (result?.status === 'synced') {
        writeLocalState(config, 'synced');
        global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: 'synced', provider: 'supabase' } }));
        return { status: 'synced', provider: 'supabase' };
      }
      if (result?.status === 'conflict') {
        if (fromQueue) global.SyncQueue?.markConflict({ kind: 'settings', key: 'heart_rate' });
        else global.SyncQueue?.enqueue({ kind: 'settings', key: 'heart_rate', config: cloneConfig(config), conflict: true });
        global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: 'conflict', provider: 'supabase' } }));
        return { status: 'error', error: 'Conflict de revisio a Supabase' };
      }
    } catch (error) {
      console.warn('[settings-sync] Supabase no disponible; el canvi queda pendent:', error.message);
    }
    if (!fromQueue) global.SyncQueue?.enqueue({ kind: 'settings', key: 'heart_rate', config: cloneConfig(config) });
    global.dispatchEvent(new CustomEvent('settings-sync-status', { detail: { status: 'pending', provider: 'supabase' } }));
    return { status: 'pending', provider: 'supabase' };
  }

  global.SettingsSync = Object.freeze({ saveHeartRate, preferredHeartRate, discardLocal });
})(window);
