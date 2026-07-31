const CACHE_VERSION = 'v4';
const CACHE_NAME = `rota-entregas-${CACHE_VERSION}`;
const ASSETS = ['./', './index.html', './manifest.json'];
const FALLBACK_HTML = new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rota de Entregas</title></head><body style="background:#13161D;color:#F2F4F7;font-family:sans-serif;padding:24px;text-align:center;"><h2>Sem conexão</h2><p>Não consegui carregar o app agora. Verifica sua internet e tenta de novo.</p><button onclick="location.reload()" style="padding:10px 20px;border-radius:8px;border:none;background:#D97B29;color:#13161D;font-weight:700;">Recarregar</button></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
);

function fetchWithTimeout(request, ms) {
    return Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
}

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
    const url = new URL(e.request.url);

    // Requisições pra outros domínios (Photon, Nominatim, OSRM, fontes, CDN etc.)
    // não passam pelo Service Worker. O navegador cuida delas normalmente.
    if (url.origin !== self.location.origin) {
        return;
    }

    const isAppShell = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');

    if (isAppShell) {
        // App shell: busca a versão mais nova primeiro (com tempo limite). Se falhar, usa cache. Se não tiver cache, mostra uma página simples em vez de dar erro cru.
        e.respondWith(
            fetchWithTimeout(e.request, 8000)
                .then((res) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
                    return res;
                })
                .catch(() => caches.match(e.request).then((cached) => cached || FALLBACK_HTML))
        );
        return;
    }

    // Demais arquivos do próprio app (ícones, manifest): responde rápido com o cache, mas atualiza em segundo plano.
    e.respondWith(
        caches.match(e.request).then((cached) => {
            const fetchAndUpdate = fetch(e.request)
                .then((res) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
                    return res;
                })
                .catch(() => cached || Response.error());
            return cached || fetchAndUpdate;
        })
    );
});
