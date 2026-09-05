// dashboard-store.js
// Estat únic de l'aplicació. No conté cap lògica de DOM ni de persistència.

(function (global) {
  const state = {
    sessions: [],
    planning: [],
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

    setData({ sessions = [], planning = [], calendar = null, sources = {} } = {}) {
      state.sessions = Array.isArray(sessions) ? sessions : [];
      state.planning = Array.isArray(planning) ? planning : [];
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

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  global.dashboardStore = Object.freeze(store);

  // Compatibilitat temporal amb els mòduls existents i l'API de fase 1.
})(window);
