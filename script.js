// ============== КОНСТАНТЫ ==============
const LIMITS = {
  title: 100,
  description: 2000,
  priceMax: 999999999,
};

// ============== TELEGRAM AUTH ==============
// Замените на имя вашего бота (без @), созданного через @BotFather
// const TG_BOT_USERNAME = "YOUR_BOT_USERNAME";

// function getTgUser() {
//   try {
//     const data = localStorage.getItem("tg_user");
//     return data ? JSON.parse(data) : null;
//   } catch (_) {
//     return null;
//   }
// }

// function saveTgUser(user) {
//   try {
//     localStorage.setItem("tg_user", JSON.stringify(user));
//   } catch (_) {}
// }

// function logout() {
//   try {
//     localStorage.removeItem("tg_user");
//   } catch (_) {}
//   showPage("login-page");
// }

function logout() {
  console.log("logout disabled (no auth mode)");
}

// Вызывается Telegram Login Widget после успешного входа
// window.onTelegramAuth = function (user) {
//   // saveTgUser(user);
//   applyUserData(user);
//   showPage("home-page");
//   refresh();
// };

function applyUserData(user) {
  if (!user) return;

  // Имя в top-bar
  const nameEl = document.querySelector(".username");
  if (nameEl) nameEl.textContent = user.first_name || "qwopex";

  // ID и username в профиле
  document.querySelectorAll(".user-id").forEach(function (el) {
    el.textContent =
      "#" + user.id + (user.username ? " || @" + user.username : "");
  });

  // Аватар — фото из Telegram
  if (user.photo_url) {
    document.querySelectorAll(".avatar").forEach(function (av) {
      const img = document.createElement("img");
      img.src = user.photo_url;
      img.alt = "";
      img.className = "avatar-img";
      av.textContent = "";
      av.appendChild(img);
    });
  }
}

// function initTelegramWidget() {
//   const container = document.getElementById("telegram-login");
//   if (!container || container.querySelector("script")) return;

//   var script = document.createElement("script");
//   script.async = true;
//   script.src = "https://telegram.org/js/telegram-widget.js?22";
//   script.setAttribute("data-telegram-login", TG_BOT_USERNAME);
//   script.setAttribute("data-size", "large");
//   script.setAttribute("data-radius", "10");
//   script.setAttribute("data-onauth", "onTelegramAuth(user)");
//   script.setAttribute("data-request-access", "write");
//   container.appendChild(script);
// }

// ============== ДАННЫЕ ==============
const posts = [
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

// ============== УТИЛИТЫ ==============
function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

// Разрешенные теги для описания — whitelist санитайзер
const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "BR",
  "P",
  "DIV",
  "UL",
  "OL",
  "LI",
  "SPAN",
]);

function sanitizeHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  clean(template.content);
  return template.innerHTML;

  function clean(node) {
    const children = Array.from(node.childNodes);
    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!ALLOWED_TAGS.has(child.tagName)) {
          const text = document.createTextNode(child.textContent || "");
          child.parentNode.replaceChild(text, child);
          return;
        }
        // удаляем все атрибуты (on*, style, href, src и т.д.)
        Array.from(child.attributes).forEach((attr) => {
          child.removeAttribute(attr.name);
        });
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

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function genId() {
  // Уникальнее чем Date.now() — защита от коллизий при быстром создании
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============== РЕНДЕР ==============
function renderPosts(data) {
  const container = document.querySelector(".posts-list");
  if (!container) return;

  container.textContent = ""; // очистка без innerHTML

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

    // заголовок и описание собираем безопасно
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

    // блок меню
    const actions = document.createElement("div");
    actions.className = "post-actions";
    actions.innerHTML =
      '<button class="icon-btn menu-btn" aria-label="Меню" data-id="' +
      escapeHtml(post.id) +
      '">' +
      '<svg class="icon"><use href="#i-more"/></svg>' +
      "</button>" +
      '<div class="post-menu" data-menu-for="' +
      escapeHtml(post.id) +
      '">' +
      '<button class="menu-item" data-menu-action="pin" data-id="' +
      escapeHtml(post.id) +
      '">' +
      '<svg class="icon"><use href="#i-pin-action"/></svg>' +
      "<span>" +
      (post.pinned ? "Открепить" : "Закрепить") +
      "</span>" +
      "</button>" +
      '<button class="menu-item danger" data-menu-action="delete" data-id="' +
      escapeHtml(post.id) +
      '">' +
      '<svg class="icon"><use href="#i-trash"/></svg>' +
      "<span>Удалить</span>" +
      "</button>" +
      "</div>";
    div.appendChild(actions);

    container.appendChild(div);
  });
}

// ============== МЕНЮ ПОСТА ==============
function closeAllMenus() {
  document
    .querySelectorAll(".post-menu.open")
    .forEach((m) => m.classList.remove("open"));
}

function deletePost(id) {
  const idx = posts.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) return;
  if (!confirm("Удалить объявление «" + posts[idx].title + "»?")) return;
  posts.splice(idx, 1);
  refresh();
}

function togglePin(id) {
  const post = posts.find((p) => String(p.id) === String(id));
  if (!post) return;
  post.pinned = !post.pinned;
  posts.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  refresh();
}

// ============== СОСТОЯНИЕ СПИСКА ==============
let currentFilter = "all"; // all | active | moderation | pinned
let currentQuery = "";

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

function refresh() {
  renderPosts(getVisiblePosts());
  updateFilterCounts();
  updateStats();
}

function updateFilterCounts() {
  const counts = {
    all: posts.length,
    active: posts.filter((p) => p.status === "active").length,
    moderation: posts.filter((p) => p.status === "moderation").length,
    pinned: posts.filter((p) => p.pinned).length,
  };
  Object.keys(counts).forEach((k) => {
    const el = document.querySelector('[data-count="' + k + '"]');
    if (el) el.textContent = counts[k];
  });
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle(
      "active",
      chip.getAttribute("data-filter") === currentFilter,
    );
  });
}

function updateStats() {
  const active = posts.filter((p) => p.status === "active").length;
  const moderation = posts.filter((p) => p.status === "moderation").length;
  const a = document.querySelector('[data-stat="active"]');
  const m = document.querySelector('[data-stat="moderation"]');
  if (a) a.textContent = active;
  if (m) m.textContent = moderation;
}

// ============== НАВИГАЦИЯ ==============
function showPage(pageId) {
  if (!pageId) return;
  document.querySelectorAll("main > .page").forEach((section) => {
    section.classList.remove("active");
  });
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");

  if (pageId === "posts-page") {
    const searchInput = document.getElementById("posts-search");
    if (searchInput) searchInput.value = currentQuery;
    refresh();
  }
  window.scrollTo(0, 0);
}

function toggleTheme() {
  document.body.classList.toggle("light");
  try {
    localStorage.setItem(
      "theme",
      document.body.classList.contains("light") ? "light" : "dark",
    );
  } catch (_) {}
}

function openPosts(filter) {
  const valid = ["all", "active", "moderation", "pinned"];
  currentFilter = valid.includes(filter) ? filter : "all";
  currentQuery = "";
  showPage("posts-page");
}

// ============== СОЗДАНИЕ ==============
function createPost() {
  const titleEl = document.getElementById("title");
  const descEl = document.getElementById("description");
  const priceEl = document.getElementById("price");

  const title = titleEl.value.trim().slice(0, LIMITS.title);
  const descriptionText = descEl.textContent.trim();
  const descriptionHtml = sanitizeHtml(descEl.innerHTML);
  const price = clampInt(priceEl.value, 0, LIMITS.priceMax);

  if (!title) {
    alert("Введите название");
    return;
  }

  if (descriptionText.length > LIMITS.description) {
    alert(
      "Описание слишком длинное (максимум " + LIMITS.description + " символов)",
    );
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

  titleEl.value = "";
  descEl.innerHTML = "";
  priceEl.value = "";
  descEl.classList.add("is-empty");

  currentFilter = "moderation";
  currentQuery = "";
  showPage("posts-page");
  refresh();
}

// ============== RICH EDITOR ==============
function initEditor() {
  const editor = document.getElementById("description");
  const toolbar = document.querySelector(".editor-toolbar");
  if (!editor || !toolbar) return;

  toolbar.addEventListener("mousedown", (e) => {
    const btn = e.target.closest(".tool");
    if (!btn) return;
    e.preventDefault();
    const cmd = btn.getAttribute("data-cmd");
    // whitelist допустимых команд
    const allowed = [
      "bold",
      "italic",
      "underline",
      "strikeThrough",
      "insertUnorderedList",
      "insertOrderedList",
      "removeFormat",
    ];
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

  editor.addEventListener("keyup", updateToolbarState);
  editor.addEventListener("mouseup", updateToolbarState);
  editor.addEventListener("focus", updateToolbarState);

  function syncEmpty() {
    const empty =
      editor.textContent.trim() === "" && !editor.querySelector("img,ul,ol");
    editor.classList.toggle("is-empty", empty);
  }
  editor.addEventListener("input", syncEmpty);
  editor.addEventListener("blur", syncEmpty);
  syncEmpty();

  // Ограничение длины — блокируем ввод после лимита
  const maxLen =
    Number(editor.getAttribute("data-maxlength")) || LIMITS.description;
  editor.addEventListener("beforeinput", (e) => {
    if (!e.inputType) return;
    if (e.inputType.startsWith("delete")) return; // удаление всегда разрешаем
    const current = editor.textContent.length;
    // оценка длины добавляемого
    const adding = (e.data || "").length || 1;
    if (current + adding > maxLen) e.preventDefault();
  });

  // Вставка — только plain text, с обрезкой до лимита
  editor.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = e.clipboardData ? e.clipboardData.getData("text") : "";
    const available = maxLen - editor.textContent.length;
    if (available <= 0) return;
    document.execCommand("insertText", false, text.slice(0, available));
  });

  // drag&drop — тоже не даём протащить сырой HTML
  editor.addEventListener("drop", (e) => {
    e.preventDefault();
    const text = e.dataTransfer ? e.dataTransfer.getData("text") : "";
    const available = maxLen - editor.textContent.length;
    if (available <= 0) return;
    document.execCommand("insertText", false, text.slice(0, available));
  });
}

// ============== ДЕЛЕГИРОВАННЫЕ ОБРАБОТЧИКИ КЛИКОВ ==============
document.addEventListener("click", (e) => {
  // 1) Кнопка меню поста (⋮)
  const menuBtn = e.target.closest(".menu-btn");
  if (menuBtn) {
    e.stopPropagation();
    const id = menuBtn.getAttribute("data-id");
    const menu = document.querySelector(
      '[data-menu-for="' + CSS.escape(id) + '"]',
    );
    const wasOpen = menu && menu.classList.contains("open");
    closeAllMenus();
    if (menu && !wasOpen) menu.classList.add("open");
    return;
  }

  // 2) Пункт меню поста
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

  // 3) Глобальные data-action
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.getAttribute("data-action");
  const arg = actionEl.getAttribute("data-arg");

  switch (action) {
    case "toggle-theme":
      toggleTheme();
      break;
    case "show-page":
      showPage(arg);
      break;
    case "open-posts":
      openPosts(arg);
      break;
    case "create-post":
      createPost();
      break;
    case "logout":
      logout();
      break;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllMenus();
});

// ============== ПОИСК ==============
const postsSearch = document.getElementById("posts-search");
if (postsSearch) {
  postsSearch.addEventListener("input", (e) => {
    currentQuery = e.target.value.toLowerCase().trim().slice(0, 100);
    refresh();
  });
}

// ============== ФИЛЬТРЫ-ЧИПЫ ==============
const filtersBar = document.getElementById("filters");
if (filtersBar) {
  filtersBar.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const valid = ["all", "active", "moderation", "pinned"];
    const f = chip.getAttribute("data-filter");
    currentFilter = valid.includes(f) ? f : "all";
    refresh();
  });
}

// ============== ИНИЦИАЛИЗАЦИЯ ==============
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (localStorage.getItem("theme") === "light") {
      document.body.classList.add("light");
    }
  } catch (_) {}

  initEditor();

  // var user = getTgUser();
  // if (user) {
  //   applyUserData(user);
  //   showPage("home-page");
  // } else {
  //   initTelegramWidget();
  //   showPage("login-page");
  // }

  // refresh();

  const fakeUser = {
    id: 217651550,
    first_name: "qwopex",
    username: "BVA21",
    photo_url: "",
  };

  applyUserData(fakeUser);
  showPage("home-page");

  refresh();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js")
        .catch((err) => console.warn("SW register failed:", err));
    });
  }
});
