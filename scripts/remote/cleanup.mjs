// Removes every temporary validation record from the real project:
// storage objects in temp startup/mentor folders, TEMP TEST mentors, and every auth
// user whose email contains "innowiut-temp" (their profiles, startups and all
// startup-owned rows cascade). Safe to run repeatedly.
import { sql, TEMP_EMAIL_MARKER, TEMP_NAME_PREFIX } from './lib.mjs';

const like = `'%${TEMP_EMAIL_MARKER}%'`;

const folders = await sql(`
  select s.id::text as folder from public.startups s
  join auth.users u on u.id = s.owner_id where u.email like ${like}
  union
  select id::text from public.mentors where name like '${TEMP_NAME_PREFIX}%'
`);
const folderList = folders.map((row) => `'${row.folder}'`).join(',') || `'none'`;

// Remove storage objects through the Storage API path is not possible without the
// owner's session once a test has failed midway, so delete the rows the storage
// service tracks, explicitly allowing it for this transaction only.
const objects = await sql(`
  select bucket_id, name from storage.objects
  where split_part(name, '/', 1) in (${folderList})
`);
if (objects.length > 0) {
  await sql(`
    begin;
    select set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where split_part(name, '/', 1) in (${folderList});
    commit;
  `);
}
console.log(`storage objects removed: ${objects.length}`);

// Temporary superadmins may be the only superadmin while testing; the
// last-superadmin guard is overridden for this transaction and for temp accounts only.
const users = await sql(`
  begin;
  select set_config('innowiut.allow_superadmin_removal', 'on', true);
  delete from auth.users where email like ${like} returning email;
  commit;
`);
console.log(
  `auth users removed: ${users.length}${users.length ? ` (${users.map((u) => u.email).join(', ')})` : ''}`,
);

// Role-change events are permanent in production; only test accounts' events are removed.
const events = await sql(
  `delete from public.admin_role_events where target_email like ${like} returning id`,
);
console.log(`role events removed: ${events.length}`);

const mentors = await sql(
  `delete from public.mentors where name like '${TEMP_NAME_PREFIX}%' returning name`,
);
console.log(`mentors removed: ${mentors.length}`);

const [remaining] = await sql(`
  select
    (select count(*) from auth.users where email like ${like}) as temp_users,
    (select count(*) from public.profiles where email like ${like}) as temp_profiles,
    (select count(*) from public.mentors where name like '${TEMP_NAME_PREFIX}%') as temp_mentors,
    (select count(*) from public.admin_role_events where target_email like ${like}) as temp_role_events,
    (select count(*) from public.startups where name like '${TEMP_NAME_PREFIX}%') as temp_startups,
    (select count(*) from public.startup_stage_requirements r
      where not exists (select 1 from public.startups s where s.id = r.startup_id)) as orphan_requirements,
    (select count(*) from public.stage_evidence e
      where e.label like '${TEMP_NAME_PREFIX}%') as temp_evidence,
    (select count(*) from storage.objects where split_part(name, '/', 1) in (${folderList})) as temp_objects
`);
console.log('remaining temp records:', remaining);
