// data-service.js
// Lectura i parseig de les fonts de dades del dashboard.
// No conté cap manipulació de DOM.

(function (global) {

  function assertSessionsDocument(document) {
    if (!document || document.schema_version !== 1 || document.source !== 'suunto' || !Array.isArray(document.sessions)) {
      throw new Error('sessions.json no té un esquema vàlid (schema_version/source/sessions)');
    }
    const seenIds = new Set();
    document.sessions.forEach(session => {
      if (!session || !session.id || !session.date || !session.type || !session.sport || !('variant' in session)) {
        throw new Error(`Activitat incompleta a sessions.json: ${session?.id || 'desconeguda'}`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
        throw new Error(`Data no vàlida a sessions.json: ${session.id}`);
      }
      if (seenIds.has(session.id)) throw new Error(`ID duplicat a sessions.json: ${session.id}`);
      seenIds.add(session.id);
    });
    return document;
  }

  function parseSessionsJSON(text) {
    let document;
    try { document = JSON.parse(text); }
    catch (_) { throw new Error('sessions.json no conté JSON vàlid'); }
    return assertSessionsDocument(document);
  }

  function average(values) {
    const numbers = values.filter(value => typeof value === 'number' && Number.isFinite(value));
    return numbers.length ? numbers.reduce((total, value) => total + value, 0) / numbers.length : null;
  }

  // Manté el model pla que consumeixen les vistes mentre la resta de l'app
  // migra progressivament al model estructurat de sessions.json.
  function normalizeSessionsJSON(document) {
    return document.sessions.map(session => {
      const intervals = Array.isArray(session.intervals) ? session.intervals : [];
      const qualityType = session.type === 'quality'
        ? (intervals.length ? 'INTERVALS' : 'TEMPO')
        : null;
      const type = session.type === 'long-run'
        ? (session.variant === 'trail' ? 'TRAIL' : 'LLARGA')
        : session.type === 'z2' ? 'Z2'
        : session.type === 'strength' ? `FORÇA${session.subtype ? ` ${session.subtype}` : ''}`
        : session.type === 'cycling' ? (session.variant === 'indoor' ? 'BICI ESTÀTICA' : 'BICI')
        : session.type === 'race' ? 'CURSA'
        : session.type === 'test' ? 'TEST'
        : session.type === 'padel' ? 'PADEL'
        : session.type === 'hiking' ? 'HIKING'
        : session.type === 'swimming' ? 'NATACIÓ'
        : qualityType || 'ALTRES';
      const heartRate = session.heart_rate || {};
      const zones = session.zones || {};
      const effect = session.training_effect || {};
      const recovery = session.recovery || {};
      const notes = session.notes || {};
      const seriesRows = intervals.map(interval => ({
        dist_m: interval.distance_m,
        dur_min: interval.duration_min,
        ritme: interval.pace_min_km,
        fc_mitja: interval.heart_rate?.average,
        fc_max: interval.heart_rate?.max,
        cadencia: interval.cadence_spm,
        serie: interval.series,
      }));
      return {
        Arxiu: session.source_file || session.id,
        Data: session.date,
        Tipus: type,
        'Durada(min)': session.duration_min,
        'Dist(km)': session.distance_km,
        'Desnivell(m)': session.elevation_m,
        Feeling: session.feeling,
        VO2max: session.vo2max,
        Carrega: effect.load,
        'Z1(min)': zones.z1_min,
        'Z2(min)': zones.z2_min,
        'Z3(min)': zones.z3_min,
        'Z4(min)': zones.z4_min,
        'Z5(min)': zones.z5_min,
        FCMitja: heartRate.average,
        FCMax: heartRate.max,
        'Ritme(min/km)': session.pace_min_km,
        Num_Series: intervals.length || null,
        Durada_Mitja_Series: average(intervals.map(interval => interval.duration_min)),
        Rec_Mitja_Min: null,
        Ritme_Mitja_Series: average(intervals.map(interval => interval.pace_min_km)),
        Consistencia_Ritme: null,
        FC_Mitja_Series: average(intervals.map(interval => interval.heart_rate?.average)),
        FC_Max_Mitja_Series: average(intervals.map(interval => interval.heart_rate?.max)),
        Cadencia_Mitja_Series: average(intervals.map(interval => interval.cadence_spm)),
        EPOC: effect.epoc,
        'Recup(h)': recovery.hours,
        Calories: session.calories,
        'Cadencia(spm)': session.cadence_spm,
        Series_Detall: seriesRows.length ? JSON.stringify(seriesRows) : '',
        Comentari: notes.comment || '',
        __activity: session,
      };
    });
  }

  function assertPlanningDocument(document) {
    if (!document || document.schema_version !== 1 || !Array.isArray(document.cycles)) {
      throw new Error('planning.json no té un esquema vàlid (schema_version/cycles)');
    }
    const seenWeeks = new Set();
    const seenSessions = new Set();
    document.cycles.forEach(cycle => {
      if (!cycle || !cycle.id || !cycle.name || !Array.isArray(cycle.weeks)) {
        throw new Error('planning.json conté un cicle incomplet');
      }
      cycle.weeks.forEach(week => {
        if (!week || !week.id || !week.code || !week.start || !week.end || !week.phase || !Array.isArray(week.sessions)) {
          throw new Error(`Setmana incompleta al planning.json: ${week?.id || 'desconeguda'}`);
        }
        if (seenWeeks.has(week.id)) throw new Error(`Setmana duplicada al planning.json: ${week.id}`);
        seenWeeks.add(week.id);
        week.sessions.forEach(session => {
          if (!session || !session.id || !session.type) throw new Error(`Sessió incompleta a ${week.code}`);
          if (seenSessions.has(session.id)) throw new Error(`Sessió duplicada al planning.json: ${session.id}`);
          seenSessions.add(session.id);
        });
      });
    });
    return document;
  }

  function parsePlanningJSON(text) {
    let document;
    try { document = JSON.parse(text); }
    catch (_) { throw new Error('planning.json no conté JSON vàlid'); }
    assertPlanningDocument(document);
    return document;
  }

  function sum(values) {
    const numbers = values.filter(value => typeof value === 'number' && Number.isFinite(value));
    return numbers.length ? numbers.reduce((total, value) => total + value, 0) : null;
  }

  // Adapta el JSON jeràrquic al model pla que encara utilitzen Overview/Planning.
  // Les sessions estructurades es conserven a __sessions per a les vistes noves.
  function normalizePlanningJSON(document) {
    return document.cycles.flatMap(cycle => cycle.weeks.map(week => {
      const sessions = Array.isArray(week.sessions) ? week.sessions : [];
      const quality = sessions.filter(session => session.type === 'quality');
      const z2 = sessions.filter(session => session.type === 'z2');
      const longRun = sessions.filter(session => session.type === 'long-run');
      const strength = sessions.filter(session => session.type === 'strength');
      const padel = sessions.filter(session => session.type === 'padel');
      const first = list => list[0] || {};
      const q = first(quality), z = first(z2), l = first(longRun);
      const summary = week.summary || {};
      return {
        Setmana: week.code,
        Data_Inici: week.start,
        Data_Fi: week.end,
        Cicle: cycle.name,
        Fase: week.phase,
        Q_Series: q.series,
        Q_Durada_Serie_min: q.series_duration_min,
        Q_Ritme_min_km: q.pace_min_km,
        Q_Rec_min: q.recovery_min,
        Q_FC_min: q.heart_rate?.min,
        Q_FC_max: q.heart_rate?.max,
        Q_Km_Plan: summary.quality_km_target ?? sum(quality.map(session => session.distance_km)),
        Z2_Durada_min: sum(z2.map(session => session.duration_min)),
        Z2_Ritme_min_km_min: z.pace_min_km?.min,
        Z2_Ritme_min_km_max: z.pace_min_km?.max,
        Z2_FC_min: z.heart_rate?.min,
        Z2_FC_max: z.heart_rate?.max,
        Z2_Km_Plan: summary.z2_km_target ?? sum(z2.map(session => session.distance_km)),
        LL_Tipus: l.description,
        LL_Durada_min: sum(longRun.map(session => session.duration_min)),
        LL_Km_Plan: summary.long_run_km_target ?? sum(longRun.map(session => session.distance_km)),
        Forca_Plan: summary.strength_plan ?? (strength.length ? String(strength.length) : ''),
        Padel_Plan: summary.padel_plan ?? (padel.length ? String(padel.length) : ''),
        Km_Total_Plan: summary.weekly_km_target ?? sum(sessions.map(session => session.distance_km)),
        __sessions: sessions,
        __cycleId: cycle.id,
        __weekId: week.id,
      };
    }));
  }

  global.DashboardDataService = Object.freeze({
    parseSessionsJSON,
    parsePlanningJSON,
    normalizePlanningJSON,
    normalizeSessionsJSON,
  });
})(window);
