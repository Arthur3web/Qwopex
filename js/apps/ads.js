// ============================================================
// Мини-апп «Объявления».
// Порт исходного script.js под контракт мини-аппа супераппа.
// Владеет собственным UI (список + создание) и под-маршрутами:
//   #/ads          — список
//   #/ads/create   — создание
// ============================================================

import {
  LIMITS,
  escapeHtml,
  sanitizeHtml,
  clampInt,
  genId,
  createStorage,
} from "../sdk.js";

const store = createStorage("ads");

// ---------- Демоданные (потом заменить на загрузку с бэкенда) ----------
const SEED = [
  {
    id: 1,
    title: "Закреплённое объявление",
    description: "<b>Пример</b> закреплённого поста",
    price: 1500,
    pinned: true,
    status: "active",
  },
  {
    id: 2,
    title: "Активное объявление",
    description: "Пример <i>активного</i> поста",
    price: 2000,
    pinned: false,
    status: "active",
  },
  {
    id: 3,
    title: "На проверке",
    description: "Ожидает модерации",
    price: 999,
    pinned: false,
    status: "moderation",
  },
];

const TEMPLATE = `
  <section class="page posts-page" data-view="list">
    <div class="posts-header">
      <button class="icon-btn back-btn" data-act="home" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <h2>Мои публикации</h2>
      <button class="icon-btn add-btn" data-act="goto-create" aria-label="Новое">
        <svg class="icon"><use href="#i-plus" /></svg>
      </button>
    </div>

    <div class="search-container">
      <span class="search-icon"><svg class="icon"><use href="#i-search" /></svg></span>
      <input type="text" class="posts-search" placeholder="Поиск"
             maxlength="100" autocomplete="off" spellcheck="false" />
    </div>

    <div class="filters js-filters">
      <button class="chip active" data-filter="all">Все <span class="chip-count" data-count="all">0</span></button>
      <button class="chip" data-filter="active">Активные <span class="chip-count" data-count="active">0</span></button>
      <button class="chip" data-filter="moderation">На модерации <span class="chip-count" data-count="moderation">0</span></button>
      <button class="chip" data-filter="pinned">Закреплённые <span class="chip-count" data-count="pinned">0</span></button>
    </div>

    <div class="posts-list js-posts-list"></div>
  </section>

  <section class="page create-page" data-view="create">
    <div class="create-header">
      <button class="icon-btn back-btn" data-act="goto-list" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <h2>Создание</h2>
    </div>

    <div class="create-user">
      <div class="avatar small"><svg class="icon"><use href="#i-user" /></svg></div>
      <div class="create-user-info"><div class="user-id js-user-id"></div></div>
    </div>

    <div class="upload-box">
      <input type="file" class="js-media" hidden accept="image/*" />
      <label class="upload-area js-media-label">
        <div class="upload-icon"><svg class="icon"><use href="#i-image" /></svg></div>
        <p>Загрузить медиа</p>
      </label>
    </div>

    <div class="form">
      <input type="text" placeholder="Название" class="js-title" maxlength="100" autocomplete="off" />

      <div class="editor">
        <div class="editor-toolbar" role="toolbar" aria-label="Форматирование">
          <button type="button" class="tool" data-cmd="bold" title="Жирный (Ctrl+B)" aria-label="Жирный"><svg class="icon"><use href="#i-bold" /></svg></button>
          <button type="button" class="tool" data-cmd="italic" title="Курсив (Ctrl+I)" aria-label="Курсив"><svg class="icon"><use href="#i-italic" /></svg></button>
          <button type="button" class="tool" data-cmd="underline" title="Подчеркнутый (Ctrl+U)" aria-label="Подчеркнутый"><svg class="icon"><use href="#i-underline" /></svg></button>
          <button type="button" class="tool" data-cmd="strikeThrough" title="Зачеркнутый" aria-label="Зачеркнутый"><svg class="icon"><use href="#i-strike" /></svg></button>
          <span class="tool-sep"></span>
          <button type="button" class="tool" data-cmd="insertUnorderedList" title="Маркированный список" aria-label="Список"><svg class="icon"><use href="#i-list" /></svg></button>
          <button type="button" class="tool" data-cmd="insertOrderedList" title="Нумерованный список" aria-label="Нумерованный список"><svg class="icon"><use href="#i-list-ol" /></svg></button>
          <span class="tool-sep"></span>
          <button type="button" class="tool" data-cmd="removeFormat" title="Очистить форматирование" aria-label="Очистить формат"><svg class="icon"><use href="#i-eraser" /></svg></button>
        </div>
        <div class="editor-area js-description" contenteditable="true"
             data-placeholder="Описание" data-maxlength="2000"></div>
      </div>

      <div class="price-input">
        <span>₽</span>
        <input type="number" placeholder="Цена" class="js-price"
               min="0" max="999999999" step="1" inputmode="numeric" />
      </div>
    </div>

    <button class="done-btn" data-act="create-post">
      <svg class="icon"><use href="#i-check" /></svg>
      Готово
    </button>
  </section>
`;

let root = null;
let ctx = null;
let posts = [];
let currentFilter = "all"; // all | active | moderation | pinned
let currentQuery = "";
const cleanups = [];

// ---------- helpers с областью видимости root ----------
const $ = (sel) => root.querySelector(sel);
const $$ = (sel) => Array.from(root.querySelectorAll(sel));

function on(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  cleanups.push(() => target.removeEventListener(type, fn, opts));
}

// ---------- РЕНДЕР ----------
function renderPosts(data) {
  const container = $(".js-posts-list");
  if (!container) return;
  container.textContent = "";

  if (!data.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Ничего не найдено";
    container.appendChild(empty);
    return;
  }

  data.forEach((post) => {
    const div = document.createElement("div");
    div.className = "post" + (post.status !== "active" ? " inactive" : "");

    const content = document.createElement("div");
    content.className = "post-content";

    const titleEl = document.createElement("div");
    titleEl.className = "post-title";
    if (post.pinned) {
      titleEl.insertAdjacentHTML(
        "beforeend",
        '<svg class="icon pin-icon"><use href="#i-pin"/></svg>',
      );
    }
    titleEl.appendChild(document.createTextNode(post.title));
    content.appendChild(titleEl);

    const descEl = document.createElement("div");
    descEl.className = "post-desc";
    descEl.innerHTML = sanitizeHtml(post.description);
    content.appendChild(descEl);

    if (post.price) {
      const priceEl = document.createElement("div");
      priceEl.className = "post-price";
      priceEl.textContent = post.price + " ₽";
      content.appendChild(priceEl);
    }

    if (post.status === "moderation") {
      const statusEl = document.createElement("div");
      statusEl.className = "post-status";
      statusEl.textContent = "На модерации";
      content.appendChild(statusEl);
    }

    div.appendChild(content);

    const actions = document.createElement("div");
    actions.className = "post-actions";
    actions.innerHTML =
      '<button class="icon-btn menu-btn" aria-label="Меню" data-id="' +
      escapeHtml(post.id) +
      '"><svg class="icon"><use href="#i-more"/></svg></button>' +
      '<div class="post-menu" data-menu-for="' +
      escapeHtml(post.id) +
      '">' +
      '<button class="menu-item" data-menu-action="pin" data-id="' +
      escapeHtml(post.id) +
      '"><svg class="icon"><use href="#i-pin-action"/></svg><span>' +
      (post.pinned ? "Открепить" : "Закрепить") +
      "</span></button>" +
      '<button class="menu-item danger" data-menu-action="delete" data-id="' +
      escapeHtml(post.id) +
      '"><svg class="icon"><use href="#i-trash"/></svg><span>Удалить</span></button>' +
      "</div>";
    div.appendChild(actions);

    container.appendChild(div);
  });
}

function closeAllMenus() {
  $$(".post-menu.open").forEach((m) => m.classList.remove("open"));
}

function persist() {
  store.set("posts", posts);
}

function deletePost(id) {
  const idx = posts.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) return;
  if (!confirm("Удалить объявление «" + posts[idx].title + "»?")) return;
  posts.splice(idx, 1);
  persist();
  refresh();
}

function togglePin(id) {
  const post = posts.find((p) => String(p.id) === String(id));
  if (!post) return;
  post.pinned = !post.pinned;
  posts.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  persist();
  refresh();
}

function getVisiblePosts() {
  let list = posts;
  if (currentFilter === "active")
    list = list.filter((p) => p.status === "active");
  else if (currentFilter === "moderation")
    list = list.filter((p) => p.status === "moderation");
  else if (currentFilter === "pinned") list = list.filter((p) => p.pinned);

  if (currentQuery) {
    list = list.filter((p) => p.title.toLowerCase().includes(currentQuery));
  }
  return list;
}

function updateFilterCounts() {
  const counts = {
    all: posts.length,
    active: posts.filter((p) => p.status === "active").length,
    moderation: posts.filter((p) => p.status === "moderation").length,
    pinned: posts.filter((p) => p.pinned).length,
  };
  Object.keys(counts).forEach((k) => {
    const el = $('[data-count="' + k + '"]');
    if (el) el.textContent = counts[k];
  });
  $$(".chip").forEach((chip) => {
    chip.classList.toggle(
      "active",
      chip.getAttribute("data-filter") === currentFilter,
    );
  });
  // Сообщаем шеллу актуальную статистику для лаунчера
  ctx.bus.emit("ads:stats", counts);
}

function refresh() {
  renderPosts(getVisiblePosts());
  updateFilterCounts();
}

// ---------- ВНУТРЕННЯЯ НАВИГАЦИЯ ----------
function showView(view) {
  $$("[data-view]").forEach((s) =>
    s.classList.toggle("active", s.getAttribute("data-view") === view),
  );
  ctx.scrollTop();
}

// ---------- СОЗДАНИЕ ----------
function createPost() {
  const titleEl = $(".js-title");
  const descEl = $(".js-description");
  const priceEl = $(".js-price");

  const title = titleEl.value.trim().slice(0, LIMITS.title);
  const descriptionText = descEl.textContent.trim();
  const descriptionHtml = sanitizeHtml(descEl.innerHTML);
  const price = clampInt(priceEl.value, 0, LIMITS.priceMax);

  if (!title) {
    ctx.toast("Введите название");
    return;
  }
  if (descriptionText.length > LIMITS.description) {
    ctx.toast("Описание слишком длинное (макс " + LIMITS.description + ")");
    return;
  }

  posts.unshift({
    id: genId(),
    title,
    description: descriptionText ? descriptionHtml : "",
    price,
    pinned: false,
    status: "moderation",
  });
  persist();

  titleEl.value = "";
  descEl.innerHTML = "";
  priceEl.value = "";
  descEl.classList.add("is-empty");

  currentFilter = "moderation";
  currentQuery = "";
  const search = $(".posts-search");
  if (search) search.value = "";
  ctx.navigate("#/ads");
  refresh();
}

// ---------- RICH EDITOR ----------
function initEditor() {
  const editor = $(".js-description");
  const toolbar = $(".editor-toolbar");
  if (!editor || !toolbar) return;

  const allowed = [
    "bold", "italic", "underline", "strikeThrough",
    "insertUnorderedList", "insertOrderedList", "removeFormat",
  ];

  on(toolbar, "mousedown", (e) => {
    const btn = e.target.closest(".tool");
    if (!btn) return;
    e.preventDefault();
    const cmd = btn.getAttribute("data-cmd");
    if (!allowed.includes(cmd)) return;
    editor.focus();
    try {
      document.execCommand(cmd, false, null);
    } catch (err) {
      console.warn("exec failed:", cmd, err);
    }
    updateToolbarState();
  });

  function updateToolbarState() {
    toolbar.querySelectorAll(".tool").forEach((btn) => {
      const cmd = btn.getAttribute("data-cmd");
      let active = false;
      try {
        active = document.queryCommandState(cmd);
      } catch (_) {}
      btn.classList.toggle("active", active);
    });
  }

  on(editor, "keyup", updateToolbarState);
  on(editor, "mouseup", updateToolbarState);
  on(editor, "focus", updateToolbarState);

  function syncEmpty() {
    const empty =
      editor.textContent.trim() === "" && !editor.querySelector("img,ul,ol");
    editor.classList.toggle("is-empty", empty);
  }
  on(editor, "input", syncEmpty);
  on(editor, "blur", syncEmpty);
  syncEmpty();

  const maxLen =
    Number(editor.getAttribute("data-maxlength")) || LIMITS.description;

  on(editor, "beforeinput", (e) => {
    if (!e.inputType) return;
    if (e.inputType.startsWith("delete")) return;
    const current = editor.textContent.length;
    const adding = (e.data || "").length || 1;
    if (current + adding > maxLen) e.preventDefault();
  });

  on(editor, "paste", (e) => {
    e.preventDefault();
    const text = e.clipboardData ? e.clipboardData.getData("text") : "";
    const available = maxLen - editor.textContent.length;
    if (available <= 0) return;
    document.execCommand("insertText", false, text.slice(0, available));
  });

  on(editor, "drop", (e) => {
    e.preventDefault();
    const text = e.dataTransfer ? e.dataTransfer.getData("text") : "";
    const available = maxLen - editor.textContent.length;
    if (available <= 0) return;
    document.execCommand("insertText", false, text.slice(0, available));
  });
}

// ---------- СЛУШАТЕЛИ ----------
function wireEvents() {
  // Делегированные клики внутри root
  on(root, "click", (e) => {
    // меню поста
    const menuBtn = e.target.closest(".menu-btn");
    if (menuBtn) {
      e.stopPropagation();
      const id = menuBtn.getAttribute("data-id");
      const menu = $('[data-menu-for="' + CSS.escape(id) + '"]');
      const wasOpen = menu && menu.classList.contains("open");
      closeAllMenus();
      if (menu && !wasOpen) menu.classList.add("open");
      return;
    }
    const item = e.target.closest(".menu-item");
    if (item) {
      e.stopPropagation();
      const id = item.getAttribute("data-id");
      const action = item.getAttribute("data-menu-action");
      closeAllMenus();
      if (action === "delete") deletePost(id);
      else if (action === "pin") togglePin(id);
      return;
    }
    closeAllMenus();

    // действия мини-аппа
    const actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    const act = actEl.getAttribute("data-act");
    if (act === "home") ctx.navigate("#/");
    else if (act === "goto-create") ctx.navigate("#/ads/create");
    else if (act === "goto-list") ctx.navigate("#/ads");
    else if (act === "create-post") createPost();
  });

  // фильтры
  on($(".js-filters"), "click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const valid = ["all", "active", "moderation", "pinned"];
    const f = chip.getAttribute("data-filter");
    currentFilter = valid.includes(f) ? f : "all";
    refresh();
  });

  // поиск
  on($(".posts-search"), "input", (e) => {
    currentQuery = e.target.value.toLowerCase().trim().slice(0, 100);
    refresh();
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

    // данные: из хранилища или сид
    posts = store.get("posts", null) || SEED.slice();

    // имя пользователя в форме создания
    const u = ctx.user;
    if (u) {
      const idEl = $(".js-user-id");
      if (idEl)
        idEl.textContent =
          "#" + u.id + (u.username ? " || @" + u.username : "");
    }
    // связать input[type=file] с label (без глобального id)
    const media = $(".js-media");
    const label = $(".js-media-label");
    if (media && label) on(label, "click", () => media.click());

    initEditor();
    wireEvents();
    refresh();

    // начальный под-вид
    this.onRoute(context.subpath || []);
  },

  onRoute(subpath) {
    showView(subpath[0] === "create" ? "create" : "list");
  },

  unmount() {
    closeAllMenus();
    cleanups.splice(0).forEach((fn) => fn());
    if (root) root.innerHTML = "";
    root = null;
    ctx = null;
  },
};
