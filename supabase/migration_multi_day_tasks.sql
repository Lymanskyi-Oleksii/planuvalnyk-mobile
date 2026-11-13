-- Задачі на кілька днів: одна задача з галочкою на весь діапазон дат.
-- Запустіть один раз: Supabase → SQL Editor → New query → вставити → Run.
-- Безпечно запускати повторно. Таблицю daily_tasks не змінює.

create table if not exists multi_day_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  start_date date not null,
  end_date date not null,
  sort_order integer not null default 0,
  constraint multi_day_tasks_range_check check (end_date >= start_date)
);

create index if not exists idx_multi_day_tasks_user_range on multi_day_tasks(user_id, start_date, end_date);

-- Кожен користувач бачить і змінює лише свої задачі (як multi_day_notes)
alter table multi_day_tasks enable row level security;

drop policy if exists "own multi_day_tasks" on multi_day_tasks;
create policy "own multi_day_tasks" on multi_day_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Нова таблиця: доступ через API для авторизованих користувачів
grant select, insert, update, delete on multi_day_tasks to authenticated;
