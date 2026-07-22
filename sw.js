const CACHE_VERSION = 'v2';
const CACHE_NAME = `rota-entregas-${CACHE_VERSION}`;
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const isAppShell = e.request.mode === 'navigate' || e.request.url.endsWith('/index.html') || e.request.url.endsWith('/');

    if (isAppShell) {
        // App shell: busca a versão mais nova primeiro. Só usa cache se estiver offline.
        e.respondWith(
            fetch(e.request)
                .then((res) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Demais arquivos (ícones, manifest): responde rápido com o cache, mas atualiza em segundo plano.
    e.respondWith(
        caches.match(e.request).then((cached) => {
            const fetchAndUpdate = fetch(e.request)
                .then((res) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
                    return res;
                })
                .catch(() => cached);
            return cached || fetchAndUpdate;
        })
    );
});
