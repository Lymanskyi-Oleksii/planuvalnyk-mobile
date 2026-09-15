-- Виконайте цей файл повністю в Supabase → SQL Editor → New query → Run
-- Він створює всі таблиці планувальника і захищає їх так, щоб кожен
-- користувач бачив і міняв тільки свої власні дані.

-- Тип 1: заплановані задачі (мають час)
create table if not exists scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  category text not null default 'other',
  details text,
  done boolean not null default false,
  sort_order integer not null default 0
);

create index if not exists idx_scheduled_tasks_user_date on scheduled_tasks(user_id, date);

-- Підзадачі належать конкретній запланованій задачі
create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references scheduled_tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0
);

create index if not exists idx_subtasks_task on subtasks(task_id);

-- Тип 2: звичайні задачі дня (без часу)
create table if not exists daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0
);

create index if not exists idx_daily_tasks_user_date on daily_tasks(user_id, date);

-- Тип 3: нотатки дня (одна на дату, вільний текст)
create table if not exists notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null default '',
  primary key (user_id, date)
);

-- Тип 3б: нотатки на кілька днів
create table if not exists multi_day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null default '',
  start_date date not null,
  end_date date not null
);

create index if not exists idx_multi_day_notes_user_range on multi_day_notes(user_id, start_date, end_date);

-- ===================== Row Level Security =====================
-- Вмикаємо RLS і дозволяємо кожному користувачу працювати тільки зі своїми рядками

alter table scheduled_tasks enable row level security;
alter table subtasks enable row level security;
alter table daily_tasks enable row level security;
alter table notes enable row level security;
alter table multi_day_notes enable row level security;

create policy "own scheduled_tasks" on scheduled_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own subtasks" on subtasks
  for all using (
    exists (select 1 from scheduled_tasks t where t.id = subtasks.task_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from scheduled_tasks t where t.id = subtasks.task_id and t.user_id = auth.uid())
  );

create policy "own daily_tasks" on daily_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own notes" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own multi_day_notes" on multi_day_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
