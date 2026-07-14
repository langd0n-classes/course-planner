# Course Planner B.2R migration impact and implementation cuts

Date: 2026-07-14

Status: accepted at the B.2R operator checkpoint on 2026-07-14

Inputs:

- `course-planner-b2r-ds100-evidence-map-2026-07-14.md`
- `course-planner-b2r-contract-proposal-2026-07-14.md`
- ADR-0002 and proposed ADR-0003
- read-only inventory of the accepted B.1 schema, services, routes, tests, and UI
- reviewed B.2R interaction prototype on `redesign-b2r-ux-prototype`

## Executive result

The B.1 vertical seam remains valuable, but its curriculum snapshot spine is
transitional. Authentication, ownership, lifecycle, calendar preview/apply,
artifacts, and typed HTTP patterns survive. Topic-to-LM snapshots, session-only
Coverage, and instructor-wide calendar overrides do not describe the accepted
product.

Use an additive strangler migration. Introduce the Activity graph and Term delivery
revision path beside the accepted B.1 tables, backfill with provenance, switch
read/write contracts after invariant tests pass, then retire old relationships.
Do not attempt a clever in-place rename: semantic migrations wearing fake mustaches
are still semantic migrations.

## Retain, adapt, retire

### Retain

| Surface | Why it survives |
|---|---|
| Auth.js single-account boundary and Instructor ownership checks | Accepted B.1 security seam; new entities use the same ownership chain. |
| Course, Term, Institution identity and lifecycle | Still the correct workspace hierarchy. |
| Topic identity/version and prerequisite acyclicity | Topics remain reusable planning atoms; only LM ownership changes. |
| Artifact provenance, durable URIs, lossless packages | Required by the importer and authoring roadmap. |
| Term lifecycle commands and closed/reopen guards | Delivery revisions strengthen rather than replace them. |
| Calendar preview/apply command shape | Correct what-if boundary; its source semantics change. |
| Typed API client, Zod validation, ownership service patterns | Required implementation conventions. |
| Archive/hard-remove guards | Historical references increase under the new graph. |
| 410 handling for genuinely retired legacy Module/Skill routes | Those contracts do not return under a new name. |

### Adapt

| Current surface | Target adaptation |
|---|---|
| `LearningModuleVersion` and `TermLearningModule` | LM versions order Activity versions. `TermLearningModule` remains the primary placement/adoption seam while delivered LM snapshot pointers phase out. |
| `LearningModuleVersionTopic` | Replace with `LearningModuleVersionActivity`; use old rows only as migration evidence, never as inferred I/P/A. |
| `Topic.learningModuleId` and Topic create/update DTOs | Remove primary ownership. Optionally use the old value to suggest an LM scope during migration, with explicit provenance and review. |
| `Session` | Backfill meeting Activity identity/version, `TermActivity`, and meeting delivery detail. Preserve calendar slot, ordinal, status, prior art, modality, and override evidence. |
| `Assessment` | Backfill assessment Activity identity/version and Term adoption. Convert due dates to milestones; preserve optional Session links as contextual Activity links. |
| `Coverage` | Convert session Coverage to Activity/Term-revision Topic actions. Preserve redistribution provenance as delivery history. |
| `AssessmentTopic` | Convert to Topic actions on the assessment Activity. Do not keep a second assessment-only Topic graph. |
| revision/offering/clone services | Shift from LM Topic snapshots to Course Activity pins and Term delivery revisions. Clone offers planned or delivered source explicitly. |
| planning service and gap reports | Traverse Term Activities and revision Topic actions; keep gaps and duplicate I/P/A as first-class signals. |
| calendar materialization service | Pin an Academic Calendar version, understand periods/special schedules, apply only Term exceptions, and materialize containers without content. |
| Course/Term workspace shells | Reuse dense styling and real adapter patterns; replace Topic-to-LM information architecture with Activity board/flow and daily-driver hierarchy. |
| DS100 seed | Become a sanitized one-way importer fixture with exact import provenance, not hand-maintained product content. |

### Retire or quarantine

| Surface | Disposition |
|---|---|
| Direct Topic-to-LM ownership | Remove after backfill validation. It conflicts with ADR-0002. |
| `LearningModuleVersionTopic` as a runtime source | Stop reads/writes after cutover; later drop in the cleanup migration. |
| Session-only `Coverage` and separate `AssessmentTopic` | Stop writes after Activity Topic actions are authoritative; retain compatibility reads only during migration. |
| `InstructorCalendarOverride` launch UI/routes/materialization | Remove from launch. Retain source rows temporarily for audit; never silently promote to Institution facts. |
| planned/delivered LM Topic-diff UI | Replace with Activity plan-versus-delivery diff. Historical compatibility can render a read-only legacy summary. |
| B.2 Topic-led LM ledger information architecture | Keep visual tokens/components where useful; retire the task hierarchy. |
| bare legacy `/api/sessions`, `/api/coverages`, `/api/assessments` collections | Keep 410. New canonical routes are Course/Term/Activity scoped. |

## Backfill rules

Every generated record stores migration/import provenance. Ambiguous mappings create
warnings and review tasks rather than guessed facts.

1. Create default Instructor Activity Types for each distinct existing displayed
   type, mapping to `meeting`, `coursework`, or `assessment`. Preserve the label and
   source value. A behavior-family ambiguity blocks only that row's apply.
2. For each Course-level reusable Session/Assessment source that can be matched,
   create an Activity identity and draft/published version. If no reusable identity
   is defensible, create a Term-only adopted Activity with provenance and flag it for
   closeout promotion review.
3. Convert Session occurrences into Term Activities and initial immutable delivery
   revisions. A canceled Session remains present with canceled delivery state.
4. Convert Assessment due dates and project evidence into milestone occurrences.
   Preserve exact time and timezone when known; absence of time remains explicit.
5. Convert Coverage and AssessmentTopic rows into Topic actions on the corresponding
   Activity versions/revisions. Repeated Topic/action occurrences are retained and
   warning-linked.
6. Convert LM version membership only when an Activity match is supported. Old
   Topic membership may suggest scope but never generates an I/P/A action.
7. Pin each Term to its Academic Calendar version. Materialize existing slots with
   source provenance. Stage potentially relevant Instructor overrides as candidate
   Term exceptions only when a specific Term/date match exists and require review.
8. Verify planned-versus-delivered counts, orphan/gap reports, calendar slots,
   artifacts, and ownership before enabling new writes.

## Migration phases

### M1 — additive contract and schema

- Add Activity Type identity/version, Activity identity/version/subtypes, LM
  Activity membership, Topic actions/scope, milestone templates, Term Activity,
  delivery revisions/subtypes, Term milestones, Academic Calendar versions/periods,
  and Term exceptions.
- Add contract DTOs/schemas and freeze invariant tests first.
- Do not remove or rename accepted B.1 fields in this migration.

### M2 — deterministic backfill and dual validation

- Implement idempotent backfill/import commands with dry-run reports.
- Seed through the same importer path used by the sanitized DS100 demo.
- Compare legacy and new counts/relationships, allowing documented semantic
  differences such as repeated I/P/A warnings.
- Keep legacy writes authoritative until the backfill report passes.

### M3 — canonical services and routes

- Switch Course design, Term adoption, delivery revision, milestone, calendar, and
  clone commands to the new contract.
- Keep compatibility readers narrow and read-only.
- Stop writes to Topic-LM, Coverage, AssessmentTopic, delivered LM snapshot, and
  Instructor override paths.

### M4 — product cutover and cleanup

- Put B.4 workspace routes on real handlers.
- Run seeded browser tasks, full unit/route suite, clean migration/seed, package
  validation, and Node 22 Podman production build.
- Only then drop retired tables/columns or leave a named compatibility migration
  when historical package import still needs them.

## Test impact

### Preserve and extend

- ownership rejection across Instructor/Course/Term boundaries;
- draft/publish/revise/current-version immutability;
- Topic prerequisite cycles;
- artifact/package provenance and URI durability;
- Term lifecycle and reopen behavior;
- calendar preview/apply determinism;
- clone planned-versus-delivered choice; and
- real HTTP adapter and authenticated UI tests.

### Replace assertions

- LM version tests assert ordered Activity-version membership, not Topic snapshots;
- planned/delivered tests compare Activity pins and delivery revisions;
- gap tests traverse Activity Topic actions;
- assessment tests use assessment Activities and milestones;
- cancellation/redistribution tests preserve delivery revisions rather than
  mutating Coverage rows; and
- calendar tests use Institution versions + Term exceptions, never Instructor
  override precedence.

### Add acceptance coverage

- custom label versus behavior family and immutable historical label;
- one primary LM placement plus independent scope;
- repeated I/P/A warning with navigable sibling links;
- cross-cutting project with meeting-linked and exact-time milestones;
- Fall Thanksgiving and Spring recess/finals fixtures;
- Term-only cancel/add/replace/modify exceptions;
- stale preview/revision conflict rejection;
- selective delivery-to-Course promotion at closeout; and
- one-way importer idempotence, provenance, ambiguity review, and grading exclusion.

## Small implementation packets

The user asked for more prompts with smaller owned work, not artificial turn caps.
The contract remains serial; after it freezes, B.3 and B.4 use bounded packets with
explicit ownership and integration after each group.

### B.3 — schema, domain, REST, importer

1. **B.3.1 contract/schema root:** DTOs, Zod, Prisma additions, migrations, invariant
   tests. No service/UI work.
2. **B.3.2 Course Activity design:** Activity Types, Activity versions/subtypes, LM
   membership, Topic action/scope services and focused routes.
3. **B.3.3 Term adoption/delivery:** Term Activity adoption, immutable revisions,
   milestones, clone/closeout promotion services and routes.
4. **B.3.4 calendar correction:** Academic Calendar versions/periods, Term meeting
   patterns/exceptions, materialization, and seasonal fixtures.
5. **B.3.5 importer/demo:** grading-excluded one-way DS100 parser, provenance/report,
   sanitized committed demo snapshot, and idempotence tests.
6. **B.3 integration gate:** reconcile only after packet tests; run clean migration,
   importer/seed, full suite, type/lint, package validation, and Podman build.

B.3.2–B.3.5 may overlap only after B.3.1 freezes. Each prompt owns a short file
manifest. Mechanical fixtures/scaffolds use low-cost models; service work uses a
capable mid-tier model; frontier review is reserved for contract/integration drift.

### B.4 — Course studio and Term daily driver

1. **B.4.1 Course shell and vocabulary:** direct-after-create navigation, compact
   Topic/type editors, keyboard suggestion acceptance, actionable empty states.
2. **B.4.2 Activity board and Topic flow:** LM/unassigned columns, drag/drop and
   keyboard equivalents, inline I/P/A, duplicate navigation, realistic scale.
3. **B.4.3 Term/calendar setup:** Institution calendar selection, periods/finals,
   role patterns, preview/apply, Term exceptions, planning gaps.
4. **B.4.4 Run viewport and correction:** next meeting/event/prep/current LM/ordinal/
   Topics above the fold; inline delivery revision and impact preview.
5. **B.4.5 interaction hardening:** accessibility, density, responsive behavior,
   browser tasks, DS100 fixture E2E, and misleading-affordance cleanup.
6. **B.4 integration gate:** representative Plan and Run tasks on real handlers,
   full validation, product/UX review, and academic-practice review.

UI packets use a strong frontend-capable model with exact task recordings and the
accepted coded prototype as prior art. They do not rediscover the repository or
redesign the frozen graph.

## Gate boundary

No B.3 implementation packet starts until the operator accepts B.2R's graph,
calendar semantics, vocabulary, and task hierarchy. The build prompts may exist on
open issues before acceptance, but remain explicitly blocked by the B.2R gate.
