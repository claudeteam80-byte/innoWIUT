-- FounderTrack V2.3 — Investor Readiness.
--
-- Additive and backward compatible with V1 / V2.1 / V2.2:
--   * investor_readiness becomes an open stage. A startup only reaches it through an approved
--     Traction stage review (V2.2 controlled transition); investor_access stays locked and is
--     reached only through an approved Investor Readiness review.
--   * stage_reviews gains review_type ('stage' | 'investor_readiness'); every existing review
--     is 'stage'. One table, one immutable history, explicit type.
--   * Readiness requirements REFERENCE existing data (startups, team_members, traction metrics,
--     journey evidence) instead of copying it. Only readiness-specific facts are stored:
--     investor_readiness_profiles (typed fundraising / legal / team commitment fields),
--     investor_readiness_requirements (text answers, links, not-applicable reasons),
--     investor_readiness_metrics (which existing traction metrics are primary — no values).
--   * Completion is computed in one place (private.readiness_state) from mandatory,
--     applicable requirements. It is a completion measure, never a score.
--   * Readiness evidence reuses stage_evidence (new readiness_requirement_id column) and the
--     private update-attachments bucket. No new bucket.
--   * Optional, admin-controlled interview per startup (readiness_interviews). Founders can
--     read status, time and place, never the admin note, and never write.
--   * Startups not in Investor Readiness get no readiness data. Initialisation is idempotent.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.review_type as enum ('stage', 'investor_readiness');
create type public.readiness_section as enum (
  'company',
  'problem_market',
  'product',
  'traction',
  'business_model',
  'team',
  'fundraising',
  'legal_operations',
  'investor_materials'
);
create type public.interview_status as enum ('not_required', 'scheduled', 'completed');
create type public.team_commitment as enum ('full_time', 'part_time');

-- ---------------------------------------------------------------------------
-- Stages: Investor Readiness opens; Investor Access stays locked
-- ---------------------------------------------------------------------------

create or replace function private.is_open_stage(value public.startup_stage)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value in ('idea', 'validation', 'mvp', 'traction', 'investor_readiness');
$$;

create or replace function private.next_open_stage(value public.startup_stage)
returns public.startup_stage
language sql
immutable
set search_path = ''
as $$
  select case value
    when 'idea' then 'validation'::public.startup_stage
    when 'validation' then 'mvp'::public.startup_stage
    when 'mvp' then 'traction'::public.startup_stage
    when 'traction' then 'investor_readiness'::public.startup_stage
    when 'investor_readiness' then 'investor_access'::public.startup_stage
  end;
$$;

-- Current journey stage of a startup (for policies).
create function private.startup_stage(target_startup_id uuid)
returns public.startup_stage
language sql
stable
security definer
set search_path = ''
as $$
  select journey_stage from public.startups where id = target_startup_id;
$$;

revoke all on function private.startup_stage(uuid) from public, anon;
grant execute on function private.startup_stage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Team: readiness-specific facts only (no HR system)
-- ---------------------------------------------------------------------------

alter table public.team_members
  add column relevant_experience text check (char_length(relevant_experience) <= 1000),
  add column commitment public.team_commitment;

grant insert (relevant_experience, commitment), update (relevant_experience, commitment)
  on public.team_members to authenticated;

-- ---------------------------------------------------------------------------
-- investor_readiness_profiles: typed readiness facts that exist nowhere else
-- ---------------------------------------------------------------------------

create table public.investor_readiness_profiles (
  startup_id uuid primary key references public.startups (id) on delete cascade,
  business_type text check (
    business_type in ('B2B', 'B2C', 'B2B2C', 'Marketplace', 'B2G', 'Other')
  ),
  product_stage text check (
    product_stage in ('prototype', 'mvp', 'beta', 'launched', 'scaling')
  ),
  founder_experience text check (char_length(founder_experience) <= 2000),
  founder_commitment public.team_commitment,
  is_fundraising boolean,
  round_type text check (
    round_type in ('pre_seed', 'seed', 'series_a', 'bridge', 'grant', 'other')
  ),
  target_raise numeric check (target_raise > 0),
  raise_currency public.currency_code,
  use_of_funds text check (char_length(use_of_funds) <= 2000),
  runway_months integer check (runway_months between 0 and 240),
  previous_funding text check (char_length(previous_funding) <= 1000),
  valuation numeric check (valuation > 0),
  round_outcome text check (char_length(round_outcome) <= 1000),
  company_registered boolean,
  jurisdiction text check (char_length(jurisdiction) <= 120),
  legal_entity_name text check (char_length(legal_entity_name) <= 200),
  cap_table_prepared boolean,
  ip_ownership_clear boolean,
  has_legal_blockers boolean,
  legal_blockers_note text check (char_length(legal_blockers_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investor_readiness_profiles_raise_currency
    check (target_raise is null or raise_currency is not null)
);

create trigger investor_readiness_profiles_set_updated_at
  before update on public.investor_readiness_profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- investor_readiness_requirements
-- ---------------------------------------------------------------------------

create table public.investor_readiness_requirements (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  section public.readiness_section not null,
  requirement_key text not null check (requirement_key ~ '^[a-z0-9_]{1,60}$'),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text check (char_length(description) <= 500),
  required boolean not null default true,
  -- How the requirement is satisfied: computed from existing data, a text answer,
  -- a link or file, or either a text answer or evidence.
  input_kind text not null check (input_kind in ('derived', 'text', 'link_or_file', 'text_or_evidence')),
  allows_not_applicable boolean not null default false,
  sort_order smallint not null default 0,
  status public.requirement_status not null default 'not_started',
  text_value text check (char_length(text_value) <= 4000),
  url text check (char_length(url) <= 500 and url ~* '^https?://[^\s]+$'),
  linked_metric_id uuid references public.traction_metrics (id) on delete set null,
  linked_team_member_id uuid references public.team_members (id) on delete set null,
  linked_existing_evidence_id uuid references public.stage_evidence (id) on delete set null,
  not_applicable boolean not null default false,
  not_applicable_reason text check (char_length(not_applicable_reason) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investor_readiness_requirements_unique_key unique (startup_id, requirement_key),
  constraint investor_readiness_requirements_not_applicable check (
    not not_applicable
    or (allows_not_applicable and char_length(trim(coalesce(not_applicable_reason, ''))) >= 3)
  )
);

create index investor_readiness_requirements_startup_idx
  on public.investor_readiness_requirements (startup_id, sort_order);
create index investor_readiness_requirements_metric_idx
  on public.investor_readiness_requirements (linked_metric_id);
create index investor_readiness_requirements_team_idx
  on public.investor_readiness_requirements (linked_team_member_id);
create index investor_readiness_requirements_evidence_idx
  on public.investor_readiness_requirements (linked_existing_evidence_id);

-- ---------------------------------------------------------------------------
-- investor_readiness_metrics: which EXISTING traction metrics are primary (no values)
-- ---------------------------------------------------------------------------

create table public.investor_readiness_metrics (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  metric_id uuid not null references public.traction_metrics (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint investor_readiness_metrics_unique unique (startup_id, metric_id)
);

create index investor_readiness_metrics_metric_idx on public.investor_readiness_metrics (metric_id);

create function private.check_readiness_metric()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.traction_metrics m
    where m.id = new.metric_id and m.startup_id = new.startup_id and not m.is_archived
  ) then
    raise exception 'The metric does not belong to this startup.' using errcode = '22023';
  end if;
  if (select count(*) from public.investor_readiness_metrics where startup_id = new.startup_id) >= 5 then
    raise exception 'Choose at most five primary investor metrics.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger investor_readiness_metrics_check
  before insert on public.investor_readiness_metrics
  for each row execute function private.check_readiness_metric();

-- ---------------------------------------------------------------------------
-- Readiness evidence: reuse stage_evidence
-- ---------------------------------------------------------------------------

alter table public.stage_evidence
  add column readiness_requirement_id uuid
    references public.investor_readiness_requirements (id) on delete set null;

create index stage_evidence_readiness_requirement_idx
  on public.stage_evidence (readiness_requirement_id);

grant insert (readiness_requirement_id) on public.stage_evidence to authenticated;

create or replace function private.check_stage_evidence()
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
  if new.readiness_requirement_id is not null and (
    new.stage <> 'investor_readiness'
    or not exists (
      select 1 from public.investor_readiness_requirements r
      where r.id = new.readiness_requirement_id and r.startup_id = new.startup_id
    )
  ) then
    raise exception 'The readiness requirement does not belong to this startup.' using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- Requirement row status: maintained from the row's own input (and its evidence)
-- ---------------------------------------------------------------------------

create function private.prepare_readiness_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_input boolean;
  v_done boolean;
begin
  if new.linked_existing_evidence_id is not null and not exists (
    select 1 from public.stage_evidence e
    where e.id = new.linked_existing_evidence_id and e.startup_id = new.startup_id
  ) then
    raise exception 'The linked evidence does not belong to this startup.' using errcode = '22023';
  end if;
  if new.linked_team_member_id is not null and not exists (
    select 1 from public.team_members t
    where t.id = new.linked_team_member_id and t.startup_id = new.startup_id
  ) then
    raise exception 'The team member does not belong to this startup.' using errcode = '22023';
  end if;
  if new.linked_metric_id is not null and not exists (
    select 1 from public.traction_metrics m
    where m.id = new.linked_metric_id and m.startup_id = new.startup_id
  ) then
    raise exception 'The linked metric does not belong to this startup.' using errcode = '22023';
  end if;
  if not new.not_applicable then
    new.not_applicable_reason := null;
  end if;

  -- Derived requirements are computed live (private.readiness_state); only input rows
  -- carry a status of their own.
  if new.input_kind <> 'derived' then
    v_has_input := coalesce(trim(new.text_value), '') <> ''
      or new.url is not null
      or new.linked_existing_evidence_id is not null
      or exists (select 1 from public.stage_evidence e where e.readiness_requirement_id = new.id);
    v_done := new.not_applicable or v_has_input;
    new.status := case when v_done then 'completed'::public.requirement_status
                       else 'not_started'::public.requirement_status end;
    if v_done then
      new.completed_at := coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now());
    else
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger investor_readiness_requirements_prepare
  before insert or update on public.investor_readiness_requirements
  for each row execute function private.prepare_readiness_requirement();

create trigger investor_readiness_requirements_set_updated_at
  before update on public.investor_readiness_requirements
  for each row execute function private.set_updated_at();

-- Evidence added to or removed from a requirement refreshes that requirement's status.
create function private.touch_readiness_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.readiness_requirement_id is not null then
    update public.investor_readiness_requirements set updated_at = now()
    where id = new.readiness_requirement_id;
  end if;
  if tg_op in ('DELETE', 'UPDATE') and old.readiness_requirement_id is not null then
    update public.investor_readiness_requirements set updated_at = now()
    where id = old.readiness_requirement_id;
  end if;
  return null;
end;
$$;

create trigger stage_evidence_touch_readiness
  after insert or update or delete on public.stage_evidence
  for each row execute function private.touch_readiness_requirement();

-- ---------------------------------------------------------------------------
-- Templates and initialisation (idempotent)
-- ---------------------------------------------------------------------------

create function private.readiness_requirement_templates()
returns table (
  section public.readiness_section,
  requirement_key text,
  title text,
  description text,
  required boolean,
  input_kind text,
  allows_not_applicable boolean,
  sort_order smallint
)
language sql
immutable
set search_path = ''
as $$
  select t.section::public.readiness_section, t.requirement_key, t.title, t.description,
         t.required, t.input_kind, t.allows_na, t.sort_order::smallint
  from (values
    ('company', 'startup_name', 'Startup Name', 'From your startup profile.', true, 'derived', false, 10),
    ('company', 'one_line_description', 'One-line Description', 'From your startup profile.', true, 'derived', false, 11),
    ('company', 'industry', 'Industry', 'From your startup profile.', true, 'derived', false, 12),
    ('company', 'business_type', 'Business Type', 'B2B, B2C, marketplace…', true, 'derived', false, 13),
    ('company', 'founded_year', 'Founded Year', 'From your startup profile.', true, 'derived', false, 14),
    ('company', 'website', 'Website / Product Link', 'From your startup profile or product evidence.', true, 'derived', false, 15),
    ('problem_market', 'problem_statement', 'Problem Statement', 'The problem in your customer''s words, and what it costs them.', true, 'text_or_evidence', false, 20),
    ('problem_market', 'target_customer', 'Target Customer', 'Who exactly buys and uses the product.', true, 'text_or_evidence', false, 21),
    ('problem_market', 'market_opportunity', 'Market Opportunity', 'Why this market, and why now.', true, 'text_or_evidence', false, 22),
    ('problem_market', 'market_size', 'Market Size', 'How big the opportunity is, with the sources behind your numbers.', true, 'text_or_evidence', false, 23),
    ('problem_market', 'key_competitors', 'Key Competitors', 'Who else solves this today.', true, 'text_or_evidence', false, 24),
    ('problem_market', 'competitive_advantage', 'Competitive Advantage', 'Why customers choose you over the alternatives.', true, 'text_or_evidence', false, 25),
    ('product', 'working_product', 'Working Product / MVP', 'A product a customer can use today.', true, 'text_or_evidence', false, 30),
    ('product', 'product_url', 'Product URL', 'Where an investor can see the product.', true, 'link_or_file', false, 31),
    ('product', 'demo', 'Demo', 'A video or walkthrough of the product in action.', true, 'link_or_file', false, 32),
    ('product', 'core_value_proposition', 'Core Value Proposition', 'The one thing the product does better than anything else.', true, 'text', false, 33),
    ('product', 'current_product_stage', 'Current Product Stage', 'Prototype, MVP, beta, launched or scaling.', true, 'derived', false, 34),
    ('traction', 'primary_investor_metrics', 'Primary Investor Metrics', 'Choose the existing traction metrics an investor should see first.', true, 'derived', false, 40),
    ('business_model', 'revenue_model', 'Revenue Model', 'How money reaches the company, and from whom.', true, 'text', true, 50),
    ('business_model', 'pricing_model', 'Pricing Model', 'What you charge and how.', true, 'text', true, 51),
    ('business_model', 'primary_revenue_stream', 'Primary Revenue Stream', 'Where most revenue comes from (or will).', true, 'text', true, 52),
    ('business_model', 'customer_acquisition', 'Customer Acquisition', 'How customers find and buy the product.', true, 'text', true, 53),
    ('business_model', 'unit_economics', 'Unit Economics', 'What one customer is worth versus what it costs to win them.', true, 'text', true, 54),
    ('business_model', 'cac', 'CAC', 'Customer acquisition cost.', false, 'text', true, 55),
    ('business_model', 'ltv', 'LTV', 'Customer lifetime value.', false, 'text', true, 56),
    ('business_model', 'gross_margin', 'Gross Margin', 'Revenue left after direct costs.', false, 'text', true, 57),
    ('team', 'founder_experience', 'Founder Experience', 'Your relevant experience for this problem.', true, 'derived', false, 60),
    ('team', 'founder_commitment', 'Founder Commitment', 'Full-time or part-time.', true, 'derived', false, 61),
    ('team', 'team_details', 'Team Experience & Commitment', 'Experience and commitment for each team member on your profile.', true, 'derived', false, 62),
    ('fundraising', 'fundraising_status', 'Currently Fundraising', 'Whether you are raising now.', true, 'derived', false, 70),
    ('fundraising', 'round_type', 'Round Type', 'Pre-seed, seed, bridge…', true, 'derived', false, 71),
    ('fundraising', 'target_raise', 'Target Raise', 'Amount and currency.', true, 'derived', false, 72),
    ('fundraising', 'use_of_funds', 'Use of Funds', 'Exactly what the money buys.', true, 'derived', false, 73),
    ('fundraising', 'runway', 'Runway', 'Months of runway today.', true, 'derived', false, 74),
    ('fundraising', 'previous_funding', 'Previous Funding', 'Grants, angels or rounds so far (or none).', true, 'derived', false, 75),
    ('fundraising', 'round_outcome', 'Target Outcome', 'What this round lets you prove or reach.', true, 'derived', false, 76),
    ('fundraising', 'valuation', 'Valuation', 'Optional.', false, 'derived', false, 77),
    ('legal_operations', 'company_registered', 'Company Registered', 'Whether the company is a registered legal entity.', true, 'derived', false, 80),
    ('legal_operations', 'jurisdiction', 'Jurisdiction', 'Where the company is registered.', true, 'derived', false, 81),
    ('legal_operations', 'legal_entity_name', 'Legal Entity Name', 'The registered company name.', true, 'derived', false, 82),
    ('legal_operations', 'cap_table_prepared', 'Cap Table Prepared', 'Whether ownership is documented.', true, 'derived', false, 83),
    ('legal_operations', 'ip_ownership_clear', 'IP Ownership Clear', 'Whether the company owns its IP.', true, 'derived', false, 84),
    ('legal_operations', 'legal_blockers', 'Major Legal Blockers', 'Anything that could stop an investment.', true, 'derived', false, 85),
    ('investor_materials', 'pitch_deck', 'Pitch Deck', 'The deck you would send an investor tomorrow.', true, 'link_or_file', false, 90),
    ('investor_materials', 'one_pager', 'One-pager', 'Optional.', false, 'link_or_file', false, 91),
    ('investor_materials', 'financial_model', 'Financial Model', 'Assumptions an investor can stress-test.', true, 'link_or_file', true, 92),
    ('investor_materials', 'product_demo', 'Product Demo', 'Reuses your product demo when it exists.', true, 'link_or_file', false, 93),
    ('investor_materials', 'data_room', 'Data Room Link', 'Optional.', false, 'link_or_file', false, 94)
  ) as t (section, requirement_key, title, description, required, input_kind, allows_na, sort_order);
$$;

create function private.init_investor_readiness(target_startup_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if not exists (select 1 from public.startups where id = target_startup_id) then
    return 0;
  end if;
  insert into public.investor_readiness_profiles (startup_id)
  values (target_startup_id)
  on conflict (startup_id) do nothing;
  insert into public.investor_readiness_requirements (
    startup_id, section, requirement_key, title, description, required, input_kind,
    allows_not_applicable, sort_order
  )
  select target_startup_id, t.section, t.requirement_key, t.title, t.description, t.required,
         t.input_kind, t.allows_not_applicable, t.sort_order
  from private.readiness_requirement_templates() t
  on conflict (startup_id, requirement_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- Entering Investor Readiness (only via an approved Traction review) initialises it.
create function private.on_journey_stage_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.journey_stage = 'investor_readiness' then
    perform private.init_investor_readiness(new.id);
  end if;
  return null;
end;
$$;

create trigger startups_init_investor_readiness
  after update of journey_stage on public.startups
  for each row
  when (new.journey_stage is distinct from old.journey_stage)
  execute function private.on_journey_stage_changed();

-- Backfill only startups that are already in Investor Readiness (none in production).
do $$
begin
  perform private.init_investor_readiness(id)
  from public.startups where journey_stage = 'investor_readiness';
end;
$$;

-- ---------------------------------------------------------------------------
-- Completion: one implementation, used by the API, the review gate and the UI
-- ---------------------------------------------------------------------------

create function private.readiness_state(p_startup_id uuid)
returns table (
  requirement_id uuid,
  section public.readiness_section,
  requirement_key text,
  title text,
  description text,
  required boolean,
  input_kind text,
  allows_not_applicable boolean,
  sort_order smallint,
  not_applicable boolean,
  is_complete boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.startups where id = p_startup_id),
  p as (select * from public.investor_readiness_profiles where startup_id = p_startup_id),
  facts as (
    select
      exists (
        select 1 from public.stage_evidence e
        where e.startup_id = p_startup_id and e.evidence_type = 'product_url'
      ) as has_product_url,
      exists (
        select 1 from public.startup_stage_requirements q
        where q.startup_id = p_startup_id and q.requirement_key = 'working_mvp' and q.status = 'completed'
      ) as mvp_working,
      (
        select count(*) from public.investor_readiness_metrics m
        join public.traction_metrics t on t.id = m.metric_id
        where m.startup_id = p_startup_id and not t.is_archived and t.current_value is not null
      ) as metrics_with_values,
      not exists (
        select 1 from public.team_members tm
        where tm.startup_id = p_startup_id
          and (tm.commitment is null or coalesce(trim(tm.relevant_experience), '') = '')
      ) as team_complete
  ),
  own as (
    select r.*,
      coalesce(trim(r.text_value), '') <> ''
        or r.url is not null
        or r.linked_existing_evidence_id is not null
        or exists (select 1 from public.stage_evidence e where e.readiness_requirement_id = r.id)
        as has_input
    from public.investor_readiness_requirements r
    where r.startup_id = p_startup_id
  ),
  eval as (
    select o.*,
      (
        o.not_applicable
        or (o.requirement_key in ('round_type', 'target_raise', 'use_of_funds', 'runway',
              'previous_funding', 'round_outcome', 'valuation')
            and (select is_fundraising from p) is false)
        or (o.requirement_key in ('jurisdiction', 'legal_entity_name')
            and (select company_registered from p) is false)
      ) as na,
      case o.requirement_key
        when 'startup_name' then coalesce(trim((select name from s)), '') <> ''
        when 'one_line_description' then coalesce(trim((select tagline from s)), '') <> ''
        when 'industry' then (select industry from s) is not null
        when 'business_type' then (select business_type from p) is not null
        when 'founded_year' then (select founded_year from s) is not null
        when 'website' then coalesce(trim((select website from s)), '') <> ''
          or o.url is not null or (select has_product_url from facts)
        when 'working_product' then o.has_input or (select mvp_working from facts)
        when 'product_url' then o.has_input or (select has_product_url from facts)
        when 'current_product_stage' then (select product_stage from p) is not null
        when 'primary_investor_metrics' then (select metrics_with_values from facts) > 0
        when 'founder_experience' then coalesce(trim((select founder_experience from p)), '') <> ''
        when 'founder_commitment' then (select founder_commitment from p) is not null
        when 'team_details' then (select team_complete from facts)
        when 'fundraising_status' then (select is_fundraising from p) is not null
        when 'round_type' then (select round_type from p) is not null
        when 'target_raise' then (select target_raise from p) is not null
        when 'use_of_funds' then coalesce(trim((select use_of_funds from p)), '') <> ''
        when 'runway' then (select runway_months from p) is not null
        when 'previous_funding' then coalesce(trim((select previous_funding from p)), '') <> ''
        when 'round_outcome' then coalesce(trim((select round_outcome from p)), '') <> ''
        when 'valuation' then (select valuation from p) is not null
        when 'company_registered' then (select company_registered from p) is not null
        when 'jurisdiction' then coalesce(trim((select jurisdiction from p)), '') <> ''
        when 'legal_entity_name' then coalesce(trim((select legal_entity_name from p)), '') <> ''
        when 'cap_table_prepared' then (select cap_table_prepared from p) is not null
        when 'ip_ownership_clear' then (select ip_ownership_clear from p) is not null
        when 'legal_blockers' then (select has_legal_blockers from p) is false
          or ((select has_legal_blockers from p) and coalesce(trim((select legal_blockers_note from p)), '') <> '')
        else o.has_input
      end as done
    from own o
  )
  select e.id, e.section, e.requirement_key, e.title, e.description, e.required, e.input_kind,
         e.allows_not_applicable, e.sort_order, e.na,
         -- Product Demo reuses the product section's demo when it exists.
         (not e.na) and (
           coalesce(e.done, false)
           or (e.requirement_key = 'product_demo' and exists (
             select 1 from eval d where d.requirement_key = 'demo' and d.done
           ))
         )
  from eval e
  order by e.sort_order;
$$;

-- Mandatory, applicable requirements only. Not-applicable rows count in neither number.
create function private.readiness_completion(p_startup_id uuid)
returns table (total integer, completed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer, count(*) filter (where is_complete)::integer
  from private.readiness_state(p_startup_id)
  where required and not not_applicable;
$$;

revoke all on function private.readiness_state(uuid) from public, anon, authenticated;
revoke all on function private.readiness_completion(uuid) from public, anon, authenticated;
revoke all on function private.readiness_requirement_templates() from public, anon, authenticated;
revoke all on function private.init_investor_readiness(uuid) from public, anon, authenticated;
revoke all on function private.on_journey_stage_changed() from public, anon, authenticated;
revoke all on function private.prepare_readiness_requirement() from public, anon, authenticated;
revoke all on function private.touch_readiness_requirement() from public, anon, authenticated;
revoke all on function private.check_readiness_metric() from public, anon, authenticated;

-- Caller-checked entry to the state (founder of the startup or an admin).
create function private.readiness_state_for_caller(p_startup_id uuid)
returns setof record
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.owns_startup(p_startup_id) or private.is_admin()) then
    raise exception 'You can only view your own startup''s readiness.' using errcode = '42501';
  end if;
  return query select * from private.readiness_state(p_startup_id);
end;
$$;

revoke all on function private.readiness_state_for_caller(uuid) from public, anon;
grant execute on function private.readiness_state_for_caller(uuid) to authenticated;

create function public.investor_readiness_state(p_startup_id uuid)
returns table (
  requirement_id uuid,
  section public.readiness_section,
  requirement_key text,
  title text,
  description text,
  required boolean,
  input_kind text,
  allows_not_applicable boolean,
  sort_order smallint,
  not_applicable boolean,
  is_complete boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not ((select private.owns_startup(p_startup_id)) or (select private.is_admin())) then
    raise exception 'You can only view your own startup''s readiness.' using errcode = '42501';
  end if;
  return query
  select * from private.readiness_state_for_caller(p_startup_id) as x (
    requirement_id uuid,
    section public.readiness_section,
    requirement_key text,
    title text,
    description text,
    required boolean,
    input_kind text,
    allows_not_applicable boolean,
    sort_order smallint,
    not_applicable boolean,
    is_complete boolean
  );
end;
$$;

revoke all on function public.investor_readiness_state(uuid) from public, anon;
grant execute on function public.investor_readiness_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS for readiness data: founders edit their own while in Investor Readiness;
-- admins read everything and write nothing here.
-- ---------------------------------------------------------------------------

alter table public.investor_readiness_profiles enable row level security;
alter table public.investor_readiness_requirements enable row level security;
alter table public.investor_readiness_metrics enable row level security;
revoke all on public.investor_readiness_profiles from anon, authenticated;
revoke all on public.investor_readiness_requirements from anon, authenticated;
revoke all on public.investor_readiness_metrics from anon, authenticated;

grant select on public.investor_readiness_profiles to authenticated;
grant update (
  business_type, product_stage, founder_experience, founder_commitment, is_fundraising,
  round_type, target_raise, raise_currency, use_of_funds, runway_months, previous_funding,
  valuation, round_outcome, company_registered, jurisdiction, legal_entity_name,
  cap_table_prepared, ip_ownership_clear, has_legal_blockers, legal_blockers_note
) on public.investor_readiness_profiles to authenticated;

create policy "readiness_profiles: read own startup or admin"
  on public.investor_readiness_profiles for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));
create policy "readiness_profiles: founder updates while in readiness"
  on public.investor_readiness_profiles for update to authenticated
  using ((select private.owns_startup(startup_id)) and private.startup_stage(startup_id) = 'investor_readiness')
  with check ((select private.owns_startup(startup_id)) and private.startup_stage(startup_id) = 'investor_readiness');

grant select on public.investor_readiness_requirements to authenticated;
grant update (text_value, url, linked_existing_evidence_id, linked_team_member_id, linked_metric_id,
  not_applicable, not_applicable_reason)
  on public.investor_readiness_requirements to authenticated;

create policy "readiness_requirements: read own startup or admin"
  on public.investor_readiness_requirements for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));
create policy "readiness_requirements: founder updates while in readiness"
  on public.investor_readiness_requirements for update to authenticated
  using ((select private.owns_startup(startup_id)) and private.startup_stage(startup_id) = 'investor_readiness')
  with check ((select private.owns_startup(startup_id)) and private.startup_stage(startup_id) = 'investor_readiness');

grant select, delete on public.investor_readiness_metrics to authenticated;
grant insert (startup_id, metric_id) on public.investor_readiness_metrics to authenticated;

create policy "readiness_metrics: read own startup or admin"
  on public.investor_readiness_metrics for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));
create policy "readiness_metrics: founder chooses while in readiness"
  on public.investor_readiness_metrics for insert to authenticated
  with check ((select private.owns_startup(startup_id)) and private.startup_stage(startup_id) = 'investor_readiness');
create policy "readiness_metrics: founder removes while in readiness"
  on public.investor_readiness_metrics for delete to authenticated
  using ((select private.owns_startup(startup_id)) and private.startup_stage(startup_id) = 'investor_readiness');

-- ---------------------------------------------------------------------------
-- Optional, admin-controlled interview (one per startup)
-- ---------------------------------------------------------------------------

create table public.readiness_interviews (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null unique references public.startups (id) on delete cascade,
  status public.interview_status not null default 'not_required',
  scheduled_at timestamptz,
  location_or_link text check (char_length(location_or_link) <= 500),
  admin_note text check (char_length(admin_note) <= 2000),
  completed_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint readiness_interviews_scheduled check (
    status <> 'scheduled'
    or (scheduled_at is not null and char_length(trim(coalesce(location_or_link, ''))) > 0)
  ),
  constraint readiness_interviews_completed check (status <> 'completed' or completed_at is not null)
);

create index readiness_interviews_updated_by_idx on public.readiness_interviews (updated_by);

create trigger readiness_interviews_set_updated_at
  before update on public.readiness_interviews
  for each row execute function private.set_updated_at();

alter table public.readiness_interviews enable row level security;
revoke all on public.readiness_interviews from anon, authenticated;
-- The admin note is not readable through the table; admins read it via
-- admin_readiness_interview().
grant select (id, startup_id, status, scheduled_at, location_or_link, completed_at, created_at, updated_at)
  on public.readiness_interviews to authenticated;

create policy "readiness_interviews: read own startup or admin"
  on public.readiness_interviews for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create function private.set_readiness_interview(
  p_startup_id uuid,
  p_status public.interview_status,
  p_scheduled_at timestamptz,
  p_location_or_link text,
  p_admin_note text
)
returns public.readiness_interviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.readiness_interviews;
begin
  if not private.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if private.startup_stage(p_startup_id) is distinct from 'investor_readiness' then
    raise exception 'Interviews are only arranged during Investor Readiness.' using errcode = 'P0001';
  end if;
  insert into public.readiness_interviews (
    startup_id, status, scheduled_at, location_or_link, admin_note, completed_at, updated_by
  ) values (
    p_startup_id,
    p_status,
    p_scheduled_at,
    nullif(trim(coalesce(p_location_or_link, '')), ''),
    nullif(trim(coalesce(p_admin_note, '')), ''),
    case when p_status = 'completed' then now() end,
    (select auth.uid())
  )
  on conflict (startup_id) do update set
    status = excluded.status,
    scheduled_at = case when excluded.status = 'not_required' then null
                        else coalesce(excluded.scheduled_at, public.readiness_interviews.scheduled_at) end,
    location_or_link = case when excluded.status = 'not_required' then null
                            else coalesce(excluded.location_or_link, public.readiness_interviews.location_or_link) end,
    admin_note = excluded.admin_note,
    completed_at = case when excluded.status = 'completed'
                        then coalesce(public.readiness_interviews.completed_at, now()) end,
    updated_by = excluded.updated_by
  returning * into v_row;
  return v_row;
end;
$$;

create function private.get_readiness_interview(p_startup_id uuid)
returns setof public.readiness_interviews
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  return query select * from public.readiness_interviews where startup_id = p_startup_id;
end;
$$;

revoke all on function private.set_readiness_interview(uuid, public.interview_status, timestamptz, text, text) from public, anon;
revoke all on function private.get_readiness_interview(uuid) from public, anon;
grant execute on function private.set_readiness_interview(uuid, public.interview_status, timestamptz, text, text) to authenticated;
grant execute on function private.get_readiness_interview(uuid) to authenticated;

create function public.admin_set_readiness_interview(
  p_startup_id uuid,
  p_status public.interview_status,
  p_scheduled_at timestamptz default null,
  p_location_or_link text default null,
  p_admin_note text default null
)
returns public.readiness_interviews
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  return private.set_readiness_interview(p_startup_id, p_status, p_scheduled_at, p_location_or_link, p_admin_note);
end;
$$;

create function public.admin_readiness_interview(p_startup_id uuid)
returns setof public.readiness_interviews
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  return query select * from private.get_readiness_interview(p_startup_id);
end;
$$;

revoke all on function public.admin_set_readiness_interview(uuid, public.interview_status, timestamptz, text, text) from public, anon;
revoke all on function public.admin_readiness_interview(uuid) from public, anon;
grant execute on function public.admin_set_readiness_interview(uuid, public.interview_status, timestamptz, text, text) to authenticated;
grant execute on function public.admin_readiness_interview(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reviews: explicit review type; Investor Readiness uses readiness completion
-- ---------------------------------------------------------------------------

alter table public.stage_reviews
  add column review_type public.review_type not null default 'stage',
  add column attention_sections public.readiness_section[] not null default '{}';

alter table public.stage_reviews
  add constraint stage_reviews_type_matches_stage check (
    review_type = case when from_stage = 'investor_readiness'
                       then 'investor_readiness'::public.review_type
                       else 'stage'::public.review_type end
  );

create index stage_reviews_type_idx on public.stage_reviews (review_type, status, requested_at);

create or replace function private.prepare_stage_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.startup_stage;
  v_total integer;
  v_completed integer;
begin
  select journey_stage into v_stage
  from public.startups
  where id = new.startup_id and onboarding_completed_at is not null;
  if v_stage is null then
    raise exception 'Startup not found.' using errcode = 'P0002';
  end if;
  if private.next_open_stage(v_stage) is null then
    raise exception 'This stage cannot be reviewed yet.' using errcode = 'P0001';
  end if;

  if v_stage = 'investor_readiness' then
    select total, completed into v_total, v_completed
    from private.readiness_completion(new.startup_id);
    if v_total = 0 or v_completed < v_total then
      raise exception 'Complete every mandatory readiness requirement before requesting a review.'
        using errcode = 'P0001';
    end if;
    new.review_type := 'investor_readiness';
  else
    select count(*) filter (where required),
           count(*) filter (where required and status = 'completed')
    into v_total, v_completed
    from public.startup_stage_requirements
    where startup_id = new.startup_id and stage = v_stage;
    if v_total = 0 or v_completed < v_total then
      raise exception 'Complete every required milestone before requesting a review.'
        using errcode = 'P0001';
    end if;
    new.review_type := 'stage';
  end if;

  new.from_stage := v_stage;
  new.to_stage := private.next_open_stage(v_stage);
  new.status := 'pending';
  new.requirements_total := v_total;
  new.requirements_completed := v_completed;
  new.requested_by := (select auth.uid());
  new.requested_at := now();
  new.reviewed_by := null;
  new.reviewer_name := null;
  new.reviewed_at := null;
  new.feedback := null;
  new.admin_note := null;
  new.attention_requirement_ids := '{}';
  new.attention_sections := '{}';
  return new;
end;
$$;

-- Decision helper: same rules as V2.2, plus readiness requirements and sections.
drop function public.decide_stage_review(uuid, public.stage_review_status, text, text, uuid[]);
drop function private.apply_stage_review(uuid, public.stage_review_status, text, text, uuid[]);

create function private.apply_stage_review(
  p_review_id uuid,
  p_decision public.stage_review_status,
  p_feedback text,
  p_admin_note text,
  p_requirement_ids uuid[],
  p_sections public.readiness_section[] default '{}'
)
returns public.stage_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.stage_reviews;
  v_reviewer public.profiles;
  v_ids uuid[] := coalesce(p_requirement_ids, '{}');
  v_sections public.readiness_section[] := coalesce(p_sections, '{}');
begin
  if not private.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'needs_work') then
    raise exception 'Choose approve or needs work.' using errcode = '22023';
  end if;
  if p_decision = 'needs_work' and char_length(trim(coalesce(p_feedback, ''))) = 0 then
    raise exception 'Tell the founder what needs improvement.' using errcode = '22023';
  end if;

  select * into v_review from public.stage_reviews where id = p_review_id for update;
  if v_review.id is null then
    raise exception 'Review not found.' using errcode = 'P0002';
  end if;
  if v_review.status <> 'pending' then
    raise exception 'This review has already been decided.' using errcode = 'P0001';
  end if;
  if v_review.review_type = 'investor_readiness' then
    if exists (
      select 1 from unnest(v_ids) as x (id)
      where not exists (
        select 1 from public.investor_readiness_requirements r
        where r.id = x.id and r.startup_id = v_review.startup_id
      )
    ) then
      raise exception 'Selected requirements must belong to this startup''s readiness.' using errcode = '22023';
    end if;
  else
    if cardinality(v_sections) > 0 then
      raise exception 'Sections only apply to Investor Readiness reviews.' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(v_ids) as x (id)
      where not exists (
        select 1 from public.startup_stage_requirements r
        where r.id = x.id and r.startup_id = v_review.startup_id and r.stage = v_review.from_stage
      )
    ) then
      raise exception 'Selected requirements must belong to the reviewed stage.' using errcode = '22023';
    end if;
  end if;

  select * into v_reviewer from public.profiles where id = (select auth.uid());

  update public.stage_reviews
  set
    status = p_decision,
    reviewed_by = v_reviewer.id,
    reviewer_name = coalesce(nullif(trim(v_reviewer.full_name), ''), v_reviewer.email),
    reviewed_at = now(),
    feedback = nullif(trim(coalesce(p_feedback, '')), ''),
    admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
    attention_requirement_ids = case when p_decision = 'needs_work' then v_ids else '{}' end,
    attention_sections = case when p_decision = 'needs_work' then v_sections else '{}' end
  where id = p_review_id
  returning * into v_review;

  if p_decision = 'approved' then
    perform set_config('innowiut.stage_transition', 'on', true);
    update public.startups
    set journey_stage = v_review.to_stage
    where id = v_review.startup_id and journey_stage = v_review.from_stage;
    if not found then
      raise exception 'The startup is no longer at the reviewed stage.' using errcode = 'P0001';
    end if;
    perform set_config('innowiut.stage_transition', '', true);
  end if;

  return v_review;
end;
$$;

revoke all on function private.apply_stage_review(uuid, public.stage_review_status, text, text, uuid[], public.readiness_section[]) from public, anon;
grant execute on function private.apply_stage_review(uuid, public.stage_review_status, text, text, uuid[], public.readiness_section[]) to authenticated;

create function public.decide_stage_review(
  p_review_id uuid,
  p_decision public.stage_review_status,
  p_feedback text default null,
  p_admin_note text default null,
  p_requirement_ids uuid[] default '{}',
  p_sections public.readiness_section[] default '{}'
)
returns public.stage_reviews
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  return private.apply_stage_review(
    p_review_id, p_decision, p_feedback, p_admin_note, p_requirement_ids, p_sections
  );
end;
$$;

revoke all on function public.decide_stage_review(uuid, public.stage_review_status, text, text, uuid[], public.readiness_section[]) from public, anon;
grant execute on function public.decide_stage_review(uuid, public.stage_review_status, text, text, uuid[], public.readiness_section[]) to authenticated;

-- Founder entry point with an explicit name (same rules; the server decides the type).
create function public.request_investor_readiness_review(p_startup_id uuid)
returns public.stage_reviews
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.startup_stage(p_startup_id) is distinct from 'investor_readiness' then
    raise exception 'Your startup is not in Investor Readiness.' using errcode = 'P0001';
  end if;
  return public.request_stage_review(p_startup_id);
end;
$$;

revoke all on function public.request_investor_readiness_review(uuid) from public, anon;
grant execute on function public.request_investor_readiness_review(uuid) to authenticated;

-- Queue: adds review type filter and column (same behaviour otherwise).
drop function public.admin_review_queue(text, text, text, text, integer, integer);

create function public.admin_review_queue(
  p_status text default 'pending',
  p_stage text default null,
  p_search text default null,
  p_sort text default 'oldest',
  p_limit integer default 50,
  p_offset integer default 0,
  p_type text default null
)
returns table (
  id uuid,
  startup_id uuid,
  startup_name text,
  startup_logo_path text,
  founder_name text,
  founder_email text,
  current_stage public.startup_stage,
  from_stage public.startup_stage,
  to_stage public.startup_stage,
  review_type public.review_type,
  status public.stage_review_status,
  requirements_completed integer,
  requirements_total integer,
  evidence_count bigint,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewer_name text,
  days_waiting integer,
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
  if p_status is not null and p_status not in ('pending', 'needs_work', 'approved') then
    raise exception 'Unknown status: %', p_status using errcode = '22023';
  end if;
  if p_stage is not null and p_stage not in ('idea', 'validation', 'mvp', 'traction', 'investor_readiness') then
    raise exception 'Unknown stage: %', p_stage using errcode = '22023';
  end if;
  if p_type is not null and p_type not in ('stage', 'investor_readiness') then
    raise exception 'Unknown review type: %', p_type using errcode = '22023';
  end if;
  if p_sort not in ('oldest', 'newest') then
    raise exception 'Unknown sort: %', p_sort using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid page.' using errcode = '22023';
  end if;
  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    r.id,
    s.id,
    s.name,
    s.logo_path,
    p.full_name,
    p.email,
    s.journey_stage,
    r.from_stage,
    r.to_stage,
    r.review_type,
    r.status,
    r.requirements_completed,
    r.requirements_total,
    (select count(*) from public.stage_evidence e
      where e.startup_id = s.id and e.stage = r.from_stage),
    r.requested_at,
    r.reviewed_at,
    r.reviewer_name,
    (current_date - r.requested_at::date)::integer,
    count(*) over ()
  from public.stage_reviews r
  join public.startups s on s.id = r.startup_id
  join public.profiles p on p.id = s.owner_id
  where (p_status is null or r.status::text = p_status)
    and (
      p_status is distinct from 'needs_work'
      or not exists (
        select 1 from public.stage_reviews later
        where later.startup_id = r.startup_id and later.from_stage = r.from_stage
          and later.requested_at > r.requested_at
      )
    )
    and (p_stage is null or r.from_stage::text = p_stage)
    and (p_type is null or r.review_type::text = p_type)
    and (v_pattern is null or s.name ilike v_pattern or p.full_name ilike v_pattern)
  order by
    case when p_sort = 'oldest' then r.requested_at end asc,
    case when p_sort = 'newest' then r.requested_at end desc,
    r.id
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.admin_review_queue(text, text, text, text, integer, integer, text) from public, anon;
grant execute on function public.admin_review_queue(text, text, text, text, integer, integer, text) to authenticated;

-- Restrained operational counts for the admin dashboard.
create function public.admin_readiness_stats()
returns table (
  startups_in_readiness bigint,
  pending_readiness_reviews bigint,
  investor_ready_startups bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.startups s
      where s.onboarding_completed_at is not null and s.journey_stage = 'investor_readiness'),
    (select count(*) from public.stage_reviews r
      where r.review_type = 'investor_readiness' and r.status = 'pending'),
    (select count(*) from public.startups s
      where s.onboarding_completed_at is not null and s.journey_stage = 'investor_access');
end;
$$;

revoke all on function public.admin_readiness_stats() from public, anon;
grant execute on function public.admin_readiness_stats() to authenticated;
