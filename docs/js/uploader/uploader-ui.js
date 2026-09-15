// ───────────────────────────────────────────────────────────────
// uploader-ui.js — Modal, render i events del importador
// Depèn de: uploader.js (handleFileSelection, confirmImport)
// NO conté cap lògica de parsing ni de fitxers
// ───────────────────────────────────────────────────────────────


// ─── CONSTRUCCIÓ DEL MODAL ──────────────────────────────────

/**
 * Injecta el <dialog> al DOM. S'executa només un cop.
 * Usa l'element natiu <dialog> (HTML5) — sense llibreries.
 */
function buildModal() {
  if (document.getElementById("uploader-dialog")) return;

  const dialog = document.createElement("dialog");
  dialog.id        = "uploader-dialog";
  dialog.className = "uploader-dialog";
  dialog.setAttribute("aria-labelledby", "uploader-dialog-title");
  dialog.innerHTML = `
    <div class="uploader-inner">

      <header class="uploader-header">
        <h3 id="uploader-dialog-title">Importar activitats</h3>
        <button class="uploader-close" id="uploader-close-btn" aria-label="Tancar">✕</button>
      </header>

      <div class="uploader-dropzone" id="uploader-dropzone">
        <p class="uploader-dropzone-title">Arrossega els fitxers aquí</p>
        <p class="uploader-dropzone-sub">o</p>
        <label class="btn btn-ghost" for="uploader-file-input">
          Selecciona fitxers .json
        </label>
        <label class="uploader-touch-btn" for="uploader-file-input">
          <span class="uploader-touch-btn-icon">📂</span>
          Selecciona fitxers .json
        </label>
        <input
          type="file"
          id="uploader-file-input"
          accept=".json"
          multiple
          style="display:none"
        />
      </div>

      <div class="uploader-results" id="uploader-results" style="display:none">

        <div id="uploader-ok-section" style="display:none">
          <p class="uploader-section-title uploader-section-title--ok">
            ✅ <span id="uploader-ok-count">0</span> fitxers preparats
          </p>
          <ul class="uploader-list" id="uploader-ok-list"></ul>
        </div>

        <div id="uploader-err-section" style="display:none">
          <p class="uploader-section-title uploader-section-title--err">
            ⚠️ <span id="uploader-err-count">0</span> fitxers descartats
          </p>
          <ul class="uploader-list uploader-list--err" id="uploader-err-list"></ul>
        </div>

      </div>

      <footer class="uploader-footer">
        <button class="btn btn-ghost"   id="uploader-cancel-btn">Cancel·lar</button>
        <button class="btn btn-primary" id="uploader-confirm-btn" disabled>
          Importar
        </button>
      </footer>

    </div>
  `;

  document.body.appendChild(dialog);
  _bindEvents(dialog);
}


// ─── RENDER DE RESULTATS ────────────────────────────────────

/**
 * Actualitza la secció de resultats del modal.
 * Cridat pel callback onDone de handleFileSelection().
 *
 * Cada fitxer vàlid mostra un textarea col·lapsable per afegir
 * un comentari opcional a la sessió. L'id del textarea segueix
 * el patró: uploader-comment-{index}
 *
 * @param {Array} ok     — [{ name, row }]
 * @param {Array} errors — [{ name, reason }]
 */
function renderResults(ok, errors) {
  const escapeHtml = window.DashboardComponents?.escapeHtml
    || (value => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;'));
  const resultsEl  = document.getElementById("uploader-results");
  const okSection  = document.getElementById("uploader-ok-section");
  const errSection = document.getElementById("uploader-err-section");
  const confirmBtn = document.getElementById("uploader-confirm-btn");

  resultsEl.style.display = "block";

  // ── Fitxers vàlids ──
  if (ok.length) {
    document.getElementById("uploader-ok-count").textContent = ok.length;
    document.getElementById("uploader-ok-list").innerHTML = ok
      .map((f, i) => {
        const session = f.row.__session || {};
        const classification = activityClassification(session);
        const sportOptions = activitySportOptions()
          .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === classification.sport ? ' selected' : ''}>${escapeHtml(label)}</option>`)
          .join('');
        const typeOptions = activityTypeOptionsForSport(classification.sport)
          .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === classification.activityType ? ' selected' : ''}>${escapeHtml(label)}</option>`)
          .join('');
        const variantType = activityCanonicalTypeFor(classification.sport, classification.activityType, session.type);
        const variantOptions = activityVariantOptions(variantType, session.variant)
          .map(option => `<option value="${escapeHtml(option.value)}"${option.value === session.variant ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('');
        return `
        <li class="uploader-list-item uploader-list-item--with-comment">
          <div class="uploader-item-row">
            <span class="uploader-item-icon">📄</span>
            <span class="uploader-item-name">${escapeHtml(f.name)}</span>
            <span class="uploader-item-badge">${escapeHtml(f.row.Tipus)}</span>
            <span class="uploader-item-date">${escapeHtml(f.row.Data)}</span>
            <button
              type="button"
              class="uploader-comment-toggle"
              aria-label="Afegir comentari"
              aria-expanded="false"
              data-target="uploader-comment-${i}"
              title="Afegir comentari"
            >✏️</button>
          </div>
          <div class="uploader-variant-row">
            <label for="uploader-sport-${i}">Esport</label>
            <select id="uploader-sport-${i}" class="uploader-sport-input">${sportOptions}</select>
          </div>
          <div class="uploader-variant-row">
            <label for="uploader-type-${i}">Tipus</label>
            <select id="uploader-type-${i}" class="uploader-type-input">${typeOptions}</select>
          </div>
          <div class="uploader-variant-row">
            <label for="uploader-variant-${i}">Variant</label>
            <select id="uploader-variant-${i}" class="uploader-variant-input">${variantOptions}</select>
          </div>
          <div class="uploader-comment-area" id="uploader-comment-area-${i}" style="display:none">
            <textarea
              id="uploader-comment-${i}"
              class="uploader-comment-input"
              placeholder="Comentari opcional per a aquesta sessió..."
              rows="2"
            ></textarea>
          </div>
        </li>`;
      })
      .join("");

    // Binding dels botons toggle (delegació d'events sobre la llista)
    document.getElementById("uploader-ok-list")
      .addEventListener("click", _handleCommentToggle);
    document.getElementById("uploader-ok-list")
      .addEventListener("change", _handleTypeChange);

    okSection.style.display  = "block";
    confirmBtn.disabled      = false;
  } else {
    okSection.style.display  = "none";
    confirmBtn.disabled      = true;
  }

  // ── Fitxers amb error ──
  if (errors.length) {
    document.getElementById("uploader-err-count").textContent = errors.length;
    document.getElementById("uploader-err-list").innerHTML = errors
      .map(e => `
        <li class="uploader-list-item uploader-list-item--err">
          <span class="uploader-item-icon">❌</span>
          <span class="uploader-item-name">${escapeHtml(e.name)}</span>
          <span class="uploader-item-reason">${escapeHtml(e.reason)}</span>
        </li>`)
      .join("");
    errSection.style.display = "block";
  } else {
    errSection.style.display = "none";
  }
}

/**
 * Gestiona el clic al botó ✏️ de cada ítem.
 * Expandeix/col·lapsa el textarea de comentari.
 */
function _handleCommentToggle(e) {
  const btn = e.target.closest(".uploader-comment-toggle");
  if (!btn) return;

  const targetId = btn.dataset.target;
  const areaId   = "uploader-comment-area-" + targetId.replace("uploader-comment-", "");
  const area     = document.getElementById(areaId);
  if (!area) return;

  const isOpen = area.style.display !== "none";
  area.style.display = isOpen ? "none" : "block";
  btn.setAttribute("aria-expanded", String(!isOpen));
  btn.classList.toggle("uploader-comment-toggle--active", !isOpen);

  // Focus automàtic al obrir
  if (!isOpen) {
    const textarea = area.querySelector("textarea");
    if (textarea) textarea.focus();
  }
}

/**
 * Recull tots els comentaris introduïts als textareas.
 * Retorna un array de strings, un per cada fitxer OK (en ordre).
 */
function collectComments() {
  const items = document.querySelectorAll("#uploader-ok-list .uploader-list-item--with-comment");
  return Array.from(items).map((_, i) => {
    const ta = document.getElementById(`uploader-comment-${i}`);
    return ta ? ta.value.trim() : "";
  });
}

function collectVariants() {
  return Array.from(document.querySelectorAll('#uploader-ok-list .uploader-variant-input'))
    .map(select => select.value || null);
}

function collectActivitySports() {
  return Array.from(document.querySelectorAll('#uploader-ok-list .uploader-sport-input'))
    .map(select => select.value || 'other');
}

function collectActivityTypes() {
  return Array.from(document.querySelectorAll('#uploader-ok-list .uploader-type-input'))
    .map(select => select.value || 'other');
}

function _renderImportTypeOptions(row, selectedType) {
  const sportSelect = row.querySelector('.uploader-sport-input');
  const typeSelect = row.querySelector('.uploader-type-input');
  if (!sportSelect || !typeSelect) return;
  const options = activityTypeOptionsForSport(sportSelect.value);
  const selected = options.some(([value]) => value === selectedType) ? selectedType : options[0]?.[0] || 'general';
  typeSelect.innerHTML = options
    .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  _renderImportVariantOptions(row, selected);
}

function _renderImportVariantOptions(row, selectedType) {
  const sportSelect = row.querySelector('.uploader-sport-input');
  const variantSelect = row.querySelector('.uploader-variant-input');
  if (!sportSelect || !variantSelect) return;
  const canonicalType = activityCanonicalTypeFor(sportSelect.value, selectedType);
  variantSelect.innerHTML = activityVariantOptions(canonicalType)
    .map(option => `<option value="${option.value}">${option.label}</option>`).join('');
}

function _handleTypeChange(event) {
  const row = event.target.closest('.uploader-list-item');
  if (!row) return;
  if (event.target.closest('.uploader-sport-input')) {
    _renderImportTypeOptions(row, row.querySelector('.uploader-type-input')?.value);
    return;
  }
  const typeSelect = event.target.closest('.uploader-type-input');
  if (typeSelect) _renderImportVariantOptions(row, typeSelect.value);
}


/**
 * Canvia l'estat visual del botó de confirmació.
 */
function setConfirmState(state) {
  const btn = document.getElementById("uploader-confirm-btn");
  if (!btn) return;
  const states = {
    idle:        { text: "Importar",       disabled: false },
    validating:  { text: "Validant...",    disabled: true  },
    processing:  { text: "Important...",   disabled: true  },
  };
  const s = states[state] ?? states.idle;
  btn.textContent = s.text;
  btn.disabled    = s.disabled;
}


// ─── RESET DEL MODAL ────────────────────────────────────────────

function _resetModal() {
  const results   = document.getElementById("uploader-results");
  const fileInput = document.getElementById("uploader-file-input");
  if (results)   results.style.display = "none";
  if (fileInput) fileInput.value       = "";
  setConfirmState("idle");
  document.getElementById("uploader-confirm-btn").disabled = true;
}


// ─── BINDING D'EVENTS ───────────────────────────────────────────

function _bindEvents(dialog) {

  // ── Tancar ──
  document.getElementById("uploader-close-btn")
    .addEventListener("click", closeUploaderModal);
  document.getElementById("uploader-cancel-btn")
    .addEventListener("click", closeUploaderModal);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeUploaderModal();
  });

  // Clic fora del diàleg: només tanca si el clic és exactament
  // sobre el backdrop del <dialog> (e.target === dialog),
  // i NO sobre cap element interior (dropzone, botó, etc.).
  // Usem pointerdown per evitar que el clic al label propagui fins aquí.
  dialog.addEventListener("pointerdown", e => {
    if (e.target === dialog) closeUploaderModal();
  });

  // ── Input fitxers ──
  const fileInput = document.getElementById("uploader-file-input");
  fileInput.addEventListener("change", async e => {
    const files = Array.from(e.target.files);
    setConfirmState("validating");
    await handleFileSelection(files, renderResults);  // uploader.js
    setConfirmState("idle");
  });

  // ── Labels → input: garantir el clic en tots els contextos (desktop i mòbil).
  // El <label for="..."> és suficient en la majoria de casos, però dins d'un
  // <dialog> natiu alguns navegadors (Chrome amb touch emulation, Safari iOS)
  // bloquen la propagació. El listener explícit ho resol universalment.
  // S'aplica als dos labels: el btn-ghost (desktop) i el touch-btn (mòbil).
  dialog.querySelectorAll("label[for='uploader-file-input']").forEach(lbl => {
    lbl.addEventListener("click", e => {
      e.preventDefault();
      fileInput.click();
    });
  });

  // ── Drag & drop: actiu sempre (desktop i mòbil amb suport natiu).
  // No es condiciona a IS_TOUCH — en mòbil simplement no s'activa mai
  // perquè els navegadors mòbils no disparen events dragover/drop.
  const dropzone = document.getElementById("uploader-dropzone");
  dropzone.addEventListener("dragover", e => {
    e.preventDefault();
    dropzone.classList.add("uploader-dropzone--over");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("uploader-dropzone--over");
  });
  dropzone.addEventListener("drop", async e => {
    e.preventDefault();
    dropzone.classList.remove("uploader-dropzone--over");
    const files = Array.from(e.dataTransfer.files)
      .filter(f => f.name.toLowerCase().endsWith(".json"));
    setConfirmState("validating");
    await handleFileSelection(files, renderResults);  // uploader.js
    setConfirmState("idle");
  });

  // ── Confirmar ──
  document.getElementById("uploader-confirm-btn")
    .addEventListener("click", async () => {
      setConfirmState("processing");
      const comments = collectComments();
      const result = await confirmImport(comments, collectVariants(), collectActivityTypes(), collectActivitySports(), closeUploaderModal);  // uploader.js
      if (!result?.ok) setConfirmState("idle");
    });
}


// ─── OBRIR / TANCAR ─────────────────────────────────────────────

function openUploaderModal() {
  buildModal();
  _resetModal();
  document.getElementById("uploader-dialog").showModal();
}

function closeUploaderModal() {
  const dialog = document.getElementById("uploader-dialog");
  if (dialog?.open) dialog.close();
  _resetModal();
}


// ─── INIT: botó al sidebar + drawer mòbil ───────────────────────────

/**
 * Afegeix el botó "Importar activitats":
 *   • A la sidebar de desktop: just sota #reload-data-btn
 *   • Al drawer mòbil (#bnav-drawer-actions): just sobre #reload-data-btn-mobile
 * S'executa automàticament quan el DOM està llest.
 */
function initUploaderUI() {
  // ── Sidebar (desktop) ──
  const reloadBtn = document.getElementById("reload-data-btn");
  if (reloadBtn && !document.getElementById("import-data-btn")) {
    const btn = document.createElement("button");
    btn.type        = "button";
    btn.className   = "btn btn-primary btn-sidebar";
    btn.id          = "import-data-btn";
    btn.textContent = "Importar activitats";
    btn.addEventListener("click", openUploaderModal);
    reloadBtn.insertAdjacentElement("beforebegin", btn);
  }

  // ── Drawer mòbil ──
  const reloadMobileBtn = document.getElementById("reload-data-btn-mobile");
  if (reloadMobileBtn && !document.getElementById("import-data-btn-mobile")) {
    const btn = document.createElement("button");
    btn.type        = "button";
    btn.className   = "btn btn-primary";
    btn.id          = "import-data-btn-mobile";
    btn.textContent = "📂 Importar activitats";
    btn.addEventListener("click", () => {
      closeBnavDrawer();
      openUploaderModal();
    });
    reloadMobileBtn.insertAdjacentElement("beforebegin", btn);
  }
}

document.addEventListener("DOMContentLoaded", initUploaderUI);
