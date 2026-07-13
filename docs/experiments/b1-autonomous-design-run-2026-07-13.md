# B.1 Cockpit — Autonomous Design Experiment Note
**Date:** 2026-07-13  
**Scope:** Phase B.1 vertical-slice recovery (mock → real HTTP client, term preview/apply flow, loading/error/empty states)

---

## What the run did

Replaced the mock-backend import in `redesign-api-client.ts` with a typed real HTTP client. Converted `CreateTermPanel` from a single-submit form to a preview → apply two-step flow using the same `POST /api/terms` route with a `mode` discriminant. Updated `CourseIndexPage`, `CourseWorkspacePage`, and `TermWorkspacePage` with skeleton loading, structured error states, empty state messages, and truthful status-aware copy. Added three additive canonical read routes (`/api/courses/[id]/topic-prerequisites`, `/api/instructors/me`, `/api/topic-versions/[id]`) that the real UI needed but the mock had concealed. Wired mock injection through a Proxy rather than per-method `withMock` wrapping.

---

## Decisions

**Preview → apply via `mode` discriminant on a single POST.** The contract already had `CreateTermPreviewResponse` and `CreateTermApplyResponse` as distinct types. Routing both through one endpoint with `mode: "preview" | "apply"` avoided a separate GET preview route with query-param state. Downside: the single endpoint now returns two different shapes, which tests must account for.

**Proxy-based mock injection instead of per-method wrappers.** The original design called `withMock(key, realFn)` on every method. A `Proxy` on `_api` achieves the same per-method override with zero per-method boilerplate and keeps the code visually similar to the plain object. The cost is a small runtime indirection that only matters in tests.

**`CalendarRow` union simplified to a single shape.** The type originally included a `{ kind: "gap"; date: string }` variant for future interleaved gap rows. Since `buildCalendarRows` never produced gap rows and the JSX destructured `{ slot, session }` directly, the union caused a TypeScript error at the call site. The gap variant was removed; if gap rows are added later the type can be reintroduced with a type-narrowing map.

**Authenticated identity is resolved by the client without weakening mutation checks.** The UI reads `/api/instructors/me` and supplies that identifier to the frozen create contracts. Routes still reject mismatched Course, Learning Module, and Topic creator identifiers, preserving the explicit cross-instructor boundary.

---

## Surprises

**`withMock` was dead code from day one.** It was defined in the mock-injection section but never called — the Proxy at the bottom of the file replaced its role. This happened because the Proxy approach was written after the helper, and the helper was never deleted. The Proxy is simpler and correct; the helper was noise.

**`sessionsByDate` was computed in two places.** The function `buildCalendarRows` correctly builds its own local `sessionsByDate` map. The render body had a second `sessionsByDate` declaration that was never read — likely a copy-paste residue from an earlier draft of the calendar timeline section.

**`CalendarRow | { kind: "gap" }` caused a subtle JSX destructuring error.** TypeScript correctly rejected `calendarRows.map(({ slot, session }) => ...)` when `CalendarRow` was a discriminated union that included the gap variant (which has neither `slot` nor `session`). The error would only surface under `--noEmit`; the JSX rendered fine in the browser because the runtime values were always slot-shaped. Lesson: discriminated union variants must be either fully narrowed at each call site or limited to types that are actually produced.

**Mock injection via Proxy is transparent to TypeScript but opaque to tree-shaking.** The Proxy wraps `_api` so that test overrides work per-method. But bundlers cannot statically analyze Proxy traps, which means all `_api` methods are retained even in a production bundle that never calls `setMockBackend`. For a client bundle where tree-shaking matters this would be worth addressing; for a Next.js server-components-heavy app the impact is minimal.

---

## Evaluation points

- The two-step preview/apply UX for term creation is significantly better than a single blind POST. Users can confirm the calendar candidate count and see conflicts before committing.
- Skeleton loading states (`animate-pulse` placeholders sized to content) are much more honest than single-line "Loading..." text. They set correct layout expectations and reduce layout shift on load.
- The `GapNotice` component is a reusable pattern for surfacing actionable empty states. Used for: no terms, no adopted learning modules, planning gaps. Worth documenting as a design system atom.
- The `LifecycleBadge` and color-coded stat tiles (amber for warnings, rose for errors) carry enough status signal without adding icons or extra text.

---

## Reusable lessons

1. **Mock injection belongs in one place.** A single Proxy gate or a single `setMockBackend` setter is cleaner than per-method wrapper calls. Define the pattern once and rely on it in tests.

2. **Preview/apply is the right default for operations with external calendar side-effects.** Any flow that materializes calendar slots, sends notifications, or allocates infrastructure should show a dry-run before committing. The `mode` discriminant on a shared POST endpoint is a clean way to implement this without a separate route.

3. **Discriminated union types must be fully used or fully simplified.** A union variant that is never produced is not documentation — it is a type hazard. Delete it until it is needed.

4. **Hide creator-ID plumbing in the shared client, but verify it at the route.** UI components should not manage instructor identifiers. The shared client resolves the authenticated instructor and fills the frozen request field; mutation routes still reject mismatches as defense in depth.

5. **Status-aware copy in workspace headers eliminates the need for tooltips.** "Planned terms have no delivered divergence yet" and "Closed terms show the delivered snapshot read-only" tell users what they can and cannot do without a modal or tooltip. Write copy for each lifecycle state at the point where the state matters, not in a separate help section.
