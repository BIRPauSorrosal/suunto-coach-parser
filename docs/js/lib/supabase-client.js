// Client Supabase compartit per les vistes i els proveïdors de dades.
// Supabase JS es carrega abans d'aquest fitxer des de l'index estàtic.
(function (global) {
  let client = null;

  function getClient() {
    if (client) return client;

    const sdk = global.supabase;
    const config = global.SupabaseConfig;
    if (!sdk?.createClient) {
      throw new Error('Supabase JS no està disponible');
    }
    if (!config?.url || !config?.publishableKey) {
      throw new Error('La configuració de Supabase és incompleta');
    }

    client = sdk.createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    return client;
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  global.SupabaseClient = Object.freeze({
    getClient,
    getSession,
    isConfigured: () => Boolean(global.SupabaseConfig?.url && global.SupabaseConfig?.publishableKey),
  });
})(window);
