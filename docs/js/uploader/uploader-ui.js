// ─────────────────────────────────────────────────────────────
// uploader-ui.js — Modal, render i events del importador
// Depèn de: uploader.js (handleFileSelection, confirmImport)
// NO conté cap lògica de parsing ni de fitxers
// ─────────────────────────────────────────────────────────────


// ─── CONSTRUCCIÓ DEL MODAL ───────────────────────────────────

/**
 * Injecta el <dialog> al DOM. S'executa només un cop.
 * Usa l'element natiu <dialog> (HTML5) — sense llibreries.
 */
function buildModal() {
  if (document.getElementById("uploader-dialog")) return;

  const dialog = document.createElement("dialog");
  dialog.id        = "uploader-dialog";
  dialog.className = "uploader-dialog";
  dialog.innerHTML = `
    <div class="uploader-inner">

      <header class="uploader-header">
        <h3>Importar activitats</h3>
        <button class="uploader-close" id="uploader-close-btn" aria-label="Tancar">✕</button>
      </header>

      <div class="uploader-dropzone" id="uploader-dropzone">
        <p class="uploader-dropzone-title">Arrossega els fitxers aquí</p>
        <p class="uploader-dropzone-sub">o</p>
        <label class="btn btn-ghost" for="uploader-file-input">
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
          Afegir al CSV
        </button>
      </footer>

    </div>
  `;

  document.body.appendChild(dialog);
  _bindEvents(dialog);
}


// ─── RENDER DE RESULTATS ─────────────────────────────────────

/**
 * Actualitza la secció de resultats del modal.
 * Cridat pel callback onDone de handleFileSelection().
 *
 * @param {Array} ok     — [{ name, row }]
 * @param {Array} errors — [{ name, reason }]
 */
function renderResults(ok, errors) {
  const resultsEl  = document.getElementById("uploader-results");
  const okSection  = document.getElementById("uploader-ok-section");
  const errSection = document.getElementById("uploader-err-section");
  const confirmBtn = document.getElementById("uploader-confirm-btn");

  resultsEl.style.display = "block";

  // ── Fitxers vàlids ──
  if (ok.length) {
    document.getElementById("uploader-ok-count").textContent = ok.length;
    document.getElementById("uploader-ok-list").innerHTML = ok
      .map(f => `
        <li class="uploader-list-item">
          <span class="uploader-item-icon">📄</span>
          <span class="uploader-item-name">${f.name}</span>
          <span class="uploader-item-badge">${f.row.Tipus}</span>
          <span class="uploader-item-date">${f.row.Data}</span>
        </li>`)
      .join("");
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
          <span class="uploader-item-name">${e.name}</span>
          <span class="uploader-item-reason">${e.reason}</span>
        </li>`)
      .join("");
    errSection.style.display = "block";
  } else {
    errSection.style.display = "none";
  }
}

/**
 * Canvia l'estat visual del botó de confirmació.
 */
function setConfirmState(state) {
  const btn = document.getElementById("uploader-confirm-btn");
  if (!btn) return;
  const states = {
    idle:        { text: "Afegir al CSV",  disabled: false },
    validating:  { text: "Validant...",    disabled: true  },
    processing:  { text: "Processant...",  disabled: true  },
  };
  const s = states[state] ?? states.idle;
  btn.textContent = s.text;
  btn.disabled    = s.disabled;
}


// ─── RESET DEL MODAL ─────────────────────────────────────────

function _resetModal() {
  const results  = document.getElementById("uploader-results");
  const fileInput = document.getElementById("uploader-file-input");
  if (results)   results.style.display  = "none";
  if (fileInput) fileInput.value        = "";
  setConfirmState("idle");
  document.getElementById("uploader-confirm-btn").disabled = true;
}


// ─── BINDING D'EVENTS ────────────────────────────────────────

function _bindEvents(dialog) {

  // ── Tancar ──
  document.getElementById("uploader-close-btn")
    .addEventListener("click", closeUploaderModal);
  document.getElementById("uploader-cancel-btn")
    .addEventListener("click", closeUploaderModal);

  // Clic fora del diàleg
  dialog.addEventListener("click", e => {
    if (e.target === dialog) closeUploaderModal();
  });

  // ── Input fitxers ──
  document.getElementById("uploader-file-input")
    .addEventListener("change", async e => {
      const files = Array.from(e.target.files);
      setConfirmState("validating");
      await handleFileSelection(files, renderResults);  // uploader.js
      setConfirmState("idle");
    });

  // ── Drag & drop ──
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
      await confirmImport(closeUploaderModal);  // uploader.js
    });
}


// ─── OBRIR / TANCAR ──────────────────────────────────────────

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


// ─── INIT: botó al sidebar ───────────────────────────────────

/**
 * Afegeix el botó "Importar activitats" just sota #reload-data-btn.
 * S'executa automàticament quan el DOM està llest.
 */
function initUploaderUI() {
  const reloadBtn = document.getElementById("reload-data-btn");
  if (!reloadBtn) return;

  const btn = document.createElement("button");
  btn.type        = "button";
  btn.className   = "btn btn-primary btn-sidebar";
  btn.id          = "import-data-btn";
  btn.textContent = "Importar activitats";
  btn.addEventListener("click", openUploaderModal);

  reloadBtn.insertAdjacentElement("afterend", btn);
}

document.addEventListener("DOMContentLoaded", initUploaderUI);