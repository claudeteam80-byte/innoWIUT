-- Stage reviews stay immutable, but removing a user account must still work: the
-- requested_by / reviewed_by foreign keys are ON DELETE SET NULL, so the only change
-- allowed on a decided (or pending) review is clearing those two references.
-- reviewer_name keeps who decided the review.

create or replace function private.protect_stage_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Account removal: only requested_by / reviewed_by are cleared, nothing else changes.
  if (to_jsonb(new) - 'requested_by' - 'reviewed_by') = (to_jsonb(old) - 'requested_by' - 'reviewed_by')
     and (new.requested_by is null or new.requested_by = old.requested_by)
     and (new.reviewed_by is null or new.reviewed_by = old.reviewed_by) then
    return new;
  end if;
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

revoke all on function private.protect_stage_review() from public, anon, authenticated;
