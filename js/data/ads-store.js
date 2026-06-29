// ============================================================
// Общий стор «Объявлений» — единый источник публикаций.
// Используется мини-аппом «Объявления» и шеллом (счётчики на лаунчере),
// чтобы статистика была верной сразу после загрузки, без монтирования
// мини-аппа. Данные локальные (localStorage), позже — бэкенд.
// ============================================================

import { createStorage } from "../sdk.js";

const store = createStorage("ads");

// Демоданные (потом заменить на загрузку с бэкенда)
export const SEED = [
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

export function getPosts() {
  let posts = store.get("posts", null);
  if (!posts) {
    posts = SEED.map((p) => ({ ...p }));
    store.set("posts", posts);
  }
  return posts;
}

export function savePosts(posts) {
  store.set("posts", posts);
}

// Намерение открыть список с фильтром (напр. клик «На модерации» на лаунчере).
// Берётся один раз при входе в мини-апп и сбрасывается.
let pendingFilter = null;
export function setPendingFilter(filter) {
  pendingFilter = filter;
}
export function takePendingFilter() {
  const f = pendingFilter;
  pendingFilter = null;
  return f;
}

// Черновик объявления из Share Target (расшаренные текст/ссылка).
// Заполняет форму создания при входе в неё.
let adDraft = null;
export function setAdDraft(draft) {
  adDraft = draft;
}
export function takeAdDraft() {
  const d = adDraft;
  adDraft = null;
  return d;
}

// Счётчики для фильтров и лаунчера.
export function counts() {
  const posts = getPosts();
  return {
    all: posts.length,
    active: posts.filter((p) => p.status === "active").length,
    moderation: posts.filter((p) => p.status === "moderation").length,
    pinned: posts.filter((p) => p.pinned).length,
  };
}
