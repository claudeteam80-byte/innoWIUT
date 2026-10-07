// Real email/password auth flow against the live project, in two steps because a
// human has to read the 6-digit code from their inbox:
//
//   node scripts/remote/auth-flow.mjs signup --email=you+innowiut-temp-founder@example.com
//   node scripts/remote/auth-flow.mjs verify --code=123456
//
// Run scripts/remote/cleanup.mjs afterwards to delete the temporary account.
import { readFileSync, writeFileSync } from 'node:fs';
import {
  assert,
  check,
  newClient,
  section,
  sql,
  summary,
  TEMP_EMAIL_MARKER,
  TEMP_NAME_PREFIX,
  tempPassword,
} from './lib.mjs';

const STATE_FILE = new URL('../../.remote-validation-state.json', import.meta.url);
const [step] = process.argv.slice(2);
const arg = (name) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

if (step === 'signup') {
  const email = arg('email');
  assert(email?.includes(TEMP_EMAIL_MARKER), `--email must contain "${TEMP_EMAIL_MARKER}"`);
  const password = tempPassword();
  writeFileSync(STATE_FILE, JSON.stringify({ email, password }));

  section('Founder signup');
  const client = newClient();
  await check('signUp succeeds and does not create a session before verification', async () => {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: `${TEMP_NAME_PREFIX} Founder Verify`, role: 'admin' } },
    });
    if (error) throw new Error(`${error.code}: ${error.message}`);
    assert(data.user && !data.session, 'expected a user and no session');
  });
  await check(
    'profile auto-created with role = founder (metadata "role":"admin" ignored)',
    async () => {
      const [row] = await sql(
        `select role, full_name from public.profiles where email = ${q(email)}`,
      );
      assert(row?.role === 'founder', `role was ${row?.role}`);
      assert(
        row.full_name === `${TEMP_NAME_PREFIX} Founder Verify`,
        `full_name was ${row.full_name}`,
      );
    },
  );
  await check('email is not yet confirmed', async () => {
    const [row] = await sql(
      `select email_confirmed_at, confirmation_sent_at from auth.users where email = ${q(email)}`,
    );
    assert(row.email_confirmed_at === null, 'already confirmed');
    assert(row.confirmation_sent_at !== null, 'no confirmation email recorded as sent');
  });
  await check('login before verification is refused with email_not_confirmed', async () => {
    const { error } = await newClient().auth.signInWithPassword({ email, password });
    assert(error?.code === 'email_not_confirmed', `got ${error?.code ?? 'success'}`);
  });
  process.exit(summary() ? 0 : 1);
}

if (step === 'verify') {
  const code = arg('code');
  assert(/^\d{6}$/.test(code ?? ''), '--code must be 6 digits');
  const { email, password } = JSON.parse(readFileSync(STATE_FILE, 'utf8'));

  section('6-digit email verification');
  const client = newClient();
  await check('a wrong code is rejected', async () => {
    const wrong = code === '000000' ? '111111' : '000000';
    const { error } = await client.auth.verifyOtp({ email, token: wrong, type: 'email' });
    assert(error, 'wrong code was accepted');
  });
  await check('the real code verifies the email and signs the founder in', async () => {
    const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw new Error(`${error.code}: ${error.message}`);
    assert(data.session && data.user?.email_confirmed_at, 'no session or not confirmed');
  });
  await check('the code cannot be reused', async () => {
    const { error } = await newClient().auth.verifyOtp({ email, token: code, type: 'email' });
    assert(error, 'code was accepted twice');
  });
  await check('verified founder reads own profile with role = founder', async () => {
    const { data, error } = await client.from('profiles').select('role, email');
    if (error) throw error;
    assert(data.length === 1 && data[0].role === 'founder', JSON.stringify(data));
  });
  await check('founder cannot promote themselves to admin', async () => {
    const { data: user } = await client.auth.getUser();
    const result = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user.user.id)
      .select();
    assert(result.error, 'role update was accepted');
    const [row] = await sql(`select role from public.profiles where email = ${q(email)}`);
    assert(row.role === 'founder', `role is now ${row.role}`);
  });

  section('Founder login');
  await check('sign out, then sign in with email + password', async () => {
    await client.auth.signOut({ scope: 'local' });
    const { data, error } = await newClient().auth.signInWithPassword({ email, password });
    if (error) throw new Error(`${error.code}: ${error.message}`);
    assert(data.session, 'no session');
  });
  await check('wrong password is refused with invalid_credentials', async () => {
    const { error } = await newClient().auth.signInWithPassword({
      email,
      password: `${password}x`,
    });
    assert(error?.code === 'invalid_credentials', `got ${error?.code ?? 'success'}`);
  });

  section('Forgot / reset password');
  const newPassword = tempPassword();
  await check('reset email is requested (sent through custom SMTP)', async () => {
    const { error } = await newClient().auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/reset-password',
    });
    if (error) throw new Error(`${error.code}: ${error.message}`);
    const [row] = await sql(`select recovery_sent_at from auth.users where email = ${q(email)}`);
    assert(row.recovery_sent_at, 'recovery_sent_at not set');
  });
  await check(
    'the emailed token_hash opens a recovery session and sets a new password',
    async () => {
      // The email links to /reset-password?token_hash=<recovery_token>&type=recovery.
      // Read the same hash from the database instead of the inbox.
      const [row] = await sql(`select recovery_token from auth.users where email = ${q(email)}`);
      assert(row.recovery_token, 'no recovery token');
      const recovery = newClient();
      const { data, error } = await recovery.auth.verifyOtp({
        token_hash: row.recovery_token,
        type: 'recovery',
      });
      if (error) throw new Error(`${error.code}: ${error.message}`);
      assert(data.session, 'no recovery session');
      const update = await recovery.auth.updateUser({ password: newPassword });
      if (update.error) throw new Error(`${update.error.code}: ${update.error.message}`);
    },
  );
  await check('old password no longer works', async () => {
    const { error } = await newClient().auth.signInWithPassword({ email, password });
    assert(error?.code === 'invalid_credentials', `got ${error?.code ?? 'success'}`);
  });
  await check('new password works', async () => {
    const { error } = await newClient().auth.signInWithPassword({ email, password: newPassword });
    if (error) throw new Error(`${error.code}: ${error.message}`);
  });
  writeFileSync(STATE_FILE, JSON.stringify({ email, password: newPassword }));
  process.exit(summary() ? 0 : 1);
}

console.error('usage: auth-flow.mjs signup --email=… | verify --code=123456');
process.exit(2);
