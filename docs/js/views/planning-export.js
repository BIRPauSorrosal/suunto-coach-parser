// Exportació del planning amb selecció de període.
// El document exportat manté el contracte planning.json i només redueix les
// setmanes/sessions incloses; no modifica el planning operatiu.

(function (global) {
  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const EXPORT_RANGES = [7, 30, 90];

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
        const day = dayNumber(item.day);
        assigned.set(id, day);
      });

      sessionsById.forEach((session, id) => {
        const day = assigned.has(id) ? assigned.get(id) : dayNumber(session.day);
        const date = day === null
          ? null
          : (() => { const value = dateAtNoon(week.start); value.setDate(value.getDate() + day); return isoDate(value); })();
        const key = date || `unassigned:${week.id}`;
        let entry = entries.find(candidate => candidate.key === key);
        if (!entry) {
          entry = {
            key,
            date,
            day,
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

  function planningDocumentForSelection(document, entries, selectedKeys) {
    const selected = new Set(selectedKeys || []);
    const selectedIds = new Map();
    entries.filter(entry => selected.has(entry.key)).forEach(entry => {
      entry.sessions.forEach(({ session, day }) => {
        selectedIds.set(String(session.id), day);
      });
    });

    const cycles = (document?.cycles || []).map(cycle => ({
      ...cycle,
      weeks: (cycle.weeks || [])
        .map(week => ({
          ...week,
          sessions: (week.sessions || [])
            .filter(session => selectedIds.has(String(session.id)))
            .map(session => ({
              ...session,
              day: dayNumber(selectedIds.get(String(session.id))) === null
                ? null
                : DAY_KEYS[dayNumber(selectedIds.get(String(session.id)))],
            })),
        }))
        .filter(week => week.sessions.length),
    })).filter(cycle => cycle.weeks.length);

    return {
      schema_version: 1,
      season: document?.season ?? null,
      source: 'planning.json',
      cycles,
    };
  }

  function planningExportEntriesForRange(document, calendarDocument, days, referenceDate = new Date()) {
    const rangeDays = EXPORT_RANGES.includes(Number(days)) ? Number(days) : 30;
    const end = dateAtNoon(referenceDate);
    const start = dateAtNoon(referenceDate);
    start.setDate(start.getDate() - rangeDays + 1);
    const startKey = isoDate(start);
    const endKey = isoDate(end);
    return planningExportEntries(document, calendarDocument).filter(entry => {
      // Una sessió encara no col·locada s'associa temporalment a l'inici de la
      // seva setmana per poder exportar-la amb el mateix filtre de període.
      const rangeDate = entry.date || entry.weekId;
      if (!rangeDate) return false;
      const weekDate = /^\d{4}-\d{2}-\d{2}$/.test(rangeDate) ? rangeDate : null;
      return weekDate ? weekDate >= startKey && weekDate <= endKey : false;
    });
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

  function downloadPlanningDocument(documentData, selectedEntries) {
    const sessions = selectedEntries.reduce((total, entry) => total + entry.sessions.length, 0);
    if (!sessions) {
      global.DashboardComponents?.showToast({ type: 'warning', message: 'Selecciona almenys un dia amb planificació.' });
      return { ok: false, sessions: 0 };
    }
    const dates = selectedEntries.map(entry => entry.date).filter(Boolean).sort();
    const first = dates[0] || 'seleccio';
    const last = dates[dates.length - 1] || first;
    const filename = first === last ? `planning-${first}.json` : `planning-${first}-a-${last}.json`;
    const blob = new Blob([JSON.stringify(documentData, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    global.DashboardComponents?.showToast({ type: 'success', message: `Exportació completada: ${sessions} ${sessions === 1 ? 'sessió' : 'sessions'} planificades.` });
    return { ok: true, sessions, filename };
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
          <p class="planning-export-help">Tria el període de planificació que vols incloure al fitxer.</p>
          <div class="planning-export-ranges" role="group" aria-label="Període d'exportació">
            <button type="button" class="btn btn-ghost btn-sm" data-planning-export-range="7">Darrers 7 dies</button>
            <button type="button" class="btn btn-ghost btn-sm" data-planning-export-range="30">Darrers 30 dies</button>
            <button type="button" class="btn btn-ghost btn-sm" data-planning-export-range="90">Darrers 90 dies</button>
          </div>
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
    const calendarDocument = planningExportCalendarDocument(state.calendar);
    let selectedDays = 30;
    const updateSummary = () => {
      const entries = planningExportEntriesForRange(documentData, calendarDocument, selectedDays);
      const count = entries.reduce((total, entry) => total + entry.sessions.length, 0);
      summary.textContent = `${count} ${count === 1 ? 'sessió seleccionada' : 'sessions seleccionades'}`;
      confirm.disabled = count === 0;
    };
    dialog.querySelectorAll('[data-planning-export-range]').forEach(button => {
      const isActive = button.dataset.planningExportRange === String(selectedDays);
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      button.onclick = () => {
        selectedDays = Number(button.dataset.planningExportRange);
        dialog.querySelectorAll('[data-planning-export-range]').forEach(item => {
          const isSelected = item === button;
          item.classList.toggle('active', isSelected);
          item.setAttribute('aria-pressed', String(isSelected));
        });
        updateSummary();
      };
    });
    confirm.onclick = () => {
      const selectedEntries = planningExportEntriesForRange(documentData, calendarDocument, selectedDays);
      const exported = planningDocumentForSelection(documentData, selectedEntries, selectedEntries.map(entry => entry.key));
      const result = downloadPlanningDocument(exported, selectedEntries);
      if (result.ok) dialog.close();
    };
    updateSummary();
    if (!dialog.open) dialog.showModal();
  }

  global.planningExportEntries = planningExportEntries;
  global.planningExportEntriesForRange = planningExportEntriesForRange;
  global.planningDocumentForSelection = planningDocumentForSelection;
  global.openPlanningExport = openPlanningExport;
})(window);
