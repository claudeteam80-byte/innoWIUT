-- LOCAL TEST HARNESS ONLY. V1-shaped data, loaded after the V1 migrations and before the
-- V2.1 migrations, to prove the V2.1 migrations keep existing production data intact.

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'idea@example.com', '{"full_name":"Idea Founder"}'),
  ('a0000000-0000-0000-0000-000000000002', 'validation@example.com', '{"full_name":"Validation Founder"}'),
  ('a0000000-0000-0000-0000-000000000003', 'mvp@example.com', '{"full_name":"MVP Founder"}'),
  ('a0000000-0000-0000-0000-000000000004', 'early@example.com', '{"full_name":"Early Founder"}'),
  ('a0000000-0000-0000-0000-000000000005', 'growth@example.com', '{"full_name":"Growth Founder"}'),
  ('a0000000-0000-0000-0000-000000000006', 'nostage@example.com', '{"full_name":"No Stage"}');

insert into public.startups (id, owner_id, name, tagline, industry, stage, onboarding_completed_at, created_at, updated_at)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Idea Co', 'i', 'AI', 'Idea', now(), now() - interval '40 days', now() - interval '30 days'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Validation Co', 'v', 'SaaS', 'Validation', now(), now() - interval '40 days', now() - interval '30 days'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'MVP Co', 'm', 'EdTech', 'MVP', now(), now() - interval '40 days', now() - interval '30 days'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Early Co', 'e', 'FinTech', 'Early Traction', now(), now() - interval '40 days', now() - interval '30 days'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'Growth Co', 'g', 'Other', 'Growth', now(), now() - interval '40 days', now() - interval '30 days'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'Half Onboarded', null, null, null, null, now() - interval '40 days', now() - interval '30 days');

-- The updated_at trigger overwrote the explicit values above; pin them for the comparison.
alter table public.startups disable trigger startups_set_updated_at;
update public.startups set updated_at = now() - interval '30 days';
alter table public.startups enable trigger startups_set_updated_at;

insert into public.traction_metrics (id, startup_id, name, unit) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'Active Users', 'number');
insert into public.traction_entries (metric_id, value, recorded_on, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 100, current_date - 14, 'a0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000001', 150, current_date - 7, 'a0000000-0000-0000-0000-000000000004');

insert into public.startup_updates (
  startup_id, author_id, title, summary, highlights, challenge, next_steps, status, update_date
) values
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Legacy published',
   'Shipped v1', array['First pilot'], 'Hiring', 'Launch v2', 'published', current_date - 7),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Legacy draft',
   'Half written', '{}', null, null, 'draft', current_date - 1);

create schema compat;
create table compat.startups_before as select * from public.startups;
create table compat.updates_before as select * from public.startup_updates;
create table compat.metrics_before as select * from public.traction_metrics;
create table compat.entries_before as select * from public.traction_entries;
create table compat.profiles_before as select * from public.profiles;
