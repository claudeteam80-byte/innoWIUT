// Admin journey in real browsers against the REAL Supabase project.
//
//   npm run build && npx vite preview --port 4175 --strictPort &
//   npm run remote:admin-journey
//
// Seeds a temporary onboarded founder (traction, one published update, one draft)
// and a temporary admin, then: admin logs in, checks dashboard stats against the
// database, finds the startup, sees real traction and the published update (not the
// draft), the Stage Distribution and the read-only Journey tab, creates a mentor with a photo, assigns them, adds a note; the founder sees
// mentor and note and requests a meeting; the admin confirms it; the founder sees
// "Confirmed". Everything is removed afterwards. No email is sent.
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
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const founder = {
  email: 'innowiut-temp-admin-journey-founder@example.com',
  password: `Founder-${Date.now()}-Pw`,
};
const admin = {
  email: 'innowiut-temp-admin-journey-admin@example.com',
  password: `Admin-${Date.now()}-Pw`,
};
const startupName = `${TEMP_NAME_PREFIX} Admin Journey Startup`;
const mentorName = `${TEMP_NAME_PREFIX} Admin Journey Mentor`;
const noteText = `${TEMP_NAME_PREFIX} interview ten customers this week`;
const publishedTitle = `${TEMP_NAME_PREFIX} Published progress`;
const draftTitle = `${TEMP_NAME_PREFIX} Private draft`;
const stageEvidenceLabel = `${TEMP_NAME_PREFIX} customer quote`;
const draftEvidenceLabel = `${TEMP_NAME_PREFIX} draft-only evidence`;

const browser = await chromium.launch();
const adminPage = await (
  await browser.newContext({ viewport: { width: 1360, height: 900 } })
).newPage();
const founderPage = await (
  await browser.newContext({ viewport: { width: 1280, height: 900 } })
).newPage();
const pageErrors = [];
for (const page of [adminPage, founderPage])
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
        await adminPage
          .screenshot({ path: `${shots}/FAIL-${failures}-admin.png`, fullPage: true })
          .catch(() => {});
        await founderPage
          .screenshot({ path: `${shots}/FAIL-${failures}-founder.png`, fullPage: true })
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

let mentorId = null;
let adminClient = null;

try {
  section('Setup (temporary founder with real data, temporary admin)');
  await check(
    'seed an onboarded founder with traction, a published update and a draft',
    async () => {
      await createConfirmedUser({
        email: founder.email,
        password: founder.password,
        fullName: `${TEMP_NAME_PREFIX} Journey Founder`,
      });
      const client = await signedInClient(founder.email, founder.password);
      const onboard = await client.rpc('complete_onboarding', {
        payload: {
          full_name: `${TEMP_NAME_PREFIX} Journey Founder`,
          phone: '+998 90 000 00 00',
          role_in_startup: 'CEO',
          name: startupName,
          tagline: 'Temporary admin validation startup',
          industry: 'FinTech',
          stage: 'Validation',
          founded_year: 2025,
          team_size: 2,
          has_product: true,
          has_users: true,
          current_users: 100,
          has_revenue: true,
          monthly_revenue: 2000,
          revenue_currency: 'USD',
          main_goal: 'Validate pricing',
          biggest_challenge: 'Customer access',
        },
      });
      if (onboard.error) throw onboard.error;
      const startupId = onboard.data;
      const { data: metrics } = await client
        .from('traction_metrics')
        .select('id, name')
        .eq('startup_id', startupId);
      const users = metrics.find((m) => m.name === 'Active Users');
      const recorded = await client.rpc('record_traction', {
        p_entries: [{ metric_id: users.id, value: 130 }],
        p_note: 'Temporary entry',
      });
      if (recorded.error) throw recorded.error;
      const updates = await client.from('startup_updates').insert(
        [
          {
            startup_id: startupId,
            title: publishedTitle,
            summary: 'Visible to innoWIUT.',
            highlights: ['First pilot'],
            status: 'published',
          },
          { startup_id: startupId, title: draftTitle, summary: 'Not ready.', status: 'draft' },
        ],
        { defaultToNull: false },
      );
      if (updates.error) throw updates.error;
      // V2.1 journey data: progress on two Validation requirements, stage evidence, a
      // stage-linked published update, and evidence on the draft (must stay hidden).
      const linked = await client
        .from('startup_updates')
        .update({ linked_stage: 'validation', progress_types: ['Customer Validation'] })
        .eq('startup_id', startupId)
        .select('id, status');
      if (linked.error) throw linked.error;
      const { data: reqs } = await client
        .from('startup_stage_requirements')
        .select('id, requirement_key')
        .eq('stage', 'validation');
      const reqId = (key) => reqs.find((r) => r.requirement_key === key).id;
      const r1 = await client
        .from('startup_stage_requirements')
        .update({ status: 'completed' })
        .eq('id', reqId('problem_validation'));
      const r2 = await client
        .from('startup_stage_requirements')
        .update({ status: 'in_progress', progress_value: 4 })
        .eq('id', reqId('customer_interviews'));
      if (r1.error || r2.error) throw r1.error ?? r2.error;
      const draftId = linked.data.find((u) => u.status === 'draft').id;
      const evidence = await client.from('stage_evidence').insert(
        [
          {
            startup_id: startupId,
            requirement_id: reqId('customer_interviews'),
            stage: 'validation',
            evidence_type: 'customer_feedback',
            label: stageEvidenceLabel,
            text_value: 'We would pay for this today.',
          },
          {
            startup_id: startupId,
            update_id: draftId,
            stage: 'validation',
            evidence_type: 'text_note',
            label: draftEvidenceLabel,
            text_value: 'Not ready.',
          },
        ],
        { defaultToNull: false },
      );
      if (evidence.error) throw evidence.error;
      await createConfirmedUser({
        email: admin.email,
        password: admin.password,
        fullName: `${TEMP_NAME_PREFIX} Journey Admin`,
      });
      await sql(`update public.profiles set role = 'admin' where email = '${admin.email}'`);
      adminClient = await signedInClient(admin.email, admin.password);
    },
  );

  section('Admin login and dashboard');
  await check('1. admin logs in at /admin/login', async () => {
    await login(adminPage, '/admin/login', admin, 'Sign In to Admin Dashboard');
    await adminPage.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    await adminPage.getByRole('heading', { name: 'innoWIUT Startup Dashboard' }).waitFor();
  });
  await check('2. dashboard stats match admin_dashboard_stats() in the database', async () => {
    const { data } = await adminClient.rpc('admin_dashboard_stats');
    const stats = data[0];
    const value = async (label) => {
      const card = adminPage
        .getByRole('region', { name: 'Ecosystem stats' })
        .locator('article', { has: adminPage.getByRole('heading', { name: label, exact: true }) });
      await card.locator('p.text-\\[28px\\]').waitFor();
      return Number((await card.locator('p.text-\\[28px\\]').innerText()).replace(/,/g, ''));
    };
    assert((await value('Active Startups')) === Number(stats.active_startups), 'active');
    assert((await value('Updates This Week')) === Number(stats.updates_this_week), 'updates');
    assert(
      (await value('Startups with Traction Growth')) === Number(stats.growing_startups),
      'growth',
    );
    assert((await value('Inactive Startups')) === Number(stats.inactive_startups), 'inactive');
    assert(
      Number(stats.active_startups) >= 1 &&
        Number(stats.growing_startups) >= 1 &&
        Number(stats.updates_this_week) >= 1,
      JSON.stringify(stats),
    );
    await adminPage.getByRole('button', { name: new RegExp(publishedTitle) }).waitFor();
    assert((await adminPage.getByText(draftTitle).count()) === 0, 'draft shown on dashboard');
    await shot(adminPage, '01-admin-dashboard');
  });

  await check('2b. stage distribution matches admin_stage_distribution()', async () => {
    const { data, error } = await adminClient.rpc('admin_stage_distribution');
    if (error) throw error;
    const list = adminPage.getByRole('list', { name: 'Startups per stage' });
    await list.waitFor();
    for (const [stage, name] of [
      ['idea', 'Idea'],
      ['validation', 'Validation'],
      ['mvp', 'MVP'],
      ['traction', 'Traction'],
    ]) {
      const count = Number(data.find((row) => row.stage === stage).startups);
      await list
        .getByRole('link', { name: `${name}: ${count} ${count === 1 ? 'startup' : 'startups'}` })
        .waitFor();
    }
    assert(Number(data.find((r) => r.stage === 'validation').startups) >= 1, 'validation count');
  });

  section('Startups list and detail');
  await check('3. admin finds the test startup with search', async () => {
    await adminPage.goto(`${BASE}/admin/startups`);
    await adminPage.getByLabel('Search').fill('admin journey');
    const row = adminPage
      .getByRole('table', { name: 'Startups' })
      .getByRole('row', { name: new RegExp(startupName) });
    await row.waitFor({ timeout: 15000 });
    await row.getByText('130').waitFor();
    await row.getByText('+30%').waitFor();
    await row.getByText('Active', { exact: true }).waitFor();
    await shot(adminPage, '02-admin-startups');
  });
  await check('4. admin opens the startup detail', async () => {
    await adminPage.getByRole('link', { name: new RegExp(startupName) }).click();
    await adminPage.getByRole('heading', { name: startupName }).waitFor();
    await adminPage.getByText('Validate pricing').waitFor();
    await adminPage.getByText('innowiut-temp-admin-journey-founder@example.com').first().waitFor();
  });
  await check('5. traction tab shows the real values, read-only', async () => {
    await adminPage.getByRole('tab', { name: 'Traction' }).click();
    await adminPage.getByText('$2,000').first().waitFor();
    await adminPage.getByText('+30%').first().waitFor();
    await adminPage
      .getByRole('table', { name: /Traction history/ })
      .getByText('Temporary entry')
      .waitFor();
    assert(
      (await adminPage.getByRole('button', { name: /Add Metric|Update Metrics/ }).count()) === 0,
      'traction is editable',
    );
    await shot(adminPage, '03-admin-traction');
  });
  await check('6. updates tab shows the published update but not the draft', async () => {
    await adminPage.getByRole('tab', { name: 'Updates' }).click();
    await adminPage.getByText(publishedTitle).waitFor();
    assert((await adminPage.getByText(draftTitle).count()) === 0, 'draft visible to admin');
  });

  await check(
    '6b. journey tab: stage, progress, requirements, evidence, linked updates — read-only',
    async () => {
      await adminPage.getByRole('tab', { name: 'Journey' }).click();
      const current = adminPage.getByRole('region', { name: /^02/ });
      await current.getByText('1 of 6 requirements completed').waitFor();
      await current.getByText('Complete 6 more customer interviews').waitFor();
      await adminPage.getByText(stageEvidenceLabel).waitFor();
      await adminPage.getByText(publishedTitle).waitFor();
      await adminPage.getByText('In Progress').first().waitFor();
      assert(
        (await adminPage.getByText(draftEvidenceLabel).count()) === 0,
        'draft evidence visible to admin',
      );
      assert((await adminPage.getByText(draftTitle).count()) === 0, 'draft visible to admin');
      assert(
        (await adminPage
          .getByRole('button', { name: /^(Update|Add Evidence|Select Metrics|Remove evidence)/ })
          .count()) === 0,
        'journey is editable by admin',
      );
      await adminPage.getByLabel('Investor Access — Locked').waitFor();
      await shot(adminPage, '03b-admin-journey');
    },
  );

  section('Mentors, assignment, notes');
  await check('7. admin creates a mentor with a photo', async () => {
    await adminPage.goto(`${BASE}/admin/mentors`);
    await adminPage.getByRole('button', { name: 'Create Mentor' }).first().click();
    const dialog = adminPage.getByRole('dialog', { name: 'Create mentor' });
    await dialog
      .getByLabel('Photo (optional)')
      .setInputFiles({ name: 'mentor.png', mimeType: 'image/png', buffer: PNG });
    await dialog.getByLabel(/Full name/).fill(mentorName);
    await dialog.getByLabel(/Expertise/).fill('Fundraising, Go-to-market');
    await dialog.getByLabel(/Email/).fill('mentor.admin-journey.innowiut-temp@example.com');
    await dialog.getByLabel(/Telegram/).fill('@innowiut_temp');
    await dialog.getByRole('button', { name: 'Create Mentor' }).click();
    await toast(adminPage, 'Mentor created.');
    const [row] = await sql(
      `select id, photo_path from public.mentors where name = '${mentorName}'`,
    );
    mentorId = row.id;
    assert(row.photo_path?.startsWith(`${row.id}/photo-`), `photo_path ${row.photo_path}`);
    await adminPage.getByRole('heading', { name: mentorName }).waitFor();
  });
  await check('8. admin assigns the mentor to the startup', async () => {
    await adminPage.goto(`${BASE}/admin/startups?q=admin+journey`);
    await adminPage
      .getByRole('link', { name: new RegExp(startupName) })
      .first()
      .click();
    await adminPage.getByRole('tab', { name: 'Mentor' }).click();
    await adminPage.getByText('No mentor assigned').waitFor();
    await adminPage.getByRole('button', { name: 'Assign mentor' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Assign mentor' });
    await dialog.getByLabel('Mentor').selectOption({ label: mentorName });
    await dialog.getByRole('button', { name: 'Assign mentor' }).click();
    await toast(adminPage, 'Mentor assigned');
    await adminPage.getByText(mentorName, { exact: true }).first().waitFor();
  });
  await check('9. admin adds a mentor note', async () => {
    await adminPage.getByLabel(new RegExp(`New note from ${mentorName}`)).fill(noteText);
    await adminPage.getByRole('button', { name: 'Add note' }).click();
    await toast(adminPage, 'Note added');
    await adminPage.getByText(noteText).waitFor();
    await adminPage.getByText(/Added by TEMP TEST Journey Admin/).waitFor();
    await shot(adminPage, '04-admin-mentor-tab');
  });

  section('Founder side and meeting request');
  await check('10. founder sees the mentor and the note', async () => {
    await login(founderPage, '/founder/login', founder, 'Sign In');
    await founderPage.waitForURL(/\/founder\/dashboard/, { timeout: 20000 });
    await founderPage.goto(`${BASE}/founder/mentor`);
    await founderPage.getByRole('heading', { name: mentorName }).waitFor();
    await founderPage.getByText(noteText).waitFor();
  });
  await check('11. founder submits a meeting request', async () => {
    await founderPage.getByRole('button', { name: 'Request Meeting' }).click();
    const dialog = founderPage.getByRole('dialog', { name: 'Request a meeting' });
    await dialog.getByLabel('Reason').selectOption('Fundraising');
    await dialog.getByLabel('Message').fill('Temporary admin journey request');
    await dialog.getByRole('button', { name: 'Request Meeting' }).click();
    await toast(founderPage, 'Meeting requested');
    await founderPage.getByText('Requested', { exact: true }).waitFor();
  });
  await check('12. admin confirms the request with a note', async () => {
    await adminPage.goto(`${BASE}/admin/meeting-requests?status=requested`);
    const row = adminPage
      .getByRole('table', { name: 'Meeting requests' })
      .getByRole('row', { name: new RegExp(startupName) });
    await row.waitFor({ timeout: 15000 });
    await shot(adminPage, '05-admin-meetings');
    await row.getByRole('button', { name: 'Manage' }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Manage meeting request' });
    await dialog.getByLabel(/Status/).selectOption('confirmed');
    await dialog.getByLabel(/Admin note/).fill('Tuesday 10:00 at the innoWIUT office');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await toast(adminPage, 'Meeting request updated');
  });
  await check('13. founder sees "Confirmed" and the admin note', async () => {
    await founderPage.reload();
    await founderPage.getByText('Confirmed', { exact: true }).waitFor();
    await founderPage.getByText('Tuesday 10:00 at the innoWIUT office').waitFor();
    await shot(founderPage, '06-founder-confirmed');
  });

  section('Route guards in the real app');
  await check('founder cannot open admin pages; admin cannot open founder pages', async () => {
    await founderPage.goto(`${BASE}/admin/meeting-requests`);
    await founderPage.waitForURL(/\/founder\/dashboard/, { timeout: 15000 });
    await adminPage.goto(`${BASE}/founder/traction`);
    await adminPage.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
  });
  await check('admin pages work at tablet and phone width', async () => {
    for (const width of [820, 390]) {
      await adminPage.setViewportSize({ width, height: 900 });
      for (const path of [
        '/admin/dashboard',
        '/admin/startups',
        '/admin/meeting-requests',
        '/admin/mentors',
      ]) {
        await adminPage.goto(`${BASE}${path}`);
        await adminPage.getByRole('heading', { level: 1 }).waitFor();
        await adminPage.waitForTimeout(400);
        const overflow = await adminPage.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        assert(overflow <= 1, `${path} at ${width}px overflows by ${overflow}px`);
      }
    }
    await shot(adminPage, '07-admin-mentors-phone');
  });
  await check('no uncaught errors in either browser', async () => {
    assert(pageErrors.length === 0, pageErrors.join(' | '));
  });
} finally {
  await browser.close();
  section('Cleanup');
  if (mentorId && adminClient) {
    const { data } = await adminClient.storage.from('mentor-photos').list(mentorId);
    const paths = (data ?? []).map((file) => `${mentorId}/${file.name}`);
    if (paths.length) await adminClient.storage.from('mentor-photos').remove(paths);
    console.log(`  removed ${paths.length} mentor photo(s)`);
  }
  execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname], {
    stdio: 'inherit',
    env: process.env,
  });
}

process.exit(summary() ? 0 : 1);
