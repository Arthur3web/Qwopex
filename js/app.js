// ============================================================
// Qwopex Shell — хост супераппа.
// Отвечает за: тему, авторизацию, лаунчер, хэш-роутинг,
// ленивую загрузку и лайфцикл мини-аппов, тосты и обновление SW.
// ============================================================

import { REGISTRY, getApp } from "./registry.js";
import { auth, createBus, escapeHtml } from "./sdk.js";
import { getState as getWalletState } from "./data/wallet-store.js";
import { counts as adsCounts, setPendingFilter } from "./data/ads-store.js";
import { totalUnread as chatsUnread } from "./data/chats-store.js";

const view = document.getElementById("view");
const shellTop = document.getElementById("shell-top");
const bus = createBus();

let currentAppId = null; // id смонтированного мини-аппа (null = лаунчер)
let currentModule = null; // его default export

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
// type: "info" | "success" | "error" — определяет иконку и цвет.
const TOAST_ICONS = {
  info: "#i-info",
  success: "#i-check",
  error: "#i-alert",
};
let toastTimer = null;
function toast(message, type = "info") {
  const kind = TOAST_ICONS[type] ? type : "info";
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.className = "toast toast--" + kind;
  // ошибки объявляем ассистивно сразу (assertive), остальное — вежливо
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.innerHTML =
    '<svg class="icon toast-icon"><use href="' +
    TOAST_ICONS[kind] +
    '" /></svg><span class="toast-text"></span>';
  el.querySelector(".toast-text").textContent = message;
  void el.offsetWidth; // reflow — чтобы повторный тост заново анимировался
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- ФОКУС-МЕНЕДЖМЕНТ (a11y) ----------
// При смене экрана переводим фокус на заголовок, чтобы скринридер
// объявил новый контекст, а навигация с клавиатуры начиналась сверху.
function focusHeading() {
  const heading = view.querySelector("h1, h2, [data-autofocus]");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  // requestAnimationFrame — дождаться, пока узел реально в DOM и виден
  requestAnimationFrame(() => {
    try {
      heading.focus({ preventScroll: true });
    } catch (_) {
      heading.focus();
    }
  });
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
  const wallet = getWalletState();
  const balance = wallet.balance.toLocaleString("ru-RU");
  const bonus = wallet.bonus.toLocaleString("ru-RU");
  const adsStats = adsCounts();
  const unreadChats = chatsUnread();
  const idLine =
    "#" + (u.id ?? "") + (u.username ? " || @" + u.username : "");

  const tiles = REGISTRY.map((a) => {
    // бейдж непрочитанных на плитке «Чаты»
    const badge =
      a.id === "chats" && unreadChats > 0
        ? `<span class="tile-badge">${unreadChats}</span>`
        : "";
    return `
      <a class="app-tile" href="#/${a.id}" style="--tile:${a.color}">
        <span class="app-tile-icon"><svg class="icon"><use href="${a.icon}" /></svg></span>
        <span class="app-tile-title">${escapeHtml(a.title)}${badge}</span>
        <span class="app-tile-desc">${escapeHtml(a.description)}</span>
      </a>`;
  }).join("");

  view.innerHTML = `
    <section class="page home active">
      <h1 class="sr-only">Главная</h1>
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
          <div class="balance">Баланс:
            <a class="balance-amounts" href="#/wallet">
              <span class="balance-main">${balance} ₽</span>
              <span class="balance-bonus">+${bonus} ₽</span>
            </a>
          </div>
          <div class="stats">
            <a class="stat" href="#/ads" data-filter="active">
              <div class="num">${adsStats.active}</div>
              <div class="label">Активные</div>
            </a>
            <a class="stat" href="#/ads" data-filter="moderation">
              <div class="num">${adsStats.moderation}</div>
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
  focusHeading();
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
    focusHeading();
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

// ---------- SVG-СПРАЙТ ИКОНОК ----------
// Спрайт вынесен в icons.svg и инъектируется в DOM до первого рендера,
// чтобы все ссылки <use href="#i-…"> резолвились как раньше (внутри документа).
// Файл прекэшируется SW — после первой загрузки доступен и офлайн.
async function loadIcons() {
  if (document.getElementById("icon-sprite")) return;
  try {
    const res = await fetch("icons.svg");
    if (!res.ok) return;
    const holder = document.createElement("div");
    holder.innerHTML = await res.text();
    const sprite = holder.querySelector("svg");
    if (!sprite) return;
    sprite.id = "icon-sprite";
    document.body.insertBefore(sprite, document.body.firstChild);
  } catch (e) {
    console.warn("Не удалось загрузить иконки:", e);
  }
}

// Клик по статистике на лаунчере — открыть Объявления с нужным фильтром.
function wireLauncherStats() {
  view.addEventListener("click", (e) => {
    const stat = e.target.closest(".stat[data-filter]");
    if (stat) setPendingFilter(stat.getAttribute("data-filter"));
  });
}

// ---------- СТАРТ ----------
async function start() {
  applyTheme();
  await loadIcons(); // спрайт в DOM до первого рендера иконок
  wireShellTop();
  wireLauncherStats();
  window.addEventListener("hashchange", route);
  // первый маршрут (если пусто — лаунчер)
  if (!location.hash) location.hash = "#/";
  route();
  window.addEventListener("load", initServiceWorker);
}

start();
