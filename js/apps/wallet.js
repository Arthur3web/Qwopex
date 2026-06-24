// ============================================================
// Мини-апп «Кошелёк» — заглушка.
// Показывает баланс/бонусы пользователя из ctx; платежи — TODO.
// ============================================================

let root = null;

export default {
  mount(mountRoot, ctx) {
    root = mountRoot;
    const u = ctx.user || {};
    const balance = (u.balance ?? 0).toLocaleString("ru-RU");
    const bonus = (u.bonus ?? 0).toLocaleString("ru-RU");

    root.innerHTML = `
      <section class="page mini active">
        <div class="mini-header">
          <button class="icon-btn back-btn" data-act="home" aria-label="Назад">
            <svg class="icon"><use href="#i-arrow-left" /></svg>
          </button>
          <h2>Кошелёк</h2>
        </div>
        <div class="mini-body">
          <div class="wallet-card">
            <div class="wallet-label">Баланс</div>
            <div class="wallet-balance">${balance} ₽</div>
            <div class="wallet-bonus">+${bonus} ₽ бонусами</div>
          </div>
          <div class="placeholder-note">
            <p>Пополнение, вывод и история операций — в разработке.</p>
          </div>
        </div>
      </section>
    `;

    this._onClick = (e) => {
      if (e.target.closest('[data-act="home"]')) ctx.navigate("#/");
    };
    root.addEventListener("click", this._onClick);
  },

  unmount() {
    if (root && this._onClick) root.removeEventListener("click", this._onClick);
    if (root) root.innerHTML = "";
    root = null;
  },
};
