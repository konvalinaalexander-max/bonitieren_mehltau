// Service Worker der Handy-App: legt alle Dateien im Handy ab, damit die App offline läuft.
// Bei jeder App-Änderung APP_VERSION erhöhen (gleicher Wert wie in app/version.js).
const APP_VERSION = '0.1.0';
// Cache-Name mit dem Pfad der App: Auf github.io teilen sich alle Seiten eines Kontos den
// Speicher – so stören sich Hauptversion (/app/) und Testversion (/vorschau/app/) nie.
const PRAEFIX = `mehltau-app:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PRAEFIX}${APP_VERSION}`;

const DATEIEN = [
  './', './index.html', './stil.css', './app.js', './db.js', './logik.js', './version.js', './kamera.js', './export.js',
  './manifest.webmanifest', './symbole/symbol-192.png', './symbole/symbol-512.png', './symbole/symbol-maskable-512.png',
  '../kern/analyse.js', '../kern/analyse-worker.js', '../kern/arbeiter.js', '../kern/bild.js', '../kern/einstellungen.js',
  '../kern/exif.js', '../kern/farbe.js', '../kern/farbkarte.js', '../kern/histogramm.js', '../kern/noten.js',
  '../kern/qr.js', '../kern/statistik.js', '../kern/tabellen.js',
  '../bibliotheken/jsqr.mjs', '../bibliotheken/jszip.mjs', '../bibliotheken/qrcode.mjs', '../bibliotheken/xlsx.mjs',
  '../werkstatt/einrichten.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((namen) => Promise.all(
    namen.filter((n) => n.startsWith(PRAEFIX) && n !== CACHE).map((n) => caches.delete(n)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => {
  if (e.data === 'jetzt-aktualisieren') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const treffer = await cache.match(anfrage, { ignoreSearch: true });
    if (treffer) return treffer;
    try {
      return await fetch(anfrage);
    } catch (fehler) {
      if (anfrage.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      throw fehler;
    }
  })());
});
