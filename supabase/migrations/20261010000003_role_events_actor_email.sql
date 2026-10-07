-- Keep who made a role change even if that account is later deleted
-- (changed_by becomes null then; the email snapshot remains).
alter table public.admin_role_events add column changed_by_email text;

create or replace function private.log_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
begin
  if new.role is distinct from old.role then
    select * into v_actor from public.profiles where id = (select auth.uid());
    insert into public.admin_role_events (
      target_user_id, target_email, previous_role, new_role, changed_by, changed_by_email
    ) values (
      new.id, new.email, old.role, new.role, v_actor.id, v_actor.email
    );
  end if;
  return new;
end;
$$;
