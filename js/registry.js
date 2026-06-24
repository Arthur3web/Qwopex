// ============================================================
// Реестр мини-аппов супераппа.
// Каждый мини-апп — отдельный ES-модуль, грузится лениво через
// dynamic import() только когда пользователь его открывает.
//
// Контракт модуля (default export):
//   {
//     mount(root, ctx)   — отрисовать UI в root; ctx = SDK-контекст
//     unmount()          — очистить (снять слушатели/таймеры)
//     onRoute(subpath)?  — необязательно: реакция на под-маршрут
//                          без полного ремоунта (массив сегментов)
//   }
// ============================================================

export const REGISTRY = [
  {
    id: "ads",
    title: "Объявления",
    icon: "#i-logo",
    color: "#7aa2ff",
    description: "Ваши публикации",
    load: () => import("./apps/ads.js"),
  },
  {
    id: "wallet",
    title: "Кошелёк",
    icon: "#i-wallet",
    color: "#00d68f",
    description: "Баланс и платежи",
    load: () => import("./apps/wallet.js"),
  },
  {
    id: "chats",
    title: "Чаты",
    icon: "#i-chat",
    color: "#ff9f0a",
    description: "Сообщения",
    load: () => import("./apps/chats.js"),
  },
  {
    id: "market",
    title: "Маркет",
    icon: "#i-market",
    color: "#ff5d8f",
    description: "Каталог товаров",
    load: () => import("./apps/market.js"),
  },
];

export function getApp(id) {
  return REGISTRY.find((a) => a.id === id) || null;
}
