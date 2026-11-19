const CACHE = 'finmate-v3';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './auth.js', './logic.js', './icon.svg', './manifest.json'];

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
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
