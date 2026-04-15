-- HomeChores initial schema
-- This migration sets up user-scoped data with RLS enabled.

create extension if not exists "pgcrypto";

create type effort_level as enum ('easy', 'medium', 'heavy');
create type schedule_status as enum ('planned', 'completed', 'skipped', 'snoozed');
create type score_reason as enum ('completed_on_time', 'completed_late', 'skipped');
create type pressure_level as enum ('light', 'medium', 'heavy');

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  chore_days int2[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_chore_days check (
    array_position(chore_days, 0) is null
    and array_position(chore_days, 8) is null
  )
);

create table if not exists public.chores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  estimate_minutes int not null check (estimate_minutes > 0),
  recurrence_days int not null check (recurrence_days > 0),
  effort effort_level not null default 'medium',
  last_completed_on date,
  must_do_by_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.day_capacity_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  override_date date not null,
  limit_minutes int check (limit_minutes > 0),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, override_date)
);

create table if not exists public.scheduled_chores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete cascade,
  planned_for date not null,
  due_date date not null,
  estimate_minutes int not null check (estimate_minutes > 0),
  pressure pressure_level not null default 'light',
  status schedule_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_chore_id uuid not null references public.scheduled_chores(id) on delete cascade,
  action_type schedule_status not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_chore_id uuid references public.scheduled_chores(id) on delete set null,
  points int not null,
  reason score_reason not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create trigger chores_set_updated_at
before update on public.chores
for each row execute function public.set_updated_at();

create trigger day_capacity_overrides_set_updated_at
before update on public.day_capacity_overrides
for each row execute function public.set_updated_at();

create trigger scheduled_chores_set_updated_at
before update on public.scheduled_chores
for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
alter table public.chores enable row level security;
alter table public.day_capacity_overrides enable row level security;
alter table public.scheduled_chores enable row level security;
alter table public.schedule_action_log enable row level security;
alter table public.score_events enable row level security;

create policy "user_preferences_owner_access"
on public.user_preferences
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chores_owner_access"
on public.chores
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "day_capacity_overrides_owner_access"
on public.day_capacity_overrides
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "scheduled_chores_owner_access"
on public.scheduled_chores
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "schedule_action_log_owner_access"
on public.schedule_action_log
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "score_events_owner_access"
on public.score_events
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
