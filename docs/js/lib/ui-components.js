// ui-components.js
// Components visuals petits i reutilitzables. Retornen HTML o instàncies, però
// no coneixen cap vista concreta.

(function (global) {
  const chartInstances = new Map();

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderBadge(label, { className = 'badge', title = '' } = {}) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<span class="${escapeHtml(className)}"${titleAttr}>${escapeHtml(label)}</span>`;
  }

  function renderEmptyState(message, {
    tag = 'p',
    className = 'empty-state',
    colspan,
  } = {}) {
    const safeMessage = escapeHtml(message);
    if (tag === 'tr') {
      const cellSpan = colspan ? ` colspan="${Number(colspan)}"` : '';
      return `<tr class="${escapeHtml(className)}"><td${cellSpan}>${safeMessage}</td></tr>`;
    }
    return `<${tag} class="${escapeHtml(className)}">${safeMessage}</${tag}>`;
  }

  function renderLoadingState(message = 'Carregant dades…', { className = 'loading-state' } = {}) {
    return `<p class="${escapeHtml(className)}" role="status" aria-live="polite">${escapeHtml(message)}</p>`;
  }

  function renderMetricCard({ label, value = '--', detail = '', className = '' } = {}) {
    const classes = ['metric-card', className].filter(Boolean).join(' ');
    return `<article class="${escapeHtml(classes)}">
      <span class="metric-card__label">${escapeHtml(label)}</span>
      <strong class="metric-card__value">${escapeHtml(value)}</strong>
      ${detail ? `<span class="metric-card__detail">${escapeHtml(detail)}</span>` : ''}
    </article>`;
  }

  function renderDataTable({
    columns = [],
    rows = [],
    emptyMessage = 'Sense dades',
    className = '',
    theadId = '',
    tbodyId = '',
    wrap = true,
  } = {}) {
    const header = columns.map(column => {
      const cls = column.cls ? ` class="${escapeHtml(column.cls)}"` : '';
      return `<th${cls}>${escapeHtml(column.label || '')}</th>`;
    }).join('');
    const body = rows.length
      ? rows.map(row => `<tr>${columns.map(column => {
        const cls = column.cls ? ` class="${escapeHtml(column.cls)}"` : '';
        const content = typeof column.render === 'function'
          ? column.render(row)
          : row[column.key] ?? '';
        return `<td${cls}>${content}</td>`;
      }).join('')}</tr>`).join('')
      : renderEmptyState(emptyMessage, { tag: 'tr', className: 'empty-row', colspan: columns.length });
    const theadAttr = theadId ? ` id="${escapeHtml(theadId)}"` : '';
    const tbodyAttr = tbodyId ? ` id="${escapeHtml(tbodyId)}"` : '';
    const markup = `<thead${theadAttr}><tr>${header}</tr></thead><tbody${tbodyAttr}>${body}</tbody>`;
    return wrap
      ? `<table${className ? ` class="${escapeHtml(className)}"` : ''}>${markup}</table>`
      : markup;
  }

  function renderModal({ id, title, body = '', footer = '', className = 'modal' } = {}) {
    const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
    return `<div${idAttr} class="${escapeHtml(className)}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="${escapeHtml(className)}__header"><h2>${escapeHtml(title)}</h2></header>
      <div class="${escapeHtml(className)}__body">${body}</div>
      ${footer ? `<footer class="${escapeHtml(className)}__footer">${footer}</footer>` : ''}
    </div>`;
  }

  function destroyChart(key) {
    const chart = chartInstances.get(key);
    if (!chart) return;
    chart.destroy();
    chartInstances.delete(key);
  }

  function createChart(key, canvas, config) {
    if (!canvas || typeof global.Chart !== 'function') return null;
    destroyChart(key);
    const chart = new global.Chart(canvas, config);
    chartInstances.set(key, chart);
    return chart;
  }

  function destroyAllCharts() {
    [...chartInstances.keys()].forEach(destroyChart);
  }

  global.DashboardComponents = Object.freeze({
    escapeHtml,
    renderBadge,
    renderEmptyState,
    renderLoadingState,
    renderMetricCard,
    renderDataTable,
    renderModal,
    createChart,
    destroyChart,
    destroyAllCharts,
  });
})(window);
