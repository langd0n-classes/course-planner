# Course Planner B.2R operator checkpoint

Date: 2026-07-14

Status: ready for operator review; B.3 and B.4 are not launched

## Outcome

B.2R has refrozen the redesign around an activity-first curriculum graph and an
Institution-derived Term calendar. The evidence, contract, migration plan, and
dense coded prototype are complete enough for an operator decision. The proposed
contract deliberately keeps the correction additive and staged: it does not ask
the operator to accept a broad rewrite or a production UI at this checkpoint.

## Decision requested

Accept the following as the implementation boundary for B.3 and B.4:

- a Course owns reusable Activity identities and immutable Activity versions;
- a Learning Module version orders Activity versions, while Topics attach to
  Activity versions with Introduce, Practice, or Assess actions;
- a Term pins the adopted Activity and Activity Type versions and labels;
- delivery corrections create immutable Term Activity revisions and never
  silently mutate the reusable Course design;
- meetings, coursework, and assessments share a planning identity but retain
  subtype-specific details and lifecycles;
- projects may remain cross-cutting and use milestones that follow an Activity,
  occur at an exact instant, or stand alone;
- an Institution owns versioned calendar structure, while a Term materializes it,
  applies its meeting pattern, and owns offering-only exceptions; and
- finals and other special periods remain explicit calendar periods rather than
  being forced into ordinary teaching weeks.

The accepted interaction hierarchy is Course design first, then Term planning,
then the active-Term Run daily driver. The design board moves Activity cards among
Learning Modules; Topic flow is edited on those Activities rather than by placing
Topic cards directly into modules.

## Review evidence

The checkpoint is backed by these records:

- `course-planner-b2r-ds100-evidence-map-2026-07-14.md` — current and historical
  DS100 evidence, with all grading material excluded;
- `course-planner-b2r-contract-proposal-2026-07-14.md` — proposed versioned domain,
  REST, calendar, and correction semantics;
- `../decisions/0003-pin-course-design-and-revise-term-delivery.md` — the architectural
  decision and its rejected alternatives;
- `course-planner-b2r-migration-impact-2026-07-14.md` — retain/adapt/retire
  inventory, additive migration sequence, and small implementation packets;
- the `redesign-b2r-ux-prototype` branch at commit `011b1e4` — the dense coded
  Course design and active-Term task prototype, with a successful Vercel deployment
  at <https://vercel.com/langdon-whites-projects/course-planner/B9BuvhenLKXfr1XwvShiWPWzpKVr>;
  and
- GitHub issues #33 and #34 — published B.3 and B.4 build prompts, explicitly
  blocked on this gate.

## Task-level acceptance coverage

1. Course creation routes into the Course workspace, covered by the Course index
   component test.
2. The browser gate opens the DS100-scale Topic editor, confirms approximately
   150 Topics, exercises inline title/code editing, and verifies keyboard focus
   behavior for the suggested Topic code.
3. The browser gate creates an instructor-labeled Activity Type and selects its
   stable behavior family.
4. The browser gate drags a cross-cutting project into a Learning Module, then
   moves it back through the keyboard-operable move dialog.
5. Focused component tests cover repeated I/P/A warnings and navigation to the
   other occurrence.
6. Browser and component coverage create project milestones and preserve the exact
   due date and time.
7. The browser gate inspects inherited calendar events and finals, then adds a
   Term-only exception.
8. The Run viewport browser gate verifies the next meeting, preparation work,
   current module, Topic coverage, planned/delivered change signal, and a usable
   430-pixel-wide layout.

## Validation

- Vitest suite: 31 files, 201 tests passed.
- Browser task suite: 3 Playwright tests passed, including drag/drop, keyboard
  relocation, calendar inheritance, exact milestone timing, and narrow viewport.
- TypeScript typecheck: passed.
- Lint for the changed prototype and browser-gate files: passed.
- Production build: passed in an isolated Node 22 Podman container; all 21 pages
  were generated.
- Visual review found and corrected a narrow-viewport horizontal offset before the
  browser gate was finalized.

The package audit still reports the dependency findings tracked in GitHub issue
#23. They predate and are independent of this semantic checkpoint, so they do not
block B.2R acceptance.

## After acceptance

Issue #33 starts B.3 as small schema, service, REST, importer, and invariant-test
packets. After B.3 passes its own checkpoint, issue #34 builds the Course design
studio and active-Term daily driver on real handlers. Neither prompt should be
fired merely because its issue and branch are visible.
