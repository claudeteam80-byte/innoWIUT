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

// ---------------------------------------------------------------------------
// Investor Readiness (V2.3) helpers — everything through the founder's own session.
// ---------------------------------------------------------------------------

/** Text answers for the requirements a founder writes themselves. */
export const READINESS_TEXT = {
  problem_statement: 'Teachers spend weekends grading.',
  target_customer: 'Private schools in Tashkent.',
  market_opportunity: 'Digital grading is new in the region.',
  market_size: '1,200 private schools (ministry data).',
  key_competitors: 'Paper and spreadsheets.',
  competitive_advantage: 'Uzbek-language grading models.',
  working_product: 'Live with 3 pilot schools.',
  core_value_proposition: 'Grading in minutes, not weekends.',
  revenue_model: 'Per-school subscription.',
  pricing_model: '$90 per school per month.',
  primary_revenue_stream: 'Subscriptions.',
  customer_acquisition: 'Direct sales to school owners.',
  unit_economics: 'Payback in 4 months.',
};

/**
 * Fills every mandatory readiness requirement for a startup in Investor Readiness, except
 * the keys in `skip`. Returns the requirement rows by key.
 */
export async function completeReadiness(client, startupId, { skip = [] } = {}) {
  const reqs = await client
    .from('investor_readiness_requirements')
    .select('id, requirement_key')
    .eq('startup_id', startupId);
  if (reqs.error) throw reqs.error;
  const byKey = Object.fromEntries(reqs.data.map((r) => [r.requirement_key, r.id]));
  const update = async (key, patch) => {
    if (skip.includes(key)) return;
    const r = await client
      .from('investor_readiness_requirements')
      .update(patch)
      .eq('id', byKey[key]);
    if (r.error) throw new Error(`${key}: ${r.error.message}`);
  };
  for (const [key, text] of Object.entries(READINESS_TEXT)) await update(key, { text_value: text });
  await update('product_url', { url: 'https://example.com/app' });
  await update('demo', { url: 'https://example.com/demo' });
  await update('pitch_deck', { url: 'https://example.com/deck.pdf' });
  await update('financial_model', { url: 'https://example.com/model.xlsx' });
  const site = await client
    .from('startups')
    .update({ website: 'https://example.com' })
    .eq('id', startupId);
  if (site.error) throw site.error;
  if (!skip.includes('team_details')) {
    const team = await client
      .from('team_members')
      .update({ relevant_experience: 'Built and sold an edtech product.', commitment: 'full_time' })
      .eq('startup_id', startupId);
    if (team.error) throw team.error;
  }
  const profile = await client
    .from('investor_readiness_profiles')
    .update({
      business_type: 'B2B',
      product_stage: 'launched',
      founder_experience: '6 years in edtech.',
      founder_commitment: 'full_time',
      is_fundraising: true,
      round_type: 'seed',
      target_raise: skip.includes('target_raise') ? null : 250000,
      raise_currency: 'USD',
      use_of_funds: 'Two engineers and sales.',
      runway_months: 9,
      previous_funding: 'None',
      round_outcome: '50 paying schools.',
      company_registered: true,
      jurisdiction: 'Uzbekistan',
      legal_entity_name: 'Temp Test LLC',
      cap_table_prepared: true,
      ip_ownership_clear: true,
      has_legal_blockers: false,
    })
    .eq('startup_id', startupId);
  if (profile.error) throw profile.error;
  return byKey;
}
