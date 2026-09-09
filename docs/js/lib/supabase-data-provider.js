// Proveïdor de dades Supabase per a dades personals.
(function (global) {
  async function user() {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (error.name === 'AuthSessionMissingError' || /auth session missing/i.test(error.message || '')) return null;
      throw error;
    }
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

  async function getCalendarWeeks() {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };

    const { data, error } = await client
      .from('calendar_weeks')
      .select('week_id, week_code, items, removed_planning_session_ids, revision, updated_at')
      .eq('user_id', currentUser.id)
      .order('week_id');
    if (error) throw error;

    const weeks = Object.fromEntries((data || []).map(row => [row.week_id, {
      version: 5,
      week_id: row.week_id,
      week_code: row.week_code,
      items: Array.isArray(row.items) ? row.items : [],
      removedPlanning: Array.isArray(row.removed_planning_session_ids) ? row.removed_planning_session_ids : [],
      revision: row.revision,
      updated_at: row.updated_at,
      sync_status: 'synced',
    }]));
    return { status: data?.length ? 'loaded' : 'empty', weeks };
  }

  async function saveCalendarWeek(week, value) {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };

    const weekId = week.key;
    const payload = {
      user_id: currentUser.id,
      week_id: weekId,
      week_code: value.week_code || week.planning?.setmana || weekId,
      items: Array.isArray(value.items) ? value.items : [],
      removed_planning_session_ids: value.removedPlanning || value.removed_planning_session_ids || [],
    };
    const { data: current, error: readError } = await client
      .from('calendar_weeks')
      .select('revision')
      .eq('user_id', currentUser.id)
      .eq('week_id', weekId)
      .maybeSingle();
    if (readError) throw readError;

    if (!current) {
      const { data, error } = await client
        .from('calendar_weeks')
        .insert({ ...payload, revision: 1 })
        .select('revision, updated_at')
        .single();
      if (error) throw error;
      return { status: 'synced', revision: data.revision, updated_at: data.updated_at };
    }

    const { data, error } = await client
      .from('calendar_weeks')
      .update({ ...payload, revision: current.revision + 1 })
      .eq('user_id', currentUser.id)
      .eq('week_id', weekId)
      .eq('revision', current.revision)
      .select('revision, updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return { status: 'conflict' };
    return { status: 'synced', revision: data.revision, updated_at: data.updated_at };
  }

  global.SupabaseDataProvider = Object.freeze({
    getHeartRate,
    saveHeartRate,
    getCalendarWeeks,
    saveCalendarWeek,
  });
})(window);
