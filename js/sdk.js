// ============================================================
// Qwopex SDK — общий слой для шелла и мини-аппов.
// Framework-agnostic: чистый ES-модуль, без зависимостей.
// Мини-аппы импортируют отсюда утилиты, а в mount() получают
// контекст (ctx) с навигацией, тостами и данными пользователя.
// ============================================================

// ---------- Лимиты приложения ----------
export const LIMITS = {
  title: 100,
  description: 2000,
  priceMax: 999999999,
};

// ---------- Экранирование ----------
export function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

// ---------- Whitelist-санитайзер HTML ----------
const ALLOWED_TAGS = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "BR", "P", "DIV", "UL", "OL", "LI", "SPAN",
]);

export function sanitizeHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  clean(template.content);
  return template.innerHTML;

  function clean(node) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!ALLOWED_TAGS.has(child.tagName)) {
          const text = document.createTextNode(child.textContent || "");
          child.parentNode.replaceChild(text, child);
          return;
        }
        // удаляем все атрибуты (on*, style, href, src и т.д.)
        Array.from(child.attributes).forEach((attr) =>
          child.removeAttribute(attr.name),
        );
        clean(child);
      } else if (
        child.nodeType !== Node.TEXT_NODE &&
        child.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
      ) {
        child.parentNode.removeChild(child);
      }
    });
  }
}

// ---------- Числа ----------
export function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function genId() {
  // Уникальнее, чем Date.now() — защита от коллизий при быстром создании
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Хранилище (с namespace, чтобы мини-аппы не пересекались) ----------
export function createStorage(ns) {
  const prefix = "qwx:" + ns + ":";
  return {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(prefix + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch (_) {}
    },
    remove(key) {
      try {
        localStorage.removeItem(prefix + key);
      } catch (_) {}
    },
  };
}

// ---------- Простая шина событий (общение между мини-аппами/шеллом) ----------
export function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type)?.delete(fn);
    },
    emit(type, detail) {
      map.get(type)?.forEach((fn) => {
        try {
          fn(detail);
        } catch (e) {
          console.warn("bus handler failed:", type, e);
        }
      });
    },
  };
}

// ============================================================
// АВТОРИЗАЦИЯ (Telegram Login Widget)
// Сейчас отключена для локальной разработки — отдаём fake-user.
// Раскомментируйте блок ниже и задайте TG_BOT_USERNAME, когда
// будет готов бэкенд для проверки подписи Telegram.
// ============================================================

// const TG_BOT_USERNAME = "YOUR_BOT_USERNAME";
const authStore = createStorage("auth");

const FAKE_USER = {
  id: 217651550,
  first_name: "qwopex",
  username: "BVA21",
  photo_url: "",
  registered: "25.10.2025, 21:03:52",
  balance: 1200,
  bonus: 600.75,
};

export const auth = {
  getUser() {
    // const saved = authStore.get("user");
    // return saved || null;
    return FAKE_USER; // dev-режим без авторизации
  },
  saveUser(user) {
    authStore.set("user", user);
  },
  logout() {
    authStore.remove("user");
    console.log("logout disabled (no auth mode)");
  },
};
