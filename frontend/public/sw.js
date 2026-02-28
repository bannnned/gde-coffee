const CACHE_NAME = "coffee-quest-v7";
const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.png",
  "/logo.png",
];

function isStaticAssetPath(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|webmanifest)$/i.test(pathname)
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTooEarlyRetry(request, init) {
  const first = await fetch(request, init);
  if (first.status !== 425) return first;
  await sleep(240);
  return fetch(request, init);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetchWithTooEarlyRetry(request, { cache: "no-store" });
    if (response && response.status === 200) {
      cache.put(request, response.clone());
      return response;
    }
    if (response && response.status === 425) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetchWithTooEarlyRetry(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
        return response;
      }
      return response?.status === 425 ? undefined : response;
    })
    .catch(() => undefined);

  if (cached) return cached;
  const network = await networkPromise;
  if (network) return network;
  throw new Error("network unavailable");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;
  if (url.pathname === "/sw.js") return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isStaticAssetPath(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
});
