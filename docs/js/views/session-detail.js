(function () {
  const TYPE_LABELS = {
    quality: 'Qualitat', z2: 'Z2', long: 'Tirada llarga', 'long-run': 'Tirada llarga',
    strength: 'Força', padel: 'Pàdel', cycling: 'Ciclisme', bici: 'Bici',
    running: 'Cursa', race: 'Cursa', hiking: 'Senderisme', swimming: 'Natació', other: 'Altres'
  };
  const SPORT_LABELS = { running: 'Cursa', cycling: 'Ciclisme', strength: 'Força', padel: 'Pàdel', hiking: 'Senderisme', swimming: 'Natació' };
  let lastFocus = null;

  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const number = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(Number(value)) : '';
  const minutes = value => {
    if (!Number.isFinite(Number(value))) return '';
    const total = Math.round(Number(value) * 60);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
  const typeLabel = value => TYPE_LABELS[String(value || '').toLowerCase()] || String(value || 'Sessió');
  const sportLabel = value => SPORT_LABELS[String(value || '').toLowerCase()] || typeLabel(value);
  const present = value => value !== null && value !== undefined && value !== '';
  const textValue = value => typeof value === 'object' ? '' : String(value || '').trim();

  function pace(value) {
    if (value && typeof value === 'object') {
      const min = minutes(value.min), max = minutes(value.max);
      if (min && max) return `${min}–${max} min/km`;
      return min || max ? `${min || max} min/km` : '';
    }
    return present(value) ? `${minutes(value)} min/km` : '';
  }

  function range(value, suffix = '') {
    if (!value || typeof value !== 'object') return '';
    const min = present(value.min) ? number(value.min) : '';
    const max = present(value.max) ? number(value.max) : '';
    if (min && max) return `${min}–${max}${suffix}`;
    return min || max ? `${min || max}${suffix}` : '';
  }

  function field(label, value) {
    if (!present(value)) return '';
    return `<div class="session-detail-field"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }

  function plannedFields(session) {
    const hr = range(session.heart_rate, ' bpm');
    const speed = present(session.speed_kmh) ? `${number(session.speed_kmh)} km/h` : (present(session.speed) ? `${number(session.speed)} km/h` : '');
    const zone = session.zone || session.heart_rate_zone || session.hr_zone;
    return [
      field('Durada prevista', present(session.duration_min) ? `${number(session.duration_min)} min` : ''),
      field('Distància prevista', present(session.distance_km) ? `${number(session.distance_km)} km` : ''),
      field('Ritme objectiu', pace(session.pace_min_km)),
      field('Velocitat objectiu', speed),
      field('Freqüència cardíaca objectiu', hr),
      field('Zona objectiu', zone),
      field('Variant', session.variant),
    ].join('');
  }

  function actualFields(session) {
    const hr = session.heart_rate || {};
    const average = present(hr.average) ? `${number(hr.average)} bpm` : '';
    const maximum = present(hr.max) ? `${number(hr.max)} bpm màx.` : '';
    const raw = session.raw?.__activity || session;
    return [
      field('Durada real', present(session.duration_min) ? `${number(session.duration_min)} min` : (present(session.durada) ? `${number(session.durada)} min` : '')),
      field('Distància real', present(session.distance_km) ? `${number(session.distance_km)} km` : (present(session.distancia) ? `${number(session.distancia)} km` : '')),
      field('Ritme real', pace(session.pace_min_km)),
      field('Freqüència cardíaca', [average, maximum].filter(Boolean).join(' · ')),
      field('Desnivell', present(session.elevation_m) ? `${number(session.elevation_m)} m` : ''),
      field('Càrrega', present(raw.training_effect?.load) ? number(raw.training_effect.load) : ''),
    ].join('');
  }

  function structure(session) {
    const rows = [];
    if (Array.isArray(session.intervals) && session.intervals.length) {
      session.intervals.forEach((interval, index) => {
        const label = interval.label || interval.name || `Bloc ${index + 1}`;
        const details = [
          present(interval.repetitions) ? `${number(interval.repetitions)} repeticions` : '',
          present(interval.duration_min) ? `${number(interval.duration_min)} min` : '',
          present(interval.distance_km) ? `${number(interval.distance_km)} km` : '',
          pace(interval.pace_min_km),
          range(interval.heart_rate, ' bpm'),
          present(interval.recovery_min) ? `${number(interval.recovery_min)} min recuperació` : ''
        ].filter(Boolean).join(' · ');
        rows.push(`<li><span>${esc(label)}</span><strong>${esc(details)}</strong></li>`);
      });
    } else if (present(session.series) || present(session.series_duration_min) || present(session.recovery_min)) {
      rows.push(field('Sèries', present(session.series) ? number(session.series) : ''));
      rows.push(field('Durada de cada sèrie', present(session.series_duration_min) ? `${number(session.series_duration_min)} min` : ''));
      rows.push(field('Recuperació', present(session.recovery_min) ? `${number(session.recovery_min)} min` : ''));
    }
    return rows.filter(Boolean).length ? `<section class="session-detail-section"><h3>Estructura</h3><dl class="session-detail-fields">${rows.join('')}</dl></section>` : '';
  }

  function notes(session) {
    const values = [session.objective, session.goal, session.focus, session.description, session.label, textValue(session.notes?.comment), textValue(session.notes)];
    const notes = [...new Set(values.map(textValue).filter(Boolean))];
    return notes.length ? `<section class="session-detail-section"><h3>Objectiu i notes</h3>${notes.map(value => `<p class="session-detail-note">${esc(value)}</p>`).join('')}</section>` : '';
  }

  function actualLinks(planned, actual) {
    if (!planned || !actual) return '';
    const label = actual.tipus || actual.sport || actual.type || 'Activitat';
    return `<section class="session-detail-section session-detail-section--actual"><div class="session-detail-section-heading"><h3>Activitat realitzada vinculada</h3><span class="session-detail-status">Realitzada</span></div><p>${esc(label)}${actual.displayDate ? ` · ${esc(actual.displayDate)}` : ''}</p><dl class="session-detail-fields">${actualFields(actual)}</dl></section>`;
  }

  function ensureLayer() {
    let layer = document.getElementById('session-detail-layer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'session-detail-layer';
    layer.className = 'session-detail-layer';
    layer.innerHTML = `<div class="session-detail-backdrop" data-session-detail-close></div><section class="session-detail-panel" role="dialog" aria-modal="true" aria-labelledby="session-detail-title" tabindex="-1"><header class="session-detail-header"><div><p class="eyebrow" id="session-detail-kicker">Detall de sessió</p><h2 id="session-detail-title"></h2><p class="session-detail-subtitle" id="session-detail-subtitle"></p></div><button type="button" class="btn btn-ghost btn-sm" data-session-detail-close aria-label="Tancar detall">×</button></header><div class="session-detail-content" id="session-detail-content"></div></section>`;
    document.body.appendChild(layer);
    layer.addEventListener('click', event => { if (event.target.closest('[data-session-detail-close]')) close(); });
    return layer;
  }

  function close() {
    const layer = document.getElementById('session-detail-layer');
    if (!layer) return;
    layer.classList.remove('is-open');
    document.body.classList.remove('session-detail-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function open(planned, actual = null, context = {}) {
    const layer = ensureLayer();
    lastFocus = document.activeElement;
    const panel = layer.querySelector('.session-detail-panel');
    const title = planned ? (planned.label || planned.session_type || typeLabel(planned.type)) : (actual?.tipus || actual?.sport || actual?.type || 'Activitat');
    const sport = planned ? sportLabel(planned.sport || planned.type) : sportLabel(actual?.sport || actual?.type);
    layer.querySelector('#session-detail-kicker').textContent = planned ? (actual ? 'Planificada · realitzada' : 'Sessió planificada') : 'Activitat realitzada';
    layer.querySelector('#session-detail-title').textContent = title;
    layer.querySelector('#session-detail-subtitle').textContent = [sport, context.dateLabel || context.rangeLabel, planned?.variant].filter(Boolean).join(' · ');
    const plannedSection = planned ? `<section class="session-detail-section"><h3>Objectiu planificat</h3><dl class="session-detail-fields">${plannedFields(planned)}</dl></section>${structure(planned)}${notes(planned)}` : '';
    const actualSection = actual ? (planned ? actualLinks(planned, actual) : `<section class="session-detail-section"><h3>Dades reals</h3><dl class="session-detail-fields">${actualFields(actual)}</dl></section>`) : '';
    layer.querySelector('#session-detail-content').innerHTML = plannedSection + actualSection;
    layer.classList.add('is-open');
    document.body.classList.add('session-detail-open');
    panel.focus();
  }

  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.getElementById('session-detail-layer')?.classList.contains('is-open')) close(); });
  window.openPlannedSessionDetail = open;
  window.openSessionDetailDrawer = (session, context = {}) => {
    if (context?.planned || context?.actual || context?.planningSession) return open(context.planned || context.planningSession || null, context.actual || null, context);
    if (session?.__activity) return open(null, session, context);
    if (session?.raw?.__activity) return open(null, session, context);
    return open(session, null, context);
  };
}());
