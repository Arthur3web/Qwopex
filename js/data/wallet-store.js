// ============================================================
// Общий стор Кошелька — единый источник баланса и операций.
// Используется: мини-апп «Кошелёк» (баланс + история, пополнение),
// «Маркет» (оплата покупки), шелл (баланс на лаунчере).
// Платёжный слой: pay()/topUp() меняют баланс и пишут операцию.
// Данные локальные (localStorage), позже — бэкенд/провайдер.
// ============================================================

import { createStorage } from "../sdk.js";

const store = createStorage("wallet");

function seedState() {
  const now = Date.now();
  const day = 86400000;
  return {
    balance: 1200,
    bonus: 600.75,
    operations: [
      { id: "o1", type: "credit", amount: 1000, purpose: "Пополнение", ts: now - 6 * day },
      { id: "o2", type: "credit", amount: 500, purpose: "Бонус за регистрацию", ts: now - 6 * day },
      { id: "o3", type: "debit", amount: 300, purpose: "Продвижение объявления", ts: now - 2 * day },
    ],
  };
}

export function getState() {
  let state = store.get("state", null);
  if (!state) {
    state = seedState();
    store.set("state", state);
  }
  return state;
}

function save(state) {
  store.set("state", state);
}

function addOperation(state, op) {
  state.operations.unshift({
    id: "o" + Date.now().toString(36),
    ts: Date.now(),
    ...op,
  });
}

// Списание (оплата). Возвращает { ok, reason?, balance }.
export function pay({ amount, purpose }) {
  const state = getState();
  const sum = Math.round(Number(amount) || 0);
  if (sum <= 0) return { ok: false, reason: "bad-amount", balance: state.balance };
  if (state.balance < sum) {
    return { ok: false, reason: "insufficient", balance: state.balance };
  }
  state.balance -= sum;
  addOperation(state, { type: "debit", amount: sum, purpose: purpose || "Покупка" });
  save(state);
  return { ok: true, balance: state.balance };
}

// Пополнение. Возвращает { ok, balance }.
export function topUp({ amount, purpose }) {
  const state = getState();
  const sum = Math.round(Number(amount) || 0);
  if (sum <= 0) return { ok: false, reason: "bad-amount", balance: state.balance };
  state.balance += sum;
  addOperation(state, { type: "credit", amount: sum, purpose: purpose || "Пополнение" });
  save(state);
  return { ok: true, balance: state.balance };
}
