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
| `npm run test:db` | Applies all migrations to a throwaway local Postgres and runs `supabase/tests/rls.test.sql`. Needs Postgres server binaries (`initdb`, `pg_ctl`) and must run as a non-root user. Uses minimal stand-ins for Supabase's `auth`/`storage` schemas (`supabase/tests/supabase_stubs.sql`). |

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

## Creating an admin (no public admin signup)

Admins are created by staff only. There is no route, API or policy that lets a user change a role.

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**
   (email + password, tick "Auto Confirm User").
2. **SQL Editor**:
   ```sql
   update public.profiles set role = 'admin' where email = 'staff.member@wiut.uz';
   ```
3. The person signs in at `/admin/login`.

To revoke: `update public.profiles set role = 'founder' where email = '…';` (or delete the user).
Do not promote an account that already owns a startup.

## Security model

- Every table has RLS enabled; `anon` has no table access.
- Founders only see and change their own startup's rows (`private.owns_startup`).
- Admins read everything and manage mentors, assignments, notes and meeting request status (`private.is_admin`).
  Admins only see published founder updates, not drafts.
- Column-level grants block client writes to `profiles.role`, `startups.owner_id`,
  `startups.onboarding_completed_at` and derived traction values.
- `onboarding_completed_at` will be set by a server-side function in the onboarding phase; until then it can
  only be set from the SQL editor.
- Traction entries are append-only; metric current/previous values are maintained by a trigger.
- Storage: `startup-logos` (public), `update-attachments` (private, signed URLs), `mentor-photos` (public);
  object paths start with the owning startup/mentor id.
- Route guards in the app are UX only — RLS is the real enforcement.
- Any new table needs explicit grants and RLS policies (the first migration revokes Supabase's default grants).

## Vercel deployment

1. Import the GitHub repo in Vercel (framework preset: Vite — `vercel.json` sets build/output and SPA rewrites).
2. Project Settings → Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   (Production and Preview). Never add the service role key.
3. Deploy, then set the Supabase Site URL / Redirect URLs to the Vercel domain (see above).
