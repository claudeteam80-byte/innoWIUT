// End-to-end founder journey in a real browser against the REAL Supabase project.
//
//   npm run build && npx vite preview --port 4175 --strictPort &   # app using .env.local
//   npm run remote:journey -- --email=you+innowiut-temp-journey@gmail.com
//
// Signs up through the UI (Supabase sends a real 6-digit code email), verifies,
// onboards, records traction, publishes an update, edits the profile and team,
// requests a mentor meeting after a temporary mentor is assigned, then reloads to
// check persistence. Every record is labelled and removed at the end (files through
// the Storage API, rows via scripts/remote/cleanup.mjs).
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import {
  assert,
  check as baseCheck,
  newClient,
  section,
  sql,
  summary,
  TEMP_EMAIL_MARKER,
  TEMP_NAME_PREFIX,
} from './lib.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4175';
const arg = (name) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const email = (arg('email') ?? '').toLowerCase();
const shots = arg('screenshots');
assert(email.includes(TEMP_EMAIL_MARKER), `--email must contain "${TEMP_EMAIL_MARKER}"`);
const password = `Journey-${Date.now()}-Pw`;
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** The emailed code, recovered from Supabase's stored hash: sha224(email + code). */
async function emailedCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const [row] = await sql(`select confirmation_token from auth.users where email = ${q(email)}`);
    const hash = row?.confirmation_token?.replace(/^pkce_/, '');
    if (hash) {
      for (let n = 0; n < 1_000_000; n += 1) {
        const code = String(n).padStart(6, '0');
        if (
          createHash('sha224')
            .update(email + code)
            .digest('hex') === hash
        )
          return code;
      }
      throw new Error('Code not found for stored hash');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('No confirmation token stored');
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
const shot = async (name) => {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};
const toast = (text) =>
  page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 15000 });
let startupId = null;
let failures = 0;
/** Like check(), but saves a screenshot when a step fails. */
const check = (label, fn) =>
  baseCheck(label, async () => {
    try {
      await fn();
    } catch (error) {
      failures += 1;
      if (shots)
        await page
          .screenshot({ path: `${shots}/FAIL-${failures}.png`, fullPage: true })
          .catch(() => {});
      throw error;
    }
  });

try {
  section('Signup and email verification');
  await check('founder signs up through the real signup form', async () => {
    await page.goto(`${BASE}/founder/signup`);
    await page.getByLabel('Full Name').fill(`${TEMP_NAME_PREFIX} Journey Founder`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByLabel(/I agree/).check();
    await page.getByRole('button', { name: 'Create Founder Account' }).click();
    await page.waitForURL(/\/founder\/verify-email/, { timeout: 20000 });
  });
  await check(
    'the 6-digit code from the email verifies the account and opens onboarding',
    async () => {
      const code = await emailedCode();
      await page.getByLabel('Verification code').fill(code);
      await page.getByRole('button', { name: 'Verify' }).click();
      await page.waitForURL(/\/founder\/onboarding/, { timeout: 20000 });
      await page.getByRole('heading', { name: 'About you' }).waitFor();
    },
  );
  await check('dashboard is blocked until onboarding is complete', async () => {
    await page.goto(`${BASE}/founder/dashboard`);
    await page.waitForURL(/\/founder\/onboarding/, { timeout: 15000 });
  });

  section('Onboarding');
  await check('three steps complete with a logo and land on the dashboard', async () => {
    await shot('01-onboarding-step1');
    await page.getByLabel('Phone number').fill('+998 90 123 45 67');
    await page.getByLabel('LinkedIn URL').fill('linkedin.com/in/innowiut-temp');
    await page.getByLabel('Role in startup').selectOption('CEO');
    await page.getByRole('button', { name: /Continue/ }).click();

    await page
      .getByLabel('Startup logo (optional)')
      .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await page.getByLabel('Startup name').fill(`${TEMP_NAME_PREFIX} Journey Startup`);
    await page.getByLabel('One-line description').fill('Temporary validation startup');
    await page.getByLabel('Industry').selectOption('EdTech');
    await page.getByLabel('Startup stage').selectOption('MVP');
    await page.getByLabel('Founded year').fill('2025');
    await page.getByLabel('Team size').fill('3');
    await shot('02-onboarding-step2');
    await page.getByRole('button', { name: /Continue/ }).click();

    const answer = (group, value) =>
      page.getByRole('group', { name: group }).getByText(value, { exact: true }).click();
    await answer(/working product/, 'Yes');
    await answer(/currently have users/, 'Yes');
    await page.getByLabel('Current number of users').fill('320');
    await answer(/have revenue/, 'Yes');
    await page.getByLabel('Current monthly revenue').fill('1500000');
    await page.getByLabel('Currency').selectOption('UZS');
    await page.getByLabel('Current main goal').fill('Reach 1,000 learners');
    await page.getByLabel('Biggest current challenge').fill('Content production');
    await shot('03-onboarding-step3');
    await page.getByRole('button', { name: 'Complete setup' }).click();
    await page.waitForURL(/\/founder\/dashboard/, { timeout: 30000 });
  });
  await check('onboarding stored everything server-side in one go', async () => {
    const [row] = await sql(`
      select s.id, s.onboarding_completed_at, s.logo_path, s.founder_role, p.phone, p.full_name,
        (select count(*) from public.traction_metrics m where m.startup_id = s.id) as metrics
      from public.startups s join public.profiles p on p.id = s.owner_id where p.email = ${q(email)}`);
    startupId = row.id;
    assert(
      row.onboarding_completed_at &&
        row.founder_role === 'CEO' &&
        row.phone === '+998 90 123 45 67',
      JSON.stringify(row),
    );
    assert(row.logo_path?.startsWith(`${row.id}/logo-`), `logo_path ${row.logo_path}`);
    assert(Number(row.metrics) === 2, `metrics ${row.metrics}`);
  });

  section('Dashboard');
  await check(
    'shows greeting, startup summary, real onboarding traction and empty states',
    async () => {
      await page.getByRole('heading', { name: /Good (morning|afternoon|evening), TEMP/ }).waitFor();
      await page.getByRole('heading', { name: `${TEMP_NAME_PREFIX} Journey Startup` }).waitFor();
      await page.getByText('Active Users').first().waitFor();
      await page.getByText('1 500 000 UZS').first().waitFor();
      await page.getByText('No updates yet').waitFor();
      await page.getByText('No mentor assigned yet.').waitFor();
      await page.getByText('Reach 1,000 learners').waitFor();
      const logo = page
        .locator(`img[src*="/storage/v1/object/public/startup-logos/${startupId}/"]`)
        .first();
      await logo.waitFor();
      await shot('04-dashboard-new');
    },
  );

  section('Traction');
  await check('add a custom metric with a first value and target', async () => {
    await page.goto(`${BASE}/founder/traction`);
    await page.getByRole('button', { name: 'Add Metric' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add metric' });
    await dialog.getByRole('combobox', { name: /^Metric/ }).selectOption('Customers');
    await dialog.getByLabel('Current value').fill('12');
    await dialog.getByLabel('Target').fill('50');
    await dialog.getByRole('button', { name: 'Add Metric' }).click();
    await toast('Customers is now tracked.');
  });
  await check(
    'update several metrics in one workflow; values derived by the database',
    async () => {
      await page.getByRole('button', { name: 'Update Metrics' }).click();
      const dialog = page.getByRole('dialog', { name: 'Update traction' });
      await dialog.getByLabel('New value for Customers').fill('18');
      await dialog.getByLabel('New value for Active Users').fill('400');
      await dialog.getByLabel('Note').fill('Temporary validation entry');
      await shot('05-record-traction');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await toast('2 metrics recorded.');
      const rows = await sql(
        `select name, current_value, previous_value from public.traction_metrics where startup_id = ${q(startupId)} order by name`,
      );
      const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
      assert(
        Number(byName['Active Users'].current_value) === 400 &&
          Number(byName['Active Users'].previous_value) === 320,
        JSON.stringify(byName['Active Users']),
      );
      assert(
        Number(byName.Customers.current_value) === 18 &&
          Number(byName.Customers.previous_value) === 12,
        JSON.stringify(byName.Customers),
      );
    },
  );
  await check('cards, chart and history refresh with the new values', async () => {
    await page.getByText('+25%').first().waitFor();
    await page.getByText('+50%').first().waitFor();
    await page.getByRole('img', { name: /Active Users: \d+ values? from/ }).waitFor();
    await page
      .getByRole('table', { name: /Traction history/ })
      .getByText('Temporary validation entry')
      .first()
      .waitFor();
    await shot('06-traction');
  });

  section('Updates');
  await check('save a draft with only a title', async () => {
    await page.goto(`${BASE}/founder/updates`);
    await page.getByRole('button', { name: 'Create Update' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New update' });
    await dialog.getByLabel('Update title').fill(`${TEMP_NAME_PREFIX} Weekly update`);
    await dialog.getByRole('button', { name: 'Save Draft' }).click();
    await toast('Draft saved.');
    await page.getByRole('tab', { name: /Drafts/ }).click();
    await page.getByText(`${TEMP_NAME_PREFIX} Weekly update`).waitFor();
  });
  await check('edit the draft with highlights, image and link, then publish', async () => {
    await page.getByRole('button', { name: /Edit draft/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit draft' });
    await dialog.getByLabel('What happened?').fill('Shipped the temporary validation build.');
    await dialog.getByLabel('Highlight 1', { exact: true }).fill('First highlight');
    await dialog.getByRole('button', { name: 'Add highlight' }).click();
    await dialog.getByLabel('Highlight 2', { exact: true }).fill('Second highlight');
    await dialog.getByLabel('Next steps').fill('Clean up test data');
    await dialog.getByLabel('External link').fill('example.com/innowiut-temp');
    await dialog
      .getByLabel('Image (optional)')
      .setInputFiles({ name: 'update.png', mimeType: 'image/png', buffer: PNG });
    await shot('07-update-dialog');
    await dialog.getByRole('button', { name: 'Publish Update' }).click();
    await toast('Update published');
    await page.getByRole('tab', { name: /Published/ }).click();
    await page.getByText('Second highlight').waitFor();
    const image = page.locator('img[src*="/storage/v1/object/sign/update-attachments/"]').first();
    await image.waitFor({ state: 'attached' });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('img')].some(
          (img) =>
            img.src.includes('/object/sign/update-attachments/') &&
            img.complete &&
            img.naturalWidth > 0,
        ),
      undefined,
      { timeout: 20000 },
    );
    const [row] = await sql(
      `select status, published_at, image_path, highlights from public.startup_updates where startup_id = ${q(startupId)}`,
    );
    assert(
      row.status === 'published' &&
        row.published_at &&
        row.image_path.startsWith(`${startupId}/update-`),
      JSON.stringify(row),
    );
    await shot('08-updates');
  });
  await check('published update has no edit or delete actions', async () => {
    const card = page.getByRole('article').first();
    assert((await card.getByRole('button').count()) === 0, 'published card has buttons');
  });

  section('Startup profile and team');
  await check('edit startup profile and add a team member', async () => {
    await page.goto(`${BASE}/founder/startup`);
    await page.getByLabel('Tagline').fill('Edited temporary tagline');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await toast('Startup profile saved.');
    await page.getByRole('button', { name: 'Add Team Member' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add team member' });
    await dialog.getByLabel('Name').fill(`${TEMP_NAME_PREFIX} Teammate`);
    await dialog.getByLabel('Role').fill('CTO');
    await dialog.getByRole('button', { name: 'Add Team Member' }).click();
    await toast('Team member added.');
    await shot('09-startup-profile');
  });

  section('Mentor and meeting requests');
  await check('mentor page shows the empty state before assignment', async () => {
    await page.goto(`${BASE}/founder/mentor`);
    await page.getByText('Your assigned innoWIUT mentor will appear here.').waitFor();
  });
  await check(
    'after an assignment, founder sees mentor and notes and requests a meeting',
    async () => {
      const [mentor] =
        await sql(`insert into public.mentors (name, title, expertise, email, telegram, linkedin_url, bio)
      values (${q(`${TEMP_NAME_PREFIX} Mentor`)}, 'Startup Mentor', array['Growth','Fundraising'], 'mentor.innowiut-temp@example.com', '@innowiut_temp', 'linkedin.com/in/innowiut-temp', 'Temporary mentor for validation.') returning id`);
      await sql(`insert into public.mentor_assignments (startup_id, mentor_id) values (${q(startupId)}, ${q(mentor.id)});
      insert into public.mentor_notes (startup_id, mentor_id, body) values (${q(startupId)}, ${q(mentor.id)}, ${q(`${TEMP_NAME_PREFIX} focus on retention`)});`);
      await page.reload();
      await page.getByRole('heading', { name: `${TEMP_NAME_PREFIX} Mentor` }).waitFor();
      await page.getByText(`${TEMP_NAME_PREFIX} focus on retention`).waitFor();
      const contact = page.getByRole('link', { name: 'Contact Mentor' });
      assert(
        (await contact.getAttribute('href')) === 'mailto:mentor.innowiut-temp@example.com',
        'contact link',
      );
      await page.getByRole('button', { name: 'Request Meeting' }).click();
      const dialog = page.getByRole('dialog', { name: 'Request a meeting' });
      await dialog.getByLabel('Reason').selectOption('Fundraising');
      await dialog.getByLabel('Message').fill('Temporary validation request');
      await dialog.getByRole('button', { name: 'Request Meeting' }).click();
      await toast('Meeting requested');
      await page.getByText('Temporary validation request').waitFor();
      await page.getByText('Requested', { exact: true }).waitFor();
      await shot('10-mentor');
    },
  );

  section('Settings');
  await check('update profile phone', async () => {
    await page.goto(`${BASE}/founder/settings`);
    await page.getByLabel('Phone number').fill('+998 91 000 00 00');
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await toast('Profile saved.');
  });

  section('Persistence after reload');
  await check('everything is still there after a full reload', async () => {
    await page.goto(`${BASE}/founder/dashboard`);
    await page.reload();
    await page.getByText('Edited temporary tagline').waitFor();
    await page.getByText(`${TEMP_NAME_PREFIX} Weekly update`).waitFor();
    await page.getByRole('link', { name: 'View mentor' }).waitFor();
    await page.getByText('400', { exact: true }).first().waitFor();
    await shot('11-dashboard-full');
    await page.goto(`${BASE}/founder/startup`);
    await page.getByText(`${TEMP_NAME_PREFIX} Teammate`).waitFor();
    await page.goto(`${BASE}/founder/settings`);
    assert(
      (await page.getByLabel('Phone number').inputValue()) === '+998 91 000 00 00',
      'phone not saved',
    );
  });

  section('Mobile layout');
  await check('dashboard, traction update and mentor contact work at phone width', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/founder/dashboard`);
    await page.getByRole('button', { name: 'Update Traction' }).click();
    await page.getByRole('dialog', { name: 'Update traction' }).waitFor();
    await shot('12-mobile-record-traction');
    await page.keyboard.press('Escape');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert(overflow <= 1, `horizontal overflow ${overflow}px`);
    await shot('13-mobile-dashboard');
    await page.goto(`${BASE}/founder/mentor`);
    await page.getByRole('link', { name: 'Contact Mentor' }).waitFor();
    await shot('14-mobile-mentor');
  });

  await check('no uncaught errors in the browser', async () => {
    assert(pageErrors.length === 0, pageErrors.join(' | '));
  });
} finally {
  await browser.close();
  section('Cleanup');
  if (startupId) {
    // Remove files through the Storage API as their owner so the stored objects are deleted too.
    const client = newClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) {
      for (const bucket of ['startup-logos', 'update-attachments']) {
        const { data } = await client.storage.from(bucket).list(startupId);
        const paths = (data ?? []).map((file) => `${startupId}/${file.name}`);
        if (paths.length) await client.storage.from(bucket).remove(paths);
        console.log(`  removed ${paths.length} file(s) from ${bucket}`);
      }
    }
  }
  execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname], {
    stdio: 'inherit',
    env: process.env,
  });
}

process.exit(summary() ? 0 : 1);
