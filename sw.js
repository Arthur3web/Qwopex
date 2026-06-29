// ============================================================
// Qwopex Service Worker
// Стратегии:
//   • Навигация (HTML)  — network-first + navigation preload,
//                          офлайн-фолбэк на закэшированный shell.
//   • Статика (js/css/svg/шрифты) — stale-while-revalidate.
//   • API (/api/...)    — network-only (никогда не кэшируем).
//   • Cross-origin      — не перехватываем (отдаём браузеру).
// Обновление: НЕ skipWaiting автоматически — ждём команды от
// страницы (тост «Обновить»), чтобы не смешать версии модулей.
// ============================================================

const VERSION = "v48";
const SHELL_CACHE = `qwopex-shell-${VERSION}`;
const RUNTIME_CACHE = `qwopex-runtime-${VERSION}`;

// App-shell: то, без чего приложение не запустится офлайн.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./icon.svg",
  "./icons.svg",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/icon-maskable-512.png",
  "./js/app.js",
  "./js/sdk.js",
  "./js/registry.js",
  "./js/ui/qx-modal.js",
  "./js/data/chats-store.js",
  "./js/data/categories.js",
  "./js/data/wallet-store.js",
  "./js/data/ads-store.js",
  "./js/apps/ads.js",
  "./js/apps/wallet.js",
  "./js/apps/chats.js",
  "./js/apps/market.js",
];

// ---------- INSTALL: прекэш shell (устойчиво к отсутствующим файлам) ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // add по одному, чтобы один отсутствующий файл не сорвал install
      Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))).then(
        (results) => {
          results
            .filter((r) => r.status === "rejected")
            .forEach((r) => console.warn("[SW] precache miss:", r.reason));
        },
      ),
    ),
  );
  // НЕ вызываем skipWaiting здесь — ждём команды со страницы.
});

// ---------- ACTIVATE: чистим старые кэши + navigation preload ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

// ---------- Команда от страницы: применить обновление немедленно ----------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------- FETCH ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin (например telegram.org) — не вмешиваемся.
  if (url.origin !== self.location.origin) return;

  // API — только сеть, без кэша.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Навигация — network-first c офлайн-фолбэком на shell.
  if (req.mode === "navigate") {
    event.respondWith(handleNavigate(event));
    return;
  }

  // Прочая статика — stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req));
});

async function handleNavigate(event) {
  try {
    const preload = await event.preloadResponse;
    if (preload) return preload;
    return await fetch(event.request);
  } catch (_) {
    const cached =
      (await caches.match(event.request)) ||
      (await caches.match("./index.html")) ||
      (await caches.match("./"));
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const network = fetch(req)
    .then((res) => {
      // кэшируем только успешные ответы своего origin
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    })
    .catch(() => null);

  return cached || (await network) || Response.error();
}
