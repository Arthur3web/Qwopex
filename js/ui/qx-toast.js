// ============================================================
// <qx-toast> — всплывающее уведомление дизайн-системы Qwopex.
// Лёгкий Web Component без зависимостей.
//
// ВАЖНО: в отличие от <qx-modal> рендерится в LIGHT DOM, а не в shadow.
// Тосту нужны иконки из общего SVG-спрайта (<use href="#i-…">), а спрайт
// инъектируется в документ (см. loadIcons в app.js) — сквозь границу
// shadow DOM ссылка на фрагмент `#id` не резолвится. Стили — в styles.css
// (class .toast*), что совместимо со строгим CSP (style-src 'self').
//
// Использование (одиночный тост-синглтон поверх всего):
//   import { toast } from "../ui/qx-toast.js";
//   toast("Сохранено", "success");   // type: "info" | "success" | "error"
//
// Тосты не копятся: повторный вызов переиспользует один и тот же элемент.
// ============================================================

// type → иконка из спрайта. Ошибки объявляются ассистивно (assertive),
// остальное — вежливо (polite), чтобы скринридер не прерывал пользователя.
const ICONS = {
  info: "#i-info",
  success: "#i-check",
  error: "#i-alert",
};
const DURATION = 2600; // мс показа до авто-скрытия

export class QxToast extends HTMLElement {
  constructor() {
    super();
    this._timer = null;
  }

  // Показать сообщение. Переиспользует разметку, перезапускает таймер.
  show(message, type = "info") {
    const kind = ICONS[type] ? type : "info";
    this.className = "toast toast--" + kind;
    this.setAttribute("role", kind === "error" ? "alert" : "status");
    this.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
    this.innerHTML =
      '<svg class="icon toast-icon"><use href="' +
      ICONS[kind] +
      '" /></svg><span class="toast-text"></span>';
    this.querySelector(".toast-text").textContent = message;
    void this.offsetWidth; // reflow — чтобы повторный тост заново анимировался
    this.classList.add("show");
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.classList.remove("show"), DURATION);
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
  }
}

if (!customElements.get("qx-toast")) {
  customElements.define("qx-toast", QxToast);
}

// ---------- Helper: одиночный тост-синглтон ----------
let singleton = null;
export function toast(message, type = "info") {
  if (!singleton || !singleton.isConnected) {
    singleton = document.createElement("qx-toast");
    document.body.appendChild(singleton);
  }
  singleton.show(message, type);
  return singleton;
}
