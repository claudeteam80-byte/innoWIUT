-- innoWIUT Founder Platform V1 — admin core functions.
--
-- Every function runs with the caller's privileges (SECURITY INVOKER), so RLS
-- still applies, and additionally refuses non-admin callers.
--
--   admin_dashboard_stats()       ecosystem counts computed in the database
--   admin_startup_list(...)       server-side search / filter / sort / pagination
--   assign_mentor(startup, mentor) ends the active assignment, starts a new one
--   end_mentor_assignment(startup) ends the active assignment (history kept)
--   delete_mentor(mentor)          deletes an unused mentor, archives one with history

-- ---------------------------------------------------------------------------
-- Dashboard stats
-- ---------------------------------------------------------------------------

create function public.admin_dashboard_stats()
returns table (
  total_startups bigint,
  active_startups bigint,
  needs_update_startups bigint,
  inactive_startups bigint,
  updates_this_week bigint,
  growing_startups bigint,
  unassigned_startups bigint,
  open_meeting_requests bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  return query
  with onboarded as (
    select s.id from public.startups s where s.onboarding_completed_at is not null
  ),
  activity as (
    select a.activity_status from public.startup_activity a join onboarded o on o.id = a.startup_id
  )
  select
    (select count(*) from onboarded),
    (select count(*) from activity where activity_status = 'active'),
    (select count(*) from activity where activity_status = 'needs_update'),
    (select count(*) from activity where activity_status = 'inactive'),
    (select count(*) from public.startup_updates u join onboarded o on o.id = u.startup_id
      where u.status = 'published' and u.published_at >= now() - interval '7 days'),
    (select count(distinct m.startup_id) from public.traction_metrics m join onboarded o on o.id = m.startup_id
      where not m.is_archived and m.previous_value is not null and m.current_value > m.previous_value),
    (select count(*) from onboarded o where not exists (
      select 1 from public.mentor_assignments a where a.startup_id = o.id and a.ended_at is null)),
    (select count(*) from public.meeting_requests r where r.status = 'requested');
end;
$$;

-- ---------------------------------------------------------------------------
-- Startup list (search / filter / sort / paginate in the database)
-- ---------------------------------------------------------------------------

create function public.admin_startup_list(
  p_search text default null,
  p_stage text default null,
  p_industry text default null,
  p_activity text default null,
  p_mentor text default null,
  p_sort text default 'recent',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  tagline text,
  logo_path text,
  industry text,
  stage text,
  created_at timestamptz,
  founder_name text,
  founder_email text,
  primary_metric_name text,
  primary_metric_unit public.metric_unit,
  primary_metric_currency public.currency_code,
  primary_metric_value numeric,
  primary_metric_previous numeric,
  growth_percent numeric,
  last_active_on date,
  days_since_activity integer,
  activity_status text,
  mentor_id uuid,
  mentor_name text,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_search text := nullif(trim(p_search), '');
  v_pattern text;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if p_sort not in ('recent', 'growth', 'newest', 'oldest') then
    raise exception 'Unknown sort: %', p_sort using errcode = '22023';
  end if;
  if p_activity is not null and p_activity not in ('active', 'needs_update', 'inactive') then
    raise exception 'Unknown activity filter: %', p_activity using errcode = '22023';
  end if;
  if p_mentor is not null and p_mentor not in ('assigned', 'unassigned') then
    raise exception 'Unknown mentor filter: %', p_mentor using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid page.' using errcode = '22023';
  end if;

  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    s.id,
    s.name,
    s.tagline,
    s.logo_path,
    s.industry,
    s.stage,
    s.created_at,
    p.full_name,
    p.email,
    pm.metric_name,
    pm.metric_unit,
    pm.metric_currency,
    pm.metric_value,
    pm.metric_previous,
    g.growth,
    act.last_active_on,
    act.days_since_activity,
    act.activity_status,
    mt.mentor_id,
    mt.mentor_name,
    count(*) over ()
  from public.startups s
  join public.profiles p on p.id = s.owner_id
  join public.startup_activity act on act.startup_id = s.id
  left join lateral (
    select m.name as metric_name, m.unit as metric_unit, m.currency as metric_currency,
      m.current_value as metric_value, m.previous_value as metric_previous
    from public.traction_metrics m
    where m.startup_id = s.id and not m.is_archived
    order by m.last_recorded_on desc nulls last, m.created_at
    limit 1
  ) pm on true
  left join lateral (
    select max(
      case when m.previous_value > 0
        then round((m.current_value - m.previous_value) / m.previous_value * 100, 1)
      end
    ) as growth
    from public.traction_metrics m
    where m.startup_id = s.id and not m.is_archived
  ) g on true
  left join lateral (
    select me.id as mentor_id, me.name as mentor_name
    from public.mentor_assignments a
    join public.mentors me on me.id = a.mentor_id
    where a.startup_id = s.id and a.ended_at is null
    limit 1
  ) mt on true
  where s.onboarding_completed_at is not null
    and (v_pattern is null or s.name ilike v_pattern or p.full_name ilike v_pattern)
    and (p_stage is null or s.stage = p_stage)
    and (p_industry is null or s.industry = p_industry)
    and (p_activity is null or act.activity_status = p_activity)
    and (
      p_mentor is null
      or (p_mentor = 'assigned' and mt.mentor_id is not null)
      or (p_mentor = 'unassigned' and mt.mentor_id is null)
    )
  order by
    case when p_sort = 'recent' then act.last_active_on end desc nulls last,
    case when p_sort = 'growth' then g.growth end desc nulls last,
    case when p_sort = 'newest' then s.created_at end desc,
    case when p_sort = 'oldest' then s.created_at end asc,
    s.created_at desc,
    s.id
  limit p_limit
  offset p_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mentor assignment (one active per startup; history preserved)
-- ---------------------------------------------------------------------------

create function public.assign_mentor(p_startup_id uuid, p_mentor_id uuid)
returns public.mentor_assignments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.mentor_assignments;
  v_new public.mentor_assignments;
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.startups where id = p_startup_id) then
    raise exception 'Startup not found.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.mentors where id = p_mentor_id and is_active) then
    raise exception 'Mentor not found or archived.' using errcode = 'P0002';
  end if;

  select * into v_current
  from public.mentor_assignments
  where startup_id = p_startup_id and ended_at is null
  for update;

  if v_current.id is not null and v_current.mentor_id = p_mentor_id then
    return v_current;
  end if;

  if v_current.id is not null then
    update public.mentor_assignments set ended_at = now() where id = v_current.id;
  end if;

  insert into public.mentor_assignments (startup_id, mentor_id)
  values (p_startup_id, p_mentor_id)
  returning * into v_new;
  return v_new;
end;
$$;

create function public.end_mentor_assignment(p_startup_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  update public.mentor_assignments
  set ended_at = now()
  where startup_id = p_startup_id and ended_at is null;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mentor deletion: never while assigned; archive instead of losing history
-- ---------------------------------------------------------------------------

create function public.delete_mentor(p_mentor_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.mentor_assignments where mentor_id = p_mentor_id and ended_at is null
  ) then
    raise exception 'This mentor is assigned to a startup. Remove the assignment first.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.mentor_assignments where mentor_id = p_mentor_id)
     or exists (select 1 from public.mentor_notes where mentor_id = p_mentor_id)
     or exists (select 1 from public.meeting_requests where mentor_id = p_mentor_id) then
    update public.mentors set is_active = false where id = p_mentor_id;
    if not found then
      raise exception 'Mentor not found.' using errcode = 'P0002';
    end if;
    return 'archived';
  end if;

  delete from public.mentors where id = p_mentor_id;
  if not found then
    raise exception 'Mentor not found.' using errcode = 'P0002';
  end if;
  return 'deleted';
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
revoke all on function public.admin_startup_list(text, text, text, text, text, text, integer, integer) from public, anon;
revoke all on function public.assign_mentor(uuid, uuid) from public, anon;
revoke all on function public.end_mentor_assignment(uuid) from public, anon;
revoke all on function public.delete_mentor(uuid) from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_startup_list(text, text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.assign_mentor(uuid, uuid) to authenticated;
grant execute on function public.end_mentor_assignment(uuid) to authenticated;
grant execute on function public.delete_mentor(uuid) to authenticated;

-- Indexes for the admin list and history lookups.
create index startups_onboarded_created_idx on public.startups (created_at desc)
  where onboarding_completed_at is not null;
create index mentor_notes_mentor_id_idx on public.mentor_notes (mentor_id);
create index meeting_requests_mentor_id_idx on public.meeting_requests (mentor_id);
