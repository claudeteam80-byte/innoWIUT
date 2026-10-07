-- RLS / privilege tests. Run with supabase/tests/run-local.sh.
-- Every block runs in its own transaction; a failed assertion aborts the run.

\set founder_a '''11111111-1111-1111-1111-111111111111'''
\set founder_b '''22222222-2222-2222-2222-222222222222'''
\set admin_id  '''33333333-3333-3333-3333-333333333333'''
\set claims_a  '''{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}'''
\set claims_b  '''{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}'''
\set claims_admin '''{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}'''

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.check(condition boolean, label text) returns void
language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', label;
  end if;
end;
$$;

create function tests.expect_error(statement text, expected_state text, label text) returns void
language plpgsql as $$
declare
  failed_as_expected boolean := false;
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then
      failed_as_expected := true;
    else
      raise exception 'FAILED: % — expected SQLSTATE %, got % (%)', label, expected_state, sqlstate, sqlerrm;
    end if;
  end;
  if not failed_as_expected then
    raise exception 'FAILED: % — expected SQLSTATE % but statement succeeded', label, expected_state;
  end if;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Setup: three auth users; signup trigger creates founder profiles.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  (:founder_a, 'a@example.com', '{"full_name":"Founder A","role":"admin"}'),
  (:founder_b, 'b@example.com', '{"full_name":"Founder B"}'),
  (:admin_id, 'admin@example.com', '{}');

select tests.check(
  (select count(*) from public.profiles where role = 'founder') = 3,
  'new users are founders even when metadata claims admin'
);
select tests.check(
  (select full_name from public.profiles where id = :founder_a) = 'Founder A',
  'full_name copied from signup metadata'
);

-- Staff promotion (done with SQL editor / service role in production).
update public.profiles set role = 'admin' where id = :admin_id;

-- ---------------------------------------------------------------------------
-- anon has no access
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select tests.expect_error('select * from public.startups', '42501', 'anon cannot read startups');
select tests.expect_error('select * from public.profiles', '42501', 'anon cannot read profiles');
select tests.expect_error('select * from public.mentors', '42501', 'anon cannot read mentors');
rollback;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.check((select count(*) from public.profiles) = 1, 'founder sees only own profile');
select tests.expect_error(
  $$update public.profiles set role = 'admin' where id = auth.uid()$$,
  '42501', 'founder cannot change own role'
);
update public.profiles set full_name = 'Founder A Renamed' where id = auth.uid();
update public.profiles set full_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222';
commit;
select tests.check(
  (select full_name from public.profiles where id = :founder_b) = 'Founder B',
  'founder cannot update another profile'
);

-- ---------------------------------------------------------------------------
-- startups
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
insert into public.startups (name, industry, stage) values ('Alpha', 'EdTech', 'MVP');
select tests.expect_error(
  $$insert into public.startups (name) values ('Second')$$,
  '23505', 'one startup per founder'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.expect_error(
  $$insert into public.startups (name, onboarding_completed_at) values ('X', now())$$,
  '42501', 'founder cannot set onboarding_completed_at'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.expect_error(
  $$update public.startups set onboarding_completed_at = now()$$,
  '42501', 'founder cannot mark onboarding complete directly'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_b, true);
select tests.check((select count(*) from public.startups) = 0, 'founder B cannot see founder A startup');
update public.startups set name = 'Hijacked';
insert into public.startups (name) values ('Beta');
commit;
select tests.check(
  (select name from public.startups where owner_id = :founder_a) = 'Alpha',
  'founder B cannot update founder A startup'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check((select count(*) from public.startups) = 2, 'admin sees all startups');
select tests.check((select count(*) from public.profiles) = 3, 'admin sees all profiles');
select tests.expect_error(
  $$insert into public.startups (name) values ('Admin startup')$$,
  '42501', 'admin cannot create a startup'
);
rollback;

select id as startup_a from public.startups where owner_id = :founder_a \gset
select id as startup_b from public.startups where owner_id = :founder_b \gset

-- ---------------------------------------------------------------------------
-- traction
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
insert into public.traction_metrics (startup_id, name, unit, currency)
select id, 'MRR', 'currency', 'UZS' from public.startups;
insert into public.traction_metrics (startup_id, name)
select id, 'Users' from public.startups;
select tests.expect_error(
  $$insert into public.traction_metrics (startup_id, name, unit)
    select id, 'Revenue', 'currency' from public.startups$$,
  '23514', 'currency metric requires a currency'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
insert into public.traction_entries (metric_id, value, recorded_on)
select id, 100, current_date - 3 from public.traction_metrics where name = 'Users';
insert into public.traction_entries (metric_id, value, recorded_on)
select id, 150, current_date from public.traction_metrics where name = 'Users';
commit;

select id as users_metric from public.traction_metrics where name = 'Users' \gset

select tests.check(
  (select current_value = 150 and previous_value = 100 and last_recorded_on = current_date
   from public.traction_metrics where name = 'Users'),
  'metric current/previous derived from entries'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.expect_error(
  $$update public.traction_metrics set current_value = 999999$$,
  '42501', 'founder cannot write derived metric values'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.expect_error(
  $$update public.traction_entries set value = 1$$,
  '42501', 'traction entries are append-only'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_b, true);
select tests.check((select count(*) from public.traction_metrics) = 0, 'founder B cannot see A metrics');
select tests.expect_error(
  format('insert into public.traction_entries (metric_id, value) values (%L, 5)', :'users_metric'),
  '42501', 'founder B cannot record traction on A metric'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check((select count(*) from public.traction_entries) = 2, 'admin sees traction entries');
rollback;

-- ---------------------------------------------------------------------------
-- startup updates: admins only see published
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
insert into public.startup_updates (startup_id, title, status)
select id, 'Draft one', 'draft' from public.startups;
insert into public.startup_updates (startup_id, title, status)
select id, 'Published one', 'published' from public.startups;
commit;

select tests.check(
  (select published_at is not null from public.startup_updates where title = 'Published one'),
  'published_at set on publish'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(
  (select count(*) from public.startup_updates) = 1
  and (select title from public.startup_updates) = 'Published one',
  'admin sees only published updates'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
delete from public.startup_updates;
commit;
select tests.check(
  (select count(*) from public.startup_updates) = 1,
  'founder can delete drafts but not published updates'
);

-- ---------------------------------------------------------------------------
-- mentors, assignments, notes, meeting requests
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.expect_error(
  $$insert into public.mentors (name) values ('Self-made mentor')$$,
  '42501', 'founder cannot create mentors'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
insert into public.mentors (name, expertise) values ('Aziz', array['Growth']);
insert into public.mentor_assignments (startup_id, mentor_id)
select s.id, m.id from public.startups s, public.mentors m
where s.owner_id = '11111111-1111-1111-1111-111111111111';
select tests.expect_error(
  $$insert into public.mentor_assignments (startup_id, mentor_id)
    select s.id, m.id from public.startups s, public.mentors m
    where s.owner_id = '11111111-1111-1111-1111-111111111111'$$,
  '23505', 'only one active mentor assignment per startup'
);
insert into public.mentor_notes (startup_id, mentor_id, body)
select s.id, m.id, 'Focus on retention.' from public.startups s, public.mentors m
where s.owner_id = '11111111-1111-1111-1111-111111111111';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.check((select count(*) from public.mentors) = 1, 'founder sees assigned mentor');
select tests.check((select count(*) from public.mentor_notes) = 1, 'founder sees notes for own startup');
select tests.expect_error(
  $$insert into public.mentor_notes (startup_id, body) select id, 'self note' from public.startups$$,
  '42501', 'founder cannot write mentor notes'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_b, true);
select tests.check((select count(*) from public.mentors) = 0, 'unassigned founder cannot see mentors');
select tests.check((select count(*) from public.mentor_notes) = 0, 'founder B cannot see A notes');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
insert into public.meeting_requests (startup_id, mentor_id, reason, message)
select s.id, m.id, 'Growth', 'Help with pricing' from public.startups s, public.mentors m;
select tests.expect_error(
  $$insert into public.meeting_requests (startup_id, reason, status)
    select id, 'Growth', 'confirmed' from public.startups$$,
  '42501', 'founder cannot set meeting status on create'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
update public.meeting_requests set status = 'confirmed';
commit;
select tests.check(
  (select status = 'requested' from public.meeting_requests),
  'founder cannot confirm own meeting request'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_b, true);
select tests.expect_error(
  format('insert into public.meeting_requests (startup_id, reason) values (%L, %L)', :'startup_a', 'Growth'),
  '42501', 'founder B cannot request a meeting for A startup'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
update public.meeting_requests set status = 'confirmed', admin_response = 'Tuesday 10:00';
commit;
select tests.check(
  (select status = 'confirmed' from public.meeting_requests),
  'admin confirms meeting request'
);

-- ---------------------------------------------------------------------------
-- activity
-- ---------------------------------------------------------------------------
select tests.check(public.activity_status(0) = 'active', 'activity 0 days');
select tests.check(public.activity_status(7) = 'active', 'activity 7 days');
select tests.check(public.activity_status(8) = 'needs_update', 'activity 8 days');
select tests.check(public.activity_status(14) = 'needs_update', 'activity 14 days');
select tests.check(public.activity_status(15) = 'inactive', 'activity 15 days');
select tests.check(public.activity_status(null) = 'inactive', 'activity never');

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.check(
  (select count(*) from public.startup_activity) = 1
  and (select activity_status from public.startup_activity) = 'active',
  'founder sees own activity row'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check((select count(*) from public.startup_activity) = 2, 'admin sees all activity rows');
rollback;

-- ---------------------------------------------------------------------------
-- storage
-- ---------------------------------------------------------------------------
select tests.check((select count(*) from storage.buckets) = 3, 'three buckets created');
select tests.check(
  (select public from storage.buckets where id = 'update-attachments') = false,
  'update-attachments is private'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
insert into storage.objects (bucket_id, name)
select 'startup-logos', id || '/logo.png' from public.startups;
select tests.expect_error(
  format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'startup-logos', :'startup_b' || '/logo.png'),
  '42501', 'founder cannot upload into another startup folder'
);
select tests.expect_error(
  $$insert into storage.objects (bucket_id, name) values ('startup-logos', 'not-a-uuid/logo.png')$$,
  '42501', 'non-uuid folder rejected'
);
select tests.expect_error(
  $$insert into storage.objects (bucket_id, name) values ('mentor-photos', 'x/photo.png')$$,
  '42501', 'founder cannot upload mentor photos'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
insert into storage.objects (bucket_id, name)
select 'mentor-photos', id || '/photo.png' from public.mentors;
select tests.check(
  (select count(*) from storage.objects where bucket_id = 'startup-logos') = 1,
  'admin can read startup logos'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_b, true);
select tests.check((select count(*) from storage.objects) = 0, 'founder B cannot list A files');
rollback;

-- ---------------------------------------------------------------------------
-- Founder core functions (20261008000001_founder_core.sql)
-- ---------------------------------------------------------------------------
\set founder_c '''44444444-4444-4444-4444-444444444444'''
\set claims_c '''{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}'''
insert into auth.users (id, email, raw_user_meta_data) values (:founder_c, 'c@example.com', '{"full_name":"C"}');

\set onboarding_payload '''{"full_name":"Founder C","phone":"+998 90 123 45 67","role_in_startup":"CEO","name":"Gamma","tagline":"Learning platform","industry":"EdTech","stage":"MVP","founded_year":2025,"team_size":3,"has_product":true,"has_users":true,"current_users":640,"has_revenue":true,"monthly_revenue":1200000,"revenue_currency":"UZS","main_goal":"Grow","biggest_challenge":"Content"}'''

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_c, true);
select tests.expect_error(
  $$select public.complete_onboarding('{"full_name":"x"}'::jsonb)$$,
  '22023', 'onboarding rejects missing fields'
);
select tests.expect_error(
  format('select public.complete_onboarding(%L::jsonb)', jsonb_set(:onboarding_payload::jsonb, '{monthly_revenue}', 'null')),
  '22023', 'onboarding requires revenue when has_revenue'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_c, true);
select public.complete_onboarding(:onboarding_payload::jsonb);
commit;

select tests.check(
  (select onboarding_completed_at is not null and founder_role = 'CEO' and team_size = 3
   from public.startups where owner_id = :founder_c),
  'complete_onboarding creates a completed startup'
);
select tests.check(
  (select full_name = 'Founder C' and phone = '+998 90 123 45 67' from public.profiles where id = :founder_c),
  'complete_onboarding updates the profile'
);
select tests.check(
  (select count(*) = 2 from public.traction_metrics m join public.startups s on s.id = m.startup_id
   where s.owner_id = :founder_c),
  'complete_onboarding seeds users and revenue metrics'
);
select tests.check(
  (select unit = 'currency' and currency = 'UZS' and current_value = 1200000 and previous_value is null
   from public.traction_metrics m join public.startups s on s.id = m.startup_id
   where s.owner_id = :founder_c and m.name = 'Monthly Revenue'),
  'revenue metric has explicit unit, currency and first value'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_c, true);
select tests.expect_error(
  format('select public.complete_onboarding(%L::jsonb)', :onboarding_payload),
  'P0001', 'onboarding cannot run twice'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.expect_error(
  format('select public.complete_onboarding(%L::jsonb)', :onboarding_payload),
  '42501', 'admins cannot complete founder onboarding'
);
rollback;

begin;
set local role anon;
select tests.expect_error(
  $$select public.record_traction('[]'::jsonb)$$,
  '42501', 'anon cannot call record_traction'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_c, true);
select public.add_traction_metric('Customers', 'number', null, 100, null, 10, current_date - 1);
select public.record_traction(
  (select jsonb_agg(jsonb_build_object('metric_id', m.id, 'value', 20))
   from public.traction_metrics m where m.name in ('Customers', 'Active Users')),
  current_date, 'Weekly numbers'
);
select tests.expect_error(
  format('select public.record_traction(%L::jsonb, current_date + 5)',
    (select jsonb_agg(jsonb_build_object('metric_id', id, 'value', 1)) from public.traction_metrics where name = 'Customers')),
  '22023', 'record_traction rejects future dates'
);
select tests.expect_error(
  $$select public.record_traction('[]'::jsonb)$$,
  '22023', 'record_traction needs at least one value'
);
commit;

select tests.check(
  (select current_value = 20 and previous_value = 10 and target = 100
   from public.traction_metrics where name = 'Customers'),
  'add_traction_metric + record_traction keep server-derived values'
);
select tests.check(
  (select current_value = 20 and previous_value = 640 from public.traction_metrics
   where name = 'Active Users' and startup_id = (select id from public.startups where owner_id = :founder_c)),
  'record_traction updates several metrics at once'
);

select id as customers_metric from public.traction_metrics where name = 'Customers' \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_b, true);
select tests.expect_error(
  format('select public.record_traction(%L::jsonb)',
    jsonb_build_array(jsonb_build_object('metric_id', :'customers_metric', 'value', 1))),
  '42501', 'founder B cannot record traction for founder C'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.expect_error(
  $$select public.add_traction_metric('Admin metric', 'number')$$,
  'P0002', 'admin has no startup to add metrics to'
);
rollback;

-- ---------------------------------------------------------------------------
-- Admin core functions (20261009000001_admin_core.sql)
-- ---------------------------------------------------------------------------
-- Founder A's startup was created directly; mark it onboarded so both A and C are listed.
update public.startups set onboarding_completed_at = now() where owner_id = :founder_a;
select id as alpha_id from public.startups where owner_id = :founder_a \gset
select id as gamma_id from public.startups where owner_id = :founder_c \gset
select id as aziz_id from public.mentors where name = 'Aziz' \gset

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_a, true);
select tests.expect_error('select * from public.admin_dashboard_stats()', '42501', 'founder cannot read admin stats');
select tests.expect_error('select * from public.admin_startup_list()', '42501', 'founder cannot list all startups');
select tests.expect_error(format('select public.assign_mentor(%L, %L)', :'alpha_id', :'aziz_id'), '42501', 'founder cannot assign mentors');
select tests.expect_error(format('select public.end_mentor_assignment(%L)', :'alpha_id'), '42501', 'founder cannot end assignments');
select tests.expect_error(format('select public.delete_mentor(%L)', :'aziz_id'), '42501', 'founder cannot delete mentors');
rollback;

begin;
set local role anon;
select tests.expect_error('select * from public.admin_dashboard_stats()', '42501', 'anon cannot read admin stats');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(
  (select row(total_startups, active_startups, needs_update_startups, inactive_startups,
              updates_this_week, growing_startups, unassigned_startups, open_meeting_requests)::text
   from public.admin_dashboard_stats()) = '(2,2,0,0,1,2,1,0)',
  'admin stats: 2 onboarded, both active, 1 update this week, 2 growing, 1 unassigned, 0 open requests'
);
select tests.check((select count(*) from public.admin_startup_list()) = 2, 'list returns onboarded startups only');
select tests.check(
  (select total_count from public.admin_startup_list(p_limit => 1, p_offset => 1)) = 2
  and (select count(*) from public.admin_startup_list(p_limit => 1, p_offset => 1)) = 1,
  'list paginates and reports the total'
);
select tests.check((select name from public.admin_startup_list(p_search => 'gam')) = 'Gamma', 'search by startup name');
select tests.check((select name from public.admin_startup_list(p_search => 'founder a ren')) = 'Alpha', 'search by founder name');
select tests.check((select count(*) from public.admin_startup_list(p_search => '%')) = 0, 'search wildcards are escaped');
select tests.check((select name from public.admin_startup_list(p_mentor => 'assigned')) = 'Alpha', 'filter mentor assigned');
select tests.check((select name from public.admin_startup_list(p_mentor => 'unassigned')) = 'Gamma', 'filter mentor unassigned');
select tests.check((select count(*) from public.admin_startup_list(p_stage => 'Idea')) = 0, 'filter by stage');
select tests.check((select count(*) from public.admin_startup_list(p_activity => 'inactive')) = 0, 'filter by activity');
select tests.check((select name from public.admin_startup_list(p_sort => 'growth') limit 1) = 'Gamma', 'sort by highest growth');
select tests.check((select name from public.admin_startup_list(p_sort => 'oldest') limit 1) = 'Alpha', 'sort by oldest');
select tests.check((select name from public.admin_startup_list(p_sort => 'newest') limit 1) = 'Gamma', 'sort by newest');
select tests.check(
  (select primary_metric_name = 'Users' and primary_metric_value = 150 and primary_metric_previous = 100
     and growth_percent = 50 and mentor_name = 'Aziz' and activity_status = 'active' and founder_email = 'a@example.com'
   from public.admin_startup_list(p_search => 'alpha')),
  'list row carries primary metric, growth, mentor and activity'
);
select tests.expect_error($$select * from public.admin_startup_list(p_sort => 'random')$$, '22023', 'unknown sort rejected');
select tests.expect_error($$select * from public.admin_startup_list(p_limit => 1000)$$, '22023', 'page size is capped');
rollback;

-- Primary metric tie-break: same day, most recently updated metric wins.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(
  (select primary_metric_name from public.admin_startup_list(p_search => 'gamma')) =
  (select m.name from public.traction_metrics m where m.startup_id = :'gamma_id' and not m.is_archived
   order by m.last_recorded_on desc nulls last, m.updated_at desc, m.created_at, m.id limit 1),
  'primary metric is the most recently updated metric'
);
rollback;

-- Assignment switching keeps history and one active assignment.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
insert into public.mentors (name) values ('Bobur');
select public.assign_mentor(:'alpha_id', (select id from public.mentors where name = 'Bobur'));
select public.assign_mentor(:'alpha_id', (select id from public.mentors where name = 'Bobur'));
commit;
select tests.check(
  (select count(*) from public.mentor_assignments where startup_id = :'alpha_id') = 2
  and (select count(*) from public.mentor_assignments where startup_id = :'alpha_id' and ended_at is null) = 1
  and (select m.name from public.mentor_assignments a join public.mentors m on m.id = a.mentor_id
       where a.startup_id = :'alpha_id' and a.ended_at is null) = 'Bobur',
  'assign_mentor ends the old assignment, starts the new one, and is idempotent'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.check(public.end_mentor_assignment(:'alpha_id'), 'end_mentor_assignment ends the active assignment');
select tests.check(not public.end_mentor_assignment(:'alpha_id'), 'end_mentor_assignment reports nothing to end');
select tests.check(public.delete_mentor(:'aziz_id') = 'archived', 'mentor with history is archived, not deleted');
select tests.expect_error(format('select public.assign_mentor(%L, %L)', :'alpha_id', :'aziz_id'), 'P0002', 'archived mentors cannot be assigned');
insert into public.mentors (name) values ('Unused');
select tests.check(public.delete_mentor((select id from public.mentors where name = 'Unused')) = 'deleted', 'unused mentor is deleted');
select public.assign_mentor(:'gamma_id', (select id from public.mentors where name = 'Bobur'));
select tests.expect_error(
  format('select public.delete_mentor(%L)', (select id from public.mentors where name = 'Bobur')),
  'P0001', 'actively assigned mentor cannot be deleted'
);
commit;
select tests.check(
  (select not is_active from public.mentors where id = :'aziz_id')
  and (select count(*) from public.mentor_assignments where mentor_id = :'aziz_id') = 1,
  'archived mentor keeps assignment history'
);

-- ---------------------------------------------------------------------------
-- Admin access management (20261010000001/2)
-- ---------------------------------------------------------------------------
\set super_id '''55555555-5555-5555-5555-555555555555'''
\set claims_super '''{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}'''
\set founder_d '''66666666-6666-6666-6666-666666666666'''
\set claims_d '''{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}'''
insert into auth.users (id, email, raw_user_meta_data) values
  (:super_id, 'owner@example.com', '{"full_name":"Owner"}'),
  (:founder_d, 'd@example.com', '{"full_name":"Dana"}');
-- First superadmin is created manually (SQL editor: no auth.uid()).
update public.profiles set role = 'superadmin' where id = :super_id;

select tests.check(
  (select count(*) from public.admin_role_events where target_user_id = :super_id
     and previous_role = 'founder' and new_role = 'superadmin' and changed_by is null) = 1,
  'manual promotion is audited with no changed_by'
);

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select tests.check((select count(*) from public.startups) >= 2, 'superadmin keeps every admin read permission');
select tests.check((select total_startups from public.admin_dashboard_stats()) >= 1, 'superadmin can use admin functions');
rollback;

-- Founders and regular admins cannot manage access or read the audit log.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_admin, true);
select tests.expect_error($$select public.grant_admin_access('d@example.com')$$, '42501', 'admin cannot grant admin access');
select tests.expect_error(format('select public.revoke_admin_access(%L)', :super_id), '42501', 'admin cannot revoke access');
select tests.expect_error(format('select public.promote_to_superadmin(%L, %L)', :admin_id, 'admin@example.com'), '42501', 'admin cannot promote themselves');
select tests.expect_error('select * from public.admin_access_list()', '42501', 'admin cannot list admin users');
select tests.expect_error($$select * from public.admin_find_user('d@example.com')$$, '42501', 'admin cannot look up users for access');
select tests.expect_error(
  format('select private.change_role(%L, array[%L]::public.app_role[], %L)', :admin_id, 'admin', 'superadmin'),
  '42501', 'admin cannot call the private role writer'
);
select tests.expect_error(
  format('update public.profiles set role = %L where id = %L', 'superadmin', :admin_id),
  '42501', 'admin cannot write roles directly'
);
select tests.check((select count(*) from public.admin_role_events) = 0, 'admin cannot read the audit log');
select tests.expect_error($$insert into public.admin_role_events (target_email, previous_role, new_role) values ('x', 'founder', 'admin')$$, '42501', 'audit log cannot be written by clients');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_d, true);
select tests.expect_error($$select public.grant_admin_access('d@example.com')$$, '42501', 'founder cannot grant themselves admin');
select tests.expect_error(
  format('update public.profiles set role = %L where id = %L', 'admin', :founder_d),
  '42501', 'founder cannot change their own role'
);
select tests.check((select count(*) from public.admin_role_events) = 0, 'founder cannot read the audit log');
rollback;

begin;
set local role anon;
select tests.expect_error($$select public.grant_admin_access('d@example.com')$$, '42501', 'anon cannot grant admin access');
rollback;

-- Superadmin grants, promotes and revokes.
begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select tests.check(
  (select owns_startup from public.admin_find_user('B@EXAMPLE.COM')),
  'lookup finds an existing user case-insensitively'
);
select tests.check((select count(*) from public.admin_find_user('nobody@example.com')) = 0, 'lookup returns nothing for unknown email');
select tests.expect_error($$select public.grant_admin_access('nobody@example.com')$$, 'P0002', 'grant needs an existing account');
select tests.expect_error($$select public.grant_admin_access('b@example.com')$$, 'P0001', 'founder with a startup cannot become admin');
select public.grant_admin_access(' D@example.com ');
select tests.expect_error($$select public.grant_admin_access('d@example.com')$$, 'P0001', 'grant refuses existing admins');
commit;

select tests.check((select role = 'admin' from public.profiles where id = :founder_d), 'superadmin granted admin');

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_d, true);
select tests.check((select total_startups from public.admin_dashboard_stats()) >= 1, 'new admin can use admin functions');
select tests.expect_error('select * from public.admin_access_list()', '42501', 'new admin cannot open access management');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', :claims_super, true);
select tests.check(
  (select count(*) from public.admin_access_list()) = 3
  and (select role from public.admin_access_list() where email = 'd@example.com') = 'admin',
  'superadmin lists admins and superadmins'
);
select tests.expect_error(format('select public.promote_to_superadmin(%L, %L)', :founder_d, 'wrong@example.com'), '22023', 'promotion needs the typed email');
select public.promote_to_superadmin(:founder_d, 'D@example.com');
select tests.expect_error(format('select public.revoke_admin_access(%L)', :super_id), '22023', 'self-revoke needs explicit confirmation');
select public.revoke_admin_access(:founder_d);
select tests.expect_error(format('select public.revoke_admin_access(%L, true)', :super_id), 'P0001', 'the last superadmin cannot remove their own access');
commit;

select tests.check(
  (select role = 'founder' from public.profiles where id = :founder_d)
  and (select role = 'superadmin' from public.profiles where id = :super_id),
  'revoked user is a founder again; superadmin unchanged'
);
select tests.check(
  (select string_agg(previous_role || '>' || new_role, ',' order by created_at)
   from public.admin_role_events where target_user_id = :founder_d and changed_by = :super_id)
  = 'founder>admin,admin>superadmin,superadmin>founder',
  'every role change is audited with who made it'
);
select tests.check(
  (select bool_and(changed_by_email = 'owner@example.com') from public.admin_role_events where target_user_id = :founder_d),
  'audit keeps the actor email for when the actor account is deleted'
);

-- Database-level protection of the final superadmin.
select tests.expect_error(
  format('update public.profiles set role = %L where id = %L', 'admin', :super_id),
  'P0001', 'final superadmin cannot be demoted even from SQL'
);
select tests.expect_error(
  format('delete from auth.users where id = %L', :super_id),
  'P0001', 'final superadmin cannot be deleted'
);
begin;
select set_config('innowiut.allow_superadmin_removal', 'on', true);
update public.profiles set role = 'admin' where id = :super_id;
rollback;
select tests.check((select role = 'superadmin' from public.profiles where id = :super_id), 'explicit SQL override is transaction-scoped');

\echo 'All RLS tests passed'
