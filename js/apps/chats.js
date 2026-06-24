// ============================================================
// Мини-апп «Чаты» — заглушка.
// Здесь будут диалоги по объявлениям; пока пустое состояние.
// ============================================================

let root = null;

export default {
  mount(mountRoot, ctx) {
    root = mountRoot;
    root.innerHTML = `
      <section class="page mini active">
        <div class="mini-header">
          <button class="icon-btn back-btn" data-act="home" aria-label="Назад">
            <svg class="icon"><use href="#i-arrow-left" /></svg>
          </button>
          <h2>Чаты</h2>
        </div>
        <div class="mini-body">
          <div class="empty">
            <svg class="icon" style="width:40px;height:40px;opacity:.5"><use href="#i-chat" /></svg>
            <p>Пока нет сообщений</p>
          </div>
          <div class="placeholder-note">
            <p>Переписка с покупателями по объявлениям — в разработке.</p>
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
