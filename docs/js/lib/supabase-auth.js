// Autenticació Supabase per al dashboard estàtic.
(function (global) {
  const MODAL_ID = 'supabase-auth-overlay';
  let currentUser = null;

  function client() {
    return global.SupabaseClient?.getClient?.();
  }

  function setButtonState() {
    const label = currentUser ? `Supabase: ${currentUser.email || 'connectat'}` : 'Inicia sessió Supabase';
    ['supabase-auth-btn', 'supabase-auth-btn-mobile'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.textContent = label;
    });
  }

  function closeModal() {
    const overlay = document.getElementById(MODAL_ID);
    if (!overlay) return;
    overlay.classList.remove('fc-modal-overlay--visible');
    overlay.hidden = true;
  }

  function showError(message) {
    const error = document.getElementById('supabase-auth-error');
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
  }

  function injectModal() {
    if (document.getElementById(MODAL_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'fc-modal-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="fc-modal">
        <div class="fc-modal-header">
          <div><p class="fc-modal-eyebrow">Compte</p><h3>Supabase</h3></div>
          <button type="button" class="fc-modal-close" data-auth-close aria-label="Tancar">×</button>
        </div>
        <form class="fc-modal-body" id="supabase-auth-form">
          <label class="fc-modal-label" for="supabase-auth-email">Email</label>
          <input class="fc-modal-input" id="supabase-auth-email" type="email" autocomplete="username" required>
          <label class="fc-modal-label" for="supabase-auth-password">Contrasenya</label>
          <input class="fc-modal-input" id="supabase-auth-password" type="password" autocomplete="current-password" required>
          <p class="fc-modal-error" id="supabase-auth-error" hidden></p>
          <div class="fc-modal-footer">
            <button type="button" class="btn btn-ghost" data-auth-signout hidden>Tanca sessió</button>
            <div class="fc-modal-footer-right">
              <button type="button" class="btn btn-ghost" data-auth-close>Cancel·la</button>
              <button type="submit" class="btn btn-primary" data-auth-submit>Inicia sessió</button>
            </div>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-auth-close]').forEach(button => button.addEventListener('click', closeModal));
    overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
    overlay.querySelector('[data-auth-signout]').addEventListener('click', async () => {
      try {
        const { error } = await client().auth.signOut();
        if (error) throw error;
        closeModal();
      } catch (error) { showError(error.message); }
    });
    overlay.querySelector('#supabase-auth-form').addEventListener('submit', async event => {
      event.preventDefault();
      const submit = overlay.querySelector('[data-auth-submit]');
      submit.disabled = true;
      showError('');
      try {
        const { error } = await client().auth.signInWithPassword({
          email: overlay.querySelector('#supabase-auth-email').value.trim(),
          password: overlay.querySelector('#supabase-auth-password').value,
        });
        if (error) throw error;
        closeModal();
      } catch (error) {
        showError(error.message || 'No s’ha pogut iniciar sessió.');
      } finally { submit.disabled = false; }
    });
  }

  function openModal() {
    injectModal();
    const overlay = document.getElementById(MODAL_ID);
    const form = document.getElementById('supabase-auth-form');
    const signOut = overlay.querySelector('[data-auth-signout]');
    const submit = overlay.querySelector('[data-auth-submit]');
    const email = document.getElementById('supabase-auth-email');
    overlay.hidden = false;
    overlay.classList.add('fc-modal-overlay--visible');
    signOut.hidden = !currentUser;
    submit.hidden = Boolean(currentUser);
    form.querySelectorAll('input').forEach(input => { input.disabled = Boolean(currentUser); });
    if (currentUser) email.value = currentUser.email || '';
    else email.focus();
  }

  async function initialize() {
    const supabase = client();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    currentUser = data.session?.user || null;
    global.SupabaseRealtime?.start(currentUser);
    setButtonState();
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      global.SupabaseRealtime?.start(currentUser);
      setButtonState();
      global.dispatchEvent(new CustomEvent('supabase-auth-changed', { detail: { user: currentUser } }));
    });
  }

  global.SupabaseAuth = Object.freeze({ getUser: () => currentUser, openModal, initialize });
  document.addEventListener('DOMContentLoaded', () => {
    ['supabase-auth-btn', 'supabase-auth-btn-mobile'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => { openModal(); global.closeBnavDrawer?.(); });
    });
    initialize().catch(error => console.warn('[supabase-auth]', error));
  });
})(window);
