// Shared helpers for validating the REAL Supabase project.
// Every temporary record is labelled so scripts/remote/cleanup.mjs can find and remove it:
//   emails contain "innowiut-temp", names start with "TEMP TEST".
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sql } from '../supabase-mgmt.mjs';

export { sql };

export const TEMP_EMAIL_MARKER = 'innowiut-temp';
export const TEMP_NAME_PREFIX = 'TEMP TEST';

export function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(
      '\n',
    )) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && !env[match[1]]) env[match[1]] = match[2];
    }
  } catch {
    // .env.local is optional when the variables are already exported.
  }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
  }
  return { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY };
}

/** A fresh anon-key client with its own in-memory session (like one browser). */
export function newClient() {
  const { url, anonKey } = loadEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function signedInClient(email, password) {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in failed for ${email}: ${error.message}`);
  return client;
}

export function tempPassword() {
  return `Tmp-${randomBytes(12).toString('base64url')}`;
}

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

/**
 * Creates a confirmed email/password auth user directly in the database, without
 * sending email. Goes through the normal auth.users insert trigger, so the profile
 * is created exactly as for a real signup.
 */
export async function createConfirmedUser({ email, password, fullName }) {
  if (!email.includes(TEMP_EMAIL_MARKER))
    throw new Error('Temporary users must use the temp marker.');
  const id = randomUUID();
  await sql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', ${q(id)}, 'authenticated', 'authenticated', ${q(email)},
      extensions.crypt(${q(password)}, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ full_name: fullName }))},
      now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), ${q(id)}, ${q(id)}, 'email',
      ${q(JSON.stringify({ sub: id, email, email_verified: true }))}, now(), now(), now()
    );
  `);
  return id;
}

// ---------------------------------------------------------------------------
// Tiny assertion runner
// ---------------------------------------------------------------------------

const results = [];

export async function check(label, fn) {
  try {
    await fn();
    results.push({ label, ok: true });
    console.log(`  PASS  ${label}`);
  } catch (error) {
    results.push({ label, ok: false, error: error.message });
    console.log(`  FAIL  ${label}\n        ${error.message}`);
  }
}

export function section(title) {
  console.log(`\n## ${title}`);
}

export function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  return failed.length === 0;
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Asserts a PostgREST/Storage call was refused (error returned). */
export function assertDenied(result, message) {
  if (!result.error) throw new Error(`${message} — expected an error but the call succeeded`);
}
