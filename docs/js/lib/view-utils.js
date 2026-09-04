// view-utils.js
// Primitives DOM reutilitzables per a les vistes del dashboard.

(function (global) {
  function get(id) {
    return global.document.getElementById(id);
  }

  function setText(id, value) {
    const element = get(id);
    if (element) element.textContent = value;
    return element;
  }

  function setHTML(id, value) {
    const element = get(id);
    if (element) element.innerHTML = value;
    return element;
  }

  function toggleClass(id, className, enabled) {
    const element = get(id);
    if (element) element.classList.toggle(className, Boolean(enabled));
    return element;
  }

  global.DashboardViewUtils = Object.freeze({
    get,
    setText,
    setHTML,
    toggleClass,
  });
})(window);
