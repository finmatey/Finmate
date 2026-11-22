const CACHE = 'finmate-v7';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './auth.js', './logic.js', './leaderboard.js', './leaderboard-logic.js', './icon.svg', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('supabase.co') || e.request.url.includes('esm.sh')) {
    return; // Bypass cache for cloud auth & database requests
  }
  if (e.request.mode === 'navigate') {
    // Pages: always try the network first so users get the latest index.html; fall back to the cached copy offline.
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }
  // Other assets: cache first. ignoreSearch lets "app.js?v=2" match the cached "./app.js".
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((cached) => cached || fetch(e.request)));
});
