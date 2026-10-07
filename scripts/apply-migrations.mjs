// Applies pending supabase/migrations/*.sql to the linked project through the
// Supabase Management API, recording each one in supabase_migrations.schema_migrations
// (the same history table `supabase db push` uses).
//
//   node scripts/apply-migrations.mjs            # apply pending
//   node scripts/apply-migrations.mjs --dry-run  # list pending only
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sql } from './supabase-mgmt.mjs';

const dryRun = process.argv.includes('--dry-run');
const dir = new URL('../supabase/migrations/', import.meta.url).pathname;

await sql(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`);

const applied = new Set(
  (await sql('select version from supabase_migrations.schema_migrations')).map(
    (row) => row.version,
  ),
);
const files = (await readdir(dir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
const pending = files.filter((file) => !applied.has(file.split('_')[0]));

if (pending.length === 0) {
  console.log('No pending migrations.');
  process.exit(0);
}

for (const file of pending) {
  const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
  const name = rest.join('_');
  if (dryRun) {
    console.log(`pending: ${file}`);
    continue;
  }
  const body = await readFile(join(dir, file), 'utf8');
  const record = `insert into supabase_migrations.schema_migrations (version, name, statements)
    values (${quote(version)}, ${quote(name)}, array[${quote(body)}]);`;
  await sql(`begin;\n${body}\n;\n${record}\ncommit;`);
  console.log(`applied: ${file}`);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
