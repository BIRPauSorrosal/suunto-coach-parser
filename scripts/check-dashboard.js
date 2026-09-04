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

if (failures.length) {
  console.error('Dashboard checks FAILED');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Dashboard checks OK');
}
