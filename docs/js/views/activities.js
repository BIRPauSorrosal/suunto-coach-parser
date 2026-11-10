// Activity Log: historial de les activitats reals.
// El detall complet continua centralitzat a session-detail-drawer.js.

const ACTIVITY_LOG_TYPES = [
  ['all', 'Tots els tipus'], ...activityTypeOptions(),
];
let activityLogSessions = [];
let activityLogPlanning = [];
let activityLogPlanningSource = null;
let activityLogPlanningIndex = new Map();
let activityLogState = { range: 0, sport: 'all', type: 'all', status: 'all', feeling: 'all', load: 'all', query: '', sort: 'recent' };
let activityLogFiltersOpen = false;

function activityLogEscape(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function activityLogCanonical(session) { return session?.raw?.__activity || session?.__activity || {}; }
function activityLogTone(session) { return activityToneKey(session); }
function activityLogIsRunning(session) { return activityIsRunning(session); }
function activityLogSportKey(session) { return activityClassification(session).sport; }
function activityLogSport(session) {
  return activitySportLabel(session);
}
function activityLogTypeKey(session) { return activityClassification(session).activityType; }
function activityLogTypeLabel(session) { return activityPlanningLabel(session); }
function activityLogPlan(session) {
  const canonical = activityLogCanonical(session);
  const links = Array.isArray(canonical.planning_links) ? canonical.planning_links : [];
  const link = links.find(item => item.confidence === 'confirmed' && item.planning_session_id);
  if (!link) return null;
  return activityLogPlanningIndex.get(String(link.planning_session_id)) || null;
}
function activityLogSetPlanning(planning) {
  if (planning === activityLogPlanningSource) return;
  activityLogPlanningSource = planning;
  activityLogPlanningIndex = new Map();
  (planning || []).forEach(week => (week.sessions || []).forEach(item => {
    if (item.id) activityLogPlanningIndex.set(String(item.id), item);
  }));
}
function activityLogStatus(session) {
  return activityLogPlan(session) ? 'planned' : 'unplanned';
}
function activityLogDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function activityLogFormatDate(date, long = false) {
  return new Intl.DateTimeFormat('ca-ES', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
function activityLogFormatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60), rest = Math.round(minutes % 60);
  return hours ? `${hours} h ${String(rest).padStart(2, '0')} min` : `${Math.round(minutes)} min`;
}
function activityLogFormatPace(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const minutes = Math.floor(value), seconds = Math.round((value - minutes) * 60);
  return `${minutes}:${String(seconds >= 60 ? 0 : seconds).padStart(2, '0')} /km`;
}
function activityLogValue(session, field) {
  const canonical = activityLogCanonical(session);
  const values = {
    distance: [session.distancia, canonical.distance_km], duration: [session.durada, canonical.duration_min],
    load: [session.carrega, canonical.training_effect?.load], feeling: [session.feeling, canonical.feeling], vo2: [session.vo2max, canonical.vo2max],
    pace: [session.ritme, canonical.pace_min_km], heartRate: [session.fcMitja, canonical.heart_rate?.average],
  }[field] || [];
  const value = values.find(item => Number.isFinite(Number(item)));
  return value === undefined ? null : Number(value);
}
function activityLogText(session) {
  const canonical = activityLogCanonical(session);
  return [session.tipus, activityLogSport(session), activityLogTypeLabel(session), activitySubtypeLabel(session), canonical.variant, canonical.title, canonical.name].filter(Boolean).join(' ').toLowerCase();
}
function activityLogFilter(sessions) {
  const today = new Date(); today.setHours(23, 59, 59, 999);
  let result = sessions.filter(session => {
    if (activityLogState.range > 0) {
      const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - activityLogState.range); cutoff.setHours(0, 0, 0, 0);
      if (session.date < cutoff || session.date > today) return false;
    }
    if (activityLogState.sport !== 'all' && activityLogSportKey(session) !== activityLogState.sport) return false;
    const type = activityLogTypeKey(session);
    if (activityLogState.type === 'testrace' && !['race', 'test'].includes(type)) return false;
    if (activityLogState.type !== 'all' && activityLogState.type !== 'testrace' && type !== activityLogState.type) return false;
    if (activityLogState.status !== 'all' && activityLogStatus(session) !== activityLogState.status) return false;
    const feeling = activityLogValue(session, 'feeling');
    if (activityLogState.feeling === 'recorded' && !(feeling >= 1 && feeling <= 5)) return false;
    if (activityLogState.feeling === 'high' && !(feeling >= 4)) return false;
    if (activityLogState.load === 'with' && !(activityLogValue(session, 'load') > 0)) return false;
    if (activityLogState.load === 'without' && activityLogValue(session, 'load') > 0) return false;
    return !activityLogState.query || activityLogText(session).includes(activityLogState.query.trim().toLowerCase());
  });
  const direction = activityLogState.sort === 'oldest' ? 1 : -1;
  result.sort((a, b) => {
    if (activityLogState.sort === 'load') return (activityLogValue(b, 'load') || 0) - (activityLogValue(a, 'load') || 0);
    if (activityLogState.sort === 'duration') return (activityLogValue(b, 'duration') || 0) - (activityLogValue(a, 'duration') || 0);
    return direction * (a.date - b.date);
  });
  return result;
}
function activityLogWeekStart(date) { return window.WeekManager.startOfWeek(date); }
function activityLogWeekLabel(date) {
  const start = activityLogWeekStart(date), end = new Date(start); end.setDate(end.getDate() + 6);
  const format = value => new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' }).format(value);
  const thursday = new Date(start); thursday.setDate(thursday.getDate() + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round(((thursday - firstThursday) / 86400000 - 3 + (firstThursday.getDay() || 7)) / 7);
  return `Setmana ${week} · ${format(start)} – ${format(end)}`;
}
function activityLogActiveFilterCount() {
  return [activityLogState.range > 0, activityLogState.sport !== 'all', activityLogState.type !== 'all', activityLogState.status !== 'all', activityLogState.feeling !== 'all', activityLogState.load !== 'all', Boolean(activityLogState.query.trim())].filter(Boolean).length;
}
function activityLogStatusLabel(session) { return activityLogPlan(session) ? 'Planificada + realitzada' : 'No planificada'; }
function activityLogMetric(label, value) { return `<div><span>${activityLogEscape(label)}</span><strong>${activityLogEscape(value)}</strong></div>`; }
function activityLogExportJSON(sessions) {
  const exported = sessions.map(activityLogCanonical).filter(session => session && session.id).map(session => JSON.parse(JSON.stringify(session)));
  if (!exported.length) {
    window.showNotice?.('Cap activitat seleccionada per exportar.', true);
    window.DashboardComponents?.showToast({ type: 'warning', message: 'No hi ha activitats seleccionades per exportar.' });
    return;
  }
  const documentData = { schema_version: 1, source: 'suunto', sessions: exported };
  const blob = new Blob([JSON.stringify(documentData, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `suunto-coach-activities-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  window.DashboardComponents?.showToast({ type: 'success', message: `Exportació completada: ${exported.length} ${exported.length === 1 ? 'activitat' : 'activitats'}.` });
}
function activityLogCard(session) {
  const tone = activityLogTone(session), color = activityToneColor(session), feeling = activityLogValue(session, 'feeling');
  const distance = activityLogValue(session, 'distance'), duration = activityLogValue(session, 'duration'), load = activityLogValue(session, 'load');
  const pace = activityLogValue(session, 'pace'), heartRate = activityLogValue(session, 'heartRate'), vo2 = activityLogValue(session, 'vo2');
  const canonical = activityLogCanonical(session);
  const sourceFile = canonical.source_file || session.raw?.Arxiu || canonical.id || '';
  const comment = canonical.notes?.comment || session.raw?.Comentari || '';
  const id = activityLogCanonical(session).id || session.raw?.id || session.raw?.Arxiu || '';
  const metrics = [
    distance > 0 ? ['Distància', `${new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(distance)} km`] : null,
    duration > 0 ? ['Durada', activityLogFormatDuration(duration)] : null,
    activityLogIsRunning(session) && pace > 0 ? ['Ritme', activityLogFormatPace(pace)] : null,
    load > 0 ? ['Càrrega', new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(load)] : null,
    feeling >= 1 && feeling <= 5 ? ['Feeling', `${feeling}/5`] : null,
    heartRate > 0 ? ['FC', `${Math.round(heartRate)} ppm`] : null,
    vo2 > 0 ? ['VO₂max', new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(vo2)] : null,
  ].filter(Boolean).slice(0, 3);
  const displayLabel = activityDisplayLabel(session, true);
  const commentAction = sourceFile ? `<button type="button" class="activity-log-comment" data-activity-comment="${activityLogEscape(sourceFile)}" data-comment-date="${activityLogEscape(activityLogFormatDate(session.date))}" data-comment-type="${activityLogEscape(displayLabel || 'Activitat')}" aria-label="${comment ? 'Editar comentari' : 'Afegir comentari'}">${comment ? 'Edita comentari' : 'Afegeix comentari'}</button>` : '';
  return `<article class="activity-log-card${tone === 'test' ? ' activity-log-card--emphasis' : ''}" style="--activity-log-color:${color}" data-activity-id="${activityLogEscape(id)}" role="button" tabindex="0" aria-label="Obrir ${activityLogEscape(displayLabel || 'activitat')}, ${activityLogEscape(activityLogFormatDate(session.date, true))}">
    <div class="activity-log-card__top"><time datetime="${activityLogDateKey(session.date)}">${activityLogEscape(activityLogFormatDate(session.date))}</time><span class="activity-log-status${activityLogPlan(session) ? ' is-planned' : ''}">${activityLogEscape(activityLogStatusLabel(session))}</span></div>
    <div class="activity-log-card__title"><div><p class="activity-log-type">${activityLogEscape(activityLogSport(session))}</p><h3>${activityLogEscape(displayLabel || 'Activitat')}</h3></div></div>
    <div class="activity-log-metrics">${metrics.map(([label, value]) => activityLogMetric(label, value)).join('')}</div>
    <div class="activity-log-card__footer"><span class="activity-log-open">Veure detall →</span>${commentAction}</div>
  </article>`;
}

function activityLogToolbar(filtered) {
  const advancedCount = ['sport', 'type', 'status', 'feeling', 'load'].filter(key => activityLogState[key] !== 'all').length;
  const activeCount = activityLogActiveFilterCount();
  const options = (items, selected) => items.map(([value, label]) => `<option value="${activityLogEscape(value)}"${value === selected ? ' selected' : ''}>${activityLogEscape(label)}</option>`).join('');
  const select = (key, label, items) => `<label>${label}<select id="activity-log-${key}" data-activity-filter="${key}">${options(items, activityLogState[key])}</select></label>`;
  return `<div class="activity-log-toolbar">
    <div class="activity-log-search"><label for="activity-log-search">Cerca</label><input id="activity-log-search" type="search" value="${activityLogEscape(activityLogState.query)}" placeholder="Cerca una activitat..." autocomplete="off"></div>
    ${select('range', 'Període', [[0, 'Tot l’historial'], [30, 'Darrers 30 dies'], [90, 'Darrers 90 dies'], [365, 'Darrer any']])}
    <button type="button" id="activity-log-filter-toggle" class="btn btn-ghost btn-sm activity-log-filter-toggle" aria-expanded="${activityLogFiltersOpen}" aria-controls="activity-log-filter-controls">Filtres${advancedCount ? ` · ${advancedCount}` : ''}</button>
    <button type="button" class="btn btn-primary btn-sm activity-log-export" data-activity-export${filtered.length ? '' : ' disabled'}>Exporta ${filtered.length} ${filtered.length === 1 ? 'activitat' : 'activitats'}</button>
    <div class="activity-log-filter-status"${activeCount ? '' : ' hidden'}><span class="activity-log-filter-state" aria-live="polite">${activeCount} ${activeCount === 1 ? 'filtre actiu' : 'filtres actius'}</span><button type="button" class="btn btn-ghost btn-sm activity-log-clear" data-activity-clear>Neteja filtres</button></div>
    <div class="activity-log-filter-controls" id="activity-log-filter-controls"${activityLogFiltersOpen ? '' : ' hidden'}>
      ${select('sport', 'Esport', [['all', 'Tots els esports'], ...activitySportOptions()])}
      ${select('type', 'Tipus', ACTIVITY_LOG_TYPES)}
      ${select('status', 'Estat', [['all', 'Tots els estats'], ['planned', 'Planificada + realitzada'], ['unplanned', 'No planificada']])}
      ${select('feeling', 'Feeling', [['all', 'Qualsevol feeling'], ['recorded', 'Amb feeling registrat'], ['high', 'Feeling 4–5']])}
      ${select('load', 'Càrrega', [['all', 'Qualsevol càrrega'], ['with', 'Amb càrrega'], ['without', 'Sense càrrega']])}
      ${select('sort', 'Ordenar', [['recent', 'Més recents'], ['oldest', 'Més antigues'], ['load', 'Més càrrega'], ['duration', 'Més durada']])}
    </div>
  </div>`;
}

function activityLogRenderEmpty(filtered, total) {
  return filtered || total ? `<div class="activity-log-empty"><h3>Cap activitat coincideix</h3><p>Prova de modificar els filtres.</p></div>` : `<div class="activity-log-empty"><h3>Encara no hi ha activitats</h3><p>No hi ha activitats disponibles per al període seleccionat.</p></div>`;
}
function renderActivitiesView(sessions, planning) {
  activityLogSessions = sessions || [];
  activityLogPlanning = planning || [];
  activityLogSetPlanning(activityLogPlanning);
  const container = document.getElementById('activities-view-container');
  if (!container) return;
  const focused = document.activeElement;
  const focus = focused?.id && container.contains(focused)
    ? { id: focused.id, start: focused.selectionStart, end: focused.selectionEnd } : null;
  const filtered = activityLogFilter(activityLogSessions);
  const totalLoad = filtered.reduce((sum, session) => sum + Math.max(0, activityLogValue(session, 'load') || 0), 0);
  const totalDuration = filtered.reduce((sum, session) => sum + Math.max(0, activityLogValue(session, 'duration') || 0), 0);
  const totalDistance = filtered.reduce((sum, session) => sum + Math.max(0, activityLogValue(session, 'distance') || 0), 0);
  const groups = new Map();
  filtered.forEach(session => { const key = activityLogDateKey(activityLogWeekStart(session.date)); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(session); });
  const groupsHtml = [...groups.entries()].sort(([a], [b]) => activityLogState.sort === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)).map(([, items]) => `<section class="activity-log-group"><div class="activity-log-group__header"><h3>${activityLogEscape(activityLogWeekLabel(items[0].date))}</h3><span>${items.length} ${items.length === 1 ? 'activitat' : 'activitats'}</span></div><div class="activity-log-grid">${items.map(activityLogCard).join('')}</div></section>`).join('');
  container.innerHTML = activityLogToolbar(filtered) + `<div class="activity-log-summary"><div><span>Activitats</span><strong>${filtered.length}</strong></div><div><span>Temps</span><strong>${activityLogFormatDuration(totalDuration)}</strong></div><div><span>Distància</span><strong>${totalDistance > 0 ? `${new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(totalDistance)} km` : '—'}</strong></div><div><span>Càrrega</span><strong>${totalLoad > 0 ? new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(totalLoad) : '—'}</strong></div></div><div class="activity-log-results" aria-live="polite">${groupsHtml || activityLogRenderEmpty(filtered.length !== activityLogSessions.length, activityLogSessions.length)}</div>`;
  container.querySelector('#activity-log-filter-toggle').addEventListener('click', event => {
    activityLogFiltersOpen = !activityLogFiltersOpen;
    container.querySelector('#activity-log-filter-controls').hidden = !activityLogFiltersOpen;
    event.currentTarget.setAttribute('aria-expanded', String(activityLogFiltersOpen));
  });
  container.querySelector('#activity-log-search')?.addEventListener('input', event => { activityLogState.query = event.target.value; renderActivitiesView(activityLogSessions, activityLogPlanning); });
  container.querySelectorAll('[data-activity-filter]').forEach(select => select.addEventListener('change', event => { const key = event.currentTarget.dataset.activityFilter; activityLogState[key] = key === 'range' ? Number(event.currentTarget.value) : event.currentTarget.value; renderActivitiesView(activityLogSessions, activityLogPlanning); }));
  container.querySelector('[data-activity-clear]')?.addEventListener('click', () => { activityLogState = { range: 0, sport: 'all', type: 'all', status: 'all', feeling: 'all', load: 'all', query: '', sort: 'recent' }; renderActivitiesView(activityLogSessions, activityLogPlanning); });
  container.querySelector('[data-activity-export]')?.addEventListener('click', () => activityLogExportJSON(filtered));
  const findSession = card => activityLogSessions.find(item => String(activityLogCanonical(item).id || item.raw?.id || item.raw?.Arxiu || '') === card.dataset.activityId);
  const openDetail = event => { const commentButton = event.target.closest('[data-activity-comment]'); const card = event.target.closest('[data-activity-id]'); if (!card || !container.contains(card)) return; const session = findSession(card); if (!session) return; if (commentButton) { event.stopPropagation(); window.openSessionCommentEditor?.({ arxiu: commentButton.dataset.activityComment, data: commentButton.dataset.commentDate, tipus: commentButton.dataset.commentType }); return; } window.openSessionDetailDrawer?.(session, activityLogPlan(session)); };
  container.querySelector('.activity-log-results')?.addEventListener('click', openDetail);
  container.querySelector('.activity-log-results')?.addEventListener('keydown', event => { if (event.target.closest('[data-activity-comment]')) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(event); } });
  if (focus) {
    const control = document.getElementById(focus.id);
    control?.focus({ preventScroll: true });
    if (Number.isInteger(focus.start)) control?.setSelectionRange?.(focus.start, focus.end);
  }

}
