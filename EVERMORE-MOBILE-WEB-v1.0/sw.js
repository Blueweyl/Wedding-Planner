/* Evermore offline worker.
   The planner is one page with no moving parts, so the strategy is nearly as
   simple: the page itself is fetched from the network first, so a planner you
   update on your host reaches phones on their next visit instead of being
   frozen in the cache forever, with the cached copy standing in whenever
   there is no connection. Everything else — icons, manifest, web fonts — is
   served from the cache first, because it never changes within a version.
   Only successful responses are ever stored. Bump VERSION when you publish a
   new planner: the old cache is then thrown away on activation. */
var VERSION = '1.0.1';
var CACHE = 'evermore-' + VERSION;
var PAGE = './index.html';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/** True for responses worth keeping: a real success, not a 404 or a redirect. */
function keepable(req, res) {
  if (!res || !res.ok || res.status !== 200) return false;
  if (res.type !== 'basic' && res.type !== 'cors' && res.type !== 'default') return false;
  var url;
  try { url = new URL(req.url); } catch (e) { return false; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.origin === self.location.origin ||
    /(^|\.)fonts\.googleapis\.com$/.test(url.hostname) ||
    /(^|\.)fonts\.gstatic\.com$/.test(url.hostname);
}

function store(req, res) {
  if (!keepable(req, res)) return;
  var copy = res.clone();
  caches.open(CACHE).then(function (c) { c.put(req, copy)['catch'](function () {}); });
}

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
        // Drop every cache from an earlier version so no stale file survives.
        return (k === CACHE || k.indexOf('evermore-') !== 0) ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // The planner page: newest wins, cache is the safety net.
  var wantsPage = req.mode === 'navigate' ||
    (url.origin === self.location.origin && /(^|\/)(index\.html)?$/.test(url.pathname));
  if (wantsPage) {
    e.respondWith(
      fetch(req).then(function (res) {
        store(req, res);
        if (res && res.ok) store(new Request(PAGE), res);
        return res;
      })['catch'](function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match(PAGE).then(function (page) {
            return page || new Response('', { status: 504, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }

  // Everything else: cache first, then network, keeping only real successes.
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        store(req, res);
        return res;
      })['catch'](function () {
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
