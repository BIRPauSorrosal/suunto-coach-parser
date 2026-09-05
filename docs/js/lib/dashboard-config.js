// dashboard-config.js
// Configuració comuna de fonts de dades i persistència.

(function (global) {
  // Producció és el valor per defecte. Per provar la branca de desenvolupament
  // des de Pages, obre l'aplicació amb `?env=development`.
  const search = global.location?.search || '';
  const params = typeof global.URLSearchParams === 'function'
    ? new global.URLSearchParams(search)
    : null;
  const requestedEnvironment = params?.get('env')
    || (search.match(/[?&]env=([^&]+)/)?.[1] || '');
  const environment = requestedEnvironment === 'development' ? 'development' : 'production';
  const branches = Object.freeze({
    production: 'main',
    development: 'refactor/optimitzacio',
  });

  const config = {
    github: {
      owner: 'BIRPauSorrosal',
      repo: 'suunto-coach-parser',
      branch: branches[environment],
      environment,
    },
    paths: {
      sessions: {
        local: './data/sessions.csv',
        repository: 'docs/data/sessions.csv',
      },
      planning: {
        local: './data/planning.json',
        // El carregador ja usa JSON; l'importador legacy encara escriu CSV
        // fins que sigui substituït en una fase posterior.
        repository: 'docs/data/planning.csv',
      },
      calendar: {
        local: './data/calendar.json',
        repository: 'docs/data/calendar.json',
      },
    },
  };

  global.DashboardConfig = Object.freeze({
    github: Object.freeze(config.github),
    paths: Object.freeze({
      sessions: Object.freeze(config.paths.sessions),
      planning: Object.freeze(config.paths.planning),
      calendar: Object.freeze(config.paths.calendar),
    }),
  });
})(window);
