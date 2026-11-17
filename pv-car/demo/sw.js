// Service worker: la app abre y graba sin conexión (Offline-First).
// Sube VERSION en cada publicación para renovar la caché.
const VERSION = "pvcar-demo-v5";
const ARCHIVOS = [
  "./", "index.html", "/legal.js", "app.css", "manifest.webmanifest",
  "js/app.js", "js/db.js", "js/fifo.js", "js/grabador.js", "js/telemetria.js", "js/voz.js",
  "js/comandos.js", "js/sesiones.js", "js/sha256.js", "js/hash-worker.js", "js/pdf.js", "js/acta.js",
  "icons/icono-48.png", "icons/logo-pvcar.webp", "icons/icono-180.png", "icons/icono-192.png", "icons/icono-512.png", "icons/icono-512-maskable.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la caché (abre al instante y sin red); en segundo plano se actualiza.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Solo la demo y la capa legal; el resto del sitio va directo a la red.
  const ruta = new URL(req.url).pathname;
  if (!ruta.startsWith(new URL("./", self.registration.scope).pathname) && ruta !== "/legal.js") return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const guardado = await cache.match(req, { ignoreSearch: true });
      const red = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
      if (guardado) { e.waitUntil(red); return guardado; }
      return (await red) || (req.mode === "navigate" ? cache.match("index.html") : Response.error());
    }),
  );
});
