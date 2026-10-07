-- innoWIUT Founder Platform V1 — storage buckets and policies.
--
-- Object paths are `<startup_id>/<file name>` for startup-owned buckets and
-- `<mentor_id>/<file name>` for mentor photos.
--   startup-logos       public read (via public URL), founder of the startup writes
--   update-attachments  private (signed URLs), founder writes, founder + admin read
--   mentor-photos       public read (via public URL), admins write

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('startup-logos', 'startup-logos', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('update-attachments', 'update-attachments', false, 5242880,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('mentor-photos', 'mentor-photos', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Returns the leading uuid folder of an object path, or null if it is not a uuid.
create function private.storage_path_owner_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

revoke all on function private.storage_path_owner_id(text) from public, anon;
grant execute on function private.storage_path_owner_id(text) to authenticated;

-- startup-logos ------------------------------------------------------------

create policy "startup-logos: founder or admin reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'startup-logos'
    and (
      (select private.owns_startup(private.storage_path_owner_id(name)))
      or (select private.is_admin())
    )
  );

create policy "startup-logos: founder uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'startup-logos'
    and (select private.owns_startup(private.storage_path_owner_id(name)))
  );

create policy "startup-logos: founder replaces"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'startup-logos'
    and (select private.owns_startup(private.storage_path_owner_id(name)))
  )
  with check (
    bucket_id = 'startup-logos'
    and (select private.owns_startup(private.storage_path_owner_id(name)))
  );

create policy "startup-logos: founder deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'startup-logos'
    and (select private.owns_startup(private.storage_path_owner_id(name)))
  );

-- update-attachments -------------------------------------------------------

create policy "update-attachments: founder or admin reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'update-attachments'
    and (
      (select private.owns_startup(private.storage_path_owner_id(name)))
      or (select private.is_admin())
    )
  );

create policy "update-attachments: founder uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'update-attachments'
    and (select private.owns_startup(private.storage_path_owner_id(name)))
  );

create policy "update-attachments: founder replaces"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'update-attachments'
    and (select private.owns_startup(private.storage_path_owner_id(name)))
  )
  with check (
    bucket_id = 'update-attachments'
    and (select private.owns_startup(private.storage_path_owner_id(name)))
  );

create policy "update-attachments: founder deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'update-attachments'
    and (select private.owns_startup(private.storage_path_owner_id(name)))
  );

-- mentor-photos ------------------------------------------------------------

create policy "mentor-photos: admin reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'mentor-photos' and (select private.is_admin()));

create policy "mentor-photos: admin uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mentor-photos' and (select private.is_admin()));

create policy "mentor-photos: admin replaces"
  on storage.objects for update to authenticated
  using (bucket_id = 'mentor-photos' and (select private.is_admin()))
  with check (bucket_id = 'mentor-photos' and (select private.is_admin()));

create policy "mentor-photos: admin deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mentor-photos' and (select private.is_admin()));
