-- V2.2 Stage Review tests. Runs after rls.test.sql and journey.test.sql in the same
-- database: Founder J is at Validation with every Validation requirement completed,
-- Founder K is at Traction, Founder A (rls tests) owns "Alpha".

\set admin_id  '''33333333-3333-3333-3333-333333333333'''
\set claims_admin '''{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}'''
\set claims_super '''{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}'''
\set founder_j '''77777777-7777-7777-7777-777777777777'''
\set claims_j  '''{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}'''
\set founder_k '''88888888-8888-8888-8888-888888888888'''
\set claims_k  '''{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}'''

select quote_literal(id) as startup_j from public.startups where owner_id = :founder_j \gset
select quote_literal(id) as startup_k from public.startups where owner_id = :founder_k \gset
select quote_literal(id) as req_interviews from public.startup_stage_requirements
  where startup_id = :startup_j and requirement_key = 'customer_interviews' \gset
select quote_literal(id) as req_idea from public.startup_stage_requirements
  where startup_id = :startup_j and requirement_key = 'problem_statement' \gset

select tests.check(
  (select journey_stage = 'validation' from public.startups where id = :startup_j)
  and (select bool_and(status = 'completed') from public.startup_stage_requirements
       where startup_id = :startup_j and stage = 'validation'),
  'setup: Founder J has completed Validation'
);

-- ---------------------------------------------------------------------------
-- Requesting a review
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select tests.expect_error('select * from public.stage_reviews', '42501', 'anon cannot read reviews');
select tests.expect_error(format('select public.request_stage_review(%L)', :startup_j), '42501', 'anon cannot request a review');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.expect_error(
  format('select public.request_stage_review(%L)', :startup_j),
  '42501', 'founder cannot request a review for another startup'
);
select tests.expect_error(
  format('insert into public.stage_reviews (startup_id) values (%L)', :startup_j),
  '42501', 'founder cannot insert a review for another startup'
);
select tests.expect_error(
  format('select public.request_stage_review(%L)', :startup_k),
  'P0001', 'traction cannot be reviewed before its chosen traction requirements are complete'
);
rollback;

-- Incomplete stage cannot be reviewed.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
update public.startup_stage_requirements set status = 'in_progress' where id = :req_interviews;
select tests.expect_error(
  format('select public.request_stage_review(%L)', :startup_j),
  'P0001', 'a stage with unfinished requirements cannot be reviewed'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
select tests.expect_error(
  format($$insert into public.stage_reviews (startup_id, from_stage, to_stage, status) values (%L, 'mvp', 'traction', 'approved')$$, :startup_j),
  '42501', 'founder cannot choose stages or status of a review'
);
select public.request_stage_review(:startup_j);
select tests.check(
  (select from_stage = 'validation' and to_stage = 'mvp' and status = 'pending'
     and requirements_completed = 6 and requirements_total = 6
     and requested_by = '77777777-7777-7777-7777-777777777777'
   from public.stage_reviews where startup_id = :startup_j),
  'the server fills in stage, next stage, progress and requester'
);
select tests.expect_error(
  format('select public.request_stage_review(%L)', :startup_j),
  'P0001', 'only one open review per startup and stage'
);
select tests.expect_error(
  'update public.stage_reviews set status = ''approved''',
  '42501', 'founder cannot decide their own review'
);
select tests.expect_error(
  format('select public.decide_stage_review(id, ''approved'') from public.stage_reviews where startup_id = %L', :startup_j),
  '42501', 'founder cannot call the decision function'
);
select tests.expect_error(
  format('select private.apply_stage_review(id, ''approved'', null, null, ''{}'') from public.stage_reviews where startup_id = %L', :startup_j),
  '42501', 'the privileged helper re-checks the caller'
);
select tests.expect_error(
  $$update public.startups set journey_stage = 'mvp' where owner_id = auth.uid()$$,
  '42501', 'founder still cannot write journey_stage'
);
-- Deletes silently match nothing: there is no delete grant.
select tests.expect_error('delete from public.stage_reviews', '42501', 'founder cannot delete reviews');
commit;

select tests.check(
  (select journey_stage = 'validation' from public.startups where id = :startup_j),
  'a pending review does not move the stage'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.check((select count(*) from public.stage_reviews) = 0, 'founder sees no other startup''s reviews');
rollback;

-- Even the SQL editor cannot move an onboarded startup without the transition flag.
select tests.expect_error(
  format($$update public.startups set journey_stage = 'mvp' where id = %L$$, :startup_j),
  '42501', 'journey_stage only moves through an approved review'
);

-- ---------------------------------------------------------------------------
-- Needs work: feedback required, stage unchanged, history immutable
-- ---------------------------------------------------------------------------
select quote_literal(id) as review_1 from public.stage_reviews where startup_id = :startup_j \gset

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(
  (select count(*) from public.admin_review_queue()) >= 1
  and (select status = 'pending' and from_stage = 'validation' and to_stage = 'mvp'
         and current_stage = 'validation' and requirements_total = 6
       from public.admin_review_queue() where id = :review_1),
  'admin queue lists the pending review'
);
select tests.check(
  (select pending_reviews >= 1 from public.admin_review_stats()),
  'admin review stats count pending reviews'
);
select tests.expect_error(
  format('select public.decide_stage_review(%L, ''needs_work'', ''  '')', :review_1),
  '22023', 'needs work requires feedback'
);
select tests.expect_error(
  format('select public.decide_stage_review(%L, ''needs_work'', ''x'', null, array[%L]::uuid[])', :review_1, :req_idea),
  '22023', 'attention requirements must belong to the reviewed stage'
);
select tests.expect_error(
  format('select public.decide_stage_review(%L, ''pending'')', :review_1),
  '22023', 'a decision is approve or needs work'
);
select public.decide_stage_review(
  :review_1, 'needs_work', 'Add at least 3 more customer interview notes.', null,
  array[:req_interviews]::uuid[]
);
select tests.expect_error(
  'update public.stage_reviews set feedback = ''rewritten''',
  '42501', 'admin cannot rewrite reviews directly'
);
commit;

select tests.check(
  (select status = 'needs_work' and reviewed_at is not null and reviewed_by = '33333333-3333-3333-3333-333333333333'
     and feedback = 'Add at least 3 more customer interview notes.'
     and attention_requirement_ids = array[:req_interviews]::uuid[]
     and reviewer_name is not null
   from public.stage_reviews where id = :review_1)
  and (select journey_stage = 'validation' from public.startups where id = :startup_j),
  'needs work records feedback and keeps the stage'
);
select tests.expect_error(
  format('update public.stage_reviews set status = ''approved'' where id = %L', :review_1),
  'P0001', 'decided reviews are immutable even from SQL'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.expect_error(
  format('select public.decide_stage_review(%L, ''approved'')', :review_1),
  'P0001', 'a decided review cannot be decided again'
);
select tests.check(
  (select count(*) from public.admin_review_queue(p_status => 'needs_work') where id = :review_1) = 1,
  'needs work tab lists the open feedback'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
select tests.check(
  (select feedback is not null and reviewer_name is not null from public.stage_reviews where id = :review_1),
  'founder sees the feedback and reviewer'
);
-- Resubmission is a new request; the needs-work review stays in history.
select public.request_stage_review(:startup_j);
commit;

select tests.check(
  (select count(*) from public.stage_reviews where startup_id = :startup_j) = 2
  and (select count(*) from public.stage_reviews where startup_id = :startup_j and status = 'needs_work') = 1,
  'resubmission keeps the earlier review'
);

-- ---------------------------------------------------------------------------
-- Approval: the only path that advances the stage
-- ---------------------------------------------------------------------------
select quote_literal(id) as review_2 from public.stage_reviews
  where startup_id = :startup_j and status = 'pending' \gset

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(
  (select count(*) from public.admin_review_queue(p_status => 'needs_work') where id = :review_1) = 0,
  'a resubmitted review leaves the needs work tab'
);
select tests.check(
  (select count(*) from public.admin_review_queue(p_status => null) where startup_id = :startup_j) = 2,
  'all tab shows the full history'
);
select tests.check(
  (select count(*) from public.admin_review_queue(p_search => 'juno')) >= 1
  and (select count(*) from public.admin_review_queue(p_search => 'no-such-startup')) = 0
  and (select count(*) from public.admin_review_queue(p_stage => 'mvp', p_status => null)) = 0,
  'queue search and stage filter'
);
select tests.expect_error(
  'select * from public.admin_review_queue(p_sort => ''random'')',
  '22023', 'queue rejects unknown sort'
);
select public.decide_stage_review(:review_2, 'approved', null, 'Strong interview evidence.');
commit;

select tests.check(
  (select journey_stage = 'mvp' and stage = 'Validation' from public.startups where id = :startup_j),
  'approval moves the startup to the next stage (V1 label untouched)'
);
select tests.check(
  (select status = 'approved' and admin_note = 'Strong interview evidence.' and feedback is null
   from public.stage_reviews where id = :review_2),
  'approval is recorded with the admin note'
);
select tests.check(
  (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and stage = 'validation' and status = 'completed') = 6
  and (select count(*) from public.stage_evidence where startup_id = :startup_j and stage = 'validation') >= 3
  and (select count(*) from public.startup_stage_requirements where startup_id = :startup_j and stage = 'mvp') = 6,
  'earlier evidence and requirements stay after advancing; next stage requirements exist'
);
select tests.check(
  current_setting('innowiut.stage_transition', true) is distinct from 'on',
  'the transition flag does not leak out of the decision'
);

-- The new stage is not complete, so no new review can be requested yet.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_j, true);
select tests.expect_error(
  format('select public.request_stage_review(%L)', :startup_j),
  'P0001', 'the next stage needs its own completed requirements'
);
rollback;

-- Reviews are history: deleting is refused to clients, and superadmins read them too.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.expect_error('delete from public.stage_reviews', '42501', 'admin cannot delete reviews');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select tests.check(
  (select count(*) from public.stage_reviews where startup_id = :startup_j) = 2,
  'superadmin reads review history'
);
select tests.check((select count(*) from public.admin_review_stats()) = 1, 'superadmin reads review stats');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_k, true);
select tests.expect_error('select * from public.admin_review_queue()', '42501', 'founder cannot open the review queue');
select tests.expect_error('select * from public.admin_review_stats()', '42501', 'founder cannot read review stats');
rollback;

-- ---------------------------------------------------------------------------
-- Account removal keeps the history (reviewer name is kept)
-- ---------------------------------------------------------------------------
select tests.expect_error(
  format('update public.stage_reviews set reviewed_by = null, feedback = ''x'' where id = %L', :review_1),
  'P0001', 'clearing a reference cannot be combined with other changes'
);
delete from auth.users where id = :admin_id;
select tests.check(
  (select count(*) from public.stage_reviews where startup_id = :startup_j) = 2
  and (select bool_and(reviewed_by is null and reviewer_name is not null)
       from public.stage_reviews where startup_id = :startup_j),
  'deleting the reviewer account keeps the reviews and the reviewer name'
);
delete from auth.users where id = :founder_j;
select tests.check(
  (select count(*) from public.stage_reviews where startup_id = :startup_j) = 0,
  'deleting a founder account removes their startup with its reviews'
);

\echo 'All stage review tests passed'
