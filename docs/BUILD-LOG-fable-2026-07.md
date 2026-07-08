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
