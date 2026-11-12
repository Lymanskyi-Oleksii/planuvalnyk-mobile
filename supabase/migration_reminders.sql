-- Нагадування на рівні окремої задачі.
-- Запустіть один раз: Supabase → SQL Editor → New query → вставити → Run.
-- Безпечно запускати повторно. Нові таблиці не створюються, тому додаткові
-- GRANT не потрібні: колонки успадковують права таблиці scheduled_tasks.

alter table scheduled_tasks
  add column if not exists remind boolean,              -- null = за загальними налаштуваннями
  add column if not exists remind_before_min integer;   -- null = загальне значення "за скільки хвилин"

alter table scheduled_tasks
  drop constraint if exists scheduled_tasks_remind_before_min_check;
alter table scheduled_tasks
  add constraint scheduled_tasks_remind_before_min_check
  check (remind_before_min is null or (remind_before_min >= 0 and remind_before_min <= 1440));
