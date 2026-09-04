// docs/js/lib/github-token-modal.js
// Modal de configuració del token de GitHub per a l'uploader.
// Guarda el token al navegador — per defecte només durant la sessió.
// Exposa: openGitHubTokenModal(), getGitHubToken()

(function () {

  const MODAL_ID    = 'gh-token-modal';
  const OVERLAY_ID  = 'gh-token-overlay';
  const STORAGE_KEY = 'gh-token';
  const SESSION_STORAGE_KEY = 'gh-token-session';

  function readStorage(storage, key) {
    try { return storage.getItem(key) || ''; } catch (_) { return ''; }
  }

  function writeStorage(storage, key, value) {
    try { storage.setItem(key, value); } catch (_) { /* storage bloquejat */ }
  }

  function removeStorage(storage, key) {
    try { storage.removeItem(key); } catch (_) { /* storage bloquejat */ }
  }

  // ── API pública ───────────────────────────────────────────────
  window.getGitHubToken = function () {
    return readStorage(sessionStorage, SESSION_STORAGE_KEY)
      || readStorage(localStorage, STORAGE_KEY);
  };

  window.openGitHubTokenModal = function () {
    _inject();
    _populate();
    const overlay = document.getElementById(OVERLAY_ID);
    overlay.style.display = '';
    overlay.hidden = false;
    overlay.offsetHeight;
    overlay.classList.add('fc-modal-overlay--visible');
    document.getElementById('gh-token-input').focus();
  };

  // ── Injecta el HTML (un sol cop) ──────────────────────────────
  function _inject() {
    if (document.getElementById(MODAL_ID)) return;

    const overlay = document.createElement('div');
    overlay.id        = OVERLAY_ID;
    overlay.className = 'fc-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="fc-modal" id="${MODAL_ID}">

        <div class="fc-modal-header">
          <div>
            <p class="fc-modal-eyebrow">Configuració</p>
            <h3>Token de GitHub</h3>
          </div>
          <button class="fc-modal-close" id="gh-token-close" aria-label="Tancar">✕</button>
        </div>

        <div class="fc-modal-body">

          <div class="fc-modal-fcmax-row">
            <label class="fc-modal-label" for="gh-token-input">
              Personal Access Token
              <span class="fc-modal-hint">Es guarda al navegador, mai al repo</span>
            </label>
            <input
              type="password"
              id="gh-token-input"
              class="fc-modal-input"
              style="width:100%; text-align:left; font-size:.8rem; letter-spacing:.05em;"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              autocomplete="off"
              spellcheck="false"
            />
            <label class="fc-modal-checkbox">
              <input type="checkbox" id="gh-token-remember" />
              Recorda el token en aquest navegador
            </label>
          </div>

          <p class="fc-modal-hint" style="margin-top:8px; line-height:1.6;">
            Genera'l a
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer"
               style="color:var(--accent)">
              GitHub → Settings → Developer settings → Fine-grained tokens
            </a>
            amb accés només a aquest repositori i permís <strong>Contents: Read and write</strong>.
            Defineix també una data d'expiració.
          </p>

          <div id="gh-token-status" style="margin-top:12px; font-size:.78rem;"></div>
          <div id="gh-token-error" class="fc-modal-error" hidden></div>

        </div>

        <div class="fc-modal-footer">
          <button class="btn btn-ghost btn-sm" id="gh-token-clear">Esborrar token</button>
          <div class="fc-modal-footer-right">
            <button class="btn btn-ghost" id="gh-token-cancel">Cancel·lar</button>
            <button class="btn btn-primary" id="gh-token-save">Desar</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
    _bindEvents(overlay);
  }

  // ── Omple l'input amb el token actual ─────────────────────────
  function _populate() {
    const persistedToken = readStorage(localStorage, STORAGE_KEY);
    const sessionToken = readStorage(sessionStorage, SESSION_STORAGE_KEY);
    const token = sessionToken || persistedToken;
    document.getElementById('gh-token-input').value = token;
    document.getElementById('gh-token-remember').checked = Boolean(persistedToken && !sessionToken);
    _updateStatus(token);
    document.getElementById('gh-token-error').hidden = true;
  }

  // ── Mostra l'estat actual del token ───────────────────────────
  function _updateStatus(token) {
    const el = document.getElementById('gh-token-status');
    if (!el) return;
    const branch = window.DashboardConfig?.github?.branch || 'desconeguda';
    if (token) {
      el.textContent = `✅ Token configurat · branca ${branch}`;
      el.style.color = 'var(--accent)';
    } else {
      el.textContent = "⚠️ Sense token — l'uploader descarregarà el CSV en local";
      el.style.color = 'var(--text-muted)';
    }
  }

  // ── Events ────────────────────────────────────────────────────
  function _bindEvents(overlay) {
    const close = () => {
      overlay.classList.remove('fc-modal-overlay--visible');
      overlay.hidden = true;
      overlay.style.display = 'none';
    };

    document.getElementById('gh-token-close').addEventListener('click', close);
    document.getElementById('gh-token-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !overlay.hidden) close();
    });

    // Desar
    document.getElementById('gh-token-save').addEventListener('click', () => {
      const token = document.getElementById('gh-token-input').value.trim();
      if (!token) {
        const err = document.getElementById('gh-token-error');
        err.textContent = 'Introdueix un token vàlid o utilitza "Esborrar token".';
        err.hidden = false;
        return;
      }
      const remember = document.getElementById('gh-token-remember').checked;
      if (remember) {
        writeStorage(localStorage, STORAGE_KEY, token);
        removeStorage(sessionStorage, SESSION_STORAGE_KEY);
      } else {
        writeStorage(sessionStorage, SESSION_STORAGE_KEY, token);
        removeStorage(localStorage, STORAGE_KEY);
      }
      close();
      // Notifica csv-writer.js perquè actualitzi la seva referència
      window.dispatchEvent(new CustomEvent('gh-token-changed'));
    });

    // Esborrar
    document.getElementById('gh-token-clear').addEventListener('click', () => {
      removeStorage(localStorage, STORAGE_KEY);
      removeStorage(sessionStorage, SESSION_STORAGE_KEY);
      document.getElementById('gh-token-input').value = '';
      document.getElementById('gh-token-remember').checked = false;
      _updateStatus('');
    });
  }

})();
