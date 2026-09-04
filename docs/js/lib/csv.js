// csv.js
// Parser CSV compartit per la càrrega de dades i els importadors.

(function (global) {
  function detectSeparator(text) {
    const firstLine = String(text).split(/\r?\n/, 1)[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    return semicolons > commas ? ';' : ',';
  }

  function parseRows(text, separator) {
    const rows = [];
    let row = [], value = '', insideQuotes = false;

    for (let i = 0; i < String(text).length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (insideQuotes && next === '"') {
          value += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === separator && !insideQuotes) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && next === '\n') i++;
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }

    if (value.length || row.length) {
      row.push(value);
      rows.push(row);
    }
    return rows.filter(cols => cols.some(cell => String(cell).trim() !== ''));
  }

  function parse(text, { separator = 'auto' } = {}) {
    const sep = separator === 'auto' ? detectSeparator(text) : separator;
    const rows = parseRows(text, sep);
    if (!rows.length) return [];

    const headers = rows[0].map(header =>
      String(header || '').replace(/^\uFEFF/, '').trim()
    );
    return rows.slice(1).map(cols => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = (cols[index] || '').trim();
      });
      return entry;
    });
  }

  global.DashboardCsv = Object.freeze({ detectSeparator, parseRows, parse });
})(window);
