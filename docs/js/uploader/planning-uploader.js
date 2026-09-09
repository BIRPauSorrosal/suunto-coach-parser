// Importació i persistència del planning personal a Supabase.
// No conté manipulació del DOM ni cap escriptura a GitHub o CSV.

let _pendingMerge = null;

function getPendingMerge() {
  return _pendingMerge;
}

function clearPendingMerge() {
  _pendingMerge = null;
}

function readPlanningFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = () => reject(new Error(`Error llegint ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}

function mergePlanningDocuments(existing, incoming) {
  const document = JSON.parse(JSON.stringify(existing || {
    schema_version: 1,
    season: incoming.season,
    cycles: [],
  }));
  const weeksById = new Map(
    document.cycles.flatMap(cycle => (cycle.weeks || []).map(week => [week.id, { cycle, week }]))
  );
  const stats = { added: 0, replaced: 0, unchanged: 0 };
  const annotated = [];

  (incoming.cycles || []).forEach(incomingCycle => {
    let cycle = document.cycles.find(candidate => candidate.id === incomingCycle.id);
    if (!cycle) {
      cycle = { ...incomingCycle, weeks: [] };
      document.cycles.push(cycle);
    }

    (incomingCycle.weeks || []).forEach(incomingWeek => {
      const existingEntry = weeksById.get(incomingWeek.id);
      const status = !existingEntry
        ? 'added'
        : JSON.stringify(existingEntry.week) === JSON.stringify(incomingWeek)
          ? 'unchanged'
          : 'replaced';

      if (existingEntry) {
        existingEntry.cycle.weeks = existingEntry.cycle.weeks.map(week =>
          week.id === incomingWeek.id ? incomingWeek : week
        );
      } else {
        cycle.weeks = [...(cycle.weeks || []), incomingWeek];
        weeksById.set(incomingWeek.id, { cycle, week: incomingWeek });
      }

      stats[status]++;
      annotated.push({
        row: {
          Setmana: incomingWeek.code,
          Data_Inici: incomingWeek.start,
          Data_Fi: incomingWeek.end,
        },
        status,
      });
    });
  });

  document.cycles.forEach(cycle => cycle.weeks.sort((a, b) => a.start.localeCompare(b.start)));
  document.cycles.sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
  return { document, stats, incoming: annotated };
}

async function handlePlanningFileSelection(file, onDone) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.json')) {
    onDone({ ok: false, error: 'El fitxer ha de tenir extensió .json.' });
    return;
  }

  try {
    const text = await readPlanningFileAsText(file);
    const incoming = window.DashboardDataService.parsePlanningJSON(text);
    const existing = window.dashboardStore?.getState?.()?.planningDocument;
    const merge = mergePlanningDocuments(existing, incoming);
    _pendingMerge = merge;
    onDone({ ok: true, error: null, merge });
  } catch (error) {
    onDone({ ok: false, error: error.message });
  }
}

async function confirmPlanningImport(onComplete) {
  if (!_pendingMerge) return;

  const merge = _pendingMerge;
  let success = false;
  try {
    const result = await window.SupabaseDataProvider?.upsertPlanning?.(merge.document);
    if (result?.status !== 'synced') {
      throw new Error('No s’ha pogut importar el planning a Supabase. Inicia sessió i torna-ho a provar.');
    }

    showNotice(`Planning importat a Supabase: ${merge.stats.added} noves, ${merge.stats.replaced} actualitzades.`);
    window.dashboardStore?.setPlanningDocument?.(merge.document);
    if (typeof window.refreshDashboard === 'function') {
      await window.refreshDashboard({ silent: true, force: true });
    }
    success = true;
  } catch (error) {
    console.error(error);
    showNotice(`❌ Error: ${error.message}`, true);
  } finally {
    if (success) {
      _pendingMerge = null;
      onComplete?.();
    }
  }

  window.DashboardComponents?.showToast({
    type: success ? 'success' : 'error',
    message: success
      ? `Planning importat: ${merge.stats.added} noves, ${merge.stats.replaced} actualitzades.`
      : 'No s’ha pogut importar el planning. Revisa el format o la connexió.',
  });
  return { ok: success, stats: merge.stats };
}
