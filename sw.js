
const CACHE_VERSION = 'astrocalc-v11';           
const CACHE_PREFIX  = 'astrocalc-';             
const NETWORK_TIMEOUT_MS = 5000;                
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './test-calculator.js',
  './icons/192.png',
  './icons/512.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const results = await Promise.allSettled(
      FILES.map((url) =>
        cache.add(new Request(url, { cache: 'reload' }))
          .catch((err) => {
            console.warn('[SW] Gagal precache:', url, err && err.message ? err.message : err);
            throw err;
          })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[SW] ${failed.length}/${FILES.length} aset gagal di-cache. Periksa apakah file benar-benar ada di repo.`);
    } else {
      console.log(`[SW] Precache OK: ${FILES.length} aset tersimpan di ${CACHE_VERSION}.`);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION)
        .map((k) => {
          console.log('[SW] Hapus cache lama:', k);
          return caches.delete(k);
        })
    );
    await self.clients.claim();
    console.log('[SW] Aktif:', CACHE_VERSION);
  })());
});
self.addEventListener('fetch', (event) => {
  const { request } = event;

  
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  event.respondWith(handleStaticAsset(request));
});

async function handleNavigation(request) {
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallbackIndex = await caches.match('./index.html');
    if (fallbackIndex) return fallbackIndex;

    const fallbackRoot = await caches.match('./');
    if (fallbackRoot) return fallbackRoot;

    return new Response('Offline — aset tidak tersedia di cache.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function handleStaticAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const clone = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (err)      => { clearTimeout(timer); reject(err); }
    );
  });
}
