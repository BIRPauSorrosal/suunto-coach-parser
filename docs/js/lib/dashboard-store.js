// dashboard-store.js
// Estat únic de l'aplicació. No conté cap lògica de DOM ni de persistència.

(function (global) {
  const state = {
    sessions: [],
    sessionsDocument: null,
    planning: [],
    planningDocument: null,
    calendar: null,
    sources: {},
  };

  const listeners = new Set();

  function notify(reason) {
    listeners.forEach(listener => listener(state, reason));
  }

  const store = {
    getState() {
      return state;
    },

    setData({ sessions = [], sessionsDocument = null, planning = [], planningDocument = null, calendar = null, sources = {} } = {}) {
      state.sessions = Array.isArray(sessions) ? sessions : [];
      state.sessionsDocument = sessionsDocument && typeof sessionsDocument === 'object' ? sessionsDocument : null;
      state.planning = Array.isArray(planning) ? planning : [];
      state.planningDocument = planningDocument && typeof planningDocument === 'object' ? planningDocument : null;
      state.calendar = calendar && typeof calendar === 'object' ? calendar : null;
      state.sources = sources && typeof sources === 'object' ? sources : {};
      notify('data-loaded');
    },

    setSessions(sessions) {
      state.sessions = Array.isArray(sessions) ? sessions : [];
      notify('sessions-updated');
    },

    setPlanning(planning) {
      state.planning = Array.isArray(planning) ? planning : [];
      notify('planning-updated');
    },

    setPlanningDocument(document) {
      state.planningDocument = document && typeof document === 'object' ? document : null;
      notify('planning-document-updated');
    },

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  global.dashboardStore = Object.freeze(store);

  // Compatibilitat temporal amb els mòduls existents i l'API de fase 1.
})(window);
