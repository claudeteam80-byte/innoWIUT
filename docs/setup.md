# Setup and operations

## Local development

```bash
nvm use            # Node 22
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev        # http://localhost:5173
```

Without valid env vars the app shows a "not configured" screen instead of crashing.

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript project check |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit/component tests (no Supabase needed) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run test:db` | Applies all migrations to a throwaway local Postgres and runs `supabase/tests/rls.test.sql` and `journey.test.sql`, then replays the V1 migrations on a second cluster, loads V1-shaped data (`supabase/tests/compat/`) and proves the V2.1 migrations keep it intact. Needs Postgres server binaries (`initdb`, `pg_ctl`) and must run as a non-root user. Uses minimal stand-ins for Supabase's `auth`/`storage` schemas (`supabase/tests/supabase_stubs.sql`). |

With the Supabase CLI and Docker you can instead run the full local stack: `npx supabase start`
(uses `supabase/config.toml`, including the email templates; emails appear in the local inbox UI).

## Supabase project setup

1. Create a Supabase project.
2. Apply the migrations. Either through the Management API (works in the Claude Code cloud
   environment, where the proxy injects the access token):
   ```bash
   npm run db:migrate          # applies pending supabase/migrations/*.sql and records them
   ```
   or with a direct database connection: `npx supabase link --project-ref <ref> && npx supabase db push`.
3. **Authentication → Sign In / Providers → Email**
   - Enable the email provider and sign ups.
   - **Confirm email: ON.**
   - **Email OTP length: 6.**
   - Minimum password length: 8.
4. **Authentication → URL Configuration**
   - Site URL: the production URL, e.g. `https://<app>.vercel.app`.
   - Redirect URLs: `https://<app>.vercel.app/reset-password`, plus `http://localhost:5173/reset-password`
     and preview deployments (e.g. `https://*-<team>.vercel.app/reset-password`) if needed.
5. **Custom SMTP is required** for the templates below on the free tier
   (Authentication → Emails → SMTP Settings). Then **Authentication → Emails → Templates** — copy the bodies from:
   - `supabase/templates/confirmation.html` → "Confirm signup" (sends the 6-digit `{{ .Token }}` code).
   - `supabase/templates/recovery.html` → "Reset password" (links to `/reset-password?token_hash=…&type=recovery`).

   Without these, Supabase's default templates send links instead of the code the app expects.
6. Configure a custom SMTP provider before launch — Supabase's built-in email is rate-limited and meant for testing.
7. Regenerate types after any schema change: `npm run gen:types` (writes `src/types/database.ts`;
   hand-written aliases live in `src/types/app.ts`).

## Admin access (no public admin signup)

Roles live in `profiles.role`: `founder`, `admin`, `superadmin`. Admins and superadmins have the same
admin permissions; only a superadmin can manage admin access (page `/admin/access`). Every admin signs in
with their own email and password — there are no shared admin credentials.

The rules are enforced in the database, not the app:

- Clients cannot write `profiles.role` (column grants). Role changes only happen through
  `grant_admin_access()`, `revoke_admin_access()` and `promote_to_superadmin()`, which refuse anyone who is
  not a superadmin. Nobody can change their own role through them except a superadmin removing their own
  access with explicit confirmation.
- A trigger refuses any change (including from the SQL editor) that would leave zero superadmins.
- Every role change, from the app or the SQL editor, is written to `admin_role_events`
  (readable by superadmins only, not writable by anyone through the API).
- No service-role key is used anywhere; the app only has the anon key.

### Creating the first superadmin (one time, manual)

1. Create the account, either way:
   - **A.** Supabase dashboard → **Authentication → Users → Add user → Create new user**: the owner's email,
     a strong unique password (keep it in a password manager), tick **Auto Confirm User**.
   - **B.** Sign up at `https://www.foundertrack.space/founder/signup`, enter the 6-digit code, and
     **do not complete onboarding** (an account that owns a startup cannot become an admin).
2. Supabase dashboard → **SQL Editor** → run (replace the email):
   ```sql
   update public.profiles
   set role = 'superadmin'
   where lower(email) = lower('owner@example.com')
     and role = 'founder'
     and not exists (select 1 from public.startups where owner_id = profiles.id)
   returning id, email, role;
   ```
   Expect exactly one row. Zero rows means the email is wrong, the account does not exist yet, or it
   already owns a startup.
3. Check:
   ```sql
   select id, email, role from public.profiles where role = 'superadmin';
   select target_email, previous_role, new_role, changed_by_email, created_at
   from public.admin_role_events order by created_at desc limit 5;
   ```
   One superadmin, and one `founder → superadmin` event with no actor (shown in the app as
   "SQL editor (manual)").
4. Sign in at `/admin/login`. The sidebar shows **Admin Access**.

### Adding and removing admins

1. The person creates their own account at `/founder/signup` and verifies the 6-digit code
   (no onboarding). They choose their own password.
2. A superadmin opens **Admin Access → Grant Admin Access**, enters the email, checks the name and email
   shown, ticks the confirmation and grants. The person can now sign in at `/admin/login`.
3. **Revoke Access** turns the account back into a founder account immediately; an open admin session
   leaves the admin area within a minute. **Promote to Superadmin** requires typing the person's email.

Forgotten passwords: `/forgot-password?portal=admin`. To hand over the last superadmin role, promote the new
person first, then revoke the old account — the database never allows zero superadmins.

## Security model

- Every table has RLS enabled; `anon` has no table access.
- Founders only see and change their own startup's rows (`private.owns_startup`).
- Admins and superadmins read everything and manage mentors, assignments, notes and meeting request status (`private.is_admin`).
- Admin screens use database functions that refuse non-admins: `admin_dashboard_stats()` (counts computed in
  Postgres), `admin_startup_list()` (search / filter / sort / pagination in Postgres), `assign_mentor()` /
  `end_mentor_assignment()` (one active mentor per startup, history kept) and `delete_mentor()` (refuses while
  assigned, archives a mentor with history instead of deleting it).
  Admins only see published founder updates, not drafts.
- Column-level grants block client writes to `profiles.role`, `startups.owner_id`,
  `startups.onboarding_completed_at` and derived traction values.
- `onboarding_completed_at` is only set by `public.complete_onboarding()`, which runs with the founder's
  own privileges and calls the `private.mark_onboarding_complete()` helper for that single column.
- Founder writes that span several rows go through database functions so they are atomic:
  `complete_onboarding()` (profile + startup + initial traction), `add_traction_metric()` and
  `record_traction()`. All API-exposed functions are `SECURITY INVOKER`.
- Traction entries are append-only; metric current/previous values are maintained by a trigger.
- Storage: `startup-logos` (public), `update-attachments` (private, signed URLs), `mentor-photos` (public);
  object paths start with the owning startup/mentor id.
- Startup Journey (V2.1):
  - `startups.journey_stage` (`idea` … `investor_access`) is derived once from the V1 `startups.stage`
    label (Early Traction and Growth → `traction`) and has no client column grant. Nothing advances it
    automatically — completing every requirement only shows "Stage requirements completed".
    `startups.stage` is kept unchanged for V1 compatibility.
  - `startup_stage_requirements`: Idea / Validation / MVP rows are created from fixed templates by
    trigger (`private.stage_requirement_templates()`); founders update `status`, `progress_value` and
    `linked_metric_id` only (`completed_at` is server-set). Traction rows are chosen by the founder
    from a fixed list and link their existing traction metrics. Investor stages cannot hold rows.
  - `stage_evidence`: append-only for founders (insert/delete), each type carries exactly its value
    (URL, file in the startup's own `update-attachments` folder, text, or a reference to one of the
    startup's own metrics — traction values are never copied). Admins read evidence except evidence
    attached to an unpublished draft update, and write nothing.
  - `startup_updates` gains `progress_types`, `blocker`, `next_milestone`, `next_milestone_date`,
    `linked_stage`; V1 columns and rows are unchanged and still render.
  - `admin_stage_distribution()` counts onboarded startups per stage in Postgres (admins only).
  - Evidence files reuse the private `update-attachments` bucket (PDF added to its allowed types);
    no new bucket.
- Route guards in the app are UX only — RLS is the real enforcement.
- Any new table needs explicit grants and RLS policies (the first migration revokes Supabase's default grants).

## Vercel deployment

1. Import the GitHub repo in Vercel (framework preset: Vite — `vercel.json` sets build/output and SPA rewrites).
2. Project Settings → Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   (Production and Preview). Never add the service role key.
3. Deploy, then set the Supabase Site URL / Redirect URLs to the Vercel domain (see above).

## Validating the real project

These scripts run against the live Supabase project (anon key from `.env.local`, SQL through the
Management API). Every record they create is labelled (`innowiut-temp` emails, `TEMP TEST` names).

| Command | What it does |
| --- | --- |
| `npm run remote:auth -- signup --email=you+innowiut-temp-founder@example.com` | Real signup; sends the 6-digit code email |
| `npm run remote:auth -- verify --code=123456` | Verifies the code, tests login and forgot/reset password |
| `npm run remote:security` | RLS, admin permissions, draft visibility, storage policies, activity functions, Startup Journey (requirements, evidence ownership, locked stages, no auto-advance, draft-evidence visibility, stage distribution) (Founder A / Founder B / temporary admin; no email sent) |
| `npm run remote:journey -- --email=you+innowiut-temp-journey@example.com` | Full founder journey in a real browser: signup, 6-digit verification, onboarding with logo, traction, Startup Journey (requirement progress, URL + PDF evidence, traction proof, completion without auto-advance), draft → published structured update with evidence and traction movement, profile + team, mentor + meeting request, reload persistence, phone layout. Needs the built app served on port 4175 (`npm run build && npx vite preview --port 4175 --strictPort`). It sends one real verification email, reads the matching code from Supabase's stored hash of it and types it into the verify screen. Cleans up after itself. Add `--no-email` (and omit `--email`) to skip the signup email: the account is created pre-confirmed and signs in through the real login screen. |
| `npm run remote:admin-journey` | Admin journey in two real browsers (admin + founder): login, dashboard stats checked against `admin_dashboard_stats()`, startup search, Stage Distribution checked against `admin_stage_distribution()`, detail tabs (read-only Journey with draft evidence hidden, traction, published-only updates), mentor creation with photo, assignment, notes, founder meeting request, admin confirmation, founder sees "Confirmed", cross-role route guards, tablet/phone layouts. Needs the built app on port 4175. Sends no email. |
| `npm run remote:access-journey` | Admin access management in real browsers: `/admin/access` refused to founders and admins, grant via the UI, the new admin can sign in, revoke, the revoked account is refused at `/admin/login`, history entries, self-removal blocked for the only superadmin, promotion with typed email. Uses temporary accounts only; needs the built app on port 4175. |
| `npm run remote:ui-audit` | Visits every page as visitor, founder, new founder, admin and superadmin at desktop, laptop, tablet and phone widths. Reports console errors, failed requests, broken images, horizontal overflow, stuck loading states, unnamed buttons, small tap targets and dead links. Add `--screenshots=<dir>` to save every page. `BASE_URL=https://www.foundertrack.space` runs it against production. Uses temporary accounts only. |
| `npm run remote:cleanup` | Deletes every temporary user, row and file and prints what remains |

Always finish with `npm run remote:cleanup`.

Note for feature work: when inserting several rows at once with supabase-js, pass
`{ defaultToNull: false }` if the rows do not all have the same keys, otherwise missing columns are
sent as `NULL` instead of using the database default.
