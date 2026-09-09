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

  async function migrateCalendar(document) {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };
    const entries = Object.entries(document?.weeks || {}).filter(([weekId, value]) => weekId && value);
    if (!entries.length) return { status: 'empty', inserted: 0, skipped: 0 };

    const weekIds = entries.map(([weekId]) => weekId);
    const { data: existing, error: existingError } = await client
      .from('calendar_weeks')
      .select('week_id')
      .eq('user_id', currentUser.id)
      .in('week_id', weekIds);
    if (existingError) throw existingError;
    const existingIds = new Set((existing || []).map(row => row.week_id));
    const rows = entries.filter(([weekId]) => !existingIds.has(weekId)).map(([weekId, value]) => ({
      user_id: currentUser.id,
      week_id: weekId,
      week_code: value.week_code || weekId,
      items: Array.isArray(value.items) ? value.items : [],
      removed_planning_session_ids: value.removedPlanning || value.removed_planning_session_ids || [],
      revision: 1,
    }));
    if (rows.length) {
      const { error } = await client.from('calendar_weeks').insert(rows);
      if (error) throw error;
    }
    return { status: 'synced', inserted: rows.length, skipped: entries.length - rows.length };
  }

  async function getActivities() {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };
    const { data, error } = await client
      .from('activities')
      .select('id, payload')
      .eq('user_id', currentUser.id)
      .eq('source', 'suunto')
      .order('activity_date', { ascending: false });
    if (error) throw error;
    const activityRows = (data || []).filter(row => row.payload?.id);
    const activityIds = activityRows.map(row => row.id);
    let linkRows = [];
    if (activityIds.length) {
      const links = await client
        .from('activity_links')
        .select('activity_id, planning_session_id, confidence')
        .eq('user_id', currentUser.id)
        .in('activity_id', activityIds);
      if (links.error) throw links.error;
      linkRows = links.data || [];
    }
    const linksByActivity = new Map(activityIds.map(id => [id, []]));
    linkRows.forEach(link => linksByActivity.get(link.activity_id)?.push({
      planning_session_id: link.planning_session_id,
      confidence: link.confidence,
    }));
    const activities = activityRows.map(row => ({
      ...row.payload,
      planning_links: linksByActivity.get(row.id) || [],
    }));
    return { status: activities.length ? 'loaded' : 'empty', activities };
  }

  async function upsertActivities(activities) {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };
    const rows = (activities || []).filter(item => item?.id).map(item => ({
      user_id: currentUser.id,
      source: 'suunto',
      external_id: String(item.id),
      activity_date: item.date,
      activity_type: item.type,
      sport: item.sport,
      payload: item,
    }));
    if (!rows.length) return { status: 'empty', count: 0 };
    const { error } = await client.from('activities').upsert(rows, { onConflict: 'user_id,source,external_id' });
    if (error) throw error;
    return { status: 'synced', count: rows.length };
  }

  async function saveActivityLinks(externalId, links) {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };
    const { data: activity, error: activityError } = await client
      .from('activities')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('source', 'suunto')
      .eq('external_id', String(externalId))
      .maybeSingle();
    if (activityError) throw activityError;
    if (!activity) return { status: 'unavailable' };
    const { error: deleteError } = await client.from('activity_links').delete()
      .eq('user_id', currentUser.id).eq('activity_id', activity.id);
    if (deleteError) throw deleteError;
    const rows = (Array.isArray(links) ? links : []).filter(link => link?.planning_session_id).map(link => ({
      user_id: currentUser.id,
      activity_id: activity.id,
      planning_session_id: String(link.planning_session_id),
      confidence: link.confidence === 'suggested' ? 'suggested' : 'confirmed',
    }));
    if (rows.length) {
      const { error: insertError } = await client.from('activity_links').insert(rows);
      if (insertError) throw insertError;
    }
    return { status: 'synced', count: rows.length };
  }

  async function migrateSessions(document) {
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return { status: 'unavailable' };
    const currentUser = await user();
    if (!currentUser) return { status: 'unavailable' };
    const sessions = Array.isArray(document?.sessions) ? document.sessions.filter(item => item?.id) : [];
    if (!sessions.length) return { status: 'empty', activities: 0, links: 0 };

    const activityRows = sessions.map(item => ({
      user_id: currentUser.id,
      source: 'suunto',
      external_id: String(item.id),
      activity_date: item.date,
      activity_type: item.type,
      sport: item.sport,
      payload: item,
    }));
    const { error: activitiesError } = await client
      .from('activities')
      .upsert(activityRows, { onConflict: 'user_id,source,external_id' });
    if (activitiesError) throw activitiesError;

    const ids = activityRows.map(row => row.external_id);
    const { data: savedActivities, error: lookupError } = await client
      .from('activities')
      .select('id, external_id')
      .eq('user_id', currentUser.id)
      .eq('source', 'suunto')
      .in('external_id', ids);
    if (lookupError) throw lookupError;
    const activityIds = new Map((savedActivities || []).map(row => [String(row.external_id), row.id]));
    const linkRows = sessions.flatMap(session => (Array.isArray(session.planning_links) ? session.planning_links : [])
      .filter(link => link?.planning_session_id && activityIds.has(String(session.id)))
      .map(link => ({
        user_id: currentUser.id,
        activity_id: activityIds.get(String(session.id)),
        planning_session_id: String(link.planning_session_id),
        confidence: link.confidence === 'suggested' ? 'suggested' : 'confirmed',
      })));
    if (linkRows.length) {
      const { error: linksError } = await client
        .from('activity_links')
        .upsert(linkRows, { onConflict: 'user_id,activity_id,planning_session_id' });
      if (linksError) throw linksError;
    }
    return { status: 'synced', activities: activityRows.length, links: linkRows.length };
  }

  global.SupabaseDataProvider = Object.freeze({
    getHeartRate,
    saveHeartRate,
    getCalendarWeeks,
    saveCalendarWeek,
    migrateCalendar,
    getActivities,
    upsertActivities,
    saveActivityLinks,
    migrateSessions,
  });
})(window);
