-- Planning personal per usuari.
-- Executar al SQL Editor de Supabase abans d'activar la lectura del planning.

create table if not exists public.planning_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  cycle_id text,
  cycle_name text,
  cycle_start date,
  cycle_end date,
  week_code text not null,
  start_date date not null,
  end_date date not null,
  phase text not null,
  summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_weeks_user_external_key unique (user_id, external_id),
  constraint planning_weeks_dates_check check (end_date >= start_date)
);

create table if not exists public.planning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_id uuid not null references public.planning_weeks(id) on delete cascade,
  external_id text not null,
  session_order integer not null default 0,
  day text,
  session_type text not null,
  sport text not null,
  variant text,
  payload jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_sessions_user_external_key unique (user_id, external_id)
);

create index if not exists planning_weeks_user_dates_idx
  on public.planning_weeks (user_id, start_date, end_date);
create index if not exists planning_sessions_week_order_idx
  on public.planning_sessions (week_id, session_order);
create index if not exists planning_sessions_user_type_idx
  on public.planning_sessions (user_id, session_type);

grant select, insert, update, delete on public.planning_weeks to authenticated;
grant select, insert, update, delete on public.planning_sessions to authenticated;

create or replace function public.touch_planning_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planning_weeks_touch_updated_at on public.planning_weeks;
create trigger planning_weeks_touch_updated_at
before update on public.planning_weeks
for each row execute function public.touch_planning_updated_at();

drop trigger if exists planning_sessions_touch_updated_at on public.planning_sessions;
create trigger planning_sessions_touch_updated_at
before update on public.planning_sessions
for each row execute function public.touch_planning_updated_at();

alter table public.planning_weeks enable row level security;
alter table public.planning_sessions enable row level security;

drop policy if exists planning_weeks_self on public.planning_weeks;
create policy planning_weeks_self on public.planning_weeks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists planning_sessions_self on public.planning_sessions;
create policy planning_sessions_self on public.planning_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.planning_weeks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.planning_sessions;
exception when duplicate_object then null;
end $$;
