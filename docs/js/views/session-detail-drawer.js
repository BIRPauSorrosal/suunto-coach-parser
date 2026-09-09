// Drawer reutilitzable per consultar el detall d'una activitat registrada.
(function (global) {
  const TYPE_LABELS = {
    quality: 'Qualitat', z2: 'Z2', long: 'Tirada llarga', 'long-run': 'Tirada llarga',
    strength: 'Força', bici: 'Bici estàtica', cycling: 'Ciclisme', running: 'Cursa',
    walking: 'Caminada', hiking: 'Senderisme', swimming: 'Natació', padel: 'Pàdel', other: 'Altres'
  };
  const SPORT_LABELS = {
    running: 'Cursa', cycling: 'Ciclisme', bike: 'Ciclisme', strength: 'Força',
    walking: 'Caminada', hiking: 'Senderisme', swimming: 'Natació', padel: 'Pàdel'
  };
  const VARIANT_LABELS = { road: 'Carretera', trail: 'Trail', indoor: 'Interior', outdoor: 'Exterior', treadmill: 'Cinta', intervals: 'Intervals', tempo: 'Tempo', pilometria: 'Pliometria' };
  const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const number = (...values) => {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  };
  const fmt = (value, digits = 1) => Number.isFinite(Number(value))
    ? new Intl.NumberFormat('ca-ES', { maximumFractionDigits: digits }).format(Number(value)) : null;
  const dateText = value => {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('ca-ES', { dateStyle: 'full' }).format(date);
  };
  const duration = value => {
    const minutes = number(value);
    if (minutes === null || minutes < 0) return null;
    const hours = Math.floor(minutes / 60), rest = Math.round(minutes % 60);
    return hours ? `${hours} h ${String(rest).padStart(2, '0')} min` : `${Math.round(minutes)} min`;
  };
  const pace = value => {
    const minutes = number(value);
    if (minutes === null || minutes <= 0) return null;
    let whole = Math.floor(minutes), seconds = Math.round((minutes - whole) * 60);
    if (seconds >= 60) { whole += 1; seconds = 0; }
    return `${whole}:${String(seconds).padStart(2, '0')} min/km`;
  };
  const paceRange = value => {
    if (!value || typeof value !== 'object') return pace(value);
    const min = pace(value.min), max = pace(value.max);
    return min && max ? `${min.replace(' min/km', '')}–${max}` : min || max;
  };
  const range = (value, suffix = '') => {
    if (!value || typeof value !== 'object') return null;
    const min = number(value.min), max = number(value.max);
    if (min === null && max === null) return null;
    if (min !== null && max !== null) return `${fmt(min)}–${fmt(max)}${suffix}`;
    return `${fmt(min ?? max)}${suffix}`;
  };
  const label = (value, labels) => labels[value] || (value ? String(value) : null);
  const actualData = session => session?.raw?.__activity || session?.__activity || session || {};
  const metric = (title, value, modifier = '') => value === null || value === undefined || value === '' ? '' : `<div class="session-detail-metric ${modifier}"><span>${esc(title)}</span><strong>${esc(value)}</strong></div>`;
  const section = (title, content, modifier = '') => content ? `<section class="session-detail-section ${modifier}"><h3>${esc(title)}</h3>${content}</section>` : '';

  function renderHero(data, row) {
    const heartRate = data.heart_rate || {};
    const content = [
      metric('Distància', number(data.distance_km, row.distancia) === null ? null : `${fmt(number(data.distance_km, row.distancia))} km`),
      metric('Durada', duration(number(data.duration_min, row.durada))),
      metric('Ritme', pace(number(data.pace_min_km, row.ritme))),
      metric('FC mitjana', number(heartRate.average, row.fcMitja) === null ? null : `${fmt(number(heartRate.average, row.fcMitja), 0)} bpm`),
      metric('FC màxima', number(heartRate.max, row.fcMax) === null ? null : `${fmt(number(heartRate.max, row.fcMax), 0)} bpm`),
      metric('Desnivell', number(data.elevation_m, row.desnivell) === null ? null : `${fmt(number(data.elevation_m, row.desnivell), 0)} m`)
    ].join('');
    return section('Resum de l’activitat', content, 'session-detail-hero');
  }

  function renderImpact(data, row) {
    const effect = data.training_effect || {};
    const recovery = data.recovery || {};
    const content = [
      metric('Càrrega', number(effect.load, row.carrega) === null ? null : fmt(number(effect.load, row.carrega))),
      metric('EPOC', number(effect.epoc, row.epoc) === null ? null : fmt(number(effect.epoc, row.epoc))),
      metric('Efecte d’entrenament', number(effect.pte) === null ? null : fmt(effect.pte)),
      metric('Recuperació', number(recovery.hours, row.recuperacio) === null ? null : `${fmt(number(recovery.hours, row.recuperacio))} h`)
    ].join('');
    return section('Impacte de l’entrenament', `<div class="session-detail-metric-grid">${content}</div>`);
  }

  function renderZones(data, row) {
    const source = data.zones || {};
    const minutes = ZONE_LABELS.map((zone, index) => number(source[`z${index + 1}_min`], row[`z${index + 1}min`]));
    if (!minutes.some(value => value !== null)) return '';
    const total = minutes.reduce((sum, value) => sum + (value || 0), 0);
    const rows = minutes.map((value, index) => {
      const percent = total > 0 && value !== null ? Math.round(value / total * 100) : null;
      const width = percent === null ? 0 : Math.max(0, Math.min(100, percent));
      return `<div class="session-detail-zone-row"><span class="session-detail-zone-label">${ZONE_LABELS[index]}</span><div class="session-detail-zone-track"><span class="session-detail-zone-fill zone-${index + 1}" style="width:${width}%"></span></div><span class="session-detail-zone-value">${value === null ? '—' : `${fmt(value)} min${percent === null ? '' : ` · ${percent}%`}`}</span></div>`;
    }).join('');
    return section('Zones de freqüència cardíaca', `<div class="session-detail-zones">${rows}</div>`);
  }

  function renderIntervals(data) {
    if (!Array.isArray(data.intervals) || !data.intervals.length) return '';
    const columns = [
      ['series', 'Sèrie', item => number(item.series) === null ? null : fmt(item.series, 0)],
      ['distance_m', 'Distància', item => number(item.distance_m) === null ? null : `${fmt(item.distance_m, 0)} m`],
      ['duration_min', 'Durada', item => duration(item.duration_min)],
      ['pace_min_km', 'Ritme', item => pace(item.pace_min_km)],
      ['heart_rate.average', 'FC mitjana', item => number(item.heart_rate?.average) === null ? null : `${fmt(item.heart_rate.average, 0)} bpm`],
      ['heart_rate.max', 'FC màxima', item => number(item.heart_rate?.max) === null ? null : `${fmt(item.heart_rate.max, 0)} bpm`],
      ['cadence_spm', 'Cadència', item => number(item.cadence_spm) === null ? null : `${fmt(item.cadence_spm, 0)} spm`]
    ].filter(([, , formatter]) => data.intervals.some(item => formatter(item) !== null));
    const head = columns.map(([, title]) => `<th scope="col">${esc(title)}</th>`).join('');
    const body = data.intervals.map(item => `<tr>${columns.map(([, , formatter]) => `<td>${esc(formatter(item) || '—')}</td>`).join('')}</tr>`).join('');
    return section('Intervals', `<div class="session-detail-table-wrap"><table class="session-detail-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
  }

  function renderFeeling(data, row) {
    const value = number(data.feeling, row.feeling);
    const valid = value !== null && value >= 1 && value <= 5;
    const labelText = !valid ? 'No registrat' : value >= 4 ? 'Bona' : value === 3 ? 'Neutra' : 'Baixa';
    const dots = [1, 2, 3, 4, 5].map(index => `<span class="session-detail-feeling-dot${valid && index <= value ? ' is-active' : ''}" aria-hidden="true"></span>`).join('');
    return section('Feeling', `<div class="session-detail-feeling"><div class="session-detail-feeling-scale">${dots}</div><strong>${valid ? `${value}/5 · ` : ''}${labelText}</strong></div>`);
  }

  function renderPlan(data, row, planned, planningItem) {
    if (!planned && !planningItem) return section('Planificació', '<p class="session-detail-muted">Activitat no planificada.</p>');
    const plan = { ...(planningItem || {}), ...(planned || {}) };
    const planTitle = plan.title || plan.detail || plan.description || label(plan.type, TYPE_LABELS) || 'Sessió planificada';
    const planInfo = [
      `<div class="session-detail-plan-title"><span>Associació confirmada</span><strong>${esc(planTitle)}</strong></div>`,
      metric('Distància prevista', number(plan.distance_km) === null ? null : `${fmt(plan.distance_km)} km`),
      metric('Durada prevista', duration(plan.duration_min)),
      metric('Ritme previst', typeof plan.pace_min_km === 'number' ? pace(plan.pace_min_km) : null),
      metric('Objectiu', plan.description || plan.label || plan.detail ? (plan.description || plan.label || plan.detail) : null)
    ].join('');
    const plannedDistance = number(plan.distance_km);
    const actualDistance = number(data.distance_km, row.distancia);
    const plannedDuration = number(plan.duration_min);
    const actualDuration = number(data.duration_min, row.durada);
    const comparisons = [
      plannedDistance !== null && actualDistance !== null ? `<div><span>Distància</span><strong>${fmt(plannedDistance)} km</strong><em>${fmt(actualDistance)} km reals</em></div>` : '',
      plannedDuration !== null && actualDuration !== null ? `<div><span>Durada</span><strong>${duration(plannedDuration)}</strong><em>${duration(actualDuration)} real</em></div>` : ''
    ].join('');
    return section('Planificat vs real', `<div class="session-detail-plan-summary">${planInfo}</div>${comparisons ? `<div class="session-detail-comparison"><p>Comparació de camps disponibles</p>${comparisons}</div>` : '<p class="session-detail-muted">No hi ha camps comparables suficients.</p>'}`);
  }

  function renderPlannedStructure(plan) {
    if (Array.isArray(plan.intervals) && plan.intervals.length) {
      const rows = plan.intervals.map((item, index) => {
        const title = item.name || item.label || `Bloc ${index + 1}`;
        const values = [
          metric('Durada', duration(item.duration_min)),
          metric('Distància', number(item.distance_km, item.distance_m) === null ? null : `${fmt(number(item.distance_km, item.distance_m))}${item.distance_m ? ' m' : ' km'}`),
          metric('Ritme', paceRange(item.pace_min_km)),
          metric('Velocitat', number(item.speed_kmh, item.speed) === null ? null : `${fmt(number(item.speed_kmh, item.speed))} km/h`),
          metric('FC objectiu', range(item.heart_rate, ' bpm')),
          metric('Zona', item.zone || item.heart_rate_zone || null),
          metric('Recuperació', item.recovery_min === undefined ? null : duration(item.recovery_min))
        ].join('');
        return `<div class="session-detail-plan-title"><span>${esc(title)}</span>${values ? `<div class="session-detail-metric-grid">${values}</div>` : ''}</div>`;
      }).join('');
      return section('Estructura', `<div class="session-detail-zones">${rows}</div>`);
    }
    const values = [
      metric('Sèries', number(plan.series) === null ? null : fmt(plan.series, 0)),
      metric('Durada de cada sèrie', duration(plan.series_duration_min)),
      metric('Recuperació', duration(plan.recovery_min))
    ].join('');
    return values ? section('Estructura', `<div class="session-detail-metric-grid">${values}</div>`) : '';
  }

  function renderPlannedOnly(plan) {
    const objective = plan.objective || plan.goal || plan.focus || plan.session_type || plan.description || plan.label || null;
    const values = [
      metric('Objectiu', objective),
      metric('Distància prevista', number(plan.distance_km) === null ? null : `${fmt(plan.distance_km)} km`),
      metric('Durada prevista', duration(plan.duration_min)),
      metric('Ritme objectiu', paceRange(plan.pace_min_km)),
      metric('Velocitat objectiu', number(plan.speed_kmh, plan.speed) === null ? null : `${fmt(number(plan.speed_kmh, plan.speed))} km/h`),
      metric('FC objectiu', range(plan.heart_rate, ' bpm')),
      metric('Zona objectiu', plan.zone || plan.heart_rate_zone || plan.hr_zone || null),
      metric('Variant', label(plan.variant, VARIANT_LABELS))
    ].join('');
    const noteValues = [plan.notes?.comment, plan.notes, plan.description].filter(value => typeof value === 'string' && value.trim());
    return section('Objectiu planificat', `<div class="session-detail-metric-grid">${values}</div>`) + renderPlannedStructure(plan) + (noteValues.length ? section('Notes', `<p class="session-detail-note">${esc([...new Set(noteValues)].join('\n\n'))}</p>`) : '');
  }

  function renderContent(session, planned, options = {}) {
    const plannedOnly = Boolean(options.plannedOnly && planned);
    const row = plannedOnly ? {} : (session || {});
    const data = plannedOnly ? {} : actualData(session);
    const plan = planned || {};
    const type = plannedOnly ? (label(plan.type, TYPE_LABELS) || label(plan.sport, SPORT_LABELS) || 'Sessió planificada') : (label(data.type, TYPE_LABELS) || label(row.tipus, TYPE_LABELS) || 'Activitat');
    const sport = plannedOnly ? label(plan.sport, SPORT_LABELS) : label(data.sport, SPORT_LABELS);
    const variant = plannedOnly ? label(plan.variant, VARIANT_LABELS) : label(data.variant, VARIANT_LABELS);
    const subtype = plannedOnly ? null : label(data.subtype, VARIANT_LABELS);
    const date = options.dateLabel || dateText(data.date || row.date);
    const identity = [sport, variant, subtype].filter(Boolean).join(' · ');
    const confirmed = Array.isArray(data.planning_links) && data.planning_links.some(link => link.confidence === 'confirmed');
    const meta = [date, confirmed ? 'Associació confirmada' : 'Activitat registrada', data.id ? `ID ${data.id}` : null].filter(Boolean).map(esc).join(' · ');
    const comment = String(data.notes?.comment || row.Comentari || '').trim();
    const vo2 = number(data.vo2max, row.vo2max);
    return `<div class="session-detail-header"><div><p class="eyebrow">${esc(type)}</p><h2 id="session-detail-title">${esc(identity || type)}</h2><p class="session-detail-meta">${meta}</p></div><button type="button" class="session-detail-close" data-session-detail-close aria-label="Tancar el detall">×</button></div>
      <div class="session-detail-body">
        ${plannedOnly ? renderPlannedOnly(plan) : renderHero(data, row)}
        ${plannedOnly ? '' : renderImpact(data, row)}
        ${plannedOnly ? '' : renderZones(data, row)}
        ${plannedOnly ? '' : renderIntervals(data)}
        ${plannedOnly ? '' : renderFeeling(data, row)}
        ${vo2 === null ? '' : section('Rendiment', `<div class="session-detail-metric-grid">${metric('VO₂max', `${fmt(vo2, 1)} ml/kg/min`)}</div>`)}
        ${plannedOnly ? '' : (comment ? section('Notes', `<p class="session-detail-note">${esc(comment)}</p>`) : '')}
        ${plannedOnly ? '' : renderPlan(data, row, planned, options.planningItem)}
      </div>`;
  }

  let layer = null;
  let lastFocused = null;

  function focusables() {
    return [...layer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(element => !element.disabled);
  }

  function close() {
    if (!layer || layer.hidden) return;
    layer.hidden = true;
    layer.classList.remove('is-open');
    layer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('session-detail-open');
    lastFocused?.focus?.();
  }

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'session-detail-layer';
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<div class="session-detail-backdrop" data-session-detail-close></div><aside class="session-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="session-detail-title"></aside>';
    document.body.appendChild(layer);
    layer.addEventListener('click', event => { if (event.target.closest('[data-session-detail-close]')) close(); });
    layer.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables(); if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.addEventListener('keydown', event => {
      if (!layer.hidden && event.key === 'Escape') { event.preventDefault(); close(); }
    });
    return layer;
  }

  function open(session, planned = null, options = {}) {
    const current = ensureLayer();
    lastFocused = document.activeElement;
    current.querySelector('.session-detail-drawer').innerHTML = renderContent(session, planned, options);
    if (options.plannedOnly) {
      const meta = current.querySelector('.session-detail-meta');
      if (meta) meta.textContent = [options.dateLabel, 'Sessió planificada'].filter(Boolean).join(' · ');
    }
    current.hidden = false;
    current.classList.add('is-open');
    current.setAttribute('aria-hidden', 'false');
    document.body.classList.add('session-detail-open');
    const closeButton = current.querySelector('.session-detail-close');
    closeButton?.focus();
    requestAnimationFrame(() => closeButton?.focus());
  }

  global.openSessionDetailDrawer = open;
  global.openPlannedSessionDetail = (planned, actual = null, options = {}) => open(actual || planned, planned, {
    ...options,
    planningItem: options.planningItem || planned,
    plannedOnly: !actual
  });
  global.closeSessionDetailDrawer = close;
})(window);
