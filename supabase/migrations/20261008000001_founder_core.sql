-- innoWIUT Founder Platform V1 — founder core functions.
--
--   complete_onboarding(payload)  one transaction: profile + startup + initial traction,
--                                 the only way onboarding_completed_at gets set
--   add_traction_metric(...)      metric + optional first entry for the caller's startup
--   record_traction(...)          several metric values in one transaction
--
-- Traction values are stored as raw entries; current/previous values remain derived by
-- the existing traction_entries trigger, never supplied by the client.

-- ---------------------------------------------------------------------------
-- Mentor contact fields shown on the founder Mentor page
-- ---------------------------------------------------------------------------

alter table public.mentors
  add column telegram text check (char_length(telegram) <= 200),
  add column linkedin_url text check (char_length(linkedin_url) <= 300);

grant insert (telegram, linkedin_url), update (telegram, linkedin_url)
  on public.mentors to authenticated;

-- ---------------------------------------------------------------------------
-- complete_onboarding
-- ---------------------------------------------------------------------------

create function public.complete_onboarding(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_role public.app_role;
  completed_at timestamptz;
  field text;
  v_has_product boolean;
  v_has_users boolean;
  v_has_revenue boolean;
  v_users numeric;
  v_revenue numeric;
  v_currency public.currency_code;
  v_startup_id uuid;
  v_metric_id uuid;
begin
  if caller is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select role into caller_role from public.profiles where id = caller;
  if caller_role is distinct from 'founder' then
    raise exception 'Only founder accounts can complete onboarding.' using errcode = '42501';
  end if;

  select onboarding_completed_at into completed_at from public.startups where owner_id = caller;
  if completed_at is not null then
    raise exception 'Onboarding is already complete.' using errcode = 'P0001';
  end if;

  foreach field in array array[
    'full_name', 'phone', 'role_in_startup', 'name', 'tagline', 'industry', 'stage',
    'founded_year', 'team_size', 'main_goal', 'biggest_challenge'
  ] loop
    if coalesce(trim(payload ->> field), '') = '' then
      raise exception 'Missing required field: %', field using errcode = '22023';
    end if;
  end loop;

  v_has_product := (payload ->> 'has_product')::boolean;
  v_has_users := (payload ->> 'has_users')::boolean;
  v_has_revenue := (payload ->> 'has_revenue')::boolean;
  if v_has_product is null or v_has_users is null or v_has_revenue is null then
    raise exception 'Answer every progress question.' using errcode = '22023';
  end if;

  if v_has_users then
    v_users := (payload ->> 'current_users')::numeric;
    if v_users is null or v_users < 0 then
      raise exception 'Enter your current number of users.' using errcode = '22023';
    end if;
  end if;

  if v_has_revenue then
    v_revenue := (payload ->> 'monthly_revenue')::numeric;
    v_currency := (payload ->> 'revenue_currency')::public.currency_code;
    if v_revenue is null or v_revenue < 0 or v_currency is null then
      raise exception 'Enter your monthly revenue and its currency.' using errcode = '22023';
    end if;
  end if;

  update public.profiles
  set
    full_name = left(trim(payload ->> 'full_name'), 120),
    phone = trim(payload ->> 'phone'),
    linkedin_url = nullif(trim(payload ->> 'linkedin_url'), '')
  where id = caller;

  insert into public.startups (
    owner_id, name, tagline, description, industry, stage, website, founded_year,
    team_size, founder_role, has_product, has_users, has_revenue, main_goal,
    biggest_challenge, onboarding_completed_at
  ) values (
    caller,
    trim(payload ->> 'name'),
    trim(payload ->> 'tagline'),
    nullif(trim(payload ->> 'description'), ''),
    payload ->> 'industry',
    payload ->> 'stage',
    nullif(trim(payload ->> 'website'), ''),
    (payload ->> 'founded_year')::integer,
    (payload ->> 'team_size')::integer,
    payload ->> 'role_in_startup',
    v_has_product,
    v_has_users,
    v_has_revenue,
    trim(payload ->> 'main_goal'),
    trim(payload ->> 'biggest_challenge'),
    now()
  )
  on conflict (owner_id) do update set
    name = excluded.name,
    tagline = excluded.tagline,
    description = excluded.description,
    industry = excluded.industry,
    stage = excluded.stage,
    website = excluded.website,
    founded_year = excluded.founded_year,
    team_size = excluded.team_size,
    founder_role = excluded.founder_role,
    has_product = excluded.has_product,
    has_users = excluded.has_users,
    has_revenue = excluded.has_revenue,
    main_goal = excluded.main_goal,
    biggest_challenge = excluded.biggest_challenge,
    onboarding_completed_at = excluded.onboarding_completed_at
  returning id into v_startup_id;

  -- Initial traction from the progress answers. Every column is set explicitly.
  if v_has_users then
    select id into v_metric_id from public.traction_metrics
    where startup_id = v_startup_id and lower(name) = 'active users' and not is_archived;
    if v_metric_id is null then
      insert into public.traction_metrics (startup_id, name, unit, currency, target, note)
      values (v_startup_id, 'Active Users', 'number', null, null, null)
      returning id into v_metric_id;
    end if;
    insert into public.traction_entries (metric_id, startup_id, value, recorded_on, note, created_by)
    values (v_metric_id, v_startup_id, v_users, current_date, 'Recorded during onboarding', caller);
  end if;

  if v_has_revenue then
    v_metric_id := null;
    select id into v_metric_id from public.traction_metrics
    where startup_id = v_startup_id and lower(name) = 'monthly revenue' and not is_archived;
    if v_metric_id is null then
      insert into public.traction_metrics (startup_id, name, unit, currency, target, note)
      values (v_startup_id, 'Monthly Revenue', 'currency', v_currency, null, null)
      returning id into v_metric_id;
    end if;
    insert into public.traction_entries (metric_id, startup_id, value, recorded_on, note, created_by)
    values (v_metric_id, v_startup_id, v_revenue, current_date, 'Recorded during onboarding', caller);
  end if;

  return v_startup_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_traction_metric (runs with the caller's privileges and RLS)
-- ---------------------------------------------------------------------------

create function public.add_traction_metric(
  p_name text,
  p_unit public.metric_unit,
  p_currency public.currency_code default null,
  p_target numeric default null,
  p_note text default null,
  p_initial_value numeric default null,
  p_recorded_on date default current_date
)
returns public.traction_metrics
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_startup_id uuid;
  v_metric public.traction_metrics;
begin
  select id into v_startup_id from public.startups where owner_id = (select auth.uid());
  if v_startup_id is null then
    raise exception 'Complete onboarding before adding metrics.' using errcode = 'P0002';
  end if;
  if p_initial_value is not null and (p_recorded_on is null or p_recorded_on > current_date + 1) then
    raise exception 'The entry date cannot be in the future.' using errcode = '22023';
  end if;

  insert into public.traction_metrics (startup_id, name, unit, currency, target, note)
  values (
    v_startup_id,
    trim(p_name),
    p_unit,
    case when p_unit = 'currency' then p_currency end,
    p_target,
    nullif(trim(p_note), '')
  )
  returning * into v_metric;

  if p_initial_value is not null then
    insert into public.traction_entries (metric_id, value, recorded_on, note)
    values (v_metric.id, p_initial_value, p_recorded_on, null);
    select * into v_metric from public.traction_metrics where id = v_metric.id;
  end if;

  return v_metric;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_traction (runs with the caller's privileges and RLS)
--   p_entries: [{ "metric_id": "<uuid>", "value": 123 }, ...]
-- ---------------------------------------------------------------------------

create function public.record_traction(
  p_entries jsonb,
  p_recorded_on date default current_date,
  p_note text default null
)
returns setof public.traction_metrics
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  metric_ids uuid[] := '{}';
begin
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'Enter a new value for at least one metric.' using errcode = '22023';
  end if;
  if p_recorded_on is null or p_recorded_on > current_date + 1 then
    raise exception 'The entry date cannot be in the future.' using errcode = '22023';
  end if;
  if (select count(distinct value ->> 'metric_id') from jsonb_array_elements(p_entries))
     <> jsonb_array_length(p_entries) then
    raise exception 'Each metric can only be recorded once per update.' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_entries) loop
    if exists (
      select 1 from public.traction_metrics
      where id = (item ->> 'metric_id')::uuid and is_archived
    ) then
      raise exception 'Archived metrics cannot be updated.' using errcode = '22023';
    end if;

    insert into public.traction_entries (metric_id, value, recorded_on, note)
    values (
      (item ->> 'metric_id')::uuid,
      (item ->> 'value')::numeric,
      p_recorded_on,
      nullif(trim(p_note), '')
    );
    metric_ids := metric_ids || (item ->> 'metric_id')::uuid;
  end loop;

  return query select * from public.traction_metrics where id = any (metric_ids);
end;
$$;

revoke all on function public.complete_onboarding(jsonb) from public, anon;
revoke all on function public.add_traction_metric(text, public.metric_unit, public.currency_code, numeric, text, numeric, date) from public, anon;
revoke all on function public.record_traction(jsonb, date, text) from public, anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
grant execute on function public.add_traction_metric(text, public.metric_unit, public.currency_code, numeric, text, numeric, date) to authenticated;
grant execute on function public.record_traction(jsonb, date, text) to authenticated;
