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

const users = await sql(`delete from auth.users where email like ${like} returning email`);
console.log(
  `auth users removed: ${users.length}${users.length ? ` (${users.map((u) => u.email).join(', ')})` : ''}`,
);

const mentors = await sql(
  `delete from public.mentors where name like '${TEMP_NAME_PREFIX}%' returning name`,
);
console.log(`mentors removed: ${mentors.length}`);

const [remaining] = await sql(`
  select
    (select count(*) from auth.users where email like ${like}) as temp_users,
    (select count(*) from public.profiles where email like ${like}) as temp_profiles,
    (select count(*) from public.mentors where name like '${TEMP_NAME_PREFIX}%') as temp_mentors,
    (select count(*) from public.startups where name like '${TEMP_NAME_PREFIX}%') as temp_startups,
    (select count(*) from storage.objects where split_part(name, '/', 1) in (${folderList})) as temp_objects
`);
console.log('remaining temp records:', remaining);
