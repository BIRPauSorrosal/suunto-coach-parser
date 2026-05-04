// ───────────────────────────────────────────────────────────────
// planning-uploader-ui.js — Modal, render i events del
//                           importador de planning
// Depèn de: planning-uploader.js
// NO conté cap lògica de merge ni de fitxers
// ───────────────────────────────────────────────────────────────


// ─── CONSTRUCCIÓ DEL MODAL ──────────────────────────────────

/**
 * Injecta el <dialog> del planning al DOM. S'executa només un cop.
 * Segueix exactament el mateix patró que uploader-ui.js.
 */
function buildPlanningModal() {
  if (document.getElementById("planning-uploader-dialog")) return;

  const dialog = document.createElement("dialog");
  dialog.id        = "planning-uploader-dialog";
  dialog.className = "uploader-dialog";  // reutilitza els mateixos estils CSS
  dialog.innerHTML = `
    <div class="uploader-inner">

      <header class="uploader-header">
        <h3>Importar planning</h3>
        <button class="uploader-close" id="planning-uploader-close-btn" aria-label="Tancar">✕</button>
      </header>

      <!-- Zona de selecció de fitxer -->
      <div class="uploader-dropzone" id="planning-uploader-dropzone">
        <p class="uploader-dropzone-title">Arrossega el fitxer aquí</p>
        <p class="uploader-dropzone-sub">o</p>
        <label class="btn btn-ghost" for="planning-uploader-file-input">
          Selecciona planning.csv
        </label>
        <input
          type="file"
          id="planning-uploader-file-input"
          accept=".csv"
          style="display:none"
        />
      </div>

      <!-- Resum del merge (ocult fins que hi ha dades) -->
      <div class="uploader-results" id="planning-uploader-results" style="display:none">

        <!-- Capçalera resum -->
        <div class="planning-merge-summary" id="planning-merge-summary" style="display:none">
          <span class="planning-badge planning-badge--added"   id="planning-count-added">0 noves</span>
          <span class="planning-badge planning-badge--replaced" id="planning-count-replaced">0 subs.</span>
          <span class="planning-badge planning-badge--unchanged" id="planning-count-unchanged">0 sense canvis</span>
        </div>

        <!-- Llista de files entrants amb el seu estat -->
        <div id="planning-uploader-ok-section" style="display:none">
          <p class="uploader-section-title uploader-section-title--ok">
            ✅ <span id="planning-uploader-ok-count">0</span> setmanes a processar
          </p>
          <ul class="uploader-list" id="planning-uploader-ok-list"></ul>
        </div>

        <!-- Error de validació -->
        <div id="planning-uploader-err-section" style="display:none">
          <p class="uploader-section-title uploader-section-title--err">
            ⚠️ Error de validació
          </p>
          <p class="planning-error-msg" id="planning-uploader-err-msg"></p>
        </div>

      </div>

      <footer class="uploader-footer">
        <button class="btn btn-ghost"   id="planning-uploader-cancel-btn">Cancel·lar</button>
        <button class="btn btn-primary" id="planning-uploader-confirm-btn" disabled>
          Importar planning
        </button>
      </footer>

    </div>
  `;

  document.body.appendChild(dialog);
  _bindPlanningEvents(dialog);
}


// ─── RENDER DE RESULTATS ────────────────────────────────────

/**
 * Renderitza el resum del merge al modal.
 * Cridat pel callback onDone de handlePlanningFileSelection().
 *
 * @param {{ ok: boolean, error: string|null, merge: object }} result
 */
function renderPlanningResults(result) {
  const resultsEl  = document.getElementById("planning-uploader-results");
  const okSection  = document.getElementById("planning-uploader-ok-section");
  const errSection = document.getElementById("planning-uploader-err-section");
  const confirmBtn = document.getElementById("planning-uploader-confirm-btn");

  resultsEl.style.display = "block";

  if (!result.ok) {
    // ── Error de validació ──
    errSection.style.display = "block";
    okSection.style.display  = "none";
    document.getElementById("planning-uploader-err-msg").textContent = result.error;
    confirmBtn.disabled = true;

    // Amagar resum de merge
    document.getElementById("planning-merge-summary").style.display = "none";
    return;
  }

  // ── Merge correcte ──
  errSection.style.display = "none";

  const { stats, incoming } = result.merge;

  // Actualitzar badges de resum
  document.getElementById("planning-merge-summary").style.display = "flex";
  document.getElementById("planning-count-added").textContent     = `${stats.added} noves`;
  document.getElementById("planning-count-replaced").textContent  = `${stats.replaced} subs.`;
  document.getElementById("planning-count-unchanged").textContent = `${stats.unchanged} sense canvis`;

  // Llista de setmanes entrants amb el seu estat
  const ICONS  = { added: "🟢", replaced: "🟡", unchanged: "⚪" };
  const LABELS = { added: "Nova", replaced: "Substituïda", unchanged: "Sense canvis" };

  document.getElementById("planning-uploader-ok-count").textContent = incoming.length;
  document.getElementById("planning-uploader-ok-list").innerHTML = incoming
    .map(({ row, status }) => `
      <li class="uploader-list-item">
        <span class="uploader-item-icon">${ICONS[status]}</span>
        <span class="uploader-item-name">${row.Setmana}</span>
        <span class="uploader-item-date">${row.Data_Inici} → ${row.Data_Fi}</span>
        <span class="uploader-item-badge uploader-item-badge--${status}">${LABELS[status]}</span>
      </li>`)
    .join("");

  okSection.style.display = "block";

  // Habilitar el botó de confirmació només si hi ha canvis reals
  confirmBtn.disabled = (stats.added + stats.replaced) === 0;
  confirmBtn.title = confirmBtn.disabled
    ? "No hi ha canvis nous respecte al planning actual."
    : "";
}

/**
 * Canvia l'estat visual del botó de confirmació del planning.
 */
function setPlanningConfirmState(state) {
  const btn = document.getElementById("planning-uploader-confirm-btn");
  if (!btn) return;
  const states = {
    idle:       { text: "Importar planning", disabled: false },
    validating: { text: "Validant...",        disabled: true  },
    processing: { text: "Processant...",      disabled: true  },
  };
  const s = states[state] ?? states.idle;
  btn.textContent = s.text;
  btn.disabled    = s.disabled;
}


// ─── RESET DEL MODAL ────────────────────────────────────────────

function _resetPlanningModal() {
  const results   = document.getElementById("planning-uploader-results");
  const fileInput = document.getElementById("planning-uploader-file-input");
  if (results)   results.style.display = "none";
  if (fileInput) fileInput.value       = "";
  setPlanningConfirmState("idle");
  const confirmBtn = document.getElementById("planning-uploader-confirm-btn");
  if (confirmBtn) confirmBtn.disabled = true;
  clearPendingMerge();
}


// ─── BINDING D'EVENTS ───────────────────────────────────────────

function _bindPlanningEvents(dialog) {

  // ── Tancar ──
  document.getElementById("planning-uploader-close-btn")
    .addEventListener("click", closePlanningUploaderModal);
  document.getElementById("planning-uploader-cancel-btn")
    .addEventListener("click", closePlanningUploaderModal);

  dialog.addEventListener("click", e => {
    if (e.target === dialog) closePlanningUploaderModal();
  });

  // ── Input fitxer (un sol fitxer, no multiple) ──
  document.getElementById("planning-uploader-file-input")
    .addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      setPlanningConfirmState("validating");
      await handlePlanningFileSelection(file, renderPlanningResults);
      setPlanningConfirmState("idle");
    });

  // ── Drag & drop ──
  const dropzone = document.getElementById("planning-uploader-dropzone");

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
    const file = Array.from(e.dataTransfer.files)
      .find(f => f.name.toLowerCase().endsWith(".csv"));
    if (!file) return;
    setPlanningConfirmState("validating");
    await handlePlanningFileSelection(file, renderPlanningResults);
    setPlanningConfirmState("idle");
  });

  // ── Confirmar ──
  document.getElementById("planning-uploader-confirm-btn")
    .addEventListener("click", () => {
      setPlanningConfirmState("processing");
      confirmPlanningImport(closePlanningUploaderModal);
    });
}


// ─── OBRIR / TANCAR ─────────────────────────────────────────────

function openPlanningUploaderModal() {
  buildPlanningModal();
  _resetPlanningModal();
  document.getElementById("planning-uploader-dialog").showModal();
}

function closePlanningUploaderModal() {
  const dialog = document.getElementById("planning-uploader-dialog");
  if (dialog?.open) dialog.close();
  _resetPlanningModal();
}


// ─── INIT: botó al sidebar + drawer mòbil ───────────────────────────

/**
 * Afegeix el botó "Importar planning":
 *   • A la sidebar de desktop: just sota #import-data-btn
 *     (usa MutationObserver perquè #import-data-btn s'injecta dinàmicament)
 *   • Al drawer mòbil: just sobre #reload-data-btn-mobile
 *     (esperant que #import-data-btn-mobile ja existeixi, injectat per uploader-ui.js)
 */
function initPlanningUploaderUI() {

  // ── Sidebar (desktop) ──
  function _injectSidebar() {
    if (document.getElementById("import-planning-btn")) return;
    const importBtn = document.getElementById("import-data-btn");
    if (!importBtn) return;

    const btn = document.createElement("button");
    btn.type        = "button";
    btn.className   = "btn btn-primary btn-sidebar";
    btn.id          = "import-planning-btn";
    btn.textContent = "Importar planning";
    btn.addEventListener("click", openPlanningUploaderModal);
    importBtn.insertAdjacentElement("afterend", btn);
  }

  // ── Drawer mòbil ──
  function _injectDrawer() {
    if (document.getElementById("import-planning-btn-mobile")) return;
    // Espera que uploader-ui.js hagi injectat #import-data-btn-mobile
    const importMobileBtn = document.getElementById("import-data-btn-mobile");
    if (!importMobileBtn) return;

    const btn = document.createElement("button");
    btn.type        = "button";
    btn.className   = "btn btn-primary";
    btn.id          = "import-planning-btn-mobile";
    btn.textContent = "📅 Importar planning";
    btn.addEventListener("click", () => {
      closeBnavDrawer();
      openPlanningUploaderModal();
    });
    // Inserir just DESPRÉS del botó d'importar activitats
    importMobileBtn.insertAdjacentElement("afterend", btn);
  }

  _injectSidebar();
  _injectDrawer();

  // Fallback amb MutationObserver per si algun dels botons no existeix encara
  const observer = new MutationObserver(() => {
    const sidebarDone = !!document.getElementById("import-planning-btn");
    const drawerDone  = !!document.getElementById("import-planning-btn-mobile");
    if (!sidebarDone) _injectSidebar();
    if (!drawerDone)  _injectDrawer();
    if (sidebarDone && drawerDone) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.addEventListener("DOMContentLoaded", initPlanningUploaderUI);
