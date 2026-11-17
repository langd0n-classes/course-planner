# Public demo: design

- **Status:** accepted by the operator 2026-11-16
- **Issue:** #78
- **Depends on:** #70 (the demo data carries the current and next Term)

## What a visitor gets

A visitor opens a link in any browser. There is no sign-in. The visitor lands
in the **showcase**: one workspace that holds the generic demo Course, with a
Term in progress and the next Term planned. Every visitor sees the same
showcase, and no visitor can change it.

From the showcase the visitor can do two things:

- **Start a demo of their own.** The app generates a new demo workspace for
  that browser. The visitor can edit anything in it. It is deleted each day.
- **Share their demo.** A share link opens the visitor's demo, read-only, in
  another person's browser.

A banner says which workspace is open and what can be done in it.

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
  demo request is served. When the check throws, the request fails. Build
  step 4 adds this call and tests both results.
- Any other value of the flag, including unset, is normal mode. Normal mode
  never reads the marker.

Not chosen: a build-time flag (it is baked into the client bundle and
selects behavior for whoever holds the artifact); the flag alone (one wrong
variable on the production project would give every visitor a workspace
with no sign-in).

### 2. The workspaces

**A shared showcase that nobody can edit in the app, a generated demo for
each visitor who asks for one, and a read-only share link.** Operator
decision, 2026-11-16.

| Workspace | Who can read it | Who can edit it | Lifetime |
|---|---|---|---|
| Showcase | Everyone | Nobody in the app; it changes through the demo data in code | Kept across resets |
| Visitor demo | The visitor, and anyone with its share link | The visitor | Until the next reset |

Reasons:

- The operator must be able to show a person a specific thing. A stable,
  shared workspace gives every page of it a link that stays valid.
- A shared workspace that visitors can edit shows each visitor what the last
  one typed, on a public page that carries the project's name. So the shared
  workspace is read-only for visitors.
- A visitor still needs to try the editing. A demo of their own gives that
  without exposing their changes to other visitors.
- This differs from the research comment on #78, which recommended one
  shared, editable workspace. The cost it cited for separate workspaces was
  overstated: 300 seconds is the transaction's timeout, and the measured demo
  load on a local Postgres is about one second.

#### The showcase

- The showcase belongs to one fixed Instructor, `showcase@example.test`. The
  bootstrap script creates it and runs the demo load for it.
- The reset keeps the showcase. After each reset, the reset job runs the
  repeat demo load on the showcase. That load adds the current and next Term
  when they are missing and changes nothing else (#70), so the showcase does
  not go stale at a semester boundary.
- The showcase's record ids do not change at a reset, so a link to a
  showcase page stays valid until the showcase is rebuilt.

#### Changing the showcase

- The showcase has no editor and no admin account. Operator decision,
  2026-11-16: changing the showcase in code is enough for now.
- To change the showcase, change the demo data in code, deploy, and run the
  hand-run script that rebuilds the showcase.
- A rebuild gives the showcase new record ids, so links to its pages from
  before the rebuild stop working.

#### A visitor's demo

- The visitor chooses "Start your own demo". The app does not create a demo
  on the first visit, so a crawler or a visitor who only looks creates
  nothing.
- The app then sets a cookie that holds a random UUID. The cookie is
  `HttpOnly`, `Secure`, `SameSite=Lax`. The UUID maps to an Instructor with
  the email `visitor-<uuid>@demo.invalid`.
- The app generates the demo with the existing demo load, with Terms computed
  from that day's date. It is not a copy of the showcase.
- The UUID is the visitor's only credential. It is unguessable, and it
  protects nothing of value.
- The visitor can switch between their demo and the showcase.

#### The share link

- Each visitor demo has a share token: a second random UUID, different from
  the cookie UUID. The share link is `/demo/shared/<share token>`.
- The link opens that demo read-only. The person who opens it cannot edit
  it, and does not receive the owner's cookie.
- The link stops working when the reset deletes the demo. The banner on a
  shared demo says so.
- Something that must stay goes in the showcase, through the demo data in
  code.

#### How a request finds its workspace

- In demo mode, each request has one **open workspace**: the showcase, the
  visitor's own demo, or a shared demo. `getAuthenticatedInstructor` returns
  the Instructor of the open workspace. Auth.js is not called.
- The existing ownership checks then work without change. The app already
  scopes every read and write by Instructor.
- **Write rule.** In demo mode, the proxy refuses each request that is not
  `GET` or `HEAD` unless the open workspace is the visitor's own demo. The
  refusal is made in one place, before any route runs.
- A `DemoWorkspace` row for each visitor demo holds the Instructor id, the
  share token, the creation time, and the time of the last request. The
  table is empty outside demo mode.

### 3. Limits against abuse

Creating a demo is the costly request, so the limits are there.

- A rate limit on "Start your own demo", keyed by client address.
- A cap on visitor demos between resets. At the cap, a visitor gets the
  showcase only, with a message that gives the reset time.
- A rate limit on write routes, keyed by client address.
- A row cap for each visitor demo. At the cap, a write returns an error that
  says the demo is full. One visitor cannot fill the database between resets.
- An age limit for each visitor demo. A demo with no request for 24 hours is
  deleted by the next reset even if a reset is skipped or fails part-way.
- The showcase and shared demos are read-only, so a flood of readers writes
  nothing.
- The host's firewall and bot filtering are on for the demo project.
- Every demo response carries `X-Robots-Tag: noindex`.
- Not built first: a bot challenge before "Start your own demo". Add it if
  the rate limit and the cap are not enough.

### 4. Reset

**Once a day, by a Vercel Cron request to a reset route.**

- The reset is cleanup. No visitor can change what another visitor sees, so
  a daily interval is enough.
- The route requires all of: demo mode, the marker, and the `CRON_SECRET`
  bearer token. It checks the marker in the same database connection that
  runs the delete, before the delete.
- The reset deletes every visitor Instructor and everything each one owns,
  and every `DemoWorkspace` row. It keeps the showcase, `_prisma_migrations`,
  and `_demo_marker`. It then runs the repeat demo load on the showcase.
- The reset does not truncate, because a truncate would remove the showcase
  and break the links to its pages each day. Build step 6 must prove with a database test that
  deleting a visitor Instructor leaves no row of that visitor in any table.
- A script runs the same reset by hand. A second script rebuilds the
  showcase from nothing.

This replaces the issue's `npm run db:seed -- --force`. A route in a
serverless function cannot run that command, and the default seed builds a
workspace for a seeded instructor that no visitor can reach.

### 5. AI features

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

### 6. What the demo deployment is

- A separate Vercel project that deploys `main` from this repository.
- Its own Neon database. It has no connection string in common with
  production.
- No deployment protection.
- Environment: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `COURSE_PLANNER_DEMO`,
  `CRON_SECRET`, `AUTH_SECRET`. No Google,
  allowlist, or preview variables.
- `scripts/vercel-build.sh` needs no change. It migrates on a production
  build, and the demo project's production build migrates the demo database.

## Risks and the control for each

| Risk | Control |
|---|---|
| The demo flag is set on production | The sign-in variables conflict with the flag; the app fails closed. The marker is absent. |
| The demo project points at the production database | No marker in that database: no demo traffic is served and the reset refuses. |
| The reset route is called by a stranger | `CRON_SECRET`, demo mode, and the marker are all required. |
| A visitor changes the showcase | The write rule in the proxy; a test sends each write method to the showcase. |
| A visitor floods the database | Demo created only on request; rate limit and cap on creation; row cap for each demo; daily reset. |
| A visitor uploads a large file | The exemplar-import route has no size limit today. Demo mode disables that route. |
| A model API is called | No SDK in the build; a test fails if one is added. |
| A visitor sees another visitor's content | One Instructor for each visitor; existing ownership checks. Another visitor's demo opens only with its share link. |
| A shared demo holds offensive content | It is reachable only by its link, it carries a banner that it is a visitor's demo, and it is deleted at the next reset. |

## Build order

| Step | Work | Size |
|---|---|---|
| 1 | #70: current and next Term | Done in its own pull request |
| 2 | `demoModeConfig` with the conflict rule; marker check; tests | S |
| 3 | The no-model-SDK and mock-only test | S |
| 4 | Open-workspace resolution in the proxy and in `getAuthenticatedInstructor`; the write rule; marker check on first request; layout without sign-out | M |
| 5 | Showcase Instructor and bootstrap script; banner for each workspace; `noindex` header | M |
| 6 | "Start your own demo"; `DemoWorkspace` table; switch between demo and showcase; reset route, cron entry, hand-run scripts; the delete test | M |
| 7 | Share link | S |
| 8 | Creation cap, row cap and age limit for each demo, rate limits, exemplar-import disabled | M |
| 9 | Operator: Vercel project, Neon database, variables, bootstrap, smoke test | Manual |

Steps 2 and 3 change no behavior of the running app. Steps 4 to 8 are inert
unless both keys are present. The demo is usable after step 6.

## Open items

- **Load time on the hosted database.** "Start your own demo" runs the demo
  load. Measure it on Neon at step 9. If it is over about five seconds, show
  a "building your demo" state.
- **The cap on visitor demos.** Start at 200 between resets. Change it after
  the first week of use.
- **Reset time.** 08:00 UTC, which is the low point of a North American day.
- **The Vercel plan's cron limit.** Confirm at step 9 that the plan allows a
  daily cron job.
- **Deleting a visitor's rows.** The schema's delete rules decide whether one
  delete of an Instructor removes everything. Step 6 finds this out and adds
  explicit deletes where a rule is `Restrict`.

## Done when

The conditions in #78, restated against these decisions:

- A link opens the populated showcase in a private browser window, with no
  sign-in.
- A write to the showcase is refused.
- "Start your own demo" gives an editable demo. A second private window that
  starts a demo gets a different one, and sees none of the first window's
  changes.
- A share link opens the first window's demo in the second window, and a
  write through it is refused.
- No model SDK is in the build, and the test that enforces it passes.
- The demo project holds no production variable, and the app refuses to
  start in demo mode when one is present.
- The reset refuses to run against a database with no marker, removes each
  visitor demo, and keeps the showcase.
