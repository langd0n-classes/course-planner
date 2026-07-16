# Course Planner B.3 operator checkpoint

Date: 2026-07-15

Status: accepted by the operator 2026-07-15; `redesign-b3-integration` promoted
to `redesign`, B.4 (#34) authorized.

## Outcome

B.3 implements the activity-first curriculum graph, Term Activity adoption and
delivery, versioned calendar correction, and the provenance-bearing exemplar
importer on top of the accepted B.2R contract. The work landed as small,
independently reviewed packets on the `redesign-b3-integration` branch (tip
`49bfd04`), each scope-verified against the frozen contract and validated by a
definitive Node 22 container gate. The implementation deliberately stays at the
domain-service, REST, typed-client, and invariant-test layer: it does not build
the production Course studio or active-Term daily driver, which remain B.4.

## Decision requested

Accept the `redesign-b3-integration` branch as the B.3 implementation of the
B.2R contract, authorize promoting it toward `redesign`, and unblock B.4
(issue #34). Concretely, confirm that:

- a Course owns reusable Activity identities and immutable Activity versions,
  with Activity Type vocabulary, Learning Module membership, and Topic
  actions/scope implemented as accepted;
- Term adoption pins adopted Activity and Activity Type versions and labels,
  and delivery corrections create immutable Term Activity revisions that never
  mutate the reusable Course design;
- an Institution owns versioned calendar structure while a Term materializes it,
  applies a meeting pattern, and owns offering-only exceptions, with finals and
  special periods kept explicit and deterministic preview/apply;
- the exemplar importer is one-way, provenance-bearing, grading-excluded, and
  idempotent, and backs a generic demo seed through a single code path; and
- the three open design notes below are either accepted as-is or flagged for a
  small follow-up before promotion.

## Packet coverage

All packets are children of B.3 (#33). Each was implemented by a headless build
worker, coordinator-reviewed, scope-verified (no frozen contract or Zod-schema
edits outside the freeze packets), and merged with attribution.

- **B.3.1a — TypeScript contract freeze (#35):** the frozen Activity and
  calendar TypeScript contract and deterministic fixtures.
- **B.3.1b — runtime validation freeze (#36):** the Zod runtime contract,
  fixture-validation, and model-routing record.
- **B.3.2a/b — Activity Type vocabulary:** services and typed client
  (`5f9364a`, `ed2a3bc`).
- **B.3.2c — Course Activity identity and version services (#43):** create/
  list/get/update/archive identity plus immutable versions with CAS.
- **B.3.2 typed client (#45):** the Course Activity typed client (`0b7760b`).
- **B.3.2d — Learning Module Activity membership and Topic relationships (#44):**
  ordered LM-version membership through the LM-version upsert path, plus Activity
  LM scope, Topic actions with sibling cross-linking, and Topic scope.
- **B.3.2f — Course Activity routes (#46):** canonical identity/version/get/
  publish REST over the accepted service.
- **B.3.3 — Term Activity adoption and delivery (#38):** adoption preview/apply
  with version pinning, immutable delivered revisions via CAS, milestones with
  exact-time preservation and anchor policies, planned-versus-delivered diff, and
  lifecycle/closeout promotion.
- **B.3.4 — versioned calendar correction (#39):** versioned Academic Calendar,
  Term meeting patterns and offering-only exceptions, and deterministic
  preview/apply materialization with provenance and conflict reporting; the
  canonical path does not consume `InstructorCalendarOverride`.
- **B.3.5 — provenance-bearing exemplar importer (#40):** one-way stage/preview/
  apply with per-entity provenance, ambiguity reporting, grading-exclusion,
  idempotence, and an importer-backed generic demo seed.

## Open design notes

None block acceptance; each is a small confirmation for the operator.

1. **Term Activity route names (#38).** The worker implemented the canonical
   frozen contract routes (`terms/[id]/adoption-preview` and `-apply`,
   `term-activities/[id]/revision-preview` and `-apply`) rather than the
   LM-style names suggested in its prompt. This was a correct deferral to the
   frozen contract; confirm the naming as canonical.
2. **Calendar collection routes (#39).** The frozen contract exposes calendar
   version list/create and version-detail reads but no standalone event/period
   collection response types, so events and periods are created through the
   version rather than through separate collection routes. Confirm that is the
   intended REST surface.
3. **Activity LM-scope route placement (#44).** LM scope is served under
   `activity-versions/[id]/lm-scope`, but `replaceActivityLmScopeSchema` is keyed
   by `learningModuleId` and `emphasis` with no version dimension. Confirm
   whether LM scope should be identity-scoped (`activities/[id]`) instead; if so
   it is a small follow-up packet.

## Validation

Definitive Node 22 (`node:22-bookworm`) Podman container gate on the merged
`redesign-b3-integration` tree (`49bfd04`), run because host Prisma segfaults:

- `prisma generate`: succeeded.
- `tsc --noEmit`: 0 errors (including the hand-resolved shared-file union merges
  between the Term-activity and calendar packets).
- Vitest suite: 51 files, 522 tests passed.
- `next build`: succeeded; the full route tree compiled.

Per-packet worker validation (host, mocked-DB unit tests) is recorded in the
integration comments on each issue. Scope was verified per packet: no packet
outside the freeze edited the frozen contract or Zod schemas.

## After acceptance

Issue #34 builds the B.4 Course design studio and active-Term daily driver on
these real handlers. Promotion merges `redesign-b3-integration` into `redesign`.
Neither should proceed merely because its issue and branch are visible; both
wait on this checkpoint.
