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

  const toastTimers = new WeakMap();

  function showToast({ type = 'info', message = '', duration = 4200 } = {}) {
    if (!message) return null;
    let container = document.getElementById('app-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'app-toast-container';
      container.className = 'app-toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast--${['success', 'info', 'warning', 'error'].includes(type) ? type : 'info'}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `<span class="app-toast__message"></span><button type="button" class="app-toast__close" aria-label="Tanca la notificació">×</button>`;
    toast.querySelector('.app-toast__message').textContent = message;
    toast.querySelector('.app-toast__close').addEventListener('click', () => dismissToast(toast));
    container.appendChild(toast);

    const timer = setTimeout(() => dismissToast(toast), duration);
    toastTimers.set(toast, timer);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    return toast;
  }

  function dismissToast(toast) {
    if (!toast) return;
    const timer = toastTimers.get(toast);
    if (timer) clearTimeout(timer);
    toastTimers.delete(toast);
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 180);
  }

  function confirmAction({
    title = 'Confirma l’acció',
    message = '',
    confirmLabel = 'Confirma',
    cancelLabel = 'Cancel·la',
    destructive = false,
  } = {}) {
    return new Promise(resolve => {
      let dialog = document.getElementById('ui-confirm-dialog');
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'ui-confirm-dialog';
        dialog.className = 'ui-confirm-dialog';
        dialog.innerHTML = `
          <form method="dialog" class="ui-confirm-dialog__surface">
            <header class="ui-confirm-dialog__header"><h3 id="ui-confirm-title"></h3></header>
            <div class="ui-confirm-dialog__body"><p id="ui-confirm-message"></p></div>
            <footer class="ui-confirm-dialog__footer">
              <button type="button" class="btn btn-ghost" id="ui-confirm-cancel"></button>
              <button type="button" class="btn btn-primary" id="ui-confirm-accept"></button>
            </footer>
          </form>`;
        document.body.appendChild(dialog);
      }

      dialog.querySelector('#ui-confirm-title').textContent = title;
      dialog.querySelector('#ui-confirm-message').textContent = message;
      dialog.querySelector('#ui-confirm-cancel').textContent = cancelLabel;
      dialog.querySelector('#ui-confirm-accept').textContent = confirmLabel;
      dialog.querySelector('#ui-confirm-accept').classList.toggle('btn-danger', destructive);

      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        if (dialog.open) dialog.close();
        resolve(value);
      };
      dialog.querySelector('#ui-confirm-cancel').onclick = () => finish(false);
      dialog.querySelector('#ui-confirm-accept').onclick = () => finish(true);
      dialog.oncancel = event => { event.preventDefault(); finish(false); };
      dialog.onclick = event => { if (event.target === dialog) finish(false); };
      dialog.showModal();
      dialog.querySelector('#ui-confirm-cancel').focus();
    });
  }

  function confirmMessage(message) {
    return confirmAction({
      title: 'Conflicte de sincronització',
      message,
      confirmLabel: 'Conserva el canvi local',
      cancelLabel: 'Conserva la versió remota',
    });
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
    showToast,
    dismissToast,
    confirmAction,
    confirmMessage,
    createChart,
    destroyChart,
    destroyAllCharts,
  });
})(window);
