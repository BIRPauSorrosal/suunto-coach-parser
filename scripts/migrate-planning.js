#!/usr/bin/env node

// Migració única: planning.csv (pla setmanal pla) -> planning.json (cicles/setmanes/sessions).
// No canvia cap fitxer d'activitats ni és encara l'importador de l'aplicació.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'docs', 'data', 'planning.csv');
const output = path.join(root, 'docs', 'data', 'planning.json');

function parseCsv(text) {
  const rows = [], row = [];
  let current = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(current); current = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(current); current = '';
      if (row.some(value => value.trim())) rows.push(row.splice(0));
    } else current += ch;
  }
  if (current || row.length) { row.push(current); if (row.some(value => value.trim())) rows.push(row); }
  const headers = rows.shift().map(value => value.replace(/^\uFEFF/, '').trim());
  return rows.map(values => Object.fromEntries(headers.map((header, i) => [header, (values[i] || '').trim()])));
}

function number(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}
function integer(value) { const parsed = number(value); return parsed === null ? null : Math.round(parsed); }
function date(value) { return new Date(`${value}T00:00:00Z`); }
function isoWeekInfo(value) {
  const d = date(value), day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d - first) / 86400000) + 1) / 7);
  return { year, week };
}
function codeFor(value) {
  const { year, week } = isoWeekInfo(value);
  return `${year}-S${String(week).padStart(2, '0')}`;
}
function slug(value) { return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined && entry !== '')); }

const rows = parseCsv(fs.readFileSync(input, 'utf8'));
const result = { schema_version: 1, season: 2026, source: 'planning.csv', cycles: [] };
let previousCycle = null, cycleNumber = 0, cycle;

for (const row of rows) {
  if (row.Cicle !== previousCycle) {
    cycleNumber++;
    const { year } = isoWeekInfo(row.Data_Inici);
    cycle = { id: `${year}-${slug(row.Cicle)}-${String(cycleNumber).padStart(2, '0')}`, name: row.Cicle, start: row.Data_Inici, end: row.Data_Fi, weeks: [] };
    result.cycles.push(cycle);
    previousCycle = row.Cicle;
  } else cycle.end = row.Data_Fi;

  const code = codeFor(row.Data_Inici);
  const sessions = [];
  if (row.Q_Km_Plan || row.Q_Series) sessions.push({
    id: `${code}-quality-01`, type: 'quality', sport: 'running', variant: 'road', day: null,
    distance_km: number(row.Q_Km_Plan), series: integer(row.Q_Series),
    series_duration_min: number(row.Q_Durada_Serie_min), pace_min_km: number(row.Q_Ritme_min_km),
    recovery_min: number(row.Q_Rec_min), heart_rate: compact({ min: integer(row.Q_FC_min), max: integer(row.Q_FC_max) })
  });
  if (row.Z2_Km_Plan || row.Z2_Durada_min) sessions.push({
    id: `${code}-z2-01`, type: 'z2', sport: 'running', variant: 'road', day: null, distance_km: number(row.Z2_Km_Plan), duration_min: number(row.Z2_Durada_min),
    pace_min_km: compact({ min: number(row.Z2_Ritme_min_km_min), max: number(row.Z2_Ritme_min_km_max) }),
    heart_rate: compact({ min: integer(row.Z2_FC_min), max: integer(row.Z2_FC_max) })
  });
  if (row.LL_Km_Plan || row.LL_Durada_min) sessions.push({
    id: `${code}-long-run-01`, type: 'long-run', sport: 'running', variant: 'road', day: null,
    distance_km: number(row.LL_Km_Plan), duration_min: number(row.LL_Durada_min), description: row.LL_Tipus,
    pace_min_km: null, heart_rate: { min: null, max: null }
  });
  if (row.Forca_Plan) {
    const strengthValue = String(row.Forca_Plan).trim();
    const sessionCount = /^\d+$/.test(strengthValue) ? Number(strengthValue) : 1;
    const sessionType = /^\d+$/.test(strengthValue) ? null : strengthValue;
    for (let i = 1; i <= sessionCount; i++) sessions.push({
      id: `${code}-strength-${String(i).padStart(2, '0')}`, type: 'strength', sport: 'strength', variant: null, day: null, session_type: sessionType
    });
  }
  if (row.Padel_Plan) sessions.push({ id: `${code}-padel-01`, type: 'padel', sport: 'padel', variant: null, day: null, label: row.Padel_Plan });

  cycle.weeks.push({
    id: row.Data_Inici, code, start: row.Data_Inici, end: row.Data_Fi, phase: row.Fase,
    summary: compact({ weekly_km_target: number(row.Km_Total_Plan), quality_km_target: number(row.Q_Km_Plan), z2_km_target: number(row.Z2_Km_Plan), long_run_km_target: number(row.LL_Km_Plan), strength_plan: row.Forca_Plan, padel_plan: row.Padel_Plan }),
    sessions
  });
}

// En aquests blocs el CSV original agregava dues sessions Z2 en una sola fila.
// Es divideixen aquí sense alterar el total setmanal del resum.
const splitZ2Weeks = new Set(['2026-S34', '2026-S35', '2026-S36', '2026-S41', '2026-S42']);
for (const currentCycle of result.cycles) {
  for (const week of currentCycle.weeks) {
    if (!splitZ2Weeks.has(week.code)) continue;
    const z2Index = week.sessions.findIndex(session => session.type === 'z2');
    if (z2Index < 0 || week.sessions.filter(session => session.type === 'z2').length !== 1) continue;
    const first = week.sessions[z2Index];
    const second = JSON.parse(JSON.stringify(first));
    first.id = `${week.code}-z2-01`;
    second.id = `${week.code}-z2-02`;
    if (typeof first.distance_km === 'number') first.distance_km /= 2;
    if (typeof first.duration_min === 'number') first.duration_min /= 2;
    if (typeof second.distance_km === 'number') second.distance_km /= 2;
    if (typeof second.duration_min === 'number') second.duration_min /= 2;
    week.sessions.splice(z2Index, 1, first, second);
  }
}

fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`Migrades ${rows.length} setmanes a ${path.relative(root, output)}.`);
