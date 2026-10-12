-- FounderTrack V2.2 — Stage Review and controlled stage transition.
--
--   * stage_reviews: one immutable row per review request. A founder requests a review of
--     their CURRENT journey stage once every required requirement is completed. An admin
--     decides it once: approved or needs_work. Decided rows never change and are never
--     deleted by clients; a resubmission after "needs work" is a new row.
--   * At most one pending review per startup and stage (partial unique index).
--   * Approval is the ONLY path that changes startups.journey_stage after onboarding: the
--     decision runs in a SECURITY DEFINER helper that re-checks the caller is an admin and
--     moves the startup from the review's stage to the next one, in the same transaction.
--     A trigger refuses any other change to journey_stage once onboarding is complete.
--   * A stage can only be reviewed when the next stage is open: Traction → Investor
--     Readiness stays locked.
--   * Evidence, requirements and updates of earlier stages are untouched by a transition.

create type public.stage_review_status as enum ('pending', 'needs_work', 'approved');

-- Next stage after a journey stage, or null (Traction → Investor Readiness is locked).
create function private.next_open_stage(value public.startup_stage)
returns public.startup_stage
language sql
immutable
set search_path = ''
as $$
  select case value
    when 'idea' then 'validation'::public.startup_stage
    when 'validation' then 'mvp'::public.startup_stage
    when 'mvp' then 'traction'::public.startup_stage
  end;
$$;

revoke all on function private.next_open_stage(public.startup_stage) from public, anon;
grant execute on function private.next_open_stage(public.startup_stage) to authenticated;

create table public.stage_reviews (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  from_stage public.startup_stage not null,
  to_stage public.startup_stage not null,
  status public.stage_review_status not null default 'pending',
  -- Progress when the review was requested (a record, not a live value).
  requirements_completed integer not null default 0,
  requirements_total integer not null default 0,
  requested_by uuid references public.profiles (id) on delete set null default auth.uid(),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  -- Kept so history still reads correctly if the reviewer account is removed.
  reviewer_name text,
  reviewed_at timestamptz,
  feedback text check (char_length(feedback) <= 4000),
  admin_note text check (char_length(admin_note) <= 4000),
  attention_requirement_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint stage_reviews_next_stage check (to_stage = private.next_open_stage(from_stage)),
  constraint stage_reviews_decision_complete check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null)
  ),
  constraint stage_reviews_needs_work_feedback check (
    status <> 'needs_work' or char_length(trim(coalesce(feedback, ''))) > 0
  )
);

create unique index stage_reviews_one_pending
  on public.stage_reviews (startup_id, from_stage)
  where status = 'pending';
create index stage_reviews_startup_idx on public.stage_reviews (startup_id, requested_at desc);
create index stage_reviews_status_idx on public.stage_reviews (status, requested_at);
create index stage_reviews_requested_by_idx on public.stage_reviews (requested_by);
create index stage_reviews_reviewed_by_idx on public.stage_reviews (reviewed_by);

-- A founder's request: everything except the startup is filled in by the server. The
-- request is for the startup's current stage, needs every required requirement completed,
-- and the next stage must be open.
create function private.prepare_stage_review()
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

  select count(*) filter (where required),
         count(*) filter (where required and status = 'completed')
  into v_total, v_completed
  from public.startup_stage_requirements
  where startup_id = new.startup_id and stage = v_stage;
  if v_total = 0 or v_completed < v_total then
    raise exception 'Complete every required milestone before requesting a review.'
      using errcode = 'P0001';
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
  return new;
end;
$$;

create trigger stage_reviews_prepare
  before insert on public.stage_reviews
  for each row execute function private.prepare_stage_review();

-- Decided reviews are history: they never change. A pending review changes once.
create function private.protect_stage_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'pending' then
    raise exception 'A decided review cannot be changed.' using errcode = 'P0001';
  end if;
  if new.startup_id <> old.startup_id or new.from_stage <> old.from_stage
     or new.to_stage <> old.to_stage or new.requested_at <> old.requested_at
     or new.requested_by is distinct from old.requested_by
     or new.requirements_total <> old.requirements_total
     or new.requirements_completed <> old.requirements_completed then
    raise exception 'A review request cannot be rewritten.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger stage_reviews_protect
  before update on public.stage_reviews
  for each row execute function private.protect_stage_review();

-- After onboarding, journey_stage only moves through an approved review.
create function private.guard_journey_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.journey_stage is distinct from old.journey_stage
     and old.onboarding_completed_at is not null
     and coalesce(current_setting('innowiut.stage_transition', true), '') <> 'on' then
    raise exception 'The journey stage only changes through an approved stage review.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger startups_guard_journey_stage
  before update of journey_stage on public.startups
  for each row execute function private.guard_journey_stage();

-- The single privileged step: record the decision and, on approval, move the startup.
create function private.apply_stage_review(
  p_review_id uuid,
  p_decision public.stage_review_status,
  p_feedback text,
  p_admin_note text,
  p_requirement_ids uuid[]
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
  if exists (
    select 1 from unnest(v_ids) as x (id)
    where not exists (
      select 1 from public.startup_stage_requirements r
      where r.id = x.id and r.startup_id = v_review.startup_id and r.stage = v_review.from_stage
    )
  ) then
    raise exception 'Selected requirements must belong to the reviewed stage.' using errcode = '22023';
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
    attention_requirement_ids = case when p_decision = 'needs_work' then v_ids else '{}' end
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

revoke all on function private.prepare_stage_review() from public, anon, authenticated;
revoke all on function private.protect_stage_review() from public, anon, authenticated;
revoke all on function private.guard_journey_stage() from public, anon, authenticated;
revoke all on function private.apply_stage_review(uuid, public.stage_review_status, text, text, uuid[]) from public, anon;
grant execute on function private.apply_stage_review(uuid, public.stage_review_status, text, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: founders read and request their own; admins read all and decide
-- through decide_stage_review(). Nobody updates or deletes rows directly.
-- ---------------------------------------------------------------------------

alter table public.stage_reviews enable row level security;
revoke all on public.stage_reviews from anon, authenticated;
grant select on public.stage_reviews to authenticated;
grant insert (startup_id) on public.stage_reviews to authenticated;

create policy "stage_reviews: read own startup or admin"
  on public.stage_reviews for select to authenticated
  using ((select private.owns_startup(startup_id)) or (select private.is_admin()));

create policy "stage_reviews: founder requests for own startup"
  on public.stage_reviews for insert to authenticated
  with check (
    (select private.owns_startup(startup_id))
    and requested_by = (select auth.uid())
    and not (select private.is_admin())
  );

-- ---------------------------------------------------------------------------
-- API (SECURITY INVOKER)
-- ---------------------------------------------------------------------------

create function public.request_stage_review(p_startup_id uuid)
returns public.stage_reviews
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_review public.stage_reviews;
begin
  if not (select private.owns_startup(p_startup_id)) then
    raise exception 'You can only request a review for your own startup.' using errcode = '42501';
  end if;
  begin
    insert into public.stage_reviews (startup_id) values (p_startup_id) returning * into v_review;
  exception when unique_violation then
    raise exception 'A review of this stage is already pending.' using errcode = 'P0001';
  end;
  return v_review;
end;
$$;

create function public.decide_stage_review(
  p_review_id uuid,
  p_decision public.stage_review_status,
  p_feedback text default null,
  p_admin_note text default null,
  p_requirement_ids uuid[] default '{}'
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
  return private.apply_stage_review(p_review_id, p_decision, p_feedback, p_admin_note, p_requirement_ids);
end;
$$;

-- Review queue with search / stage / status filters, computed in Postgres.
-- p_status 'needs_work' only lists reviews that are still the latest for their stage
-- (the founder has not resubmitted since).
create function public.admin_review_queue(
  p_status text default 'pending',
  p_stage text default null,
  p_search text default null,
  p_sort text default 'oldest',
  p_limit integer default 50,
  p_offset integer default 0
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
  if p_stage is not null and p_stage not in ('idea', 'validation', 'mvp') then
    raise exception 'Unknown stage: %', p_stage using errcode = '22023';
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
    and (v_pattern is null or s.name ilike v_pattern or p.full_name ilike v_pattern)
  order by
    case when p_sort = 'oldest' then r.requested_at end asc,
    case when p_sort = 'newest' then r.requested_at end desc,
    r.id
  limit p_limit
  offset p_offset;
end;
$$;

create function public.admin_review_stats()
returns table (pending_reviews bigint, waiting_over_3_days bigint)
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
    count(*),
    count(*) filter (where r.requested_at < now() - interval '3 days')
  from public.stage_reviews r
  where r.status = 'pending';
end;
$$;

revoke all on function public.request_stage_review(uuid) from public, anon;
revoke all on function public.decide_stage_review(uuid, public.stage_review_status, text, text, uuid[]) from public, anon;
revoke all on function public.admin_review_queue(text, text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_review_stats() from public, anon;
grant execute on function public.request_stage_review(uuid) to authenticated;
grant execute on function public.decide_stage_review(uuid, public.stage_review_status, text, text, uuid[]) to authenticated;
grant execute on function public.admin_review_queue(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_review_stats() to authenticated;
