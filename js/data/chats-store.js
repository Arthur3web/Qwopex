// ============================================================
// Общее хранилище диалогов чатов.
// Вынесено отдельно, чтобы и «Чаты», и «Объявления» работали с
// одним namespace (qwx:chats) и сидом: Объявления показывают индикатор
// сообщений по объявлению, Чаты — ведут переписку. Бэкенд — позже.
// ============================================================

import { createStorage } from "../sdk.js";

const store = createStorage("chats");

// adId привязывает диалог к объявлению (id из мини-аппа «Объявления»).
export function seedDialogs() {
  const now = Date.now();
  const min = 60 * 1000;
  return [
    {
      id: "d1",
      peerName: "Анна",
      adId: 1,
      adTitle: "Закреплённое объявление",
      unread: 2,
      messages: [
        { id: "m1", fromMe: false, text: "Здравствуйте! Объявление ещё актуально?", ts: now - 60 * min },
        { id: "m2", fromMe: true, text: "Да, актуально", ts: now - 58 * min },
        { id: "m3", fromMe: false, text: "Отлично! А торг уместен?", ts: now - 7 * min },
        { id: "m4", fromMe: false, text: "Готова забрать сегодня", ts: now - 6 * min },
      ],
    },
    {
      id: "d2",
      peerName: "Игорь",
      adId: 2,
      adTitle: "Активное объявление",
      unread: 0,
      messages: [
        { id: "m1", fromMe: false, text: "Добрый день, можно фото получше?", ts: now - 3 * 60 * min },
        { id: "m2", fromMe: true, text: "Конечно, сейчас пришлю", ts: now - 3 * 60 * min + 2 * min },
      ],
    },
    {
      id: "d3",
      peerName: "Поддержка",
      adId: null,
      adTitle: "",
      support: true,
      unread: 0,
      messages: [
        { id: "m1", fromMe: false, text: "Добро пожаловать в Qwopex! Если возникнут вопросы — пишите.", ts: now - 26 * 60 * min },
      ],
    },
  ];
}

// Получить диалоги (с разовым посевом демоданных, чтобы состояние было
// одинаковым, какой бы мини-апп ни открылся первым).
export function getDialogs() {
  let dialogs = store.get("dialogs", null);
  if (!dialogs) {
    dialogs = seedDialogs();
    store.set("dialogs", dialogs);
  }
  return dialogs;
}

export function saveDialogs(dialogs) {
  store.set("dialogs", dialogs);
}

// Создать (или найти существующий) диалог с продавцом по теме — например
// «написать продавцу» из Маркета. Возвращает id диалога для перехода.
export function startDialog({ peerName, subjectTitle }) {
  const dialogs = getDialogs();
  let dialog = dialogs.find(
    (d) => d.peerName === peerName && d.adTitle === (subjectTitle || ""),
  );
  if (!dialog) {
    dialog = {
      id: "d" + Date.now().toString(36),
      peerName: peerName || "Продавец",
      adId: null,
      adTitle: subjectTitle || "",
      unread: 0,
      messages: [],
    };
    dialogs.unshift(dialog);
    saveDialogs(dialogs);
  }
  return dialog.id;
}

// Всего непрочитанных по всем диалогам (для бейджа на лаунчере).
export function totalUnread() {
  return getDialogs().reduce((sum, d) => sum + (d.unread || 0), 0);
}

function lastTs(dialog) {
  const m = dialog.messages[dialog.messages.length - 1];
  return m ? m.ts : 0;
}

// Сводка по объявлению: сколько диалогов, непрочитанных и id самого
// свежего диалога (чтобы открыть его по клику из объявления).
export function adMessageInfo(adId) {
  const list = getDialogs().filter(
    (d) => d.adId != null && String(d.adId) === String(adId),
  );
  let unread = 0;
  let dialogId = null;
  let newest = -1;
  list.forEach((d) => {
    unread += d.unread || 0;
    const ts = lastTs(d);
    if (ts > newest) {
      newest = ts;
      dialogId = d.id;
    }
  });
  return { count: list.length, unread, dialogId };
}
