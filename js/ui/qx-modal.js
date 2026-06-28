// ============================================================
// <qx-modal> — модальное окно дизайн-системы Qwopex.
// Лёгкий Web Component без зависимостей (CSP script-src 'self').
// Shadow DOM изолирует стили; дизайн-токены наследуются с :root
// (CSS custom properties проходят сквозь границу shadow).
//
// ВАЖНО: стили подключаются через constructable stylesheet
// (adoptedStyleSheets), а НЕ инлайновым <style>. Строгий CSP проекта
// (style-src 'self', без 'unsafe-inline') блокирует инлайновые стили,
// в том числе <style> внутри shadow DOM — иначе модалка рендерится без
// оформления. CSSOM-таблицы под действие style-src не попадают.
//
// Использование напрямую как helper (Promise-based confirm):
//   import { confirmDialog } from "../ui/qx-modal.js";
//   const ok = await confirmDialog({
//     title: "Удалить?", message: "...", confirmText: "Удалить", danger: true,
//   });
//   // ok === true (подтвердил) | false (отмена/Esc/клик по фону)
// ============================================================

const STYLE = `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      /* анимация появления */
      opacity: 0;
      transition: opacity 0.16s ease;
    }
    :host([open]) { opacity: 1; }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
    }

    .dialog {
      position: relative;
      width: 100%;
      max-width: 340px;
      background: var(--surface, #1c1f26);
      color: var(--text, #fff);
      border: 1px solid var(--border, #2c2c2e);
      border-radius: var(--radius, 12px);
      padding: 20px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
      transform: translateY(8px) scale(0.98);
      transition: transform 0.16s ease;
    }
    :host([open]) .dialog { transform: none; }

    .title {
      margin: 0 0 8px;
      font-size: 17px;
      font-weight: 600;
    }
    .message {
      margin: 0 0 20px;
      font-size: 14px;
      line-height: 1.45;
      color: var(--text-muted, #8e8e93);
    }
    .message:empty { display: none; }

    .actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    button {
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      padding: 9px 16px;
      border-radius: var(--radius-sm, 8px);
      border: 1px solid var(--border, #2c2c2e);
      cursor: pointer;
      background: var(--surface-2, #2c2f36);
      color: var(--text, #fff);
    }
    button:focus-visible {
      outline: 2px solid var(--accent-soft, #7aa2ff);
      outline-offset: 2px;
    }

    .confirm {
      background: var(--accent, #3b82f6);
      border-color: transparent;
      color: #fff;
    }
    :host([danger]) .confirm {
      background: var(--danger, #ff453a);
    }
`;

// Один общий constructable stylesheet на все экземпляры (создаётся лениво).
let SHEET = null;
function getSheet() {
  if (SHEET !== null) return SHEET || null;
  try {
    SHEET = new CSSStyleSheet();
    SHEET.replaceSync(STYLE);
  } catch (_) {
    SHEET = false; // среда не поддерживает — пометим, чтобы не пытаться снова
  }
  return SHEET || null;
}

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <div class="backdrop" part="backdrop"></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="t" aria-describedby="m">
    <h2 class="title" id="t"></h2>
    <p class="message" id="m"></p>
    <div class="actions">
      <button type="button" class="cancel"></button>
      <button type="button" class="confirm"></button>
    </div>
  </div>
`;

export class QxModal extends HTMLElement {
  constructor() {
    super();
    const sr = this.attachShadow({ mode: "open" });
    const sheet = getSheet();
    if (sheet && "adoptedStyleSheets" in sr) {
      sr.adoptedStyleSheets = [sheet];
    }
    sr.appendChild(TEMPLATE.content.cloneNode(true));
    this._resolve = null;
    this._lastFocused = null;
    this._onKeydown = this._onKeydown.bind(this);
    this._els = {
      backdrop: sr.querySelector(".backdrop"),
      dialog: sr.querySelector(".dialog"),
      title: sr.querySelector(".title"),
      message: sr.querySelector(".message"),
      cancel: sr.querySelector(".cancel"),
      confirm: sr.querySelector(".confirm"),
    };
  }

  connectedCallback() {
    this._els.confirm.addEventListener("click", () => this._close(true));
    this._els.cancel.addEventListener("click", () => this._close(false));
    this._els.backdrop.addEventListener("click", () => this._close(false));
  }

  // Открыть и вернуть Promise<boolean>
  open({ title = "", message = "", confirmText = "OK", cancelText = "Отмена", danger = false } = {}) {
    this._els.title.textContent = title;
    this._els.message.textContent = message;
    this._els.confirm.textContent = confirmText;
    this._els.cancel.textContent = cancelText;
    this.toggleAttribute("danger", !!danger);

    this._lastFocused = document.activeElement;
    document.addEventListener("keydown", this._onKeydown, true);
    // двойной rAF — дать браузеру применить начальное состояние до transition
    requestAnimationFrame(() => {
      this.setAttribute("open", "");
      requestAnimationFrame(() => this._els.confirm.focus());
    });

    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  _onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this._close(false);
    } else if (e.key === "Tab") {
      // фокус-ловушка между двумя кнопками
      e.preventDefault();
      const order = [this._els.cancel, this._els.confirm];
      const idx = order.indexOf(this.shadowRoot.activeElement);
      const next = e.shiftKey
        ? order[(idx - 1 + order.length) % order.length]
        : order[(idx + 1) % order.length];
      next.focus();
    }
  }

  _close(result) {
    document.removeEventListener("keydown", this._onKeydown, true);
    this.removeAttribute("open");
    const done = () => {
      if (this._resolve) {
        this._resolve(result);
        this._resolve = null;
      }
      this.remove();
      // вернуть фокус туда, откуда открыли
      if (this._lastFocused && typeof this._lastFocused.focus === "function") {
        try {
          this._lastFocused.focus({ preventScroll: true });
        } catch (_) {
          this._lastFocused.focus();
        }
      }
      this._lastFocused = null;
    };
    // дождаться окончания fade-out
    this.addEventListener("transitionend", done, { once: true });
    // фолбэк, если transitionend не сработает
    setTimeout(done, 220);
  }
}

if (!customElements.get("qx-modal")) {
  customElements.define("qx-modal", QxModal);
}

// ---------- Helper: одноразовый confirm-диалог ----------
export function confirmDialog(opts) {
  const el = document.createElement("qx-modal");
  document.body.appendChild(el);
  return el.open(opts);
}
