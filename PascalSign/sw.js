// Pascal Sign: funciona sin conexión y recibe PDF compartidos desde otras apps (Android).
const VERSION = 'pascalsign-v8';
const COMPARTIDO = 'pascalsign-compartido';
const BASE = [
  '/PascalSign/', '/PascalSign/manifest.webmanifest', '/PascalSign/icon-192.png', '/PascalSign/icon-512.png',
  '/PascalSign/apple-touch-icon.png', '/PascalSign/favicon-64.png',
  '/PascalPDF_Studio/config.js', '/PascalPDF_Studio/sello.js', '/PascalPDF_Studio/limpiafirma.js', '/PascalPDF_Studio/cuenta.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== COMPARTIDO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // PDF compartido desde otra app (Web Share Target): se guarda un momento y se abre la app
  if (e.request.method === 'POST' && url.pathname === '/PascalSign/compartir') {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get('pdf');
        if (file) {
          const c = await caches.open(COMPARTIDO);
          await c.put('/PascalSign/_compartido', new Response(file, {
            headers: { 'Content-Type': 'application/pdf', 'X-Nombre': encodeURIComponent(file.name || 'Documento.pdf') }
          }));
        }
      } catch (err) { /* sin archivo */ }
      return Response.redirect('/PascalSign/?compartido=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;

  // La página: primero la red (para tener la última versión), si no hay conexión, la copia guardada
  if (e.request.mode === 'navigate' && url.pathname.startsWith('/PascalSign/')) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(VERSION).then(c => c.put('/PascalSign/', copy));
      return r;
    }).catch(() => caches.match('/PascalSign/')));
    return;
  }

  // Librerías, íconos y fuentes: primero la copia guardada
  const cacheable = url.origin === location.origin
    ? url.pathname.startsWith('/PascalSign/') || url.pathname === '/flower.svg' || ['/PascalPDF_Studio/config.js', '/PascalPDF_Studio/sello.js', '/PascalPDF_Studio/cuenta.js'].includes(url.pathname)
    : /cdnjs\.cloudflare\.com|unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!cacheable) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok || r.type === 'opaque') {
      const copy = r.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return r;
  })));
});
