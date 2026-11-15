/* Service worker de Bourdon : l'application marche hors ligne.
   VERSION est remplacée au déploiement par l'identifiant du commit : chaque déploiement
   donne un nouveau cache, et la page propose alors de recharger. */
const VERSION = "__VERSION__";
const CACHE = "bourdon-" + VERSION;
const EXT = "bourdon-ext";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "css/fonts.css", "css/style.css",
  "js/data.js", "js/engine.js", "js/viz.js", "js/ui.js", "js/export.js", "js/main.js", "js/pwa.js",
  "fonts/Alegreya.woff2", "fonts/Alegreya-italic.woff2", "fonts/IMFellEnglish-400.woff2", "fonts/IMFellEnglish-400i.woff2",
  "fonts/IMFellEnglishSC-400.woff2", "fonts/UnifrakturCook-700.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  /* pas de skipWaiting automatique : la nouvelle version attend que la personne choisisse de recharger */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== EXT) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { return await fetch(req); }
      catch (err) { if (req.mode === "navigate") return (await caches.match("index.html")) || Response.error(); throw err; }
    })());
  } else if (url.hostname === "cdnjs.cloudflare.com") {
    /* encodeur MP3 : mis en cache à la première utilisation pour la suite hors ligne */
    e.respondWith((async () => {
      const c = await caches.open(EXT), hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
  }
});
