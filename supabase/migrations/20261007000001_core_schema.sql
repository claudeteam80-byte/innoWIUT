-- innoWIUT Founder Platform V1 — core schema.
--
-- Roles: every auth user gets a `profiles` row with role 'founder'. Admins are
-- promoted manually by staff (see docs/setup.md); there is no API path that can
-- change a role. Mentors are records, not logins, in V1.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('founder', 'admin');
create type public.metric_unit as enum ('number', 'currency', 'percent');
create type public.currency_code as enum ('USD', 'UZS');
create type public.update_status as enum ('draft', 'published');
create type public.meeting_request_status as enum (
  'requested',
  'confirmed',
  'completed',
  'declined',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'founder',
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 40),
  linkedin_url text check (char_length(linkedin_url) <= 300),
  notify_update_reminders boolean not null default true,
  notify_weekly_summary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- New auth users always become founders. The role is never read from
-- user-controlled metadata.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- startups (one per founder)
-- ---------------------------------------------------------------------------

create table public.startups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  tagline text check (char_length(tagline) <= 200),
  description text check (char_length(description) <= 4000),
  logo_path text,
  industry text check (
    industry in ('AI', 'EdTech', 'FinTech', 'SaaS', 'E-commerce', 'HealthTech', 'Marketplace', 'Other')
  ),
  stage text check (stage in ('Idea', 'Validation', 'MVP', 'Early Traction', 'Growth')),
  website text check (char_length(website) <= 300),
  founded_year integer check (founded_year between 1900 and 2100),
  team_size integer check (team_size between 1 and 10000),
  founder_role text check (founder_role in ('Founder', 'Co-Founder', 'CEO', 'CTO', 'Other')),
  has_product boolean,
  has_users boolean,
  has_revenue boolean,
  main_goal text check (char_length(main_goal) <= 2000),
  biggest_challenge text check (char_length(biggest_challenge) <= 2000),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger startups_set_updated_at
  before update on public.startups
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- team_members (records only — no co-founder login in V1)
-- ---------------------------------------------------------------------------

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  role text check (char_length(role) <= 120),
  email text check (char_length(email) <= 254),
  linkedin_url text check (char_length(linkedin_url) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_members_startup_id_idx on public.team_members (startup_id);

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- mentors (records only — no mentor login in V1)
-- ---------------------------------------------------------------------------

create table public.mentors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  title text check (char_length(title) <= 120),
  bio text check (char_length(bio) <= 4000),
  expertise text[] not null default '{}',
  email text check (char_length(email) <= 254),
  contact_url text check (char_length(contact_url) <= 300),
  photo_path text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mentors_set_updated_at
  before update on public.mentors
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- mentor_assignments (history; at most one active assignment per startup)
-- ---------------------------------------------------------------------------

create table public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  mentor_id uuid not null references public.mentors (id) on delete restrict,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint mentor_assignments_period check (ended_at is null or ended_at >= assigned_at)
);

create unique index mentor_assignments_one_active_per_startup
  on public.mentor_assignments (startup_id)
  where ended_at is null;
create index mentor_assignments_mentor_id_idx on public.mentor_assignments (mentor_id);

-- ---------------------------------------------------------------------------
-- mentor_notes (written by admins on behalf of mentors)
-- ---------------------------------------------------------------------------

create table public.mentor_notes (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  mentor_id uuid references public.mentors (id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  note_date date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mentor_notes_startup_id_idx on public.mentor_notes (startup_id, note_date desc);

create trigger mentor_notes_set_updated_at
  before update on public.mentor_notes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- meeting_requests
-- ---------------------------------------------------------------------------

create table public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  mentor_id uuid references public.mentors (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null default auth.uid(),
  reason text not null check (
    reason in ('Product', 'Growth', 'Business Model', 'Fundraising', 'Team', 'Other')
  ),
  message text check (char_length(message) <= 2000),
  preferred_date date,
  status public.meeting_request_status not null default 'requested',
  admin_response text check (char_length(admin_response) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meeting_requests_startup_id_idx on public.meeting_requests (startup_id, created_at desc);
create index meeting_requests_status_idx on public.meeting_requests (status);

create trigger meeting_requests_set_updated_at
  before update on public.meeting_requests
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- startup_updates
-- ---------------------------------------------------------------------------

create table public.startup_updates (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  summary text check (char_length(summary) <= 4000),
  highlights text[] not null default '{}',
  challenge text check (char_length(challenge) <= 2000),
  next_steps text check (char_length(next_steps) <= 2000),
  image_path text,
  link_url text check (char_length(link_url) <= 500),
  status public.update_status not null default 'draft',
  update_date date not null default current_date,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index startup_updates_startup_id_idx on public.startup_updates (startup_id, update_date desc);
create index startup_updates_published_idx
  on public.startup_updates (update_date desc)
  where status = 'published';

create trigger startup_updates_set_updated_at
  before update on public.startup_updates
  for each row execute function private.set_updated_at();

create function private.set_update_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger startup_updates_set_published_at
  before insert or update of status on public.startup_updates
  for each row execute function private.set_update_published_at();

-- ---------------------------------------------------------------------------
-- traction_metrics / traction_entries
--
-- Entries are append-only history. The metric's current/previous values are
-- derived from entries by trigger and are never written by clients.
-- ---------------------------------------------------------------------------

create table public.traction_metrics (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  unit public.metric_unit not null default 'number',
  currency public.currency_code,
  target numeric check (target >= 0),
  note text check (char_length(note) <= 500),
  is_archived boolean not null default false,
  current_value numeric,
  previous_value numeric,
  last_recorded_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traction_metrics_currency_matches_unit
    check ((unit = 'currency') = (currency is not null))
);

create unique index traction_metrics_unique_active_name
  on public.traction_metrics (startup_id, lower(name))
  where not is_archived;

create trigger traction_metrics_set_updated_at
  before update on public.traction_metrics
  for each row execute function private.set_updated_at();

create table public.traction_entries (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.traction_metrics (id) on delete cascade,
  startup_id uuid not null references public.startups (id) on delete cascade,
  value numeric not null check (value >= 0),
  recorded_on date not null default current_date,
  note text check (char_length(note) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index traction_entries_metric_idx
  on public.traction_entries (metric_id, recorded_on desc, created_at desc);
create index traction_entries_startup_idx on public.traction_entries (startup_id, recorded_on desc);

-- startup_id is always copied from the metric so it cannot be spoofed.
create function private.set_traction_entry_startup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select m.startup_id into new.startup_id
  from public.traction_metrics m
  where m.id = new.metric_id;

  if new.startup_id is null then
    raise exception 'Unknown traction metric %', new.metric_id;
  end if;
  return new;
end;
$$;

create trigger traction_entries_set_startup
  before insert on public.traction_entries
  for each row execute function private.set_traction_entry_startup();

create function private.refresh_traction_metric(target_metric_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with ranked as (
    select
      e.value,
      e.recorded_on,
      row_number() over (order by e.recorded_on desc, e.created_at desc, e.id desc) as rn
    from public.traction_entries e
    where e.metric_id = target_metric_id
  )
  update public.traction_metrics m
  set
    current_value = (select value from ranked where rn = 1),
    previous_value = (select value from ranked where rn = 2),
    last_recorded_on = (select recorded_on from ranked where rn = 1)
  where m.id = target_metric_id;
$$;

create function private.on_traction_entry_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_traction_metric(old.metric_id);
    return old;
  end if;
  perform private.refresh_traction_metric(new.metric_id);
  return new;
end;
$$;

create trigger traction_entries_refresh_metric
  after insert or delete on public.traction_entries
  for each row execute function private.on_traction_entry_change();

-- ---------------------------------------------------------------------------
-- Activity status (mirrors src/domain/activity.ts)
--   0–7 days  → active
--   8–14 days → needs_update
--   15+ days or never → inactive
-- ---------------------------------------------------------------------------

create function public.activity_status(days_since_activity integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when days_since_activity is null then 'inactive'
    when days_since_activity <= 7 then 'active'
    when days_since_activity <= 14 then 'needs_update'
    else 'inactive'
  end;
$$;

create view public.startup_activity
with (security_invoker = true)
as
select
  s.id as startup_id,
  latest_update.last_update_on,
  latest_entry.last_traction_on,
  greatest(
    latest_update.last_update_on,
    latest_entry.last_traction_on,
    s.created_at::date
  ) as last_active_on,
  (current_date - greatest(
    latest_update.last_update_on,
    latest_entry.last_traction_on,
    s.created_at::date
  )) as days_since_activity,
  public.activity_status(current_date - greatest(
    latest_update.last_update_on,
    latest_entry.last_traction_on,
    s.created_at::date
  )) as activity_status
from public.startups s
left join lateral (
  select max(u.update_date) as last_update_on
  from public.startup_updates u
  where u.startup_id = s.id and u.status = 'published'
) latest_update on true
left join lateral (
  select max(e.recorded_on) as last_traction_on
  from public.traction_entries e
  where e.startup_id = s.id
) latest_entry on true;
