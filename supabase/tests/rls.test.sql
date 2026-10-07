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

\echo 'All RLS tests passed'
