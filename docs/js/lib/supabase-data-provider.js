// Proveïdor de dades Supabase per a dades personals.
(function (global) {
  async function user() {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  function cloneHeartRate(config) {
    return { fcMax: config.fcMax, zones: [...config.zones] };
  }

  async function getHeartRate() {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };

    const { data, error } = await client
      .from('user_settings')
      .select('heart_rate, revision, updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) throw error;
    return data?.heart_rate
      ? { status: 'loaded', config: data.heart_rate, revision: data.revision, updated_at: data.updated_at }
      : { status: 'empty' };
  }

  async function saveHeartRate(config) {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };

    const current = await getHeartRate();
    if (current.status === 'empty') {
      const { data, error } = await client
        .from('user_settings')
        .insert({ user_id: currentUser.id, heart_rate: cloneHeartRate(config), revision: 1 })
        .select('revision, updated_at')
        .single();
      if (error) throw error;
      return { status: 'synced', revision: data.revision, updated_at: data.updated_at };
    }

    if (current.status !== 'loaded') return current;
    const { data, error } = await client
      .from('user_settings')
      .update({ heart_rate: cloneHeartRate(config), revision: current.revision + 1 })
      .eq('user_id', currentUser.id)
      .eq('revision', current.revision)
      .select('revision, updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return { status: 'conflict' };
    return { status: 'synced', revision: data.revision, updated_at: data.updated_at };
  }

  global.SupabaseDataProvider = Object.freeze({ getHeartRate, saveHeartRate });
})(window);
