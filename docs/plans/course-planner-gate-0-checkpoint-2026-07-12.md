# Course Planner redesign — Gate 0 checkpoint

Date: 2026-07-12

Status: planning complete; no implementation launched

## Executive recommendation

Course Planner should continue as one persistent instructor workspace across
**Plan → Run → Review → revise**, supporting a course created from scratch,
imported or inherited, and adapted while it is being taught. GenAI in the
course remains optional and separate from AI that helps the instructor operate
the product.

Do not start the three Phase B implementation lanes yet. Close a short
**Phase A.1 / refreeze checkpoint** first:

1. Take the pragmatic seed fix (Path A: connect/two-step creation), then run the
   full containerized validation loop.
2. Determine whether old-model handlers are intentional compatibility code or
   type-invalid leftovers; migrate or explicitly quarantine them.
3. Remove the course-specific `gaie` assessment enum from the generic contract.
4. Decide the minimum academic-operations additions that must enter the schema
   before it freezes again: instructional-capacity annotations and explicit
   recovery/buffer intent are the strongest candidates.
5. Reconcile the redesign documentation and branch bases, then review and merge
   PR #19 into `redesign`.

This briefly reopens the freeze, but only once. Pretending it remains frozen
while immediately adding academic-operational fields in a parallel lane would
turn the schema chokepoint into a merge-conflict generator with better branding.

## What Gate 0 established

### Current implementation state (observed)

- Phase A contains the redesigned Prisma schema, immutable curriculum revision
  services, frozen TypeScript/REST contract, and canonical 501 route stubs.
- The migration has been reported green and 81 unit tests pass, but the seed
  fails at the nested `Term.learningModules` create because of compound
  relation ambiguity.
- Sixteen of forty API route files are explicit redesign stubs. Several other
  routes still use the old `Module`/`Skill` model, including term read/clone and
  session cancel paths.
- Both Playwright suites exercise the legacy payloads and navigation, so they
  are not redesign E2E evidence.
- `feat/6-external-exports` is an old-model side branch; its ideas may be reused,
  but its implementation cannot simply be merged into the redesign.
- The foundation worktree is behind the integration branch's operating and
  design documents. Root roadmap, architecture, assumptions, and design
  principles also still describe the old vocabulary.
- Blackboard remains externally blocked on a real Ultra SaaS sandbox and does
  not belong on the critical path.

### Product lifecycle (inferred and proposed)

- **Plan:** course/Learning Module/Topic authoring, term creation, calendar
  selection, cloning/importing/inheriting, and immutable curriculum revisions.
- **Run:** a daily-driver view, calendar and materials, gap detection,
  planned-vs-delivered state, and preview-before-commit adaptation to
  cancellations and changes.
- **Review:** an explicit term-close workflow that turns planned-vs-delivered
  differences into a usable retrospective.
- **Revise:** feed that retrospective directly into the next term rather than
  leaving delivered-state history as dead data.

The redesign covers Plan and Run increasingly well. Review and the feedback
loop into the next Plan are the major product omissions.

### Academic-practice lens (observed, inferred, and proposed)

The calendar currently distinguishes whether class meets, but not whether a
meeting is instructionally equivalent to an ordinary class day. That misses:

- reduced usefulness immediately before a break;
- retrieval/recovery immediately after a break;
- deliberate buffer/flex days versus accidental gaps;
- assessment-proximity pressure and stacked disruptions;
- the difference between content delivered and content students experienced.

Recommended model boundary:

- Keep `SlotType` as the hard meets/does-not-meet fact.
- Persist an advisory capacity annotation alongside the slot, derived by
  configurable calendar-adjacency policy and overridable by the instructor.
- Persist recovery/buffer intent because redistribution and gap analysis need
  to distinguish those sessions.
- Compute assessment-proximity and soft pacing risks as advisory analysis, not
  hard constraints.
- Keep attendance and accommodations out of the data model until actual
  instructor evidence establishes scope and privacy/policy requirements.

Team teaching and multiple sections are a genuine design gap. Decide their
near-term scope before the UI cements a single-instructor/single-timeline mental
model; implementation can still be deferred if this is not an immediate need.

### AI and Collegium boundary

- Product AI advises the instructor about planning and operating a course.
- GenAI in teaching is optional and must not be implied by using Course Planner.
- A future Course Operations Fellow may flag capacity, assessment readiness,
  disruption tradeoffs, unresolved clone dates, and retrospective patterns.
- Fellows advise; only user-approved domain APIs execute changes, always through
  the existing what-if/preview boundary.
- Collegium's useful contribution is this narrow advisory interface and lens
  model—not its broker or distributed runtime.

## Rolling roadmap

Each numbered stage ends with a human checkpoint that may continue, revise,
branch, supersede, or stop the later roadmap.

| Stage | Outcome | Checkpoint |
|---|---|---|
| A.1 | Seed fixed; genericity/academic additions decided; legacy handlers reconciled; docs current; PR #19 validated and merged | Confirm refrozen schema and Phase B lane scopes |
| UX-1 | Autonomous interaction spike on realistic data, early and parallel to API groundwork | Choose a direction after task-based review, not screenshots alone |
| B | Domain/REST, import-export/materials, and workspace UI lanes implemented against the refrozen contract | Demonstrate end-to-end Plan and Run tasks |
| D | Lanes integrated, full validation complete, redesign cut over to main | Go/no-go for main cutover |
| UX-2 | Production UX refinement against the working application | Validate daily-driver speed and mental models |
| Review | Term-close retrospective and next-term feedback loop | Confirm it changes real planning decisions |
| AI | Real instructor-assistance adapters and optional Course Operations Fellow | Reconfirm advisory boundary before provider wiring |
| Authoring | Evidence-driven content-authoring assistance | Scope from actual AI-phase use |
| Platform | History/search, collaboration, auth, broader institutional cases | Reassess from real adoption |
| Blackboard | Ultra interoperability | Start only when a sandbox exists; otherwise formally drop it |

UX-1 should happen now—after A.1 identifies stable concepts, but before Lane C
hardens them. It should compare at least two interaction directions for:
topic-first authoring, institution/calendar term setup, mid-term delivered-state
editing, historical planned/delivered review, and revision comparison. The
operator need only complete representative tasks and correct requirements; the
experiment does not require the operator to become the designer. A second UX
pass on the integrated product is still necessary because polished mockups do
not expose operational friction.

## Recommended model allocation

- Use low-cost models for bounded inventory, test writing, mechanical route
  implementation, documentation consistency checks, and monitoring.
- Use Sonnet-class models for UX alternatives, academic lenses, and coherent
  lane-sized implementation where judgment is local.
- Use frontier models only for contract/schema decisions, cross-lane
  integration review, security/privacy boundaries, and checkpoint synthesis.
- Escalate when a lower-cost worker identifies a decision, contradiction, or
  repeated failure; do not pay frontier rates for file-moving or test loops.

## Decisions for the Gate 0 conversation

1. Approve Path A for the immediate seed fix, retaining Path B as later schema
   debt only if the awkward relations cause repeated implementation pain?
2. Approve the short A.1 refreeze, including removal of `gaie` and a minimal
   capacity/recovery/buffer design?
3. Is team-taught/multi-section support a near-term product requirement, a
   design-only accommodation, or explicitly deferred?
4. Does “inherit a course” deserve a first-class guided workflow, or is it a
   composition of package import plus independent fork/clone?
5. Should genericity include non-US and non-semester calendars now, or merely
   avoid preventing them while validating first against US semesters?
6. Approve the early autonomous UX spike plus later integrated-product UX pass?
7. Keep Blackboard parked until sandbox access, with permission to remove it
   from the roadmap if access never materializes?

## Experiment record

Gate 0 used three independent read-only lenses:

- `gpt-5.4-mini`: repository, worktree, contract, route, and validation
  inventory.
- Claude Sonnet: product lifecycle, roadmap, UX spike, AI boundary, and
  experiment design.
- Claude Sonnet with selective Pantheon/Collegium material: long-practice
  academic operations review.
- Current frontier session plus the Mimir architecture rubric: synthesis and
  complexity/sequence judgment.

Experiment failure worth retaining: the AICP background launch scripts could
not survive the non-systemd execution environment. Their `nohup` fallback was
reaped when the tool invocation ended, so the agents were relaunched as
monitored foreground sessions. The product and academic agents wrote durable
reports; the inventory agent returned its report only through the monitored
session. A future launcher should use a durable tmux/session-runner fallback or
make the monitoring process the owner rather than assuming host user-systemd.

No tests, migrations, containers, commits, pushes, or implementation edits were
performed during Gate 0.
