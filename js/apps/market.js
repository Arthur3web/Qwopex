// ============================================================
// Мини-апп «Маркет» — публичный каталог товаров.
// Каталог + карточка товара. Под-маршруты:
//   #/market         — каталог (с фильтром по категориям)
//   #/market/<id>    — карточка товара
// «Написать продавцу» открывает диалог в Чатах (кросс-модуль).
// Данные — демо-сид (позже бэкенд/каталог).
// ============================================================

import { escapeHtml, sanitizeHtml } from "../sdk.js";
import { startDialog } from "../data/chats-store.js";
import { CATEGORIES } from "../data/categories.js";
import { pay } from "../data/wallet-store.js";
import { confirmDialog } from "../ui/qx-modal.js";

// ---------- Демо-каталог ----------
const PRODUCTS = [
  {
    id: "p1",
    title: "Беспроводные наушники",
    price: 2990,
    category: "Электроника",
    seller: "TechShop",
    color: "#3b82f6",
    description: "TWS-наушники с активным шумоподавлением и зарядным кейсом.",
  },
  {
    id: "p2",
    title: "Механическая клавиатура",
    price: 5490,
    category: "Электроника",
    seller: "TechShop",
    color: "#7aa2ff",
    description: "Хот-свап, RGB-подсветка, переключатели на выбор.",
  },
  {
    id: "p3",
    title: "Кофеварка гейзерная",
    price: 1290,
    category: "Дом",
    seller: "HomeStyle",
    color: "#ff9f0a",
    description: "На 6 чашек, нержавеющая сталь, для газа и индукции.",
  },
  {
    id: "p4",
    title: "Плед хлопковый",
    price: 1890,
    category: "Дом",
    seller: "HomeStyle",
    color: "#ff5d8f",
    description: "Мягкий вязаный плед 130×170 см, гипоаллергенный.",
  },
  {
    id: "p5",
    title: "Кроссовки беговые",
    price: 4590,
    category: "Спорт",
    seller: "SportLine",
    color: "#00d68f",
    description: "Лёгкие, с амортизацией, дышащий верх. Размеры 38–45.",
  },
  {
    id: "p6",
    title: "Рюкзак городской",
    price: 2390,
    category: "Одежда",
    seller: "UrbanGoods",
    color: "#a78bfa",
    description: "Водоотталкивающий, отделение для ноутбука 15\".",
  },
];

const TEMPLATE = `
  <section class="page market-page" data-view="catalog">
    <div class="mini-header">
      <button class="icon-btn back-btn" data-act="home" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <h2>Маркет</h2>
    </div>
    <div class="search-container">
      <span class="search-icon"><svg class="icon"><use href="#i-search" /></svg></span>
      <input type="text" class="posts-search js-market-search" placeholder="Поиск товаров"
             maxlength="100" autocomplete="off" spellcheck="false" />
      <button type="button" class="search-clear js-search-clear" aria-label="Очистить">
        <svg class="icon"><use href="#i-close" /></svg>
      </button>
    </div>
    <div class="filters js-categories"></div>
    <div class="market-grid js-market-grid"></div>
  </section>

  <section class="page market-product-page" data-view="product">
    <div class="mini-header">
      <button class="icon-btn back-btn" data-act="goto-catalog" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <h2>Товар</h2>
    </div>
    <div class="market-product js-product"></div>
  </section>
`;

let root = null;
let ctx = null;
let currentCategory = "Все";
let currentQuery = "";
let currentProductId = null;
const cleanups = [];

const $ = (sel) => root.querySelector(sel);
function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  cleanups.push(() => target.removeEventListener(type, fn, opts));
}

function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

function fmtPrice(n) {
  return Number(n).toLocaleString("ru-RU") + " ₽";
}

// заглушка-картинка: цветной блок с иконкой (без внешних ресурсов под CSP)
function makeThumb(product, className) {
  const thumb = document.createElement("div");
  thumb.className = className;
  thumb.style.background = product.color;
  thumb.innerHTML = '<svg class="icon"><use href="#i-market" /></svg>';
  return thumb;
}

// ---------- ВНУТРЕННЯЯ НАВИГАЦИЯ ----------
function showView(view) {
  root.querySelectorAll("[data-view]").forEach((s) =>
    s.classList.toggle("active", s.getAttribute("data-view") === view),
  );
}

// ---------- КАТАЛОГ ----------
// Берём порядок и названия из общего справочника (единая таксономия),
// показываем только категории, в которых есть товары.
function categories() {
  const present = CATEGORIES.filter((c) =>
    PRODUCTS.some((p) => p.category === c),
  );
  return ["Все", ...present];
}

function renderCategories() {
  const box = $(".js-categories");
  if (!box) return;
  // счётчик товаров в категории («Все» — всего)
  const countFor = (c) =>
    c === "Все" ? PRODUCTS.length : PRODUCTS.filter((p) => p.category === c).length;
  box.innerHTML = categories()
    .map(
      (c) =>
        '<button class="chip' +
        (c === currentCategory ? " active" : "") +
        '" data-category="' +
        escapeHtml(c) +
        '">' +
        escapeHtml(c) +
        ' <span class="chip-count">' +
        countFor(c) +
        "</span></button>",
    )
    .join("");
}

function renderGrid() {
  const grid = $(".js-market-grid");
  if (!grid) return;
  grid.textContent = "";

  let list =
    currentCategory === "Все"
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === currentCategory);

  if (currentQuery) {
    list = list.filter((p) =>
      (p.title + " " + p.seller).toLowerCase().includes(currentQuery),
    );
  }

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Ничего не найдено";
    grid.appendChild(empty);
    return;
  }

  list.forEach((p) => {
    const card = document.createElement("a");
    card.className = "market-card";
    card.href = "#/market/" + p.id;

    card.appendChild(makeThumb(p, "market-thumb"));

    const title = document.createElement("div");
    title.className = "market-card-title";
    title.textContent = p.title;
    card.appendChild(title);

    const price = document.createElement("div");
    price.className = "market-card-price";
    price.textContent = fmtPrice(p.price);
    card.appendChild(price);

    const seller = document.createElement("div");
    seller.className = "market-card-seller";
    seller.textContent = p.seller;
    card.appendChild(seller);

    grid.appendChild(card);
  });
}

function renderCatalog() {
  renderCategories();
  renderGrid();
}

// ---------- КАРТОЧКА ТОВАРА ----------
function renderProduct(id) {
  const product = getProduct(id);
  const box = $(".js-product");
  if (!product || !box) return false;
  currentProductId = product.id;
  box.textContent = "";

  box.appendChild(makeThumb(product, "market-product-image"));

  const inner = document.createElement("div");
  inner.className = "market-product-inner";

  const cat = document.createElement("span");
  cat.className = "market-badge";
  cat.textContent = product.category;
  inner.appendChild(cat);

  const title = document.createElement("h3");
  title.className = "market-product-title";
  title.textContent = product.title;
  inner.appendChild(title);

  const price = document.createElement("div");
  price.className = "market-product-price";
  price.textContent = fmtPrice(product.price);
  inner.appendChild(price);

  const seller = document.createElement("div");
  seller.className = "market-product-seller";
  seller.textContent = "Продавец: " + product.seller;
  inner.appendChild(seller);

  const desc = document.createElement("div");
  desc.className = "market-product-desc";
  desc.innerHTML = sanitizeHtml(product.description || "");
  inner.appendChild(desc);

  const actions = document.createElement("div");
  actions.className = "market-actions";
  actions.innerHTML =
    '<button class="done-btn" data-act="buy">' +
    '<svg class="icon"><use href="#i-wallet" /></svg><span>Купить</span></button>' +
    '<button class="market-contact" data-act="contact">' +
    '<svg class="icon"><use href="#i-chat" /></svg><span>Написать продавцу</span></button>';
  inner.appendChild(actions);

  box.appendChild(inner);
  return true;
}

// ---------- ДЕЙСТВИЯ ----------
function contactSeller() {
  const product = getProduct(currentProductId);
  if (!product) return;
  const dialogId = startDialog({
    peerName: product.seller,
    subjectTitle: product.title,
  });
  ctx.navigate("#/chats/" + dialogId);
}

async function buyProduct() {
  const product = getProduct(currentProductId);
  if (!product) return;
  const ok = await confirmDialog({
    title: "Купить товар?",
    message:
      product.title +
      " — " +
      fmtPrice(product.price) +
      ". Сумма спишется с баланса Кошелька.",
    confirmText: "Оплатить",
    cancelText: "Отмена",
  });
  if (!ok || !root) return;
  const res = pay({ amount: product.price, purpose: "Покупка: " + product.title });
  if (res.ok) {
    ctx.toast("Оплачено. Остаток: " + fmtPrice(res.balance), "success");
  } else if (res.reason === "insufficient") {
    ctx.toast("Недостаточно средств на балансе", "error");
  } else {
    ctx.toast("Не удалось оплатить", "error");
  }
}

// ---------- ВХОД В ЭКРАНЫ ----------
function enterCatalog() {
  currentProductId = null;
  renderCatalog();
  showView("catalog");
}

function enterProduct(id) {
  if (!renderProduct(id)) {
    ctx.navigate("#/market");
    return;
  }
  showView("product");
  ctx.scrollTop();
}

// ---------- СЛУШАТЕЛИ ----------
function wireEvents() {
  on($(".js-categories"), "click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    currentCategory = chip.getAttribute("data-category") || "Все";
    renderCatalog();
  });

  on($(".js-market-search"), "input", (e) => {
    currentQuery = e.target.value.toLowerCase().trim().slice(0, 100);
    renderGrid();
  });

  // крестик очистки внутри поля поиска
  on($(".js-search-clear"), "click", () => {
    const input = $(".js-market-search");
    if (!input) return;
    input.value = "";
    currentQuery = "";
    renderGrid();
    input.focus();
  });

  on(root, "click", (e) => {
    const actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    const act = actEl.getAttribute("data-act");
    if (act === "home") ctx.navigate("#/");
    else if (act === "goto-catalog") ctx.navigate("#/market");
    else if (act === "contact") contactSeller();
    else if (act === "buy") buyProduct();
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
    // сброс фильтров при входе (модуль живёт между монтированиями)
    currentCategory = "Все";
    currentQuery = "";
    wireEvents();
    this.onRoute(context.subpath || []);
  },

  onRoute(subpath) {
    const seg = subpath[0];
    if (!seg) return enterCatalog();
    return enterProduct(seg);
  },

  unmount() {
    cleanups.splice(0).forEach((fn) => fn());
    if (root) root.innerHTML = "";
    root = null;
    ctx = null;
    currentProductId = null;
  },
};
