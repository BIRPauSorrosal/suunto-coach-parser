// data-service.js
// Lectura i parseig de les fonts de dades del dashboard.
// No conté cap manipulació de DOM.

(function (global) {
  const config = global.DashboardConfig;
  const DATA_SOURCES = Object.freeze({
    sessions: [config.paths.sessions.local],
    planning: [config.paths.planning.local],
  });
  const GITHUB_CONFIG = config.github;
  const REQUEST_TIMEOUT_MS = 10000;

  async function request(url, options = {}) {
    const Controller = global.AbortController;
    const controller = typeof Controller === 'function' ? new Controller() : null;
    const timeoutId = controller ? global.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
    try {
      return await global.fetch(url, controller
        ? { ...options, signal: controller.signal }
        : options);
    } finally {
      if (timeoutId) global.clearTimeout(timeoutId);
    }
  }

  function base64ToUtf8(base64) {
    const binary = global.atob(base64.replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], value = '', insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (insideQuotes && next === '"') {
          value += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }
      if (char === ',' && !insideQuotes) {
        row.push(value);
        value = '';
        continue;
      }
      if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && next === '\n') i++;
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
        continue;
      }
      value += char;
    }

    if (value.length > 0 || row.length > 0) {
      row.push(value);
      rows.push(row);
    }

    const cleanRows = rows.filter(cols =>
      cols.some(cell => String(cell).trim() !== '')
    );
    if (!cleanRows.length) return [];

    const headers = cleanRows[0].map(header =>
      String(header || '').replace(/^\uFEFF/, '').trim()
    );

    return cleanRows.slice(1).map(cols => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = (cols[index] || '').trim();
      });
      return entry;
    });
  }

  async function fetchFirstAvailable(paths) {
    const token = global.getGitHubToken ? global.getGitHubToken() : '';

    if (token) {
      for (const path of paths) {
        try {
          const repoPath = path.replace(/^\.\//, 'docs/');
          const apiUrl =
            `https://api.github.com/repos/${GITHUB_CONFIG.owner}/` +
            `${GITHUB_CONFIG.repo}/contents/${repoPath}?ref=${GITHUB_CONFIG.branch}`;
          const response = await request(apiUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
            },
          });
          if (!response.ok) throw new Error(`API GitHub: ${response.status}`);

          const json = await response.json();
          const text = base64ToUtf8(json.content);
          if (!text.trim()) throw new Error(`Fitxer buit: ${repoPath}`);
          return { path, text };
        } catch (error) {
          console.warn('[data-service] Fallback a Pages:', error.message);
        }
      }
    }

    let lastError = null;
    for (const path of paths) {
      try {
        const response = await request(`${path}?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} a ${path}`);
        const buffer = await response.arrayBuffer();
        const text = new TextDecoder('utf-8').decode(buffer);
        if (!text.trim()) throw new Error(`Fitxer buit a ${path}`);
        return { path, text };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Cap ruta vàlida per al CSV');
  }

  async function load() {
    const [sessionsResult, planningResult] = await Promise.all([
      fetchFirstAvailable(DATA_SOURCES.sessions),
      fetchFirstAvailable(DATA_SOURCES.planning),
    ]);

    return {
      sessions: parseCSV(sessionsResult.text),
      planning: parseCSV(planningResult.text),
      sources: {
        sessions: sessionsResult.path,
        planning: planningResult.path,
      },
    };
  }

  global.DashboardDataService = Object.freeze({
    DATA_SOURCES,
    base64ToUtf8,
    parseCSV,
    fetchFirstAvailable,
    load,
  });
})(window);
