#!/usr/bin/env node

// Smoke checks sense dependències externes: fitxers, scripts, CSV i precache.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');
const failures = [];

function exists(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) failures.push(`Fitxer absent: ${relativePath}`);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

const required = [
  'docs/index.html',
  'docs/sw.js',
  'docs/data/sessions.csv',
  'docs/data/planning.csv',
  'docs/data/planning.json',
  'docs/data/planning.schema.json',
  'docs/data/calendar.json',
  'docs/data/calendar.schema.json',
  'docs/data/sessions.schema.json',
  'docs/data/sessions.json',
  'docs/js/lib/dashboard-config.js',
  'docs/js/lib/dashboard-store.js',
  'docs/js/lib/data-service.js',
  'docs/js/lib/view-utils.js',
  'docs/js/lib/ui-components.js',
  '.github/workflows/dashboard-checks.yml',
];
required.forEach(exists);

walk(path.join(docs, 'js')).filter(file => file.endsWith('.js')).forEach(file => {
  try {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
  } catch (error) {
    failures.push(`Sintaxi incorrecta: ${path.relative(root, file)} (${error.message})`);
  }
});

function firstCsvLine(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').split(/\r?\n/, 1)[0];
}

const sessionsHeader = firstCsvLine('docs/data/sessions.csv');
['Data', 'Tipus'].forEach(column => {
  if (!sessionsHeader.includes(column)) failures.push(`sessions.csv no conté la columna ${column}`);
});

const planningHeader = firstCsvLine('docs/data/planning.csv');
['Setmana', 'Data_Inici', 'Data_Fi'].forEach(column => {
  if (!planningHeader.includes(column)) failures.push(`planning.csv no conté la columna ${column}`);
});

try {
  const planningJson = JSON.parse(fs.readFileSync(path.join(docs, 'data/planning.json'), 'utf8'));
  const weeks = planningJson.cycles.flatMap(cycle => cycle.weeks || []);
  const sessions = weeks.flatMap(week => week.sessions || []);
  const ids = sessions.map(session => session.id);
  if (planningJson.schema_version !== 1 || !Array.isArray(planningJson.cycles)) {
    failures.push('planning.json no té schema_version 1 o cycles');
  }
  if (new Set(ids).size !== ids.length) failures.push('planning.json conté IDs de sessió duplicats');
  weeks.forEach(week => {
    if (!/^\d{4}-S\d{2}$/.test(week.code || '')) failures.push(`Codi de setmana invàlid al planning.json: ${week.code || '--'}`);
  });
} catch (error) {
  failures.push(`planning.json no és vàlid: ${error.message}`);
}

try {
  const calendarJson = JSON.parse(fs.readFileSync(path.join(docs, 'data/calendar.json'), 'utf8'));
  if (calendarJson.schema_version !== 1 || calendarJson.planning_source !== 'planning.json' || !calendarJson.weeks || typeof calendarJson.weeks !== 'object') {
    failures.push('calendar.json no té schema_version 1, planning_source o weeks vàlids');
  }
} catch (error) {
  failures.push(`calendar.json no és vàlid: ${error.message}`);
}

try {
  const sessionsJson = JSON.parse(fs.readFileSync(path.join(docs, 'data/sessions.json'), 'utf8'));
  const sessions = sessionsJson.sessions || [];
  const ids = sessions.map(session => session.id);
  if (sessionsJson.schema_version !== 1 || sessionsJson.source !== 'suunto' || !Array.isArray(sessionsJson.sessions)) {
    failures.push('sessions.json no té schema_version 1, source o sessions vàlids');
  }
  if (new Set(ids).size !== ids.length) failures.push('sessions.json conté IDs duplicats');
  sessions.forEach(session => {
    if (!session.id || !/^\d{4}-\d{2}-\d{2}$/.test(session.date || '') || !session.type || !session.sport) {
      failures.push(`Activitat incompleta a sessions.json: ${session.id || '--'}`);
    }
  });
} catch (error) {
  failures.push(`sessions.json no és vàlid: ${error.message}`);
}

const html = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
const scriptSources = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(match => match[1]);
scriptSources.forEach(source => exists(path.join('docs', source.replace(/^\.\//, ''))));

// Guardes bàsiques contra regressions XSS en els punts que renderitzen dades
// procedents de fitxers pujats o de CSV editables per l'usuari.
const securityChecks = [
  {
    file: 'docs/js/uploader/uploader-ui.js',
    forbidden: /\$\{(?:f\.name|f\.row\.(?:Tipus|Data)|e\.(?:name|reason))\}/g,
  },
  {
    file: 'docs/js/uploader/planning-uploader-ui.js',
    forbidden: /\$\{row\.(?:Setmana|Data_Inici|Data_Fi)\}/g,
  },
  {
    file: 'docs/js/views/sessions.js',
    forbidden: /onclick=["']openSessionCommentEditor/g,
  },
  {
    file: 'docs/js/views/planning.js',
    forbidden: /(?:\+\s*(?:w|week)\.(?:setmana|cicle|fase|llTipus|forcaPlan|padelPlan)|\$\{lbl\})/g,
  },
];

securityChecks.forEach(({ file, forbidden }) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (forbidden.test(source)) {
    failures.push(`Possible XSS: render insegur a ${file}`);
  }
});

const sw = fs.readFileSync(path.join(docs, 'sw.js'), 'utf8');
const precacheSources = [...sw.matchAll(/'([^']+\.js)'/g)].map(match => match[1]);
precacheSources.forEach(source => exists(path.join('docs', source.replace(/^\.\//, ''))));

const workflowPath = path.join(root, '.github/workflows/dashboard-checks.yml');
if (fs.existsSync(workflowPath)) {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  if (!workflow.includes('node scripts/check-dashboard.js')) {
    failures.push('El workflow de GitHub Actions no executa el smoke check');
  }
}

// Garanties bàsiques del refactor: no reintroduir loaders/parser antics ni
// crear gràfics fora del gestor centralitzat.
const appSource = fs.readFileSync(path.join(docs, 'js/app.js'), 'utf8');
if (/legacyFetchFirstAvailable|legacyParseCSV/.test(appSource)) {
  failures.push('app.js encara conté codi legacy de càrrega o parseig');
}
const viewSources = walk(path.join(docs, 'js/views'))
  .filter(file => file.endsWith('.js'))
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n');
if (/new\s+Chart\s*\(/.test(viewSources)) {
  failures.push('Una vista crea gràfics directament en lloc d’usar DashboardComponents');
}
if (!fs.readFileSync(path.join(docs, 'sw.js'), 'utf8').includes('const pathname = new URL(url).pathname')) {
  failures.push('El service worker no normalitza les URLs CSV amb query params');
}
const chartsSource = fs.readFileSync(path.join(docs, 'js/charts.js'), 'utf8');
if (!/function initCharts[\s\S]*?destroyChart\(['"]zones['"]\)/.test(chartsSource)) {
  failures.push('initCharts podria destruir gràfics que pertanyen a l’Overview');
}

if (failures.length) {
  console.error('Dashboard checks FAILED');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Dashboard checks OK');
}
