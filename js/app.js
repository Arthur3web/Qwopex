// ============================================================
// Qwopex Shell — хост супераппа.
// Отвечает за: тему, авторизацию, лаунчер, хэш-роутинг,
// ленивую загрузку и лайфцикл мини-аппов, тосты и обновление SW.
// ============================================================

import { REGISTRY, getApp } from "./registry.js";
import { auth, createBus, escapeHtml } from "./sdk.js";

const view = document.getElementById("view");
const shellTop = document.getElementById("shell-top");
const bus = createBus();

let currentAppId = null; // id смонтированного мини-аппа (null = лаунчер)
let currentModule = null; // его default export
const stats = { active: 0, moderation: 0 }; // кэш статистики для лаунчера

// Мини-аппы шлют сюда статистику для профиля на лаунчере
bus.on("ads:stats", (s) => {
  stats.active = s.active || 0;
  stats.moderation = s.moderation || 0;
  if (!currentAppId) renderLauncher(); // обновить, если открыт лаунчер
});

// ---------- ТЕМА ----------
function applyTheme() {
  let theme = "dark";
  try {
    theme = localStorage.getItem("theme") || "dark";
  } catch (_) {}
  document.body.classList.toggle("light", theme === "light");
}

function toggleTheme() {
  const light = document.body.classList.toggle("light");
  try {
    localStorage.setItem("theme", light ? "light" : "dark");
  } catch (_) {}
}

// ---------- ТОСТЫ ----------
let toastTimer = null;
function toast(message) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- КОНТЕКСТ, который получают мини-аппы ----------
function makeCtx(subpath) {
  return {
    user: auth.getUser(),
    subpath,
    bus,
    navigate: (hash) => {
      location.hash = hash;
    },
    toast,
    scrollTop: () => window.scrollTo(0, 0),
  };
}

// ---------- ЛАУНЧЕР (домашний экран супераппа) ----------
function renderLauncher() {
  shellTop.hidden = false;
  const u = auth.getUser() || {};
  const balance = (u.balance ?? 0).toLocaleString("ru-RU");
  const bonus = (u.bonus ?? 0).toLocaleString("ru-RU");
  const idLine =
    "#" + (u.id ?? "") + (u.username ? " || @" + u.username : "");

  const tiles = REGISTRY.map(
    (a) => `
      <a class="app-tile" href="#/${a.id}" style="--tile:${a.color}">
        <span class="app-tile-icon"><svg class="icon"><use href="${a.icon}" /></svg></span>
        <span class="app-tile-title">${escapeHtml(a.title)}</span>
        <span class="app-tile-desc">${escapeHtml(a.description)}</span>
      </a>`,
  ).join("");

  view.innerHTML = `
    <section class="page home active">
      <div class="content">
        <div class="profile-card">
          <div class="avatar">${
            u.photo_url
              ? `<img class="avatar-img" src="${escapeHtml(u.photo_url)}" alt="" />`
              : '<svg class="icon"><use href="#i-user" /></svg>'
          }</div>
          <div>
            <div class="user-id">${escapeHtml(idLine)}</div>
            <div class="date">Зарегистрирован: ${escapeHtml(u.registered || "—")}</div>
          </div>
        </div>

        <div class="info">
          <div class="balance">Баланс: <span class="green">${balance} ₽ (+${bonus} ₽ бонусами)</span></div>
          <div class="stats">
            <a class="stat" href="#/ads">
              <div class="num">${stats.active}</div>
              <div class="label">Активные</div>
            </a>
            <a class="stat" href="#/ads">
              <div class="num">${stats.moderation}</div>
              <div class="label">На модерации</div>
            </a>
          </div>
        </div>

        <div class="launcher">
          <div class="launcher-title">Сервисы</div>
          <div class="app-grid">${tiles}</div>
        </div>
      </div>
    </section>
  `;
  window.scrollTo(0, 0);
}

// ---------- РОУТИНГ ----------
function parseRoute() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const segments = raw.split("/").filter(Boolean);
  return { appId: segments[0] || null, subpath: segments.slice(1) };
}

async function unmountCurrent() {
  if (currentModule && typeof currentModule.unmount === "function") {
    try {
      currentModule.unmount();
    } catch (e) {
      console.warn("unmount failed:", e);
    }
  }
  currentModule = null;
  currentAppId = null;
}

async function route() {
  const { appId, subpath } = parseRoute();

  // лаунчер
  if (!appId) {
    await unmountCurrent();
    renderLauncher();
    return;
  }

  const app = getApp(appId);
  if (!app) {
    location.hash = "#/";
    return;
  }

  // тот же мини-апп — только сменился под-маршрут
  if (appId === currentAppId && currentModule) {
    if (typeof currentModule.onRoute === "function") {
      currentModule.onRoute(subpath);
    }
    return;
  }

  // монтируем новый мини-апп
  await unmountCurrent();
  shellTop.hidden = true; // мини-апп рисует собственный header
  view.innerHTML = '<div class="loading">Загрузка…</div>';

  try {
    const mod = await app.load();
    // гонка: пока грузили, маршрут мог смениться
    if (parseRoute().appId !== appId) return;
    currentModule = mod.default;
    currentAppId = appId;
    document.title = app.title + " — qwopex";
    currentModule.mount(view, makeCtx(subpath));
  } catch (e) {
    console.error("Не удалось загрузить мини-апп:", appId, e);
    view.innerHTML =
      '<div class="empty"><p>Не удалось загрузить «' +
      escapeHtml(app.title) +
      '».</p></div>';
    shellTop.hidden = false;
  }
}

// ---------- ШАПКА ШЕЛЛА (видна только на лаунчере) ----------
function wireShellTop() {
  shellTop.addEventListener("click", (e) => {
    const act = e.target.closest("[data-action]");
    if (!act) return;
    const a = act.getAttribute("data-action");
    if (a === "toggle-theme") toggleTheme();
    else if (a === "logout") auth.logout();
  });
}

// ---------- РЕГИСТРАЦИЯ / ОБНОВЛЕНИЕ SERVICE WORKER ----------
function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("sw.js")
    .then((reg) => {
      // Новая версия найдена — ждём установки и предлагаем обновиться
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast(sw);
          }
        });
      });
    })
    .catch((err) => console.warn("SW register failed:", err));

  // После активации нового SW — перезагрузка один раз
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

function showUpdateToast(sw) {
  let el = document.getElementById("update-bar");
  if (!el) {
    el = document.createElement("div");
    el.id = "update-bar";
    el.className = "update-bar";
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<span>Доступно обновление</span><button class="update-btn">Обновить</button>';
  el.classList.add("show");
  el.querySelector(".update-btn").addEventListener("click", () => {
    sw.postMessage({ type: "SKIP_WAITING" });
    el.classList.remove("show");
  });
}

// ---------- СТАРТ ----------
function start() {
  applyTheme();
  wireShellTop();
  window.addEventListener("hashchange", route);
  // первый маршрут (если пусто — лаунчер)
  if (!location.hash) location.hash = "#/";
  route();
  window.addEventListener("load", initServiceWorker);
}

start();
