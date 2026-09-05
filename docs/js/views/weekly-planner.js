// Calendari setmanal flexible. El calendari temporal és independent del planning.
(function () {
  const STORE_KEY = 'suunto-coach-calendar-local-v1';
  const LEGACY_STORE_KEY = 'suunto-coach-weekly-calendar-v2';
  const DAYS = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];
  const TYPES = {
    quality: ['Qualitat', 'var(--orange)'], z2: ['Z2', 'var(--accent)'], long: ['Tirada llarga', 'var(--blue)'], 'long-run': ['Tirada llarga', 'var(--blue)'],
    strength: ['Força', 'var(--purple)'], bici: ['Bici estàtica', 'var(--cyan)'], other: ['Altres', 'var(--yellow)']
  };
  const UNASSIGNED_FROM = '2026-09-07'; // 2026-S37
  let weekIndex = null;

  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmt = v => Number.isFinite(Number(v)) ? new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(Number(v)) : '--';
  const dateText = d => new Intl.DateTimeFormat('ca-ES', { day:'numeric', month:'short' }).format(d);
  const iso = d => { const x = new Date(d); x.setHours(0,0,0,0); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const weekCode = value => {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return `${date.getFullYear()}-S${String(Math.ceil((((date - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
  };
  const migrateItem = item => ({
    ...item,
    source: item.source || (item.kind === 'manual' ? 'manual' : 'planning'),
    kind: item.kind || (isManual(item) ? 'manual' : 'planned'),
    planning_session_id: item.planning_session_id ?? (isManual(item) ? null : item.id),
  });
  const migrateWeek = (key, value) => ({
    ...value,
    week_id: value.week_id || (/^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null),
    week_code: value.week_code || (/^\d{4}-\d{2}-\d{2}$/.test(key) ? weekCode(key) : null),
    items: Array.isArray(value.items) ? value.items.map(migrateItem) : [],
    removedPlanning: value.removedPlanning || value.removed_planning_session_ids || [],
  });
  const read = () => {
    try {
      const current = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (current && current.weeks && typeof current.weeks === 'object') {
        return Object.fromEntries(Object.entries(current.weeks).map(([key, value]) => [key, migrateWeek(key, value)]));
      }
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY) || '{}') || {};
      return Object.fromEntries(Object.entries(legacy).map(([key, value]) => [key, migrateWeek(key, value)]));
    } catch (_) { return {}; }
  };
  const write = data => {
    try {
      const weeks = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, migrateWeek(key, value)]));
      localStorage.setItem(STORE_KEY, JSON.stringify({ schema_version: 1, planning_source: 'planning.json', weeks }));
    } catch (_) {}
  };
  const planOf = week => week.planning || {};

  function dayIndex(day) {
    if (Number.isInteger(day)) return day;
    const names = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 };
    return Object.prototype.hasOwnProperty.call(names, String(day).toLowerCase()) ? names[String(day).toLowerCase()] : null;
  }

  function planItems(week) {
    const p = planOf(week), items = [];
    if (Array.isArray(p.sessions)) return p.sessions.map(session => {
      const meta = TYPES[session.type] || TYPES.other;
      const title = session.session_type ? `${meta[0]} · ${session.session_type}` : meta[0];
      const details = [
        session.distance_km ? `${fmt(session.distance_km)} km` : '',
        session.duration_min ? `${fmt(session.duration_min)} min` : '',
        session.description || session.label || '',
        session.series ? `${session.series} sèries` : ''
      ].filter(Boolean);
      return [session.type, title, details.join(' · ') || title, dayIndex(session.day), session.id];
    });
    if ((p.qKm || 0) > 0 || (p.qSeries || 0) > 0) items.push(['quality', 'Qualitat', `${p.qKm ? fmt(p.qKm)+' km · ' : ''}${p.qSeries || ''} ${p.qSeries ? 'sèries' : ''}`.trim()]);
    if ((p.z2Km || 0) > 0 || (p.z2Durada || 0) > 0) items.push(['z2', 'Z2', `${p.z2Km ? fmt(p.z2Km)+' km · ' : ''}${p.z2Durada ? fmt(p.z2Durada)+' min' : 'Sessió aeròbica'}`]);
    if ((p.llKm || 0) > 0 || (p.llDurada || 0) > 0) items.push(['long', 'Tirada llarga', `${p.llKm ? fmt(p.llKm)+' km' : ''}${p.llTipus ? ' · '+p.llTipus : ''}`.trim()]);
    if (p.forcaPlan) items.push(['strength', 'Força', p.forcaPlan]);
    if (p.padelPlan) items.push(['other', 'Altres', p.padelPlan]);
    return items;
  }

  function defaultDay(type) {
    return { quality: 1, z2: 3, long: 5, 'long-run': 5, strength: 2, other: 5 }[type] ?? null;
  }

  function isManual(item) {
    return item?.source === 'manual' || String(item?.id || '').includes('-manual-');
  }

  function reconcileCalendar(week, stored) {
    const current = stored && Array.isArray(stored.items) ? stored : null;
    const planned = planItems(week).map((item, index) => ({
      id: item[4] || `${week.key}-${item[0]}-${String(index + 1).padStart(2, '0')}`,
      day: week.key >= UNASSIGNED_FROM ? null : (item[3] ?? defaultDay(item[0])),
      type: item[0],
      title: item[1],
      detail: item[2] || item[1],
      status: 'pending',
      source: 'planning'
    }));
    const saved = current?.items || [];
    const removed = new Set(current?.removedPlanning || []);
    const oldPlanned = saved.filter(item => !isManual(item));
    const used = new Set();

    const findSaved = (item, index) => {
      const exact = oldPlanned.findIndex(savedItem => !used.has(savedItem.id) && savedItem.id === item.id);
      if (exact >= 0) return exact;
      // Compatibilitat amb les targetes antigues, que no tenien l'ID de sessió.
      const sameType = oldPlanned
        .map((savedItem, savedIndex) => ({ savedItem, savedIndex }))
        .filter(({ savedItem, savedIndex }) => !used.has(savedItem.id) && savedItem.type === item.type);
      return sameType[0]?.savedIndex ?? -1;
    };

    const reconciled = planned
      .filter(item => !removed.has(item.id))
      .map((item, index) => {
        const savedIndex = findSaved(item, index);
        if (savedIndex < 0) return item;
        const savedItem = oldPlanned[savedIndex];
        used.add(savedItem.id);
        const savedDay = dayIndex(savedItem.day) ?? item.day;
        const forceUnassigned = week.key >= UNASSIGNED_FROM && (current?.version || 0) < 5;
        const migrateOldLongRun = current?.version < 4 && (item.type === 'long-run' || item.type === 'long') && savedDay === 6;
        return { ...item, day: forceUnassigned ? null : (migrateOldLongRun ? 5 : savedDay), status: savedItem.status === 'done' ? 'done' : 'pending' };
      });

    // Les activitats afegides manualment no depenen del planning i es conserven.
    return {
      version: 5,
      week_id: week.key,
      week_code: planOf(week).setmana || weekCode(week.key),
      items: [...reconciled, ...saved.filter(isManual)],
      removedPlanning: [...removed]
    };
  }

  function getCalendar(week, calendarDocument) {
    const all = read(), key = week.key;
    // Compatibilitat amb la primera versió, que utilitzava S12 com a clau.
    const old = planOf(week).setmana && all[planOf(week).setmana];
    // La còpia local d'una edició recent té prioritat sobre el fitxer carregat;
    // així un moviment manual no es perd fins que es sincronitza al repositori.
    const source = all[key] || calendarDocument?.weeks?.[key] || old;
    const result = reconcileCalendar(week, source);
    all[key] = result;
    if (old && old !== source) delete all[planOf(week).setmana];
    write(all);
    return result;
  }
  function saveCalendar(week, calendar) { const all = read(); all[week.key] = { ...calendar, version: 5 }; write(all); }
  function editable(week) { return new Date() <= week.endDate; }
  function actualOn(sessions, date) { const key = iso(date); return sessions.filter(s => iso(s.date) === key); }

  function renderFlexibleWeekView(sessions, planning, calendarDocument) {
    const weeks = window.WeekManager.timeline(planning, sessions);
    if (!weeks.length) return;
    if (weekIndex === null || weekIndex >= weeks.length) weekIndex = window.WeekManager.findCurrent(weeks);
    const week = weeks[weekIndex], plan = planOf(week), calendar = getCalendar(week, calendarDocument), canEdit = editable(week);
    const today = iso(new Date()), days = Array.from({length:7}, (_, i) => { const d = new Date(week.startDate); d.setDate(d.getDate()+i); return d; });
    const text = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    text('flex-week-label', plan.setmana ? `${plan.setmana} · ${plan.cicle}` : `Setmana ${week.key}`);
    text('flex-week-range', `${dateText(week.startDate)} → ${dateText(week.endDate)}`);
    text('flex-week-context', `${plan.fase || 'Sense planning'} · ${canEdit ? 'setmana editable' : 'històric'}`);
    text('flex-week-counter', `${weekIndex+1} / ${weeks.length}`);
    const prev=document.getElementById('flex-week-prev'), next=document.getElementById('flex-week-next'), current=document.getElementById('flex-week-current'), add=document.getElementById('flex-add-session');
    const currentIndex=window.WeekManager.findCurrent(weeks);
    if (prev) prev.disabled=weekIndex===0; if (next) next.disabled=weekIndex===weeks.length-1; if (current) current.disabled=weekIndex===currentIndex; if (add) add.disabled=!canEdit;
    const realWeek=sessions.filter(s => s.date>=week.startDate && s.date<=week.endDate), done=calendar.items.filter(i=>i.status==='done').length;
    document.getElementById('flex-week-summary').innerHTML=`<div class="flex-summary-card"><span>Sessions previstes</span><strong>${calendar.items.length}</strong></div><div class="flex-summary-card"><span>Completades</span><strong>${done}</strong></div><div class="flex-summary-card"><span>Activitats registrades</span><strong>${realWeek.length}</strong></div><div class="flex-summary-card"><span>Km reals</span><strong>${fmt(realWeek.reduce((n,s)=>n+(s.distancia||0),0))} km</strong></div>`;
    document.getElementById('flex-calendar').innerHTML=days.map((date, day)=>`<article class="flex-day${iso(date)===today?' flex-day--today':''}" data-day="${day}"><header class="flex-day-header"><div><span class="flex-day-name">${DAYS[day]}</span><span class="flex-day-date">${dateText(date)}</span></div>${iso(date)===today?'<span class="badge">Avui</span>':''}</header><div class="flex-day-dropzone" data-drop-day="${day}">${calendar.items.filter(i=>i.day===day).map(i=>card(i,canEdit)).join('')}${actualOn(sessions,date).map(actualCard).join('')}${!calendar.items.some(i=>i.day===day)&&!actualOn(sessions,date).length?'<p class="flex-day-empty">Descans / sense activitat</p>':''}</div></article>`).join('');
    const unassigned=calendar.items.filter(i=>i.day===null||i.day===undefined), box=document.getElementById('flex-unassigned'); box.hidden=!unassigned.length&&!canEdit; box.innerHTML=`<p class="eyebrow">Per assignar</p><div class="flex-unassigned-dropzone" data-drop-unassigned="true">${unassigned.length?unassigned.map(i=>card(i,canEdit)).join(''):'Arrossega aquí les sessions que encara no vulguis assignar'}</div>`;
    const unmatched=document.getElementById('flex-unmatched'); unmatched.hidden=!realWeek.length; if(realWeek.length) unmatched.innerHTML=`<p class="eyebrow">Activitats registrades</p><p>${realWeek.length} activitat${realWeek.length===1?'':'s'} trobada${realWeek.length===1?'':'es'} aquesta setmana. La seva associació amb el planning es podrà confirmar en la propera etapa.</p>`;
    bind(sessions, planning, week, calendar, canEdit, calendarDocument);
  }
  function card(item, canEdit) { const meta=TYPES[item.type]||TYPES.other; return `<div class="flex-plan-card${item.status==='done'?' is-done':''}" draggable="${canEdit}" data-plan-id="${esc(item.id)}" style="--card-color:${meta[1]}"><div class="flex-card-top"><span class="flex-card-type">${esc(item.title||meta[0])}</span><span class="flex-card-source">${item.source==='manual'?'Afegida':'Pla'}</span></div><strong>${esc(item.detail||meta[0])}</strong><div class="flex-card-actions">${canEdit?`<button type="button" data-action="toggle" data-id="${esc(item.id)}">${item.status==='done'?'↩ Pendent':'✓ Feta'}</button><button type="button" data-action="delete" data-id="${esc(item.id)}">×</button>`:`<span>${item.status==='done'?'✓ Completada':'Històric'}</span>`}</div></div>`; }
  function actualCard(s) { return `<div class="flex-actual-card"><span>Registrada</span><strong>${esc(s.tipus||'Activitat')}</strong><small>${s.durada?fmt(s.durada)+' min':''}${s.distancia?' · '+fmt(s.distancia)+' km':''}</small></div>`; }
  function bind(sessions, planning, week, calendar, canEdit, calendarDocument) {
    ['flex-week-prev','flex-week-next','flex-week-current','flex-add-session'].forEach(id => { const el=document.getElementById(id); if(el) el.replaceWith(el.cloneNode(true)); });
    document.getElementById('flex-week-prev')?.addEventListener('click',()=>{weekIndex--;renderFlexibleWeekView(sessions,planning,calendarDocument);});
    document.getElementById('flex-week-next')?.addEventListener('click',()=>{weekIndex++;renderFlexibleWeekView(sessions,planning,calendarDocument);});
    document.getElementById('flex-week-current')?.addEventListener('click',()=>{weekIndex=window.WeekManager.findCurrent(window.WeekManager.timeline(planning,sessions));renderFlexibleWeekView(sessions,planning,calendarDocument);});
    document.getElementById('flex-add-session')?.addEventListener('click',()=>addSession(sessions,planning,week,calendarDocument));
    document.getElementById('flex-calendar')?.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||!canEdit)return;const i=calendar.items.find(x=>x.id===b.dataset.id);if(!i)return;if(b.dataset.action==='delete'){calendar.items=calendar.items.filter(x=>x.id!==i.id);if(i.source==='planning')calendar.removedPlanning=[...(calendar.removedPlanning||[]),i.id];}else i.status=i.status==='done'?'pending':'done';saveCalendar(week,calendar);renderFlexibleWeekView(sessions,planning,calendarDocument);});
    document.querySelectorAll('[data-plan-id]').forEach(c=>c.addEventListener('dragstart',e=>{if(canEdit)e.dataTransfer.setData('text/plain',c.dataset.planId);}));
    [...document.querySelectorAll('[data-drop-day]'), document.querySelector('[data-drop-unassigned]')].filter(Boolean).forEach(z=>{z.addEventListener('dragover',e=>{if(canEdit){e.preventDefault();z.classList.add('is-over');}});z.addEventListener('dragleave',()=>z.classList.remove('is-over'));z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('is-over');if(!canEdit)return;const i=calendar.items.find(x=>x.id===e.dataTransfer.getData('text/plain'));if(i){i.day=z.dataset.dropUnassigned!==undefined?null:Number(z.dataset.dropDay);saveCalendar(week,calendar);renderFlexibleWeekView(sessions,planning,calendarDocument);}});});
  }
  function addSession(sessions,planning,week,calendarDocument){const names=['Qualitat','Z2','Tirada llarga','Força','Bici estàtica','Altres'];const n=window.prompt(`Tipus d'activitat:\n${names.map((x,i)=>`${i+1}. ${x}`).join('\n')}`,'1'), types=['quality','z2','long','strength','bici','other'],type=types[Number(n)-1];if(!type)return;const detail=window.prompt('Descripció o objectiu (opcional):',TYPES[type][0]);if(detail===null)return;const d=window.prompt('Dia (1 dilluns – 7 diumenge):',String(({quality:2,z2:4,long:6,strength:3,bici:5,other:6}[type])));if(!/^[1-7]$/.test(d))return;const c=getCalendar(week,calendarDocument);c.items.push({id:`${week.key}-manual-${Date.now()}`,day:Number(d)-1,type,title:TYPES[type][0],detail:detail||TYPES[type][0],status:'pending',source:'manual'});saveCalendar(week,c);renderFlexibleWeekView(sessions,planning,calendarDocument);}
  window.renderFlexibleWeekView=renderFlexibleWeekView;
  window.setFlexibleWeekByKey = (key, planning, sessions) => {
    const sourcePlanning = Array.isArray(planning) ? planning : window.dashboardStore?.getState?.()?.planning || [];
    const sourceSessions = Array.isArray(sessions) ? sessions : window.dashboardStore?.getState?.()?.sessions || [];
    const weeks = window.WeekManager.timeline(sourcePlanning, sourceSessions);
    const index = weeks.findIndex(week => week.key === key);
    if (index >= 0) weekIndex = index;
  };
})();
