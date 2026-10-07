-- innoWIUT Founder Platform V1 — admin access management.
--
-- Roles: founder | admin | superadmin. Admins and superadmins share every existing
-- admin permission. Only superadmins manage admin access.
--
-- Role changes:
--   * profiles.role is never writable by clients (no column grant).
--   * public.grant_admin_access / revoke_admin_access / promote_to_superadmin run with
--     the caller's privileges, check for a superadmin, and delegate the single write
--     to private.change_role (SECURITY DEFINER, not exposed through the Data API),
--     which re-checks the caller.
--   * Every role change — including ones made in the SQL editor — is written to
--     public.admin_role_events by trigger.
--   * A trigger refuses any update or delete that would leave zero superadmins.
--     Only a SQL-editor session can bypass it, by setting
--     innowiut.allow_superadmin_removal = 'on' for one transaction.

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'superadmin')
  );
$$;

create function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'superadmin'
  );
$$;

revoke all on function private.is_superadmin() from public, anon;
grant execute on function private.is_superadmin() to authenticated;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table public.admin_role_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references public.profiles (id) on delete set null,
  target_email text not null,
  previous_role public.app_role not null,
  new_role public.app_role not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index admin_role_events_created_at_idx on public.admin_role_events (created_at desc);
create index admin_role_events_target_idx on public.admin_role_events (target_user_id);
create index admin_role_events_changed_by_idx on public.admin_role_events (changed_by);

alter table public.admin_role_events enable row level security;
revoke all on public.admin_role_events from anon, authenticated;
grant select on public.admin_role_events to authenticated;

create policy "admin_role_events: superadmin reads"
  on public.admin_role_events for select to authenticated
  using ((select private.is_superadmin()));

create function private.log_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    insert into public.admin_role_events (target_user_id, target_email, previous_role, new_role, changed_by)
    values (
      new.id,
      new.email,
      old.role,
      new.role,
      (select id from public.profiles where id = (select auth.uid()))
    );
  end if;
  return new;
end;
$$;

create trigger profiles_log_role_change
  after update of role on public.profiles
  for each row execute function private.log_role_change();

-- ---------------------------------------------------------------------------
-- There must always be at least one superadmin
-- ---------------------------------------------------------------------------

create function private.protect_last_superadmin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('innowiut.allow_superadmin_removal', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if old.role = 'superadmin' and (tg_op = 'DELETE' or new.role is distinct from 'superadmin') then
    -- Serialise role changes so two superadmins cannot remove each other at once.
    perform pg_advisory_xact_lock(hashtext('innowiut.admin_roles'));
    if not exists (
      select 1 from public.profiles where role = 'superadmin' and id <> old.id
    ) then
      raise exception 'There must always be at least one superadmin.' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_protect_last_superadmin
  before update of role or delete on public.profiles
  for each row execute function private.protect_last_superadmin();

-- ---------------------------------------------------------------------------
-- The only path that writes profiles.role from the app
-- ---------------------------------------------------------------------------

create function private.change_role(
  p_target uuid,
  p_expected public.app_role[],
  p_new_role public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not private.is_superadmin() then
    raise exception 'Only a superadmin can manage admin access.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('innowiut.admin_roles'));
  update public.profiles
  set role = p_new_role
  where id = p_target and role = any (p_expected)
  returning * into v_profile;
  if v_profile.id is null then
    raise exception 'This user''s access changed in the meantime. Refresh and try again.' using errcode = 'P0001';
  end if;
  return v_profile;
end;
$$;

revoke all on function private.change_role(uuid, public.app_role[], public.app_role) from public, anon;
grant execute on function private.change_role(uuid, public.app_role[], public.app_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Superadmin API (SECURITY INVOKER)
-- ---------------------------------------------------------------------------

create function public.admin_find_user(p_email text)
returns table (
  id uuid,
  full_name text,
  email text,
  role public.app_role,
  owns_startup boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (select private.is_superadmin()) then
    raise exception 'Only a superadmin can manage admin access.' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.email, p.role,
    exists (select 1 from public.startups s where s.owner_id = p.id)
  from public.profiles p
  where lower(p.email) = lower(trim(p_email));
end;
$$;

create function private.admin_directory()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.app_role,
  added_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_superadmin() then
    raise exception 'Only a superadmin can manage admin access.' using errcode = '42501';
  end if;
  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.role,
    coalesce(
      (select max(e.created_at) from public.admin_role_events e
       where e.target_user_id = p.id and e.previous_role = 'founder'),
      p.created_at
    ),
    u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role in ('admin', 'superadmin')
  order by p.role desc, p.full_name, p.email;
end;
$$;

revoke all on function private.admin_directory() from public, anon;
grant execute on function private.admin_directory() to authenticated;

create function public.admin_access_list()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.app_role,
  added_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_superadmin()) then
    raise exception 'Only a superadmin can manage admin access.' using errcode = '42501';
  end if;
  return query select * from private.admin_directory();
end;
$$;

create function public.grant_admin_access(p_email text)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target public.profiles;
begin
  if not (select private.is_superadmin()) then
    raise exception 'Only a superadmin can manage admin access.' using errcode = '42501';
  end if;
  select * into v_target from public.profiles where lower(email) = lower(trim(p_email));
  if v_target.id is null then
    raise exception 'This user needs an account before admin access can be granted.' using errcode = 'P0002';
  end if;
  if v_target.role <> 'founder' then
    raise exception 'This user already has admin access.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.startups where owner_id = v_target.id) then
    raise exception 'This account owns a startup. Use a separate email address for admin access.'
      using errcode = 'P0001';
  end if;
  return private.change_role(v_target.id, array['founder']::public.app_role[], 'admin');
end;
$$;

create function public.revoke_admin_access(p_user_id uuid, p_confirm_self boolean default false)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_superadmin()) then
    raise exception 'Only a superadmin can manage admin access.' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) and not coalesce(p_confirm_self, false) then
    raise exception 'Confirm that you want to remove your own admin access.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role in ('admin', 'superadmin')) then
    raise exception 'This user does not have admin access.' using errcode = 'P0002';
  end if;
  return private.change_role(p_user_id, array['admin', 'superadmin']::public.app_role[], 'founder');
end;
$$;

create function public.promote_to_superadmin(p_user_id uuid, p_confirm_email text)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target public.profiles;
begin
  if not (select private.is_superadmin()) then
    raise exception 'Only a superadmin can manage admin access.' using errcode = '42501';
  end if;
  select * into v_target from public.profiles where id = p_user_id;
  if v_target.id is null or v_target.role <> 'admin' then
    raise exception 'Only an existing admin can be promoted to superadmin.' using errcode = 'P0002';
  end if;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(v_target.email) then
    raise exception 'Type the admin''s email address exactly to confirm the promotion.' using errcode = '22023';
  end if;
  return private.change_role(v_target.id, array['admin']::public.app_role[], 'superadmin');
end;
$$;

revoke all on function public.admin_find_user(text) from public, anon;
revoke all on function public.admin_access_list() from public, anon;
revoke all on function public.grant_admin_access(text) from public, anon;
revoke all on function public.revoke_admin_access(uuid, boolean) from public, anon;
revoke all on function public.promote_to_superadmin(uuid, text) from public, anon;
grant execute on function public.admin_find_user(text) to authenticated;
grant execute on function public.admin_access_list() to authenticated;
grant execute on function public.grant_admin_access(text) to authenticated;
grant execute on function public.revoke_admin_access(uuid, boolean) to authenticated;
grant execute on function public.promote_to_superadmin(uuid, text) to authenticated;
