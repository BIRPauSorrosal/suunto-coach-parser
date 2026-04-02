// docs/js/views/comment-editor.js
// Editor de comentaris de sessions
// Depèn de: csv-writer.js (fetchCurrentCSV, csvToObjects, objectsToCsv, pushCSVToGitHub, showNotice)

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
    const { content } = await fetchCurrentCSV();
    const rows = content ? csvToObjects(content) : [];
    const row  = rows.find(r => String(r['Arxiu'] ?? '') === arxiu);

    if (!row) {
      showNotice('❌ No s’ha trobat la sessió al CSV.', true);
      return;
    }

    ta.value = row['Comentari'] ?? '';
    dialog.showModal();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    saveBtn.disabled = false;

    saveBtn.onclick = async () => {
      await saveSessionComment();
    };
  } catch (err) {
    console.error(err);
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

    const { content, sha } = await fetchCurrentCSV();
    const rows = content ? csvToObjects(content) : [];

    const idx = rows.findIndex(r => String(r['Arxiu'] ?? '') === _sessionCommentContext.arxiu);
    if (idx === -1) {
      throw new Error('No s’ha trobat la sessió a editar.');
    }

    rows[idx]['Comentari'] = text;

    const csvText = objectsToCsv(rows);
    await pushCSVToGitHub(csvText, sha);

    showNotice('✅ Comentari guardat.');

    closeSessionCommentEditor();

    if (typeof loadData === 'function') {
      await loadData();
    }
  } catch (err) {
    console.error(err);
    showNotice(`❌ Error guardant comentari: ${err.message}`, true);
    saveBtn.disabled = false;
  }
}