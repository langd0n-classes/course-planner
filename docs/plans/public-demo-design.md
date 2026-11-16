# Public demo: design

- **Status:** proposed 2026-11-16
- **Issue:** #78
- **Depends on:** #70 (the demo data carries the current and next Term)

## What a visitor gets

A visitor opens a link in any browser. There is no sign-in. The visitor lands
in a workspace that already holds the generic demo Course, with a Term in
progress and the next Term planned. The visitor can edit anything. A banner
says that this is a demo, that the changes belong to this browser only, and
that they are deleted each day.

## Decisions

### 1. How the app knows it is the demo

**Two keys. Both must be present. Neither is in the repository.**

| Key | Where it lives | Who can set it |
|---|---|---|
| `COURSE_PLANNER_DEMO=true` | Server environment of the demo Vercel project | The operator, in Vercel |
| The table `_demo_marker` | The demo database | The operator, with a bootstrap script |

Rules:

- The variable is server-only. It has no `NEXT_PUBLIC_` form, so it is not
  compiled into client code and a build cannot be switched by a visitor.
- **The flag conflicts with sign-in configuration.** If `COURSE_PLANNER_DEMO`
  is `true` and any of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `ALLOWED_EMAIL`, `COURSE_PLANNER_PREVIEW_AUTH`, or
  `COURSE_PLANNER_PREVIEW_EMAIL` is set, the app raises a configuration error
  and serves nothing. Production needs those variables to be usable, so
  production with the flag added fails closed. It does not become a demo.
- **No migration creates `_demo_marker`.** Only the bootstrap script creates
  it, and the script is run by hand against one named database. A database
  that was never bootstrapped cannot serve demo traffic and cannot be reset.
- The app checks the marker once for each server instance, before the first
  demo request is served.
- Any other value of the flag, including unset, is normal mode. Normal mode
  never reads the marker.

Not chosen: a build-time flag (it is baked into the client bundle and
selects behavior for whoever holds the artifact); the flag alone (one wrong
variable on the production project would give every visitor a workspace
with no sign-in).

### 2. Shared workspace or one for each visitor

**One workspace for each visitor.** This differs from the research comment
on #78, which recommended one shared workspace.

- A shared workspace on a public link shows each visitor what the last
  visitor typed. The demo is public and carries the project's name. One
  visitor can fill it with anything, and it stays until the next reset.
- The cost that argued for sharing was overstated. The comment cited a
  300-second load for each visitor. 300 seconds is the transaction's timeout.
  The measured demo load on a local Postgres is about one second. The time
  on the hosted database is not yet measured; see "Open items".
- The app already scopes every read and write by Instructor. A visitor
  workspace is one more Instructor row. No new isolation code is needed.

How it works:

- On the first request, the proxy sets a cookie that holds a random UUID.
  The cookie is `HttpOnly`, `Secure`, `SameSite=Lax`.
- In demo mode, `getAuthenticatedInstructor` maps that UUID to an Instructor
  with the email `visitor-<uuid>@demo.invalid`, and creates the row on first
  use. Auth.js is not called.
- The Course index loads the demo Course on the visitor's first visit. The
  existing "Load demo course" action does this work today.
- The UUID is the visitor's only credential. It is unguessable, and it
  protects nothing of value.

Limits:

- A cap on visitor workspaces between resets. At the cap, a new visitor gets
  a page that says the demo is full and gives the reset time.
- A rate limit on demo-load and on write routes, keyed by client address.
- A row cap for each visitor workspace. At the cap, a write returns an error
  that says the demo workspace is full. One visitor cannot fill the database
  between resets.
- An age limit for each visitor workspace. A workspace with no request for 24
  hours is deleted by the next reset even if a reset is skipped or fails
  part-way.

### 3. Reset

**Once a day, by a Vercel Cron request to a reset route.**

- With one workspace for each visitor, the reset is cleanup. It no longer
  protects visitors from each other, so a daily interval is enough.
- The route requires all of: demo mode, the marker, and the `CRON_SECRET`
  bearer token. It checks the marker in the same database connection that
  runs the truncate, before the truncate.
- The reset truncates every application table and keeps `_prisma_migrations`
  and `_demo_marker`. It does not reseed. Each visitor's workspace is built
  on that visitor's first request, with Terms computed from that day's date.
- A script runs the same reset by hand.

This replaces the issue's `npm run db:seed -- --force`. A route in a
serverless function cannot run that command, and the default seed builds a
workspace for a seeded instructor that no visitor can reach.

### 4. AI features

**There is no live AI feature to simulate. The demo adds none.**

- The only AI call site is "Suggest Redistribution" in the legacy
  `WhatIfPanel`. Its route, `POST /api/ai/suggest-redistribution`, is retired
  and returns `410`. The redesigned workspace has no AI action.
- The service registry returns `MockAiPlanner` and cannot return anything
  else. `package.json` has no model SDK.
- The issue's condition "each AI feature returns a simulated response" is
  met with zero features. A test keeps it met: it fails if a model SDK is
  added to `package.json` or if demo mode can resolve a planner other than
  the mock.
- The banner does not mention AI until an AI feature exists. A future AI
  feature must ship its simulated path and its label in the same change.

Not chosen: a separate `DemoAiPlanner`. `MockAiPlanner` is already the
simulated implementation, and OPS.md keeps it as the active one.

### 5. What the demo deployment is

- A separate Vercel project that deploys `main` from this repository.
- Its own Neon database. It has no connection string in common with
  production.
- No deployment protection.
- Environment: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `COURSE_PLANNER_DEMO`,
  `CRON_SECRET`, `AUTH_SECRET`. No Google, allowlist, or preview variables.
- `scripts/vercel-build.sh` needs no change. It migrates on a production
  build, and the demo project's production build migrates the demo database.
- Every demo response carries `X-Robots-Tag: noindex`.

## Risks and the control for each

| Risk | Control |
|---|---|
| The demo flag is set on production | The sign-in variables conflict with the flag; the app fails closed. The marker is absent. |
| The demo project points at the production database | No marker in that database: no demo traffic is served and the reset refuses. |
| The reset route is called by a stranger | `CRON_SECRET`, demo mode, and the marker are all required. |
| A visitor floods the database | Workspace cap, row cap for each workspace, rate limits, daily reset. |
| A visitor uploads a large file | The exemplar-import route has no size limit today. Demo mode disables that route. |
| A model API is called | No SDK in the build; a test fails if one is added. |
| A visitor sees another visitor's content | One Instructor for each visitor; existing ownership checks. |

## Build order

| Step | Work | Size |
|---|---|---|
| 1 | #70: current and next Term | Done in its own pull request |
| 2 | `demoModeConfig` with the conflict rule; marker check; tests | S |
| 3 | The no-model-SDK and mock-only test | S |
| 4 | Visitor cookie in the proxy; demo branch in `getAuthenticatedInstructor`; layout without sign-out | M |
| 5 | Load the demo Course on first visit; banner; `noindex` header | S |
| 6 | Reset route, cron entry, hand-run script, bootstrap script | M |
| 7 | Workspace cap, row cap and age limit for each workspace, rate limits, exemplar-import disabled | M |
| 8 | Operator: Vercel project, Neon database, variables, bootstrap, smoke test | Manual |

Steps 2 and 3 change no behavior of the running app. Steps 4 to 7 are inert
unless both keys are present.

## Open items

- **Load time on the hosted database.** The first visit runs the demo load.
  Measure it on Neon at step 8. If it is over about five seconds, show a
  "building your workspace" state, or build a small pool of workspaces ahead
  of visitors.
- **The cap on workspaces.** Start at 200 between resets. Change it after the
  first week of use.
- **Reset time.** 08:00 UTC, which is the low point of a North American day.
- **The Vercel plan's cron limit.** Confirm at step 8 that the plan allows a
  daily cron job.

## Done when

The conditions in #78, restated against these decisions:

- A link opens a populated workspace in a private browser window, with no
  sign-in.
- A second private window gets a different workspace, and sees none of the
  first window's changes.
- No model SDK is in the build, and the test that enforces it passes.
- The demo project holds no production variable, and the app refuses to
  start in demo mode when one is present.
- The reset refuses to run against a database with no marker.
