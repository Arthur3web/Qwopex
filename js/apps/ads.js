// ============================================================
// Мини-апп «Объявления».
// Порт исходного script.js под контракт мини-аппа супераппа.
// Владеет собственным UI (список + деталь + создание/редактирование)
// и под-маршрутами:
//   #/ads             — список
//   #/ads/create      — создание
//   #/ads/<id>        — просмотр объявления (карточка-деталь)
//   #/ads/<id>/edit   — редактирование
// ============================================================

import {
  LIMITS,
  escapeHtml,
  sanitizeHtml,
  clampInt,
  genId,
  createStorage,
  resizeImageToDataURL,
} from "../sdk.js";
import { confirmDialog } from "../ui/qx-modal.js";
import { adMessageInfo } from "../data/chats-store.js";
import { CATEGORIES } from "../data/categories.js";

const store = createStorage("ads");

// ---------- Демоданные (потом заменить на загрузку с бэкенда) ----------
const SEED = [
  {
    id: 1,
    title: "Закреплённое объявление",
    description: "<b>Пример</b> закреплённого поста",
    price: 1500,
    category: "Электроника",
    pinned: true,
    status: "active",
  },
  {
    id: 2,
    title: "Активное объявление",
    description: "Пример <i>активного</i> поста",
    price: 2000,
    category: "Дом",
    pinned: false,
    status: "active",
  },
  {
    id: 3,
    title: "На проверке",
    description: "Ожидает модерации",
    price: 999,
    category: "Услуги",
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

    <div class="filter-label">Категория</div>
    <div class="cat-filters js-cat-filters">
      <button class="chip cat-chip active" data-category="">Все</button>
      ${CATEGORIES.map((c) => '<button class="chip cat-chip" data-category="' + escapeHtml(c) + '">' + escapeHtml(c) + "</button>").join("")}
    </div>

    <div class="filter-label">Статус</div>
    <div class="filters js-filters">
      <button class="chip active" data-filter="all">Все <span class="chip-count" data-count="all">0</span></button>
      <button class="chip" data-filter="active">Активные <span class="chip-count" data-count="active">0</span></button>
      <button class="chip" data-filter="moderation">На модерации <span class="chip-count" data-count="moderation">0</span></button>
      <button class="chip" data-filter="pinned">Закреплённые <span class="chip-count" data-count="pinned">0</span></button>
    </div>

    <div class="posts-list js-posts-list"></div>
  </section>

  <section class="page detail-page" data-view="detail">
    <div class="posts-header">
      <button class="icon-btn back-btn" data-act="goto-list" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <h2>Объявление</h2>
      <a class="icon-btn detail-chats-btn js-detail-chats" href="#/chats" aria-label="Сообщения" hidden>
        <svg class="icon"><use href="#i-chat" /></svg>
        <span class="detail-chats-badge js-detail-chats-badge" hidden></span>
      </a>
      <div class="detail-menu-wrap">
        <button class="icon-btn js-detail-menu-btn" aria-label="Действия">
          <svg class="icon"><use href="#i-more" /></svg>
        </button>
        <div class="post-menu detail-menu js-detail-menu">
          <button class="menu-item" data-act="goto-edit">
            <svg class="icon"><use href="#i-edit" /></svg><span>Редактировать</span>
          </button>
          <button class="menu-item js-detail-pin-item" data-act="toggle-pin-detail" hidden>
            <svg class="icon"><use href="#i-pin-action" /></svg><span>Закрепить</span>
          </button>
          <button class="menu-item danger" data-act="delete-detail">
            <svg class="icon"><use href="#i-trash" /></svg><span>Удалить</span>
          </button>
        </div>
      </div>
    </div>
    <div class="detail-body js-detail-body"></div>
  </section>

  <section class="page create-page" data-view="create">
    <div class="create-header">
      <button class="icon-btn back-btn" data-act="create-back" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <h2 class="js-create-title">Создание</h2>
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

      <select class="form-select js-category" aria-label="Категория">
        <option value="">Категория</option>
        ${CATEGORIES.map((c) => '<option value="' + c + '">' + c + "</option>").join("")}
      </select>

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
        <input type="number" placeholder="Цена" class="js-price" required
               min="1" max="999999999" step="1" inputmode="numeric" />
      </div>
    </div>

    <button class="done-btn" data-act="save-post">
      <svg class="icon"><use href="#i-check" /></svg>
      <span class="js-done-label">Готово</span>
    </button>
  </section>
`;

let root = null;
let ctx = null;
let posts = [];
let currentFilter = "all"; // all | active | moderation | pinned
let currentQuery = "";
let currentCategory = ""; // фильтр по категории ("" = все)
let selectedImage = null; // data URL выбранного/сжатого изображения для формы
let editingId = null; // id редактируемого объявления (null = создание нового)
let detailId = null; // id объявления, открытого в карточке-детали
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
    div.dataset.id = post.id;
    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");

    if (post.image) {
      const thumb = document.createElement("img");
      thumb.className = "post-thumb";
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.src = post.image;
      div.appendChild(thumb);
    }

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

    if (post.category) {
      const catEl = document.createElement("div");
      catEl.className = "post-category";
      catEl.textContent = post.category;
      content.appendChild(catEl);
    }

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

    // индикатор сообщений по объявлению (данные из мини-аппа «Чаты»)
    const info = adMessageInfo(post.id);
    if (info.count > 0) {
      const chats = document.createElement("a");
      chats.className = "post-chats" + (info.unread > 0 ? " has-unread" : "");
      chats.href = "#/chats/" + info.dialogId;
      chats.innerHTML =
        '<svg class="icon"><use href="#i-chat"/></svg><span>Сообщения</span>';
      if (info.unread > 0) {
        const badge = document.createElement("span");
        badge.className = "post-chats-unread";
        badge.textContent = info.unread;
        chats.appendChild(badge);
      }
      content.appendChild(chats);
    }

    div.appendChild(content);

    const actions = document.createElement("div");
    actions.className = "post-actions";
    const idAttr = escapeHtml(post.id);
    const editItem =
      '<button class="menu-item" data-menu-action="edit" data-id="' +
      idAttr +
      '"><svg class="icon"><use href="#i-edit"/></svg><span>Редактировать</span></button>';
    // Закреплять можно только опубликованные (активные) объявления —
    // на модерации публикация ещё не видна, закрепление не имеет смысла.
    const pinItem =
      post.status === "active"
        ? '<button class="menu-item" data-menu-action="pin" data-id="' +
          idAttr +
          '"><svg class="icon"><use href="#i-pin-action"/></svg><span>' +
          (post.pinned ? "Открепить" : "Закрепить") +
          "</span></button>"
        : "";
    actions.innerHTML =
      '<button class="icon-btn menu-btn" aria-label="Меню" data-id="' +
      idAttr +
      '"><svg class="icon"><use href="#i-more"/></svg></button>' +
      '<div class="post-menu" data-menu-for="' +
      idAttr +
      '">' +
      editItem +
      pinItem +
      '<button class="menu-item danger" data-menu-action="delete" data-id="' +
      idAttr +
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

async function deletePost(id) {
  const idx = posts.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) return;
  const ok = await confirmDialog({
    title: "Удалить объявление?",
    message: "«" + posts[idx].title + "» будет удалено без возможности восстановления.",
    confirmText: "Удалить",
    cancelText: "Отмена",
    danger: true,
  });
  if (!ok) return;
  // мини-апп мог быть размонтирован, пока открыт диалог
  if (!root) return;
  const liveIdx = posts.findIndex((p) => String(p.id) === String(id));
  if (liveIdx === -1) return;
  posts.splice(liveIdx, 1);
  persist();
  refresh();
}

function togglePin(id) {
  const post = posts.find((p) => String(p.id) === String(id));
  if (!post) return;
  // Защита на случай вызова не из UI: закрепляем только активные.
  if (post.status !== "active") {
    ctx.toast("Закрепить можно только активное объявление");
    return;
  }
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

  if (currentCategory) {
    list = list.filter((p) => p.category === currentCategory);
  }

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
  // только статусные чипы (категорийные .chip живут в .js-cat-filters)
  $$(".js-filters .chip").forEach((chip) => {
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

// ---------- СОЗДАНИЕ / РЕДАКТИРОВАНИЕ ----------
// Считать и провалидировать форму. Возвращает данные или null (с тостом).
function readForm() {
  const titleEl = $(".js-title");
  const descEl = $(".js-description");
  const priceEl = $(".js-price");
  const categoryEl = $(".js-category");

  const title = titleEl.value.trim().slice(0, LIMITS.title);
  const descriptionText = descEl.textContent.trim();
  const descriptionHtml = sanitizeHtml(descEl.innerHTML);
  const price = clampInt(priceEl.value, 0, LIMITS.priceMax);
  const category = categoryEl ? categoryEl.value : "";

  if (!title) {
    ctx.toast("Введите название", "error");
    titleEl.focus();
    return null;
  }
  if (!category) {
    ctx.toast("Выберите категорию", "error");
    if (categoryEl) categoryEl.focus();
    return null;
  }
  if (descriptionText.length > LIMITS.description) {
    ctx.toast("Описание слишком длинное (макс " + LIMITS.description + ")", "error");
    return null;
  }
  if (!priceEl.value.trim() || price <= 0) {
    ctx.toast("Укажите цену", "error");
    priceEl.focus();
    return null;
  }
  return {
    title,
    description: descriptionText ? descriptionHtml : "",
    price,
    category,
    image: selectedImage || "",
  };
}

function savePost() {
  const data = readForm();
  if (!data) return;

  if (editingId != null) {
    // ----- редактирование существующего -----
    const post = posts.find((p) => String(p.id) === String(editingId));
    if (!post) {
      ctx.toast("Объявление не найдено", "error");
      ctx.navigate("#/ads");
      return;
    }
    Object.assign(post, data);
    persist();
    const savedId = post.id;
    resetForm();
    ctx.navigate("#/ads/" + savedId); // вернуться к карточке-детали
    ctx.toast("Изменения сохранены", "success");
    return;
  }

  // ----- создание нового -----
  posts.unshift(
    Object.assign(
      { id: genId(), pinned: false, status: "moderation" },
      data,
    ),
  );
  persist();
  resetForm();

  currentFilter = "moderation";
  currentQuery = "";
  currentCategory = "";
  const search = $(".posts-search");
  if (search) search.value = "";
  applyCatActive();
  ctx.navigate("#/ads");
  refresh();
  ctx.toast("Объявление отправлено на модерацию", "success");
}

// Очистить поля формы.
function resetForm() {
  const titleEl = $(".js-title");
  const descEl = $(".js-description");
  const priceEl = $(".js-price");
  if (titleEl) titleEl.value = "";
  if (descEl) {
    descEl.innerHTML = "";
    descEl.classList.add("is-empty");
  }
  if (priceEl) priceEl.value = "";
  const categoryEl = $(".js-category");
  if (categoryEl) categoryEl.value = "";
  selectedImage = null;
  renderMediaPreview();
}

// Заполнить форму данными объявления (для редактирования).
function fillForm(post) {
  const titleEl = $(".js-title");
  const descEl = $(".js-description");
  const priceEl = $(".js-price");
  const categoryEl = $(".js-category");
  if (titleEl) titleEl.value = post.title || "";
  if (descEl) {
    descEl.innerHTML = sanitizeHtml(post.description || "");
    descEl.classList.toggle("is-empty", !descEl.textContent.trim());
  }
  if (priceEl) priceEl.value = post.price || "";
  if (categoryEl) categoryEl.value = post.category || "";
  selectedImage = post.image || null;
  renderMediaPreview();
}

// Переключить заголовок/кнопку формы между «Создание» и «Редактирование».
function setCreateMode(isEdit) {
  const titleH = $(".js-create-title");
  if (titleH) titleH.textContent = isEdit ? "Редактирование" : "Создание";
  const lbl = $(".js-done-label");
  if (lbl) lbl.textContent = isEdit ? "Сохранить" : "Готово";
}

// ---------- ВХОД В ЭКРАНЫ (вызывается из onRoute по URL) ----------
function enterList() {
  editingId = null;
  detailId = null;
  refresh(); // отразить возможные правки
  showView("list");
}

function enterCreate() {
  editingId = null;
  resetForm();
  setCreateMode(false);
  showView("create");
  const titleEl = $(".js-title");
  if (titleEl) titleEl.focus();
}

function enterEdit(id) {
  const post = posts.find((p) => String(p.id) === String(id));
  if (!post) {
    ctx.navigate("#/ads");
    return;
  }
  editingId = post.id;
  fillForm(post);
  setCreateMode(true);
  showView("create");
}

function enterDetail(id) {
  if (!renderDetail(id)) {
    ctx.navigate("#/ads");
    return;
  }
  showView("detail");
}

// ---------- КАРТОЧКА-ДЕТАЛЬ ----------
function renderDetail(id) {
  const post = posts.find((p) => String(p.id) === String(id));
  const body = $(".js-detail-body");
  if (!post || !body) return false;
  detailId = post.id;
  body.textContent = "";

  // пункт «Закрепить/Открепить» в меню — только для активных (как в списке)
  const pinItem = $(".js-detail-pin-item");
  if (pinItem) {
    if (post.status === "active") {
      pinItem.hidden = false;
      pinItem.querySelector("span").textContent = post.pinned
        ? "Открепить"
        : "Закрепить";
    } else {
      pinItem.hidden = true;
    }
  }

  // иконка сообщений в шапке с бейджем непрочитанных
  const info = adMessageInfo(post.id);
  const chatsBtn = $(".js-detail-chats");
  const chatsBadge = $(".js-detail-chats-badge");
  if (chatsBtn) {
    if (info.count > 0) {
      chatsBtn.hidden = false;
      chatsBtn.href = "#/chats/" + info.dialogId;
      if (info.unread > 0 && chatsBadge) {
        chatsBadge.hidden = false;
        chatsBadge.textContent = info.unread;
      } else if (chatsBadge) {
        chatsBadge.hidden = true;
      }
    } else {
      chatsBtn.hidden = true;
    }
  }

  if (post.image) {
    const img = document.createElement("img");
    img.className = "detail-image";
    img.alt = "";
    img.src = post.image;
    body.appendChild(img);
  }

  const inner = document.createElement("div");
  inner.className = "detail-inner";

  // бейджи: статус + категория
  const badges = document.createElement("div");
  badges.className = "detail-badges";
  const badge = document.createElement("span");
  if (post.status === "moderation") {
    badge.className = "detail-badge moderation";
    badge.textContent = "На модерации";
  } else {
    badge.className = "detail-badge active";
    badge.textContent = post.pinned ? "Активно · закреплено" : "Активно";
  }
  badges.appendChild(badge);
  if (post.category) {
    const cat = document.createElement("span");
    cat.className = "detail-badge category";
    cat.textContent = post.category;
    badges.appendChild(cat);
  }
  inner.appendChild(badges);

  const titleEl = document.createElement("h3");
  titleEl.className = "detail-title";
  titleEl.textContent = post.title;
  inner.appendChild(titleEl);

  if (post.price) {
    const priceEl = document.createElement("div");
    priceEl.className = "detail-price";
    priceEl.textContent = post.price + " ₽";
    inner.appendChild(priceEl);
  }

  const descEl = document.createElement("div");
  descEl.className = "detail-desc";
  descEl.innerHTML = sanitizeHtml(post.description || "");
  if (!descEl.textContent.trim()) descEl.remove();
  else inner.appendChild(descEl);

  // действия и сообщения — в шапке детали (меню «⋮» и иконка чата)

  body.appendChild(inner);
  return true;
}

async function deleteFromDetail(id) {
  await deletePost(id); // покажет подтверждение и удалит
  if (root && !posts.some((p) => String(p.id) === String(id))) {
    ctx.navigate("#/ads");
  }
}

// ---------- МЕДИА (клиентский ресайз + превью) ----------
// Перерисовать содержимое области загрузки в зависимости от состояния.
function renderMediaPreview() {
  const label = $(".js-media-label");
  if (!label) return;
  label.textContent = "";

  if (selectedImage) {
    label.classList.add("has-media");
    const img = document.createElement("img");
    img.className = "upload-preview";
    img.alt = "Превью изображения";
    img.src = selectedImage;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "js-media-remove upload-remove";
    remove.setAttribute("aria-label", "Удалить изображение");
    remove.innerHTML = '<svg class="icon"><use href="#i-trash" /></svg>';
    label.appendChild(img);
    label.appendChild(remove);
  } else {
    label.classList.remove("has-media");
    label.innerHTML =
      '<div class="upload-icon"><svg class="icon"><use href="#i-image" /></svg></div><p>Загрузить медиа</p>';
  }
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
    // overflow-меню «⋮» на странице объявления
    const detailMenuBtn = e.target.closest(".js-detail-menu-btn");
    if (detailMenuBtn) {
      e.stopPropagation();
      const menu = $(".js-detail-menu");
      const wasOpen = menu && menu.classList.contains("open");
      closeAllMenus();
      if (menu && !wasOpen) menu.classList.add("open");
      return;
    }
    // пункты меню списка (data-menu-action). Пункты меню детали используют
    // data-act и обрабатываются ниже, поэтому здесь их не перехватываем.
    const item = e.target.closest(".menu-item");
    if (item && item.hasAttribute("data-menu-action")) {
      e.stopPropagation();
      const id = item.getAttribute("data-id");
      const action = item.getAttribute("data-menu-action");
      closeAllMenus();
      if (action === "delete") deletePost(id);
      else if (action === "pin") togglePin(id);
      else if (action === "edit") ctx.navigate("#/ads/" + id + "/edit");
      return;
    }
    closeAllMenus();

    // действия мини-аппа (кнопки) — приоритетнее клика по карточке
    const actEl = e.target.closest("[data-act]");
    if (actEl) {
      const act = actEl.getAttribute("data-act");
      if (act === "home") ctx.navigate("#/");
      else if (act === "goto-create") ctx.navigate("#/ads/create");
      else if (act === "goto-list") ctx.navigate("#/ads");
      else if (act === "save-post") savePost();
      else if (act === "goto-edit" && detailId != null)
        ctx.navigate("#/ads/" + detailId + "/edit");
      else if (act === "delete-detail" && detailId != null)
        deleteFromDetail(detailId);
      else if (act === "toggle-pin-detail" && detailId != null) {
        togglePin(detailId);
        renderDetail(detailId); // обновить бейдж и состояние кнопки
      }
      else if (act === "create-back")
        ctx.navigate(editingId != null ? "#/ads/" + editingId : "#/ads");
      return;
    }

    // клик по индикатору сообщений — пусть отработает ссылка <a> в чат
    if (e.target.closest(".post-chats")) return;

    // клик по карточке списка — открыть деталь
    const card = e.target.closest(".post");
    if (card && card.dataset.id) ctx.navigate("#/ads/" + card.dataset.id);
  });

  // открытие карточки с клавиатуры (Enter/Space) — только когда фокус
  // на самой карточке, а не на вложенной кнопке меню
  on(root, "keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".post");
    if (card && e.target === card && card.dataset.id) {
      e.preventDefault();
      ctx.navigate("#/ads/" + card.dataset.id);
    }
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

  // фильтр по категории (лента чипов)
  on($(".js-cat-filters"), "click", (e) => {
    const chip = e.target.closest(".cat-chip");
    if (!chip) return;
    currentCategory = chip.getAttribute("data-category") || "";
    applyCatActive();
    refresh();
  });
}

// Подсветить активный чип категории по currentCategory.
function applyCatActive() {
  $$(".cat-chip").forEach((c) =>
    c.classList.toggle(
      "active",
      (c.getAttribute("data-category") || "") === currentCategory,
    ),
  );
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
    if (media && label) {
      on(label, "click", (e) => {
        // клик по «крестику» — убрать изображение, не открывать диалог
        if (e.target.closest(".js-media-remove")) {
          e.preventDefault();
          selectedImage = null;
          media.value = "";
          renderMediaPreview();
          return;
        }
        media.click();
      });
      on(media, "change", async () => {
        const file = media.files && media.files[0];
        if (!file) return;
        try {
          selectedImage = await resizeImageToDataURL(file);
          if (!root) return; // размонтировали, пока жали
          renderMediaPreview();
        } catch (_) {
          ctx.toast("Не удалось загрузить изображение", "error");
        }
        media.value = ""; // позволить выбрать тот же файл повторно
      });
    }

    initEditor();
    wireEvents();
    refresh();

    // начальный под-вид
    this.onRoute(context.subpath || []);
  },

  onRoute(subpath) {
    const seg = subpath[0];
    if (!seg || seg === "list") return enterList();
    if (seg === "create") return enterCreate();
    if (subpath[1] === "edit") return enterEdit(seg);
    return enterDetail(seg);
  },

  unmount() {
    closeAllMenus();
    cleanups.splice(0).forEach((fn) => fn());
    if (root) root.innerHTML = "";
    root = null;
    ctx = null;
    selectedImage = null;
    editingId = null;
    detailId = null;
  },
};
