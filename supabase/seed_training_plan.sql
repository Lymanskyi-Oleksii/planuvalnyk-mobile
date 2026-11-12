-- План тренувань 13.11–13.12.2026 для вашого акаунта.
-- ЯК ЗАПУСТИТИ (одна дія): Supabase → SQL Editor → New query → вставте весь файл → Run.
-- Якщо в проєкті лише один користувач, нічого міняти не треба. Якщо кілька,
-- замініть ВАША_ПОШТА нижче на пошту, з якою ви входите в застосунок.
-- Файл можна запускати повторно: попередній імпорт плану видаляється й вставляється заново.

do $plan$
declare
  v_email text := 'ВАША_ПОШТА';
  uid uuid;
  tid uuid;
begin
  if v_email = 'ВАША_ПОШТА' then
    if (select count(*) from auth.users) = 1 then
      select id into uid from auth.users;
    else
      raise exception 'У проєкті кілька користувачів: впишіть свою пошту замість ВАША_ПОШТА';
    end if;
  else
    select id into uid from auth.users where lower(email) = lower(v_email);
  end if;
  if uid is null then
    raise exception 'Користувача не знайдено: спершу зареєструйтесь у застосунку';
  end if;

  -- видаляємо попередній імпорт цього плану (підзадачі видаляються каскадом)
  delete from scheduled_tasks where user_id = uid and details like '%[план-тренувань]%';
  delete from daily_tasks where user_id = uid and title like '[План] %';
  delete from multi_day_notes where user_id = uid and title like 'План%';

  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-13', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Пульс у спокої: 1 хв лежачи, одразу після пробудження', 0),
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 1),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-13', '07:45', '07:55', 'Вага і обхват талії (старт)', 'health', 'Зранку до їжі, в однакових умовах.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Зважитись', 0),
    (tid, 'Виміряти обхват талії', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-13', '08:00', '08:10', 'Тест: 20 присідань за 30 с', 'sport', 'Тест 1 з 2: через 3 хв після присідань пульс має бути нижче 100.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Виміряти пульс у спокої', 0),
    (tid, '20 присідань за 30 с', 1),
    (tid, 'Пульс одразу після', 2),
    (tid, 'Пульс через 3 хв (норма нижче 100)', 3);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-13', '18:30', '19:15', 'Пробне коло B (1 коло, знайомство з вправами)', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: тримайтеся за стіну у випадах; у розведенні гумки слабше натяг, якщо болить ліва рука.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Випад назад — 8 на ногу × 1 коло', 1),
    (tid, 'Розведення гумки перед собою — 10 × 1 коло', 2),
    (tid, 'Супермен (утримання 2 с) — 10 × 1 коло', 3),
    (tid, 'Підйом ноги лежачи на боці — 15 на ногу × 1 коло', 4),
    (tid, 'Скручування лежачи, ноги на стільці — 15 × 1 коло', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-13', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-14', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Пульс у спокої: 1 хв лежачи, одразу після пробудження', 0),
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 1),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-14', '14:00', '14:40', 'Тест: 3200 м у розмовному темпі', 'sport', 'Рівний маршрут, фіксуйте час і пульс у кінці.
Мета через місяць: той самий час при нижчому пульсі.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв', 0),
    (tid, '3200 м: записати час', 1),
    (tid, 'Пульс у кінці дистанції', 2),
    (tid, 'Заминка 5 хв', 3);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-14', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-15', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Пульс у спокої: 1 хв лежачи, одразу після пробудження', 0),
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 1),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-15', '18:30', '18:45', 'Розтяжка і суглобова гімнастика (10–15 хв)', 'health', 'Без болю й без затримки дихання, тільки на розігріті м''язи.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Суглобова гімнастика 3 хв', 0),
    (tid, 'Груди: рука на дверному косяку (ліва — без болю), 30–40 с', 1),
    (tid, 'Верх спини: руки на спинці стільця, нахил з прямою спиною', 2),
    (tid, 'Згиначі стегна: випад на коліні, по 30–40 с на ногу', 3),
    (tid, 'Задня поверхня стегна і сідниці: по 30–40 с на ногу', 4),
    (tid, 'Шия: нахил голови вбік, рука лише тримає вагу голови', 5);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-15', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-16', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-16', '07:45', '07:55', 'Вага і обхват талії', 'health', 'Зранку до їжі, в однакових умовах.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Зважитись', 0),
    (tid, 'Виміряти обхват талії', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-16', '18:30', '19:15', 'Силове A: ноги, спина, груди', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: при болі в лівій руці тягніть гумку правою, відтискання пропустіть і додайте 5 повторів мосту.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Присідання — 15 × 2 кола', 1),
    (tid, 'Тяга гумки до пояса сидячи — 10 × 2 кола', 2),
    (tid, 'Сідничний міст — 15 × 2 кола', 3),
    (tid, 'Відтискання від опори (стіл, підвіконня) — 8 × 2 кола', 4),
    (tid, 'Dead bug (прес) — 15 × 2 кола', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-16', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-17', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-17', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-18', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-18', '18:30', '19:00', 'Кардіо 1: рівний темп, 30 хв', 'sport', 'Вдома: марш на місці, підйоми на сходинку, скакалка. Розмовний темп.
Міряйте пульс на 5-й, 15-й і 25-й хвилині: 10 с × 6. Пульс не вище 156.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв ходьби (пульс до 118)', 0),
    (tid, 'Основна частина 20 хв: пульс 118–137 (20–23 удари за 10 с)', 1),
    (tid, 'Заминка 5 хв, пульс через 3 хв нижче 100', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-18', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-19', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-19', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-20', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-20', '18:30', '19:15', 'Силове B: сідниці, спина, прес', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: тримайтеся за стіну у випадах; у розведенні гумки слабше натяг, якщо болить ліва рука.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Випад назад — 8 на ногу × 2 кола', 1),
    (tid, 'Розведення гумки перед собою — 10 × 2 кола', 2),
    (tid, 'Супермен (утримання 2 с) — 10 × 2 кола', 3),
    (tid, 'Підйом ноги лежачи на боці — 15 на ногу × 2 кола', 4),
    (tid, 'Скручування лежачи, ноги на стільці — 15 × 2 кола', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-20', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-21', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-21', '14:00', '14:30', 'Кардіо 2: ходьба надворі, 30 хв', 'sport', 'Надворі вдень по сухому й рівному, одягайтесь шарами; на слизькому — вдома.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв повільної ходьби', 0),
    (tid, 'Швидка ходьба 20 хв: пульс 118–137 (орієнтир 1 км за 8–10 хв)', 1),
    (tid, 'Заминка 5 хв, пульс через 3 хв нижче 100', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-21', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-22', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-22', '18:30', '18:45', 'Розтяжка і суглобова гімнастика (10–15 хв)', 'health', 'Без болю й без затримки дихання, тільки на розігріті м''язи.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Суглобова гімнастика 3 хв', 0),
    (tid, 'Груди: рука на дверному косяку (ліва — без болю), 30–40 с', 1),
    (tid, 'Верх спини: руки на спинці стільця, нахил з прямою спиною', 2),
    (tid, 'Згиначі стегна: випад на коліні, по 30–40 с на ногу', 3),
    (tid, 'Задня поверхня стегна і сідниці: по 30–40 с на ногу', 4),
    (tid, 'Шия: нахил голови вбік, рука лише тримає вагу голови', 5);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-22', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-23', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-23', '07:45', '07:55', 'Вага і обхват талії', 'health', 'Зранку до їжі, в однакових умовах.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Зважитись', 0),
    (tid, 'Виміряти обхват талії', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-23', '18:30', '19:15', 'Силове A: ноги, спина, груди', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: при болі в лівій руці тягніть гумку правою, відтискання пропустіть і додайте 5 повторів мосту.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Присідання — 20 × 2 кола', 1),
    (tid, 'Тяга гумки до пояса сидячи — 15 × 2 кола', 2),
    (tid, 'Сідничний міст — 20 × 2 кола', 3),
    (tid, 'Відтискання від опори (стіл, підвіконня) — 12 × 2 кола', 4),
    (tid, 'Dead bug (прес) — 20 × 2 кола', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-23', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-24', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-24', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-25', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-25', '18:30', '19:00', 'Кардіо 1: рівний темп, 30 хв', 'sport', 'Вдома: марш на місці, підйоми на сходинку, скакалка. Розмовний темп.
Міряйте пульс на 5-й, 15-й і 25-й хвилині: 10 с × 6. Пульс не вище 156.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв ходьби (пульс до 118)', 0),
    (tid, 'Основна частина 20 хв: пульс 118–137 (20–23 удари за 10 с)', 1),
    (tid, 'Заминка 5 хв, пульс через 3 хв нижче 100', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-25', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-26', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-26', '21:00', '21:10', 'Тиск (вечір)', 'health', 'Сидячи, після 5 хв спокою, два виміри з паузою 1 хв.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Два виміри, записати обидва', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-27', '18:30', '19:15', 'Силове B: сідниці, спина, прес', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: тримайтеся за стіну у випадах; у розведенні гумки слабше натяг, якщо болить ліва рука.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Випад назад — 10 на ногу × 2 кола', 1),
    (tid, 'Розведення гумки перед собою — 15 × 2 кола', 2),
    (tid, 'Супермен (утримання 2 с) — 15 × 2 кола', 3),
    (tid, 'Підйом ноги лежачи на боці — 20 на ногу × 2 кола', 4),
    (tid, 'Скручування лежачи, ноги на стільці — 20 × 2 кола', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-28', '14:00', '14:35', 'Кардіо 2: ходьба надворі, 35 хв', 'sport', 'Надворі вдень по сухому й рівному, одягайтесь шарами; на слизькому — вдома.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв повільної ходьби', 0),
    (tid, 'Швидка ходьба 25 хв: пульс 118–137 (орієнтир 1 км за 8–10 хв)', 1),
    (tid, 'Заминка 5 хв, пульс через 3 хв нижче 100', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-29', '18:30', '18:45', 'Розтяжка і суглобова гімнастика (10–15 хв)', 'health', 'Без болю й без затримки дихання, тільки на розігріті м''язи.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Суглобова гімнастика 3 хв', 0),
    (tid, 'Груди: рука на дверному косяку (ліва — без болю), 30–40 с', 1),
    (tid, 'Верх спини: руки на спинці стільця, нахил з прямою спиною', 2),
    (tid, 'Згиначі стегна: випад на коліні, по 30–40 с на ногу', 3),
    (tid, 'Задня поверхня стегна і сідниці: по 30–40 с на ногу', 4),
    (tid, 'Шия: нахил голови вбік, рука лише тримає вагу голови', 5);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-30', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-30', '07:45', '07:55', 'Вага і обхват талії', 'health', 'Зранку до їжі, в однакових умовах.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Зважитись', 0),
    (tid, 'Виміряти обхват талії', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-11-30', '18:30', '19:15', 'Силове A: ноги, спина, груди', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: при болі в лівій руці тягніть гумку правою, відтискання пропустіть і додайте 5 повторів мосту.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Присідання — 20 × 2 кола', 1),
    (tid, 'Тяга гумки до пояса сидячи — 15 × 2 кола', 2),
    (tid, 'Сідничний міст — 20 × 2 кола', 3),
    (tid, 'Відтискання від опори (стіл, підвіконня) — 12 × 2 кола', 4),
    (tid, 'Dead bug (прес) — 20 × 2 кола', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-02', '18:30', '19:00', 'Кардіо 1: прискорення 5 × (1+2), 30 хв', 'sport', 'Вдома: марш на місці, підйоми на сходинку, скакалка. Розмовний темп.
Міряйте пульс на 5-й, 15-й і 25-й хвилині: 10 с × 6. Пульс не вище 156.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв ходьби (пульс до 118)', 0),
    (tid, '5 × (1 хв швидше, пульс 140–155 + 2 хв спокійно)', 1),
    (tid, '5 хв у зоні 118–137', 2),
    (tid, 'Заминка 5 хв, пульс через 3 хв нижче 100', 3);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-03', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-04', '18:30', '19:15', 'Силове B: сідниці, спина, прес', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: тримайтеся за стіну у випадах; у розведенні гумки слабше натяг, якщо болить ліва рука.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Випад назад — 10 на ногу × 2 кола', 1),
    (tid, 'Розведення гумки перед собою — 15 × 2 кола', 2),
    (tid, 'Супермен (утримання 2 с) — 15 × 2 кола', 3),
    (tid, 'Підйом ноги лежачи на боці — 20 на ногу × 2 кола', 4),
    (tid, 'Скручування лежачи, ноги на стільці — 20 × 2 кола', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-05', '14:00', '14:35', 'Кардіо 2: ходьба надворі, 35 хв', 'sport', 'Надворі вдень по сухому й рівному, одягайтесь шарами; на слизькому — вдома.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв повільної ходьби', 0),
    (tid, 'Швидка ходьба 25 хв: пульс 118–137 (орієнтир 1 км за 8–10 хв)', 1),
    (tid, 'Заминка 5 хв, пульс через 3 хв нижче 100', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-06', '18:30', '18:45', 'Розтяжка і суглобова гімнастика (10–15 хв)', 'health', 'Без болю й без затримки дихання, тільки на розігріті м''язи.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Суглобова гімнастика 3 хв', 0),
    (tid, 'Груди: рука на дверному косяку (ліва — без болю), 30–40 с', 1),
    (tid, 'Верх спини: руки на спинці стільця, нахил з прямою спиною', 2),
    (tid, 'Згиначі стегна: випад на коліні, по 30–40 с на ногу', 3),
    (tid, 'Задня поверхня стегна і сідниці: по 30–40 с на ногу', 4),
    (tid, 'Шия: нахил голови вбік, рука лише тримає вагу голови', 5);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-07', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-07', '07:45', '07:55', 'Вага і обхват талії', 'health', 'Зранку до їжі, в однакових умовах.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Зважитись', 0),
    (tid, 'Виміряти обхват талії', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-07', '18:30', '19:15', 'Силове A: ноги, спина, груди', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: при болі в лівій руці тягніть гумку правою, відтискання пропустіть і додайте 5 повторів мосту.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Присідання — 15 × 3 кола', 1),
    (tid, 'Тяга гумки до пояса сидячи — 10 × 3 кола', 2),
    (tid, 'Сідничний міст — 15 × 3 кола', 3),
    (tid, 'Відтискання від опори (стіл, підвіконня) — 8 × 3 кола', 4),
    (tid, 'Dead bug (прес) — 15 × 3 кола', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-09', '18:30', '19:00', 'Кардіо 1: прискорення 5 × (1+2), 30 хв', 'sport', 'Вдома: марш на місці, підйоми на сходинку, скакалка. Розмовний темп.
Міряйте пульс на 5-й, 15-й і 25-й хвилині: 10 с × 6. Пульс не вище 156.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв ходьби (пульс до 118)', 0),
    (tid, '5 × (1 хв швидше, пульс 140–155 + 2 хв спокійно)', 1),
    (tid, '5 хв у зоні 118–137', 2),
    (tid, 'Заминка 5 хв, пульс через 3 хв нижче 100', 3);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-10', '07:30', '07:40', 'Тиск і пульс (ранок)', 'health', 'Середнє значення ≥ 140/90 — запишіться до терапевта.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Сидячи, після 5 хв спокою, рука на рівні серця', 0),
    (tid, 'Два виміри з паузою 1 хв, записати обидва', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-11', '07:30', '07:40', 'Пульс у спокої (ранок)', 'health', '1 хв лежачи, одразу після пробудження.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Виміряти й записати пульс у спокої', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-11', '18:30', '19:15', 'Силове B: сідниці, спина, прес', 'sport', 'Бандаж на ліву руку, видих на зусиллі, без затримки дихання, біль = пропустіть вправу.
Відпочинок: 30–45 с між вправами, 90 с повільної ходьби між колами (наступне коло — коли пульс близько 115). Повільний темп: 2 с вгору, 2 с вниз. Заміни: тримайтеся за стіну у випадах; у розведенні гумки слабше натяг, якщо болить ліва рука.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5–7 хв: суглобова гімнастика, марш (пульс до 118)', 0),
    (tid, 'Випад назад — 8 на ногу × 3 кола', 1),
    (tid, 'Розведення гумки перед собою — 10 × 3 кола', 2),
    (tid, 'Супермен (утримання 2 с) — 10 × 3 кола', 3),
    (tid, 'Підйом ноги лежачи на боці — 15 на ногу × 3 кола', 4),
    (tid, 'Скручування лежачи, ноги на стільці — 15 × 3 кола', 5),
    (tid, 'Розтяжка 6–7 хв (кожна поза 30–40 с)', 6);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-12', '07:30', '07:40', 'Пульс у спокої (ранок)', 'health', '1 хв лежачи, одразу після пробудження.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Виміряти й записати пульс у спокої', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-12', '14:00', '14:35', 'Кардіо 2: ходьба надворі, 35 хв', 'sport', 'Надворі вдень по сухому й рівному, одягайтесь шарами; на слизькому — вдома.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв повільної ходьби', 0),
    (tid, 'Швидка ходьба 25 хв: пульс 118–137 (орієнтир 1 км за 8–10 хв)', 1),
    (tid, 'Заминка 5 хв, пульс через 3 хв нижче 100', 2);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-13', '07:30', '07:40', 'Пульс у спокої (ранок)', 'health', '1 хв лежачи, одразу після пробудження.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Виміряти й записати пульс у спокої', 0);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-13', '07:45', '07:55', 'Вага і обхват талії (підсумок)', 'health', 'Зранку до їжі, в однакових умовах.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Зважитись', 0),
    (tid, 'Виміряти обхват талії', 1);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-13', '08:00', '08:10', 'Тест: 20 присідань за 30 с (підсумок)', 'sport', 'Порівняйте з результатом 13.11.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Виміряти пульс у спокої', 0),
    (tid, '20 присідань за 30 с', 1),
    (tid, 'Пульс одразу після', 2),
    (tid, 'Пульс через 3 хв (норма нижче 100)', 3);
  insert into scheduled_tasks (user_id, date, start_time, end_time, title, category, details)
  values (uid, '2026-12-13', '14:00', '14:40', 'Тест: 3200 м (підсумок)', 'sport', 'Не раніше ніж через 3 год після присідань. Порівняйте час і пульс з 14.11.
[план-тренувань]') returning id into tid;
  insert into subtasks (task_id, title, sort_order) values
    (tid, 'Розминка 5 хв', 0),
    (tid, '3200 м: записати час', 1),
    (tid, 'Пульс у кінці дистанції', 2),
    (tid, 'Заминка 5 хв', 3);
  insert into daily_tasks (user_id, date, title) values (uid, '2026-11-13', '[План] Записатися до терапевта: тиск і ЕКГ');
  insert into daily_tasks (user_id, date, title) values (uid, '2026-11-13', '[План] Купити тонометр з манжетою на плече');
  insert into daily_tasks (user_id, date, title) values (uid, '2026-11-27', '[План] Показати терапевту записи тиску за 2 тижні');
  insert into daily_tasks (user_id, date, title) values (uid, '2026-12-13', '[План] Підсумок: порівняти тести 13–14.11 і 13.12, обговорити план далі з лікарем');
  insert into multi_day_notes (user_id, title, content, start_date, end_date)
  values (uid, 'План: правила тренувань', 'Пульсові зони (ЧССmax = 196): 60–70 % = 118–137 уд/хв (20–23 за 10 с). Прискорення 140–155, стеля 156.
Розмовний темп: якщо не можете говорити фразами — сповільніться.
Дихання без затримки, видих на зусиллі.
Між A і B щонайменше 3 вільні дні. Вт і Чт — навчання, відпочинок.
Не тренуйтесь, якщо тиск ≥ 160/100, головний біль, запаморочення, біль у грудях, перебої серця.
Стоп-сигнали: різке почервоніння або блідість, синюшність губ, задишка, похитування, нудота.
Пропуск: не надолужуйте двома заняттями за день, а перенесіть на вільний день.', '2026-11-13', '2026-12-13');
  insert into multi_day_notes (user_id, title, content, start_date, end_date)
  values (uid, 'План, тиждень 1: регулярність і техніка', '2 кола A/B, нижня межа повторів. Кардіо 30 хв рівно.', '2026-11-16', '2026-11-22');
  insert into multi_day_notes (user_id, title, content, start_date, end_date)
  values (uid, 'План, тиждень 2: довша субота', '2 кола, верхня межа. Субота 35 хв.', '2026-11-23', '2026-11-29');
  insert into multi_day_notes (user_id, title, content, start_date, end_date)
  values (uid, 'План, тиждень 3: прискорення', 'У середу 5 × (1 хв швидше + 2 хв спокійно). Пульс до 155.', '2026-11-30', '2026-12-06');
  insert into multi_day_notes (user_id, title, content, start_date, end_date)
  values (uid, 'План, тиждень 4: третє коло і підсумки', '3 кола, нижня межа. У неділю 13.12 — підсумкові тести.', '2026-12-07', '2026-12-13');
  raise notice 'Імпортовано: % задач, % задач дня, % нотаток', 66, 4, 5;
end
$plan$;
