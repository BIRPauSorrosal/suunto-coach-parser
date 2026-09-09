// docs/js/views/comment-editor.js
// Editor de comentaris de sessions
// Depèn de: csv-writer.js (sessions.json helpers i showNotice)

function ensureSessionCommentDialog() {
  if (document.getElementById('session-comment-dialog')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'session-comment-dialog';
  dialog.className = 'session-comment-dialog';
  dialog.innerHTML = `
    <div class="session-comment-modal">
      <header class="session-comment-modal__header">
        <div>
          <p class="session-comment-modal__eyebrow">Comentari de sessió</p>
          <h3 id="session-comment-title">Editar comentari</h3>
          <p id="session-comment-subtitle" class="session-comment-modal__subtitle"></p>
        </div>
        <button
          type="button"
          class="session-comment-modal__close"
          id="session-comment-close"
          aria-label="Tancar"
        >✕</button>
      </header>

      <div class="session-comment-modal__body">
        <textarea
          id="session-comment-textarea"
          class="session-comment-modal__textarea"
          rows="7"
          placeholder="Afegeix aquí el teu comentari sobre la sessió..."
        ></textarea>
      </div>

      <footer class="session-comment-modal__footer">
        <button type="button" class="btn btn-ghost" id="session-comment-cancel">
          Cancel·lar
        </button>
        <button type="button" class="btn btn-primary" id="session-comment-save">
          Guardar
        </button>
      </footer>
    </div>
  `;

  document.body.appendChild(dialog);

  dialog.addEventListener('click', e => {
    if (e.target === dialog) closeSessionCommentEditor();
  });
  dialog.addEventListener('cancel', e => {
    e.preventDefault();
    closeSessionCommentEditor();
  });

  document.getElementById('session-comment-close')
    .addEventListener('click', closeSessionCommentEditor);

  document.getElementById('session-comment-cancel')
    .addEventListener('click', closeSessionCommentEditor);
}

let _sessionCommentContext = null;

async function openSessionCommentEditor({ arxiu, data, tipus }) {
  ensureSessionCommentDialog();

  if (!arxiu) {
    showNotice('❌ No s’ha trobat la clau Arxiu de la sessió.', true);
    return;
  }

  const dialog   = document.getElementById('session-comment-dialog');
  const titleEl  = document.getElementById('session-comment-title');
  const subEl    = document.getElementById('session-comment-subtitle');
  const ta       = document.getElementById('session-comment-textarea');
  const saveBtn  = document.getElementById('session-comment-save');

  titleEl.textContent = 'Editar comentari';
  subEl.textContent   = `${tipus || 'Sessió'} · ${data || ''}`;
  ta.value            = '';
  saveBtn.disabled    = true;

  _sessionCommentContext = { arxiu };

  try {
    showNotice('Llegint comentari actual...');
    const supabaseActivities = await window.SupabaseDataProvider?.getActivities?.();
    const supabaseSession = supabaseActivities?.activities?.find(item => String(item.source_file || item.id) === String(arxiu));
    if (supabaseSession) {
      ta.value = supabaseSession.notes?.comment ?? '';
      dialog.showModal();
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      saveBtn.disabled = false;
      saveBtn.onclick = async () => { await saveSessionComment(); };
      return;
    }
    const { document: sessionsDocument } = await readCurrentSessionsJSON();
    const session = sessionsDocument.sessions.find(item => String(item.source_file || item.id) === String(arxiu));

    if (!session) {
      showNotice('❌ No s’ha trobat l’activitat a sessions.json.', true);
      return;
    }

    ta.value = session.notes?.comment ?? '';
    dialog.showModal();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    saveBtn.disabled = false;

    saveBtn.onclick = async () => {
      await saveSessionComment();
    };
  } catch (err) {
    console.error(err);
    window.DashboardComponents?.showToast({ type: 'error', message: 'No s’ha pogut obrir l’editor. Revisa la connexió i torna-ho a provar.' });
    showNotice(`❌ Error obrint l’editor: ${err.message}`, true);
  }
}

function closeSessionCommentEditor() {
  const dialog = document.getElementById('session-comment-dialog');
  if (dialog?.open) dialog.close();
  _sessionCommentContext = null;
}

async function saveSessionComment() {
  if (!_sessionCommentContext?.arxiu) return;

  const ta      = document.getElementById('session-comment-textarea');
  const saveBtn = document.getElementById('session-comment-save');
  const text    = ta.value.trim();

  saveBtn.disabled = true;

  try {
    showNotice('Guardant comentari...');

    const supabaseResult = await window.SupabaseDataProvider?.saveActivityComment(_sessionCommentContext.arxiu, text);
    if (supabaseResult?.status === 'synced') {
      showNotice('âœ… Comentari guardat a Supabase.');
      window.dashboardStore?.setData?.({
        ...window.dashboardStore.getState(),
        sessions: window.dashboardStore.getState().sessions,
      });
      window.DashboardComponents?.showToast?.({ type: 'success', message: 'Comentari guardat correctament.' });
      closeSessionCommentEditor();
      await window.refreshDashboard?.({ silent: true, force: true });
      window.refreshDashboardUI?.();
      return;
    }
    if (supabaseResult?.status === 'conflict') {
      throw new Error('El comentari ha canviat en un altre dispositiu. Torna a obrir l’editor.');
    }

    const { document: sessionsDocument, sha } = await readCurrentSessionsJSON();
    const idx = sessionsDocument.sessions.findIndex(item => String(item.source_file || item.id) === String(_sessionCommentContext.arxiu));
    if (idx === -1) {
      throw new Error('No s’ha trobat l’activitat a editar.');
    }

    const updatedDocument = {
      ...sessionsDocument,
      sessions: sessionsDocument.sessions.map((session, sessionIndex) => sessionIndex === idx
        ? { ...session, notes: { ...(session.notes || {}), comment: text } }
        : session),
    };
    const token = window.getGitHubToken ? window.getGitHubToken() : '';
    if (token) {
      await pushSessionsJSONToGitHub(updatedDocument, sha);
    } else {
      // Sense token no podem escriure al repositori: descarreguem el document
      // canònic complet perquè l’usuari el pugui substituir manualment.
      window.dashboardStore?.setData?.({
        ...window.dashboardStore.getState(),
        sessions: window.DashboardDataService.normalizeSessionsJSON(updatedDocument),
        sessionsDocument: updatedDocument,
      });
      downloadSessionsJSON(updatedDocument);
    }

    showNotice('✅ Comentari guardat.');

    window.DashboardComponents?.showToast({ type: 'success', message: 'Comentari guardat correctament.' });
    closeSessionCommentEditor();

    if (token && typeof window.refreshDashboard === 'function') {
      await window.refreshDashboard();
    } else {
      window.refreshDashboardUI?.();
    }
  } catch (err) {
    console.error(err);
    window.DashboardComponents?.showToast({ type: 'error', message: 'No s’ha pogut guardar el comentari. Revisa la connexió i torna-ho a provar.' });
    showNotice(`❌ Error guardant comentari: ${err.message}`, true);
    saveBtn.disabled = false;
  }
}
