/* Service worker de Bourdon : l'application marche hors ligne.
   VERSION est remplacée au déploiement par l'identifiant du commit : chaque déploiement
   donne un nouveau cache, et la page propose alors de recharger. */
const VERSION = "__VERSION__";
const CACHE = "bourdon-" + VERSION;
const EXT = "bourdon-ext";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "css/fonts.css", "css/style.css",
  "js/synth.js", "js/phys.js", "js/data.js", "js/engine.js", "js/viz.js", "js/ui.js", "js/table.js", "js/jeu.js", "js/atelier.js", "js/daw.js", "js/export.js", "js/main.js", "js/pwa.js",
  "fonts/Alegreya.woff2", "fonts/Alegreya-italic.woff2", "fonts/IMFellEnglish-400.woff2", "fonts/IMFellEnglish-400i.woff2",
  "fonts/IMFellEnglishSC-400.woff2", "fonts/UnifrakturCook-700.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  /* le réseau passe d'abord (voir fetch) : la nouvelle version prend la main tout de suite, sans casser la lecture en cours */
  self.skipWaiting();
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
      /* réseau d'abord : la dernière version s'affiche toujours ; le cache ne sert que hors ligne */
      try {
        const res = await fetch(req, { cache: "no-cache" });
        if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
        return res;
      } catch (err) {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === "navigate") return (await caches.match("index.html")) || Response.error();
        throw err;
      }
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
