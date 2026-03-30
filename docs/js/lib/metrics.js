// docs/js/lib/metrics.js
// Càlculs de negoci purs — sense DOM, sense Chart.js
// Disponibles globalment per a totes les vistes
// DEP: lib/formatters.js ha d'estar carregat abans (usa toNumber)

// ── Constants PMC ─────────────────────────────────────────────────────────────
const PMC_CTL_TAU = 42;
const PMC_ATL_TAU = 7;

// ── Helpers interns ───────────────────────────────────────────────────────────
function getMondayOf(date) {
  const d = new Date(date), dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function avgValid(sessions, fn) {
  const vals = sessions.map(fn).filter(v => typeof v === 'number' && isFinite(v) && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function parseDurSeries(session) {
  const raw = session.raw['Series_Detall'];
  if (!raw || raw === '') return 0;
  try {
    const detall = JSON.parse(raw);
    if (!Array.isArray(detall)) return 0;
    return detall.reduce((a, s) => {
      const v = typeof s.dur_min === 'number' ? s.dur_min : parseFloat(s.dur_min);
      return a + (isFinite(v) && v > 0 ? v : 0);
    }, 0);
  } catch { return 0; }
}

// ── groupByWeek ───────────────────────────────────────────────────────────────
// Agrupa sessions per setmana natural (dilluns–diumenge) i calcula agregats.
// NOTA: Diferent de buildWeeklyData() a charts.js, que usa el planning com a eix.
//       Usar groupByWeek per a vistes de sessions; buildWeeklyData per a Overview.
function groupByWeek(sessions) {
  const map = new Map();
  const sorted = [...sessions].sort((a, b) => a.date - b.date);

  sorted.forEach(s => {
    const monday = getMondayOf(s.date);
    const key    = monday.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, { date: monday, sessions: [] });
    map.get(key).sessions.push(s);
  });

  return Array.from(map.values()).map(w => {
    const ss = w.sessions;
    const totalKm        = ss.reduce((a,s) => a + (typeof s.distancia==='number' && s.distancia>0 ? s.distancia : 0), 0);
    const totalLoad      = ss.reduce((a,s) => a + (typeof s.carrega==='number'   && s.carrega>0   ? s.carrega   : 0), 0);
    const totalEpoc      = ss.reduce((a,s) => { const e=toNumber(s.raw['EPOC']);        return a+(typeof e==='number'&&e>0?e:0); }, 0);
    const totalDesnivell = ss.reduce((a,s) => { const d=toNumber(s.raw['Desnivell(m)']); return a+(typeof d==='number'&&d>0?d:0); }, 0);
    const totalZ1        = ss.reduce((a,s) => { const v=toNumber(s.raw['Z1(min)']);     return a+(typeof v==='number'&&v>0?v:0); }, 0);
    const totalZ2        = ss.reduce((a,s) => { const v=toNumber(s.raw['Z2(min)']);     return a+(typeof v==='number'&&v>0?v:0); }, 0);

    const avgPace        = avgValid(ss, s => (typeof s.ritme==='number'&&s.ritme>0) ? s.ritme : null);
    const avgFC          = avgValid(ss, s => (typeof s.fcMitja==='number'&&s.fcMitja>0) ? s.fcMitja : null);
    const avgCad         = avgValid(ss, s => { const c=toNumber(s.raw['Cadencia(spm)']); return (typeof c==='number'&&c>0)?c:null; });
    const avgPaceSeries  = avgValid(ss, s => (typeof s.ritmeMitjaSeries==='number'&&s.ritmeMitjaSeries>0) ? s.ritmeMitjaSeries : null);
    const avgFCSeries    = avgValid(ss, s => (typeof s.fcMitjaSeries==='number'&&s.fcMitjaSeries>0) ? s.fcMitjaSeries : null);
    const avgCadSeries   = avgValid(ss, s => { const c=toNumber(s.raw['Cadencia_Mitja_Series']); return (typeof c==='number'&&c>0)?c:null; });
    const totalDurSeries = Math.round(ss.reduce((a, s) => a + parseDurSeries(s), 0) * 10) / 10;

    const d  = w.date;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');

    return {
      label: `${dd}/${mm}`,
      km:    Math.round(totalKm * 10) / 10,
      load:  Math.round(totalLoad * 10) / 10,
      epoc:  Math.round(totalEpoc * 10) / 10,
      desnivell:     Math.round(totalDesnivell),
      z1min:         Math.round(totalZ1 * 10) / 10,
      z2min:         Math.round(totalZ2 * 10) / 10,
      avgPace,
      avgFC:         typeof avgFC==='number'         ? Math.round(avgFC)                : null,
      avgCad:        typeof avgCad==='number'        ? Math.round(avgCad)               : null,
      avgPaceSeries: typeof avgPaceSeries==='number' ? Math.round(avgPaceSeries*100)/100 : null,
      avgFCSeries:   typeof avgFCSeries==='number'   ? Math.round(avgFCSeries)          : null,
      avgCadSeries:  typeof avgCadSeries==='number'  ? Math.round(avgCadSeries)         : null,
      totalDurSeries,
      count: ss.length,
    };
  });
}

// ── buildPMCData ──────────────────────────────────────────────────────────────
// Retorna array de { label, date, tss, ctl, atl, tsb, estat } per cada dia
function buildPMCData(sessions) {
  if (!sessions.length) return [];

  const tssByDay = new Map();
  sessions.forEach(s => {
    if (!s.date) return;
    const key = s.date.toISOString().slice(0, 10);
    tssByDay.set(key, (tssByDay.get(key) || 0) + (s.carrega || 0));
  });

  const allDates = [...tssByDay.keys()].sort();
  if (!allDates.length) return [];

  const startDate = new Date(allDates[0]);
  const endDate   = new Date(); endDate.setHours(0, 0, 0, 0);

  const kCTL = Math.exp(-1 / PMC_CTL_TAU);
  const kATL = Math.exp(-1 / PMC_ATL_TAU);
  let ctl = 0, atl = 0;
  const result = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const tss = tssByDay.get(key) || 0;
    ctl = ctl * kCTL + tss * (1 - kCTL);
    atl = atl * kATL + tss * (1 - kATL);
    const tsb   = ctl - atl;
    const estat = tsb > 5 ? 'Fresc' : tsb > -10 ? 'Neutral' : 'Fatigat';
    const dd    = String(d.getDate()).padStart(2, '0');
    const mm    = String(d.getMonth() + 1).padStart(2, '0');
    result.push({ label: `${dd}/${mm}`, date: key, tss, ctl, atl, tsb, estat });
  }

  return result;
}
