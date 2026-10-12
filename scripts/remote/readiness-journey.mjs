// Investor Readiness (V2.3) end to end in two real browsers against the REAL Supabase project.
//
//   npm run build && npx vite preview --port 4175 --strictPort &
//   npm run remote:readiness-journey
//
// Seeds a temporary founder at Traction (a chosen traction requirement completed, a metric
// with history) and a temporary admin. Then: Traction review approved in the admin UI →
// Investor Readiness opens with data reused from the profile, team and traction → the
// founder completes readiness (pitch deck upload, primary metric, fundraising, N/A with a
// reason) → requests the readiness review → the admin schedules an interview → Needs Work
// with a flagged section → the founder resubmits → the admin marks Investor Ready → the
// founder sees Investor Access unlocked with "Coming Soon" only. No email is sent.
// Everything is removed afterwards.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  assert,
  check as baseCheck,
  completeReadiness,
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
  email: 'innowiut-temp-readiness-founder@example.com',
  password: `Founder-${Date.now()}-Pw`,
};
const admin = {
  email: 'innowiut-temp-readiness-admin@example.com',
  password: `Admin-${Date.now()}-Pw`,
};
const startupName = `${TEMP_NAME_PREFIX} Readiness Startup`;
const feedback = `${TEMP_NAME_PREFIX} Add a clearer use of funds.`;
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

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
const one = async (query) => (await sql(query))[0];

let startupId = null;
let client = null;
let metricId = null;

try {
  section('Setup (temporary founder at Traction, temporary admin)');
  await check('seed a Traction founder with a completed traction requirement', async () => {
    await createConfirmedUser({
      email: founder.email,
      password: founder.password,
      fullName: `${TEMP_NAME_PREFIX} Readiness Founder`,
    });
    client = await signedInClient(founder.email, founder.password);
    const onboard = await client.rpc('complete_onboarding', {
      payload: {
        full_name: `${TEMP_NAME_PREFIX} Readiness Founder`,
        phone: '+998 90 000 00 00',
        role_in_startup: 'CEO',
        name: startupName,
        tagline: 'Temporary readiness startup',
        industry: 'EdTech',
        stage: 'Early Traction',
        founded_year: 2024,
        team_size: 2,
        has_product: true,
        has_users: false,
        has_revenue: false,
        main_goal: 'Prepare to raise',
        biggest_challenge: 'Investor materials',
      },
    });
    if (onboard.error) throw onboard.error;
    startupId = onboard.data;
    const earlier = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const metric = await client.rpc('add_traction_metric', {
      p_name: 'Paying Schools',
      p_unit: 'number',
      p_initial_value: 8,
      p_recorded_on: earlier,
    });
    if (metric.error) throw metric.error;
    metricId = metric.data.id;
    const rec = await client.rpc('record_traction', {
      p_entries: [{ metric_id: metricId, value: 12 }],
      p_recorded_on: today,
    });
    if (rec.error) throw rec.error;
    const req = await client
      .from('startup_stage_requirements')
      .insert({
        startup_id: startupId,
        stage: 'traction',
        requirement_key: 'pilots',
        title: 'Pilots',
        linked_metric_id: metricId,
      })
      .select('id')
      .single();
    if (req.error) throw req.error;
    const done = await client
      .from('startup_stage_requirements')
      .update({ status: 'completed' })
      .eq('id', req.data.id);
    if (done.error) throw done.error;
    const team = await client.from('team_members').insert({
      startup_id: startupId,
      name: `${TEMP_NAME_PREFIX} Co-founder`,
      role: 'CTO',
    });
    if (team.error) throw team.error;
    await createConfirmedUser({
      email: admin.email,
      password: admin.password,
      fullName: `${TEMP_NAME_PREFIX} Readiness Admin`,
    });
    await sql(`update public.profiles set role = 'admin' where email = '${admin.email}'`);
  });

  section('Traction approved → Investor Readiness');
  await check('founder requests the Traction review in the UI', async () => {
    await login(founderPage, '/founder/login', founder, 'Sign In');
    await founderPage.waitForURL(/\/founder\/dashboard/, { timeout: 20000 });
    await founderPage.goto(`${BASE}/founder/journey`);
    const card = founderPage.getByRole('region', { name: 'Stage ready for review' });
    await card.getByText(/next stage \(Investor Readiness\)/).waitFor();
    await card.getByRole('button', { name: 'Request Stage Review' }).click();
    await toast(founderPage, 'Review requested');
  });
  await check('admin approves Traction; the startup enters Investor Readiness', async () => {
    await login(adminPage, '/admin/login', admin, 'Sign In to Admin Dashboard');
    await adminPage.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    await adminPage.goto(`${BASE}/admin/reviews?type=stage`);
    const row = adminPage
      .getByRole('table', { name: 'Stage reviews' })
      .getByRole('row', { name: new RegExp(startupName) });
    await row.getByText('Traction → Investor Readiness').waitFor();
    await row.getByRole('link', { name: `Review ${startupName}` }).click();
    await adminPage.getByRole('button', { name: 'Approve Stage' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Approve Traction stage?' });
    await dialog.getByRole('button', { name: 'Approve & Move to Investor Readiness' }).click();
    await toast(adminPage, 'Approved');
    const s = await one(`select journey_stage from public.startups where id = '${startupId}'`);
    assert(s.journey_stage === 'investor_readiness', s.journey_stage);
    const n = await one(
      `select count(*)::int n from public.investor_readiness_requirements where startup_id = '${startupId}'`,
    );
    assert(n.n === 48, `${n.n} requirements initialised`);
  });

  section('Founder: Investor Readiness reuses existing data');
  await check('journey shows the approval, readiness completion and sections', async () => {
    await founderPage.goto(`${BASE}/founder/journey`);
    await founderPage
      .getByRole('region', { name: 'Stage approved' })
      .getByText('Traction completed')
      .waitFor();
    await founderPage
      .getByRole('region', { name: /^05/ })
      .getByText(/% complete/)
      .waitFor();
    await founderPage.getByRole('list', { name: 'Readiness sections' }).waitFor();
    const company = founderPage.locator('#readiness-company');
    await company.getByText(startupName).waitFor();
    await company.getByText('From your startup profile').first().waitFor();
    assert(
      (await founderPage.getByText(/score/i).count()) === 0,
      'the word "score" appears on the readiness page',
    );
    await shot(founderPage, '01-founder-readiness-start');
  });
  await check(
    'dashboard shows Investor Readiness completion and a deterministic next action',
    async () => {
      await founderPage.goto(`${BASE}/founder/dashboard`);
      const card = founderPage.getByRole('region', { name: /^05/ });
      await card.getByText('Investor Readiness').first().waitFor();
      await card.getByText(/missing/).waitFor();
      await founderPage.getByText('Upload pitch deck').first().waitFor();
    },
  );

  section('Founder completes readiness');
  await check('selects a primary investor metric (linked, never copied)', async () => {
    await founderPage.goto(`${BASE}/founder/journey/investor_readiness`);
    await founderPage.getByRole('button', { name: 'Update Primary Investor Metrics' }).click();
    const dialog = founderPage.getByRole('dialog', { name: 'Primary investor metrics' });
    await dialog.getByLabel(/Paying Schools/).check();
    await dialog.getByRole('button', { name: 'Save Metrics' }).click();
    await toast(founderPage, 'Primary investor metrics saved');
    const traction = founderPage.locator('#readiness-traction');
    await traction.getByText('Previous 8', { exact: false }).waitFor();
    await traction.getByText('+50%').waitFor();
    await traction.getByText('History: 8 → 12').waitFor();
    const cols = await sql(
      `select column_name from information_schema.columns where table_schema='public' and table_name='investor_readiness_metrics'`,
    );
    assert(
      cols
        .map((c) => c.column_name)
        .sort()
        .join() === 'created_at,id,metric_id,startup_id',
      'readiness metrics store numbers',
    );
  });
  await check('uploads the pitch deck as a file', async () => {
    await founderPage.getByRole('button', { name: 'Update Pitch Deck' }).click();
    const dialog = founderPage.getByRole('dialog', { name: 'Pitch Deck' });
    await dialog.getByRole('button', { name: 'Add File or Link' }).click();
    await dialog.getByLabel('Label').fill(`${TEMP_NAME_PREFIX} Pitch deck`);
    await dialog
      .locator('input[type=file]')
      .setInputFiles({ name: 'deck.pdf', mimeType: 'application/pdf', buffer: PDF });
    await dialog.getByRole('button', { name: 'Add Evidence' }).click();
    await toast(founderPage, 'Evidence added');
    await dialog.getByText(`${TEMP_NAME_PREFIX} Pitch deck`).waitFor();
    await dialog.getByRole('button', { name: 'Save' }).click();
    const ev = await one(
      `select e.stage, e.file_path from public.stage_evidence e join public.investor_readiness_requirements r on r.id = e.readiness_requirement_id where r.startup_id = '${startupId}' and r.requirement_key = 'pitch_deck'`,
    );
    assert(
      ev.stage === 'investor_readiness' && ev.file_path?.startsWith(startupId),
      JSON.stringify(ev),
    );
    const state = await client.rpc('investor_readiness_state', { p_startup_id: startupId });
    assert(
      state.data.find((r) => r.requirement_key === 'pitch_deck').is_complete,
      'deck incomplete',
    );
  });
  await check('enters fundraising details in the form', async () => {
    await founderPage.getByRole('button', { name: 'Update Target Raise' }).click();
    const dialog = founderPage.getByRole('dialog', { name: 'Fundraising' });
    await dialog.getByRole('radio', { name: 'Yes' }).check({ force: true });
    await dialog.getByLabel('Round type').selectOption('seed');
    await dialog.getByLabel('Target raise').fill('300000');
    await dialog.getByLabel('Currency').selectOption('USD');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await toast(founderPage, 'Fundraising saved');
    await founderPage.locator('#readiness-fundraising').getByText('$300,000').waitFor();
  });
  await check('marks the financial model not applicable with a reason', async () => {
    await founderPage.getByRole('button', { name: 'Update Financial Model' }).click();
    const dialog = founderPage.getByRole('dialog', { name: 'Financial Model' });
    await dialog.getByLabel('Not applicable to my startup').check();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await dialog.getByText('Add a short reason.').waitFor();
    await dialog.getByLabel(/Why it does not apply/).fill('Grant-funded pilot year');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await toast(founderPage, 'Financial Model saved');
    await founderPage.getByText('Not applicable — Grant-funded pilot year').waitFor();
  });
  await check('completes the remaining answers; completion reaches 100%', async () => {
    // Everything else through the founder's own session (same RLS as the UI).
    await completeReadiness(client, startupId, { skip: ['pitch_deck', 'financial_model'] });
    const fix = await client
      .from('investor_readiness_profiles')
      .update({ target_raise: 300000, raise_currency: 'USD' })
      .eq('startup_id', startupId);
    if (fix.error) throw fix.error;
    await founderPage.reload();
    await founderPage.getByRole('region', { name: /^05/ }).getByText(/100%/).waitFor();
    await founderPage.getByText('Request Investor Readiness Review').first().waitFor();
    await shot(founderPage, '02-founder-readiness-complete');
  });
  await check('requests the Investor Readiness review', async () => {
    await founderPage
      .getByRole('region', { name: 'Investor Readiness review' })
      .getByRole('button', { name: 'Request Investor Readiness Review' })
      .click();
    await toast(founderPage, 'Investor Readiness review requested');
    await founderPage.getByText('Your Investor Readiness is under review').waitFor();
    const r = await one(
      `select review_type, status, to_stage from public.stage_reviews where startup_id = '${startupId}' and review_type = 'investor_readiness'`,
    );
    assert(r.status === 'pending' && r.to_stage === 'investor_access', JSON.stringify(r));
  });

  section('Admin: queue, interview, Needs Work');
  await check('dashboard readiness cards and the Review Type filter', async () => {
    await adminPage.goto(`${BASE}/admin/dashboard`);
    const card = adminPage.getByRole('region', { name: 'Investor Readiness' });
    await card.getByText('Pending Readiness Reviews').waitFor();
    await adminPage.goto(`${BASE}/admin/reviews`);
    await adminPage.getByLabel('Review type').selectOption('investor_readiness');
    await adminPage.waitForURL(/type=investor_readiness/);
    const row = adminPage
      .getByRole('table', { name: 'Stage reviews' })
      .getByRole('row', { name: new RegExp(startupName) });
    await row.getByText('Readiness review').waitFor();
    await shot(adminPage, '03-admin-readiness-queue');
    await row.getByRole('link', { name: `Review ${startupName}` }).click();
  });
  await check('review detail shows the 13 sections', async () => {
    for (const title of [
      '1. Startup summary',
      '2. Company',
      '3. Problem & Market',
      '4. Product',
      '5. Traction',
      '6. Business Model',
      '7. Team',
      '8. Fundraising',
      '9. Legal & Operations',
      '10. Investor Materials',
      '11. Founder updates',
      '12. Mentor context',
      '13. Interview status',
    ])
      await adminPage.getByRole('heading', { name: title, exact: true }).waitFor();
    await adminPage.getByText(`${TEMP_NAME_PREFIX} Pitch deck`).waitFor();
    await shot(adminPage, '04-admin-readiness-detail');
  });
  await check('admin schedules an interview; the founder sees it read-only', async () => {
    await adminPage.getByRole('button', { name: 'Schedule Interview' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Readiness interview' });
    await dialog.getByLabel(/Date and time/).fill('2030-01-15T10:30');
    await dialog.getByLabel(/Location or meeting link/).fill('innoWIUT office, room 204');
    await dialog.getByLabel(/Admin note/).fill(`${TEMP_NAME_PREFIX} ask about churn`);
    await dialog.getByRole('button', { name: 'Save Interview' }).click();
    await toast(adminPage, 'Interview saved');
    await adminPage.getByText(`${TEMP_NAME_PREFIX} ask about churn`).first().waitFor();
    await founderPage.goto(`${BASE}/founder/journey`);
    const card = founderPage.getByRole('region', { name: 'Readiness interview' });
    await card.getByText('Scheduled', { exact: true }).waitFor();
    await card.getByText('innoWIUT office, room 204').waitFor();
    await card.getByText(/January 15, 2030/).waitFor();
    assert((await card.getByRole('button').count()) === 0, 'founder can edit the interview');
    assert(
      (await founderPage.getByText('ask about churn').count()) === 0,
      'admin note visible to the founder',
    );
    await founderPage.getByText('Attend scheduled interview').first().waitFor();
    await shot(founderPage, '05-founder-interview');
  });
  await check('Needs Work requires feedback, flags a section and keeps the stage', async () => {
    await adminPage.getByRole('button', { name: 'Needs Work' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Send back to founder' });
    await dialog.getByRole('button', { name: 'Send Back to Founder' }).click();
    await dialog.getByText('Tell the founder what needs improvement.').waitFor();
    await dialog.getByLabel(/What needs improvement/).fill(feedback);
    await dialog.getByLabel('Fundraising', { exact: true }).check();
    await dialog.getByLabel('Use of Funds').check();
    await dialog.getByRole('button', { name: 'Send Back to Founder' }).click();
    await toast(adminPage, 'Sent back to the founder');
    const s = await one(`select journey_stage from public.startups where id = '${startupId}'`);
    assert(s.journey_stage === 'investor_readiness', s.journey_stage);
  });

  section('Founder resubmits; admin marks Investor Ready');
  await check('founder sees feedback and flagged section, updates and resubmits', async () => {
    await founderPage.goto(`${BASE}/founder/journey`);
    const card = founderPage.getByRole('region', { name: 'Needs work' });
    await card.getByText(feedback).waitFor();
    await card.getByText('Fundraising', { exact: true }).waitFor();
    await card.getByText('Use of Funds', { exact: true }).waitFor();
    await founderPage.getByText('Address innoWIUT feedback').first().waitFor();
    await shot(founderPage, '06-founder-needs-work');
    await founderPage.getByRole('button', { name: 'Update Use of Funds' }).click();
    const dialog = founderPage.getByRole('dialog', { name: 'Fundraising' });
    await dialog.getByLabel('Use of funds').fill('Two engineers (60%), school sales (40%).');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await toast(founderPage, 'Fundraising saved');
    await founderPage
      .getByRole('region', { name: 'Needs work' })
      .getByRole('button', { name: 'Resubmit for Review' })
      .click();
    await toast(founderPage, 'Investor Readiness review requested');
    const rows = await sql(
      `select status from public.stage_reviews where startup_id = '${startupId}' and review_type = 'investor_readiness' order by requested_at`,
    );
    assert(rows.map((r) => r.status).join() === 'needs_work,pending', JSON.stringify(rows));
  });
  await check('admin marks Investor Ready after confirmation', async () => {
    await adminPage.goto(`${BASE}/admin/reviews?type=investor_readiness`);
    await adminPage
      .getByRole('table', { name: 'Stage reviews' })
      .getByRole('row', { name: new RegExp(startupName) })
      .getByRole('link', { name: `Review ${startupName}` })
      .click();
    await adminPage.getByRole('heading', { name: 'Earlier reviews' }).waitFor();
    await adminPage.getByRole('button', { name: 'Mark Investor Ready' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Mark Investor Ready?' });
    await dialog.getByText(/unlocks Investor Access/).waitFor();
    await shot(adminPage, '07-admin-mark-ready');
    await dialog.getByRole('button', { name: 'Mark Investor Ready' }).click();
    await toast(adminPage, 'Marked Investor Ready');
    const s = await one(`select journey_stage from public.startups where id = '${startupId}'`);
    assert(s.journey_stage === 'investor_access', s.journey_stage);
  });
  await check(
    'admin Journey tab shows readiness, Investor Ready date and the interview',
    async () => {
      await adminPage.goto(`${BASE}/admin/startups/${startupId}?tab=journey`);
      await adminPage
        .getByText(/Investor Ready \w+ \d+, \d{4}/)
        .first()
        .waitFor();
      await adminPage.getByText('Readiness completion').first().waitFor();
      await adminPage.getByText('innoWIUT office, room 204').waitFor();
      const history = adminPage.getByRole('list', { name: 'Review history' });
      await history.getByText('Investor Ready').waitFor();
      await history.getByText('Needs Work').waitFor();
      await shot(adminPage, '08-admin-journey-tab');
    },
  );

  section('Founder: Investor Access');
  await check('Investor Access is unlocked with Coming Soon only', async () => {
    await founderPage.goto(`${BASE}/founder/journey`);
    const access = founderPage.getByRole('region', { name: 'Investor Access', exact: true });
    await access.getByText('Unlocked', { exact: true }).waitFor();
    await access.getByText('Investor introductions will be available in the next stage.').waitFor();
    assert(
      await access.getByRole('button', { name: 'Coming Soon' }).isDisabled(),
      'Coming Soon is clickable',
    );
    assert(
      (await founderPage.getByText(/investor directory|matching|message investors/i).count()) === 0,
      'investor functionality shown',
    );
    await shot(founderPage, '09-founder-investor-access');
    await founderPage.goto(`${BASE}/founder/dashboard`);
    await founderPage.getByText('Investor Ready').first().waitFor();
    // Readiness stays visible, read-only.
    await founderPage.goto(`${BASE}/founder/journey/investor_readiness`);
    await founderPage.getByRole('heading', { name: 'Pitch Deck' }).waitFor();
    assert(
      (await founderPage.getByRole('button', { name: /^Update / }).count()) === 0,
      'readiness still editable',
    );
  });

  section('Layouts');
  await check('readiness screens work at phone width without horizontal scroll', async () => {
    await founderPage.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      '/founder/journey',
      '/founder/journey/investor_readiness',
      '/founder/dashboard',
    ]) {
      await founderPage.goto(`${BASE}${path}`);
      await founderPage.waitForLoadState('networkidle');
      assert((await overflow(founderPage)) <= 1, `${path} overflows`);
    }
    await shot(founderPage, '10-founder-phone');
    await adminPage.setViewportSize({ width: 390, height: 844 });
    const rev = await one(
      `select id from public.stage_reviews where startup_id = '${startupId}' and review_type = 'investor_readiness' and status = 'approved'`,
    );
    for (const path of [
      `/admin/reviews/${rev.id}`,
      '/admin/reviews?type=investor_readiness&tab=all',
      '/admin/dashboard',
    ]) {
      await adminPage.goto(`${BASE}${path}`);
      await adminPage.waitForLoadState('networkidle');
      assert((await overflow(adminPage)) <= 1, `${path} overflows`);
    }
    await shot(adminPage, '11-admin-phone');
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
