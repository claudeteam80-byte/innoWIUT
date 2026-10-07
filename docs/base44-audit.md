# Base44 export audit — innoWIUT Founder Platform V1

Audit date: 2026-10-07. Source: `reference/base44-export/` (Base44 app "innoWIUT Hub",
`inno-launch-pad.base44.app`). The export is a compiled Vite/React build and is used only as a
design and UX reference.

## A. What is in the export

| File | What it is |
| --- | --- |
| `index.html`, `founder/login.html`, `founder/signup.html`, `admin/login.html`, `forgot-password.html` | Pre-rendered snapshots of the 5 public pages (only unauthenticated screens were crawled) |
| `assets/index-BAJT5jSk.js` (1.0 MB) | Single minified bundle: React 18, React Router v6, TanStack Query, Radix UI (shadcn/ui), lucide-react, date-fns, Recharts, lodash, input-otp, `@base44/sdk` (axios + socket.io) and all app code |
| `assets/index-CyQLRf1E.css` | Compiled Tailwind v3 with shadcn HSL tokens |
| `assets/_external/...` | Inter woff2, innoWIUT logo (1024×1024 **JPEG** named `.png`), Base44 badge symbol |
| `static/js/badge.js` | Base44 "Edit with Base44" floating badge |
| `api/app-logs/**`, `api/apps/**` | Crawled Base44 API endpoints; the `.json` files are just copies of the index HTML, not data |
| `manifest.json` | PWA manifest pointing at Base44 domain/CDN |
| `_download_meta.json` | Crawler map of URL → file |

No database contents, no source maps, no secrets were found.

### Product behaviour recovered from the bundle

**Auth**
- `/auth` role picker ("Welcome to innoWIUT" → Founder / innoWIUT Admin cards).
- Founder login: Google OAuth + email/password, "Remember me", forgot password.
- Founder signup: full name, email, password, confirm, Terms checkbox, Google → 6-digit email OTP
  verification screen ("Verify your email", Resend). Full name stashed in `sessionStorage`
  (`innowiut_signup_name`) and written after verification.
- Admin login: email/password only; after sign-in checks `user.role === 'admin'`, otherwise signs out
  with "This account does not have administrator access…". Copy: "There is no public admin sign up."
- `/reset-password` page, `/login` → `/auth`, `/register` → `/founder/signup`.
- Role gating is **client-side only** (`p_` guard on Base44 built-in `user.role`).

**Onboarding (`/founder/onboarding`, 3 steps)**
1. *Tell us about yourself* — full name*, phone, LinkedIn, role in startup (Founder/Co-Founder/CEO/CTO/Other).
2. *Your startup* — logo upload, name*, website, tagline*, industry, stage, founded year, team size, description.
3. *Current progress* — has product? has users? (→ current users), has revenue? (→ monthly revenue),
   main goal, biggest challenge.
   On finish: `auth.updateMe`, `Startup.create({... founder_email, onboarding_complete})`, and seeds
   `TractionMetric` rows "Users"/"Monthly revenue" from step 3 answers.

**Founder sidebar**: Overview, Updates, Traction, Mentor, Mentor Directory, Team, Startup Profile, Settings, Help.

- **Overview** — greeting by time of day, startup summary card (logo, tagline, industry/stage/team/founded chips,
  website, main goal, biggest challenge), Traction overview metric cards (value, % change vs previous, target,
  "Last updated…"), trend chart, Latest update card, actions Add Update / Update Traction / Add Metric.
  Empty states everywhere ("No startup profile yet", "No traction data yet", "No updates yet").
- **Updates** — list of updates (title, summary, highlights[], challenge, next steps, image, link, author,
  update_date, status draft/published). Modal with Save Draft / Publish Update. Default title
  "Weekly Update — {Month d}". Traction changes recorded the same day are shown on the update card.
- **Traction** — Add Metric (presets: Active Users, Users, MRR, Revenue, Customers, Pilots, Partnerships,
  Transactions, Waitlist, Retention, Conversion, or custom; unit number/currency($)/percent; current value;
  target; note). Update Metrics modal (new value per metric, date, note) → writes `TractionEntry` history rows
  (old_value, new_value, change_percent) and updates `TractionMetric.value/previous_value`.
  Trend chart per metric, history table (Date, Metric, Old, New, Change, Note).
- **Mentor** — assigned mentor card (initials, name, role, expertise, email, contact link, Contact Mentor),
  Mentor Guidance notes (quote style, mentor name, date), Request Meeting modal (reason: Product/Growth/
  Business Model/Fundraising/Team/Other, message, preferred date) and list of requests with status
  Requested/Confirmed/Completed.
- **Mentor Directory** — searchable grid of all mentors, "Your mentor" badge.
- **Team** — team members (name, role, email, LinkedIn) add/edit/remove. Also embedded in Startup Profile.
- **Startup Profile** — edit company fields + team.
- **Settings** — phone, LinkedIn, role; send password reset link; notification toggles
  ("Update reminders", "Weekly progress summary") saved on the user record (nothing sends them).
- **Help** — four static explainer cards.

**Admin sidebar**: Ecosystem Overview, Startups, Mentors, Settings.

- **Ecosystem Overview** — stat cards computed client-side from up to 200 startups / 500 updates / 1000 entries:
  Active Startups (activity ≤ 7 days), Updates This Week, Startups with Traction Growth, Inactive Startups
  (no activity 15+ days); Recent Updates feed; startup cards.
- **Startups** — search (startup/founder), filters stage / industry / activity (Active, Needs Update 8–14 days,
  Inactive), sort Most Recent / Highest Growth / Newest / Oldest; table: Startup, Founder, Industry, Stage,
  Main Metric, Current Traction, Change, Last Update, Activity.
- **Startup detail** (`/admin/startups/:id`) — header with industry · stage, founder, last activity, activity badge;
  Overview field grid (all onboarding fields), Traction (cards + chart + history), Updates, Mentor
  (Assign/Change Mentor modal: select existing or create new mentor inline; Add Mentor Note modal), Team.
- **Mentors** — searchable list with "Mentoring N startups".
- **Settings** — admin identity, reset password link, access-policy text, sign out.

Meeting requests have **no admin screen** in the prototype — founders create them, nobody can confirm them.

## B. Routes / screens

| Route | Access | Screen |
| --- | --- | --- |
| `/auth` | public | Role picker |
| `/founder/login` | public | Founder sign in |
| `/founder/signup` | public | Founder sign up + OTP verify |
| `/admin/login` | public | Admin sign in |
| `/forgot-password` | public | Request reset link |
| `/reset-password` | public | Set new password |
| `/login`, `/register` | public | Redirects |
| `/` | authed | Redirect by role |
| `/founder/onboarding` | founder | 3-step onboarding |
| `/founder/dashboard` | founder | Overview |
| `/founder/updates` | founder | Updates |
| `/founder/traction` | founder | Traction |
| `/founder/mentor` | founder | Mentor + notes + meeting requests |
| `/founder/startup` | founder | Startup profile + team |
| `/founder/settings` | founder | Settings |
| `/founder/help` | founder | Help |
| `/mentor-directory` | founder | Mentor directory |
| `/team-management` | founder | Team |
| `/admin` | admin | → `/admin/dashboard` |
| `/admin/dashboard` | admin | Ecosystem overview |
| `/admin/startups` | admin | Startups list |
| `/admin/startups/:id` | admin | Startup detail |
| `/admin/mentors` | admin | Mentors |
| `/admin/settings` | admin | Admin settings |
| `*` | any | 404 |

## C. Design system

- **Font**: Inter (single family for heading/body/display). Dense type scale: 13px body, 12–12.5px meta,
  10.5–11px uppercase eyebrows with `tracking-[0.12em]`, 16px section titles, 24px page titles.
- **Palette** (by usage count):
  - Primary blue `#264F9D` (hover `#1D3E7C`), light tints `#EAF1FB` / `#E9F0FB`
  - Navy sidebar `#17233B` / `#22304C` / `#33415C`; active nav item = primary with blue glow shadow, inactive `text-white/60`
  - Text `#1D2939` (primary), `#667085` (secondary), `#98A2B3` (placeholder)
  - Border `#E4E7EC`, `#D7DEEA`; page background `#F4F7FB`, subtle `#F9FBFE`
  - Danger `#C7293F` / `#A31F32`, success `#358A7C` / `#26693A`, warning `#F6AC10` / `#8A5A00`
- **shadcn tokens** in `:root` (HSL): primary 219 61% 38%, foreground 214 33% 17%, border 218 17% 91%,
  destructive 352 66% 47%, chart-1..5, `--radius: .75rem`, sidebar tokens. A `.dark` theme is defined but
  components use hard-coded hex, so dark mode does not actually work.
- **Shape**: `rounded-xl` cards with `border-[#E4E7EC] bg-white`, `rounded-lg` controls, `h-10` inputs/buttons.
- **Components**: PageHeader (eyebrow/title/subtitle/actions), EmptyState (icon/title/description/action),
  StatCard/MetricCard (label, value, change pill, target, meta), StatusBadge tones
  (positive/warning/danger/blue/navy/neutral), ChangePill (up/down/flat icon), Modal (sizes, footer),
  FormField (label, required `*` in danger red, hint), Select, YesNo toggle, LogoUpload, Highlights list
  editor, Table, Search/filter bar, AppShell (sidebar + top header with user avatar initials), Loading spinner,
  toast notifications.
- **Auth layout**: split screen — navy brand panel left ("Your startup workspace / Track your startup. Share progress.
  Stay connected with innoWIUT."), form card right; footer "innoWIUT · Westminster International University in Tashkent".
- **Icons**: lucide-react.

## D. Base44 dependencies to replace

| Base44 | Replacement |
| --- | --- |
| `@base44/sdk` client (`appId 6ac61171e6e6f2c9dfd6fde8`, axios, socket.io realtime) | `@supabase/supabase-js` typed client |
| `auth.loginViaEmailPassword`, `register`, `verifyOtp`, `resendOtp`, `setToken`, `me`, `updateMe`, `logout`, `isAuthenticated`, `redirectToLogin`, `loginWithProvider('google')`, `resetPasswordRequest`, `resetPassword` | Supabase Auth: `signInWithPassword`, `signUp` (+ `verifyOtp` or confirm link), `signInWithOAuth`, `resetPasswordForEmail`, `updateUser`, `getSession`/`onAuthStateChange`, `signOut`; profile data in `profiles` table |
| Built-in `user.role` | `profiles.role` enum, enforced in RLS (never client-only) |
| `entities.Startup / StartupUpdate / TractionMetric / TractionEntry / TeamMember / Mentor / MentorNote / MeetingRequest` (`list/filter/get/create/update/delete/bulkCreate/bulkUpdate`) | Postgres tables + RLS, Postgres functions for multi-row writes |
| `integrations.Core.UploadPublicFile` | Supabase Storage buckets with policies |
| `functions.fetch` (unused) | Supabase Edge Functions if ever needed |
| `localStorage.base44_access_token`, XHR 401 interceptor in `index.html`, `clear_access_token` / `access_token` URL params | Supabase session handling |
| Base44 analytics (`/analytics/track/batch`, heartbeat), `/app-logs/log-user-in-app` | Remove (add privacy-respecting analytics later if wanted) |
| `badge.js` "Edit with Base44", `data-base44-*` attributes, `ResponsiveImage` (Wix/Base44 media transforms) | Remove; plain `<img>` / Supabase image URLs |
| `media.base44.com` logo, favicon, manifest | Local `/public` assets (need originals) |
| Public-settings endpoint, `user_not_registered` error screen | Remove |
| `/engine.io` realtime socket | Supabase Realtime only if needed (not needed for V1) |

## E. Recommended folder structure

```
/
├─ reference/base44-export/          # read-only design reference (never imported)
├─ docs/                             # audit, ADRs, runbooks (admin bootstrap, deploy)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                    # timestamped SQL: enums, tables, RLS, functions, storage
│  ├─ tests/                         # pgTAP RLS tests
│  └─ seed.sql                       # LOCAL DEV ONLY — never run against production
├─ public/                           # logo, favicon, manifest
├─ src/
│  ├─ main.tsx
│  ├─ app/                           # App.tsx, router.tsx, providers.tsx (QueryClient, Auth)
│  ├─ routes/guards/                 # RequireAuth, RequireRole, RequireOnboarding, RedirectIfAuthed
│  ├─ layouts/                       # AuthLayout, FounderLayout, AdminLayout, Sidebar, Topbar
│  ├─ lib/
│  │  ├─ supabase.ts                 # createClient<Database>
│  │  ├─ env.ts                      # Zod-validated import.meta.env
│  │  ├─ query-client.ts
│  │  ├─ format.ts                   # number/currency/percent/date/relative time
│  │  └─ cn.ts
│  ├─ types/database.ts              # generated by `supabase gen types`
│  ├─ components/
│  │  ├─ ui/                         # Button, Input, Textarea, Select, Checkbox, Switch, Dialog, Table, Badge, Toast
│  │  └─ shared/                     # PageHeader, EmptyState, MetricCard, ChangePill, StatusBadge, FormField, LoadingState, ErrorState, FileUpload
│  └─ features/
│     ├─ auth/         {api.ts, hooks.ts, schemas.ts, pages/, components/}
│     ├─ onboarding/
│     ├─ startups/     # startup profile, team members
│     ├─ updates/
│     ├─ traction/
│     ├─ mentors/      # directory, assigned mentor, notes, admin CRUD + assignment
│     ├─ meetings/
│     ├─ founder-dashboard/
│     ├─ admin-dashboard/
│     └─ settings/
├─ e2e/                              # Playwright
├─ .env.example                      # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY only
└─ index.html, vite.config.ts, tailwind.config.ts, tsconfig*.json, eslint/prettier config
```

Each feature owns its `api.ts` (Supabase queries), `hooks.ts` (TanStack Query wrappers), `schemas.ts` (Zod,
shared by forms and row parsing) and `pages/`/`components/`. Pages never call Supabase directly.

## F. Recommended Supabase architecture

**Auth**
- One Supabase Auth project for both roles. Founder signup via email/password (+ optional Google).
- `handle_new_user` trigger on `auth.users` inserts `profiles` with `role = 'founder'` always.
  Users cannot change `role` (column-level `REVOKE UPDATE (role)` + check in policy).
- Admins are created only by staff: invite/create user in the Supabase dashboard or a service-role script
  (`scripts/create-admin.ts`, run locally, never shipped), then `role = 'admin'`.
- Admin login page signs in, checks `profiles.role`, signs out non-admins. Real enforcement is RLS.
- Optionally restrict founder signup by email domain in a `before user created` auth hook (needs decision).

**Schema (core tables)**
- `profiles` — id (= auth.users.id), role `app_role` ('founder','admin'), full_name, email, phone, linkedin_url,
  notify_update_reminders, notify_weekly_summary, timestamps.
- `startups` — id, owner_id → profiles (unique: one startup per founder in V1), name, tagline, description,
  logo_path, industry, stage (enums or check constraints), website, founded_year, team_size, has_product,
  has_users, has_revenue, main_goal, biggest_challenge, founder_role, onboarding_completed_at, timestamps.
- `team_members` — startup_id, name, role, email, linkedin_url.
- `mentors` — name, title, bio, expertise text[], email, contact_url, photo_path, is_active.
  (Mentors are records, not logins, in V1.)
- `mentor_assignments` — startup_id, mentor_id, assigned_by, assigned_at, ended_at; partial unique index
  "one active assignment per startup". Keeps assignment history.
- `mentor_notes` — startup_id, mentor_id, created_by (admin), body, note_date.
- `meeting_requests` — startup_id, mentor_id, requested_by, reason enum, message, preferred_date,
  status enum ('requested','confirmed','completed','declined','cancelled'), admin_response.
- `startup_updates` — startup_id, author_id, title, summary, highlights text[], challenge, next_steps,
  image_path, link_url, status ('draft','published'), update_date, published_at.
- `traction_metrics` — startup_id, name, unit ('number','currency','percent'), target, note, is_archived,
  current_value, previous_value, last_recorded_on (maintained by trigger, never by client).
- `traction_entries` — metric_id, startup_id, value, recorded_on, note, created_by. Append-only history;
  the first entry is the initial value.

**Server-side logic (Postgres functions, `security definer` where needed, all `search_path` pinned)**
- `is_admin()` — reads `profiles.role` for `auth.uid()`; used in every admin policy.
- `complete_onboarding(payload jsonb)` — one transaction: update profile, insert startup, insert initial metrics + entries.
- `record_traction(entries jsonb, recorded_on date, note text)` — inserts entries, trigger updates metric
  current/previous values; % change derived in SQL (no client-supplied old values).
- `assign_mentor(startup_id, mentor_id)` — ends previous assignment, inserts new one (admin only).
- Views (with `security_invoker = true`): `startup_activity` (last update / last traction / activity status
  with the 7 / 14-day thresholds), `admin_startup_list` (main metric, current value, change, last update).
- `admin_dashboard_stats()` — active, needs-update, inactive counts, updates this week, startups growing.
  All admin numbers come from these, never from client arrays capped at 200 rows.

**RLS (enabled on every table)**
- Founders: read/write rows where `startup_id` belongs to a startup with `owner_id = auth.uid()`;
  read mentors (active), their own assignment, notes for their startup; create meeting requests, read own;
  cannot write notes, assignments, or other startups' data.
- Admins: `is_admin()` → full read; write on mentors, assignments, notes, meeting request status.
- No anon access to any table.

**Storage**
- `startup-logos` (public read, write only to `{startup_id}/…` by owner or admin).
- `update-attachments` (private; signed URLs; owner write, owner + admin read).
- `mentor-photos` (public read, admin write).
- File size/MIME limits set on bucket.

**Tooling**: Supabase CLI local stack, migrations in git, `supabase gen types typescript` into
`src/types/database.ts`, pgTAP tests for RLS in CI.

## G. Risks and missing information

1. **Only public pages were pre-rendered.** Authenticated screens were reconstructed from minified code; no
   screenshots exist. Screenshots of the founder and admin screens would make the rebuild match the design exactly.
2. **Fake data in prototype**: founder login/signup brand panel hard-codes "Active users 640 / +18% this month".
   Must be removed or replaced by a real aggregate (recommend removing — public pages shouldn't expose stats).
   Placeholders ("640", "Yodgor Karimov", "linguabc.xyz") are fine as input placeholders only.
3. **Security model in prototype is client-side**: role guard is UI only; founder↔startup link is a
   `founder_email` string match; admin dashboard aggregates in the browser from capped lists. All must move server-side.
4. **Traction integrity**: prototype trusts client-sent old_value/change_percent and does non-transactional
   bulk writes. Replace with `record_traction` function.
5. **Meeting requests have no admin workflow** — need decision: admin confirms/completes them? Email notification?
6. **Mentors**: are they login users in a later version? V1 assumes records only, notes entered by admins. Confirm.
7. **Notifications** toggles exist but nothing sends email. Out of scope for V1 unless an email provider is chosen.
8. **Google sign-in** and **OTP-code vs link email verification** — confirm both; Google needs OAuth credentials.
9. **Extra screens** beyond the stated V1 list: Mentor Directory, Team, Help, Settings. Confirm keep.
10. **One startup per founder; co-founders** cannot log in to the same startup in the prototype. Confirm.
11. **Currency** hard-coded to `$`. Confirm USD vs UZS.
12. **Signup restriction** — open signup or only `@wiut.uz` / invite? Confirm.
13. **Brand assets**: the logo is a Base44-hosted 1024px JPEG mislabelled `.png`; need original SVG/PNG and favicon.
14. **Terms & Privacy** pages are referenced at signup but have no content.
15. **Existing Base44 data** — is there real production data to migrate? The export contains none.
16. **Supabase project & hosting** — need project URL, anon key, and hosting target (Vercel/Netlify/other) to set
    auth redirect URLs and SPA rewrites. Service-role key must never be in the frontend.
17. **Activity thresholds** (Active ≤7d, Needs Update 8–14d, Inactive 15d+) — confirm.
18. Repository is empty (unborn branch, no CI/README) — no conflicts, but everything is greenfield.

## H. Implementation plan

**Phase 0 — Foundation**
Vite + React + TS (strict), Tailwind with the tokens in section C, ESLint + Prettier, React Router, TanStack Query,
Zod env validation, path aliases, Vitest, GitHub Actions (typecheck, lint, test, build), `.env.example`, README.

**Phase 1 — Supabase schema & security**
Supabase CLI project, migrations for enums/tables/indexes/triggers, `is_admin()`, RLS policies, storage buckets +
policies, onboarding/traction/assignment functions, views + `admin_dashboard_stats()`, generated types,
pgTAP RLS tests, documented admin-bootstrap procedure.

**Phase 2 — Auth**
Auth provider (session + profile), founder login, founder signup (+ verification), admin login (role check),
forgot/reset password, auth callback route, guards (`RequireAuth`, `RequireRole`, `RequireOnboarding`), role-based
`/` redirect, sign out, 404.

**Phase 3 — UI kit & layouts**
Shared components from section C, AuthLayout, FounderLayout, AdminLayout (responsive sidebar), toast, loading /
empty / error states.

**Phase 4 — Founder onboarding**
3-step wizard with per-step Zod schemas, logo upload, `complete_onboarding` RPC, redirect gating.

**Phase 5 — Founder core**
Dashboard, startup profile + team, updates (draft/publish, image upload, link), traction (add metric,
record values, history table, trend chart). All reads from Supabase; empty states when no data.

**Phase 6 — Mentor (founder side)**
Assigned mentor card, mentor notes, meeting request form + status list, mentor directory.

**Phase 7 — Admin**
Ecosystem dashboard (server-computed stats), startups list (server-side search/filter/sort), startup detail
(overview, traction, updates, team, mentor), mentors CRUD, mentor assignment, mentor notes, meeting request
handling, admin settings.

**Phase 8 — Settings, help & polish**
Founder/admin settings, help page, accessibility pass, mobile layout, performance (route-level code splitting).

**Phase 9 — QA & launch**
Playwright E2E for both roles (incl. a founder attempting admin routes), RLS test suite green, "no fake data"
audit, production Supabase project, admin bootstrap, deploy, smoke test.
