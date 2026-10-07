-- innoWIUT Founder Platform V1 — privileges and row level security.
--
-- Model:
--   * anon has no table access at all.
--   * Founders (authenticated, role 'founder') can only see and change rows that
--     belong to the single startup they own.
--   * Admins (authenticated, role 'admin') can read everything and manage
--     mentors, mentor assignments, mentor notes and meeting request status.
--   * Column-level grants stop clients from writing server-owned columns such as
--     profiles.role, startups.owner_id, startups.onboarding_completed_at and the
--     derived traction_metrics values.
--
-- Any table added later must be given explicit grants and RLS policies.

-- ---------------------------------------------------------------------------
-- Defaults that make ownership columns server-controlled
-- ---------------------------------------------------------------------------

alter table public.startups alter column owner_id set default auth.uid();
alter table public.mentors alter column created_by set default auth.uid();
alter table public.mentor_assignments alter column assigned_by set default auth.uid();

-- ---------------------------------------------------------------------------
-- Authorisation helpers
-- ---------------------------------------------------------------------------

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function private.owns_startup(target_startup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.startups
    where id = target_startup_id and owner_id = (select auth.uid())
  );
$$;

create function private.is_assigned_mentor(target_mentor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mentor_assignments a
    join public.startups s on s.id = a.startup_id
    where a.mentor_id = target_mentor_id
      and a.ended_at is null
      and s.owner_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Baseline privileges
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.activity_status(integer) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.owns_startup(uuid) to authenticated;
grant execute on function private.is_assigned_mentor(uuid) to authenticated;
grant execute on function public.activity_status(integer) to authenticated;

alter table public.profiles enable row level security;
alter table public.startups enable row level security;
alter table public.team_members enable row level security;
alter table public.mentors enable row level security;
alter table public.mentor_assignments enable row level security;
alter table public.mentor_notes enable row level security;
alter table public.meeting_requests enable row level security;
alter table public.startup_updates enable row level security;
alter table public.traction_metrics enable row level security;
alter table public.traction_entries enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

grant select on public.profiles to authenticated;
grant update (full_name, phone, linkedin_url, notify_update_reminders, notify_weekly_summary)
  on public.profiles to authenticated;

create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- startups
-- ---------------------------------------------------------------------------

grant select on public.startups to authenticated;
grant insert (
  name, tagline, description, logo_path, industry, stage, website, founded_year,
  team_size, founder_role, has_product, has_users, has_revenue, main_goal, biggest_challenge
) on public.startups to authenticated;
grant update (
  name, tagline, description, logo_path, industry, stage, website, founded_year,
  team_size, founder_role, has_product, has_users, has_revenue, main_goal, biggest_challenge
) on public.startups to authenticated;

create policy "startups: read own or admin"
  on public.startups for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()));

create policy "startups: founder creates own"
  on public.startups for insert to authenticated
  with check (owner_id = (select auth.uid()) and not (select private.is_admin()));

create policy "startups: update own or admin"
  on public.startups for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------------

grant select, delete on public.team_members to authenticated;
grant insert (startup_id, name, role, email, linkedin_url) on public.team_members to authenticated;
grant update (name, role, email, linkedin_url) on public.team_members to authenticated;

create policy "team_members: read own startup or admin"
  on public.team_members for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create policy "team_members: founder inserts"
  on public.team_members for insert to authenticated
  with check ((select private.owns_startup(startup_id)));

create policy "team_members: founder updates"
  on public.team_members for update to authenticated
  using ((select private.owns_startup(startup_id)))
  with check ((select private.owns_startup(startup_id)));

create policy "team_members: founder deletes"
  on public.team_members for delete to authenticated
  using ((select private.owns_startup(startup_id)));

-- ---------------------------------------------------------------------------
-- mentors
-- ---------------------------------------------------------------------------

grant select, delete on public.mentors to authenticated;
grant insert (name, title, bio, expertise, email, contact_url, photo_path, is_active)
  on public.mentors to authenticated;
grant update (name, title, bio, expertise, email, contact_url, photo_path, is_active)
  on public.mentors to authenticated;

create policy "mentors: admin or assigned founder reads"
  on public.mentors for select to authenticated
  using ((select private.is_admin()) or (select private.is_assigned_mentor(id)));

create policy "mentors: admin inserts"
  on public.mentors for insert to authenticated
  with check ((select private.is_admin()));

create policy "mentors: admin updates"
  on public.mentors for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "mentors: admin deletes"
  on public.mentors for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- mentor_assignments
-- ---------------------------------------------------------------------------

grant select on public.mentor_assignments to authenticated;
grant insert (startup_id, mentor_id) on public.mentor_assignments to authenticated;
grant update (ended_at) on public.mentor_assignments to authenticated;

create policy "mentor_assignments: read own startup or admin"
  on public.mentor_assignments for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create policy "mentor_assignments: admin inserts"
  on public.mentor_assignments for insert to authenticated
  with check ((select private.is_admin()));

create policy "mentor_assignments: admin updates"
  on public.mentor_assignments for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- mentor_notes
-- ---------------------------------------------------------------------------

grant select, delete on public.mentor_notes to authenticated;
grant insert (startup_id, mentor_id, body, note_date) on public.mentor_notes to authenticated;
grant update (mentor_id, body, note_date) on public.mentor_notes to authenticated;

create policy "mentor_notes: read own startup or admin"
  on public.mentor_notes for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create policy "mentor_notes: admin inserts"
  on public.mentor_notes for insert to authenticated
  with check ((select private.is_admin()));

create policy "mentor_notes: admin updates"
  on public.mentor_notes for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "mentor_notes: admin deletes"
  on public.mentor_notes for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- meeting_requests
-- ---------------------------------------------------------------------------

grant select on public.meeting_requests to authenticated;
grant insert (startup_id, mentor_id, reason, message, preferred_date)
  on public.meeting_requests to authenticated;
grant update (status, admin_response) on public.meeting_requests to authenticated;

create policy "meeting_requests: read own startup or admin"
  on public.meeting_requests for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create policy "meeting_requests: founder requests"
  on public.meeting_requests for insert to authenticated
  with check (
    (select private.owns_startup(startup_id))
    and requested_by = (select auth.uid())
    and status = 'requested'
    and (mentor_id is null or (select private.is_assigned_mentor(mentor_id)))
  );

create policy "meeting_requests: admin updates status"
  on public.meeting_requests for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- startup_updates (admins only see published updates)
-- ---------------------------------------------------------------------------

grant select, delete on public.startup_updates to authenticated;
grant insert (
  startup_id, title, summary, highlights, challenge, next_steps, image_path, link_url,
  status, update_date
) on public.startup_updates to authenticated;
grant update (
  title, summary, highlights, challenge, next_steps, image_path, link_url, status, update_date
) on public.startup_updates to authenticated;

create policy "startup_updates: founder reads own, admin reads published"
  on public.startup_updates for select to authenticated
  using (
    (select private.owns_startup(startup_id))
    or (status = 'published' and (select private.is_admin()))
  );

create policy "startup_updates: founder inserts"
  on public.startup_updates for insert to authenticated
  with check ((select private.owns_startup(startup_id)) and author_id = (select auth.uid()));

create policy "startup_updates: founder updates"
  on public.startup_updates for update to authenticated
  using ((select private.owns_startup(startup_id)))
  with check ((select private.owns_startup(startup_id)));

create policy "startup_updates: founder deletes drafts"
  on public.startup_updates for delete to authenticated
  using ((select private.owns_startup(startup_id)) and status = 'draft');

-- ---------------------------------------------------------------------------
-- traction_metrics
-- ---------------------------------------------------------------------------

grant select on public.traction_metrics to authenticated;
grant insert (startup_id, name, unit, currency, target, note)
  on public.traction_metrics to authenticated;
grant update (name, unit, currency, target, note, is_archived)
  on public.traction_metrics to authenticated;

create policy "traction_metrics: read own startup or admin"
  on public.traction_metrics for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create policy "traction_metrics: founder inserts"
  on public.traction_metrics for insert to authenticated
  with check ((select private.owns_startup(startup_id)));

create policy "traction_metrics: founder updates"
  on public.traction_metrics for update to authenticated
  using ((select private.owns_startup(startup_id)))
  with check ((select private.owns_startup(startup_id)));

-- ---------------------------------------------------------------------------
-- traction_entries (append-only for founders; startup_id set by trigger)
-- ---------------------------------------------------------------------------

grant select on public.traction_entries to authenticated;
grant insert (metric_id, value, recorded_on, note) on public.traction_entries to authenticated;

create policy "traction_entries: read own startup or admin"
  on public.traction_entries for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create policy "traction_entries: founder records"
  on public.traction_entries for insert to authenticated
  with check (
    (select private.owns_startup(startup_id)) and created_by = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

grant select on public.startup_activity to authenticated;
