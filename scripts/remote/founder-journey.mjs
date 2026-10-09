// End-to-end founder journey in a real browser against the REAL Supabase project.
//
//   npm run build && npx vite preview --port 4175 --strictPort &   # app using .env.local
//   npm run remote:journey -- --email=you+innowiut-temp-journey@gmail.com
//   npm run remote:journey -- --no-email   # pre-confirmed account, real login screen, no email
//
// Signs up through the UI (Supabase sends a real 6-digit code email), verifies,
// onboards, records traction, works the Startup Journey (requirements, evidence,
// traction proof, no auto-advance), publishes a structured update, edits the profile and team,
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
  createConfirmedUser,
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
const noEmail = process.argv.includes('--no-email');
const email = (arg('email') ?? (noEmail ? 'innowiut-temp-journey@example.com' : '')).toLowerCase();
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
  if (noEmail) {
    // No email is sent: the account is created confirmed (same signup trigger as a real
    // signup) and signs in through the real founder login screen.
    section('Account (no email) and sign in');
    await check('confirmed founder account signs in through the login form', async () => {
      await createConfirmedUser({
        email,
        password,
        fullName: `${TEMP_NAME_PREFIX} Journey Founder`,
      });
      await page.goto(`${BASE}/founder/login`);
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password/i).fill(password);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL(/\/founder\/onboarding/, { timeout: 20000 });
      await page.getByRole('heading', { name: 'About you' }).waitFor();
    });
  } else {
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
  }
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
      // V2.1: current stage card + deterministic next best action from the MVP template.
      const stageCard = page.getByRole('region', { name: /^03/ });
      await stageCard.getByText('0 of 6 requirements completed').waitFor();
      await stageCard.getByText('Complete "Working MVP"').waitFor();
      await page.getByRole('heading', { name: 'Next best action' }).waitFor();
      await page.getByRole('link', { name: 'Continue Journey' }).waitFor();
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

  section('Startup Journey');
  const PDF = Buffer.from('%PDF-1.4\n%innowiut-temp evidence\n%%EOF\n');
  await check(
    'Continue Journey opens the journey at the current stage with locked investor stages',
    async () => {
      await page.goto(`${BASE}/founder/dashboard`);
      await page.getByRole('link', { name: 'Continue Journey' }).click();
      await page.waitForURL(/\/founder\/journey$/);
      await page.getByRole('heading', { name: 'Startup Journey' }).waitFor();
      await page.getByRole('heading', { name: 'MVP', level: 2, exact: true }).waitFor();
      await page.getByLabel('Investor Readiness — Locked').waitFor();
      await page.getByLabel('Investor Access — Locked').waitFor();
      assert(
        (await page.getByRole('button', { name: /Investor/ }).count()) === 0,
        'locked stage is clickable',
      );
      await shot('07-journey');
    },
  );
  await check('founder completes a requirement; progress and next action update', async () => {
    const row = page.locator('li', { has: page.getByRole('heading', { name: 'Working MVP' }) });
    await row.getByRole('button', { name: 'Update', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Working MVP' });
    await dialog.getByLabel('Status').selectOption('completed');
    await dialog.getByRole('button', { name: 'Save Progress' }).click();
    await toast('Working MVP updated.');
    await page.getByText('1 of 6 requirements completed').first().waitFor();
    await page.getByText('Complete "Product URL"').first().waitFor();
    const [req] = await sql(
      `select status, completed_at from public.startup_stage_requirements where startup_id = ${q(startupId)} and requirement_key = 'working_mvp'`,
    );
    assert(req.status === 'completed' && req.completed_at, JSON.stringify(req));
  });
  await check('founder adds a product URL and a PDF document as evidence', async () => {
    const row = page.locator('li', { has: page.getByRole('heading', { name: 'Product URL' }) });
    await row.getByRole('button', { name: 'Add Evidence' }).click();
    let dialog = page.getByRole('dialog', { name: 'Add evidence' });
    await dialog.getByLabel('Evidence type').selectOption('product_url');
    await dialog.getByLabel('Label').fill(`${TEMP_NAME_PREFIX} live product`);
    await dialog.getByLabel('Product URL').fill('example.com/innowiut-temp-app');
    await dialog.getByRole('button', { name: 'Add Evidence' }).click();
    await toast('Evidence added');
    await page.getByRole('button', { name: 'Add Evidence' }).first().click();
    dialog = page.getByRole('dialog', { name: 'Add evidence' });
    await dialog.getByLabel('Evidence type').selectOption('document');
    await dialog.getByLabel('Label').fill(`${TEMP_NAME_PREFIX} user test notes`);
    await dialog
      .getByLabel(/^Document/)
      .setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: PDF });
    await dialog.getByRole('button', { name: 'Add Evidence' }).click();
    await toast('Evidence added');
    await page.getByText(`${TEMP_NAME_PREFIX} user test notes`).waitFor();
    await page.getByRole('link', { name: 'Open document' }).waitFor();
    const rows = await sql(
      `select evidence_type, url, file_path, requirement_id is not null as linked from public.stage_evidence where startup_id = ${q(startupId)} order by created_at`,
    );
    assert(rows.length === 2, JSON.stringify(rows));
    assert(
      rows[0].url === 'https://example.com/innowiut-temp-app' && rows[0].linked,
      JSON.stringify(rows[0]),
    );
    assert(rows[1].file_path?.startsWith(`${startupId}/evidence-`), JSON.stringify(rows[1]));
    await shot('08-journey-evidence');
  });
  await check(
    'completing every MVP requirement shows completion but never moves the stage',
    async () => {
      for (const title of [
        'Product URL',
        'Demo',
        'User Testing',
        'User Feedback',
        'Core Workflow',
      ]) {
        const row = page.locator('li', { has: page.getByRole('heading', { name: title }) });
        await row.getByRole('button', { name: 'Update', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: title });
        await dialog.getByLabel('Status').selectOption('completed');
        if (title === 'User Testing') await dialog.getByLabel(/^Progress/).fill('6');
        await dialog.getByRole('button', { name: 'Save Progress' }).click();
        await toast(`${title} updated.`);
      }
      await page.getByText('6 of 6 requirements completed').first().waitFor();
      await page.getByText('Stage requirements completed').first().waitFor();
      await page.getByText(/Your stage stays MVP until then/).waitFor();
      const [row] = await sql(
        `select stage, journey_stage from public.startups where id = ${q(startupId)}`,
      );
      assert(row.journey_stage === 'mvp' && row.stage === 'MVP', JSON.stringify(row));
      await shot('09-journey-complete');
    },
  );
  await check(
    'traction proof links the existing Active Users metric (values not copied)',
    async () => {
      const [before] = await sql(
        `select count(*)::int n from public.traction_entries where startup_id = ${q(startupId)}`,
      );
      await page.getByRole('button', { name: /^Traction — Upcoming/ }).click();
      await page.waitForURL(/\/founder\/journey\/traction$/);
      await page.getByText('No traction metrics selected yet.').waitFor();
      await page.getByRole('button', { name: 'Select Metrics' }).click();
      const dialog = page.getByRole('dialog', { name: 'Choose your traction metrics' });
      await dialog.getByLabel('Active Users', { exact: true }).check();
      assert(
        (await dialog.getByLabel('Traction metric for Active Users').inputValue()) !== '',
        'existing metric was not suggested',
      );
      await dialog.getByRole('button', { name: 'Save Metrics' }).click();
      await toast('Traction proof updated');
      await page.getByText('Active Users:').first().waitFor();
      const [req] = await sql(`
      select r.title, m.name as metric from public.startup_stage_requirements r
      join public.traction_metrics m on m.id = r.linked_metric_id
      where r.startup_id = ${q(startupId)} and r.stage = 'traction'`);
      assert(req?.metric === 'Active Users', JSON.stringify(req));
      const [after] = await sql(
        `select count(*)::int n from public.traction_entries where startup_id = ${q(startupId)}`,
      );
      assert(before.n === after.n, 'traction entries changed');
    },
  );

  section('Structured updates');
  await check('save a draft with only a headline', async () => {
    await page.goto(`${BASE}/founder/updates`);
    await page.getByRole('button', { name: 'Create Update' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New update' });
    await dialog.getByLabel('Headline').fill(`${TEMP_NAME_PREFIX} Weekly update`);
    assert((await dialog.getByLabel('Linked stage').inputValue()) === 'mvp', 'stage default');
    await dialog.getByRole('button', { name: 'Save Draft' }).click();
    await toast('Draft saved.');
    await page.getByRole('tab', { name: /Drafts/ }).click();
    await page.getByText(`${TEMP_NAME_PREFIX} Weekly update`).waitFor();
  });
  await check('publishing needs what moved and a progress type', async () => {
    await page.getByRole('button', { name: /^Publish$/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit draft' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Publish Update' }).click();
    await dialog.getByText('Describe what moved before publishing.').waitFor();
    await dialog.getByText('Choose at least one progress type.').waitFor();
  });
  await check(
    'edit the draft with evidence, traction movement, blocker and milestone, then publish',
    async () => {
      const dialog = page.getByRole('dialog', { name: 'Edit draft' });
      await dialog
        .getByLabel('What meaningfully changed since your last update?')
        .fill('Shipped the temporary validation build to 20 users.');
      await dialog.getByRole('button', { name: 'Product', exact: true }).click();
      await dialog.getByRole('button', { name: 'Traction', exact: true }).click();
      await dialog.getByRole('button', { name: 'Add evidence' }).click();
      await dialog.getByLabel('Label').fill(`${TEMP_NAME_PREFIX} release notes`);
      await dialog.getByLabel(/^Link\b/).fill('example.com/innowiut-temp-release');
      const movement = dialog.locator('label', { hasText: 'Active Users' });
      await movement.getByText('320 → 400').waitFor();
      await movement.getByRole('checkbox').check();
      await dialog.getByLabel('What is currently slowing you down?').fill('Content production');
      await dialog
        .getByLabel('What specific outcome are you aiming for next?')
        .fill('Reach 1,000 learners');
      await dialog.getByLabel('Target date').fill('2026-12-15');
      await shot('10-update-composer');
      await dialog.getByRole('button', { name: 'Publish Update' }).click();
      await toast('Update published');
      await page.getByRole('tab', { name: /Published/ }).click();
      const card = page.getByRole('article').first();
      await card.getByText('Product · Traction').waitFor();
      await card.getByText('Traction movement').waitFor();
      await card.getByText('320 → 400').waitFor();
      await card.getByText(`${TEMP_NAME_PREFIX} release notes`).waitFor();
      await card.getByText('Reach 1,000 learners').waitFor();
      const [row] = await sql(
        `select status, published_at, progress_types, linked_stage, blocker, next_milestone, next_milestone_date,
        (select count(*) from public.stage_evidence e where e.update_id = u.id and e.evidence_type = 'metric')::int as metric_links,
        (select count(*) from public.stage_evidence e where e.update_id = u.id and e.evidence_type = 'link')::int as links
       from public.startup_updates u where startup_id = ${q(startupId)}`,
      );
      assert(
        row.status === 'published' &&
          row.published_at &&
          row.progress_types.join() === 'Product,Traction' &&
          row.linked_stage === 'mvp' &&
          row.blocker === 'Content production' &&
          row.next_milestone_date === '2026-12-15' &&
          row.metric_links === 1 &&
          row.links === 1,
        JSON.stringify(row),
      );
      await shot('11-updates');
    },
  );
  await check('published update has no edit or delete actions', async () => {
    const card = page.getByRole('article').first();
    assert((await card.getByRole('button').count()) === 0, 'published card has buttons');
  });
  await check('the journey shows the stage-linked update', async () => {
    await page.goto(`${BASE}/founder/journey/mvp`);
    await page.getByText(`${TEMP_NAME_PREFIX} Weekly update`).waitFor();
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
    await shot('12-startup-profile');
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
      await shot('13-mentor');
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
    await shot('14-dashboard-full');
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
    await shot('15-mobile-record-traction');
    await page.keyboard.press('Escape');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert(overflow <= 1, `horizontal overflow ${overflow}px`);
    await shot('16-mobile-dashboard');
    await page.goto(`${BASE}/founder/journey`);
    await page.getByRole('heading', { name: 'Startup Journey' }).waitFor();
    const journeyOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert(journeyOverflow <= 1, `journey horizontal overflow ${journeyOverflow}px`);
    await shot('18-mobile-journey');
    await page.goto(`${BASE}/founder/mentor`);
    await page.getByRole('link', { name: 'Contact Mentor' }).waitFor();
    await shot('17-mobile-mentor');
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
