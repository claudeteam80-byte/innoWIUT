-- V2.3 Investor Readiness tests. Runs after rls / journey / reviews tests in the same
-- database: Founder K ("Kilo") is at Traction with an Active Users metric (300), Founder A
-- owns "Alpha", and the superadmin from rls.test.sql decides reviews.

\set claims_super '''{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}'''
\set founder_k '''88888888-8888-8888-8888-888888888888'''
\set claims_k  '''{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}'''
\set claims_a  '''{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}'''

select quote_literal(id) as startup_k from public.startups where owner_id = :founder_k \gset
select quote_literal(id) as metric_k from public.traction_metrics
  where startup_id = :startup_k and name = 'Active Users' \gset

-- ---------------------------------------------------------------------------
-- Compatibility: nothing is created for startups outside Investor Readiness
-- ---------------------------------------------------------------------------
select tests.check(
  (select count(*) from public.investor_readiness_requirements) = 0
  and (select count(*) from public.investor_readiness_profiles) = 0
  and (select count(*) from public.readiness_interviews) = 0,
  'no readiness data for startups that are not in Investor Readiness'
);
select tests.check(
  (select coalesce(bool_and(review_type = 'stage'), true) from public.stage_reviews),
  'every existing review is a stage review'
);

begin;
set local role anon;
select tests.expect_error('select * from public.investor_readiness_requirements', '42501', 'anon cannot read readiness requirements');
select tests.expect_error('select * from public.investor_readiness_profiles', '42501', 'anon cannot read readiness profiles');
select tests.expect_error('select * from public.investor_readiness_metrics', '42501', 'anon cannot read readiness metrics');
select tests.expect_error('select id from public.readiness_interviews', '42501', 'anon cannot read interviews');
select tests.expect_error(format('select * from public.investor_readiness_state(%L)', :startup_k), '42501', 'anon cannot read readiness state');
rollback;

-- ---------------------------------------------------------------------------
-- Traction → Investor Readiness only through an approved stage review
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
insert into public.startup_stage_requirements (startup_id, stage, requirement_key, title, linked_metric_id)
values (:startup_k, 'traction', 'active_users', 'Active Users', :metric_k);
update public.startup_stage_requirements set status = 'completed' where startup_id = :startup_k and stage = 'traction';
select tests.expect_error(
  format('select public.request_investor_readiness_review(%L)', :startup_k),
  'P0001', 'readiness review needs the startup to be in Investor Readiness'
);
select public.request_stage_review(:startup_k);
select tests.check(
  (select review_type = 'stage' and from_stage = 'traction' and to_stage = 'investor_readiness'
   from public.stage_reviews where startup_id = :startup_k and status = 'pending'),
  'a Traction review is a stage review into Investor Readiness'
);
commit;

select tests.check(
  (select count(*) from public.investor_readiness_requirements where startup_id = :startup_k) = 0,
  'a pending Traction review does not initialise readiness'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select public.decide_stage_review(id, 'approved') from public.stage_reviews
where startup_id = :startup_k and status = 'pending';
commit;

select tests.check(
  (select journey_stage = 'investor_readiness' from public.startups where id = :startup_k),
  'approval moves the startup into Investor Readiness'
);
select tests.check(
  (select count(*) from public.investor_readiness_requirements where startup_id = :startup_k) = 48
  and (select count(distinct section) from public.investor_readiness_requirements where startup_id = :startup_k) = 9
  and (select count(*) from public.investor_readiness_profiles where startup_id = :startup_k) = 1,
  'readiness is initialised with nine sections and a profile'
);
select tests.check(
  private.init_investor_readiness(:startup_k) = 0
  and (select count(*) from public.investor_readiness_requirements where startup_id = :startup_k) = 48,
  'readiness initialisation is idempotent'
);
select tests.check(
  (select count(*) from public.investor_readiness_requirements where startup_id <> :startup_k) = 0,
  'other startups are untouched'
);

-- ---------------------------------------------------------------------------
-- Existing data is reused, not re-entered
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.check(
  (select bool_and(is_complete) from public.investor_readiness_state(:startup_k)
   where requirement_key in ('startup_name', 'one_line_description', 'industry', 'founded_year')),
  'company facts come from the startup profile'
);
select tests.check(
  (select not is_complete from public.investor_readiness_state(:startup_k) where requirement_key = 'website'),
  'no website on the profile means the website requirement is open'
);
select tests.check(
  (select is_complete from public.investor_readiness_state(:startup_k) where requirement_key = 'team_details'),
  'a startup without listed team members has nothing more to add for the team'
);
select tests.check(
  (select not is_complete from public.investor_readiness_state(:startup_k) where requirement_key = 'primary_investor_metrics'),
  'primary investor metrics start unselected'
);
rollback;

-- ---------------------------------------------------------------------------
-- Completion: mandatory applicable requirements only; not-applicable is explicit
-- ---------------------------------------------------------------------------
select tests.check(
  (select total = 42 and completed = 5 from private.readiness_completion(:startup_k)),
  'completion counts 42 mandatory requirements, 5 already satisfied by existing data'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.expect_error(
  format($$update public.investor_readiness_requirements set not_applicable = true where startup_id = %L and requirement_key = 'unit_economics'$$, :startup_k),
  '23514', 'not applicable needs a reason'
);
select tests.expect_error(
  format($$update public.investor_readiness_requirements set not_applicable = true, not_applicable_reason = 'No deck yet' where startup_id = %L and requirement_key = 'pitch_deck'$$, :startup_k),
  '23514', 'the pitch deck can never be not applicable'
);
update public.investor_readiness_requirements
set not_applicable = true, not_applicable_reason = 'Pre-revenue; no paying customers yet.'
where startup_id = :startup_k and requirement_key = 'unit_economics';
select tests.check(
  (select not_applicable and not is_complete from public.investor_readiness_state(:startup_k) where requirement_key = 'unit_economics'),
  'a not-applicable requirement is reported as not applicable'
);
-- Not fundraising: the round details stop being required.
update public.investor_readiness_profiles set is_fundraising = false where startup_id = :startup_k;
select tests.check(
  (select count(*) from public.investor_readiness_state(:startup_k)
   where section = 'fundraising' and not_applicable) = 7,
  'not fundraising makes the round details not applicable'
);
commit;

select tests.check(
  (select total = 42 - 1 - 6 and completed = 5 + 1 from private.readiness_completion(:startup_k)),
  'not-applicable requirements leave both numbers; fundraising status counts as answered'
);

-- ---------------------------------------------------------------------------
-- Founder ownership and the rest of the readiness answers
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.check((select count(*) from public.investor_readiness_requirements) = 0, 'founder sees no other startup''s readiness');
select tests.expect_error(format('select * from public.investor_readiness_state(%L)', :startup_k), '42501', 'founder cannot read another startup''s readiness state');
update public.investor_readiness_profiles set business_type = 'B2C';
update public.investor_readiness_requirements set text_value = 'hijack';
select tests.expect_error(
  format('insert into public.investor_readiness_metrics (startup_id, metric_id) values (%L, %L)', :startup_k, :metric_k),
  '42501', 'founder cannot choose metrics for another startup'
);
commit;
select tests.check(
  (select business_type is null from public.investor_readiness_profiles where startup_id = :startup_k)
  and (select count(*) from public.investor_readiness_requirements where text_value = 'hijack') = 0,
  'founder cannot change another startup''s readiness'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.expect_error(
  format('update public.investor_readiness_requirements set required = false where startup_id = %L', :startup_k),
  '42501', 'founder cannot make a readiness requirement optional'
);
select tests.expect_error(
  format('update public.investor_readiness_requirements set status = ''completed'' where startup_id = %L', :startup_k),
  '42501', 'founder cannot mark a requirement complete directly'
);
-- Primary investor metric: a reference to the existing metric, never a copy of its value.
insert into public.investor_readiness_metrics (startup_id, metric_id) values (:startup_k, :metric_k);
select tests.check(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'investor_readiness_metrics'
      and column_name not in ('id', 'startup_id', 'metric_id', 'created_at')
  ),
  'primary investor metrics store only a reference to the traction metric'
);
update public.investor_readiness_profiles set
  business_type = 'B2B', product_stage = 'beta', founder_experience = 'Ten years in edtech.',
  founder_commitment = 'full_time', company_registered = true, jurisdiction = 'Uzbekistan',
  legal_entity_name = 'Kilo LLC', cap_table_prepared = true, ip_ownership_clear = true,
  has_legal_blockers = false
where startup_id = :startup_k;
update public.startups set website = 'kilo.example.com' where id = :startup_k;
update public.investor_readiness_requirements set text_value = 'Answer for ' || title
where startup_id = :startup_k
  and requirement_key in ('problem_statement', 'target_customer', 'market_opportunity', 'market_size',
    'key_competitors', 'competitive_advantage', 'working_product', 'core_value_proposition',
    'revenue_model', 'pricing_model', 'primary_revenue_stream', 'customer_acquisition');
update public.investor_readiness_requirements set url = 'https://kilo.example.com/' || requirement_key
where startup_id = :startup_k and requirement_key in ('product_url', 'demo');
update public.investor_readiness_requirements
set not_applicable = true, not_applicable_reason = 'No model before the first pilot.'
where startup_id = :startup_k and requirement_key = 'financial_model';
commit;

select tests.check(
  (select is_complete from private.readiness_state(:startup_k) where requirement_key = 'product_demo'),
  'Product Demo reuses the product section''s demo'
);
select tests.check(
  (select completed = total - 1 from private.readiness_completion(:startup_k))
  and (select not is_complete from private.readiness_state(:startup_k) where requirement_key = 'pitch_deck'),
  'everything but the pitch deck is complete'
);

-- Pitch deck is required before a review can be requested.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.expect_error(
  format('select public.request_investor_readiness_review(%L)', :startup_k),
  'P0001', 'no readiness review without every mandatory requirement (pitch deck)'
);
rollback;

-- Readiness evidence reuses stage_evidence.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
insert into public.stage_evidence (startup_id, stage, evidence_type, label, url, readiness_requirement_id)
values (:startup_k, 'investor_readiness', 'link', 'Pitch deck', 'https://kilo.example.com/deck.pdf',
  (select id from public.investor_readiness_requirements where startup_id = :startup_k and requirement_key = 'pitch_deck'));
select tests.expect_error(
  format($$insert into public.stage_evidence (startup_id, stage, evidence_type, label, url, readiness_requirement_id)
           values (%L, 'traction', 'link', 'Wrong stage', 'https://example.com', %L)$$, :startup_k,
    (select id from public.investor_readiness_requirements where startup_id = :startup_k and requirement_key = 'one_pager')),
  '22023', 'readiness evidence must be filed under Investor Readiness'
);
commit;

select tests.check(
  (select status = 'completed' and completed_at is not null from public.investor_readiness_requirements
   where startup_id = :startup_k and requirement_key = 'pitch_deck')
  and (select completed = total from private.readiness_completion(:startup_k)),
  'evidence completes the pitch deck and readiness reaches 100%'
);

-- ---------------------------------------------------------------------------
-- Investor Readiness review, interview, needs work, resubmission, approval
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select public.request_investor_readiness_review(:startup_k);
select tests.check(
  (select review_type = 'investor_readiness' and from_stage = 'investor_readiness' and to_stage = 'investor_access'
     and requirements_completed = requirements_total
   from public.stage_reviews where startup_id = :startup_k and status = 'pending'),
  'the readiness review is typed and records completion'
);
select tests.expect_error(
  format('select public.request_investor_readiness_review(%L)', :startup_k),
  'P0001', 'only one open readiness review'
);
select tests.expect_error(
  format('select public.admin_set_readiness_interview(%L, ''scheduled'', now() + interval ''2 days'', ''Room 1'')', :startup_k),
  '42501', 'founder cannot arrange an interview'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select tests.check(
  (select count(*) from public.admin_review_queue(p_type => 'investor_readiness')) = 1
  and (select count(*) from public.admin_review_queue(p_type => 'stage', p_status => null)) >= 1
  and (select bool_and(review_type = 'stage') from public.admin_review_queue(p_type => 'stage', p_status => null)),
  'the queue separates review types'
);
select tests.check(
  (select pending_readiness_reviews = 1 and startups_in_readiness = 1 and investor_ready_startups = 0
   from public.admin_readiness_stats()),
  'readiness stats'
);
select tests.expect_error(
  format('select public.admin_set_readiness_interview(%L, ''scheduled'')', :startup_k),
  '23514', 'a scheduled interview needs a time and a place'
);
select public.admin_set_readiness_interview(:startup_k, 'scheduled', '2026-11-01 10:00+05', 'innoWIUT office, room 2', 'Ask about runway.');
select tests.check(
  (select admin_note = 'Ask about runway.' from public.admin_readiness_interview(:startup_k)),
  'admins read the interview note'
);
select tests.expect_error(
  format($$select public.decide_stage_review(id, 'needs_work', 'x', null, '{}', '{nonsense}') from public.stage_reviews where startup_id = %L and status = 'pending'$$, :startup_k),
  '22P02', 'flagged sections come from the nine readiness sections'
);
select public.decide_stage_review(
  id, 'needs_work', 'Add a financial model before investors see this.', null,
  array[(select r.id from public.investor_readiness_requirements r where r.startup_id = :startup_k and r.requirement_key = 'financial_model')],
  array['investor_materials']::public.readiness_section[]
) from public.stage_reviews where startup_id = :startup_k and status = 'pending';
commit;

select tests.check(
  (select journey_stage = 'investor_readiness' from public.startups where id = :startup_k)
  and (select attention_sections = array['investor_materials']::public.readiness_section[]
       from public.stage_reviews where startup_id = :startup_k and status = 'needs_work'),
  'needs work keeps the stage and records the flagged section'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.check(
  (select status = 'scheduled' and location_or_link = 'innoWIUT office, room 2' and scheduled_at is not null
   from public.readiness_interviews where startup_id = :startup_k),
  'founder sees the interview status, time and place'
);
select tests.expect_error('select admin_note from public.readiness_interviews', '42501', 'founder cannot read the admin interview note');
select tests.expect_error('select * from public.admin_readiness_interview(''00000000-0000-0000-0000-000000000000'')', '42501', 'founder cannot use the admin interview reader');
select tests.expect_error('update public.readiness_interviews set location_or_link = ''elsewhere''', '42501', 'founder cannot edit the interview');
-- Act on feedback and resubmit (a new review row).
update public.investor_readiness_requirements
set not_applicable = false, url = 'https://kilo.example.com/model.xlsx'
where startup_id = :startup_k and requirement_key = 'financial_model';
select public.request_investor_readiness_review(:startup_k);
commit;

select tests.check(
  (select count(*) from public.stage_reviews where startup_id = :startup_k and review_type = 'investor_readiness') = 2
  and (select count(*) from public.stage_reviews where startup_id = :startup_k and review_type = 'investor_readiness' and status = 'needs_work') = 1,
  'resubmission keeps the earlier decision'
);
select tests.expect_error(
  format($$update public.stage_reviews set feedback = 'rewritten' where startup_id = %L and status = 'needs_work'$$, :startup_k),
  'P0001', 'decided readiness reviews are immutable'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select public.admin_set_readiness_interview(:startup_k, 'completed', null, null, 'Strong founder.');
select public.decide_stage_review(id, 'approved', null, 'Investor Ready.') from public.stage_reviews
where startup_id = :startup_k and status = 'pending';
commit;

select tests.check(
  (select journey_stage = 'investor_access' from public.startups where id = :startup_k),
  'Investor Ready approval moves the startup to Investor Access'
);
select tests.check(
  (select status = 'completed' and completed_at is not null and scheduled_at is not null
   from public.readiness_interviews where startup_id = :startup_k),
  'completing the interview keeps its time and records completion'
);
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select tests.check(
  (select investor_ready_startups = 1 and pending_readiness_reviews = 0 and startups_in_readiness = 0
   from public.admin_readiness_stats()),
  'stats count Investor Ready startups'
);
rollback;

-- After approval: nothing more to review or edit; Investor Access is a dead end for now.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.expect_error(
  format('select public.request_stage_review(%L)', :startup_k),
  'P0001', 'Investor Access cannot be reviewed'
);
update public.investor_readiness_requirements set text_value = 'late edit' where startup_id = :startup_k;
update public.investor_readiness_profiles set business_type = 'B2C' where startup_id = :startup_k;
commit;
select tests.check(
  (select count(*) from public.investor_readiness_requirements where text_value = 'late edit') = 0
  and (select business_type = 'B2B' from public.investor_readiness_profiles where startup_id = :startup_k),
  'readiness answers are frozen after Investor Ready'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select tests.expect_error(
  format('select public.admin_set_readiness_interview(%L, ''scheduled'', now(), ''x'')', :startup_k),
  'P0001', 'no interviews outside Investor Readiness'
);
select tests.check(
  (select count(*) from public.investor_readiness_requirements where startup_id = :startup_k) = 48,
  'admins read all readiness data'
);
update public.investor_readiness_requirements set text_value = 'admin edit' where startup_id = :startup_k;
commit;
select tests.check(
  (select count(*) from public.investor_readiness_requirements where text_value = 'admin edit') = 0,
  'admins do not write founder readiness answers'
);

-- No investor features exist yet.
select tests.check(
  not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name ~ '(investor_directory|investors|introduction|vc_|fundraising_crm|match)'
  ),
  'no investor directory, matching or introductions'
);

\echo 'All investor readiness tests passed'
