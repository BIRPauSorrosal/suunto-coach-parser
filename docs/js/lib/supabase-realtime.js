// Subscripcions Realtime de les dades personals de l'usuari autenticat.
(function (global) {
  let channel = null;

  function stop() {
    if (!channel) return;
    try { global.SupabaseClient?.getClient?.().removeChannel(channel); } catch (_) {}
    channel = null;
  }

  function start(user) {
    stop();
    if (!user) return;
    const client = global.SupabaseClient?.getClient?.();
    if (!client) return;
    const filter = `user_id=eq.${user.id}`;
    const tables = ['user_settings', 'calendar_weeks', 'activities', 'activity_links', 'planning_weeks', 'planning_sessions'];
    channel = client.channel(`personal-coach:${user.id}`);
    tables.forEach(table => {
      channel = channel.on('postgres_changes', {
        event: '*', schema: 'public', table, filter,
      }, payload => {
        global.dispatchEvent(new CustomEvent('supabase-realtime-changed', {
          detail: { table, event: payload.eventType, payload },
        }));
      });
    });
    channel.subscribe(status => {
      global.dispatchEvent(new CustomEvent('supabase-realtime-status', {
        detail: { status },
      }));
    });
  }

  global.SupabaseRealtime = Object.freeze({ start, stop });
})(window);
