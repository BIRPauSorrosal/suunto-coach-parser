// Pantalla inicial contextual. No substitueix el calendari: el resumeix.
(function () {
  let bound = false;
  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const dateText = d => new Intl.DateTimeFormat('ca-ES', { weekday:'long', day:'numeric', month:'long' }).format(d);
  const fmt = v => Number.isFinite(Number(v)) ? new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(Number(v)) : '--';
  const todayKey = () => { const d=new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); };

  function renderTodayView(sessions, planning) {
    const weeks = window.WeekManager.timeline(planning, sessions), index = window.WeekManager.findCurrent(weeks), week = weeks[index];
    if (!week) return;
    const actual = sessions.filter(s => { const d=new Date(s.date); return d.toDateString()===new Date().toDateString(); });
    const plan = week.planning;
    const dateEl=document.getElementById('today-date-label'); if(dateEl)dateEl.textContent=dateText(new Date());
    const badge=document.getElementById('today-status-badge'); if(badge){badge.textContent=actual.length?'Activitat registrada':(plan?'Setmana en curs':'Sense planning');}
    const hero=document.getElementById('today-hero');
    if(hero) hero.innerHTML = actual.length
      ? `<p class="eyebrow">Activitat d’avui</p><h3>${esc(actual.map(s=>s.tipus||'Activitat').join(' · '))}</h3><p class="today-hero-detail">${actual.map(s=>`${s.durada?fmt(s.durada)+' min':''}${s.distancia?' · '+fmt(s.distancia)+' km':''}`).join(' · ')}</p><p class="today-hero-note">Quan l’activitat estigui associada a una sessió planificada, aquí podràs veure el compliment.</p>`
      : `<p class="eyebrow">Avui</p><h3>No hi ha cap activitat registrada</h3><p class="today-hero-detail">${plan?'Consulta el calendari per veure què tens previst i mou-ho si ho necessites.':'No hi ha planning per a aquesta setmana. Pots afegir una activitat manualment.'}</p>`;
    const realWeek=sessions.filter(s=>s.date>=week.startDate&&s.date<=week.endDate), summary=document.getElementById('today-week-summary');
    if(summary)summary.innerHTML=`<div class="today-week-grid"><div><span>Període</span><strong>${week.startDate.toLocaleDateString('ca-ES',{day:'numeric',month:'short'})} – ${week.endDate.toLocaleDateString('ca-ES',{day:'numeric',month:'short'})}</strong></div><div><span>Planning</span><strong>${plan?esc(plan.setmana+' · '+(plan.fase||'')):'Sense planning'}</strong></div><div><span>Activitats fetes</span><strong>${realWeek.length}</strong></div><div><span>Km reals</span><strong>${fmt(realWeek.reduce((n,s)=>n+(s.distancia||0),0))} km</strong></div></div>`;
    if(!bound){document.getElementById('today-open-week')?.addEventListener('click',()=>window.navigateTo&&window.navigateTo('setmanal'));bound=true;}
  }
  window.renderTodayView=renderTodayView;
})();
