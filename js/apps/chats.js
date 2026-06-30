// ============================================================
// Мини-апп «Чаты».
// Список диалогов + переписка. Данные локальные (localStorage),
// бэкенд/realtime — позже (WebSocket/SSE по плану). Под-маршруты:
//   #/chats         — список диалогов
//   #/chats/<id>    — переписка
// Контракт мини-аппа: mount/unmount/onRoute.
// ============================================================

import { resizeImageToDataURL, readFileAsDataURL } from "../sdk.js";
import { getDialogs, saveDialogs } from "../data/chats-store.js";
import { getPosts } from "../data/ads-store.js";

const MSG_MAX = 2000;
// Лимит для НЕ-картинок: localStorage невелик, base64 раздувает ~на треть.
const FILE_MAX = 1.5 * 1024 * 1024;

const TEMPLATE = `
  <section class="page chats-page" data-view="list">
    <div class="mini-header">
      <button class="icon-btn back-btn" data-act="home" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <h2>Чаты</h2>
    </div>
    <div class="chats-list js-chats-list"></div>
  </section>

  <section class="page chat-page" data-view="conversation">
    <div class="mini-header">
      <button class="icon-btn back-btn" data-act="goto-list" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <div class="chat-peer">
        <div class="chat-peer-name js-peer-name"></div>
        <div class="chat-peer-sub js-peer-sub"></div>
      </div>
    </div>
    <div class="chat-messages js-messages"></div>
    <div class="chat-pending js-pending" hidden></div>
    <form class="chat-input js-chat-form">
      <input type="file" class="js-attach-input" hidden />
      <div class="chat-input-field">
        <input type="text" class="js-msg-input" placeholder="Сообщение"
               autocomplete="off" maxlength="2000" />
        <button type="button" class="chat-attach js-attach" aria-label="Прикрепить файл">
          <svg class="icon"><use href="#i-paperclip" /></svg>
        </button>
      </div>
      <button type="submit" class="chat-send" aria-label="Отправить">
        <svg class="icon"><use href="#i-send" /></svg>
      </button>
    </form>
  </section>
`;

let root = null;
let ctx = null;
let dialogs = [];
let currentId = null;
// прикреплённое, но не отправленное вложение: {kind:'image'|'file', dataUrl, name?, size?}
let pendingAttachment = null;
const cleanups = [];

const $ = (sel) => root.querySelector(sel);
function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  cleanups.push(() => target.removeEventListener(type, fn, opts));
}

function persist() {
  saveDialogs(dialogs);
}

// ---------- Утилиты ----------
function fmtTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return hh + ":" + mm;
}

function lastMessage(dialog) {
  return dialog.messages[dialog.messages.length - 1] || null;
}

// поддержка — по флагу или по имени (на случай старых данных без флага)
function isSupport(dialog) {
  return dialog.support || dialog.peerName === "Поддержка";
}

function fmtSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " КБ";
  return (bytes / 1024 / 1024).toFixed(1) + " МБ";
}

// нормализуем вложение (поддержка старого формата m.image)
function attachmentOf(m) {
  if (m.attachment) return m.attachment;
  if (m.image) return { kind: "image", dataUrl: m.image };
  return null;
}

// собрать DOM-элемент вложения (картинка или чип файла)
function buildAttachment(att) {
  if (att.kind === "image") {
    const img = document.createElement("img");
    img.className = "chat-bubble-img";
    img.alt = "Вложение";
    img.loading = "lazy";
    img.src = att.dataUrl;
    return img;
  }
  const link = document.createElement("a");
  link.className = "chat-file";
  link.href = att.dataUrl;
  link.download = att.name || "file";
  link.innerHTML = '<svg class="icon"><use href="#i-file" /></svg>';
  const meta = document.createElement("span");
  meta.className = "chat-file-meta";
  const name = document.createElement("span");
  name.className = "chat-file-name";
  name.textContent = att.name || "Файл";
  const size = document.createElement("span");
  size.className = "chat-file-size";
  size.textContent = fmtSize(att.size);
  meta.appendChild(name);
  meta.appendChild(size);
  link.appendChild(meta);
  return link;
}

function getDialog(id) {
  return dialogs.find((d) => String(d.id) === String(id)) || null;
}

// ---------- ВНУТРЕННЯЯ НАВИГАЦИЯ ----------
function showView(view) {
  root.querySelectorAll("[data-view]").forEach((s) =>
    s.classList.toggle("active", s.getAttribute("data-view") === view),
  );
}

// ---------- СПИСОК ДИАЛОГОВ ----------
function renderList() {
  const container = $(".js-chats-list");
  if (!container) return;
  container.textContent = "";

  if (!dialogs.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Пока нет сообщений";
    container.appendChild(empty);
    return;
  }

  // поддержка всегда сверху, остальные — по времени последнего сообщения
  const sorted = dialogs.slice().sort((a, b) => {
    const sa = isSupport(a);
    const sb = isSupport(b);
    if (sa !== sb) return sa ? -1 : 1;
    return (lastMessage(b)?.ts || 0) - (lastMessage(a)?.ts || 0);
  });

  sorted.forEach((d) => {
    const last = lastMessage(d);
    const row = document.createElement("a");
    row.className = "chat-row" + (isSupport(d) ? " support" : "");
    row.href = "#/chats/" + d.id;
    row.dataset.id = d.id;

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
    if (isSupport(d)) {
      avatar.innerHTML = '<svg class="icon"><use href="#i-send" /></svg>';
    } else {
      avatar.textContent = (d.peerName || "?").charAt(0).toUpperCase();
    }
    row.appendChild(avatar);

    const main = document.createElement("div");
    main.className = "chat-row-main";

    const top = document.createElement("div");
    top.className = "chat-row-top";
    const name = document.createElement("span");
    name.className = "chat-row-name";
    name.textContent = d.peerName;
    const time = document.createElement("span");
    time.className = "chat-row-time";
    time.textContent = last ? fmtTime(last.ts) : "";
    top.appendChild(name);
    top.appendChild(time);
    main.appendChild(top);

    const preview = document.createElement("div");
    preview.className = "chat-row-preview";
    let body = last ? last.text : "";
    if (last && !body) {
      const a = attachmentOf(last);
      body = a ? (a.kind === "image" ? "Фото" : "Файл") : "";
    }
    const previewText = last ? (last.fromMe ? "Вы: " : "") + body : "";
    preview.textContent = previewText;
    main.appendChild(preview);

    row.appendChild(main);

    if (d.unread > 0) {
      const badge = document.createElement("span");
      badge.className = "chat-unread";
      badge.textContent = d.unread;
      row.appendChild(badge);
    }

    container.appendChild(row);
  });
}

// ---------- ПЕРЕПИСКА ----------
function renderMessages() {
  const box = $(".js-messages");
  const dialog = getDialog(currentId);
  if (!box || !dialog) return;
  box.textContent = "";

  dialog.messages.forEach((m) => {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + (m.fromMe ? "me" : "them");
    const att = attachmentOf(m);
    if (att) bubble.appendChild(buildAttachment(att));
    if (m.text) {
      const text = document.createElement("div");
      text.className = "chat-bubble-text";
      text.textContent = m.text;
      bubble.appendChild(text);
    }
    const time = document.createElement("div");
    time.className = "chat-bubble-time";
    time.textContent = fmtTime(m.ts);
    bubble.appendChild(time);
    box.appendChild(bubble);
  });

  box.scrollTop = box.scrollHeight;
}

// Превью прикреплённого вложения над полем ввода (до отправки).
function renderPending() {
  const box = $(".js-pending");
  if (!box) return;
  box.textContent = "";
  if (!pendingAttachment) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  if (pendingAttachment.kind === "image") {
    const img = document.createElement("img");
    img.className = "chat-pending-img";
    img.alt = "Превью вложения";
    img.src = pendingAttachment.dataUrl;
    box.appendChild(img);
  } else {
    box.appendChild(buildAttachment(pendingAttachment));
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "js-pending-remove chat-pending-remove";
  remove.setAttribute("aria-label", "Убрать вложение");
  remove.innerHTML = '<svg class="icon"><use href="#i-trash" /></svg>';
  box.appendChild(remove);
}

function sendMessage(text, attachment) {
  const dialog = getDialog(currentId);
  if (!dialog) return;
  const clean = (text || "").trim().slice(0, MSG_MAX);
  if (!clean && !attachment) return; // нечего отправлять
  dialog.messages.push({
    id: "m" + Date.now().toString(36),
    fromMe: true,
    text: clean,
    attachment: attachment || null,
    ts: Date.now(),
  });
  persist();
  renderMessages();
}

// ---------- ВХОД В ЭКРАНЫ ----------
function enterList() {
  currentId = null;
  renderList();
  showView("list");
}

function enterConversation(id) {
  const dialog = getDialog(id);
  if (!dialog) {
    ctx.navigate("#/chats");
    return;
  }
  currentId = dialog.id;
  pendingAttachment = null;
  // открыли диалог — считаем прочитанным
  if (dialog.unread) {
    dialog.unread = 0;
    persist();
  }
  const nameEl = $(".js-peer-name");
  const subEl = $(".js-peer-sub");
  if (nameEl) nameEl.textContent = dialog.peerName;
  if (subEl) {
    subEl.textContent = "";
    if (dialog.adTitle) {
      // Ссылка на объявление активна, только если оно ещё существует.
      // Удалённое объявление помечаем приглушённым текстом без ссылки.
      const adExists =
        dialog.adId != null &&
        getPosts().some((p) => String(p.id) === String(dialog.adId));
      if (adExists) {
        const link = document.createElement("a");
        link.className = "chat-ad-link";
        link.href = "#/ads/" + dialog.adId;
        link.textContent = "по: " + dialog.adTitle;
        subEl.appendChild(link);
      } else if (dialog.adId != null) {
        const span = document.createElement("span");
        span.className = "chat-ad-deleted";
        span.textContent = "Объявление удалено";
        subEl.appendChild(span);
      } else {
        subEl.textContent = "по: " + dialog.adTitle;
      }
    }
  }
  renderPending();
  // Сначала показываем экран, потом рендерим сообщения — чтобы прокрутка к
  // последнему сообщению срабатывала на уже видимом (разложенном) контейнере.
  showView("conversation");
  renderMessages();
  // Поле ввода НЕ фокусируем автоматически: на мобиле это сразу поднимает
  // клавиатуру и перекидывает экран к набору, скрывая историю переписки.
  // Пользователь сам тапнет по полю, когда захочет ответить.
}

// ---------- СЛУШАТЕЛИ ----------
function wireEvents() {
  on(root, "click", (e) => {
    // убрать прикреплённое вложение
    if (e.target.closest(".js-pending-remove")) {
      pendingAttachment = null;
      const fileInput = $(".js-attach-input");
      if (fileInput) fileInput.value = "";
      renderPending();
      return;
    }
    const actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    const act = actEl.getAttribute("data-act");
    if (act === "home") ctx.navigate("#/");
    else if (act === "goto-list") ctx.back("#/chats");
  });

  // кнопка «скрепка» открывает выбор файла
  on($(".js-attach"), "click", () => {
    const fileInput = $(".js-attach-input");
    if (fileInput) fileInput.click();
  });

  on($(".js-attach-input"), "change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      if (/^image\//.test(file.type)) {
        // картинки ужимаем
        const dataUrl = await resizeImageToDataURL(file);
        pendingAttachment = { kind: "image", dataUrl };
      } else {
        // прочие файлы — как есть, с ограничением размера (localStorage)
        if (file.size > FILE_MAX) {
          ctx.toast("Файл слишком большой (макс 1.5 МБ)", "error");
          e.target.value = "";
          return;
        }
        const dataUrl = await readFileAsDataURL(file);
        pendingAttachment = {
          kind: "file",
          dataUrl,
          name: file.name,
          size: file.size,
        };
      }
      if (!root) return; // размонтировали, пока читали файл
      renderPending();
    } catch (_) {
      ctx.toast("Не удалось прикрепить файл", "error");
    }
    e.target.value = ""; // позволить выбрать тот же файл повторно
  });

  on($(".js-chat-form"), "submit", (e) => {
    e.preventDefault();
    const input = $(".js-msg-input");
    if (!input) return;
    sendMessage(input.value, pendingAttachment);
    input.value = "";
    pendingAttachment = null;
    renderPending();
    input.focus();
  });
}

// ============================================================
// КОНТРАКТ МИНИ-АППА
// ============================================================
export default {
  mount(mountRoot, context) {
    root = mountRoot;
    ctx = context;
    root.innerHTML = TEMPLATE;

    dialogs = getDialogs();

    wireEvents();
    this.onRoute(context.subpath || []);
  },

  onRoute(subpath) {
    const seg = subpath[0];
    if (!seg) return enterList();
    return enterConversation(seg);
  },

  unmount() {
    cleanups.splice(0).forEach((fn) => fn());
    if (root) root.innerHTML = "";
    root = null;
    ctx = null;
    currentId = null;
    pendingAttachment = null;
  },
};
