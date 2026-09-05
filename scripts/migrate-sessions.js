#!/usr/bin/env node

// Converteix l'històric normalitzat de sessions.csv al model sessions.json.
// El CSV original no es modifica i continua servint com a còpia de seguretat.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'docs', 'data', 'sessions.csv');
const output = path.join(root, 'docs', 'data', 'sessions.json');

function parseCSV(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(value); if (row.some(cell => cell.trim())) rows.push(row);
      row = []; value = '';
    } else value += char;
  }
  if (value || row.length) { row.push(value); if (row.some(cell => cell.trim())) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(header => header.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, i) => [header, (values[i] || '').trim()])));
}

function number(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateISO(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function slug(value) {
  return String(value || '').replace(/\.json$/i, '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function classify(type) {
  const value = String(type || '').trim().toUpperCase();
  if (value === 'Z2') return { type: 'z2', sport: 'running', variant: null, subtype: null };
  if (['TEMPO', 'INTERVALS'].includes(value)) return { type: 'quality', sport: 'running', variant: null, subtype: null };
  if (value === 'TEST') return { type: 'test', sport: 'running', variant: null, subtype: null };
  if (value === 'CURSA') return { type: 'race', sport: 'running', variant: null, subtype: null };
  if (['LLARGA', 'MARATÓ', 'MARATO', 'TRAIL', 'MITJA'].includes(value)) return { type: 'long-run', sport: 'running', variant: null, subtype: null };
  if (/^FOR[ÇC]A/.test(value)) return { type: 'strength', sport: 'strength', variant: null, subtype: value.match(/S\d+/)?.[0] || null };
  if (['BICI ESTÀTICA', 'TEST_BICI'].includes(value)) return { type: 'cycling', sport: 'cycling', variant: null, subtype: null };
  if (value === 'PADEL') return { type: 'padel', sport: 'padel', variant: null, subtype: null };
  if (value === 'HIKING') return { type: 'hiking', sport: 'hiking', variant: null, subtype: null };
  if (['NATACIÓ', 'NATACIO', 'SWIM'].includes(value)) return { type: 'swimming', sport: 'swimming', variant: null, subtype: null };
  return { type: 'other', sport: 'other', variant: null, subtype: null };
}

function parseIntervals(value) {
  if (!value) return [];
  let parsed;
  try { parsed = JSON.parse(value); }
  catch (_) {
    try { parsed = JSON.parse(value.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')); }
    catch (_) { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(item => ({
    series: number(item.serie),
    distance_m: number(item.dist_m),
    duration_min: number(item.dur_min),
    pace_min_km: number(item.ritme),
    heart_rate: { average: number(item.fc_mitja), max: number(item.fc_max) },
    cadence_spm: number(item.cadencia),
  }));
}

function convertRow(row, usedIds) {
  const source = row.Arxiu || `session-${row.Data}-${row.Tipus}`;
  const base = slug(source) || 'session';
  let id = base, suffix = 2;
  while (usedIds.has(id)) id = `${base}-${String(suffix++).padStart(2, '0')}`;
  usedIds.add(id);
  const classification = classify(row.Tipus);
  const nullable = field => number(row[field]);
  return {
    id,
    source_file: source ? `${source}.json` : null,
    date: dateISO(row.Data),
    ...classification,
    duration_min: nullable('Durada(min)'),
    distance_km: nullable('Dist(km)'),
    elevation_m: nullable('Desnivell(m)'),
    feeling: nullable('Feeling'),
    vo2max: nullable('VO2max'),
    pace_min_km: nullable('Ritme(min/km)'),
    cadence_spm: nullable('Cadencia(spm)'),
    heart_rate: { average: nullable('FCMitja'), max: nullable('FCMax') },
    zones: {
      z1_min: nullable('Z1(min)'), z2_min: nullable('Z2(min)'), z3_min: nullable('Z3(min)'),
      z4_min: nullable('Z4(min)'), z5_min: nullable('Z5(min)')
    },
    training_effect: { pte: nullable('PTE'), epoc: nullable('EPOC'), load: nullable('Carrega') },
    recovery: { hours: nullable('Recup(h)') },
    calories: nullable('Calories'),
    intervals: parseIntervals(row.Series_Detall),
    notes: { comment: row.Comentari || null },
    planning_links: []
  };
}

const rows = parseCSV(fs.readFileSync(input, 'utf8'));
const usedIds = new Set();
const result = { schema_version: 1, source: 'suunto', sessions: rows.map(row => convertRow(row, usedIds)) };
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`Convertides ${result.sessions.length} activitats a ${path.relative(root, output)}.`);
