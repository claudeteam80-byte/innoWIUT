-- LOCAL TEST HARNESS ONLY. Runs after the V2.1 migrations on top of v1_fixture.sql.

create function compat.check(condition boolean, label text) returns void
language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', label;
  end if;
end;
$$;

select compat.check(
  (select string_agg(stage || '>' || journey_stage, ',' order by name) from public.startups where stage is not null)
    = 'Early Traction>traction,Growth>traction,Idea>idea,MVP>mvp,Validation>validation',
  'V1 stages map to journey stages'
);
select compat.check(
  (select journey_stage = 'idea' from public.startups where stage is null),
  'a startup without a stage starts at idea'
);
select compat.check(
  not exists (
    select 1 from public.startups s
    join compat.startups_before b on b.id = s.id
    where to_jsonb(s) - 'journey_stage' is distinct from to_jsonb(b)
  ) and (select count(*) from public.startups) = (select count(*) from compat.startups_before),
  'every V1 startup column (including stage and updated_at) is unchanged'
);
select compat.check(
  not exists (
    select 1 from public.startup_updates u
    join compat.updates_before b on b.id = u.id
    where to_jsonb(u) - array['progress_types', 'blocker', 'next_milestone', 'next_milestone_date', 'linked_stage']
      is distinct from to_jsonb(b)
  ) and (select count(*) from public.startup_updates) = 2,
  'V1 updates (draft and published) are unchanged'
);
select compat.check(
  (select bool_and(progress_types = '{}' and blocker is null and next_milestone is null and linked_stage is null)
   from public.startup_updates),
  'V1 updates get empty structured fields'
);
select compat.check(
  not exists (select * from public.traction_metrics except select * from compat.metrics_before)
  and not exists (select * from public.traction_entries except select * from compat.entries_before)
  and not exists (select * from public.profiles except select * from compat.profiles_before),
  'traction and profiles are unchanged'
);
select compat.check(
  (select count(*) from public.startup_stage_requirements) = 6 * 17
  and (select count(distinct startup_id) from public.startup_stage_requirements) = 6,
  'every existing startup gets its template requirements'
);
select compat.check(
  (select count(*) from public.stage_evidence) = 0,
  'no evidence is invented for existing startups'
);
select compat.check(
  (select allowed_mime_types @> array['image/png', 'application/pdf'] and not public
   from storage.buckets where id = 'update-attachments'),
  'update-attachments stays private and accepts evidence documents'
);

\echo 'All V1 → V2.1 compatibility tests passed'
