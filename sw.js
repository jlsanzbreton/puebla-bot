// Service Worker: App Shell + content pack precache + offline fallback
const CACHE_NAME = "pueblo-cache-v1";
const PRECACHE = [
  "index.html",
  "offline.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "content/kb-pack.json",
  "content/version.json",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))))
      .then(()=>self.clients.claim())
  );
});

// Notify clients when a new SW is ready (simple)
self.addEventListener("message", (event) => {
  // reserved for future
});

// Fetch handling
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const scopePath = new URL(self.registration.scope).pathname; // e.g., "/puebla-pwa-starter/" on GitHub Pages

  const isContentRequest = () => {
    if (url.origin !== self.location.origin) return false;
    // Match both root-hosted and subpath-hosted deployments
    return url.pathname.startsWith(scopePath + "content/") || url.pathname.startsWith("/content/");
  };

  // Navigation requests: App Shell
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("index.html").then((cached) => cached || fetch(req).catch(()=>caches.match("offline.html")))
    );
    return;
  }

  // Content pack: stale-while-revalidate
  if (isContentRequest()) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchAndUpdate = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(()=>null);
        return cached || fetchAndUpdate || new Response("{}", {headers: {"Content-Type":"application/json"}});
      })
    );
    return;
  }

  // Other GET: cache-first
  if (req.method === "GET") {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res)=>{
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(()=> cached || new Response("", {status: 504})))
    );
  }
});
