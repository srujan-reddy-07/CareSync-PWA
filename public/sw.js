const CACHE = 'caresync-v2';
const OFFLINE_URL = '/';

// Assets to pre-cache on install
const PRECACHE = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Network-first for API calls — queue offline if needed
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Stale-while-revalidate for navigation (HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(OFFLINE_URL).then(r => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Cache-first for static assets (JS/CSS/fonts/images)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Background revalidate
        fetch(request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(request, res));
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => caches.match(OFFLINE_URL).then(r => r || new Response('', { status: 503 })));
    })
  );
});
