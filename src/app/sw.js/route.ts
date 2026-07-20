import { STARTERS } from "@/lib/game-catalog";

const BUILD_VERSION = process.env.NEXT_PUBLIC_EMBERDEX_BUILD_ID ?? "dev";
const STARTER_ASSET_URLS = Array.from(
  new Set(Object.values(STARTERS).map((starter) => starter.spriteUrl))
);

export const dynamic = "force-dynamic";

function serviceWorkerSource(version: string, starterAssetUrls: string[]) {
  return `const VERSION = ${JSON.stringify(version)};
const STARTER_ASSET_URLS = ${JSON.stringify(starterAssetUrls)};
const CACHE_PREFIX = "emberdex-";
const SHELL_CACHE = CACHE_PREFIX + "shell-" + VERSION;
const RUNTIME_CACHE = CACHE_PREFIX + "runtime-" + VERSION;
const ASSET_CACHE = CACHE_PREFIX + "assets-" + VERSION;
const SHELL_URLS = ["/", "/login", "/manifest.webmanifest"];
const POKEMON_ASSET_HOSTS = new Set(["raw.githubusercontent.com", "assets.pokemon.com"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)),
      warmCache(STARTER_ASSET_URLS, ASSET_CACHE),
    ])
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const activeCaches = new Set([SHELL_CACHE, RUNTIME_CACHE, ASSET_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !activeCaches.has(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/"));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/pokemon/assets/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/")) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  if (POKEMON_ASSET_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, true));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (fallbackUrl) {
      const shell = await caches.match(fallbackUrl);
      if (shell) {
        return shell;
      }
    }

    return new Response("Hors ligne", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request, cacheName, allowOpaque) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok || (allowOpaque && response.type === "opaque")) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached ?? (await refresh) ?? new Response("Hors ligne", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function warmCache(urls, cacheName) {
  const cache = await caches.open(cacheName);
  await Promise.allSettled(urls.map((url) => cache.add(url)));
}
`;
}

export async function GET() {
  return new Response(serviceWorkerSource(BUILD_VERSION, STARTER_ASSET_URLS), {
    headers: {
      "Cache-Control": "no-store, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "X-Emberdex-Build": BUILD_VERSION,
    },
  });
}
