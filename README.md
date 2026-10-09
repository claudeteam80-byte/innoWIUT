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
Investor Access, which are visible but locked). Founders work deterministic stage requirements at
`/founder/journey`, attach structured evidence (links, screenshots, PDFs, customer feedback, notes,
references to their own traction metrics) and post structured updates (what moved, progress type,
evidence, traction movement read from history, blocker, next milestone, linked stage). The
dashboard shows the current stage and a deterministic next best action. Admins get a Stage
Distribution on the dashboard and a read-only Journey tab per startup. Completing a stage's
requirements never moves the startup: stage transitions are a later, controlled phase.
