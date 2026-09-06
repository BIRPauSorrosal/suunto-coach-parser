// Cua persistent de canvis pendents de sincronitzar.
(function (global) {
  const STORAGE_KEY = 'suunto-coach-sync-queue-v1';
  const read = () => { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } };
  const write = queue => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch (_) {} };
  const keyOf = operation => `${operation.kind}:${operation.key}`;
  const notify = detail => global.dispatchEvent(new CustomEvent('sync-queue-status', { detail: { pending: read().length, ...detail } }));

  function enqueue(operation) {
    const queue = read(), queueKey = keyOf(operation), index = queue.findIndex(item => (item.queue_key || keyOf(item)) === queueKey);
    const item = { ...operation, queue_key: queueKey, queued_at: operation.queued_at || new Date().toISOString(), attempts: (queue[index]?.attempts || 0) + 1 };
    if (index >= 0) queue[index] = item; else queue.push(item);
    write(queue); notify({ status: 'pending', key: queueKey });
  }

  function complete(operation) {
    const key = typeof operation === 'string' ? operation : (operation.queue_key || keyOf(operation));
    write(read().filter(item => (item.queue_key || keyOf(item)) !== key)); notify({ status: 'synced', key });
  }

  function markConflict(operation) {
    const queueKey = typeof operation === 'string' ? operation : (operation.queue_key || keyOf(operation));
    const queue = read();
    const item = queue.find(entry => (entry.queue_key || keyOf(entry)) === queueKey);
    if (!item) return;
    item.conflict = true;
    item.last_error = 'conflict';
    write(queue);
    notify({ status: 'conflict', key: queueKey });
  }

  async function retry() {
    const queue = read();
    notify({ status: queue.length ? 'syncing' : 'idle' });
    for (const operation of queue) {
      if (operation.conflict) continue;
      try {
        let result;
        if (operation.kind === 'calendar') result = await global.CalendarSync?.saveWeek(operation.week, operation.value, true);
        if (operation.kind === 'sessions') result = await global.SessionsSync?.savePlanningLinks(operation.key, operation.links, true);
        if (operation.kind === 'settings') result = await global.SettingsSync?.saveHeartRate(operation.config, true);
        if (result?.status === 'synced') complete(operation);
      } catch (_) { /* queda a la cua per al proper intent */ }
    }
    notify({ status: read().length ? 'pending' : 'idle' });
  }

  function resolve(queueKey, choice) {
    const queue = read(), item = queue.find(operation => (operation.queue_key || keyOf(operation)) === queueKey);
    if (!item) return;
    if (choice === 'remote') { complete(queueKey); return; }
    if (choice === 'local') { item.conflict = false; write(queue); retry(); }
  }

  const list = () => read().map(operation => ({ ...operation }));
  const forwardStatus = event => notify(event.detail || {});

  global.SyncQueue = Object.freeze({ enqueue, complete, markConflict, retry, resolve, list, pending: () => read().length });
  ['calendar-sync-status', 'sessions-sync-status', 'settings-sync-status'].forEach(name => {
    global.addEventListener(name, forwardStatus);
  });
  global.addEventListener('online', retry);
  global.addEventListener('gh-token-changed', retry);
  global.addEventListener('load', () => { if (read().length) retry(); });
})(window);
