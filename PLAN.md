# План робіт

Позначати виконане: `- [x]`. Етапи робити по порядку, один етап — один коміт.

## Частина А. Власний макет сповіщення-нагадування на Android

**Мета.** Нагадування на телефоні має виглядати як власна картка застосунку, а не як
стандартне сповіщення Android: свій фон, кольори категорії, текст і кнопки.

**Обмеження.** На Android 12+ система завжди лишає зверху вузький рядок з іконкою та
назвою застосунку. Усе під ним — наш макет.

**Чому нативний код.** Зараз нагадування шле `@tauri-apps/plugin-notification`
(`src/lib/reminders.ts`, функція `deliver`). Він не підтримує власний макет, тому для
Android потрібен свій Kotlin-код. iOS і комп'ютер лишаються на старому шляху.

Перед етапом 2 звіритися з документацією Tauri 2 «Mobile plugin development»:
назви API нижче — підказки, а не гарантія.

### Етап 0. Прибрати зайві картки
- [x] `src/App.tsx`: у `handleSaveTask` і `handleDeleteTask` видалити `toast.success`
      і `toast.info`, лишити тільки `toast.error`.

### Етап 1. Макет (тільки XML, без логіки)
- [x] `res/layout/notification_reminder_small.xml` — згорнутий вигляд, висота до 48dp:
      кружок кольору категорії з емодзі, назва задачі жирним,
      рядок «Через 15 хв · 18:00–19:00».
- [x] `res/layout/notification_reminder_big.xml` — розгорнутий, до 256dp:
      те саме + деталі задачі (до 3 рядків) + кнопки «Виконано» і «Відкласти на 10 хв».
- [x] Кольори тексту й фону — у `res/values/colors.xml` і `res/values-night/colors.xml`.
- [x] Показати прев'ю обох макетів і дочекатися підтвердження.

Підказки: RemoteViews підтримує лише `LinearLayout`, `RelativeLayout`, `FrameLayout`,
`TextView`, `ImageView`, `Button`. Без `ConstraintLayout` і власних View.
Кольори категорій узяти з `CATEGORY_COLORS` у `src/lib/reminderPlan.ts`.

### Етап 2. Нативний плагін `reminders`
- [x] `RemindersPlugin.kt` у `gen/android/app/src/main/java/com/planuvalnyk/app/`
      (клас `Plugin` з `@TauriPlugin`, методи з `@Command`): `schedule` і `cancelAll`.
- [x] `schedule` зберігає список у `SharedPreferences` і ставить будильники
      `AlarmManager.setExactAndAllowWhileIdle` на `ReminderReceiver`.
      Якщо `canScheduleExactAlarms()` повертає `false` — `setAndAllowWhileIdle`.
      Спільна логіка — `ReminderAlarms.kt`; `ReminderReceiver.kt` поки заглушка (етап 3).
- [x] Реєстрація в `src-tauri/src/lib.rs`: `tauri::plugin::Builder::new("reminders")`
      з `register_android_plugin("com.planuvalnyk.app", "RemindersPlugin")`
      під `#[cfg(target_os = "android")]`.
- [x] Дозволи команд: `InlinedPlugin` у `src-tauri/build.rs` і `"reminders:default"`
      у `src-tauri/capabilities/default.json`.

Поля одного нагадування: `id`, `whenMs`, `title`, `body`, `details`, `color`, `emoji`,
`silent`, `channelId`, `date`, `taskId`.

### Етап 3. Показ сповіщення
- [x] `ReminderReceiver.kt` (`BroadcastReceiver`): `NotificationCompat.Builder` з
      `setSmallIcon(R.drawable.ic_notification)`, `setColor`, 
      `setStyle(DecoratedCustomViewStyle())`, `setCustomContentView`,
      `setCustomBigContentView`, `setContentIntent` → `MainActivity` з `extra date`.
- [x] `AndroidManifest.xml`: `<receiver>` для `ReminderReceiver`, дозвіл
      `POST_NOTIFICATIONS`, якщо його немає.

Підказка: канали вже створює JS (`planner-v2-full`, `planner-v2-sound`,
`planner-v2-silent`), брати `channelId` з нагадування.

### Етап 4. Підключення з JS
- [x] `src/lib/reminders.ts`: на Android замість `sendNotification` викликати
      `invoke("plugin:reminders|schedule", { reminders })` один раз на весь план,
      замість `cancelAll()` — `invoke("plugin:reminders|cancel_all")`.
      Поля `emoji`, `details`, `taskId` додано в план (`reminderPlan.ts`).
- [x] `sendTestNotification` перевести на той самий шлях
      (тест додається до чинного плану, бо `schedule` замінює план цілком).
- [x] Дозвіл на сповіщення й створення каналів лишити через плагін Tauri.

### Етап 5. Кнопки
- [ ] «Відкласти на 10 хв»: `ReminderActionReceiver.kt` закриває сповіщення і ставить
      той самий будильник на +10 хв. Застосунок не відкривається.
      Відкладене нагадування переживає нове планування з JS.
      **На телефоні повтор прийшов лише при відкритті застосунку — чекаємо лог Logcat.**
- [x] «Виконано»: закрити сповіщення, записати `taskId` у чергу в `SharedPreferences`.
      Заодно знімаються інші будильники цієї задачі; без `taskId` кнопки немає.
      Одразу пробує записати `done=true` в Supabase (`ReminderSync.kt`, токен від JS
      через `set_auth`); прострочений токен або немає мережі — лишається в черзі.
- [x] Команди плагіна `pendingDone()` (віддає чергу) і `ackDone(taskIds)` (прибирає лише
      записане в базу). `App.tsx` обробляє чергу при старті й при поверненні
      (`visibilitychange` + `tauri://resumed`), позначає через `toggleScheduledTask`,
      перечитує день і лише потім перепланує нагадування.

Підказка: кнопки в RemoteViews — `setOnClickPendingIntent`, `PendingIntent` з
`FLAG_IMMUTABLE` і унікальним `requestCode` на кожне сповіщення й кожну кнопку.

### Етап 6. Після перезавантаження телефона
- [ ] `BootReceiver.kt` + дозвіл `RECEIVE_BOOT_COMPLETED`: прочитати список із
      `SharedPreferences` і заново поставити всі майбутні будильники.

### Етап 7 (необов'язково, тільки після підтвердження). Повноекранне нагадування
**Пропущено** — рішення власника, не робимо.
- [ ] ~~Окрема `Activity` з власним дизайном поверх екрана блокування через
      `setFullScreenIntent`.~~ На Android 14+ потрібен дозвіл `USE_FULL_SCREEN_INTENT`,
      ~~який користувач вмикає вручну.~~

### Перевірка частини А
- [ ] Тестове сповіщення: застосунок відкритий, згорнутий, закритий зі списку.
- [ ] Заблокований екран, темна тема, тихі години (без звуку).
- [ ] «Відкласти» і «Виконано» при закритому застосунку.
- [ ] Перезавантажити телефон і дочекатися нагадування.

## Частина Б. Інші покращення (після частини А)

- [ ] **Прибрати `.patch`-файли з репозиторію.** `git rm` обох файлів у корені,
      додати `*.patch` у `.gitignore`.
- [ ] **Оновити README.** Android-збірка, нагадування, налаштування, міграції.
- [ ] **Задачі дня без часу в ранковому плані.** `fetchTasks` у `reminders.ts` додатково
      читає невиконані задачі дня (таблицю див. у `supabase/schema.sql`), `buildPlan`
      додає їх у блок `morning`.
- [ ] **Відкривати потрібний день після натискання на сповіщення.** `MainActivity`
      отримує `extra date`, передає в JS, `App.tsx` викликає `setActiveDate`.
- [ ] **Темна тема.** Кольори в `tailwind.config.js` перевести на
      `rgb(var(--c-…) / <alpha-value>)`, `darkMode: "class"`, змінні в `src/index.css`,
      поле `theme` у `settings.ts`. Знайти жорстко задані `bg-white`, `bg-red-50`,
      `text-green-700`, `bg-black/30`.
- [ ] **Повторювані задачі.** У `AddTaskModal.tsx` «Повторювати щотижня до дати»,
      створювати копії з однаковим `series_id` (нова колонка, окрема міграція).
      Таблицю правил повторення не робити.
- [ ] **Офлайн-режим.** Етап 1: `database.ts` зберігає прочитаний день у `localStorage`
      і віддає його, коли немає мережі. Етап 2: черга змін. Нагадування не чіпати.
