# Course/LM/Topic redesign — execution plan

Companion to `course-lm-topic-redesign-v2.md` (design) and its amendments.
This document is the **execution/orchestration** plan: how the ten design chunks
map to agents, branches, and phases, and where real parallelism exists.

Design source of truth: `course-lm-topic-redesign-v2.md`, with the newest
applicable amendment governing conflicts. In particular, §11 v2.3 supersedes
direct Topic-to-Learning-Module ownership.
Where design and execution disagree, the design doc governs *what* is built and
this doc governs *how* it is built.

## Core constraint: the schema is a serial chokepoint

Chunks 1–2 and the schema slices of 3–5 all edit one `schema.prisma` and one
service layer. The versioning tables are meaningless without the identity tables,
and two agents on one schema file is a merge-conflict machine. **The foundation
cannot be parallelized.** It lands as one coherent step, and that step also
produces the frozen contract everything else builds against.

The "database may be wiped and reseeded, no migration path" framing (design §1,
§5 Chunk 1 acceptance) means the foundation agent builds the target schema clean
— no compatibility layer, no data preservation.

## Branch strategy

- Destructive rewrite → **do not build incrementally against `main`.** `main`
  stays coherent until the whole redesign lands.
- All work integrates into a shared **`redesign` integration branch** cut from
  `main`.
- Each lane runs on its own worktree/branch off `redesign` and merges back into
  `redesign` as it completes. **Work branches use a hyphen, not a slash, under
  `redesign`** (`redesign-lane-a-domain`, `redesign-lane-b-io`,
  `redesign-lane-c-ui`, and `redesign-phase-a-foundation`). A slash form like
  `redesign/lane-a` is impossible: git cannot hold both the branch `redesign`
  and a `redesign/*` ref (directory/file conflict in the ref namespace).
- `redesign` → `main` is a single reviewed cutover at the end (after Chunk 10
  verification passes).
- The current `explore/sol-course-redesign` branch holds the design docs only;
  it is not the build branch.

## Phases

### Phase A — Foundation + contract freeze (SERIAL, 1 agent)

Covers design Chunks 1–2 plus the schema portions of 3–5, and produces the
frozen interface the fan-out depends on.

Deliverables:

- Complete `schema.prisma` per design §2, **including v2.1 deltas** (§9.3):
  - `Topic.learningModuleId` nullable; relation optional.
  - `TermLearningModule.deliveredLearningModuleVersionId` nullable, compound FK.
- Migrations + seed + exemplar regeneration (design Chunk 1).
- Curriculum revision subsystem: identities, version tables, draft/publish/revise/
  current-version services, immutability enforcement (design Chunk 2).
- Generated Prisma types.
- **REST route + TypeScript contract stubs** for §6 canonical routes — the frozen
  interface. Handlers may be stubbed; the types and route shapes are fixed.
- Schema/service invariant tests (design §2 "Schema/service invariants") and
  allocator concurrency tests.

Exit gate (nothing forks until all true):

- Schema migrates clean; seed runs; exemplars regenerate.
- Revision immutability + short-ID allocator concurrency tests pass.
- REST contract types compile and are committed as the interface of record.
- The v2.1 planned/delivered dual pointer and nullable topic ownership exist in
  the schema and round-trip through seed.

#### Phase A.1 refreeze after Gate 0

Before Phase B fans out, the foundation also must satisfy the v2.2 amendment:

- seed uses the two-step Term then TermLearningModule write and passes;
- assessment type is generic instructor-authored data;
- Term lifecycle, advisory CalendarSlot capacity/provenance, and Session
  instructional mode round-trip through the seed;
- the frozen contract includes the complete Plan/Run collections and commands,
  including service-owned delivered revision creation;
- schema-incompatible legacy routes fail closed as typed 501 stubs or explicit
  410 retirements; and
- containerized migration, seed, typecheck, tests, lint, and build are green.

Phase B branches must start from the refrozen Phase A.1 commit, not the original
Phase A baseline.

### Phase B — Fan-out (PARALLEL, 2–3 agents against the frozen contract)

| Lane | Design chunks | Owns | Depends on |
|------|---------------|------|------------|
| **A — domain + REST** | 3, 4, 6 | Term offerings, Sessions, cloning, coverage, assessments, planning rules; fills in REST handlers behind the frozen contract | frozen schema |
| **B — import/export + material** | 5, 8 | archive/removal, Artifact/URI subsystem, `CoursePackageCodec`, course-planner lossless round-trip, Common Cartridge import, syllabus-import interfaces (Phase-9-ready stubs) | frozen schema + types |
| **C — workspace UI** | 7 | Course-first UI, Term creation w/ institution+calendar, revision history/compare, topic-first browser (v2.1 §9.1), planned/delivered active-term editing + warning banner (v2.1 §9.2) | frozen **contract** (builds against types while Lane A fills them) |

Lane C is unblocked by the contract freeze, not by Lane A completion — that is the
mechanism that makes 3-way parallelism real rather than theoretical.

v2.1-specific work, by lane:

- **Lane A:** planned vs delivered lane — advance `deliveredLearningModuleVersionId`
  on in-term edits (each edit = new immutable revision); planned-vs-delivered diff
  derived from `LearningModuleVersionTopic` snapshots (no new table).
- **Lane C:** topic-first course-scoped browser with Unassigned bucket + prereq
  editor on unassigned topics; empty-LM create/view; active-term "changing the
  delivered version" banner; historical terms open delivered snapshot read-only.

### Phase C — Blackboard (PARKED, externally blocked)

Design Chunk 9. Blocked on operator providing a **Blackboard Ultra SaaS** sandbox
(v2.1 §9.0 Q5). Compatibility pinned empirically via dated fixtures
(`blackboard-ultra-<date>`). Not on the critical path; do not gate the cutover on
it. Ships as a follow-on once sandbox access exists.

### Phase B.2R — activity and interaction refreeze (SERIAL CHECKPOINT)

The accepted B.1 integration and B.2 ledger spike exposed a domain mismatch that
invalidates part of the Phase A.1 frozen contract. Before additional application
implementation, run the bounded B.2R work defined in
`course-planner-b2-operator-feedback-2026-07-13.md`:

- map the allowed DS100 evidence into the proposed activity graph;
- propose the smallest versioned schema/REST correction;
- specify Institution-calendar inheritance, Term-only exceptions, and special
  periods;
- build a dense task prototype against a realistic fixture; and
- report which B.1/B.2 code survives, adapts, or retires.

This phase may delegate file inventories and prototype construction, but the
contract synthesis is serial and frontier-reviewed. It ends with operator
acceptance. Do not launch the B.3 implementation lanes before that gate.

After acceptance:

- **B.3** implements schema/domain/REST plus the one-way DS100 importer.
- **B.4** builds the Course design studio and active-Term daily driver on real
  handlers.
- **Phase D** performs integration, verification, and the reviewed `main` cutover.

### Phase D — Integration + verification (SERIAL, closing pass)

Design Chunk 10. Merge lanes into `redesign`, reconcile, run full suite (unit,
route, type, lint, build, seeded E2E, package validation). Docs rewrite + version
index. Then the single reviewed `redesign` → `main` cutover.

## Parallel width, honestly

One unavoidable serial bottleneck (Phase A) → genuine 3-way fan-out (Phase B) →
serial merge/verify (Phase D). Blackboard is parallel-or-deferred throughout.
Realistic max concurrency: **3 agents**, and only after the contract freezes.

## Execution vehicle

Background Codex agents via `launch_codex_bg.sh` (the vehicle that produced this
redesign). Phase A is one agent; Phase B is a batch of 2–3, each on its own
worktree off `redesign`. Capture each `RUN_LOG=` line for monitoring.

## Open orchestration decisions

- Lane count for Phase B: 3 lanes as tabled, or fold Lane B into A if agent
  bandwidth is tight (import/export is the most separable, so keep it split if
  running 3).
- Whether Lane C UI targets the frozen stub contract with a mock server, or waits
  for Lane A's first handler slice. Recommend mock-against-contract to preserve
  parallelism.
- Review cadence: per-lane PR into `redesign`, or continuous integration on
  `redesign` with review only at the `main` cutover.
