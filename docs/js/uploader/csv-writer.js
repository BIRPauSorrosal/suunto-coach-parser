// Persistència de la importació d’activitats a Supabase.
// El nom del fitxer es manté temporalment per compatibilitat amb index.html.

function sessionDocumentFromRows(rows) {
  return rows.map(row => row.__session).filter(session => session && session.id);
}

function showNotice(msg, isError = false) {
  const bar = document.getElementById('notice-bar');
  const text = document.getElementById('notice-text');
  if (!bar || !text) return;

  text.textContent = msg;
  bar.style.display = 'block';
  bar.style.background = isError ? 'var(--color-error, #c0392b)' : '';
  setTimeout(() => { bar.style.display = 'none'; }, 5000);
}

async function appendRowsToSupabase(newRows) {
  if (!newRows.length) return { ok: false, error: 'No hi ha activitats noves per importar.' };

  try {
    showNotice('Consultant activitats actuals a Supabase...');
    const current = await window.SupabaseDataProvider?.getActivities?.();
    if (!['loaded', 'empty'].includes(current?.status)) {
      throw new Error('No s’han pogut consultar les activitats a Supabase. Inicia sessió i torna-ho a provar.');
    }

    const existing = Array.isArray(current.activities) ? current.activities : [];
    const existingIds = new Set(existing.map(session => session.id));
    const existingFingerprints = new Set(existing.map(session => session.source_fingerprint).filter(Boolean));
    const duplicates = [];
    const additions = [];
    const parsedSessions = sessionDocumentFromRows(newRows);
    if (parsedSessions.length !== newRows.length) {
      throw new Error('S’ha aturat la importació: falta la conversió JSON d’una activitat');
    }

    // Comprovem el contracte després que l'usuari hagi editat la
    // classificació, abans de decidir duplicats o escriure a Supabase.
    const dataService = window.DashboardDataService;
    if (typeof dataService?.assertSessionsDocument !== 'function') {
      throw new Error('El validador d’activitats no està disponible. Torna a carregar l’aplicació.');
    }
    dataService.assertSessionsDocument({
      schema_version: 1,
      source: 'suunto',
      sessions: parsedSessions,
    });

    parsedSessions.forEach(session => {
      const duplicateById = existingIds.has(session.id);
      const duplicateByContent = Boolean(session.source_fingerprint && existingFingerprints.has(session.source_fingerprint));
      if (duplicateById || duplicateByContent) {
        duplicates.push(session.id);
      } else {
        additions.push(session);
        existingIds.add(session.id);
        if (session.source_fingerprint) existingFingerprints.add(session.source_fingerprint);
      }
    });

    let added = 0;
    if (additions.length) {
      const result = await window.SupabaseDataProvider?.upsertActivities(additions);
      if (result?.status !== 'synced') {
        throw new Error('No s’han pogut sincronitzar les activitats a Supabase. Inicia sessió i torna-ho a provar.');
      }
      added = Number.isInteger(result.count) ? result.count : additions.length;
      // L'insert és atòmic i no sobreescriu conflictes. Tornem a llegir per
      // conservar al store l'autoritat remota si una altra pestanya ha escrit
      // simultàniament.
      const refreshed = await window.SupabaseDataProvider?.getActivities?.();
      if (!['loaded', 'empty'].includes(refreshed?.status)) {
        throw new Error('Les activitats s’han desat però no s’han pogut confirmar a Supabase. Actualitza el dashboard abans de continuar.');
      }
      existing.splice(0, existing.length, ...(refreshed.activities || []));
    }

    const document = { schema_version: 1, source: 'suunto', sessions: existing };
    window.dashboardStore?.setData?.({
      ...window.dashboardStore.getState(),
      sessions: window.DashboardDataService.normalizeSessionsJSON(document),
      sessionsDocument: document,
    });
    const concurrentDuplicates = Math.max(0, additions.length - added);
    const totalDuplicates = duplicates.length + concurrentDuplicates;
    showNotice(`${added} activitats sincronitzades a Supabase${totalDuplicates ? ` (${totalDuplicates} duplicats ignorats)` : ''}.`);
    return { ok: true, added, duplicates: totalDuplicates, provider: 'supabase' };
  } catch (err) {
    console.error(err);
    showNotice(`❌ Error: ${err.message}`, true);
    return { ok: false, error: err.message };
  }
}
