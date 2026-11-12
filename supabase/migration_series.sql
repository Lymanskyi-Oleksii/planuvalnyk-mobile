-- Повторювані задачі: копії однієї задачі на різні дні мають спільний series_id.
-- Запустіть один раз: Supabase → SQL Editor → New query → вставити → Run.
-- Безпечно запускати повторно. Нові таблиці не створюються, тому додаткові
-- GRANT не потрібні: колонка успадковує права таблиці scheduled_tasks.

alter table scheduled_tasks
  add column if not exists series_id uuid;   -- null = задача не повторюється

create index if not exists idx_scheduled_tasks_series on scheduled_tasks(user_id, series_id);
