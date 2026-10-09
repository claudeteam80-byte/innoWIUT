// RLS, storage and database-function validation against the REAL project, using
// temporary Founder A / Founder B / admin accounts. Leaves the accounts in place
// (credentials in .remote-validation-state.json) for UI checks; run cleanup.mjs after.
import { writeFileSync } from 'node:fs';
import {
  assert,
  assertDenied,
  check,
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
