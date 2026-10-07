// Regenerates src/types/database.ts from the real Supabase schema.
//
// The Supabase CLI refuses to run without SUPABASE_ACCESS_TOKEN. In the Claude Code
// cloud environment the egress proxy replaces the Authorization header with the
// stored token, so a well-formed dummy value is enough there. Elsewhere, export a
// real SUPABASE_ACCESS_TOKEN in your shell first.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PROJECT_REF } from './supabase-mgmt.mjs';

const token = process.env.SUPABASE_ACCESS_TOKEN ?? `sbp_${'0'.repeat(40)}`;
const output = execFileSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', PROJECT_REF, '--schema', 'public'],
  { env: { ...process.env, SUPABASE_ACCESS_TOKEN: token }, encoding: 'utf8' },
);
writeFileSync(new URL('../src/types/database.ts', import.meta.url), output);
execFileSync('npx', ['prettier', '--write', 'src/types/database.ts'], { stdio: 'inherit' });
