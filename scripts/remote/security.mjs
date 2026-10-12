// RLS, storage and database-function validation against the REAL project, using
// temporary Founder A / Founder B / admin accounts. Leaves the accounts in place
// (credentials in .remote-validation-state.json) for UI checks; run cleanup.mjs after.
import { writeFileSync } from 'node:fs';
import {
  assert,
  assertDenied,
  check,
  completeReadiness,
  createConfirmedUser,
  loadEnv,
  newClient,
  section,
  signedInClient,
  sql,
  summary,
  TEMP_NAME_PREFIX,
  tempPassword,
} from './lib.mjs';

const STATE_FILE = new URL('../../.remote-validation-state.security.json', import.meta.url);
const { url } = loadEnv();
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);
const png = () => new Blob([PNG], { type: 'image/png' });

const accounts = {
  a: { email: 'innowiut-temp-founder-a@example.com', name: `${TEMP_NAME_PREFIX} Founder A` },
  b: { email: 'innowiut-temp-founder-b@example.com', name: `${TEMP_NAME_PREFIX} Founder B` },
  admin: { email: 'innowiut-temp-admin@example.com', name: `${TEMP_NAME_PREFIX} Admin` },
};

section('Setup (temporary accounts)');
for (const account of Object.values(accounts)) {
  account.password = tempPassword();
  account.id = await createConfirmedUser({
    email: account.email,
    password: account.password,
    fullName: account.name,
  });
}
writeFileSync(STATE_FILE, JSON.stringify(accounts));
await check(
  'new accounts are founders; temporary admin promoted by staff SQL procedure',
  async () => {
    const rows = await sql(
      `select email, role from public.profiles where email like '%innowiut-temp-%@example.com' order by email`,
    );
    assert(rows.length === 3 && rows.every((r) => r.role === 'founder'), JSON.stringify(rows));
    await sql(`update public.profiles set role = 'admin' where email = '${accounts.admin.email}'`);
  },
);

const anon = newClient();
const a = await signedInClient(accounts.a.email, accounts.a.password);
const b = await signedInClient(accounts.b.email, accounts.b.password);
const admin = await signedInClient(accounts.admin.email, accounts.admin.password);

section('Signed-out visitor');
for (const table of [
  'profiles',
  'startups',
  'mentors',
  'startup_updates',
  'traction_metrics',
  'meeting_requests',
  'mentor_notes',
]) {
  await check(`anon cannot read ${table}`, async () => {
    assertDenied(await anon.from(table).select('*').limit(1), `anon read ${table}`);
  });
}
await check('anon cannot read startup_activity view', async () => {
  assertDenied(await anon.from('startup_activity').select('*').limit(1), 'anon read view');
});
await check('anon cannot call activity_status()', async () => {
  assertDenied(await anon.rpc('activity_status', { days_since_activity: 1 }), 'anon rpc');
});

section('Profiles and roles');
await check('founder sees only their own profile', async () => {
  const { data, error } = await a.from('profiles').select('email');
  if (error) throw error;
  assert(data.length === 1 && data[0].email === accounts.a.email, JSON.stringify(data));
});
await check('founder cannot change own role', async () => {
  assertDenied(
    await a.from('profiles').update({ role: 'admin' }).eq('id', accounts.a.id),
    'role update',
  );
});
await check('founder can update own name; cannot update another profile', async () => {
  const own = await a
    .from('profiles')
    .update({ full_name: `${TEMP_NAME_PREFIX} Founder A2` })
    .eq('id', accounts.a.id)
    .select();
  assert(!own.error && own.data.length === 1, 'own update failed');
  const other = await a
    .from('profiles')
    .update({ full_name: 'hijack' })
    .eq('id', accounts.b.id)
    .select();
  assert(!other.error && other.data.length === 0, 'updated another profile');
});

section('Startups (Founder A vs Founder B)');
let startupA;
let startupB;
await check('each founder creates exactly one startup (owner set by server)', async () => {
  const ra = await a
    .from('startups')
    .insert({ name: `${TEMP_NAME_PREFIX} Alpha`, industry: 'EdTech', stage: 'MVP' })
    .select()
    .single();
  const rb = await b
    .from('startups')
    .insert({ name: `${TEMP_NAME_PREFIX} Beta` })
    .select()
    .single();
  if (ra.error || rb.error) throw ra.error ?? rb.error;
  startupA = ra.data;
  startupB = rb.data;
  assert(startupA.owner_id === accounts.a.id, 'owner mismatch');
  assertDenied(
    await a.from('startups').insert({ name: `${TEMP_NAME_PREFIX} Second` }),
    'second startup',
  );
});
await check('founder cannot mark onboarding complete themselves', async () => {
  assertDenied(
    await a
      .from('startups')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', startupA.id),
    'onboarding flag',
  );
});
await check('Founder B cannot read Founder A startup', async () => {
  const { data } = await b.from('startups').select('id');
  assert(data.length === 1 && data[0].id === startupB.id, JSON.stringify(data));
  const direct = await b.from('startups').select('*').eq('id', startupA.id);
  assert(direct.data.length === 0, 'B read A by id');
});
await check('Founder B cannot update Founder A startup', async () => {
  const res = await b.from('startups').update({ name: 'hijack' }).eq('id', startupA.id).select();
  assert(res.data?.length === 0, 'B updated A');
});
await check('Founder B cannot add team members to Founder A startup', async () => {
  assertDenied(
    await b
      .from('team_members')
      .insert({ startup_id: startupA.id, name: `${TEMP_NAME_PREFIX} Intruder` }),
    'team insert',
  );
  const own = await a
    .from('team_members')
    .insert({ startup_id: startupA.id, name: `${TEMP_NAME_PREFIX} Teammate` });
  assert(!own.error, own.error?.message);
});

section('Traction');
let usersMetric;
await check(
  'founder creates USD/UZS/number metrics; currency metric requires a currency',
  async () => {
    const res = await a
      .from('traction_metrics')
      .insert(
        [
          { startup_id: startupA.id, name: 'MRR', unit: 'currency', currency: 'UZS' },
          { startup_id: startupA.id, name: 'Revenue', unit: 'currency', currency: 'USD' },
          { startup_id: startupA.id, name: 'Users' },
        ],
        // Without this, rows missing a key send NULL instead of the column default.
        { defaultToNull: false },
      )
      .select();
    if (res.error) throw res.error;
    usersMetric = res.data.find((m) => m.name === 'Users');
    assertDenied(
      await a
        .from('traction_metrics')
        .insert({ startup_id: startupA.id, name: 'Bad', unit: 'currency' }),
      'currency missing',
    );
  },
);
await check('recording entries derives current/previous values on the server', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const earlier = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const r1 = await a
    .from('traction_entries')
    .insert({ metric_id: usersMetric.id, value: 100, recorded_on: earlier });
  const r2 = await a
    .from('traction_entries')
    .insert({ metric_id: usersMetric.id, value: 150, recorded_on: today });
  if (r1.error || r2.error) throw r1.error ?? r2.error;
  const { data } = await a
    .from('traction_metrics')
    .select('current_value, previous_value, last_recorded_on')
    .eq('id', usersMetric.id)
    .single();
  assert(
    Number(data.current_value) === 150 &&
      Number(data.previous_value) === 100 &&
      data.last_recorded_on === today,
    JSON.stringify(data),
  );
});
await check('founder cannot write derived values or edit history', async () => {
  assertDenied(
    await a.from('traction_metrics').update({ current_value: 999999 }).eq('id', usersMetric.id),
    'derived write',
  );
  assertDenied(
    await a.from('traction_entries').update({ value: 1 }).eq('metric_id', usersMetric.id),
    'entry update',
  );
});
await check('Founder B cannot see or record Founder A traction', async () => {
  const seen = await b.from('traction_metrics').select('id');
  assert(seen.data.length === 0, 'B sees metrics');
  assertDenied(
    await b.from('traction_entries').insert({ metric_id: usersMetric.id, value: 5 }),
    'B entry',
  );
});

section('Updates: draft visibility');
await check('founder publishes one update and keeps one draft', async () => {
  const res = await a
    .from('startup_updates')
    .insert([
      { startup_id: startupA.id, title: `${TEMP_NAME_PREFIX} Draft`, status: 'draft' },
      { startup_id: startupA.id, title: `${TEMP_NAME_PREFIX} Published`, status: 'published' },
    ])
    .select();
  if (res.error) throw res.error;
  const published = res.data.find((u) => u.status === 'published');
  assert(published.published_at, 'published_at not set');
  const own = await a.from('startup_updates').select('id');
  assert(own.data.length === 2, 'founder should see both');
});
await check('admin sees the published update but not the draft', async () => {
  const { data, error } = await admin
    .from('startup_updates')
    .select('title, status')
    .eq('startup_id', startupA.id);
  if (error) throw error;
  assert(data.length === 1 && data[0].status === 'published', JSON.stringify(data));
});
await check('Founder B sees no updates from Founder A', async () => {
  const { data } = await b.from('startup_updates').select('id');
  assert(data.length === 0, 'B sees updates');
});
await check('founder can delete a draft but not a published update', async () => {
  const del = await a.from('startup_updates').delete().eq('startup_id', startupA.id).select();
  assert(del.data.length === 1 && del.data[0].status === 'draft', JSON.stringify(del.data));
});

section('Admin permissions');
let mentor;
await check('admin reads every startup, profile, metric and entry', async () => {
  const s = await admin.from('startups').select('id').in('id', [startupA.id, startupB.id]);
  const p = await admin
    .from('profiles')
    .select('id')
    .in('id', [accounts.a.id, accounts.b.id, accounts.admin.id]);
  const m = await admin.from('traction_metrics').select('id').eq('startup_id', startupA.id);
  const e = await admin.from('traction_entries').select('id').eq('startup_id', startupA.id);
  const t = await admin.from('team_members').select('id').eq('startup_id', startupA.id);
  assert(
    s.data.length === 2 &&
      p.data.length === 3 &&
      m.data.length === 3 &&
      e.data.length === 2 &&
      t.data.length === 1,
    `startups ${s.data.length} profiles ${p.data.length} metrics ${m.data.length} entries ${e.data.length} team ${t.data.length}`,
  );
});
await check('admin cannot create a startup or write founder traction', async () => {
  assertDenied(
    await admin.from('startups').insert({ name: `${TEMP_NAME_PREFIX} Admin startup` }),
    'admin startup',
  );
  assertDenied(
    await admin.from('traction_entries').insert({ metric_id: usersMetric.id, value: 1 }),
    'admin entry',
  );
});
await check('founder cannot create mentors (admin data)', async () => {
  assertDenied(
    await a.from('mentors').insert({ name: `${TEMP_NAME_PREFIX} Self mentor` }),
    'founder mentor',
  );
});
await check('admin creates a mentor, assigns it to Founder A and writes a note', async () => {
  const m = await admin
    .from('mentors')
    .insert({ name: `${TEMP_NAME_PREFIX} Mentor`, expertise: ['Growth'] })
    .select()
    .single();
  if (m.error) throw m.error;
  mentor = m.data;
  const asg = await admin
    .from('mentor_assignments')
    .insert({ startup_id: startupA.id, mentor_id: mentor.id });
  if (asg.error) throw asg.error;
  assertDenied(
    await admin
      .from('mentor_assignments')
      .insert({ startup_id: startupA.id, mentor_id: mentor.id }),
    'second active assignment',
  );
  const note = await admin.from('mentor_notes').insert({
    startup_id: startupA.id,
    mentor_id: mentor.id,
    body: `${TEMP_NAME_PREFIX} focus on retention`,
  });
  if (note.error) throw note.error;
});
await check('Founder A sees the assigned mentor and note; Founder B sees neither', async () => {
  const am = await a.from('mentors').select('id');
  const an = await a.from('mentor_notes').select('id');
  const bm = await b.from('mentors').select('id');
  const bn = await b.from('mentor_notes').select('id');
  assert(
    am.data.length === 1 && an.data.length === 1 && bm.data.length === 0 && bn.data.length === 0,
    `A mentors ${am.data.length} notes ${an.data.length}; B mentors ${bm.data.length} notes ${bn.data.length}`,
  );
  assertDenied(
    await a.from('mentor_notes').insert({ startup_id: startupA.id, body: 'self note' }),
    'founder note',
  );
});
await check('meeting requests: founder requests, cannot confirm; admin confirms', async () => {
  const req = await a
    .from('meeting_requests')
    .insert({ startup_id: startupA.id, mentor_id: mentor.id, reason: 'Growth' })
    .select()
    .single();
  if (req.error) throw req.error;
  assertDenied(
    await b.from('meeting_requests').insert({ startup_id: startupA.id, reason: 'Growth' }),
    'B request for A',
  );
  const self = await a
    .from('meeting_requests')
    .update({ status: 'confirmed' })
    .eq('id', req.data.id)
    .select();
  assert(self.data.length === 0, 'founder confirmed own request');
  const conf = await admin
    .from('meeting_requests')
    .update({ status: 'confirmed', admin_response: 'Tuesday 10:00' })
    .eq('id', req.data.id)
    .select();
  assert(conf.data?.[0]?.status === 'confirmed', JSON.stringify(conf));
});

section('Admin functions');
await check('founders and visitors cannot call admin functions', async () => {
  assertDenied(await a.rpc('admin_dashboard_stats'), 'founder stats');
  assertDenied(await a.rpc('admin_startup_list', {}), 'founder list');
  assertDenied(
    await a.rpc('assign_mentor', { p_startup_id: startupA.id, p_mentor_id: mentor.id }),
    'founder assign',
  );
  assertDenied(await a.rpc('end_mentor_assignment', { p_startup_id: startupA.id }), 'founder end');
  assertDenied(await a.rpc('delete_mentor', { p_mentor_id: mentor.id }), 'founder delete mentor');
  assertDenied(await anon.rpc('admin_dashboard_stats'), 'anon stats');
});
await check('admin reads server-side stats and the startup list', async () => {
  const stats = await admin.rpc('admin_dashboard_stats');
  if (stats.error) throw stats.error;
  assert(stats.data.length === 1 && 'active_startups' in stats.data[0], JSON.stringify(stats.data));
  const list = await admin.rpc('admin_startup_list', { p_sort: 'newest', p_limit: 5 });
  if (list.error) throw list.error;
  assert(Array.isArray(list.data), 'list not an array');
});
await check(
  'assign_mentor switches mentors and keeps history; deletion is blocked while assigned',
  async () => {
    const second = await admin
      .from('mentors')
      .insert({ name: `${TEMP_NAME_PREFIX} Second Mentor`, expertise: ['Product'] })
      .select()
      .single();
    if (second.error) throw second.error;
    const switched = await admin.rpc('assign_mentor', {
      p_startup_id: startupA.id,
      p_mentor_id: second.data.id,
    });
    if (switched.error) throw switched.error;
    const rows = await admin
      .from('mentor_assignments')
      .select('mentor_id, ended_at')
      .eq('startup_id', startupA.id);
    const active = rows.data.filter((r) => r.ended_at === null);
    assert(
      rows.data.length === 2 && active.length === 1 && active[0].mentor_id === second.data.id,
      JSON.stringify(rows.data),
    );
    assertDenied(
      await admin.rpc('delete_mentor', { p_mentor_id: second.data.id }),
      'deleted an assigned mentor',
    );
    const back = await admin.rpc('assign_mentor', {
      p_startup_id: startupA.id,
      p_mentor_id: mentor.id,
    });
    if (back.error) throw back.error;
    const archived = await admin.rpc('delete_mentor', { p_mentor_id: second.data.id });
    assert(archived.data === 'archived', `delete_mentor returned ${archived.data}`);
  },
);

section('Admin access management');
const owner = {
  email: 'innowiut-temp-superadmin@example.com',
  name: `${TEMP_NAME_PREFIX} Superadmin`,
  password: tempPassword(),
};
const candidate = {
  email: 'innowiut-temp-candidate@example.com',
  name: `${TEMP_NAME_PREFIX} Candidate`,
  password: tempPassword(),
};
owner.id = await createConfirmedUser({
  email: owner.email,
  password: owner.password,
  fullName: owner.name,
});
candidate.id = await createConfirmedUser({
  email: candidate.email,
  password: candidate.password,
  fullName: candidate.name,
});
await sql(`update public.profiles set role = 'superadmin' where id = '${owner.id}'`);
const superadmin = await signedInClient(owner.email, owner.password);

await check('founders, admins and visitors cannot manage admin access', async () => {
  assertDenied(await a.rpc('grant_admin_access', { p_email: candidate.email }), 'founder grant');
  assertDenied(await admin.rpc('grant_admin_access', { p_email: candidate.email }), 'admin grant');
  assertDenied(await admin.rpc('revoke_admin_access', { p_user_id: owner.id }), 'admin revoke');
  assertDenied(
    await admin.rpc('promote_to_superadmin', {
      p_user_id: accounts.admin.id,
      p_confirm_email: accounts.admin.email,
    }),
    'admin self-promotion',
  );
  assertDenied(await admin.rpc('admin_access_list'), 'admin list');
  assertDenied(await anon.rpc('grant_admin_access', { p_email: candidate.email }), 'anon grant');
});
await check('admins and founders cannot write roles directly', async () => {
  assertDenied(
    await admin.from('profiles').update({ role: 'superadmin' }).eq('id', accounts.admin.id),
    'admin role write',
  );
  assertDenied(
    await a.from('profiles').update({ role: 'admin' }).eq('id', accounts.a.id),
    'founder role write',
  );
});
await check('only superadmins can read the role audit log', async () => {
  const forAdmin = await admin.from('admin_role_events').select('id');
  const forFounder = await a.from('admin_role_events').select('id');
  assert(
    !forAdmin.error &&
      forAdmin.data.length === 0 &&
      !forFounder.error &&
      forFounder.data.length === 0,
    'audit log visible',
  );
  assertDenied(
    await superadmin
      .from('admin_role_events')
      .insert({ target_email: 'x', previous_role: 'founder', new_role: 'admin' }),
    'audit insert',
  );
});
await check('superadmin grants admin; the new admin can sign in and use admin data', async () => {
  const granted = await superadmin.rpc('grant_admin_access', {
    p_email: candidate.email.toUpperCase(),
  });
  if (granted.error) throw granted.error;
  const promoted = await signedInClient(candidate.email, candidate.password);
  const stats = await promoted.rpc('admin_dashboard_stats');
  assert(!stats.error && stats.data.length === 1, 'promoted admin cannot read stats');
  candidate.client = promoted;
});
await check('superadmin revokes admin; admin data is refused immediately', async () => {
  const revoked = await superadmin.rpc('revoke_admin_access', { p_user_id: candidate.id });
  if (revoked.error) throw revoked.error;
  assertDenied(
    await candidate.client.rpc('admin_dashboard_stats'),
    'revoked admin still reads stats',
  );
  const startups = await candidate.client.from('startups').select('id');
  assert(!startups.error && startups.data.length === 0, 'revoked admin still reads startups');
});
await check('every role change is audited with who made it', async () => {
  const { data, error } = await superadmin
    .from('admin_role_events')
    .select('previous_role, new_role, changed_by')
    .eq('target_user_id', candidate.id)
    .order('created_at');
  if (error) throw error;
  assert(
    data.map((e) => `${e.previous_role}>${e.new_role}`).join(',') ===
      'founder>admin,admin>founder' && data.every((e) => e.changed_by === owner.id),
    JSON.stringify(data),
  );
});
await check(
  'promotion needs the typed email; self-removal needs explicit confirmation',
  async () => {
    assertDenied(
      await superadmin.rpc('promote_to_superadmin', {
        p_user_id: accounts.admin.id,
        p_confirm_email: 'wrong@example.com',
      }),
      'promotion without typed email',
    );
    assertDenied(
      await superadmin.rpc('revoke_admin_access', { p_user_id: owner.id }),
      'self-removal without confirmation',
    );
  },
);
await check('the final superadmin cannot be demoted or deleted', async () => {
  const [{ n }] = await sql(
    `select count(*)::int as n from public.profiles where role = 'superadmin'`,
  );
  if (n === 1) {
    assertDenied(
      await superadmin.rpc('revoke_admin_access', { p_user_id: owner.id, p_confirm_self: true }),
      'last superadmin removed themselves',
    );
  }
  // Demote every superadmin in one statement inside a rolled-back transaction: the guard must refuse.
  let refused = false;
  try {
    await sql(
      `begin; update public.profiles set role = 'admin' where role = 'superadmin'; rollback;`,
    );
  } catch (error) {
    refused = /at least one superadmin/.test(error.message);
  }
  assert(refused, 'demoting every superadmin was not refused');
  let deleteRefused = false;
  try {
    await sql(
      `begin; delete from auth.users where id in (select id from public.profiles where role = 'superadmin'); rollback;`,
    );
  } catch (error) {
    deleteRefused = /at least one superadmin/.test(error.message);
  }
  assert(deleteRefused, 'deleting every superadmin was not refused');
});

section('Database functions and views');
await check(
  'activity_status() boundaries: 0–7 active, 8–14 needs_update, 15+ inactive, null inactive',
  async () => {
    const cases = [
      [0, 'active'],
      [7, 'active'],
      [8, 'needs_update'],
      [14, 'needs_update'],
      [15, 'inactive'],
      [90, 'inactive'],
      [null, 'inactive'],
    ];
    for (const [days, expected] of cases) {
      const { data, error } = await a.rpc('activity_status', { days_since_activity: days });
      if (error) throw error;
      assert(data === expected, `${days} → ${data}, expected ${expected}`);
    }
  },
);
await check('startup_activity: founder sees own row (active today), admin sees both', async () => {
  const own = await a.from('startup_activity').select('*');
  assert(own.data.length === 1 && own.data[0].startup_id === startupA.id, JSON.stringify(own.data));
  assert(
    own.data[0].activity_status === 'active' && own.data[0].days_since_activity === 0,
    JSON.stringify(own.data[0]),
  );
  const all = await admin
    .from('startup_activity')
    .select('startup_id')
    .in('startup_id', [startupA.id, startupB.id]);
  assert(all.data.length === 2, 'admin view rows');
});
await check('internal helper functions are not callable through the API', async () => {
  assertDenied(await a.rpc('is_admin'), 'is_admin exposed');
  assertDenied(
    await a.rpc('owns_startup', { target_startup_id: startupA.id }),
    'owns_startup exposed',
  );
});

section('Storage');
const logoPath = `${startupA.id}/logo.png`;
const attachmentPath = `${startupA.id}/update.png`;
const mentorPhotoPath = () => `${mentor.id}/photo.png`;
await check('startup-logos: founder uploads to own folder; public URL serves it', async () => {
  const up = await a.storage
    .from('startup-logos')
    .upload(logoPath, png(), { contentType: 'image/png' });
  if (up.error) throw up.error;
  const res = await fetch(`${url}/storage/v1/object/public/startup-logos/${logoPath}`);
  assert(res.status === 200, `public fetch ${res.status}`);
});
await check(
  'startup-logos: founder cannot upload into another startup folder or a non-uuid folder',
  async () => {
    assertDenied(
      await a.storage
        .from('startup-logos')
        .upload(`${startupB.id}/logo.png`, png(), { contentType: 'image/png' }),
      'other folder',
    );
    assertDenied(
      await a.storage
        .from('startup-logos')
        .upload('not-a-uuid/logo.png', png(), { contentType: 'image/png' }),
      'bad folder',
    );
  },
);
await check('startup-logos: non-image types are rejected', async () => {
  assertDenied(
    await a.storage
      .from('startup-logos')
      .upload(`${startupA.id}/note.txt`, new Blob(['x'], { type: 'text/plain' }), {
        contentType: 'text/plain',
      }),
    'text upload',
  );
});
await check('startup-logos: Founder B cannot overwrite or delete Founder A logo', async () => {
  assertDenied(
    await b.storage
      .from('startup-logos')
      .upload(logoPath, png(), { contentType: 'image/png', upsert: true }),
    'overwrite',
  );
  const del = await b.storage.from('startup-logos').remove([logoPath]);
  assert(!del.error && del.data.length === 0, `B delete removed ${JSON.stringify(del.data)}`);
});
await check('update-attachments: founder uploads; bucket is not publicly readable', async () => {
  const up = await a.storage
    .from('update-attachments')
    .upload(attachmentPath, png(), { contentType: 'image/png' });
  if (up.error) throw up.error;
  const res = await fetch(`${url}/storage/v1/object/public/update-attachments/${attachmentPath}`);
  assert(res.status >= 400, `public fetch returned ${res.status}`);
});
await check(
  'update-attachments: Founder B cannot read or list; admin can read via signed URL',
  async () => {
    assertDenied(await b.storage.from('update-attachments').download(attachmentPath), 'B download');
    assertDenied(
      await b.storage.from('update-attachments').createSignedUrl(attachmentPath, 60),
      'B signed url',
    );
    const list = await b.storage.from('update-attachments').list(startupA.id);
    assert(!list.data?.length, 'B listed files');
    const signed = await admin.storage
      .from('update-attachments')
      .createSignedUrl(attachmentPath, 60);
    if (signed.error) throw signed.error;
    const res = await fetch(signed.data.signedUrl);
    assert(res.status === 200, `signed fetch ${res.status}`);
  },
);
await check(
  'mentor-photos: founder cannot upload; admin uploads; public URL serves it',
  async () => {
    assertDenied(
      await a.storage
        .from('mentor-photos')
        .upload(mentorPhotoPath(), png(), { contentType: 'image/png' }),
      'founder photo',
    );
    const up = await admin.storage
      .from('mentor-photos')
      .upload(mentorPhotoPath(), png(), { contentType: 'image/png' });
    if (up.error) throw up.error;
    const res = await fetch(`${url}/storage/v1/object/public/mentor-photos/${mentorPhotoPath()}`);
    assert(res.status === 200, `public fetch ${res.status}`);
  },
);
section('Startup Journey (V2.1)');
const PDF = new TextEncoder().encode('%PDF-1.4\n%innowiut-temp evidence\n%%EOF\n');
let evidencePdfPath;
await check('journey stage is derived on the server and requirements are initialised', async () => {
  const { data, error } = await a
    .from('startups')
    .select('stage, journey_stage')
    .eq('id', startupA.id)
    .single();
  if (error) throw error;
  assert(data.stage === 'MVP' && data.journey_stage === 'mvp', JSON.stringify(data));
  const reqs = await a.from('startup_stage_requirements').select('stage');
  if (reqs.error) throw reqs.error;
  const byStage = Object.groupBy(reqs.data, (r) => r.stage);
  assert(
    byStage.idea?.length === 5 && byStage.validation?.length === 6 && byStage.mvp?.length === 6,
    JSON.stringify(Object.fromEntries(Object.entries(byStage).map(([k, v]) => [k, v.length]))),
  );
});
await check('anon cannot read journey tables or the stage distribution', async () => {
  assertDenied(await anon.from('startup_stage_requirements').select('*').limit(1), 'anon reqs');
  assertDenied(await anon.from('stage_evidence').select('*').limit(1), 'anon evidence');
  assertDenied(await anon.rpc('admin_stage_distribution'), 'anon distribution');
});
await check('founder cannot write journey_stage or move their stage', async () => {
  assertDenied(
    await a.from('startups').update({ journey_stage: 'traction' }).eq('id', startupA.id),
    'journey_stage write',
  );
});
await check('completing every MVP requirement does not advance the stage', async () => {
  const res = await a
    .from('startup_stage_requirements')
    .update({ status: 'completed' })
    .eq('startup_id', startupA.id)
    .eq('stage', 'mvp')
    .select('completed_at');
  if (res.error) throw res.error;
  assert(res.data.length === 6 && res.data.every((r) => r.completed_at), 'not all completed');
  const { data } = await a.from('startups').select('journey_stage').eq('id', startupA.id).single();
  assert(data.journey_stage === 'mvp', `stage moved to ${data.journey_stage}`);
});
await check('locked stages cannot hold requirements or evidence', async () => {
  assertDenied(
    await a.from('startup_stage_requirements').insert({
      startup_id: startupA.id,
      stage: 'investor_readiness',
      requirement_key: 'pitch_deck',
      title: 'Pitch Deck',
    }),
    'locked requirement',
  );
  assertDenied(
    await a.from('stage_evidence').insert({
      startup_id: startupA.id,
      stage: 'investor_access',
      evidence_type: 'link',
      label: 'x',
      url: 'https://example.com',
    }),
    'locked evidence',
  );
});
await check('traction requirement links an existing metric without copying values', async () => {
  const before = await sql(
    `select count(*)::int n from public.traction_entries where startup_id = '${startupA.id}'`,
  );
  const res = await a.from('startup_stage_requirements').insert({
    startup_id: startupA.id,
    stage: 'traction',
    requirement_key: 'active_users',
    title: 'Active Users',
    linked_metric_id: usersMetric.id,
  });
  if (res.error) throw res.error;
  const after = await sql(
    `select count(*)::int n from public.traction_entries where startup_id = '${startupA.id}'`,
  );
  assert(before[0].n === after[0].n, 'traction entries changed');
  assertDenied(
    await b.from('startup_stage_requirements').insert({
      startup_id: startupB.id,
      stage: 'traction',
      requirement_key: 'active_users',
      title: 'Active Users',
      linked_metric_id: usersMetric.id,
    }),
    'B links A metric',
  );
});
await check('founder adds evidence (link, PDF document, metric) to own startup only', async () => {
  evidencePdfPath = `${startupA.id}/evidence-${crypto.randomUUID()}.pdf`;
  const up = await a.storage
    .from('update-attachments')
    .upload(evidencePdfPath, new Blob([PDF], { type: 'application/pdf' }), {
      contentType: 'application/pdf',
    });
  if (up.error) throw up.error;
  const res = await a.from('stage_evidence').insert(
    [
      {
        startup_id: startupA.id,
        stage: 'mvp',
        evidence_type: 'product_url',
        label: `${TEMP_NAME_PREFIX} product`,
        url: 'https://example.com/app',
      },
      {
        startup_id: startupA.id,
        stage: 'mvp',
        evidence_type: 'document',
        label: `${TEMP_NAME_PREFIX} test notes`,
        file_path: evidencePdfPath,
      },
      {
        startup_id: startupA.id,
        stage: 'traction',
        evidence_type: 'metric',
        label: 'Users',
        linked_metric_id: usersMetric.id,
      },
    ],
    { defaultToNull: false },
  );
  if (res.error) throw res.error;
  assertDenied(
    await b.from('stage_evidence').insert({
      startup_id: startupA.id,
      stage: 'mvp',
      evidence_type: 'link',
      label: 'x',
      url: 'https://example.com',
    }),
    'B evidence on A',
  );
  assertDenied(
    await a.from('stage_evidence').insert({
      startup_id: startupA.id,
      stage: 'mvp',
      evidence_type: 'screenshot',
      label: 'x',
      file_path: `${startupB.id}/x.png`,
    }),
    'file outside own folder',
  );
});
await check('Founder B sees none of Founder A journey data and cannot change it', async () => {
  const reqs = await b.from('startup_stage_requirements').select('startup_id');
  assert(
    reqs.data.every((r) => r.startup_id === startupB.id),
    'B sees A requirements',
  );
  const ev = await b.from('stage_evidence').select('id');
  assert(ev.data.length === 0, 'B sees evidence');
  const upd = await b
    .from('startup_stage_requirements')
    .update({ status: 'not_started' })
    .eq('startup_id', startupA.id)
    .select();
  assert(upd.data.length === 0, 'B updated A requirements');
  const del = await b.from('stage_evidence').delete().eq('startup_id', startupA.id).select();
  assert(del.data.length === 0, 'B deleted A evidence');
  const file = await b.storage.from('update-attachments').download(evidencePdfPath);
  assert(file.error, 'B downloaded A evidence file');
});
await check('structured update: draft evidence is hidden from admins until published', async () => {
  const draft = await a
    .from('startup_updates')
    .insert({
      startup_id: startupA.id,
      title: `${TEMP_NAME_PREFIX} Structured`,
      summary: 'Tested with 20 users',
      status: 'draft',
      progress_types: ['Product', 'Traction'],
      blocker: 'Hiring',
      next_milestone: 'Reach 1,000 users',
      next_milestone_date: '2026-12-01',
      linked_stage: 'mvp',
    })
    .select()
    .single();
  if (draft.error) throw draft.error;
  const ev = await a.from('stage_evidence').insert({
    startup_id: startupA.id,
    update_id: draft.data.id,
    stage: 'mvp',
    evidence_type: 'metric',
    label: 'Users',
    linked_metric_id: usersMetric.id,
  });
  if (ev.error) throw ev.error;
  const hidden = await admin.from('stage_evidence').select('id').eq('update_id', draft.data.id);
  assert(hidden.data.length === 0, 'admin sees draft evidence');
  assertDenied(
    await a
      .from('startup_updates')
      .update({ progress_types: ['Hype'] })
      .eq('id', draft.data.id),
    'unknown progress type',
  );
  const pub = await a
    .from('startup_updates')
    .update({ status: 'published' })
    .eq('id', draft.data.id);
  if (pub.error) throw pub.error;
  const shown = await admin
    .from('startup_updates')
    .select('progress_types, linked_stage, blocker, next_milestone')
    .eq('id', draft.data.id)
    .single();
  assert(shown.data?.linked_stage === 'mvp' && shown.data.progress_types.length === 2, 'fields');
  const visible = await admin.from('stage_evidence').select('id').eq('update_id', draft.data.id);
  assert(visible.data.length === 1, 'admin cannot see published evidence');
});
await check('admin reads all journey data but cannot write it', async () => {
  const reqs = await admin
    .from('startup_stage_requirements')
    .select('id')
    .in('startup_id', [startupA.id, startupB.id]);
  assert(reqs.data.length === 17 + 17 + 1, `admin sees ${reqs.data.length} requirements`);
  const ev = await admin.from('stage_evidence').select('id').eq('startup_id', startupA.id);
  assert(ev.data.length === 4, `admin sees ${ev.data.length} evidence`);
  const upd = await admin
    .from('startup_stage_requirements')
    .update({ status: 'not_started' })
    .eq('startup_id', startupA.id)
    .select();
  assert(upd.data.length === 0, 'admin changed requirements');
  assertDenied(
    await admin.from('stage_evidence').insert({
      startup_id: startupA.id,
      stage: 'mvp',
      evidence_type: 'link',
      label: 'x',
      url: 'https://example.com',
    }),
    'admin evidence insert',
  );
  const del = await admin.from('stage_evidence').delete().eq('startup_id', startupA.id).select();
  assert(del.data.length === 0, 'admin deleted evidence');
  const signed = await admin.storage
    .from('update-attachments')
    .createSignedUrl(evidencePdfPath, 60);
  if (signed.error) throw signed.error;
  const res = await fetch(signed.data.signedUrl);
  assert(res.status === 200, `admin evidence file ${res.status}`);
});
await check('stage distribution: admins only, counted in Postgres', async () => {
  assertDenied(await a.rpc('admin_stage_distribution'), 'founder distribution');
  const { data, error } = await admin.rpc('admin_stage_distribution');
  if (error) throw error;
  const [expected] = await sql(
    `select count(*)::int n from public.startups where onboarding_completed_at is not null`,
  );
  const total = data.reduce((sum, row) => sum + Number(row.startups), 0);
  assert(data.length === 6 && total === expected.n, `${total} vs ${expected.n}`);
});
section('Stage Review (V2.2)');
let reviewId;
await check(
  'setup: Founder A startup is onboarded at MVP with every MVP requirement completed',
  async () => {
    // Staff-side SQL: the security startups were created without the onboarding RPC.
    await sql(
      `update public.startups set onboarding_completed_at = now() where id in ('${startupA.id}', '${startupB.id}')`,
    );
    const { data } = await a
      .from('startup_stage_requirements')
      .select('status')
      .eq('startup_id', startupA.id)
      .eq('stage', 'mvp');
    assert(data.length === 6 && data.every((r) => r.status === 'completed'), JSON.stringify(data));
  },
);
await check('anon cannot read reviews or request one', async () => {
  assertDenied(await anon.from('stage_reviews').select('*').limit(1), 'anon reviews');
  assertDenied(
    await anon.rpc('request_stage_review', { p_startup_id: startupA.id }),
    'anon request',
  );
});
await check(
  'Founder B cannot request a review of Founder A startup; incomplete stages are refused',
  async () => {
    assertDenied(
      await b.rpc('request_stage_review', { p_startup_id: startupA.id }),
      'B requests A',
    );
    assertDenied(
      await b.rpc('request_stage_review', { p_startup_id: startupB.id }),
      'B incomplete',
    );
  },
);
await check(
  'founder requests a review; the server fills in stage, next stage and progress',
  async () => {
    const { data, error } = await a.rpc('request_stage_review', { p_startup_id: startupA.id });
    if (error) throw error;
    reviewId = data.id;
    assert(
      data.from_stage === 'mvp' &&
        data.to_stage === 'traction' &&
        data.status === 'pending' &&
        data.requirements_completed === 6 &&
        data.requested_by === accounts.a.id,
      JSON.stringify(data),
    );
    assertDenied(
      await a.rpc('request_stage_review', { p_startup_id: startupA.id }),
      'second pending',
    );
  },
);
await check('founders cannot decide reviews or move their stage', async () => {
  assertDenied(
    await a.rpc('decide_stage_review', { p_review_id: reviewId, p_decision: 'approved' }),
    'founder decides',
  );
  assertDenied(
    await a.from('stage_reviews').update({ status: 'approved' }).eq('id', reviewId),
    'founder updates review',
  );
  assertDenied(
    await a.from('startups').update({ journey_stage: 'traction' }).eq('id', startupA.id),
    'founder moves stage',
  );
  const del = await a.from('stage_reviews').delete().eq('id', reviewId);
  assert(del.error, 'founder deleted a review');
  const seen = await b.from('stage_reviews').select('id');
  assert(seen.data.length === 0, 'B sees A reviews');
});
await check('SQL cannot move an onboarded startup outside an approved review', async () => {
  let refused = false;
  try {
    await sql(`update public.startups set journey_stage = 'traction' where id = '${startupA.id}'`);
  } catch {
    refused = true;
  }
  assert(refused, 'direct journey_stage change was allowed');
});
await check('admin queue and stats list the pending review', async () => {
  const queue = await admin.rpc('admin_review_queue', { p_status: 'pending' });
  if (queue.error) throw queue.error;
  assert(
    queue.data.some((r) => r.id === reviewId),
    'review missing from queue',
  );
  const stats = await admin.rpc('admin_review_stats');
  assert(Number(stats.data[0].pending_reviews) >= 1, 'stats');
  assertDenied(await a.rpc('admin_review_queue'), 'founder queue');
  assertDenied(await a.rpc('admin_review_stats'), 'founder stats');
});
await check(
  'needs work requires feedback, keeps the stage and is immutable afterwards',
  async () => {
    assertDenied(
      await admin.rpc('decide_stage_review', { p_review_id: reviewId, p_decision: 'needs_work' }),
      'needs work without feedback',
    );
    const { data: reqs } = await admin
      .from('startup_stage_requirements')
      .select('id')
      .eq('startup_id', startupA.id)
      .eq('stage', 'mvp')
      .eq('requirement_key', 'demo');
    const { data, error } = await admin.rpc('decide_stage_review', {
      p_review_id: reviewId,
      p_decision: 'needs_work',
      p_feedback: `${TEMP_NAME_PREFIX} add a demo video`,
      p_requirement_ids: [reqs[0].id],
    });
    if (error) throw error;
    assert(
      data.status === 'needs_work' && data.attention_requirement_ids.length === 1,
      JSON.stringify(data),
    );
    const { data: s } = await a
      .from('startups')
      .select('journey_stage')
      .eq('id', startupA.id)
      .single();
    assert(s.journey_stage === 'mvp', 'stage moved on needs work');
    assertDenied(
      await admin.rpc('decide_stage_review', { p_review_id: reviewId, p_decision: 'approved' }),
      'decided twice',
    );
    assertDenied(
      await admin.from('stage_reviews').update({ feedback: 'rewritten' }).eq('id', reviewId),
      'admin rewrites',
    );
    const own = await a
      .from('stage_reviews')
      .select('feedback, reviewer_name')
      .eq('id', reviewId)
      .single();
    assert(
      own.data.feedback?.includes('demo video') && own.data.reviewer_name,
      'founder sees feedback',
    );
  },
);
await check('resubmission is a new review; approval moves the startup to Traction', async () => {
  const { data: second, error } = await a.rpc('request_stage_review', {
    p_startup_id: startupA.id,
  });
  if (error) throw error;
  const approved = await admin.rpc('decide_stage_review', {
    p_review_id: second.id,
    p_decision: 'approved',
    p_admin_note: `${TEMP_NAME_PREFIX} approved`,
  });
  if (approved.error) throw approved.error;
  const { data: s } = await a
    .from('startups')
    .select('journey_stage, stage')
    .eq('id', startupA.id)
    .single();
  assert(s.journey_stage === 'traction' && s.stage === 'MVP', JSON.stringify(s));
  const history = await a.from('stage_reviews').select('status').eq('startup_id', startupA.id);
  assert(
    history.data
      .map((r) => r.status)
      .sort()
      .join() === 'approved,needs_work',
    JSON.stringify(history.data),
  );
  const ev = await a.from('stage_evidence').select('id').eq('stage', 'mvp');
  assert(ev.data.length >= 2, 'MVP evidence lost after advancing');
  assertDenied(
    await a.rpc('request_stage_review', { p_startup_id: startupA.id }),
    'traction review refused until its chosen requirements are complete',
  );
});

section('Investor Readiness (V2.3)');
let readinessMetric;
let readinessReq = {};
let readinessReviewId;
await check('setup: Founder A completes a chosen Traction requirement', async () => {
  const { data: metrics } = await a
    .from('traction_metrics')
    .select('id, current_value, is_archived')
    .eq('startup_id', startupA.id);
  readinessMetric = metrics.find((m) => !m.is_archived && m.current_value !== null);
  if (!readinessMetric) {
    const created = await a.rpc('add_traction_metric', {
      p_name: 'Active Users',
      p_unit: 'number',
      p_initial_value: 120,
      p_recorded_on: new Date().toISOString().slice(0, 10),
    });
    if (created.error) throw created.error;
    readinessMetric = created.data;
  }
  const existing = await a
    .from('startup_stage_requirements')
    .select('id')
    .eq('startup_id', startupA.id)
    .eq('stage', 'traction');
  if (existing.data.length === 0) {
    const ins = await a.from('startup_stage_requirements').insert({
      startup_id: startupA.id,
      stage: 'traction',
      requirement_key: 'active_users',
      title: 'Active Users',
    });
    if (ins.error) throw ins.error;
  }
  const done = await a
    .from('startup_stage_requirements')
    .update({ status: 'completed', linked_metric_id: readinessMetric.id })
    .eq('startup_id', startupA.id)
    .eq('stage', 'traction');
  if (done.error) throw done.error;
});
await check(
  'before the transition there is no readiness data and no readiness review',
  async () => {
    const reqs = await a
      .from('investor_readiness_requirements')
      .select('id')
      .eq('startup_id', startupA.id);
    assert(reqs.data.length === 0, 'readiness rows before the stage');
    assertDenied(
      await a.from('investor_readiness_profiles').insert({ startup_id: startupA.id }),
      'founder creates a profile',
    );
    assertDenied(
      await a.rpc('request_investor_readiness_review', { p_startup_id: startupA.id }),
      'readiness review at traction',
    );
    const state = await a.rpc('investor_readiness_state', { p_startup_id: startupA.id });
    assert(!state.error && state.data.length === 0, JSON.stringify(state));
  },
);
await check(
  'only an approved Traction review enters Investor Readiness and initialises it',
  async () => {
    const { data: tr, error } = await a.rpc('request_stage_review', { p_startup_id: startupA.id });
    if (error) throw error;
    assert(tr.review_type === 'stage' && tr.to_stage === 'investor_readiness', JSON.stringify(tr));
    const ok = await admin.rpc('decide_stage_review', {
      p_review_id: tr.id,
      p_decision: 'approved',
    });
    if (ok.error) throw ok.error;
    const { data: s } = await a
      .from('startups')
      .select('journey_stage')
      .eq('id', startupA.id)
      .single();
    assert(s.journey_stage === 'investor_readiness', s.journey_stage);
    const reqs = await a
      .from('investor_readiness_requirements')
      .select('id, requirement_key')
      .eq('startup_id', startupA.id);
    assert(reqs.data.length === 48, `${reqs.data.length} requirements`);
    readinessReq = Object.fromEntries(reqs.data.map((r) => [r.requirement_key, r.id]));
    const profile = await a
      .from('investor_readiness_profiles')
      .select('startup_id')
      .eq('startup_id', startupA.id);
    assert(profile.data.length === 1, 'profile not created');
    assertDenied(
      await a.from('startups').update({ journey_stage: 'investor_access' }).eq('id', startupA.id),
      'founder moves to access',
    );
  },
);
await check('anon and Founder B cannot read or change Founder A readiness', async () => {
  for (const table of [
    'investor_readiness_requirements',
    'investor_readiness_profiles',
    'investor_readiness_metrics',
    'readiness_interviews',
  ]) {
    assertDenied(await anon.from(table).select('startup_id').limit(1), `anon ${table}`);
    const seen = await b.from(table).select('startup_id').eq('startup_id', startupA.id);
    assert(!seen.error && seen.data.length === 0, `B sees ${table}`);
  }
  const upd = await b
    .from('investor_readiness_requirements')
    .update({ text_value: 'hijack' })
    .eq('id', readinessReq.problem_statement)
    .select('id');
  assert(!upd.error ? upd.data.length === 0 : true, 'B updated A requirement');
  assertDenied(
    await b.rpc('investor_readiness_state', { p_startup_id: startupA.id }),
    'B reads A state',
  );
  assertDenied(
    await b.rpc('request_investor_readiness_review', { p_startup_id: startupA.id }),
    'B requests A readiness review',
  );
  assertDenied(
    await anon.rpc('investor_readiness_state', { p_startup_id: startupA.id }),
    'anon state',
  );
});
await check(
  'founders edit only their answers; titles, status and rules stay server-owned',
  async () => {
    const ok = await a
      .from('investor_readiness_requirements')
      .update({ text_value: 'Teachers grade all weekend.' })
      .eq('id', readinessReq.problem_statement);
    if (ok.error) throw ok.error;
    for (const patch of [
      { title: 'Renamed' },
      { required: false },
      { status: 'completed' },
      { section: 'team' },
      { allows_not_applicable: true },
    ]) {
      assertDenied(
        await a
          .from('investor_readiness_requirements')
          .update(patch)
          .eq('id', readinessReq.pitch_deck),
        `founder writes ${Object.keys(patch)[0]}`,
      );
    }
    assertDenied(
      await a
        .from('investor_readiness_requirements')
        .update({ not_applicable: true, not_applicable_reason: 'No deck' })
        .eq('id', readinessReq.pitch_deck),
      'pitch deck marked not applicable',
    );
    assertDenied(
      await a
        .from('investor_readiness_requirements')
        .update({ not_applicable: true })
        .eq('id', readinessReq.financial_model),
      'not applicable without a reason',
    );
    assertDenied(
      await a.from('investor_readiness_requirements').delete().eq('id', readinessReq.pitch_deck),
      'founder deletes a requirement',
    );
    const still = await a
      .from('investor_readiness_requirements')
      .select('id')
      .eq('id', readinessReq.pitch_deck);
    assert(still.data.length === 1, 'requirement deleted');
  },
);
await check('primary metrics link existing traction metrics only (own, live, max 5)', async () => {
  const own = await a
    .from('investor_readiness_metrics')
    .insert({ startup_id: startupA.id, metric_id: readinessMetric.id });
  if (own.error) throw own.error;
  const bMetric = await b
    .from('traction_metrics')
    .insert({ startup_id: startupB.id, name: 'B Users' }, { defaultToNull: false })
    .select('id')
    .single();
  if (bMetric.error) throw bMetric.error;
  assertDenied(
    await a
      .from('investor_readiness_metrics')
      .insert({ startup_id: startupA.id, metric_id: bMetric.data.id }),
    "linking Founder B's metric",
  );
  assertDenied(
    await b
      .from('investor_readiness_metrics')
      .insert({ startup_id: startupB.id, metric_id: bMetric.data.id }),
    'B outside Investor Readiness',
  );
  const cols = await a.from('investor_readiness_metrics').select('*').eq('startup_id', startupA.id);
  assert(
    cols.data.length === 1 && !('value' in cols.data[0]) && !('current_value' in cols.data[0]),
    'traction numbers copied',
  );
});
await check('readiness evidence attaches only to own readiness requirements', async () => {
  const ok = await a.from('stage_evidence').insert({
    startup_id: startupA.id,
    stage: 'investor_readiness',
    readiness_requirement_id: readinessReq.one_pager,
    evidence_type: 'link',
    label: `${TEMP_NAME_PREFIX} one-pager`,
    url: 'https://example.com/one-pager',
  });
  if (ok.error) throw ok.error;
  assertDenied(
    await a.from('stage_evidence').insert({
      startup_id: startupA.id,
      stage: 'traction',
      readiness_requirement_id: readinessReq.one_pager,
      evidence_type: 'link',
      label: `${TEMP_NAME_PREFIX} wrong stage`,
      url: 'https://example.com',
    }),
    'readiness evidence on another stage',
  );
  assertDenied(
    await b.from('stage_evidence').insert({
      startup_id: startupB.id,
      stage: 'investor_readiness',
      readiness_requirement_id: readinessReq.one_pager,
      evidence_type: 'link',
      label: `${TEMP_NAME_PREFIX} B evidence`,
      url: 'https://example.com',
    }),
    "B attaches to A's requirement",
  );
});
await check('admins read readiness but never write founder data', async () => {
  const seen = await admin
    .from('investor_readiness_requirements')
    .select('id')
    .eq('startup_id', startupA.id);
  assert(seen.data.length === 48, 'admin cannot read');
  const state = await admin.rpc('investor_readiness_state', { p_startup_id: startupA.id });
  assert(!state.error && state.data.length === 48, 'admin state');
  const upd = await admin
    .from('investor_readiness_profiles')
    .update({ target_raise: 1 })
    .eq('startup_id', startupA.id)
    .select('startup_id');
  assert(upd.error || upd.data.length === 0, 'admin wrote a profile');
  const req = await admin
    .from('investor_readiness_requirements')
    .update({ text_value: 'admin' })
    .eq('id', readinessReq.problem_statement)
    .select('id');
  assert(req.error || req.data.length === 0, 'admin wrote a requirement');
});
await check(
  'interview: admin-only scheduling; founders see time and place, never the note',
  async () => {
    assertDenied(
      await a.rpc('admin_set_readiness_interview', {
        p_startup_id: startupA.id,
        p_status: 'scheduled',
        p_scheduled_at: new Date(Date.now() + 864e5).toISOString(),
        p_location_or_link: 'Room 1',
      }),
      'founder schedules',
    );
    assertDenied(
      await a.from('readiness_interviews').insert({ startup_id: startupA.id, status: 'completed' }),
      'founder inserts interview',
    );
    assertDenied(
      await admin.rpc('admin_set_readiness_interview', {
        p_startup_id: startupA.id,
        p_status: 'scheduled',
      }),
      'scheduled without time and place',
    );
    assertDenied(
      await admin.rpc('admin_set_readiness_interview', {
        p_startup_id: startupB.id,
        p_status: 'scheduled',
        p_scheduled_at: new Date(Date.now() + 864e5).toISOString(),
        p_location_or_link: 'Room 1',
      }),
      'interview outside Investor Readiness',
    );
    const set = await admin.rpc('admin_set_readiness_interview', {
      p_startup_id: startupA.id,
      p_status: 'scheduled',
      p_scheduled_at: new Date(Date.now() + 864e5).toISOString(),
      p_location_or_link: 'innoWIUT office, room 204',
      p_admin_note: `${TEMP_NAME_PREFIX} private note`,
    });
    if (set.error) throw set.error;
    const own = await a
      .from('readiness_interviews')
      .select('status, scheduled_at, location_or_link')
      .eq('startup_id', startupA.id)
      .single();
    assert(own.data.status === 'scheduled' && own.data.location_or_link, JSON.stringify(own));
    assertDenied(
      await a.from('readiness_interviews').select('admin_note').eq('startup_id', startupA.id),
      'founder reads the admin note',
    );
    assertDenied(
      await a.rpc('admin_readiness_interview', { p_startup_id: startupA.id }),
      'note rpc',
    );
    const upd = await a
      .from('readiness_interviews')
      .update({ status: 'completed' })
      .eq('startup_id', startupA.id)
      .select('id');
    assert(upd.error || upd.data.length === 0, 'founder edited the interview');
    const adminView = await admin.rpc('admin_readiness_interview', { p_startup_id: startupA.id });
    assert(adminView.data[0]?.admin_note?.includes('private note'), 'admin note');
    const bSees = await b.from('readiness_interviews').select('id');
    assert(bSees.data.length === 0, 'B sees interview');
  },
);
await check(
  'readiness review: incomplete is refused; complete creates an investor_readiness review',
  async () => {
    assertDenied(
      await a.rpc('request_investor_readiness_review', { p_startup_id: startupA.id }),
      'incomplete readiness',
    );
    const before = await a.rpc('investor_readiness_state', { p_startup_id: startupA.id });
    const missing = before.data
      .filter((r) => r.required && !r.is_complete)
      .map((r) => r.requirement_key);
    // Company data is read from the startup profile (this fixture has no tagline / year yet).
    assert(
      missing.includes('founded_year') && !missing.includes('startup_name'),
      `company not read from the profile: ${missing.join(', ')}`,
    );
    const prof = await a
      .from('startups')
      .update({ tagline: 'Temporary security startup', founded_year: 2024 })
      .eq('id', startupA.id);
    if (prof.error) throw prof.error;
    await completeReadiness(a, startupA.id);
    const after = await a.rpc('investor_readiness_state', { p_startup_id: startupA.id });
    const open = after.data
      .filter((r) => r.required && !r.not_applicable && !r.is_complete)
      .map((r) => r.requirement_key);
    assert(open.length === 0, `still incomplete: ${open.join(', ')}`);
    const { data, error } = await a.rpc('request_investor_readiness_review', {
      p_startup_id: startupA.id,
    });
    if (error) throw error;
    readinessReviewId = data.id;
    assert(
      data.review_type === 'investor_readiness' &&
        data.from_stage === 'investor_readiness' &&
        data.to_stage === 'investor_access' &&
        data.requirements_completed === data.requirements_total,
      JSON.stringify(data),
    );
    const queue = await admin.rpc('admin_review_queue', {
      p_status: 'pending',
      p_type: 'investor_readiness',
    });
    if (queue.error) throw queue.error;
    assert(
      queue.data.some((r) => r.id === readinessReviewId) &&
        queue.data.every((r) => r.review_type === 'investor_readiness'),
      'type filter',
    );
    const stageOnly = await admin.rpc('admin_review_queue', { p_status: null, p_type: 'stage' });
    if (stageOnly.error) throw stageOnly.error;
    assert(
      stageOnly.data.length > 0 &&
        stageOnly.data.every((r) => r.review_type === 'stage') &&
        !stageOnly.data.some((r) => r.id === readinessReviewId),
      'stage filter leaks',
    );
    const stats = await admin.rpc('admin_readiness_stats');
    assert(Number(stats.data[0].pending_readiness_reviews) >= 1, 'readiness stats');
    assertDenied(await a.rpc('admin_readiness_stats'), 'founder stats');
  },
);
await check('readiness Needs Work needs feedback, flags sections and keeps the stage', async () => {
  assertDenied(
    await admin.rpc('decide_stage_review', {
      p_review_id: readinessReviewId,
      p_decision: 'needs_work',
    }),
    'no feedback',
  );
  const { data, error } = await admin.rpc('decide_stage_review', {
    p_review_id: readinessReviewId,
    p_decision: 'needs_work',
    p_feedback: `${TEMP_NAME_PREFIX} add a financial model`,
    p_requirement_ids: [readinessReq.financial_model],
    p_sections: ['investor_materials'],
  });
  if (error) throw error;
  assert(
    data.attention_sections.join() === 'investor_materials' &&
      data.attention_requirement_ids.length === 1,
    JSON.stringify(data),
  );
  const { data: s } = await a
    .from('startups')
    .select('journey_stage')
    .eq('id', startupA.id)
    .single();
  assert(s.journey_stage === 'investor_readiness', s.journey_stage);
  assertDenied(
    await admin.from('stage_reviews').update({ feedback: 'rewritten' }).eq('id', readinessReviewId),
    'review rewritten',
  );
});
await check(
  'resubmission is a new review; Investor Ready moves to Investor Access only',
  async () => {
    const second = await a.rpc('request_investor_readiness_review', { p_startup_id: startupA.id });
    if (second.error) throw second.error;
    assert(second.data.id !== readinessReviewId, 'same review reused');
    const ok = await admin.rpc('decide_stage_review', {
      p_review_id: second.data.id,
      p_decision: 'approved',
    });
    if (ok.error) throw ok.error;
    const { data: s } = await a
      .from('startups')
      .select('journey_stage')
      .eq('id', startupA.id)
      .single();
    assert(s.journey_stage === 'investor_access', s.journey_stage);
    const reviews = await a
      .from('stage_reviews')
      .select('status, review_type')
      .eq('startup_id', startupA.id)
      .eq('review_type', 'investor_readiness');
    assert(
      reviews.data
        .map((r) => r.status)
        .sort()
        .join() === 'approved,needs_work',
      JSON.stringify(reviews.data),
    );
    // Readiness is read-only after the stage; nothing investor-facing exists.
    const upd = await a
      .from('investor_readiness_requirements')
      .update({ text_value: 'late edit' })
      .eq('id', readinessReq.problem_statement)
      .select('id');
    assert(upd.error || upd.data.length === 0, 'edited after Investor Ready');
    assertDenied(
      await a.rpc('request_investor_readiness_review', { p_startup_id: startupA.id }),
      'readiness review at investor access',
    );
    assertDenied(
      await a.rpc('request_stage_review', { p_startup_id: startupA.id }),
      'stage review at investor access',
    );
    const [tables] = await sql(
      `select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name ~ '(investor_(profiles|directory|matches|messages|introductions)|vc_|crm)'`,
    );
    assert(tables.n === 0, 'investor functionality tables exist');
  },
);

await check('evidence files are removed by their owner', async () => {
  const r = await a.storage.from('update-attachments').remove([evidencePdfPath]);
  assert(r.data?.length === 1, 'evidence file not removed');
});

await check('test files are deleted through the Storage API by their owners', async () => {
  const r1 = await a.storage.from('startup-logos').remove([logoPath]);
  const r2 = await a.storage.from('update-attachments').remove([attachmentPath]);
  const r3 = await admin.storage.from('mentor-photos').remove([mentorPhotoPath()]);
  assert(
    r1.data?.length === 1 && r2.data?.length === 1 && r3.data?.length === 1,
    'not all files removed',
  );
  const [left] = await sql(
    `select count(*)::int n from storage.objects where split_part(name,'/',1) in ('${startupA.id}','${startupB.id}','${mentor.id}')`,
  );
  assert(left.n === 0, `${left.n} objects left`);
});

process.exit(summary() ? 0 : 1);
