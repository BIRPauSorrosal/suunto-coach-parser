// docs/js/lib/formatters.js
// Helpers de presentació purs — sense DOM, sense Chart.js
// Disponibles globalment per a totes les vistes

// ── Números ───────────────────────────────────────────────────────────────────
function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).trim().replace(/,/g, '.'));
  return isFinite(n) ? n : null;
}

function fmtNum(value) {
  const n = parseFloat(value);
  if (!isFinite(n)) return '--';
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(n);
}

// ── Dates ─────────────────────────────────────────────────────────────────────
function formatDate(date) {
  return new Intl.DateTimeFormat('ca-ES').format(date);
}

// ── Ritme (min/km) ────────────────────────────────────────────────────────────
// Exemples: 4.75 → "4:45 min/km" | "4:30" → "4:30 min/km" | null → "-- min/km"
function formatPace(value, unit = 'min/km') {
  const suffix = unit ? ` ${unit}` : '';

  if (typeof value === 'string' && /^\d+:[0-5]\d$/.test(value.trim())) {
    return value.trim() + suffix;
  }

  const n = (typeof value === 'string') ? toNumber(value) : value;
  if (n == null || !isFinite(n) || n <= 0) return `--${suffix}`;

  const mins = Math.floor(n);
  const secs = Math.round((n - mins) * 60);
  if (secs === 60) return `${mins + 1}:00${suffix}`;
  return `${mins}:${String(secs).padStart(2, '0')}${suffix}`;
}

// ── HTML escaping ─────────────────────────────────────────────────────────────
function esc(v) {
  return String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}