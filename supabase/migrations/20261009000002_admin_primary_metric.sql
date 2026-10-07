-- Primary metric = the most recently updated metric. Metrics created in the same
-- transaction (e.g. during onboarding) share created_at, so break ties on
-- updated_at, which the traction trigger bumps whenever a value is recorded.

create or replace function public.admin_startup_list(
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
    order by m.last_recorded_on desc nulls last, m.updated_at desc, m.created_at, m.id
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
