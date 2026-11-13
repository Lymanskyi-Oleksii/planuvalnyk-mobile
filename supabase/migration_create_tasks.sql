-- Нова задача (чи копії повторюваної задачі) разом із підзадачами — одна транзакція:
-- або записано все, або нічого. Таблиць не змінює, лише додає функцію.
-- Спершу мають бути запущені migration_reminders.sql і migration_series.sql.
-- Запустіть один раз: Supabase → SQL Editor → New query → вставити → Run.
-- Безпечно запускати повторно. Поки функції немає, застосунок створює задачі
-- як раніше: двома запитами з видаленням задач, якщо другий не вдався.

create or replace function create_scheduled_tasks(tasks jsonb, subtask_titles text[])
returns void
language plpgsql
security invoker            -- з правами користувача: RLS діє як зазвичай
set search_path = public
as $$
declare
  t jsonb;
begin
  for t in select * from jsonb_array_elements(tasks) loop
    -- sort_order задачі не задаємо: як і без функції, лишається 0
    insert into scheduled_tasks
      (id, user_id, date, start_time, end_time, title, category, details,
       remind, remind_before_min, series_id)
    values
      ((t->>'id')::uuid, auth.uid(), (t->>'date')::date,
       (t->>'start_time')::time, (t->>'end_time')::time,
       t->>'title', coalesce(t->>'category', 'other'), t->>'details',
       (t->>'remind')::boolean, (t->>'remind_before_min')::integer,
       (t->>'series_id')::uuid);
    insert into subtasks (task_id, title, sort_order)
    select (t->>'id')::uuid, s.title, s.ord - 1
    from unnest(subtask_titles) with ordinality as s(title, ord);
  end loop;
end;
$$;

grant execute on function create_scheduled_tasks(jsonb, text[]) to authenticated;
