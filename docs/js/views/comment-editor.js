// ─────────────────────────────────────────────────────────────────────────────
// comment-editor.js — Modal per editar el comentari d'una sessió
// Depèn de: csv-writer.js (fetchCurrentCSV, pushCSVToGitHub,
//            csvToObjects, objectsToCsv, showNotice)
// Ús extern: openCommentEditor(rawRow)
// ─────────────────────────────────────────────────────────────────────────────

(function () {

  // ── Crea el <dialog> la primera vegada que es crida ──────────────────────
  function getOrCreateDialog() {
    let dlg = document.getElementById('comment-editor-dialog');
    if (dlg) return dlg;

    dlg = document.createElement('dialog');
    dlg.id = 'comment-editor-dialog';
    dlg.setAttribute('aria-labelledby', 'ced-title');
    dlg.innerHTML = `
      <div class="ced-form" id="ced-form">
        <div class="ced-header">
          <h3 class="ced-title" id="ced-title">Comentari de la sessió</h3>
          <button type="button" class="ced-close" id="ced-close" aria-label="Tancar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="ced-meta" id="ced-meta"></div>
        <textarea
          id="ced-textarea"
          class="ced-textarea"
          placeholder="Escriu aquí les teves notes: sensacions, context, incidències..."
          rows="5"
          maxlength="1000"
        ></textarea>
        <div class="ced-counter"><span id="ced-char-count">0</span> / 1000</div>
        <div class="ced-actions">
          <button type="button" class="btn btn-ghost" id="ced-cancel">Cancel·lar</button>
          <button type="button" class="btn btn-primary" id="ced-save">
            <span id="ced-save-label">Guardar</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);

    // Tancar amb botó X i Cancel·lar
    dlg.querySelector('#ced-close').addEventListener('click', () => dlg.close());
    dlg.querySelector('#ced-cancel').addEventListener('click', () => dlg.close());

    // Tancar clicant fora del modal
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

    // Contador de caràcters
    dlg.querySelector('#ced-textarea').addEventListener('input', function () {
      dlg.querySelector('#ced-char-count').textContent = this.value.length;
    });

    return dlg;
  }


  // ── API pública ──────────────────────────────────────────────────────────

  /**
   * Obre el modal per editar el comentari d'una sessió.
   * @param {object} rawRow — objecte row.raw tal com ve de sessions.js
   */
  window.openCommentEditor = function (rawRow) {
    const dlg       = getOrCreateDialog();
    const textarea  = dlg.querySelector('#ced-textarea');
    const saveBtn   = dlg.querySelector('#ced-save');
    const saveLabel = dlg.querySelector('#ced-save-label');
    const metaEl    = dlg.querySelector('#ced-meta');
    const counter   = dlg.querySelector('#ced-char-count');

    // Omple el meta (Data · Tipus · Km)
    const data  = rawRow['Data']     || '';
    const tipus = rawRow['Tipus']    || '';
    const km    = rawRow['Dist(km)'] || '';
    metaEl.textContent = [data, tipus, km ? km + ' km' : ''].filter(Boolean).join(' · ');

    // Pre-omple el textarea
    const comentariActual = rawRow['Comentari'] || '';
    textarea.value = comentariActual;
    counter.textContent = comentariActual.length;

    // Reseteja estat botó
    saveBtn.disabled = false;
    saveLabel.textContent = 'Guardar';

    // Guarda: patch al CSV
    saveBtn.onclick = async () => {
      const nouComentari = textarea.value.trim();
      saveBtn.disabled = true;
      saveLabel.textContent = 'Guardant...';

      try {
        await patchCommentInCSV(rawRow['Arxiu'], nouComentari);
        // Actualitza l'objecte en memòria per reflectir-ho a la UI sense reload
        rawRow['Comentari'] = nouComentari;
        // Actualitza el badge visual de la fila
        refreshRowBadge(rawRow['Arxiu'], nouComentari);
        showNotice('✅ Comentari guardat correctament.');
        dlg.close();
      } catch (err) {
        console.error(err);
        showNotice(`❌ Error guardant comentari: ${err.message}`, true);
        saveBtn.disabled = false;
        saveLabel.textContent = 'Guardar';
      }
    };

    dlg.showModal();
    // Focus al textarea per UX
    setTimeout(() => textarea.focus(), 50);
  };


  // ── Patch del comentari al CSV remot ─────────────────────────────────────

  async function patchCommentInCSV(arxiu, nouComentari) {
    const token = window.getGitHubToken ? window.getGitHubToken() : '';

    if (!token) {
      throw new Error(
        "No hi ha token de GitHub configurat. " +
        "El comentari s'ha desat en memòria però no al repositori. " +
        "Configura el token per persistir els canvis."
      );
    }

    // 1. Llegim el CSV actual
    const { content, sha } = await fetchCurrentCSV();
    if (!content) throw new Error("No s'ha pogut llegir el CSV actual.");

    // 2. Parsejem i busquem la fila per Arxiu
    const rows = csvToObjects(content);
    const idx  = rows.findIndex(r => r['Arxiu'] === arxiu);
    if (idx === -1) throw new Error(`No s'ha trobat la sessió "${arxiu}" al CSV.`);

    // 3. Actualitzem el comentari
    rows[idx]['Comentari'] = nouComentari;

    // 4. Migració suau: garantim que totes les files tenen la columna Comentari
    rows.forEach(r => { if (!('Comentari' in r)) r['Comentari'] = ''; });

    // 5. Reescrivim i pugem
    const nouCsv = objectsToCsv(rows);
    await pushCSVToGitHub(nouCsv, sha);
  }


  // ── Actualitza el badge visual de la fila sense reload ───────────────────

  function refreshRowBadge(arxiu, comentari) {
    const btn = document.querySelector(`[data-comment-arxiu="${CSS.escape(arxiu)}"]`);
    if (!btn) return;
    btn.classList.toggle('ced-btn--has-comment', !!comentari);
    btn.title = comentari
      ? `Comentari: ${comentari.slice(0, 80)}${comentari.length > 80 ? '...' : ''}`
      : 'Afegir comentari';
  }

})();
