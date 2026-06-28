// ============================================================
// Мини-апп «Кошелёк».
// Баланс + бонусы + история операций. Пополнение — демо (мок).
// Платежи (списания) приходят из других мини-аппов через wallet-store.
// ============================================================

import { getState, topUp } from "../data/wallet-store.js";

let root = null;
let ctx = null;
const cleanups = [];

const $ = (sel) => root.querySelector(sel);
function on(target, type, fn) {
  if (!target) return;
  target.addEventListener(type, fn);
  cleanups.push(() => target.removeEventListener(type, fn));
}

function fmtMoney(n) {
  return Number(n).toLocaleString("ru-RU");
}

function fmtDate(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return dd + "." + mm + " " + hh + ":" + mi;
}

const TEMPLATE = `
  <section class="page mini active">
    <div class="mini-header">
      <button class="icon-btn back-btn" data-act="home" aria-label="Назад">
        <svg class="icon"><use href="#i-arrow-left" /></svg>
      </button>
      <h2>Кошелёк</h2>
    </div>
    <div class="wallet-body">
      <div class="wallet-card">
        <div class="wallet-label">Баланс</div>
        <div class="wallet-balance js-balance"></div>
        <div class="wallet-bonus js-bonus"></div>
        <div class="wallet-card-actions">
          <button class="wallet-btn primary" data-act="topup">
            <svg class="icon"><use href="#i-plus" /></svg><span>Пополнить</span>
          </button>
          <button class="wallet-btn" data-act="withdraw">Вывести</button>
        </div>
      </div>

      <div class="wallet-history">
        <div class="wallet-history-title">История операций</div>
        <div class="wallet-ops js-ops"></div>
      </div>
    </div>
  </section>
`;

function renderBalance() {
  const state = getState();
  const balEl = $(".js-balance");
  const bonusEl = $(".js-bonus");
  if (balEl) balEl.textContent = fmtMoney(state.balance) + " ₽";
  if (bonusEl) bonusEl.textContent = "+" + fmtMoney(state.bonus) + " ₽";
}

function renderOps() {
  const box = $(".js-ops");
  if (!box) return;
  const state = getState();
  box.textContent = "";

  if (!state.operations.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Операций пока нет";
    box.appendChild(empty);
    return;
  }

  state.operations.forEach((op) => {
    const row = document.createElement("div");
    row.className = "wallet-op";

    const info = document.createElement("div");
    info.className = "wallet-op-info";
    const purpose = document.createElement("div");
    purpose.className = "wallet-op-purpose";
    purpose.textContent = op.purpose;
    const date = document.createElement("div");
    date.className = "wallet-op-date";
    date.textContent = fmtDate(op.ts);
    info.appendChild(purpose);
    info.appendChild(date);

    const amount = document.createElement("div");
    amount.className = "wallet-op-amount " + (op.type === "credit" ? "credit" : "debit");
    amount.textContent =
      (op.type === "credit" ? "+" : "−") + fmtMoney(op.amount) + " ₽";

    row.appendChild(info);
    row.appendChild(amount);
    box.appendChild(row);
  });
}

function refresh() {
  renderBalance();
  renderOps();
}

export default {
  mount(mountRoot, context) {
    root = mountRoot;
    ctx = context;
    root.innerHTML = TEMPLATE;
    refresh();

    on(root, "click", (e) => {
      const actEl = e.target.closest("[data-act]");
      if (!actEl) return;
      const act = actEl.getAttribute("data-act");
      if (act === "home") {
        ctx.navigate("#/");
      } else if (act === "topup") {
        // демо-пополнение фиксированной суммой
        topUp({ amount: 1000, purpose: "Пополнение" });
        refresh();
        ctx.toast("Баланс пополнен на 1 000 ₽", "success");
      } else if (act === "withdraw") {
        ctx.toast("Вывод средств скоро будет доступен", "info");
      }
    });
  },

  unmount() {
    cleanups.splice(0).forEach((fn) => fn());
    if (root) root.innerHTML = "";
    root = null;
    ctx = null;
  },
};
