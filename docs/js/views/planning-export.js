// Exportació del planning amb selecció de cicles complets.
// El document exportat manté el contracte planning.json i no modifica el planning operatiu.

(function (global) {
  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const isoDate = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const dateAtNoon = value => {
    const date = new Date(value);
    date.setHours(12, 0, 0, 0);
    return date;
  };

  function dayNumber(value) {
    if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    const index = DAY_KEYS.indexOf(normalized);
    return index >= 0 ? index : null;
  }

  function planningExportEntries(document, calendarDocument) {
    const entries = [];
    (document?.cycles || []).forEach(cycle => (cycle.weeks || []).forEach(week => {
      const sessionsById = new Map((week.sessions || []).map(session => [String(session.id), session]));
      const assigned = new Map();
      const calendarWeek = calendarDocument?.weeks?.[week.id]
        || calendarDocument?.weeks?.[week.start]
        || null;
      (calendarWeek?.items || []).filter(item => item?.source !== 'manual').forEach(item => {
        const id = String(item.planning_session_id || item.id || '');
        if (!sessionsById.has(id)) return;
        assigned.set(id, dayNumber(item.day));
      });

      sessionsById.forEach((session, id) => {
        const day = assigned.has(id) ? assigned.get(id) : dayNumber(session.day);
        const date = day === null
          ? null
          : (() => { const value = dateAtNoon(week.start); value.setDate(value.getDate() + day); return isoDate(value); })();
        const key = date || `unassigned:${week.id}`;
        let entry = entries.find(candidate => candidate.key === key && candidate.cycleId === cycle.id);
        if (!entry) {
          entry = {
            key,
            date,
            day,
            cycleId: cycle.id,
            weekId: week.id,
            weekCode: week.code,
            cycleName: cycle.name,
            sessions: [],
          };
          entries.push(entry);
        }
        entry.sessions.push({ session, day });
      });
    }));
    return entries.sort((left, right) => String(left.date || left.key).localeCompare(String(right.date || right.key)));
  }

  function planningCycleSummaries(document) {
    return (document?.cycles || []).map(cycle => {
      const weeks = cycle.weeks || [];
      const sessions = weeks.reduce((total, week) => total + (week.sessions || []).length, 0);
      return {
        id: String(cycle.id),
        name: cycle.name,
        start: cycle.start || weeks[0]?.start || '',
        end: cycle.end || weeks[weeks.length - 1]?.end || '',
        weeks: weeks.length,
        sessions,
      };
    });
  }

  function planningDocumentForSelection(document, entries, selectedCycleIds) {
    const selected = new Set((selectedCycleIds || []).map(String));
    const selectedDays = new Map();
    entries.filter(entry => selected.has(String(entry.cycleId))).forEach(entry => {
      entry.sessions.forEach(({ session, day }) => {
        selectedDays.set(String(session.id), day);
      });
    });

    const cycles = (document?.cycles || [])
      .filter(cycle => selected.has(String(cycle.id)))
      .map(cycle => ({
        ...cycle,
        weeks: (cycle.weeks || []).map(week => ({
          ...week,
          sessions: (week.sessions || []).map(session => {
            const id = String(session.id);
            if (!selectedDays.has(id)) return session;
            const day = dayNumber(selectedDays.get(id));
            return { ...session, day: day === null ? null : DAY_KEYS[day] };
          }),
        })),
      }));

    return {
      schema_version: 1,
      season: document?.season ?? null,
      source: 'planning.json',
      cycles,
    };
  }

  function planningExportEntriesForCycles(document, calendarDocument, cycleIds) {
    const selected = new Set((cycleIds || []).map(String));
    return planningExportEntries(document, calendarDocument)
      .filter(entry => selected.has(String(entry.cycleId)));
  }

  function planningExportCalendarDocument(calendarDocument) {
    const localWeeks = global.CalendarSync?.getLocalWeeks?.() || {};
    if (!Object.keys(localWeeks).length) return calendarDocument;
    const remoteWeeks = calendarDocument?.weeks || {};
    const weeks = { ...remoteWeeks };
    Object.entries(localWeeks).forEach(([key, localWeek]) => {
      weeks[key] = global.CalendarSync?.preferLocal?.(localWeek, remoteWeeks[key]) || localWeek;
    });
    return {
      ...(calendarDocument || {}),
      weeks,
    };
  }

  function planningFilename(cycles) {
    const dates = cycles.flatMap(cycle => [cycle.start, cycle.end, ...(cycle.weeks || []).flatMap(week => [week.start, week.end])])
      .filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .sort();
    const first = dates[0] || 'seleccio';
    const last = dates[dates.length - 1] || first;
    return first === last ? `planning-${first}.json` : `planning-${first}-a-${last}.json`;
  }

  function downloadPlanningDocument(documentData, selectedCycles, selectedEntries) {
    if (!selectedCycles.length) {
      global.DashboardComponents?.showToast({ type: 'warning', message: 'Selecciona almenys un cicle per exportar.' });
      return { ok: false, cycles: 0, sessions: 0 };
    }
    const sessions = selectedEntries.reduce((total, entry) => total + entry.sessions.length, 0);
    const filename = planningFilename(selectedCycles);
    const blob = new Blob([JSON.stringify(documentData, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    global.DashboardComponents?.showToast({
      type: 'success',
      message: `Exportació completada: ${selectedCycles.length} ${selectedCycles.length === 1 ? 'cicle' : 'cicles'} i ${sessions} ${sessions === 1 ? 'sessió planificada' : 'sessions planificades'}.`,
    });
    return { ok: true, cycles: selectedCycles.length, sessions, filename };
  }

  function escape(value) {
    return global.DashboardComponents?.escapeHtml?.(value)
      || String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function buildPlanningExportModal() {
    if (document.getElementById('planning-export-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'planning-export-dialog';
    dialog.className = 'uploader-dialog planning-export-dialog';
    dialog.innerHTML = `
      <div class="uploader-inner">
        <header class="uploader-header">
          <h3>Exportar planning</h3>
          <button type="button" class="uploader-close" data-planning-export-close aria-label="Tancar">×</button>
        </header>
        <div class="planning-export-content">
          <p class="planning-export-help">Tria els cicles complets que vols incloure al fitxer.</p>
          <div class="planning-export-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-planning-export-select-all>Selecciona’ls tots</button>
            <button type="button" class="btn btn-ghost btn-sm" data-planning-export-clear>Neteja</button>
          </div>
          <div class="planning-export-cycles" data-planning-export-cycles role="group" aria-label="Cicles del planning"></div>
          <p class="planning-export-summary" data-planning-export-summary aria-live="polite"></p>
        </div>
        <footer class="uploader-footer">
          <button type="button" class="btn btn-ghost" data-planning-export-close>Cancel·lar</button>
          <button type="button" class="btn btn-primary" data-planning-export-confirm>Exportar</button>
        </footer>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll('[data-planning-export-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
  }

  function openPlanningExport() {
    const state = global.dashboardStore?.getState?.() || {};
    const documentData = state.planningDocument;
    if (!documentData?.cycles?.length) {
      global.DashboardComponents?.showToast({ type: 'warning', message: 'No hi ha planning disponible per exportar.' });
      return;
    }
    buildPlanningExportModal();
    const dialog = document.getElementById('planning-export-dialog');
    const summary = dialog.querySelector('[data-planning-export-summary]');
    const confirm = dialog.querySelector('[data-planning-export-confirm]');
    const cycleList = dialog.querySelector('[data-planning-export-cycles]');
    const calendarDocument = planningExportCalendarDocument(state.calendar);
    const cycleSummaries = planningCycleSummaries(documentData);
    const selectedCycleIds = new Set(cycleSummaries.map(cycle => cycle.id));

    cycleList.innerHTML = cycleSummaries.map(cycle => `
      <label class="planning-export-cycle">
        <input type="checkbox" data-planning-export-cycle="${escape(cycle.id)}" checked>
        <span class="planning-export-cycle-copy">
          <strong>${escape(cycle.name || 'Cicle sense nom')}</strong>
          <span>${escape(cycle.start || '—')} – ${escape(cycle.end || '—')}</span>
        </span>
        <span class="planning-export-cycle-count">${cycle.weeks} ${cycle.weeks === 1 ? 'setmana' : 'setmanes'} · ${cycle.sessions} ${cycle.sessions === 1 ? 'sessió' : 'sessions'}</span>
      </label>`).join('');

    const updateSummary = () => {
      const selected = cycleSummaries.filter(cycle => selectedCycleIds.has(cycle.id));
      const weeks = selected.reduce((total, cycle) => total + cycle.weeks, 0);
      const sessions = selected.reduce((total, cycle) => total + cycle.sessions, 0);
      summary.textContent = `${selected.length} ${selected.length === 1 ? 'cicle' : 'cicles'} · ${weeks} ${weeks === 1 ? 'setmana' : 'setmanes'} · ${sessions} ${sessions === 1 ? 'sessió' : 'sessions'}`;
      confirm.disabled = selected.length === 0;
    };

    cycleList.querySelectorAll('[data-planning-export-cycle]').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) selectedCycleIds.add(input.dataset.planningExportCycle);
        else selectedCycleIds.delete(input.dataset.planningExportCycle);
        updateSummary();
      });
    });
    dialog.querySelector('[data-planning-export-select-all]').onclick = () => {
      selectedCycleIds.clear();
      cycleList.querySelectorAll('[data-planning-export-cycle]').forEach(input => {
        input.checked = true;
        selectedCycleIds.add(input.dataset.planningExportCycle);
      });
      updateSummary();
    };
    dialog.querySelector('[data-planning-export-clear]').onclick = () => {
      selectedCycleIds.clear();
      cycleList.querySelectorAll('[data-planning-export-cycle]').forEach(input => { input.checked = false; });
      updateSummary();
    };
    confirm.onclick = () => {
      const selectedCycles = (documentData.cycles || []).filter(cycle => selectedCycleIds.has(String(cycle.id)));
      const selectedEntries = planningExportEntriesForCycles(documentData, calendarDocument, [...selectedCycleIds]);
      const exported = planningDocumentForSelection(documentData, selectedEntries, [...selectedCycleIds]);
      const result = downloadPlanningDocument(exported, selectedCycles, selectedEntries);
      if (result.ok) dialog.close();
    };
    updateSummary();
    if (!dialog.open) dialog.showModal();
  }

  global.planningExportEntries = planningExportEntries;
  global.planningCycleSummaries = planningCycleSummaries;
  global.planningExportEntriesForCycles = planningExportEntriesForCycles;
  global.planningDocumentForSelection = planningDocumentForSelection;
  global.openPlanningExport = openPlanningExport;
})(window);
