// Service worker mínimo do GestãoHub (briefing §17 — PWA sem offline complexo).
// - App shell em cache para abrir rápido.
// - Navegação (HTML): network-first com fallback ao cache (resiliência leve).
// - Assets estáticos same-origin (JS/CSS/ícones hashados): cache-first.
// - Requisições ao Supabase e qualquer cross-origin: passam direto (sem cache).

const CACHE = 'gestaohub-shell-v1';
const SHELL = ['/', '/index.html', '/icon.svg', '/icon-maskable.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Só mexe em same-origin; Supabase e outras APIs passam direto.
  if (url.origin !== self.location.origin) return;

  // Navegação / documentos: network-first.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html'))),
    );
    return;
  }

  // Assets estáticos: cache-first com atualização em segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
