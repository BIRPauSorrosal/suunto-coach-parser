// docs/js/lib/fc-config-modal.js
// Modal de configuració de zones de FC.
// Depèn de: fc-scale.js (FC_CONFIG, FC_SCALE, FC_DEFAULTS, loadFCConfig, saveFCConfig, calcDefaultBpms)
// Exposa: openFCConfigModal()

(function () {

  // ── Constants ────────────────────────────────────────────────────────────────
  const MODAL_ID   = 'fc-config-modal';
  const OVERLAY_ID = 'fc-config-overlay';

  const ZONE_COLORS = {
    z1: '#38bdf8',
    z2: '#22c55e',
    z3: '#facc15',
    z4: '#f97316',
    z5: '#ef4444',
  };

  // ── Injecta el HTML del modal al body (un sol cop) ───────────────────────────
  function _inject() {
    if (document.getElementById(MODAL_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'fc-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'fc-modal-title');

    overlay.innerHTML = `
      <div class="fc-modal" id="${MODAL_ID}">

        <div class="fc-modal-header">
          <div>
            <p class="fc-modal-eyebrow">Configuració</p>
            <h3 id="fc-modal-title">Zones de freqüència cardíaca</h3>
          </div>
          <button class="fc-modal-close" id="fc-modal-close" aria-label="Tancar">✕</button>
        </div>

        <div class="fc-modal-body">

          <div class="fc-modal-fcmax-row">
            <label class="fc-modal-label" for="fc-input-fcmax">
              FC Màxima (bpm)
              <span class="fc-modal-hint">Calcula els valors per defecte</span>
            </label>
            <div class="fc-modal-fcmax-control">
              <input
                type="text"
                id="fc-input-fcmax"
                class="fc-modal-input fc-modal-input--fcmax"
                maxlength="3"
                inputmode="numeric"
                placeholder="185"
                autocomplete="off"
              />
              <button class="btn btn-ghost btn-sm" id="fc-btn-recalc">
                ↺ Recalcula
              </button>
            </div>
          </div>

          <div class="fc-modal-divider"></div>

          <p class="fc-modal-zones-title">Límit superior de cada zona (bpm)</p>

          <div class="fc-modal-zones" id="fc-modal-zones">
            ${FC_SCALE.map((z, i) => `
              <div class="fc-zone-row" data-index="${i}">
                <div class="fc-zone-dot" style="background:${ZONE_COLORS[z.key]}"></div>
                <span class="fc-zone-label">${z.label}</span>
                <input
                  type="text"
                  id="fc-input-z${i + 1}"
                  class="fc-modal-input fc-modal-input--zone"
                  maxlength="3"
                  inputmode="numeric"
                  data-index="${i}"
                  autocomplete="off"
                />
                <span class="fc-zone-unit">bpm</span>
              </div>
            `).join('')}
          </div>

          <div id="fc-modal-error" class="fc-modal-error" hidden></div>

        </div>

        <div class="fc-modal-footer">
          <button class="btn btn-ghost" id="fc-btn-reset">Valors per defecte</button>
          <div class="fc-modal-footer-right">
            <button class="btn btn-ghost" id="fc-btn-cancel">Cancel·lar</button>
            <button class="btn btn-primary" id="fc-btn-save">Desar</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
    _bindEvents(overlay);
  }

  // ── Omple els inputs amb la config actual ────────────────────────────────────
  function _populate() {
    const cfg = loadFCConfig();
    document.getElementById('fc-input-fcmax').value = cfg.fcMax;
    FC_SCALE.forEach((_, i) => {
      document.getElementById(`fc-input-z${i + 1}`).value = cfg.zones[i];
    });
    _clearError();
  }

  // ── Lògica de validació ──────────────────────────────────────────────────────

  // Retorna true si el string és un enter positiu de màx 3 dígits
  function _isValidBpm(val) {
    return /^\d{1,3}$/.test(val.trim()) && parseInt(val, 10) > 0;
  }

  function _showError(msg) {
    const el = document.getElementById('fc-modal-error');
    el.textContent = msg;
    el.hidden = false;
  }

  function _clearError() {
    const el = document.getElementById('fc-modal-error');
    el.hidden = true;
    el.textContent = '';
    // Treu marques d'error de tots els inputs
    document.querySelectorAll('.fc-modal-input--error')
      .forEach(inp => inp.classList.remove('fc-modal-input--error'));
  }

  // Valida i retorna { ok, fcMax, zones } o { ok: false }
  function _readAndValidate() {
    _clearError();
    let valid = true;

    // FCMax
    const fcMaxEl = document.getElementById('fc-input-fcmax');
    if (!_isValidBpm(fcMaxEl.value)) {
      fcMaxEl.classList.add('fc-modal-input--error');
      _showError('La FC Màxima ha de ser un número entre 1 i 999.');
      return { ok: false };
    }
    const fcMax = parseInt(fcMaxEl.value, 10);

    // Zones Z1–Z5
    const zones = [];
    for (let i = 0; i < FC_SCALE.length; i++) {
      const el = document.getElementById(`fc-input-z${i + 1}`);
      if (!_isValidBpm(el.value)) {
        el.classList.add('fc-modal-input--error');
        _showError(`${FC_SCALE[i].label}: introdueix un número entre 1 i 999.`);
        valid = false;
        break;
      }
      zones.push(parseInt(el.value, 10));
    }
    if (!valid) return { ok: false };

    // Ordre ascendent: Z1 < Z2 < Z3 < Z4 < Z5
    for (let i = 1; i < zones.length; i++) {
      if (zones[i] <= zones[i - 1]) {
        document.getElementById(`fc-input-z${i + 1}`).classList.add('fc-modal-input--error');
        _showError(
          `${FC_SCALE[i].label} (${zones[i]}) ha de ser més gran que ${FC_SCALE[i - 1].label} (${zones[i - 1]}).`
        );
        return { ok: false };
      }
    }

    return { ok: true, fcMax, zones };
  }

  // ── Binding d'events ──────────────────────────────────────────────────────────
  function _bindEvents(overlay) {

    // Tanca el modal
    const close = () => {
    overlay.classList.remove('fc-modal-overlay--visible');
    overlay.hidden = true;
    overlay.style.display = 'none';
    };

    document.getElementById('fc-modal-close').addEventListener('click', close);
    document.getElementById('fc-btn-cancel').addEventListener('click', close);

    // Clic a l'overlay (fora del modal) també tanca
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    // Escape tanca
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !overlay.hidden) close();
    });

    // Filtrar: només dígits (0-9), permetre backspace/delete/fletxes/tab
    const allowedKeys = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Enter'];
    document.querySelectorAll('.fc-modal-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (allowedKeys.includes(e.key)) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
      });
      // Neteja l'error visual quan l'usuari comença a editar
      inp.addEventListener('input', () => {
        inp.classList.remove('fc-modal-input--error');
        _clearError();
      });
    });

    // Recalcula zones a partir de FCMax
    document.getElementById('fc-btn-recalc').addEventListener('click', () => {
      const fcMaxEl = document.getElementById('fc-input-fcmax');
      if (!_isValidBpm(fcMaxEl.value)) {
        fcMaxEl.classList.add('fc-modal-input--error');
        _showError('Introdueix una FC Màxima vàlida abans de recalcular.');
        return;
      }
      const bpms = calcDefaultBpms(parseInt(fcMaxEl.value, 10));
      FC_SCALE.forEach((_, i) => {
        document.getElementById(`fc-input-z${i + 1}`).value = bpms[i];
      });
      _clearError();
    });

    // Reset als valors per defecte (FCMax = 185)
    document.getElementById('fc-btn-reset').addEventListener('click', () => {
      document.getElementById('fc-input-fcmax').value = FC_DEFAULTS.fcMax;
      const bpms = calcDefaultBpms(FC_DEFAULTS.fcMax);
      FC_SCALE.forEach((_, i) => {
        document.getElementById(`fc-input-z${i + 1}`).value = bpms[i];
      });
      _clearError();
    });

    // Desar
    document.getElementById('fc-btn-save').addEventListener('click', () => {
    const result = _readAndValidate();
    if (!result.ok) return;

    // 1. Actualitza la config global i la guarda
    FC_CONFIG.fcMax = result.fcMax;
    FC_CONFIG.zones = result.zones;
    saveFCConfig(FC_CONFIG);

    // 2. Tanca el modal de forma SÍNCRONA (sense esperar transitionend)
    const overlay = document.getElementById(OVERLAY_ID);
    overlay.classList.remove('fc-modal-overlay--visible');
    overlay.hidden = true;

    // 3. Notifica l'app UN COP el modal ja és fora del DOM actiu
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('fc-config-changed', { detail: FC_CONFIG }));
    }, 0);
    });
  }

  // ── API pública ───────────────────────────────────────────────────────────────
    window.openFCConfigModal = function () {
    _inject();
    _populate();
    const overlay = document.getElementById(OVERLAY_ID);
    overlay.style.display = '';        // ← restaura el display
    overlay.hidden = false;
    overlay.offsetHeight;              // reflow per activar transició
    overlay.classList.add('fc-modal-overlay--visible');
    document.getElementById('fc-input-fcmax').focus();
    };

})();