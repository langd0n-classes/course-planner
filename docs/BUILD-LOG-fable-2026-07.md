# BUILD-LOG — Fable capability build, July 2026

Running log of an autonomous build session (Claude Fable 5, 2026-07-08).
Each stage records what was built, key decisions, alternatives rejected,
test results, and a candid self-assessment. Newest sections at the bottom.

---

## Stage 0 — Preflight & green baseline (`fix/green-baseline`)

### Starting state

- `main` @ `e061b32` (podman dev env merge). MVP + 2A + 2A.3 + 2B.1 +
  Google OAuth complete. 61 unit tests.
- Open PR #8 (`feat/5-skill-flow-visualization`) for issue #5, created
  2026-02-24 — stale, based on pre-2B.1 main. Handled in Stage 1.
- CI on `main` red since 2026-05-28 (every run of the May 28 push batch
  failed).

### Diagnosis: CI is a genuine code break, in two layers

1. **TypeScript check fails** (the step CI actually dies on): 8 errors in
   `src/app/api/sessions/[id]/cancel/route.test.ts`. The test mocks
   `@/lib/prisma` with a `vi.mock` factory, then calls
   `.mockResolvedValue(...)` on `prisma.session.findUnique`. Statically
   that's still the generated Prisma delegate type, which has no vitest
   mock methods. The errors only appear when `prisma generate` has produced
   the *real* client types — which is why the break slipped through: on the
   author's machine (and initially on mine) generation had silently failed,
   leaving `@prisma/client`'s permissive stub types, and `tsc` passed.
2. **Build step would fail next**: the Google OAuth PR (`2a2240b`) changed
   `build` to `prisma generate && prisma migrate deploy && next build` (for
   Vercel). CI and the Dockerfile builder stage have no `DATABASE_URL`, so
   `migrate deploy` can't run there. CI never reached this step because
   typecheck fails first.

Environment note (host-specific, documented for future agents): the Prisma
CLI (v6.19.2) segfaults at startup on this Fedora 43 host, both sandboxed
and not. Workaround used throughout this session:
`podman run --rm -v "$PWD":/app:Z -w /app docker.io/library/node:22 npx prisma generate`.
This is what exposed the stub-types-vs-real-types discrepancy.

### Fixes

1. `route.test.ts`: replaced `vi.mocked(prisma).session.findUnique...` with
   explicitly `Mock`-typed accessors (`prisma.session.findUnique as unknown
   as Mock`). This matches the pattern the file already used inline for
   `findMany` (which is exactly why those lines were NOT among the CI
   errors). No runtime behavior change — same `vi.fn()` instances.
   - *Alternative rejected:* `vi.mocked(prisma, { deep: true })` — fixes
     `mockResolvedValue` but still fails on `$transaction.mockImplementation`
     because the implementation signature can't satisfy Prisma's overloaded
     generic `$transaction` type without casts anyway. One consistent cast
     pattern beats two mixed ones.
2. `package.json`: `build` restored to `prisma generate && next build`;
   added `vercel-build` with `migrate deploy` in the middle. Vercel prefers
   `vercel-build` when present, so the deploy-time migration behavior the
   OAuth PR wanted is preserved, while CI and `docker build` work again
   without a live database.
   - *Alternative rejected:* postgres service container in CI + DATABASE_URL
     env. Heavier, slower CI, and still leaves `docker build` broken.
   - *Alternative rejected:* moving `migrate deploy` to the container
     entrypoint. Correct long-term for the Docker path, but it changes
     runtime behavior of the published image; out of scope for a
     green-baseline fix.

### Verification (local, with real generated Prisma types)

- `npm run typecheck` — clean (was 8 errors)
- `npm test` — 61/61 pass (unchanged; baseline count 61)
- `npx next build` — succeeds with no `DATABASE_URL` set (CI-equivalent)
- `npx eslint` on the changed test file — clean

### Known debt observed, deliberately not touched here

- `npm run lint` has 10 pre-existing errors on `main` (mostly
  `react-hooks/set-state-in-effect` in page components) + 8 warnings. CI
  doesn't run lint, so not part of the green baseline. Candidate for a
  later cleanup branch.

### Self-assessment

Confident in the diagnosis — reproduced CI's exact 8 errors locally after
container-generating the client. The `vercel-build` split is the one call
made on indirect evidence (commit message "run prisma migrate deploy on
every Vercel build"); if the app is actually deployed some other way, the
extra script is harmless.

---

## Stage 1a — Skill Flow refresh (`feat/5-skill-flow-visualization`, PR #8)

### The situation

PR #8 already implemented issue #5 (2026-02-24) but was never merged and
had gone stale: based on pre-2B.1 main, it also violated the parallel-
session file-ownership rules (added its own nav button to the term page
and its own `LoadingSkeleton`, both owned by #4/2B.1). `mergeable_state`
was unknown; in practice it conflicted on `LoadingSkeleton.tsx` and
double-added the Flow View nav button.

**Decision: refresh the existing PR rather than rebuild.** The core
implementation (data transform, grid, filters, summary) was sound and
review-shaped; throwing it away to re-derive ~90% of the same code would
be waste. Merged `origin/main` in (merge commit — no history rewrite on a
shared branch), resolved in favor of main's shared components, and merged
`fix/green-baseline` so the PR's CI can be green while PR #13 waits for
review. Recorded trade-off: PR #8's diff temporarily includes the
baseline fix; it disappears once #13 merges.

### Gap analysis vs issue #5 acceptance criteria (before this session)

Missing: column hover highlight; session/skill header navigation;
canceled-column dots dimmed/struck; rows grouped by category; and the
what-if overlay stretch goal. Beyond the checklist, the actual
principle-#5 visual ("skills are horizontal lines... when a session is
canceled, the lines break") wasn't there — the grid had dots but no
lines, so cancellation didn't visibly *break* anything.

### What I built

- **Skill thread lines** — per-row span from first to last coverage
  (`computeThreadSpan`, pure + tested), drawn as CSS half-borders through
  each cell; dashed red across canceled/simulated columns. This is the
  "broken line" from the design principles. *Alternative rejected:* SVG
  overlay — cleaner lines, but the phase constraint says HTML/CSS only,
  and an SVG positioned over a scrolling table is fragile.
- **Column hover** via `hoveredSessionId` state (row hover stays pure
  CSS). *Alternative rejected:* CSS-only `:has()` column highlight —
  supported in modern browsers but table-column `:has()` selectors get
  hairy with sticky headers; state is simpler to reason about.
- **Header links** to session/skill detail pages (those pages exist now
  — they didn't when PR #8 was written).
- **Category grouping** — rows sorted category-then-code with divider
  rows (per the issue's row-header spec).
- **What-if overlay (stretch goal)** — "Simulate cancellation" select on
  the flow page; maps API data to the domain `TermData` shape and calls
  `simulateCancellation` client-side. Simulated column gets dashed red
  borders, at-risk rows get a flag, summary bar shows health before/after
  and new violations. Read-only by construction (pure function, no API).
- **Type honesty fixes** exposed by main's evolved types (`Module.notes`,
  `FlowSessionInfo` vs raw `Session` grouping, `CoverageEntry` enrichment
  for `computeCoverageHealth`).

### Verification

- typecheck clean, `npm test` 68/68 (7 new flow tests), eslint clean on
  flow files (fixed one exhaustive-deps warning).
- `next build` — verified before push (see PR).

### Known-shaky / candid notes

- **Not visually eyeballed in a browser.** The auth proxy added by the
  OAuth PR gates every page and API route behind Google sign-in, which
  also silently broke the existing Playwright e2e suite (it seeds data
  through unauthenticated API calls). Structural/unit coverage is good,
  but CSS-level rendering (sticky headers + thread line alignment) is
  unverified. Flagged as a Stage 3 candidate: dev/test auth bypass +
  e2e repair — without it, *no* UI work on this app can be honestly
  verified end-to-end.
- Hover-column state updates re-render the full grid (~2400 cells at
  DS-100 scale). React reconciliation should absorb it; if not,
  memoizing rows on `hoveredSessionId` transitions is the fix. Chose not
  to pre-optimize.
