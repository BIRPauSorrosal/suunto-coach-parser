/* ============================================================
   sw.js — Suunto Coach Dashboard · Service Worker
   Estratègia:
     - Cache First  → assets estàtics (JS, CSS, fonts, icones)
     - Network First → dades CSV (canvien sovint)
   ============================================================ */

// Versioning: MAJOR.MINOR.PATCH
// • MAJOR (v4, v5…) — canvis estructurals grans (noves vistes, refactor complet)
// • MINOR (v3.1, v3.2…) — funcionalitats noves o canvis visibles rellevants
// • PATCH (v3.0.1, v3.0.2…) — fixes petits de CSS/JS, ajustos visuals
// Qualsevol canvi al nom de CACHE_NAME invalida la cache anterior i força la
// descàrrega de tots els assets nous al pròxim activate del SW.
const CACHE_NAME = 'suunto-coach-v3.0.1';

// Assets estàtics que es precachegen en instal·lar el SW
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './css/style.css',
  './css/mobile.css',
  './css/load-scale.css',
  './css/fc-config-modal.css',
  './css/fc-scale.css',
  './css/uploader.css',
  './css/comment-editor.css',
  './js/vendor/chart.umd.min.js',
  './js/app.js',
  './js/charts.js',
  './js/lib/formatters.js',
  './js/lib/activity-types.js',
  './js/lib/metrics.js',
  './js/lib/load-scale.js',
  './js/lib/fc-scale.js',
  './js/lib/fc-config-modal.js',
  './js/lib/pmc-config.js',
  './js/views/overview.js',
  './js/views/setmanal.js',
  './js/views/planning.js',
  './js/views/sessions.js',
  './js/views/comment-editor.js',
  './js/uploader/parser.js',
  './js/uploader/csv-writer.js',
  './js/uploader/uploader.js',
  './js/uploader/uploader-ui.js',
  './js/uploader/planning-uploader.js',
  './js/uploader/planning-uploader-ui.js',
  './js/lib/github-token-modal.js',
];

// Patrons de URLs que sempre van a xarxa (dades CSV i API GitHub)
const NETWORK_FIRST_PATTERNS = [
  /\.csv$/i,
  /api\.github\.com/,
  /raw\.githubusercontent\.com/,
];

// ── Install: precaché dels assets estàtics ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: elimina caches antigues ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Cache First o Network First segons el recurs ────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  if (request.method !== 'GET' || url.startsWith('chrome-extension')) return;

  const isNetworkFirst = NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url));

  if (isNetworkFirst) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
  );
});
