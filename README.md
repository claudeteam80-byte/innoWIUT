# innoWIUT Founder Platform

Founder and admin platform for innoWIUT (Westminster International University in Tashkent):
founders track traction, post progress updates and work with their mentor; innoWIUT admins
oversee every startup.

**Stack:** React 19 · Vite · TypeScript · Tailwind CSS v4 · React Router · TanStack Query ·
Zod + react-hook-form · Supabase (Auth, Postgres, Storage) · Vitest · deployed on Vercel.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your Supabase URL and anon key
npm run dev
```

See [docs/setup.md](docs/setup.md) for Supabase configuration, creating admins and deployment.

## Project layout

```
src/
  app/            router, route table, paths, App entry
  routes/guards/  role + onboarding guards and the pure access rules they use
  layouts/        FounderAppShell, AdminAppShell, navigation
  features/       auth, onboarding, founder, admin (api / pages / schemas per feature)
  domain/         framework-free business logic (activity status, traction maths, formatting)
  components/     ui primitives and shared building blocks
  lib/            env validation, Supabase client, query client, helpers
  types/          Supabase database types
supabase/
  migrations/     schema, RLS policies, storage buckets
  templates/      auth email templates (6-digit code, reset link)
  tests/          local RLS test harness
reference/        Base44 prototype export — design reference only, never imported
docs/             audit and setup docs
```

## Status

Phase 3 (Founder Core) complete: signup with 6-digit email verification, 3-step onboarding,
dashboard, traction (metrics, multi-metric recording, chart, history), updates (drafts, publishing,
private images), startup profile with team, mentor page with notes and meeting requests, and
settings — all backed by the real Supabase project.

Phase 4 (Admin Core) complete: ecosystem dashboard with server-computed stats, startups list with
server-side search/filter/sort/pagination, startup detail (overview, traction, published updates,
team, mentor), mentor management with photos, mentor assignment with history, mentor notes, meeting
request handling and admin settings. The app never shows sample or fake numbers.

Admin access management: `founder` / `admin` / `superadmin` roles enforced in Postgres. Superadmins
grant, revoke and promote admins at `/admin/access`; every role change is audited and the last
superadmin cannot be removed. See [docs/setup.md](docs/setup.md#admin-access-no-public-admin-signup).

V2.1 Startup Journey: six stages (Idea → Validation → MVP → Traction, then Investor Readiness and
Investor Access, which were locked in V2.1). Founders work deterministic stage requirements at
`/founder/journey`, attach structured evidence (links, screenshots, PDFs, customer feedback, notes,
references to their own traction metrics) and post structured updates (what moved, progress type,
evidence, traction movement read from history, blocker, next milestone, linked stage). The
dashboard shows the current stage and a deterministic next best action. Admins get a Stage
Distribution on the dashboard and a read-only Journey tab per startup. Completing a stage's
requirements never moves the startup: stage transitions are a later, controlled phase.

V2.2 Stage Review: when every required milestone of the current stage is complete, the founder
requests a stage review. innoWIUT admins work a review queue at `/admin/reviews` (pending / needs
work / approved / all) and decide each review at `/admin/reviews/:id` with the requirements,
evidence, traction, stage-linked updates, blocker and next milestone in front of them. **Approve**
moves the startup to the next stage — the only way a stage ever changes. **Needs work** keeps the
stage and sends feedback (optionally naming requirements to revisit); the founder improves and
resubmits. Every request and decision stays in an immutable review history on both sides.

V2.3 Investor Readiness: an approved Traction review moves the startup into Investor Readiness
(stage 05). The founder works nine readiness sections — Company, Problem & Market, Product,
Traction, Business Model, Team, Fundraising, Legal & Operations, Investor Materials — and sees a
**readiness completion** percentage (mandatory, applicable requirements only; never a score).
Existing data is reused, not re-entered: the startup profile, team, journey evidence and traction
metrics (primary investor metrics are links to traction, so current / previous / change / history
always come from Traction). Some requirements can be marked not applicable with a reason. When
everything is complete the founder requests an **Investor Readiness review**; admins see it in the
same review queue (Review Type filter), decide **Needs Work** (feedback, optional sections and
requirements) or **Mark Investor Ready**, and can arrange an optional interview (date, place,
status; the admin note stays private). Investor Ready unlocks Investor Access, which shows
"Coming Soon" — no investor directory, matching, messaging or introductions exist yet.
