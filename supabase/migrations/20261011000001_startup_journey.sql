-- FounderTrack V2.1 — Startup Journey.
--
-- Additive and backward compatible with the V1 app:
--   * startups.stage (V1 label: 'Idea' | 'Validation' | 'MVP' | 'Early Traction' | 'Growth')
--     is kept exactly as it is. The journey stage lives in the new startups.journey_stage
--     column, derived from the V1 label once (Growth and Early Traction → traction).
--   * journey_stage is never written by clients and never advanced automatically. Completing
--     every requirement of a stage changes nothing on the startup; a controlled transition
--     comes in a later phase.
--   * startup_stage_requirements: one row per requirement and startup. Idea / Validation / MVP
--     rows come from fixed templates (created by trigger, backfilled here). Traction rows are
--     chosen by the founder and point at their existing traction metrics.
--   * stage_evidence: structured proof (link, file, metric reference, note). Traction values
--     are never copied — a 'metric' evidence row only references traction_metrics.
--   * startup_updates gains structured fields; every V1 column and row is untouched.
--   * Investor Readiness / Investor Access exist as stages but are locked: no requirement or
--     evidence row may use them.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.startup_stage as enum (
  'idea',
  'validation',
  'mvp',
  'traction',
  'investor_readiness',
  'investor_access'
);

create type public.requirement_status as enum (
  'not_started',
  'in_progress',
  'ready_for_review',
  'completed'
);

create type public.evidence_type as enum (
  'link',
  'screenshot',
  'document',
  'metric',
  'customer_feedback',
  'product_url',
  'text_note'
);

-- ---------------------------------------------------------------------------
-- Stage helpers
-- ---------------------------------------------------------------------------

-- Maps a V1 stage label (or a journey key) to a journey stage. Unknown → null.
create function private.normalize_stage(value text)
returns public.startup_stage
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(value, '')))
    when 'idea' then 'idea'::public.startup_stage
    when 'validation' then 'validation'::public.startup_stage
    when 'mvp' then 'mvp'::public.startup_stage
    when 'early traction' then 'traction'::public.startup_stage
    when 'growth' then 'traction'::public.startup_stage
    when 'traction' then 'traction'::public.startup_stage
  end;
$$;

-- Stages that are open in V2.1. Investor Readiness / Investor Access are locked.
create function private.is_open_stage(value public.startup_stage)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value in ('idea', 'validation', 'mvp', 'traction');
$$;

-- Traction requirements the founder may choose (no single universal business model).
create function private.traction_requirement_title(key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case key
    when 'active_users' then 'Active Users'
    when 'revenue' then 'Revenue'
    when 'mrr' then 'MRR'
    when 'pilots' then 'Pilots'
    when 'retention' then 'Retention'
    when 'conversion' then 'Conversion'
    when 'transactions' then 'Transactions'
    when 'partnerships' then 'Partnerships'
    when 'lois' then 'LOIs'
    when 'waitlist' then 'Waitlist'
  end;
$$;

revoke all on function private.normalize_stage(text) from public, anon;
revoke all on function private.is_open_stage(public.startup_stage) from public, anon;
revoke all on function private.traction_requirement_title(text) from public, anon;
grant execute on function private.normalize_stage(text) to authenticated;
grant execute on function private.is_open_stage(public.startup_stage) to authenticated;
grant execute on function private.traction_requirement_title(text) to authenticated;

-- ---------------------------------------------------------------------------
-- startups.journey_stage
-- ---------------------------------------------------------------------------

alter table public.startups
  add column journey_stage public.startup_stage not null default 'idea';

-- Backfill from the V1 label without touching updated_at or any other column.
alter table public.startups disable trigger startups_set_updated_at;
update public.startups
set journey_stage = coalesce(private.normalize_stage(stage), 'idea')
where journey_stage is distinct from coalesce(private.normalize_stage(stage), 'idea');
alter table public.startups enable trigger startups_set_updated_at;

create index startups_journey_stage_idx on public.startups (journey_stage)
  where onboarding_completed_at is not null;

-- The journey stage follows the stage chosen during onboarding. Once onboarding is
-- complete it never changes from a client write (and there is no column grant for it).
create function private.sync_journey_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.onboarding_completed_at is null then
    new.journey_stage := coalesce(private.normalize_stage(new.stage), 'idea');
  end if;
  return new;
end;
$$;

create trigger startups_sync_journey_stage
  before insert or update of stage on public.startups
  for each row execute function private.sync_journey_stage();

-- ---------------------------------------------------------------------------
-- startup_stage_requirements
-- ---------------------------------------------------------------------------

create table public.startup_stage_requirements (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  stage public.startup_stage not null check (private.is_open_stage(stage)),
  requirement_key text not null check (requirement_key ~ '^[a-z0-9_]{1,60}$'),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text check (char_length(description) <= 500),
  required boolean not null default true,
  status public.requirement_status not null default 'not_started',
  progress_value numeric check (progress_value >= 0),
  progress_target numeric check (progress_target > 0),
  linked_metric_id uuid references public.traction_metrics (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint startup_stage_requirements_unique_key unique (startup_id, stage, requirement_key)
);

create index startup_stage_requirements_metric_idx
  on public.startup_stage_requirements (linked_metric_id);

create trigger startup_stage_requirements_set_updated_at
  before update on public.startup_stage_requirements
  for each row execute function private.set_updated_at();

-- completed_at is server-owned: set when a requirement becomes completed, cleared otherwise.
-- A linked metric must belong to the same startup.
create function private.check_stage_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.linked_metric_id is not null and not exists (
    select 1 from public.traction_metrics m
    where m.id = new.linked_metric_id and m.startup_id = new.startup_id
  ) then
    raise exception 'The linked metric does not belong to this startup.' using errcode = '22023';
  end if;

  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger startup_stage_requirements_check
  before insert or update on public.startup_stage_requirements
  for each row execute function private.check_stage_requirement();

-- Deterministic requirement templates for Idea, Validation and MVP.
create function private.stage_requirement_templates()
returns table (
  stage public.startup_stage,
  requirement_key text,
  title text,
  description text,
  progress_target numeric
)
language sql
immutable
set search_path = ''
as $$
  select t.stage::public.startup_stage, t.requirement_key, t.title, t.description, t.progress_target
  from (values
    ('idea', 'problem_statement', 'Problem Statement', 'What problem are you solving, and for whom?', null::numeric),
    ('idea', 'target_customer', 'Target Customer', 'Who exactly is your customer?', null),
    ('idea', 'solution', 'Solution', 'How does your product solve the problem?', null),
    ('idea', 'founder_team', 'Founder / Team', 'Who is building this, and why you?', null),
    ('idea', 'market_hypothesis', 'Market Hypothesis', 'What do you believe about the market you are entering?', null),
    ('validation', 'customer_interviews', 'Customer Interviews', 'How many potential customers have you spoken to?', 10),
    ('validation', 'problem_validation', 'Problem Validation', 'What did customers confirm about the problem?', null),
    ('validation', 'customer_persona', 'Customer Persona', 'Describe the person you are building for.', null),
    ('validation', 'competitor_research', 'Competitor Research', 'Who else solves this, and how are you different?', null),
    ('validation', 'pricing_willingness', 'Pricing / Willingness to Pay', 'What have customers said they would pay?', null),
    ('validation', 'key_assumptions', 'Key Assumptions', 'Which assumptions must be true for this to work?', null),
    ('mvp', 'working_mvp', 'Working MVP', 'Does the product actually work end to end?', null),
    ('mvp', 'product_url', 'Product URL', 'Where can innoWIUT see the product?', null),
    ('mvp', 'demo', 'Demo', 'Show the product in action.', null),
    ('mvp', 'user_testing', 'User Testing', 'How many people have used it?', 5),
    ('mvp', 'user_feedback', 'User Feedback', 'What did users say after trying it?', null),
    ('mvp', 'core_workflow', 'Core Workflow', 'What is the one flow the product must nail?', null)
  ) as t (stage, requirement_key, title, description, progress_target);
$$;

-- Creates any missing template requirement for a startup. Idempotent; never changes
-- existing rows.
create function private.init_stage_requirements(target_startup_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.startup_stage_requirements (
    startup_id, stage, requirement_key, title, description, required, progress_target
  )
  select target_startup_id, t.stage, t.requirement_key, t.title, t.description, true, t.progress_target
  from private.stage_requirement_templates() t
  where exists (select 1 from public.startups s where s.id = target_startup_id)
  on conflict (startup_id, stage, requirement_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create function private.on_startup_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.init_stage_requirements(new.id);
  return new;
end;
$$;

create trigger startups_init_stage_requirements
  after insert on public.startups
  for each row execute function private.on_startup_created();

-- Backfill every existing startup.
do $$
begin
  perform private.init_stage_requirements(id) from public.startups;
end;
$$;

revoke all on function private.stage_requirement_templates() from public, anon, authenticated;
revoke all on function private.init_stage_requirements(uuid) from public, anon, authenticated;
revoke all on function private.on_startup_created() from public, anon, authenticated;
revoke all on function private.check_stage_requirement() from public, anon, authenticated;
revoke all on function private.sync_journey_stage() from public, anon, authenticated;

-- Privileges: founders read their own rows, update progress, and choose traction rows.
-- Admins read everything and write nothing.
alter table public.startup_stage_requirements enable row level security;
revoke all on public.startup_stage_requirements from anon, authenticated;
grant select, delete on public.startup_stage_requirements to authenticated;
grant insert (startup_id, stage, requirement_key, title, status, progress_value, linked_metric_id)
  on public.startup_stage_requirements to authenticated;
grant update (status, progress_value, linked_metric_id)
  on public.startup_stage_requirements to authenticated;

create policy "stage_requirements: read own startup or admin"
  on public.startup_stage_requirements for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create policy "stage_requirements: founder chooses traction metrics"
  on public.startup_stage_requirements for insert to authenticated
  with check (
    (select private.owns_startup(startup_id))
    and stage = 'traction'
    and title = private.traction_requirement_title(requirement_key)
  );

create policy "stage_requirements: founder updates progress"
  on public.startup_stage_requirements for update to authenticated
  using ((select private.owns_startup(startup_id)))
  with check ((select private.owns_startup(startup_id)));

create policy "stage_requirements: founder removes traction metrics"
  on public.startup_stage_requirements for delete to authenticated
  using ((select private.owns_startup(startup_id)) and stage = 'traction');

-- ---------------------------------------------------------------------------
-- startup_updates — structured fields (V1 columns and rows unchanged)
-- ---------------------------------------------------------------------------

alter table public.startup_updates
  add column progress_types text[] not null default '{}' check (
    cardinality(progress_types) <= 8
    and progress_types <@ array[
      'Product', 'Customer Validation', 'Traction', 'Revenue', 'Partnership', 'Team',
      'Fundraising Preparation', 'Other'
    ]::text[]
  ),
  add column blocker text check (char_length(blocker) <= 2000),
  add column next_milestone text check (char_length(next_milestone) <= 300),
  add column next_milestone_date date,
  add column linked_stage public.startup_stage check (
    linked_stage is null or private.is_open_stage(linked_stage)
  );

create index startup_updates_linked_stage_idx
  on public.startup_updates (startup_id, linked_stage)
  where linked_stage is not null;

grant insert (progress_types, blocker, next_milestone, next_milestone_date, linked_stage),
  update (progress_types, blocker, next_milestone, next_milestone_date, linked_stage)
  on public.startup_updates to authenticated;

-- ---------------------------------------------------------------------------
-- stage_evidence
-- ---------------------------------------------------------------------------

create table public.stage_evidence (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  requirement_id uuid references public.startup_stage_requirements (id) on delete set null,
  update_id uuid references public.startup_updates (id) on delete cascade,
  stage public.startup_stage not null check (private.is_open_stage(stage)),
  evidence_type public.evidence_type not null,
  label text not null check (char_length(trim(label)) between 1 and 200),
  text_value text check (char_length(text_value) <= 2000),
  url text check (char_length(url) <= 500 and url ~* '^https?://[^\s]+$'),
  file_path text check (char_length(file_path) <= 500),
  linked_metric_id uuid references public.traction_metrics (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Each type carries exactly the value that proves it.
  constraint stage_evidence_value_matches_type check (
    case evidence_type
      when 'link' then url is not null
      when 'product_url' then url is not null
      when 'screenshot' then file_path is not null
      when 'document' then file_path is not null
      when 'customer_feedback' then char_length(trim(text_value)) > 0
      when 'text_note' then char_length(trim(text_value)) > 0
      when 'metric' then true
    end
  ),
  -- Only metric evidence references a metric, and it always does.
  constraint stage_evidence_metric_only_for_metric_type check (
    (evidence_type = 'metric') = (linked_metric_id is not null)
  )
);

create index stage_evidence_startup_idx on public.stage_evidence (startup_id, stage, created_at desc);
create index stage_evidence_requirement_idx on public.stage_evidence (requirement_id);
create index stage_evidence_update_idx on public.stage_evidence (update_id);
create index stage_evidence_metric_idx on public.stage_evidence (linked_metric_id);
create index stage_evidence_created_by_idx on public.stage_evidence (created_by);

-- Every reference must belong to the same startup (and the requirement to the same
-- stage); files must live in the startup's own storage folder.
create function private.check_stage_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.requirement_id is not null and not exists (
    select 1 from public.startup_stage_requirements r
    where r.id = new.requirement_id and r.startup_id = new.startup_id and r.stage = new.stage
  ) then
    raise exception 'The requirement does not belong to this startup and stage.' using errcode = '22023';
  end if;
  if new.update_id is not null and not exists (
    select 1 from public.startup_updates u
    where u.id = new.update_id and u.startup_id = new.startup_id
  ) then
    raise exception 'The update does not belong to this startup.' using errcode = '22023';
  end if;
  if new.linked_metric_id is not null and not exists (
    select 1 from public.traction_metrics m
    where m.id = new.linked_metric_id and m.startup_id = new.startup_id
  ) then
    raise exception 'The linked metric does not belong to this startup.' using errcode = '22023';
  end if;
  if new.file_path is not null
     and private.storage_path_owner_id(new.file_path) is distinct from new.startup_id then
    raise exception 'Evidence files must be stored in the startup''s folder.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger stage_evidence_check
  before insert or update on public.stage_evidence
  for each row execute function private.check_stage_evidence();

revoke all on function private.check_stage_evidence() from public, anon, authenticated;

-- Evidence is append-only for founders (add or remove, never rewrite).
-- Admins read evidence, except evidence attached to an unpublished draft update.
alter table public.stage_evidence enable row level security;
revoke all on public.stage_evidence from anon, authenticated;
grant select, delete on public.stage_evidence to authenticated;
grant insert (
  startup_id, requirement_id, update_id, stage, evidence_type, label, text_value, url,
  file_path, linked_metric_id
) on public.stage_evidence to authenticated;

create function private.is_published_update(target_update_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.startup_updates
    where id = target_update_id and status = 'published'
  );
$$;

revoke all on function private.is_published_update(uuid) from public, anon;
grant execute on function private.is_published_update(uuid) to authenticated;

create policy "stage_evidence: founder reads own, admin reads non-draft"
  on public.stage_evidence for select to authenticated
  using (
    (select private.owns_startup(startup_id))
    or (
      (select private.is_admin())
      and (update_id is null or private.is_published_update(update_id))
    )
  );

create policy "stage_evidence: founder adds"
  on public.stage_evidence for insert to authenticated
  with check ((select private.owns_startup(startup_id)) and created_by = (select auth.uid()));

create policy "stage_evidence: founder removes"
  on public.stage_evidence for delete to authenticated
  using ((select private.owns_startup(startup_id)));

-- ---------------------------------------------------------------------------
-- Storage: evidence files reuse the private update-attachments bucket
-- (same owner-folder policies, signed URLs). PDFs are added for documents.
-- ---------------------------------------------------------------------------

update storage.buckets
set
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  file_size_limit = 5242880
where id = 'update-attachments';

-- ---------------------------------------------------------------------------
-- Admin: stage distribution and the startup list with journey stage
-- ---------------------------------------------------------------------------

create function public.admin_stage_distribution()
returns table (stage public.startup_stage, startups bigint)
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
  select st.stage, count(s.id)
  from unnest(enum_range(null::public.startup_stage)) as st (stage)
  left join public.startups s
    on s.journey_stage = st.stage and s.onboarding_completed_at is not null
  group by st.stage
  order by st.stage;
end;
$$;

revoke all on function public.admin_stage_distribution() from public, anon;
grant execute on function public.admin_stage_distribution() to authenticated;

-- Same as before plus journey_stage. p_stage accepts a journey key (V2.1) or a V1 label.
drop function public.admin_startup_list(text, text, text, text, text, text, integer, integer);

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
  journey_stage public.startup_stage,
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
  v_journey public.startup_stage;
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
  if p_stage is not null then
    if p_stage = any (enum_range(null::public.startup_stage)::text[]) then
      v_journey := p_stage::public.startup_stage;
    end if;
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
    s.journey_stage,
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
    and (
      p_stage is null
      or (v_journey is not null and s.journey_stage = v_journey)
      or (v_journey is null and s.stage = p_stage)
    )
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

revoke all on function public.admin_startup_list(text, text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_startup_list(text, text, text, text, text, text, integer, integer) to authenticated;
