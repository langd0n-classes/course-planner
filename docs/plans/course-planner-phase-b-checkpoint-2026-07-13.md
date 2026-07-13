# Course Planner Phase B Checkpoint — 2026-07-13

## Gate outcome

**Phase B is rejected as a completed product phase.** The three lanes are useful,
validated components, but they do not yet form an end-to-end instructor workflow.
Draft PRs #26, #27, and #28 remain unmerged.

The combined integration branch applies both redesign migrations from empty,
seeds successfully, passes typecheck, passes 104 tests, passes changed-surface
lint, and builds for production. The failed gate is therefore about product and
domain completeness, not compilation quality.

## Review lenses

- Coordinator/Mimir architecture teardown
- Product and UX teardown against the accepted Chunk 7 workflow
- Academic-practice review using Collegium and Pantheon material as lenses
- Clean three-lane integration and container validation

Both independent reviews rejected the merge gate. The findings below retain only
issues supported by the implementation or accepted design; speculative features
are separated into later opportunities.

## Phase B.1 recovery-gate outcome

**Accepted by the operator on 2026-07-13 with the recommended defaults.** The
recovery slice now forms a real Course-to-Term planning seam: canonical handlers
enforce ownership, Term creation previews before applying calendar materialization,
clone choices preserve planned/delivered history, archive/package boundaries retain
evidence, and the cockpit exposes actionable planning and live-course states.

The acceptance followed two explicit independent lenses:

- product/UX review accepted the corrected workflow with no blocking findings;
- academic-practice review closed its final blocker after baseline calendar rows
  were kept compact while genuine capacity advisories retained their supporting
  evidence.

Final verification on the combined integration branch:

- clean migrations and exemplar seed passed in the stable Node/Postgres containers;
- all 137 tests passed;
- TypeScript typecheck and changed-surface lint passed; and
- the containerized production build passed.

The accepted integration lineage promotes to `redesign`. It does **not** cut over
`main`; that remains the single reviewed action after Chunk 10 verification.

## Corrections already made

- Term lifecycle transitions now use an atomic expected-status update predicate.
- Artifact DTOs expose generator provenance and metadata required by the accepted
  schema and package graph.
- ZIP inflation has an output cap in addition to entry-count, path, and total-size
  limits.
- User-facing prototype/lane/mock terminology and the raw demo instructor ID were
  removed.
- Term creation no longer defaults every instructor to Tuesday/Thursday; meeting
  days require an explicit choice.

## Phase B.1 recovery slice — completed

### 1. Complete the real vertical seam

- Implement the remaining Institution, Academic Calendar, Course, Learning Module,
  Topic, version, prerequisite, and Course-Institution handlers.
- Replace the direct mock import with a real HTTP adapter; keep the mock only as an
  explicit test/story provider behind the same interface.
- Add authenticated ownership checks end to end.
- Add manual, non-AI Course, Learning Module, and Topic creation flows plus offering
  adoption/reordering and unattached-Session recovery.

### 2. Make the calendar the scheduling container

- Make Term creation a preview/apply command that combines the selected Academic
  Calendar, Instructor overrides, and one or more meeting roles/patterns.
- Materialize CalendarSlots only on apply, with provenance and unresolved-date
  warnings visible before confirmation.
- Validate date ordering and calendar fit.
- Require Sessions to use a materialized class-day slot unless the Instructor makes
  a labeled override.

### 3. Correct clone semantics

- A cloned planned Term must never inherit a non-null delivered pointer.
- When the source planned and delivered versions differ, preview a per-Learning-
  Module choice. Recommended default: use the delivered version as the new planned
  pin, while allowing the Instructor to choose the prior planned version.
- Map Sessions by meeting role plus ordinal, not one undifferentiated class-day list.
- Preserve unresolved-date reporting for shorter Terms, holidays, and breaks.

### 4. Preserve historical evidence

- Ordinary Artifact removal archives.
- Hard removal remains a separate guarded command with impact preview and audit
  evidence; it must not cross a published or delivered historical boundary.
- Artifact mutation through Session or Assessment parents must respect closed-Term
  read-only behavior.
- A package called lossless must include uploaded/generated payloads through a
  bounded payload-resolver interface, or be renamed to disclose that it preserves
  metadata and durable URIs only.

### 5. Build the first real daily-driver cockpit

- Make Plan versus Run context explicit without hiding the relationship between
  them.
- Show the actual Session/calendar timeline, cancellations, recovery state,
  instructional capacity/mode, assessments, and actionable gaps—not only counts.
- Stage delivered changes through a diff/what-if preview before committing an
  immutable revision.
- Add inline validation and recoverable error states for Term creation and live
  mutations.

### 6. Run the UX spike at the correct seam

Run a coded, high-fidelity interactive spike during B.1, once the real adapter and
calendar preview exist. Focus on Course bootstrap and the active-Term cockpit with
realistic scale, keyboard use, mobile layout, loading/error states, and concurrency
conflicts. Agents can generate the alternatives; operator involvement is only
needed to select vocabulary and safety defaults after seeing working options.

## Post-B.1 product branches

These should inform the roadmap but must not expand the recovery slice:

- **Semester operations:** recovery playbooks, grading/feedback cadence,
  accommodation exceptions, staff coordination, and draft student communications.
- **Provenance ledger:** one view of planned pins, delivered revisions, assessments,
  communications, imports, and export hashes.
- **Recovery planner:** multi-session snow-week, short-week, holiday-adjacent, and
  post-break reacclimation scenarios.
- **Materials hub:** Artifact-centered preparation and reuse across Topics,
  Sessions, and Assessments.

Recommended first operational addition after B.1 is a linked action/communication
record that can capture a proposed change, audience, owner, due time, approval, and
outcome without sending anything automatically.

## Collegium/Pantheon product boundary

The academic layer should provide advisory judgment: prerequisite sequencing,
learning-objective drift, assessment authenticity, recovery alternatives,
term-over-term warrants, and export-readiness checks. It should produce explicit
recommendations or commissions with evidence and uncertainty.

It must not silently replan, mutate curriculum, send communications, grade work,
or decide accommodations. Instructor approval remains the mutation boundary.

## Operator decisions for Gate B recovery — accepted

1. **Clone source:** per-Learning-Module planned/delivered choice, defaulting to the
   prior delivered version as the new planned pin.
2. **Calendar creation:** mandatory preview followed by materialization on apply;
   no silent slot creation with the Term record.
3. **First operations object:** a generic linked action/communication record after
   B.1, before specialized grading, accommodation, staff, or messaging models.

## Model-routing experiment notes

- Three Sonnet workers reached the account monthly spend limit at final response;
  two nevertheless left valuable partial edits. The launcher correctly surfaced
  failure but spend availability must be checked before fan-out.
- The user-systemd launcher path reported success while its scopes died immediately.
  Forcing the documented fallback inside persistent tmux produced durable workers
  and watchers.
- `gpt-5.4` completed all three implementation continuations, but broad lane prompts
  consumed roughly 206k–287k tokens each. The two read-only reviews consumed roughly
  179k and 208k tokens. These were capable but not cheap passes.
- Future review prompts should receive a coordinator-produced evidence bundle and a
  narrower file manifest instead of being asked to rediscover the entire design.
- `gpt-5.4-mini` remains appropriate for mechanical, file-bounded checks; prior broad
  contract attempts showed that choosing the cheaper model for an unbounded task can
  cost more than choosing the right model once.
- Explicit model selection is required when launching Codex workers: the launcher
  currently defaults internally to `gpt-5.4`, even where older guidance suggests a
  mini default.
- A bounded mini implementation pass still consumed roughly 212k tokens and needed
  coordinator correction for domain semantics. The narrow final review passes were
  substantially cheaper (roughly 25k–41k) once given exact files, invariants, and
  acceptance assertions.
- The coordinator must continue to inspect domain meaning, not merely green tests.
  In this gate that review caught the difference between scheduling-source evidence
  and capacity provenance, plus the fact that baseline rows can have non-null
  capacity reasons without being advisories.
