-- complete_onboarding now runs with the founder's own privileges (RLS and column
-- grants apply to every write). The one privileged step — setting
-- startups.onboarding_completed_at — lives in a SECURITY DEFINER helper in the
-- private schema, which the Data API does not expose.

create function private.mark_onboarding_complete(target_startup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.startups
  set onboarding_completed_at = now()
  where id = target_startup_id
    and owner_id = (select auth.uid())
    and onboarding_completed_at is null;
  if not found then
    raise exception 'Startup not found or onboarding already complete.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.mark_onboarding_complete(uuid) from public, anon;
grant execute on function private.mark_onboarding_complete(uuid) to authenticated;

create or replace function public.complete_onboarding(payload jsonb)
returns uuid
language plpgsql
security invoker
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
    name, tagline, description, industry, stage, website, founded_year,
    team_size, founder_role, has_product, has_users, has_revenue, main_goal,
    biggest_challenge
  ) values (
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
    trim(payload ->> 'biggest_challenge')
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
    biggest_challenge = excluded.biggest_challenge
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
    insert into public.traction_entries (metric_id, value, recorded_on, note)
    values (v_metric_id, v_users, current_date, 'Recorded during onboarding');
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
    insert into public.traction_entries (metric_id, value, recorded_on, note)
    values (v_metric_id, v_revenue, current_date, 'Recorded during onboarding');
  end if;

  perform private.mark_onboarding_complete(v_startup_id);
  return v_startup_id;
end;
$$;
