// Calendari setmanal flexible. El calendari temporal és independent del planning.
(function () {
  const STORE_KEY = 'suunto-coach-weekly-calendar-v2';
  const DAYS = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];
  const TYPES = {
    quality: ['Qualitat', 'var(--orange)'], z2: ['Z2', 'var(--accent)'], long: ['Tirada llarga', 'var(--blue)'],
    strength: ['Força', 'var(--purple)'], bici: ['Bici estàtica', 'var(--cyan)'], other: ['Altres', 'var(--yellow)']
  };
  let weekIndex = null;

  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const fmt = v => Number.isFinite(Number(v)) ? new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(Number(v)) : '--';
  const dateText = d => new Intl.DateTimeFormat('ca-ES', { day:'numeric', month:'short' }).format(d);
  const iso = d => { const x = new Date(d); x.setHours(0,0,0,0); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const read = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (_) { return {}; } };
  const write = data => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (_) {} };
  const planOf = week => week.planning || {};

  function planItems(week) {
    const p = planOf(week), items = [];
    if ((p.qKm || 0) > 0 || (p.qSeries || 0) > 0) items.push(['quality', 'Qualitat', `${p.qKm ? fmt(p.qKm)+' km · ' : ''}${p.qSeries || ''} ${p.qSeries ? 'sèries' : ''}`.trim()]);
    if ((p.z2Km || 0) > 0 || (p.z2Durada || 0) > 0) items.push(['z2', 'Z2', `${p.z2Km ? fmt(p.z2Km)+' km · ' : ''}${p.z2Durada ? fmt(p.z2Durada)+' min' : 'Sessió aeròbica'}`]);
    if ((p.llKm || 0) > 0 || (p.llDurada || 0) > 0) items.push(['long', 'Tirada llarga', `${p.llKm ? fmt(p.llKm)+' km' : ''}${p.llTipus ? ' · '+p.llTipus : ''}`.trim()]);
    if (p.forcaPlan) items.push(['strength', 'Força', p.forcaPlan]);
    if (p.padelPlan) items.push(['other', 'Altres', p.padelPlan]);
    return items;
  }

  function getCalendar(week) {
    const all = read(), key = week.key;
    if (all[key] && Array.isArray(all[key].items)) return all[key];
    // Compatibilitat amb la primera versió, que utilitzava S12 com a clau.
    const old = planOf(week).setmana && all[planOf(week).setmana];
    const items = old?.items || planItems(week).map((x, i) => ({ id:`${key}-${x[0]}-${i}`, day:{quality:1,z2:3,long:6,strength:2,other:5}[x[0]], type:x[0], title:x[1], detail:x[2] || x[1], status:'pending', source:'planning' }));
    const result = { version:2, items }; all[key] = result; write(all); return result;
  }
  function saveCalendar(week, calendar) { const all = read(); all[week.key] = calendar; write(all); }
  function editable(week) { return new Date() <= week.endDate; }
  function actualOn(sessions, date) { const key = iso(date); return sessions.filter(s => iso(s.date) === key); }

  function renderFlexibleWeekView(sessions, planning) {
    const weeks = window.WeekManager.timeline(planning, sessions);
    if (!weeks.length) return;
    if (weekIndex === null || weekIndex >= weeks.length) weekIndex = window.WeekManager.findCurrent(weeks);
    const week = weeks[weekIndex], plan = planOf(week), calendar = getCalendar(week), canEdit = editable(week);
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
    const unassigned=calendar.items.filter(i=>i.day===null||i.day===undefined), box=document.getElementById('flex-unassigned'); box.hidden=!unassigned.length; if(unassigned.length) box.innerHTML=`<p class="eyebrow">Per assignar</p>${unassigned.map(i=>card(i,canEdit)).join('')}`;
    const unmatched=document.getElementById('flex-unmatched'); unmatched.hidden=!realWeek.length; if(realWeek.length) unmatched.innerHTML=`<p class="eyebrow">Activitats registrades</p><p>${realWeek.length} activitat${realWeek.length===1?'':'s'} trobada${realWeek.length===1?'':'es'} aquesta setmana. La seva associació amb el planning es podrà confirmar en la propera etapa.</p>`;
    bind(sessions, planning, week, calendar, canEdit);
  }
  function card(item, canEdit) { const meta=TYPES[item.type]||TYPES.other; return `<div class="flex-plan-card${item.status==='done'?' is-done':''}" draggable="${canEdit}" data-plan-id="${esc(item.id)}" style="--card-color:${meta[1]}"><div class="flex-card-top"><span class="flex-card-type">${esc(item.title||meta[0])}</span><span class="flex-card-source">${item.source==='manual'?'Afegida':'Pla'}</span></div><strong>${esc(item.detail||meta[0])}</strong><div class="flex-card-actions">${canEdit?`<button type="button" data-action="toggle" data-id="${esc(item.id)}">${item.status==='done'?'↩ Pendent':'✓ Feta'}</button><button type="button" data-action="delete" data-id="${esc(item.id)}">×</button>`:`<span>${item.status==='done'?'✓ Completada':'Històric'}</span>`}</div></div>`; }
  function actualCard(s) { return `<div class="flex-actual-card"><span>Registrada</span><strong>${esc(s.tipus||'Activitat')}</strong><small>${s.durada?fmt(s.durada)+' min':''}${s.distancia?' · '+fmt(s.distancia)+' km':''}</small></div>`; }
  function bind(sessions, planning, week, calendar, canEdit) {
    ['flex-week-prev','flex-week-next','flex-week-current','flex-add-session'].forEach(id => { const el=document.getElementById(id); if(el) el.replaceWith(el.cloneNode(true)); });
    document.getElementById('flex-week-prev')?.addEventListener('click',()=>{weekIndex--;renderFlexibleWeekView(sessions,planning);});
    document.getElementById('flex-week-next')?.addEventListener('click',()=>{weekIndex++;renderFlexibleWeekView(sessions,planning);});
    document.getElementById('flex-week-current')?.addEventListener('click',()=>{weekIndex=window.WeekManager.findCurrent(window.WeekManager.timeline(planning,sessions));renderFlexibleWeekView(sessions,planning);});
    document.getElementById('flex-add-session')?.addEventListener('click',()=>addSession(sessions,planning,week));
    document.getElementById('flex-calendar')?.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||!canEdit)return;const i=calendar.items.find(x=>x.id===b.dataset.id);if(!i)return;if(b.dataset.action==='delete')calendar.items=calendar.items.filter(x=>x.id!==i.id);else i.status=i.status==='done'?'pending':'done';saveCalendar(week,calendar);renderFlexibleWeekView(sessions,planning);});
    document.querySelectorAll('[data-plan-id]').forEach(c=>c.addEventListener('dragstart',e=>{if(canEdit)e.dataTransfer.setData('text/plain',c.dataset.planId);}));
    document.querySelectorAll('[data-drop-day]').forEach(z=>{z.addEventListener('dragover',e=>{if(canEdit){e.preventDefault();z.classList.add('is-over');}});z.addEventListener('dragleave',()=>z.classList.remove('is-over'));z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('is-over');if(!canEdit)return;const i=calendar.items.find(x=>x.id===e.dataTransfer.getData('text/plain'));if(i){i.day=Number(z.dataset.dropDay);saveCalendar(week,calendar);renderFlexibleWeekView(sessions,planning);}});});
  }
  function addSession(sessions,planning,week){const names=['Qualitat','Z2','Tirada llarga','Força','Bici estàtica','Altres'];const n=window.prompt(`Tipus d'activitat:\n${names.map((x,i)=>`${i+1}. ${x}`).join('\n')}`,'1'), types=['quality','z2','long','strength','bici','other'],type=types[Number(n)-1];if(!type)return;const detail=window.prompt('Descripció o objectiu (opcional):',TYPES[type][0]);if(detail===null)return;const d=window.prompt('Dia (1 dilluns – 7 diumenge):',String(({quality:2,z2:4,long:7,strength:3,bici:5,other:6}[type])));if(!/^[1-7]$/.test(d))return;const c=getCalendar(week);c.items.push({id:`${week.key}-manual-${Date.now()}`,day:Number(d)-1,type,title:TYPES[type][0],detail:detail||TYPES[type][0],status:'pending',source:'manual'});saveCalendar(week,c);renderFlexibleWeekView(sessions,planning);}
  window.renderFlexibleWeekView=renderFlexibleWeekView;
})();
