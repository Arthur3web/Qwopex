// ============================================================
// <qx-sheet> — модальный bottom-sheet дизайн-системы Qwopex.
// Лёгкий Web Component без зависимостей.
//
// ВАЖНО: как и <qx-toast>, рендерится в LIGHT DOM. Пунктам меню нужны
// иконки из общего SVG-спрайта (<use href="#i-…">), а спрайт лежит в
// документе — сквозь границу shadow DOM ссылка на фрагмент не резолвится.
// Стили — в styles.css (class .qx-sheet*), что совместимо со строгим CSP
// (style-src 'self'). Пункты переиспользуют класс .menu-item.
//
// Helper actionSheet — выезжающее снизу меню действий (Promise-based):
//   import { actionSheet } from "../ui/qx-sheet.js";
//   const act = await actionSheet({
//     title: "Объявление",
//     items: [
//       { id: "edit",   label: "Редактировать", icon: "#i-edit" },
//       { id: "pin",    label: "Закрепить",     icon: "#i-pin-action" },
//       { id: "delete", label: "Удалить", icon: "#i-trash", danger: true },
//     ],
//   });
//   // act === id выбранного пункта | null (Esc / клик по фону / свайп вниз)
// ============================================================

const SVG_NS = "http://www.w3.org/2000/svg";

// Иконка из спрайта собирается через createElementNS — обычный
// createElement("svg") даёт HTML-элемент, в котором <use href> не работает.
function makeIcon(href) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", href);
  svg.appendChild(use);
  return svg;
}

const SWIPE_CLOSE = 80; // px вертикального свайпа для закрытия

export class QxSheet extends HTMLElement {
  constructor() {
    super();
    this._resolve = null;
    this._lastFocused = null;
    this._buttons = [];
    this._panel = null;
    this._startY = null;
    this._dragY = 0;
    this._onKeydown = this._onKeydown.bind(this);
  }

  // Открыть лист и вернуть Promise<id|null>.
  open({ title = "", items = [] } = {}) {
    this.classList.add("qx-sheet");

    const backdrop = document.createElement("div");
    backdrop.className = "qx-sheet-backdrop";
    backdrop.addEventListener("click", () => this._close(null));

    const panel = document.createElement("div");
    panel.className = "qx-sheet-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");

    const handle = document.createElement("div");
    handle.className = "qx-sheet-handle";
    panel.appendChild(handle);

    if (title) {
      const h = document.createElement("h2");
      h.className = "qx-sheet-title";
      h.textContent = title;
      panel.setAttribute("aria-label", title);
      panel.appendChild(h);
    }

    const list = document.createElement("div");
    list.className = "qx-sheet-items";
    items.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-item" + (it.danger ? " danger" : "");
      if (it.icon) btn.appendChild(makeIcon(it.icon));
      const span = document.createElement("span");
      span.textContent = it.label || "";
      btn.appendChild(span);
      btn.addEventListener("click", () => this._close(it.id));
      list.appendChild(btn);
      this._buttons.push(btn);
    });
    panel.appendChild(list);

    this.appendChild(backdrop);
    this.appendChild(panel);
    this._panel = panel;
    this._wireDrag(handle);
    document.body.appendChild(this);

    this._lastFocused = document.activeElement;
    document.addEventListener("keydown", this._onKeydown, true);
    // двойной rAF — дать браузеру применить старт до transition
    requestAnimationFrame(() => {
      this.setAttribute("open", "");
      requestAnimationFrame(() => {
        if (this._buttons[0]) this._buttons[0].focus();
      });
    });

    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  // Свайп вниз по «ручке» закрывает лист. Backdrop/Esc работают независимо.
  _wireDrag(handle) {
    const onStart = (e) => {
      this._startY = e.touches ? e.touches[0].clientY : e.clientY;
      this._dragY = 0;
    };
    const onMove = (e) => {
      if (this._startY == null) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      this._dragY = Math.max(0, y - this._startY);
      this._panel.style.transform = "translateY(" + this._dragY + "px)";
    };
    const onEnd = () => {
      if (this._startY == null) return;
      this._panel.style.transform = ""; // вернуть управление CSS-переходу
      const shouldClose = this._dragY > SWIPE_CLOSE;
      this._startY = null;
      this._dragY = 0;
      if (shouldClose) this._close(null);
    };
    handle.addEventListener("touchstart", onStart, { passive: true });
    handle.addEventListener("touchmove", onMove, { passive: true });
    handle.addEventListener("touchend", onEnd);
  }

  _onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this._close(null);
    } else if (e.key === "Tab" && this._buttons.length) {
      // фокус-ловушка между пунктами листа
      e.preventDefault();
      const order = this._buttons;
      const idx = order.indexOf(document.activeElement);
      const next = e.shiftKey
        ? order[(idx - 1 + order.length) % order.length]
        : order[(idx + 1) % order.length];
      next.focus();
    }
  }

  _close(result) {
    if (this._resolve == null) return; // уже закрывается
    document.removeEventListener("keydown", this._onKeydown, true);
    this.removeAttribute("open");
    const resolve = this._resolve;
    this._resolve = null;
    const done = () => {
      resolve(result);
      this.remove();
      const last = this._lastFocused;
      this._lastFocused = null;
      if (last && typeof last.focus === "function") {
        try {
          last.focus({ preventScroll: true });
        } catch (_) {
          last.focus();
        }
      }
    };
    // дождаться окончания slide-out, с фолбэком на случай отсутствия события
    this.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 340);
  }
}

if (!customElements.get("qx-sheet")) {
  customElements.define("qx-sheet", QxSheet);
}

// ---------- Helper: одноразовое меню действий ----------
export function actionSheet(opts) {
  const el = document.createElement("qx-sheet");
  return el.open(opts);
}
