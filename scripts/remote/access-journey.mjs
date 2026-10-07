// Admin access management in real browsers against the REAL Supabase project.
//
//   npm run build && npx vite preview --port 4175 --strictPort &
//   npm run remote:access-journey
//
// Temporary superadmin, admin and founder (no email sent). Checks the /admin/access
// guard for each role, granting admin access in the UI, admin login after the grant,
// revocation, admin login refused after revocation, the audit history, typed
// confirmation for promotion, and that the last superadmin cannot remove themselves.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  assert,
  check as baseCheck,
  createConfirmedUser,
  section,
  sql,
  summary,
  TEMP_NAME_PREFIX,
} from './lib.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4175';
const shots = process.argv.find((a) => a.startsWith('--screenshots='))?.split('=')[1];
const stamp = Date.now();
const owner = {
  email: 'innowiut-temp-access-owner@example.com',
  password: `Owner-${stamp}-Pw`,
  name: `${TEMP_NAME_PREFIX} Access Owner`,
};
const admin = {
  email: 'innowiut-temp-access-admin@example.com',
  password: `Admin-${stamp}-Pw`,
  name: `${TEMP_NAME_PREFIX} Access Admin`,
};
const candidate = {
  email: 'innowiut-temp-access-candidate@example.com',
  password: `Cand-${stamp}-Pw`,
  name: `${TEMP_NAME_PREFIX} Access Candidate`,
};

const browser = await chromium.launch();
const pageErrors = [];
async function newPage() {
  const page = await (
    await browser.newContext({ viewport: { width: 1360, height: 900 } })
  ).newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  return page;
}
const ownerPage = await newPage();
let failures = 0;
const check = (label, fn) =>
  baseCheck(label, async () => {
    try {
      await fn();
    } catch (error) {
      failures += 1;
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await ownerPage
          .screenshot({ path: `${shots}/FAIL-${failures}.png`, fullPage: true })
          .catch(() => {});
      }
      throw error;
    }
  });
const toast = (page, text) =>
  page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 15000 });
async function login(page, path, account, button) {
  await page.goto(`${BASE}${path}`);
  await page.getByLabel(/email/i).fill(account.email);
  await page.getByLabel(/^password/i).fill(account.password);
  await page.getByRole('button', { name: button }).click();
}
const roleOf = async (email) =>
  (await sql(`select role from public.profiles where email = '${email}'`))[0]?.role;

try {
  section('Setup');
  await check('temporary superadmin, admin and founder', async () => {
    for (const account of [owner, admin, candidate]) {
      await createConfirmedUser({
        email: account.email,
        password: account.password,
        fullName: account.name,
      });
    }
    await sql(`update public.profiles set role = 'superadmin' where email = '${owner.email}';
               update public.profiles set role = 'admin' where email = '${admin.email}';`);
  });

  section('Who can open /admin/access');
  await check('founder cannot open /admin/access', async () => {
    const page = await newPage();
    await login(page, '/founder/login', candidate, 'Sign In');
    await page.waitForURL(/\/founder\/(dashboard|onboarding)/, { timeout: 20000 });
    await page.goto(`${BASE}/admin/access`);
    await page.waitForURL((url) => !url.pathname.startsWith('/admin'), { timeout: 15000 });
    await page.context().close();
  });
  await check(
    'regular admin does not see Admin Access and is redirected from /admin/access',
    async () => {
      const page = await newPage();
      await login(page, '/admin/login', admin, 'Sign In to Admin Dashboard');
      await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
      assert(
        (await page.getByRole('link', { name: 'Admin Access' }).count()) === 0,
        'admin sees Admin Access',
      );
      await page.goto(`${BASE}/admin/access`);
      await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
      await page.context().close();
    },
  );
  await check('superadmin sees Admin Access and the admin list', async () => {
    await login(ownerPage, '/admin/login', owner, 'Sign In to Admin Dashboard');
    await ownerPage.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    await ownerPage.getByRole('link', { name: 'Admin Access' }).click();
    await ownerPage.getByRole('heading', { name: 'Admin Access', level: 1 }).waitFor();
    const table = ownerPage.getByRole('table', { name: 'Admin users' });
    await table.getByText(admin.email).waitFor();
    await table.getByText(owner.email).waitFor();
  });

  section('Grant, sign in, revoke');
  await check(
    'superadmin grants admin access after finding the account and confirming',
    async () => {
      await ownerPage.getByRole('button', { name: /Grant Admin Access/ }).click();
      const dialog = ownerPage.getByRole('dialog', { name: 'Grant admin access' });
      await dialog.getByLabel('Email').fill(candidate.email);
      await dialog.getByRole('button', { name: 'Find account' }).click();
      await dialog.getByText(candidate.name, { exact: true }).waitFor();
      await dialog.getByLabel(/I confirm that/).check();
      if (shots) await ownerPage.screenshot({ path: `${shots}/01-grant.png` });
      await dialog.getByRole('button', { name: 'Grant Admin Access' }).click();
      await toast(ownerPage, 'now has admin access');
      assert((await roleOf(candidate.email)) === 'admin', 'role not admin');
    },
  );
  await check('admin login works after promotion', async () => {
    const page = await newPage();
    await login(page, '/admin/login', candidate, 'Sign In to Admin Dashboard');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    await page.getByRole('heading', { name: 'innoWIUT Startup Dashboard' }).waitFor();
    await page.context().close();
  });
  await check('superadmin revokes access', async () => {
    await ownerPage.reload();
    const row = ownerPage
      .getByRole('table', { name: 'Admin users' })
      .getByRole('row', { name: new RegExp(candidate.email) });
    await row.getByRole('button', { name: 'Revoke Access' }).click();
    await ownerPage
      .getByRole('dialog', { name: /Revoke access for/ })
      .getByRole('button', { name: 'Revoke Access' })
      .click();
    await toast(ownerPage, 'no longer has admin access');
    assert((await roleOf(candidate.email)) === 'founder', 'role not founder');
  });
  await check('admin login stops working after revocation', async () => {
    const page = await newPage();
    await login(page, '/admin/login', candidate, 'Sign In to Admin Dashboard');
    await page
      .getByRole('alert')
      .filter({ hasText: 'does not have administrator access' })
      .waitFor({ timeout: 20000 });
    assert(page.url().endsWith('/admin/login'), `ended on ${page.url()}`);
    await page.context().close();
  });
  await check('role changes appear in the history', async () => {
    await ownerPage.reload();
    const history = ownerPage.locator('section', {
      has: ownerPage.getByRole('heading', { name: 'Role change history' }),
    });
    await history.getByText(`${candidate.email}: Founder → Admin`).waitFor();
    await history.getByText(`${candidate.email}: Admin → Founder`).waitFor();
    if (shots) await ownerPage.screenshot({ path: `${shots}/02-access-page.png`, fullPage: true });
  });

  section('Superadmin safeguards');
  await check('the only superadmin cannot remove their own access', async () => {
    const [{ n }] = await sql(
      `select count(*)::int as n from public.profiles where role = 'superadmin'`,
    );
    if (n !== 1) {
      console.log(
        '        (another superadmin exists — self-removal would be allowed; checked in the DB suites instead)',
      );
      return;
    }
    const row = ownerPage
      .getByRole('table', { name: 'Admin users' })
      .getByRole('row', { name: new RegExp(owner.email) });
    await row.getByRole('button', { name: 'Revoke Access' }).click();
    const dialog = ownerPage.getByRole('dialog', { name: 'Remove your own admin access?' });
    await dialog.getByLabel(/Type REMOVE MY ACCESS/).fill('REMOVE MY ACCESS');
    await dialog.getByRole('button', { name: 'Remove my access' }).click();
    await toast(ownerPage, 'There must always be at least one superadmin.');
    assert((await roleOf(owner.email)) === 'superadmin', 'superadmin removed');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });
  await check('promotion to superadmin needs the typed email', async () => {
    const row = ownerPage
      .getByRole('table', { name: 'Admin users' })
      .getByRole('row', { name: new RegExp(admin.email) });
    await row.getByRole('button', { name: 'Promote to Superadmin' }).click();
    const dialog = ownerPage.getByRole('dialog', { name: 'Promote to superadmin?' });
    const confirm = dialog.getByRole('button', { name: 'Promote to Superadmin' });
    assert(await confirm.isDisabled(), 'confirm enabled before typing');
    await dialog.getByLabel(/Type .* to confirm/).fill(admin.email);
    await confirm.click();
    await toast(ownerPage, 'is now a superadmin');
    assert((await roleOf(admin.email)) === 'superadmin', 'not promoted');
  });
  await check('no uncaught browser errors', async () => {
    assert(pageErrors.length === 0, pageErrors.join(' | '));
  });
} finally {
  await browser.close();
  section('Cleanup');
  execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname], {
    stdio: 'inherit',
    env: process.env,
  });
}

process.exit(summary() ? 0 : 1);
