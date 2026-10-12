// Stage Review (V2.2) end to end in two real browsers against the REAL Supabase project.
//
//   npm run build && npx vite preview --port 4175 --strictPort &
//   npm run remote:review-journey
//
// Seeds a temporary founder at Validation with every Validation requirement completed
// (plus evidence and a stage-linked update) and a temporary admin. Then: the founder
// requests a review; the admin finds it in the queue, sends it back with feedback; the
// founder sees the feedback and resubmits; the admin approves; the founder sees the stage
// approved and is at MVP; history is kept on both sides. No email is sent. Everything is
// removed afterwards.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  assert,
  check as baseCheck,
  createConfirmedUser,
  section,
  signedInClient,
  sql,
  summary,
  TEMP_NAME_PREFIX,
} from './lib.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4175';
const shots = process.argv.find((a) => a.startsWith('--screenshots='))?.split('=')[1];
const founder = {
  email: 'innowiut-temp-review-founder@example.com',
  password: `Founder-${Date.now()}-Pw`,
};
const admin = {
  email: 'innowiut-temp-review-admin@example.com',
  password: `Admin-${Date.now()}-Pw`,
};
const startupName = `${TEMP_NAME_PREFIX} Review Startup`;
const feedback = `${TEMP_NAME_PREFIX} Add at least 3 more customer interview notes.`;

const browser = await chromium.launch();
const founderPage = await (
  await browser.newContext({ viewport: { width: 1280, height: 900 } })
).newPage();
const adminPage = await (
  await browser.newContext({ viewport: { width: 1360, height: 900 } })
).newPage();
const pageErrors = [];
for (const page of [founderPage, adminPage])
  page.on('pageerror', (e) => pageErrors.push(e.message));

let failures = 0;
const check = (label, fn) =>
  baseCheck(label, async () => {
    try {
      await fn();
    } catch (error) {
      failures += 1;
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await founderPage
          .screenshot({ path: `${shots}/FAIL-${failures}-founder.png`, fullPage: true })
          .catch(() => {});
        await adminPage
          .screenshot({ path: `${shots}/FAIL-${failures}-admin.png`, fullPage: true })
          .catch(() => {});
      }
      throw error;
    }
  });
const shot = async (page, name) => {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};
const toast = (page, text) =>
  page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 15000 });
async function login(page, path, account, button) {
  await page.goto(`${BASE}${path}`);
  await page.getByLabel(/email/i).fill(account.email);
  await page.getByLabel(/^password/i).fill(account.password);
  await page.getByRole('button', { name: button }).click();
}
const overflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

let startupId = null;

try {
  section('Setup (temporary founder at Validation, temporary admin)');
  await check('seed a founder with every Validation requirement completed', async () => {
    await createConfirmedUser({
      email: founder.email,
      password: founder.password,
      fullName: `${TEMP_NAME_PREFIX} Review Founder`,
    });
    const client = await signedInClient(founder.email, founder.password);
    const onboard = await client.rpc('complete_onboarding', {
      payload: {
        full_name: `${TEMP_NAME_PREFIX} Review Founder`,
        phone: '+998 90 000 00 00',
        role_in_startup: 'CEO',
        name: startupName,
        tagline: 'Temporary review validation startup',
        industry: 'EdTech',
        stage: 'Validation',
        founded_year: 2025,
        team_size: 2,
        has_product: false,
        has_users: true,
        current_users: 40,
        has_revenue: false,
        main_goal: 'Validate the problem',
        biggest_challenge: 'Customer access',
      },
    });
    if (onboard.error) throw onboard.error;
    startupId = onboard.data;
    const done = await client
      .from('startup_stage_requirements')
      .update({ status: 'completed' })
      .eq('startup_id', startupId)
      .eq('stage', 'validation')
      .select('id, requirement_key');
    if (done.error) throw done.error;
    const interviews = done.data.find((r) => r.requirement_key === 'customer_interviews');
    const ev = await client.from('stage_evidence').insert({
      startup_id: startupId,
      requirement_id: interviews.id,
      stage: 'validation',
      evidence_type: 'customer_feedback',
      label: `${TEMP_NAME_PREFIX} teacher interview`,
      text_value: 'Grading takes all weekend.',
    });
    if (ev.error) throw ev.error;
    const upd = await client.from('startup_updates').insert({
      startup_id: startupId,
      title: `${TEMP_NAME_PREFIX} Interview sprint`,
      summary: 'Six interviews with teachers.',
      status: 'published',
      progress_types: ['Customer Validation'],
      blocker: 'Finding schools',
      next_milestone: 'Launch an MVP pilot',
      linked_stage: 'validation',
    });
    if (upd.error) throw upd.error;
    await createConfirmedUser({
      email: admin.email,
      password: admin.password,
      fullName: `${TEMP_NAME_PREFIX} Review Admin`,
    });
    await sql(`update public.profiles set role = 'admin' where email = '${admin.email}'`);
  });

  section('Founder requests a stage review');
  await check('dashboard next best action asks for the Validation review', async () => {
    await login(founderPage, '/founder/login', founder, 'Sign In');
    await founderPage.waitForURL(/\/founder\/dashboard/, { timeout: 20000 });
    await founderPage.getByText('Request Validation review').first().waitFor();
    await founderPage.getByText('Ready', { exact: true }).first().waitFor();
  });
  await check('journey shows "Stage ready for review"; requesting makes it pending', async () => {
    await founderPage.goto(`${BASE}/founder/journey`);
    const card = founderPage.getByRole('region', { name: 'Stage ready for review' });
    await card.getByText('You have completed all required milestones for Validation.').waitFor();
    await shot(founderPage, '01-founder-ready');
    await card.getByRole('button', { name: 'Request Stage Review' }).click();
    await toast(founderPage, 'Review requested');
    const pending = founderPage.getByRole('region', { name: 'Stage review' });
    await pending.getByText('Pending Review').waitFor();
    assert(
      await pending.getByRole('button', { name: 'Review Requested' }).isDisabled(),
      'Review Requested should be disabled',
    );
    await pending.getByText(/Requested /).waitFor();
    const [row] = await sql(
      `select status, from_stage, to_stage from public.stage_reviews where startup_id = '${startupId}'`,
    );
    assert(row.status === 'pending' && row.to_stage === 'mvp', JSON.stringify(row));
    await shot(founderPage, '02-founder-pending');
  });
  await check('founder cannot open the admin review queue', async () => {
    await founderPage.goto(`${BASE}/admin/reviews`);
    await founderPage.waitForURL(/\/founder\//, { timeout: 15000 });
  });

  section('Admin sends the review back');
  await check('dashboard shows reviews waiting and opens the queue', async () => {
    await login(adminPage, '/admin/login', admin, 'Sign In to Admin Dashboard');
    await adminPage.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    const card = adminPage.getByRole('region', { name: 'Reviews waiting' });
    const [stats] = await sql(
      `select count(*)::int n from public.stage_reviews where status = 'pending'`,
    );
    await card.getByText(String(stats.n), { exact: true }).waitFor();
    await card.getByRole('link', { name: 'Open Review Queue' }).click();
    await adminPage.waitForURL(/\/admin\/reviews$/);
    await adminPage.getByRole('heading', { name: 'Stage Reviews' }).waitFor();
    const table = adminPage.getByRole('table', { name: 'Stage reviews' });
    const row = table.getByRole('row', { name: new RegExp(startupName) });
    await row.getByText('Validation → MVP').waitFor();
    await row.getByText('6/6').waitFor();
    await shot(adminPage, '03-admin-queue');
    await row.getByRole('link', { name: `Review ${startupName}` }).click();
  });
  await check('review detail shows every section', async () => {
    await adminPage.getByRole('heading', { name: startupName }).waitFor();
    for (const title of [
      '1. Stage summary',
      '2. Requirements',
      '3. Evidence (1)',
      '4. Traction',
      '5. Recent founder updates',
      '6. Blockers & next milestone',
    ])
      await adminPage.getByRole('heading', { name: title }).waitFor();
    await adminPage.getByText(`${TEMP_NAME_PREFIX} teacher interview`).waitFor();
    await adminPage.getByText('Finding schools').first().waitFor();
    await shot(adminPage, '04-admin-review-detail');
  });
  await check('needs work requires feedback and keeps the stage', async () => {
    await adminPage.getByRole('button', { name: 'Needs Work' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Send back to founder' });
    await dialog.getByRole('button', { name: 'Send Back to Founder' }).click();
    await dialog.getByText('Tell the founder what needs improvement.').waitFor();
    await dialog.getByLabel(/What needs improvement/).fill(feedback);
    await dialog.getByLabel('Customer Interviews').check();
    await dialog.getByRole('button', { name: 'Send Back to Founder' }).click();
    await toast(adminPage, 'Sent back to the founder');
    await adminPage.getByText(`“${feedback}”`).waitFor();
    const [s] = await sql(`select journey_stage from public.startups where id = '${startupId}'`);
    assert(s.journey_stage === 'validation', `stage ${s.journey_stage}`);
  });

  section('Founder acts on feedback and resubmits');
  await check('journey shows the feedback, reviewer and requirements to revisit', async () => {
    await founderPage.goto(`${BASE}/founder/journey`);
    const card = founderPage.getByRole('region', { name: 'Needs work' });
    await card.getByText(feedback).waitFor();
    await card.getByText(/by TEMP TEST Review Admin/).waitFor();
    await card.getByText('Customer Interviews').waitFor();
    await founderPage.getByText('Needs attention', { exact: true }).waitFor();
    await card.getByRole('button', { name: 'Update Evidence' }).waitFor();
    await shot(founderPage, '05-founder-needs-work');
    await founderPage.goto(`${BASE}/founder/dashboard`);
    await founderPage.getByText('Address innoWIUT feedback and resubmit').first().waitFor();
  });
  await check('resubmitting creates a new pending review; the first stays in history', async () => {
    await founderPage.goto(`${BASE}/founder/journey`);
    await founderPage
      .getByRole('region', { name: 'Needs work' })
      .getByRole('button', { name: 'Resubmit for Review' })
      .click();
    await toast(founderPage, 'Review requested');
    await founderPage
      .getByRole('region', { name: 'Stage review' })
      .getByText('Pending Review')
      .waitFor();
    const rows = await sql(
      `select status from public.stage_reviews where startup_id = '${startupId}' order by requested_at`,
    );
    assert(rows.map((r) => r.status).join() === 'needs_work,pending', JSON.stringify(rows));
  });

  section('Admin approves; the startup moves to MVP');
  await check('approval confirmation names the move and advances the stage', async () => {
    await adminPage.goto(`${BASE}/admin/reviews`);
    const row = adminPage
      .getByRole('table', { name: 'Stage reviews' })
      .getByRole('row', { name: new RegExp(startupName) });
    await row.getByRole('link', { name: `Review ${startupName}` }).click();
    await adminPage.getByRole('heading', { name: 'Earlier reviews' }).waitFor();
    await adminPage.getByRole('button', { name: 'Approve Stage' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Approve Validation stage?' });
    await dialog.getByText(`This will move ${startupName} from Validation to MVP.`).waitFor();
    await dialog.getByLabel(/Note to the founder/).fill('Strong interview evidence.');
    await shot(adminPage, '06-admin-approve');
    await dialog.getByRole('button', { name: 'Approve & Move to MVP' }).click();
    await toast(adminPage, 'Approved');
    const [s] = await sql(
      `select journey_stage, stage from public.startups where id = '${startupId}'`,
    );
    assert(s.journey_stage === 'mvp' && s.stage === 'Validation', JSON.stringify(s));
  });
  await check('queue tabs: Approved lists it, Needs Work no longer does', async () => {
    await adminPage.goto(`${BASE}/admin/reviews?tab=approved`);
    await adminPage
      .getByRole('row', { name: new RegExp(startupName) })
      .first()
      .waitFor();
    await adminPage.goto(`${BASE}/admin/reviews?tab=needs_work`);
    await adminPage.getByRole('heading', { name: 'Stage Reviews' }).waitFor();
    await adminPage.waitForLoadState('networkidle');
    assert(
      (await adminPage.getByRole('row', { name: new RegExp(startupName) }).count()) === 0,
      'resubmitted review still in Needs Work',
    );
  });
  await check('startup Journey tab shows review status and full history', async () => {
    await adminPage.goto(`${BASE}/admin/startups/${startupId}?tab=journey`);
    const history = adminPage.getByRole('list', { name: 'Review history' });
    await history.getByText('Approved').waitFor();
    await history.getByText('Needs Work').waitFor();
    await adminPage.getByText(`“${feedback}”`).first().waitFor();
    await shot(adminPage, '07-admin-journey-tab');
  });

  section('Founder sees the approval');
  await check('journey shows "Stage approved" and the startup is at MVP', async () => {
    await founderPage.goto(`${BASE}/founder/journey`);
    const card = founderPage.getByRole('region', { name: 'Stage approved' });
    await card.getByText('Validation completed').waitFor();
    await card.getByRole('button', { name: /Continue to MVP/ }).waitFor();
    await founderPage.getByRole('region', { name: /^03/ }).waitFor();
    const history = founderPage.getByRole('list', { name: 'Review history' });
    await history.getByText('Approved').waitFor();
    await history
      .getByText(/Reviewed by innoWIUT/)
      .first()
      .waitFor();
    await shot(founderPage, '08-founder-approved');
    // Earlier evidence stays available.
    await founderPage.goto(`${BASE}/founder/journey/validation`);
    await founderPage.getByText(`${TEMP_NAME_PREFIX} teacher interview`).waitFor();
  });
  await check('dashboard says Continue to MVP', async () => {
    await founderPage.goto(`${BASE}/founder/dashboard`);
    await founderPage.getByText('Continue to MVP').first().waitFor();
  });

  section('Layouts');
  await check('review screens work at phone width without horizontal scroll', async () => {
    await adminPage.setViewportSize({ width: 390, height: 844 });
    await adminPage.goto(`${BASE}/admin/reviews?tab=all`);
    await adminPage.getByRole('list', { name: 'Stage reviews' }).waitFor();
    assert((await overflow(adminPage)) <= 1, 'queue overflows');
    await shot(adminPage, '09-admin-queue-phone');
    const [rev] = await sql(
      `select id from public.stage_reviews where startup_id = '${startupId}' and status = 'approved'`,
    );
    await adminPage.goto(`${BASE}/admin/reviews/${rev.id}`);
    await adminPage.getByRole('heading', { name: startupName }).waitFor();
    assert((await overflow(adminPage)) <= 1, 'detail overflows');
    await founderPage.setViewportSize({ width: 390, height: 844 });
    await founderPage.goto(`${BASE}/founder/journey`);
    await founderPage.getByRole('region', { name: 'Stage approved' }).waitFor();
    assert((await overflow(founderPage)) <= 1, 'journey overflows');
    await shot(founderPage, '10-founder-journey-phone');
  });
  await check('no uncaught errors in either browser', async () => {
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
