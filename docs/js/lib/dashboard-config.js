// dashboard-config.js
// Configuració comuna de fonts de dades i persistència.

(function (global) {
  const config = {
    github: {
      owner: 'BIRPauSorrosal',
      repo: 'suunto-coach-parser',
      branch: 'main',
    },
    paths: {
      sessions: {
        local: './data/sessions.csv',
        repository: 'docs/data/sessions.csv',
      },
      planning: {
        local: './data/planning.csv',
        repository: 'docs/data/planning.csv',
      },
    },
  };

  global.DashboardConfig = Object.freeze({
    github: Object.freeze(config.github),
    paths: Object.freeze({
      sessions: Object.freeze(config.paths.sessions),
      planning: Object.freeze(config.paths.planning),
    }),
  });
})(window);
