-- V2.1 Startup Journey tests. Runs after rls.test.sql in the same database
-- (reuses its tests.* helpers, its admin and its superadmin).

\set admin_id  '''33333333-3333-3333-3333-333333333333'''
\set claims_admin '''{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}'''
\set claims_super '''{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}'''
\set founder_j '''77777777-7777-7777-7777-777777777777'''
\set claims_j  '''{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}'''
\set founder_k '''88888888-8888-8888-8888-888888888888'''
\set claims_k  '''{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}'''
\set founder_n '''99999999-9999-9999-9999-999999999999'''
\set claims_n  '''{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:founder_j, 'j@example.com', '{"full_name":"Founder J"}'),
  (:founder_k, 'k@example.com', '{"full_name":"Founder K"}'),
  (:founder_n, 'n@example.com', '{"full_name":"Founder N"}');

-- ---------------------------------------------------------------------------
-- Onboarding sets the journey stage and initialises requirements
-- ---------------------------------------------------------------------------
\set payload_j '''{"full_name":"Founder J","phone":"+998 90 000 00 01","role_in_startup":"CEO","name":"Juno","tagline":"Journey test","industry":"SaaS","stage":"Validation","founded_year":2025,"team_size":2,"has_product":false,"has_users":true,"current_users":10,"has_revenue":false,"main_goal":"Validate","biggest_challenge":"Interviews"}'''
\set payload_k '''{"full_name":"Founder K","phone":"+998 90 000 00 02","role_in_startup":"CEO","name":"Kilo","tagline":"Other startup","industry":"AI","stage":"Early Traction","founded_year":2024,"team_size":4,"has_product":true,"has_users":true,"current_users":300,"has_revenue":false,"main_goal":"Grow","biggest_challenge":"Sales"}'''

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
select public.complete_onboarding(:payload_j::jsonb);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select public.complete_onboarding(:payload_k::jsonb);
commit;

-- Resolve ids as the test superuser (inside a founder session RLS would hide the other startup).
select quote_literal(id) as startup_j from public.startups where owner_id = :founder_j \gset
select quote_literal(id) as startup_k from public.startups where owner_id = :founder_k \gset
select quote_literal(id) as metric_k from public.traction_metrics
  where startup_id = :startup_k and name = 'Active Users' \gset
select quote_literal(id) as metric_j from public.traction_metrics
  where startup_id = :startup_j and name = 'Active Users' \gset

select tests.check(
  (select journey_stage = 'validation' and stage = 'Validation' from public.startups where id = :startup_j),
  'onboarding maps the chosen stage to the journey stage and keeps the V1 label'
);
select tests.check(
  (select journey_stage = 'traction' from public.startups where id = :startup_k),
  'Early Traction maps to the traction journey stage'
);
select tests.check(
  (select count(*) from public.startup_stage_requirements where startup_id = :startup_j) = 17
  and (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and stage = 'idea') = 5
  and (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and stage = 'validation') = 6
  and (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and stage = 'mvp') = 6
  and (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and stage = 'traction') = 0,
  'new startups get the Idea / Validation / MVP templates and no fixed traction template'
);
select tests.check(
  (select bool_and(status = 'not_started' and required and completed_at is null)
   from public.startup_stage_requirements where startup_id = :startup_j),
  'template requirements start as not started'
);
select tests.check(
  (select progress_target from public.startup_stage_requirements
   where startup_id = :startup_j and requirement_key = 'customer_interviews') = 10,
  'customer interviews carry their target'
);
select tests.check(
  private.init_stage_requirements(:startup_j) = 0
  and (select count(*) from public.startup_stage_requirements where startup_id = :startup_j) = 17,
  'requirement initialisation is idempotent'
);

-- ---------------------------------------------------------------------------
-- Founders cannot set or move the journey stage
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
select tests.expect_error(
  $$update public.startups set journey_stage = 'traction' where owner_id = auth.uid()$$,
  '42501', 'founder cannot write journey_stage'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
-- A V1 client can still save the V1 stage label; the journey stage does not follow it.
update public.startups set stage = 'Growth' where owner_id = auth.uid();
select tests.check(
  (select journey_stage = 'validation' from public.startups where owner_id = auth.uid()),
  'editing the V1 stage label after onboarding does not move the journey'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_n, true);
select tests.expect_error(
  $$insert into public.startups (name, stage, journey_stage) values ('N', 'Idea', 'investor_access')$$,
  '42501', 'founder cannot choose a journey stage directly'
);
insert into public.startups (name, stage) values ('Nova', 'Growth');
select tests.check(
  (select journey_stage = 'traction' from public.startups where owner_id = auth.uid()),
  'direct insert derives the journey stage from the V1 label'
);
rollback;

-- ---------------------------------------------------------------------------
-- Requirement progress
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
update public.startup_stage_requirements
set status = 'in_progress', progress_value = 4
where startup_id = :startup_j and requirement_key = 'customer_interviews';
select tests.check(
  (select status = 'in_progress' and progress_value = 4 and completed_at is null
   from public.startup_stage_requirements where startup_id = :startup_j and requirement_key = 'customer_interviews'),
  'founder records requirement progress'
);
update public.startup_stage_requirements set status = 'completed'
where startup_id = :startup_j and requirement_key = 'problem_validation';
select tests.check(
  (select completed_at is not null from public.startup_stage_requirements
   where startup_id = :startup_j and requirement_key = 'problem_validation'),
  'completing a requirement stamps completed_at'
);
update public.startup_stage_requirements set status = 'ready_for_review'
where startup_id = :startup_j and requirement_key = 'problem_validation';
select tests.check(
  (select completed_at is null from public.startup_stage_requirements
   where startup_id = :startup_j and requirement_key = 'problem_validation'),
  'leaving completed clears completed_at'
);
select tests.expect_error(
  $$update public.startup_stage_requirements set completed_at = now()$$,
  '42501', 'founder cannot write completed_at'
);
select tests.expect_error(
  $$update public.startup_stage_requirements set title = 'Renamed'$$,
  '42501', 'founder cannot rename template requirements'
);
select tests.expect_error(
  $$update public.startup_stage_requirements set required = false$$,
  '42501', 'founder cannot make a requirement optional'
);
select tests.expect_error(
  $$update public.startup_stage_requirements set progress_value = -1 where requirement_key = 'customer_interviews'$$,
  '23514', 'progress cannot be negative'
);
-- Template rows cannot be removed by the founder (delete only covers traction rows).
delete from public.startup_stage_requirements where stage = 'idea';
commit;
select tests.check(
  (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and stage = 'idea') = 5,
  'founder cannot delete template requirements'
);

-- ---------------------------------------------------------------------------
-- No auto-advance: completing every requirement leaves the stage unchanged
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
update public.startup_stage_requirements set status = 'completed'
where startup_id = :startup_j and stage = 'validation';
commit;
select tests.check(
  (select bool_and(status = 'completed') from public.startup_stage_requirements
   where startup_id = :startup_j and stage = 'validation')
  and (select journey_stage = 'validation' and stage = 'Validation' from public.startups where id = :startup_j),
  'completing all stage requirements does not advance the startup'
);

-- ---------------------------------------------------------------------------
-- Locked stages
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
select tests.expect_error(
  format($$insert into public.startup_stage_requirements (startup_id, stage, requirement_key, title)
           values (%L, 'investor_readiness', 'pitch_deck', 'Pitch Deck')$$, :startup_j),
  '42501', 'founder cannot add investor readiness requirements'
);
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, stage, evidence_type, label, url)
           values (%L, 'investor_access', 'link', 'Deck', 'https://example.com')$$, :startup_j),
  '23514', 'evidence cannot target a locked stage'
);
select tests.expect_error(
  format($$insert into public.startup_updates (startup_id, title, linked_stage) values (%L, 'X', 'investor_readiness')$$, :startup_j),
  '23514', 'updates cannot link a locked stage'
);
rollback;

-- ---------------------------------------------------------------------------
-- Traction requirements connect to existing metrics
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
insert into public.startup_stage_requirements (startup_id, stage, requirement_key, title, linked_metric_id)
values (
  :startup_k, 'traction', 'active_users', 'Active Users',
  :metric_k
);
select tests.expect_error(
  format($$insert into public.startup_stage_requirements (startup_id, stage, requirement_key, title)
           values (%L, 'traction', 'made_up', 'Made Up')$$, :startup_k),
  '42501', 'traction requirements come from the allowed list'
);
select tests.expect_error(
  format($$insert into public.startup_stage_requirements (startup_id, stage, requirement_key, title)
           values (%L, 'mvp', 'extra', 'Extra')$$, :startup_k),
  '42501', 'founder cannot add template-stage requirements'
);
select tests.expect_error(
  format($$insert into public.startup_stage_requirements (startup_id, stage, requirement_key, title)
           values (%L, 'traction', 'revenue', 'Revenue')$$, :startup_j),
  '42501', 'founder cannot add requirements to another startup'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
select tests.expect_error(
  format($$update public.startup_stage_requirements set linked_metric_id = %L
           where startup_id = %L and requirement_key = 'customer_interviews'$$,
    :metric_k, :startup_j),
  '22023', 'requirements cannot link another startup''s metric'
);
rollback;

select tests.check(
  (select count(*) from public.traction_entries where startup_id = :startup_k) = 1,
  'linking traction does not copy traction values'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
delete from public.startup_stage_requirements where stage = 'traction' and requirement_key = 'active_users';
commit;
select tests.check(
  (select count(*) from public.startup_stage_requirements where startup_id = :startup_k and stage = 'traction') = 0,
  'founder removes a chosen traction metric'
);

-- ---------------------------------------------------------------------------
-- Evidence ownership and shape
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
insert into public.stage_evidence (startup_id, requirement_id, stage, evidence_type, label, text_value)
values (
  :startup_j,
  (select id from public.startup_stage_requirements where startup_id = :startup_j and requirement_key = 'customer_interviews'),
  'validation', 'customer_feedback', 'Interview with a teacher', 'They grade 120 essays a week by hand.'
);
insert into public.stage_evidence (startup_id, stage, evidence_type, label, file_path)
values (:startup_j, 'validation', 'document', 'Interview notes',
  :startup_j || '/evidence-notes.pdf');
insert into public.stage_evidence (startup_id, stage, evidence_type, label, linked_metric_id)
values (:startup_j, 'validation', 'metric', 'Active Users',
  :metric_j);
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, stage, evidence_type, label, url)
           values (%L, 'validation', 'link', 'Theirs', 'https://example.com')$$, :startup_k),
  '42501', 'founder cannot add evidence to another startup'
);
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, stage, evidence_type, label)
           values (%L, 'validation', 'link', 'No URL')$$, :startup_j),
  '23514', 'link evidence needs a URL'
);
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, stage, evidence_type, label, url)
           values (%L, 'validation', 'link', 'Script', 'javascript:alert(1)')$$, :startup_j),
  '23514', 'evidence URLs must be http(s)'
);
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, stage, evidence_type, label, file_path)
           values (%L, 'validation', 'screenshot', 'Wrong folder', %L)$$, :startup_j, :startup_k || '/x.png'),
  '22023', 'evidence files must live in the startup''s own folder'
);
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, stage, evidence_type, label, linked_metric_id)
           values (%L, 'validation', 'metric', 'Theirs', %L)$$, :startup_j,
    :metric_k),
  '22023', 'evidence cannot reference another startup''s metric'
);
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, requirement_id, stage, evidence_type, label, url)
           values (%L, %L, 'idea', 'link', 'Wrong stage', 'https://example.com')$$, :startup_j,
    (select id from public.startup_stage_requirements where startup_id = :startup_j and requirement_key = 'customer_interviews')),
  '22023', 'evidence requirement must match its stage'
);
select tests.expect_error(
  format($$update public.stage_evidence set label = 'Rewritten' where startup_id = %L$$, :startup_j),
  '42501', 'evidence cannot be rewritten'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.check((select count(*) from public.stage_evidence) = 0, 'founder sees no other startup''s evidence');
select tests.check(
  (select count(*) from public.startup_stage_requirements where startup_id <> :startup_k) = 0,
  'founder sees no other startup''s requirements'
);
delete from public.stage_evidence;
update public.startup_stage_requirements set status = 'completed' where startup_id = :startup_j;
commit;
select tests.check(
  (select count(*) from public.stage_evidence where startup_id = :startup_j) = 3
  and (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and status = 'completed') = 6,
  'founder cannot delete or update another startup''s journey data'
);

begin;
set local role anon;
select tests.expect_error('select * from public.stage_evidence', '42501', 'anon cannot read evidence');
select tests.expect_error('select * from public.startup_stage_requirements', '42501', 'anon cannot read requirements');
select tests.expect_error('select * from public.admin_stage_distribution()', '42501', 'anon cannot read stage distribution');
rollback;

-- ---------------------------------------------------------------------------
-- Structured updates: draft → publish, evidence, and admin visibility
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
insert into public.startup_updates (
  startup_id, title, summary, status, progress_types, blocker, next_milestone,
  next_milestone_date, linked_stage
) values (
  :startup_j, 'Interview sprint', 'Spoke to 6 teachers.', 'draft',
  array['Customer Validation'], 'Finding schools', 'Reach 10 interviews', current_date + 14, 'validation'
);
insert into public.stage_evidence (startup_id, update_id, stage, evidence_type, label, linked_metric_id)
values (
  :startup_j, (select id from public.startup_updates where title = 'Interview sprint'), 'validation', 'metric',
  'Active Users', :metric_j
);
insert into public.stage_evidence (startup_id, update_id, stage, evidence_type, label, url)
values (
  :startup_j, (select id from public.startup_updates where title = 'Interview sprint'), 'validation', 'link',
  'Interview tracker', 'https://example.com/tracker'
);
select tests.expect_error(
  format($$insert into public.startup_updates (startup_id, title, progress_types) values (%L, 'Bad', array['Hype'])$$, :startup_j),
  '23514', 'progress types come from the fixed list'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(
  (select count(*) from public.stage_evidence where startup_id = :startup_j) = 3,
  'admin reads stage evidence but not evidence attached to a draft update'
);
select tests.check(
  (select count(*) from public.startup_stage_requirements where startup_id = :startup_j) = 17,
  'admin reads every requirement'
);
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, stage, evidence_type, label, url)
           values (%L, 'validation', 'link', 'Admin', 'https://example.com')$$, :startup_j),
  '42501', 'admin cannot add founder evidence'
);
update public.startup_stage_requirements set status = 'not_started' where startup_id = :startup_j;
delete from public.stage_evidence where startup_id = :startup_j;
delete from public.startup_stage_requirements where startup_id = :startup_j;
commit;
select tests.check(
  (select count(*) from public.stage_evidence where startup_id = :startup_j) = 5
  and (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and status = 'completed') = 6,
  'admin is read-only for journey data'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
update public.startup_updates set status = 'published' where title = 'Interview sprint';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(
  (select count(*) from public.stage_evidence where startup_id = :startup_j) = 5,
  'admin sees update evidence once the update is published'
);
select tests.check(
  (select progress_types = array['Customer Validation'] and linked_stage = 'validation'
     and next_milestone = 'Reach 10 interviews' and blocker = 'Finding schools'
   from public.startup_updates where title = 'Interview sprint'),
  'admin reads structured update fields'
);
rollback;

-- Deleting a draft removes the evidence attached to it.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
insert into public.startup_updates (startup_id, title, status, linked_stage)
values (:startup_j, 'Throwaway draft', 'draft', 'validation');
insert into public.stage_evidence (startup_id, update_id, stage, evidence_type, label, text_value)
values (:startup_j, (select id from public.startup_updates where title = 'Throwaway draft'), 'validation', 'text_note', 'Note', 'Text');
delete from public.startup_updates where title = 'Throwaway draft';
select tests.check(
  (select count(*) from public.stage_evidence where text_value = 'Text') = 0,
  'deleting a draft removes its evidence'
);
rollback;

-- ---------------------------------------------------------------------------
-- Admin stage distribution and list filter
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
select tests.expect_error('select * from public.admin_stage_distribution()', '42501', 'founder cannot read stage distribution');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(
  (select count(*) from public.admin_stage_distribution()) = 6,
  'stage distribution lists every stage'
);
select tests.check(
  (select sum(startups) from public.admin_stage_distribution())
    = (select count(*) from public.startups where onboarding_completed_at is not null),
  'stage distribution counts every onboarded startup once'
);
select tests.check(
  (select startups from public.admin_stage_distribution() where stage = 'investor_access') = 0,
  'locked stages have no startups'
);
select tests.check(
  (select count(*) from public.admin_startup_list(p_stage => 'traction')) >= 1
  and (select bool_and(journey_stage = 'traction') from public.admin_startup_list(p_stage => 'traction')),
  'admin list filters by journey stage'
);
select tests.check(
  (select count(*) from public.admin_startup_list(p_stage => 'Early Traction'))
    = (select count(*) from public.startups where stage = 'Early Traction' and onboarding_completed_at is not null),
  'admin list still accepts V1 stage labels'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select tests.check((select count(*) from public.admin_stage_distribution()) = 6, 'superadmin reads stage distribution');
rollback;

\echo 'All journey tests passed'
