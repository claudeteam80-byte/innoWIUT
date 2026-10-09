// UI reliability audit in a real browser against the REAL Supabase project.
//
//   npm run build && npx vite preview --port 4175 --strictPort &
//   npm run remote:ui-audit -- --screenshots=/tmp/ui-audit
//   BASE_URL=https://www.foundertrack.space npm run remote:ui-audit
//
// Seeds temporary accounts (an onboarded founder with traction, updates, a logo, a mentor,
// a note and a meeting request; a founder who has not onboarded; an admin; a superadmin),
// then visits every route for each role at desktop, laptop, tablet and phone widths and
// reports console errors, failed requests, broken images, horizontal overflow, loading
// states that never finish, unnamed buttons/links and internal links that lead nowhere.
// Run `npm run remote:cleanup` afterwards. Sends no email.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createConfirmedUser, signedInClient, sql, TEMP_NAME_PREFIX } from './lib.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4175';
const shots = process.argv.find((a) => a.startsWith('--screenshots='))?.split('=')[1];
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const stamp = Date.now();
const account = (key, name) => ({
  email: `innowiut-temp-audit-${key}@example.com`,
  password: `Audit-${stamp}-${key}-Pw`,
  name: `${TEMP_NAME_PREFIX} Audit ${name}`,
});
const founder = account('founder', 'Founder');
const fresh = account('fresh', 'New Founder');
const admin = account('admin', 'Admin');
const superadmin = account('superadmin', 'Superadmin');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true },
];

const browser = await chromium.launch();

async function pngOf(html, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<body style="margin:0">${html}</body>`);
  const buffer = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
  await page.close();
  return buffer;
}

async function seed() {
  for (const a of [founder, fresh, admin, superadmin]) {
    await createConfirmedUser({ email: a.email, password: a.password, fullName: a.name });
  }
  await sql(`update public.profiles set role = 'admin' where email = '${admin.email}'`);
  await sql(`update public.profiles set role = 'superadmin' where email = '${superadmin.email}'`);

  const f = await signedInClient(founder.email, founder.password);
  const onboard = await f.rpc('complete_onboarding', {
    payload: {
      full_name: founder.name,
      phone: '+998 90 000 00 00',
      role_in_startup: 'CEO',
      name: `${TEMP_NAME_PREFIX} Audit Startup With A Fairly Long Name`,
      tagline: 'Temporary startup used by the UI audit; removed automatically afterwards',
      industry: 'EdTech',
      stage: 'Early Traction',
      founded_year: 2024,
      team_size: 4,
      has_product: true,
      has_users: true,
      current_users: 1250,
      has_revenue: true,
      monthly_revenue: 12500000,
      revenue_currency: 'UZS',
      main_goal: 'Reach 5,000 weekly active learners',
      biggest_challenge: 'Distribution to schools outside Tashkent',
    },
  });
  if (onboard.error) throw onboard.error;
  const startupId = onboard.data;

  const logo = await pngOf(
    '<div style="width:256px;height:256px;background:#264f9d;color:#fff;font:700 120px Arial;display:grid;place-items:center">A</div>',
    256,
    256,
  );
  const logoPath = `${startupId}/logo-audit.png`;
  const up = await f.storage
    .from('startup-logos')
    .upload(logoPath, logo, { contentType: 'image/png' });
  if (up.error) throw up.error;
  await f.from('startups').update({ logo_path: logoPath }).eq('id', startupId);

  const { data: metrics } = await f
    .from('traction_metrics')
    .select('id, name')
    .eq('startup_id', startupId);
  const users = metrics.find((m) => m.name === 'Active Users');
  const revenue = metrics.find((m) => m.name !== 'Active Users');
  const rec = await f.rpc('record_traction', {
    p_entries: [
      { metric_id: users.id, value: 1480 },
      ...(revenue ? [{ metric_id: revenue.id, value: 14800000 }] : []),
    ],
    p_note: 'Audit entry',
  });
  if (rec.error) throw rec.error;

  const attachment = await pngOf(
    '<div style="width:800px;height:450px;background:linear-gradient(135deg,#264f9d,#17233b);color:#fff;font:600 48px Arial;display:grid;place-items:center">Pilot launch</div>',
    800,
    450,
  );
  const imagePath = `${startupId}/update-audit.png`;
  const upImage = await f.storage
    .from('update-attachments')
    .upload(imagePath, attachment, { contentType: 'image/png' });
  if (upImage.error) throw upImage.error;
  const updates = await f.from('startup_updates').insert(
    [
      {
        startup_id: startupId,
        title: `${TEMP_NAME_PREFIX} Pilot with three schools`,
        summary:
          'We ran a four-week pilot with three schools in Tashkent and onboarded 230 new learners.',
        highlights: ['3 schools signed', '230 new learners', 'Retention up to 61%'],
        challenge: 'Teachers need a simpler onboarding.',
        next_steps: 'Ship teacher onboarding and expand to Samarkand.',
        image_path: imagePath,
        link_url: 'https://example.com',
        status: 'published',
      },
      { startup_id: startupId, title: `${TEMP_NAME_PREFIX} Draft notes`, status: 'draft' },
    ],
    { defaultToNull: false },
  );
  if (updates.error) throw updates.error;
  await f.from('team_members').insert({
    startup_id: startupId,
    name: `${TEMP_NAME_PREFIX} Co-founder`,
    role: 'CTO',
  });

  const a = await signedInClient(admin.email, admin.password);
  const mentor = await a
    .from('mentors')
    .insert({
      name: `${TEMP_NAME_PREFIX} Audit Mentor`,
      title: 'Partner, Example Ventures',
      expertise: ['Growth', 'Fundraising', 'EdTech'],
      bio: 'Temporary mentor created by the UI audit.',
    })
    .select()
    .single();
  if (mentor.error) throw mentor.error;
  const photo = await pngOf(
    '<div style="width:200px;height:200px;background:#358a7c;color:#fff;font:700 90px Arial;display:grid;place-items:center">M</div>',
    200,
    200,
  );
  const photoPath = `${mentor.data.id}/photo-audit.png`;
  const upPhoto = await a.storage
    .from('mentor-photos')
    .upload(photoPath, photo, { contentType: 'image/png' });
  if (upPhoto.error) throw upPhoto.error;
  await a.from('mentors').update({ photo_path: photoPath }).eq('id', mentor.data.id);
  const assigned = await a.rpc('assign_mentor', {
    p_startup_id: startupId,
    p_mentor_id: mentor.data.id,
  });
  if (assigned.error) throw assigned.error;
  await a.from('mentor_notes').insert({
    startup_id: startupId,
    mentor_id: mentor.data.id,
    body: `${TEMP_NAME_PREFIX} Interview ten teachers before the next release.`,
  });
  const req = await f
    .from('meeting_requests')
    .insert({ startup_id: startupId, mentor_id: mentor.data.id, reason: 'Fundraising' });
  if (req.error) throw req.error;
  return startupId;
}

function routesFor(role, startupId) {
  if (role === 'public')
    return [
      '/',
      '/auth',
      '/founder/login',
      '/founder/signup',
      '/founder/verify-email?email=someone%40example.com',
      '/admin/login',
      '/forgot-password',
      '/forgot-password?portal=admin',
      '/reset-password',
      '/this-page-does-not-exist',
      '/founder/dashboard',
      '/admin/dashboard',
    ];
  if (role === 'fresh') return ['/founder/onboarding', '/founder/dashboard'];
  if (role === 'founder')
    return [
      '/founder/dashboard',
      '/founder/journey',
      '/founder/journey/traction',
      '/founder/traction',
      '/founder/updates',
      '/founder/mentor',
      '/founder/startup',
      '/founder/settings',
      '/founder/onboarding',
      '/admin/dashboard',
      '/founder/nope',
    ];
  const list = [
    '/admin/dashboard',
    '/admin/startups',
    `/admin/startups/${startupId}`,
    `/admin/startups/${startupId}?tab=journey`,
    '/admin/mentors',
    '/admin/meeting-requests',
    '/admin/settings',
    '/admin/access',
    '/founder/dashboard',
    `/admin/startups/00000000-0000-0000-0000-000000000000`,
  ];
  return list;
}

const LOGIN = {
  founder: ['/founder/login', founder, 'Sign In'],
  fresh: ['/founder/login', fresh, 'Sign In'],
  admin: ['/admin/login', admin, /Sign In to Admin/],
  superadmin: ['/admin/login', superadmin, /Sign In to Admin/],
};

const issues = [];
const report = (where, kind, detail) => issues.push({ where, kind, detail });

async function inspect(page, where) {
  const result = await page.evaluate(() => {
    const vw = window.innerWidth;
    const out = { overflow: [], images: [], unnamed: [], loading: 0, links: [], small: [] };
    if (document.documentElement.scrollWidth > vw + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > vw + 1) {
          let clipped = false;
          for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) {
              const pr = p.getBoundingClientRect();
              if (pr.right <= vw + 1) clipped = true;
              break;
            }
          }
          if (!clipped)
            out.overflow.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`,
            );
        }
      }
      out.overflow.unshift(`scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    }
    for (const img of document.images) {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src'))
        out.images.push(img.getAttribute('src').slice(0, 100));
    }
    for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const name =
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.getAttribute('aria-labelledby') ||
        el.textContent.trim() ||
        el.querySelector('img[alt]')?.getAttribute('alt');
      if (!name) out.unnamed.push(el.outerHTML.slice(0, 120));
      if (vw < 500 && (r.height < 32 || r.width < 32) && el.tagName === 'BUTTON')
        out.small.push(
          `${(name || '').slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
    }
    out.loading = document.querySelectorAll(
      '[aria-busy="true"], .animate-pulse, .animate-spin',
    ).length;
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (!href || href === '#' || href.startsWith('javascript:')) out.links.push(`DEAD ${href}`);
      else if (href.startsWith('/')) out.links.push(href);
    }
    return out;
  });
  if (result.overflow.length) report(where, 'overflow', result.overflow.slice(0, 6).join(' | '));
  if (result.images.length) report(where, 'broken image', result.images.join(', '));
  if (result.unnamed.length)
    report(where, 'unnamed control', result.unnamed.slice(0, 3).join(' | '));
  if (result.loading) report(where, 'still loading after 8s', `${result.loading} element(s)`);
  if (result.small.length) report(where, 'small tap target', result.small.slice(0, 6).join(', '));
  return result.links;
}

const linkSet = new Set();
let startupId = null;
try {
  startupId = await seed();
  console.log('seeded startup', startupId);
  const roles = ['public', 'founder', 'fresh', 'admin', 'superadmin'].filter(
    (r) => !only || only.split(',').includes(r),
  );
  for (const role of roles) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
      });
      const page = await context.newPage();
      let current = '';
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning')
          report(current, `console ${m.type()}`, m.text().slice(0, 200));
      });
      page.on('pageerror', (e) => report(current, 'page error', e.message.slice(0, 200)));
      page.on('response', (r) => {
        if (r.status() >= 400) report(current, `HTTP ${r.status()}`, r.url().slice(0, 140));
      });
      page.on('requestfailed', (r) => {
        const err = r.failure()?.errorText ?? '';
        if (!err.includes('ERR_ABORTED')) report(current, 'request failed', `${err} ${r.url()}`);
      });

      if (LOGIN[role]) {
        const [path, acct, button] = LOGIN[role];
        current = `${role}@${vp.name} login`;
        try {
          await page.goto(`${BASE}${path}`);
          await page.getByLabel(/email/i).fill(acct.email);
          await page.getByLabel(/^password/i).fill(acct.password);
          await page.getByRole('button', { name: button }).click();
          await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 });
        } catch (error) {
          // Record it and move on, so one failure does not hide the rest of the audit.
          const text = await page
            .locator('body')
            .innerText()
            .catch(() => '');
          report(
            current,
            'login failed',
            `${error.message.split('\n')[0]} — page: ${text.slice(0, 120)}`,
          );
          if (shots) {
            mkdirSync(shots, { recursive: true });
            await page.screenshot({ path: `${shots}/FAIL-${role}-${vp.name}-login.png` });
          }
          await context.close();
          continue;
        }
      }
      for (const route of routesFor(role, startupId)) {
        current = `${role}@${vp.name} ${route}`;
        await page.goto(`${BASE}${route}`);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(600);
        // Loading states should settle; give slow queries a fair chance first.
        for (let i = 0; i < 15; i += 1) {
          const busy = await page
            .locator('[aria-busy="true"], .animate-pulse, .animate-spin')
            .count();
          if (!busy) break;
          await page.waitForTimeout(500);
        }
        const finalPath = new URL(page.url()).pathname;
        if (finalPath !== route.split('?')[0]) current += ` → ${finalPath}`;
        const links = await inspect(page, current);
        for (const l of links) linkSet.add(l);
        if (shots) {
          mkdirSync(shots, { recursive: true });
          const file = `${role}-${vp.name}-${route.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}`;
          await page.screenshot({ path: `${shots}/${file}.png`, fullPage: true });
        }
        console.log(`  visited ${current}`);
      }
      await context.close();
    }
  }

  // Every internal link must resolve to a real page (not the 404 page).
  const check = await browser.newPage();
  for (const link of [...linkSet].filter((l) => !l.startsWith('DEAD'))) {
    if (link.includes('/admin/') || link.includes('/founder/')) continue; // covered above
    await check.goto(`${BASE}${link}`);
    if (await check.getByText(/page not found/i).count()) report(link, 'dead link', link);
  }
  for (const dead of [...linkSet].filter((l) => l.startsWith('DEAD')))
    report('-', 'dead link', dead);
} finally {
  await browser.close();
}

const grouped = new Map();
for (const i of issues) {
  const key = `${i.kind} :: ${i.detail}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(i.where);
}
console.log(`\n${issues.length} issue(s), ${grouped.size} distinct:`);
for (const [key, wheres] of grouped) {
  console.log(
    `\n- ${key}\n    ${wheres.slice(0, 5).join('\n    ')}${wheres.length > 5 ? `\n    …+${wheres.length - 5}` : ''}`,
  );
}
console.log('\ninternal links seen:', [...linkSet].sort().join(' '));
process.exit(0);
