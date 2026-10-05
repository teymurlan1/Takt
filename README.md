# Такт 5.0 · личный сервис онлайн-записи

Telegram Mini App: [@takt_service_bot](https://t.me/takt_service_bot). Cloudflare Worker + D1, vanilla JS, локальные шрифты Manrope. Синий бренд, яркие лаймовые CTA и выбранные состояния, белые поверхности. No marketplace.

## Сценарии

- Специалист: вертикальная презентация → «Начать работу» → профиль, первая услуга, рабочая неделя → ссылка и клиентский preview.
- Кабинет: Главная / Расписание / Клиенты / Ещё. Услуги, статистика, ссылка и настройки находятся в «Ещё».
- Клиент: ссылка `?startapp=c_<company_id>` → знакомство → только публичная страница приглашавшего специалиста. Меню: Записаться / Мои записи / Профиль. История — вкладка в «Моих записях».
- Обычный `/start master_<id>` или `/start c_<id>` сохраняет параметр в кнопке WebApp. Старые c_nail/c_clean/c_auto ссылки работают.
- Прохождение знакомства сохраняется на сервере по Telegram ID и сценарию; localStorage — резерв при сбое/гостевом просмотре. Источник клиента сохраняется в `client_links`, обычный повторный вход возвращает клиента к последнему специалисту. У действующего специалиста обычный вход открывает его рабочий кабинет; явное приглашение всегда включает клиентский режим.

## Возможности

- Услуги: фото (локальное сжатие в браузере), описание, цена, длительность 15–480 минут с шагом 5 минут, скрытие, порядок (drag/drop и доступные кнопки).
- Рабочие дни с несколькими интервалами и перерывами, часовой пояс специалиста, блокировки часов и отпуска. SQL-триггеры исключают пересечения записей, переносов и блокировок.
- Календарь: день, неделя, месяц; свободные интервалы; ручная запись. Обновление открытого календаря/главной/личных записей каждые 5 секунд, без перезагрузки во время заполнения формы.
- Клиенты: контакты, завершённые визиты, стоимость услуг, ближайший визит, история и личная заметка.
- Ссылка: копирование, системный share/Telegram fallback, QR без стороннего сервиса, preview без создания реальной записи.
- Клиентская запись: услуга → дата/время → контакты → проверка → заявка. Перенос/отмена с проверкой политики на сервере.
- Статусы, уведомления, напоминания за 24 часа через transactional outbox и cron. Для отправки клиент должен разрешить сообщения боту. Ручные клиенты без Telegram не получают Telegram-уведомления.

## Данные и изоляция

`company_id` — tenant ID. Управляющие API требуют членства в `memberships`; SUPERADMIN_IDS не даёт обхода tenant-проверок на этих маршрутах. Администратор платформы отдельно может настроить webhook и явно назначить доступ; эти функции не входят в интерфейс клиента.

- `/api/companies` — только кабинеты пользователя, без публичного списка.
- `/api/companies/:id` — защищённые настройки и все услуги, включая скрытые.
- `/api/v2/page/:id` — намеренно публичная страница для обладателя ссылки, только опубликованные услуги и публичные реквизиты. Это не доступ к рабочему кабинету. Любой обладатель ссылки может посмотреть публичную страницу, в том числе человек, сам работающий специалистом.
- Записи клиента фильтруются по его подписанному Telegram ID. UI дополнительно показывает записи к текущему специалисту.
- Клиенты, заметки, статистика, блокировки, услуги и расписание привязаны к tenant ID и проверяются на сервере. Изменение идентификатора в запросе не даёт доступа.
- Фото — только ограниченный raster data URI, без внешних URL или SVG; токены не хранятся в исходниках.

## Обновление существующей базы

Старые таблицы и записи сохраняются. `src/v2.js` содержит только добавляющие `CREATE ... IF NOT EXISTS`; при первом обращении после обновления Worker применяет их атомарным D1 batch. То же содержимое — `migrations/0002_takt_v2.sql`. Это позволяет обновить ранее созданную вручную базу без повторного исполнения 0001.

Новые service_details расширяют старую схему (описание/фото/порядок/точная длительность), specialist_settings содержит расписание и политику отмены. Legacy service duration остаётся совместимой; новые и старые booking API читают точную длительность через общий серверный helper. Начальные демонстрационные компании сохранены, но не образуют публичного каталога.

Не запускать повторно 0001 на уже заполненной вручную базе. Не добавлять DEV_MODE в Cloudflare.

## Локальная проверка

Node 22.13+:

```sh
npm run dev
npm test
npm run check
```

Открыть http://127.0.0.1:8787. Демоавторизация возможна исключительно на localhost/127.0.0.1 с DEV_MODE=true. Роли: client=9003, company=9002 (локальное членство nail), owner=9001. Для отдельной тестовой базы: `TAKT_TEST_DB=/tmp/takt-test.sqlite npm run dev`.

Серверные тесты: подпись Telegram, сроки, доступ, цены, идемпотентность, пересечения, статусы, два tenant, скрытие услуг, рабочие дни, блокировки, перенос, политика отмены, ручные записи и сохранение onboarding/источника.

## Развёртывание

GitHub main → Cloudflare Workers Builds. `wrangler.jsonc` уже связывает DB с takt_db. BOT_TOKEN и SUPERADMIN_IDS — секреты Cloudflare. Владелец может обновить webhook через «Ещё → Помощь → Обновить настройки бота».

Основной интерфейс: public/app-v2.js, public/takt-v2.css + public/takt-v3.css + public/takt-v4.css + public/takt-v5.css, public/landing.js. Fullscreen/safe-area: public/display.js. public/app.js оставлен как предыдущая реализация и не подключается в index.html.

## Takt 3.0: настройки и короткие ссылки

`specialist_options` хранит профиль, IANA timezone, правила и уведомления. `specialist_handles` хранит уникальные адреса; при переименовании старый адрес остаётся закреплён за прежним кабинетом. Клиентский public API не выдаёт настройки уведомлений.

- «Моя ссылка» → выбрать username: 3–32 символа, латинская буква в начале, далее буквы/цифры/дефисы.
- Рабочий адрес: `https://takt.teymurstudent.workers.dev/<username>`. Worker разрешает имя в tenant; клиент открывает страницу, а при записи вне Telegram — соответствующий Mini App.
- Telegram поддерживает `startapp=u_<username>` и `/start u_<username>`. Старые `c_` и `master_` ссылки сохраняются.
- Для своего домена добавить маршрут Cloudflare и задать `SHORT_LINK_BASE=https://ваш-домен`. Само указание переменной домен не регистрирует и DNS не настраивает. `APP_URL` — опубликованный URL Mini App для кнопок уведомлений. Новые переменные не содержат секретов.
- `run_worker_first: true` позволяет обслуживать короткие маршруты до статических файлов.
- Минимальное время до записи: 0–10080 минут; горизонт 1–180 дней; интервал между клиентами: 0–240 минут; срок отмены/переноса: 0–168 часов. Клиентский перенос можно отключить.
- Интервалы в одном дне упорядочены, не пересекаются, максимум 8. Перерывы — промежутки между ними. Время хранится в UTC; отображение и генерация слотов — в часовом поясе специалиста. Изменение пояса не меняет момент уже созданных встреч.
- INSERT/UPDATE триггеры также защищают промежутки между клиентами при конкурентной записи.
- Дополнение схемы: `migrations/0003_takt_v3.sql` + `src/v3.js`, применяется через существующий `ensureSchema`. Старые данные не пересоздаются и не удаляются; тестовые записи создаются только в отдельной локальной базе.

## Уведомления 3.0

HTML-сообщения экранируют пользовательский текст, выделяют дату/время и открывают конкретную запись. После создания/изменения запись ставится в outbox в той же транзакции. Worker вызывает отправку через `waitUntil`; cron обрабатывает очередь доставки.

Cron `*/5 * * * *` работает независимо от WebApp. При попадании встречи в ближайшие 24 часа создаёт reminder как для pending, так и confirmed. Поздняя запись (менее суток до встречи) получает reminder при ближайшей проверке. Практическая точность — один цикл cron; при сбоях доставка позже. Нужен доступ бота к сообщениям клиента.

Уникальный ключ reminder — `booking_id:reminder:starts_at`; повторный cron не создаёт вторую строку. Атомарный claim исключает параллельную отправку одной строки. Перенос удаляет старое неотправленное напоминание; новый момент получает новый ключ. Перед отправкой проверяются актуальные время/статус/предпочтения. Отмена освобождает слот и отменяет ещё не отправленные reminders. В 4.0 перед сетевым вызовом фиксируется неповторяемая попытка. Если ответ Telegram потерян, автоматического повтора нет: это предотвращает дубликат, но сообщение может остаться недоставленным. Явный отказ Telegram 429/5xx допускает ограниченные повторы. Состояние доставки отображается в настройках. Это не гарантия exactly-once доставки.

Дневная сводка по желанию специалиста: один раз в день, в интервале 08:00–09:00 его часового пояса. Настройки новой записи/отмены/переноса управляют сообщениями специалисту; клиент получает подтверждение действий. Переключатель reminders относится к напоминаниям клиентам.

## Проверки и ограничения

`npm test` включает существующие тесты и `test/v3.test.mjs`: timezone/DST, перерывы, валидация и изоляция настроек, короткие ссылки/алиасы, SQL-защита слотов и буфера, повторный cron, перенос/отмена напоминаний, настройки уведомлений, сводка и ближайшая свободная дата. Telegram в тестах замокан: реальные сообщения не отправляются.

Один одновременно обслуживаемый клиент/ресурс на кабинет. Журнал и UI-статистика показывают последние 500 записей; суммы — стоимость услуг, не подтверждённые платежи. Онлайн-оплаты и команды сотрудников не входят в эту версию. Физические iOS/Android устройства требуют smoke-test владельцем: адаптивная браузерная проверка не заменяет проверку Telegram WebView и клавиатуры на устройстве.

QR: qrcode-generator 1.4.4, MIT (public/qr-LICENSE). Шрифт Manrope — OFL (public/fonts/OFL.txt).

## Takt 4.0

Синий бренд и лаймовые CTA: `public/takt-v4.css`. Обработчик `public/mobile.js` объединяет visualViewport, Telegram viewport и фокус полей; скрывает нижнюю навигацию при вводе, удерживает активное поле в видимой области и адаптирует bottom sheets. Нужна отдельная проверка настоящей клавиатуры в Telegram iOS/Android.

Календарь записи получает агрегированную доступность дат через `/api/availability`; финальная запись по-прежнему проверяется на сервере и защищена SQL-триггерами. Существующие контакты клиента подставляются только из его записей у этого специалиста. Ручная запись начинается с выбора/создания клиента. Расписание можно копировать между днями; исключения поддерживают целые дни и отпуск.

Опциональное уведомление мастеру за час — настройка `master_reminder`, по умолчанию выключена. Клиентские 24-часовые напоминания и утренняя сводка работают на прежнем cron. `/api/v4/delivery` выдаёт только агрегированное состояние сообщений текущему специалисту. Таблицы из `0004_takt_v4.sql` создаются существующим additive ensureSchema. Повторные webhook update_id игнорируются.

Проверки 4.0: 32 backend-теста; функциональная DOM-проверка регистрации мастера, изолированного preview, копирования расписания, ручной записи, первого/повторного клиента, переноса и отмены. Локальный Chromium в среде выполнения заблокирован политикой; DOM-проверка не подтверждает визуальную вёрстку или поведение настоящей мобильной клавиатуры.


## Takt 5.0: релиз уведомлений и контроль сервиса

- Основные клиентские/мастерские уведомления включены по умолчанию. Сохранённые пользователем выключенные настройки остаются выключенными. Дополнительные утренняя сводка и напоминание за час остаются опциональными.
- Серверный cron каждую минуту создаёт напоминания клиенту за 24 и 2 часа, мастеру за 2 часа; для записи, созданной позже соответствующего порога, запоздалое напоминание не создаётся. Подтверждение отправляется после записи.
- Итоги дня по умолчанию в 20:00 по IANA timezone специалиста; время и выключатель — в «Настройки → Уведомления». Доход считается по завершённым визитам. В сообщении есть записи завтра и первая встреча.
- Генерация ограничена 4 новыми событиями, отправка — 3 сообщениями за вызов, чтобы сохранять запас D1-запросов. Обработка вызывается после записи/переноса/отмены и по cron. При очереди возможна дополнительная задержка; рост нагрузки требует наблюдения за очередью и настройки инфраструктурного лимита, а не обещания неограниченной пропускной способности.
- Event ID содержит запись, тип события, время и получателя. Перед отправкой снова проверяются время, статус и предпочтения. Старые напоминания после переноса/отмены пропускаются. Явные 429/5xx повторяются с задержкой, до 5 попыток. Неопределённый сетевой исход не повторяется автоматически: у Telegram sendMessage нет ключа идемпотентности.
- `requestWriteAccess` вызывается при знакомстве/записи. Telegram запрашивает системное разрешение только у пользователя. `/start` или разрешение возобновляет ранее явно заблокированные сообщения за последние сутки; неоднозначные отправки не повторяются.
- «Открыть Takt» имеет primary-стиль inline-кнопки; стандартное меню Telegram обновляется однократно сервером, его цвет определяет клиент Telegram.
- Админка `/?view=admin`, API `/api/v5/admin`: только подписанный Telegram ID из SUPERADMIN_IDS. Общие количества, активность, новые кабинеты после обновления, статусы очереди, обезличенные коды ошибок, состояние фоновых задач. Персональные данные чужих клиентов не выдаются.
- Таблицы `0005_takt_v5.sql` добавляются без изменения пользовательских данных. Маркер schema_versions исключает повторные DDL при каждом холодном старте.

Проверено: 38 серверных тестов (подпись/роли/изоляция/SQL-защита от пересечений, уведомления с моделированием времени и ответов Telegram, перенос/отмена/повторы, часовые пояса, контроль доступа), функциональные DOM-сценарии интерфейса и синтаксис JS. Реальный Telegram-клиент, физическая мобильная клавиатура и фактическая доставка личных сообщений требуют проверки на устройствах; тесты не отправляют сообщения реальным клиентам.



## Takt 10.0

This release extends the existing application and database. Existing tenant IDs, bookings, subscriptions, reviews and saved language/theme preferences are retained. The runtime applies only the additive v10 schema when the v9 marker exists; it does not rerun older preference migrations.

- Shared brand tokens retain the reference “Написать” color `#c9ff32`; compact booking, service, profile and review layouts adapt to phone, tablet and desktop.
- Searchable select sheets preserve unsaved forms and close through Telegram Back. Client services appear immediately after the specialist header.
- Self-service cancellation requires strictly more than the configured cutoff (24 hours by default), checked on the server. Existing specialist rescheduling rules are preserved separately.
- First Telegram entry collects language and versioned document consent, preserving the invited specialist throughout. New accounts default to light theme.
- Manual bookings notify known invited clients; unknown contacts can still be booked. No-show outcomes are separate from attendance and excluded from revenue and reviews.
- The main administrator can manage validated service configuration, tariff, language availability, document links/versions, optional feature flags, access controls and subscription extensions. Changes are audited; broadcast preview sends nothing and confirmation queues deduplicated deliveries.
- Live Telegram booking messages retain message IDs. Temporary edit failures retry editing rather than sending a duplicate. Ambiguous initial send outcomes remain flagged for operational review instead of being blindly resent.

Validation: `npm run check`, 91 automated tests, and functional DOM checks at widths 320, 390, 768, 1024 and 1440. Telegram delivery is mocked in automated tests. DOM checks do not certify physical iPhone/Android keyboard behavior or visual rendering in Telegram WebView; these require a device check. Existing payment integration via `SUBSCRIPTION_PAYMENT_URL` is preserved; this release does not add a payment provider or automatic billing.


## Takt 12.0

The existing Worker/D1 architecture and data are preserved. Migration 0012 adds optional per-language service and public-profile content with fallback to the original fields. Supported UI languages: Russian, Kazakh, Azerbaijani and Uzbek. Review bodies and author names remain user content; the Control Center stays Russian.

Theme tokens now cover legacy surfaces, dialogs, calendars and nested cards. Responsive layouts keep equal-size calendar dates, aligned service media slots and compact client/history cards. Review ordering is applied on the server before its bounded result limit. Distant dates distinguish the booking horizon from unavailable slots.

Subscriptions use manual renewal: the configured support username (or the owner's saved Telegram username) must identify a personal account, not a bot. Renewal period is included in the prepared Telegram message. Payment and promo backend capabilities remain compatible but are not presented as automatic payment in the user subscription screen.

Validation: `npm run check`, `npm test`, `npm run test:ui`. DOM coverage includes all four languages, light/dark state, roles and widths from 320 to 1440. DOM tests do not establish native keyboard behavior or visual geometry on physical devices. Real iPhone, Android and Telegram tablet keyboard/orientation checks remain necessary before claiming device certification.
