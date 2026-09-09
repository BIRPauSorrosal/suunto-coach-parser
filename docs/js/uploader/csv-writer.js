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
    const duplicates = [];
    const additions = [];
    const parsedSessions = sessionDocumentFromRows(newRows);
    if (parsedSessions.length !== newRows.length) {
      throw new Error('S’ha aturat la importació: falta la conversió JSON d’una activitat');
    }

    parsedSessions.forEach(session => {
      if (existingIds.has(session.id)) duplicates.push(session.id);
      else { additions.push(session); existingIds.add(session.id); }
    });

    if (additions.length) {
      const result = await window.SupabaseDataProvider?.upsertActivities(additions);
      if (result?.status !== 'synced') {
        throw new Error('No s’han pogut sincronitzar les activitats a Supabase. Inicia sessió i torna-ho a provar.');
      }
    }

    const document = { schema_version: 1, source: 'suunto', sessions: [...existing, ...additions] };
    window.dashboardStore?.setData?.({
      ...window.dashboardStore.getState(),
      sessions: window.DashboardDataService.normalizeSessionsJSON(document),
      sessionsDocument: document,
    });
    showNotice(`${additions.length} activitats sincronitzades a Supabase${duplicates.length ? ` (${duplicates.length} duplicats ignorats)` : ''}.`);
    return { ok: true, added: additions.length, duplicates: duplicates.length, provider: 'supabase' };
  } catch (err) {
    console.error(err);
    showNotice(`❌ Error: ${err.message}`, true);
    return { ok: false, error: err.message };
  }
}
