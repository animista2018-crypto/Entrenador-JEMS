// J.E.M.S. PRO — service worker (esqueleto + librerías en caché para uso sin cobertura)
const VERSION = 'jems-v6-2';
const SHELL = VERSION + '-shell';
const LIBS = VERSION + '-libs';
const SHELL_FILES = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const LIB_HOSTS = ['unpkg.com', 'cdnjs.cloudflare.com'];
 
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // tolerante: si un archivo falta, el resto se cachea igualmente
    await Promise.allSettled(SHELL_FILES.map((f) => cache.add(f)));
    await self.skipWaiting();
  })());
});
 
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
 
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
 
  // Página: red primero (así llegan las actualizaciones) y, sin red, la última copia guardada
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const c = await caches.open(SHELL); c.put(req, res.clone()); }
        return res;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
 
  // Archivos propios y librerías (Leaflet, jsPDF): caché primero, y se refrescan en segundo plano
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin || LIB_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      const refresh = fetch(req).then(async (res) => {
        if (res && res.ok) { const c = await caches.open(sameOrigin ? SHELL : LIBS); c.put(req, res.clone()); }
        return res;
      }).catch(() => null);
      return cached || (await refresh) || Response.error();
    })());
  }
  // Teselas de mapa y demás peticiones externas: pasan directas a la red (sin tocar)
});
 
