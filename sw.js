// Service Worker: App Shell + content pack precache + offline fallback
const CACHE_NAME = "pueblo-cache-v2";
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

  // Helper: return a non-redirected clone (Safari workaround)
  const deRedirect = async (response) => {
    if (!response || !response.redirected) return response;
    const body = await response.clone().blob();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };

  // Navigation requests: App Shell
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        // Network-first for navigations to avoid returning a cached redirected response
        const net = await fetch(req);
        return net;
      } catch (e) {
        // Fallback to cached index.html or offline.html (ensure non-redirected)
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match("index.html");
        if (cachedIndex) return await deRedirect(cachedIndex);
        const cachedOffline = await cache.match("offline.html");
        if (cachedOffline) return await deRedirect(cachedOffline);
        return new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Content pack: stale-while-revalidate
  if (isContentRequest()) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchAndUpdate = fetch(req).then(async (res) => {
          if (res && res.ok) {
            cache.put(req, res.clone());
            return res;
          }
          // If 304 Not Modified, return cached when available
          if (res && res.status === 304 && cached) return cached;
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
