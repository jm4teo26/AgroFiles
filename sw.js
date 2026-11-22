/* =========================================================================
   sw.js — Permite usar la app SIN INTERNET.
   Guarda una copia de los archivos de la app en el dispositivo.
   ⚠️ Cada vez que subas cambios a GitHub, sube el número de VERSION
      para que los dispositivos descarguen la versión nueva.
   ========================================================================= */
const VERSION = 'v1.0.0';
const ARCHIVOS = [
  './', 'index.html', 'estilos.css', 'config.js', 'manifest.json',
  'js/numeros.js', 'js/cripto.js', 'js/pdfs.js', 'js/util.js', 'js/almacen.js',
  'js/contrato.js', 'js/editor.js', 'js/app.js',
  'lib/pdf-lib.min.js', 'lib/fontkit.umd.min.js',
  'fonts/LiberationSerif-Regular.ttf', 'fonts/LiberationSerif-Bold.ttf',
  'icons/icono-192.png', 'icons/icono-512.png', 'icons/icono-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((llaves) => Promise.all(llaves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero intenta con internet (para tener siempre lo más nuevo);
// si no hay conexión, usa la copia guardada.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
