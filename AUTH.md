# Авторизация через Telegram — как подключить бота

Памятка-инструкция: что нужно, как это работает и какие шаги пройти,
чтобы заменить demo-вход на настоящий вход через Telegram.

Фронт уже готов: сессия хранится в `localStorage`, шелл показывает
логин-экран, когда сессии нет (`auth.getUser() === null`), а в дев-режиме
есть кнопка «Войти как demo». Осталась серверная часть — её этот документ
и описывает.

---

## 1. Что тебе понадобится (чек-лист)

- [ ] **Telegram-бот** и его **токен** — создаётся за минуту у [@BotFather](https://t.me/BotFather).
- [ ] **Домен с HTTPS** — Telegram Login Widget работает **только** на домене,
      который ты явно привязал к боту (`/setdomain`). На `file://` и на «голом»
      `localhost` виджет не запустится — нужен https-домен (или туннель, см. §6).
- [ ] **Бэкенд на Node LTS** (или Go) — место, где проверять подпись.
      ⚠️ Node v10 в текущем окружении не подойдёт (нет ESM/современного синтаксиса) —
      нужен Node 18+.
- [ ] 15 минут.

> **Главное правило безопасности:** токен бота живёт **только на сервере**.
> Никогда не клади его во фронт — им подписываются данные, и любой, у кого он есть,
> сможет подделать вход.

---

## 2. Как это работает (поток за 5 строк)

```
1. Пользователь жмёт кнопку Telegram на логин-экране (виджет telegram.org).
2. Telegram возвращает в браузер объект user: { id, first_name, username,
   photo_url, auth_date, hash }.
3. Фронт шлёт этот объект на твой бэкенд: POST /api/auth/telegram.
4. Бэкенд проверяет hash по HMAC-SHA256 с секретом = SHA256(токен бота).
   Совпало и данные свежие → это действительно Telegram, не подделка.
5. Бэкенд выдаёт сессию (httpOnly-cookie или JWT) и возвращает данные юзера.
   Фронт делает auth.saveUser(user) → шелл пускает в приложение.
```

Подпись — это весь смысл. Без неё клиент мог бы прислать любой `id` и
притвориться кем угодно. HMAC доказывает, что данные пришли от Telegram,
потому что подделать его без токена бота невозможно.

---

## 3. Шаг за шагом

### Шаг 1. Создать бота и получить токен

1. Открой [@BotFather](https://t.me/BotFather) → команда `/newbot`.
2. Задай имя и `username` (должен заканчиваться на `bot`, напр. `qwopex_login_bot`).
3. BotFather пришлёт **токен** вида `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxx`.
   Сохрани его в секрет (переменная окружения на сервере, **не в git**).

### Шаг 2. Привязать домен к боту (без этого виджет не появится)

В @BotFather: `/setdomain` → выбрать бота → отправить домен, где живёт фронт
(напр. `qwopex.example.com`). Один бот — один домен.

### Шаг 3. Включить виджет на фронте

В [js/app.js](js/app.js) в функции `renderLogin()` уже есть закомментированный
блок виджета. Раскомментируй его, подставь `data-telegram-login` = username бота
**без @**. Сейчас контейнер `<div id="telegram-login"></div>` пустой — виджет
сам отрисует в него кнопку. Вместо инлайн-скрипта (его блокирует CSP) удобнее
вставлять `<script>` динамически и завести глобальный колбэк:

```js
// в renderLogin(), вместо demo-кнопки на проде:
window.onTelegramAuth = async (tgUser) => {
  try {
    const res = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",           // чтобы пришла httpOnly-cookie
      body: JSON.stringify(tgUser),
    });
    if (!res.ok) throw new Error("auth-failed");
    const user = await res.json();      // бэкенд вернул проверенного юзера
    auth.saveUser(user);
    route();                            // сессия есть → шелл пускает внутрь
  } catch (e) {
    toast("Не удалось войти", "error");
  }
};

const s = document.createElement("script");
s.async = true;
s.src = "https://telegram.org/js/telegram-widget.js?22";
s.setAttribute("data-telegram-login", TG_BOT_USERNAME); // username без @
s.setAttribute("data-size", "large");
s.setAttribute("data-onauth", "onTelegramAuth(user)");
s.setAttribute("data-request-access", "write");
document.getElementById("telegram-login").appendChild(s);
```

CSP это уже разрешает: в [index.html](index.html) есть
`script-src https://telegram.org` и `frame-src https://oauth.telegram.org`.

### Шаг 4. Бэкенд: проверка подписи (`POST /api/auth/telegram`)

Алгоритм проверки (одинаков для любого языка):

1. Из тела убрать поле `hash`, остальные пары `key=value` отсортировать по ключу
   и склеить через `\n` — это **data-check-string**.
2. Секрет = `SHA256(токен бота)` (бинарный digest, не hex).
3. Посчитать `HMAC-SHA256(data-check-string, секрет)` в hex.
4. Сравнить с присланным `hash` (постоянным по времени сравнением).
5. Проверить свежесть: `auth_date` не старше, скажем, 24 часов — защита от replay.

Пример на Node 18+ (Express):

```js
import crypto from "node:crypto";

const BOT_TOKEN = process.env.TG_BOT_TOKEN;          // только из окружения!
const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest();

app.post("/api/auth/telegram", express.json(), (req, res) => {
  const { hash, ...data } = req.body;

  const checkString = Object.keys(data).sort()
    .map((k) => `${k}=${data[k]}`).join("\n");

  const hmac = crypto.createHmac("sha256", secret)
    .update(checkString).digest("hex");

  const a = Buffer.from(hmac);
  const b = Buffer.from(String(hash || ""));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: "bad-signature" });

  if (Date.now() / 1000 - Number(data.auth_date) > 86400) {
    return res.status(401).json({ error: "expired" });
  }

  // Здесь: найти/создать пользователя в БД по data.id, подгрузить баланс и т.п.
  // Выдать сессию. Вариант с httpOnly-cookie:
  res.cookie("session", makeSessionToken(data.id), {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 30 * 864e5,
  });

  res.json({
    id: data.id,
    first_name: data.first_name,
    username: data.username || "",
    photo_url: data.photo_url || "",
    // registered/balance/bonus — из твоей БД
  });
});
```

Форма ответа должна совпасть с тем, что ждёт фронт (`auth.saveUser`) и
отрисовывает лаунчер: `{ id, first_name, username, photo_url, registered,
balance, bonus }` — см. `FAKE_USER` в [js/sdk.js](js/sdk.js) как образец.

### Шаг 5. Защитить API и проверять сессию

- Эндпоинты данных (`/api/ads` и т.д.) читают cookie/JWT и отвергают
  неавторизованных (`401`).
- Фронтовые `fetch` к API — с `credentials: "include"`.
- В [sw.js](sw.js) запросы `/api/*` уже идут network-only — кэш сессию не сломает.

### Шаг 6. Выключить dev-режим

В [js/sdk.js](js/sdk.js) поставить `export const DEV = false;` — пропадёт кнопка
«Войти как demo», единственным входом станет Telegram. `logout()` уже чистит
сессию; добавь на бэке `POST /api/auth/logout`, который гасит cookie.

---

## 4. Что менять в CSP (если API на другом домене)

Сейчас `connect-src 'self'` — фронт ходит только на свой origin. Если бэкенд
будет на отдельном домене (напр. `api.qwopex.example.com`), допиши его в
`connect-src` в [index.html](index.html):

```
connect-src 'self' https://api.qwopex.example.com;
```

Скрипт/фрейм Telegram уже разрешены — их трогать не нужно.

---

## 5. Контракт «фронт ↔ бэкенд» (коротко)

| Что | Значение |
|---|---|
| Запрос | `POST /api/auth/telegram`, тело — объект `user` от виджета |
| Успех | `200` + JSON пользователя + httpOnly-cookie сессии |
| Ошибка подписи | `401 { error: "bad-signature" }` |
| Просрочка | `401 { error: "expired" }` |
| Фронт при успехе | `auth.saveUser(user)` → `route()` |
| Выключатель demo | `DEV` в [js/sdk.js](js/sdk.js) |

---

## 6. Как попробовать локально

Telegram Login требует **публичный https-домен** (на `localhost` виджет
не работает). Самый простой способ потренироваться:

1. Подними бэкенд на Node 18+ локально (напр. порт 3000).
2. Прокинь наружу туннелем — `cloudflared tunnel --url http://localhost:3000`
   или `ngrok http 3000` — получишь временный https-домен.
3. Этот домен укажи боту через `/setdomain` и открой по нему фронт.
4. Жми кнопку Telegram → смотри, что `POST /api/auth/telegram` проходит
   проверку и возвращает юзера.

> На этом этапе локальный Node v10 не годится — нужен Node LTS (18/20).
> Это же требуется и для тулчейна из Этапа 7 ROADMAP (ESLint/Prettier).

---

## Памятка по безопасности

- Токен бота — **только на сервере**, в переменной окружения, не в git.
- Сравнивай hash **постоянным по времени** сравнением (`timingSafeEqual`).
- Проверяй `auth_date` — отсекай старые данные (replay-атаки).
- Сессия — **httpOnly + Secure + SameSite**, чтобы её не достал JS/CSRF.
- Никогда не доверяй `id`/балансу из тела запроса напрямую — баланс и профиль
  бери из своей БД по проверенному `id`, а не из того, что прислал клиент.
