/* Evermore offline worker.
   The planner is one page with no moving parts, so the strategy is simple:
   serve from the cache when we have it, fall back to the network, and keep
   a copy of anything cacheable we fetch (including the web fonts, so the
   typography survives going offline). A navigation with no connection and
   no exact match falls back to the cached page rather than an error. */
var CACHE = 'evermore-1.0';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        var url = new URL(req.url);
        var keep = url.origin === self.location.origin ||
          /(^|\.)fonts\.googleapis\.com$/.test(url.hostname) ||
          /(^|\.)fonts\.gstatic\.com$/.test(url.hostname);
        if (keep) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })['catch'](function () {
        // Offline and nothing cached for this exact request: if the browser
        // was asking for a page, give it the planner.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
