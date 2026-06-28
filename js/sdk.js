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

// ---------- Изображения: клиентский ресайз в data URL (JPEG) ----------
// Хранилище — localStorage, поэтому ужимаем по длинной стороне и жмём.
// Используется в Объявлениях (медиа) и Чатах (вложения).
export function resizeImageToDataURL(file, opts = {}) {
  const maxSide = opts.maxSide || 1024;
  const quality = opts.quality || 0.75;
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) {
      reject(new Error("not-an-image"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("read-failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode-failed"));
      img.onload = () => {
        let { width, height } = img;
        const longest = Math.max(width, height);
        if (longest > maxSide) {
          const scale = maxSide / longest;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Любой файл → data URL (для вложений в чатах) ----------
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("read-failed"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
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
