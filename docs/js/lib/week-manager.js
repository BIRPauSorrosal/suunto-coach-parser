// Gestió comuna de setmanes. Una setmana existeix encara que no tingui planning.
(function (global) {
  function startOfWeek(value) {
    const date = new Date(value); date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date;
  }
  function endOfWeek(value) {
    const date = startOfWeek(value); date.setDate(date.getDate() + 6); date.setHours(23, 59, 59, 999); return date;
  }
  function key(value) {
    const date = startOfWeek(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function timeline(planning, sessions) {
    const weeks = new Map();
    const ensure = (start) => {
      const k = key(start);
      if (!weeks.has(k)) weeks.set(k, { key: k, startDate: startOfWeek(start), endDate: endOfWeek(start), planning: null });
      return weeks.get(k);
    };
    planning.forEach(plan => { const week = ensure(plan.startDate); week.planning = plan; });
    sessions.forEach(session => ensure(session.date));
    ensure(new Date());
    const sparse = [...weeks.values()].sort((a, b) => a.startDate - b.startDate);
    if (!sparse.length) return [];
    // La navegació és una línia temporal contínua, també en períodes sense dades.
    const first = sparse[0].startDate;
    const last = sparse[sparse.length - 1].startDate;
    const result = [];
    for (const cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 7)) {
      const existing = weeks.get(key(cursor));
      result.push(existing || {
        key: key(cursor), startDate: startOfWeek(cursor), endDate: endOfWeek(cursor), planning: null
      });
    }
    return result;
  }
  function findCurrent(weeks) {
    const exact = weeks.findIndex(week => week.key === key(new Date()));
    return exact >= 0 ? exact : 0;
  }
  global.WeekManager = Object.freeze({ startOfWeek, endOfWeek, key, timeline, findCurrent });
})(window);
