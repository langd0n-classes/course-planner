# B.2 UX synthesis — instructor's ledger

**Date:** 2026-07-13
**Scope:** Course bootstrap/design workspace and active-Term daily-driver cockpit
**Status:** validated coordinator salvage; awaiting operator checkpoint

## Experiment question

Can an agent-led design process turn the accepted B.1 vertical seam into a
distinctive, usable instructor workspace without asking the operator to design the
interface first?

The operator's role remains product judgment at a working checkpoint. Agents choose
and execute a direction, record the reasoning, and preserve the option to course
correct after the result can be used rather than imagined.

## Chosen direction: instructor's ledger

The interface should feel like a serious instructor's working ledger rather than a
generic SaaS dashboard: warm paper, dark ink, one deep-teal action color, serif
headings, monospaced dates and identifiers, restrained corner radii, and visible
rules that organize dense information. Amber remains reserved for work requiring
attention; rose remains destructive or blocking. The result is quiet enough for a
daily driver while retaining a recognizable point of view.

No remote font or UI dependency was added. The display stack uses locally available
book serifs with a Georgia fallback; the body stack stays legible and native. A
subtle ledger rule is CSS-only and is removed for print.

## Alternatives considered

- **Conventional analytics dashboard:** familiar cards, blue actions, rounded white
  panels, and summary charts. Rejected because the existing implementation already
  drifted toward this pattern and it made curriculum evidence look like business
  metrics.
- **Freeform curriculum studio:** a canvas-first, highly visual design surface.
  Deferred because it would privilege course construction over the equally
  important live-Term daily-driver requirement and would require interaction
  contracts the current backend does not yet support.
- **Dense operations command center:** maximum information above the fold, dark
  theme, persistent side rail. Rejected because it overstates urgency during normal
  planning and makes long-form curriculum content harder to read.

## Product and interaction decisions

1. **Name the workspace mode.** Course pages say `Design workspace`; Terms say
   `Plan workspace`, `Run workspace`, or `Record workspace` from lifecycle state.
   This keeps course creation and live operation related without collapsing them.
2. **Put a small table of contents in the first viewport.** Course links jump to
   Terms, Curriculum, and Topics. Term links jump to Attention, Calendar, and
   Planned versus delivered. The labels expose current unassigned/attention counts
   without inventing another backend object.
3. **Make bootstrap progress legible.** Institution, Academic Calendar, and first
   Term are shown as the three setup milestones while the existing forms remain the
   actual source of truth.
4. **Keep accepted academic semantics intact.** Slot type, capacity, and Session
   instructional mode retain separate labels. Baseline capacity rows stay compact;
   genuine advisories retain source, reason, and provenance evidence.
5. **Use one global keyboard contract.** A skip link, landmark labels, visible
   focus rings, reduced-motion behavior, and scroll targets improve keyboard use
   without adding a component library.
6. **Do not turn gaps into decoration.** Unassigned Topics, unplanned class days,
   unscheduled Sessions, and cancellations remain amber, textual, and actionable.
   Counts summarize them but do not replace the underlying evidence.

## Frontend-design skill influence

The installed Claude frontend-design skill pushed the run to choose a named,
committed aesthetic rather than performing isolated component polish. Its emphasis
on typography, palette, spatial intention, and avoiding generic AI-dashboard
patterns directly informed the ledger direction. The coordinator deliberately
tempered its preference for dramatic motion, external fonts, and grid-breaking
composition because this product must remain calm, accessible, offline-tolerant,
and useful at semester scale.

## Orchestration incident and salvage

The first Sonnet worker reached its 60-turn cap before validation or a final report.
A sandboxed PID check could not see the host tmux process and was misread as worker
termination, so a manual foreground fallback overlapped the original run in the
same isolated worktree. Both invocations stopped at the cap and no commit or push
occurred. The overlap likely doubled model usage for this spike.

Before salvage, the coordinator preserved the entire draft in a reversible git
stash. Audit showed that the overlapping output was internally consistent but
mostly a mechanical class-name restyle: 15 files, 475 additions, and 410 deletions,
with no tests or experiment note. The coordinator retained the coherent visual
system, removed trace artifacts, added the missing product/interaction layer, and
reserved validation and promotion for a separate review step.

Reusable process corrections:

- verify host-launched agents from the host namespace or their heartbeat/exit
  contract, not sandbox-local `ps` alone;
- never start a fallback against the same worktree until the first worker's exit
  file or host process state is conclusive;
- use one bounded implementation worker, then coordinator review; and
- define the stop point early enough that documentation and validation fit inside
  the turn budget.

## Validation

Final coordinator validation:

- focused Course workspace, Term workspace, and Term preview tests: **6/6 pass**;
- full unit suite: **137/137 pass across 22 files**;
- TypeScript `tsc --noEmit`: **pass**;
- ESLint across every changed TypeScript/TSX surface: **pass**;
- `git diff --check`: **pass**; and
- Node 22 Podman production build, including containerized Prisma generation:
  **pass**.

The initial faint-ink token measured only 2.81:1 on the sunken paper surface.
Coordinator review darkened it to `#6f6759`, which measures 4.70:1 on that surface
and 5.49:1 on the primary surface, preserving hierarchy while meeting normal-text
contrast.

One focused preview test initially failed because it expected the old combined
heading `Preview: Spring 2027`. The new interface deliberately separates the safety
state (`Preview, not yet applied`) from the Term name heading. The assertion was
updated to require both messages; application behavior did not regress.

The coordinator also reviewed the final diff for the two domain mistakes found in
the prior gate. Capacity provenance remains distinct from scheduling source, and a
non-null baseline capacity reason still does not turn an ordinary row into an
advisory. No schema, service, route, or DTO contract changed in this spike.

## Operator checkpoint

The working review should answer three questions after the validated interface is
available:

1. Does the ledger direction feel calm and credible enough to use every teaching
   day?
2. Are `Design`, `Plan`, `Run`, and `Record` the right lifecycle words?
3. Does the first viewport surface the right work, or should Attention/Calendar
   move ahead of the Term identity and summary?

These questions concern consequential vocabulary and priority. Color-by-color or
component-by-component design input is intentionally not required from the
operator unless the autonomous direction fails the checkpoint.

## Operator checkpoint result

The operator accepted the restrained ledger direction as useful prior art but did
not accept the information architecture as the production workspace. Hands-on use
revealed that the interface was too sparse and list-heavy for a course with roughly
150 Topics, overemphasized summary/calendar panels, and underemphasized the next
meeting, preparation work, current LM, Topic actions, and assignment milestones.

More importantly, the spike exposed a domain-model correction: Learning Modules
should organize meetings and coursework, while Topics attach to those activities
through I/P/A actions. Projects and exams may remain cross-cutting and participate
in several meetings through explicit milestones. Instructor terminology must be
customizable over stable behavior families.

This is a successful experimental result even though it stops direct UI polishing:
the autonomous spike made the wrong mental model concrete early enough to replace
it. The accepted feedback, calendar corrections, DS100 evidence sources, and next
checkpoint are recorded in
`docs/plans/course-planner-b2-operator-feedback-2026-07-13.md`; the architectural
decision is ADR-0002.

## Continuity observation — 2026-07-14

After the B.2R recovery was decomposed into smaller worker prompts, coordinator
behavior regressed from continuous execution to treating each worker launch or
status report as a reason to yield to the operator. No product checkpoint or real
blocker existed. This unintentionally shifted routine orchestration back onto the
operator and weakened the experiment's central claim that the operator can remain
in a product-judgment role.

The correction is about **continuity and decomposition**, not artificially low
turn limits:

- between scheduled gates, the coordinator continues autonomously through worker
  monitoring, output review, bounded follow-up jobs, integration, and validation;
- status updates are informational and do not end execution;
- work should be split into more small, well-contextualized prompts, using more
  agents in parallel when their file ownership and outcomes are genuinely
  independent;
- turn budgets remain proportional and large enough for each bounded worker to
  finish; cost control comes primarily from reducing rediscovery and scope; and
- the coordinator yields only at an agreed checkpoint, a material requirement
  choice, or a genuine blocker requiring operator authority.

The immediate evidence reinforced this distinction. Two file-owned Haiku jobs
were correctly decomposed, but 6- and 8-turn caps caused both launchers to report
failure. One had nevertheless completed its test repair; the other succeeded when
relaunched with the same narrow scope and adequate runway. Smaller work units were
useful. Arbitrarily small turn budgets were not.

### Model-routing observation

Claude later reached the account's monthly spend limit, interrupting both a
mechanical lint job and a read-only checkpoint review. The coordinator preserved
the completed local work and rerouted only the unfinished scopes to
`gpt-5.4-mini`; no broad phase prompt was replayed.

The GPT-mini runs show that small ownership boundaries improve concurrency,
verification, and recovery, but do not automatically imply low token counts.
Even one- or two-component prompts consumed tens of thousands of tokens, and the
dense Topic editor exceeded 100k, because workers still performed instruction and
context passes and sometimes inspected adjacent prior art despite narrow manifests.
The next prompt-generation refinement is therefore:

- keep the small, disjoint deliverables;
- embed the exact type definitions, style tokens, and local test convention needed
  by the worker instead of inviting repository discovery;
- explicitly identify the one nearest prior-art file when one is useful;
- require ordinary-suite compatibility (for example, a checked-in jsdom directive)
  rather than allowing a special verification flag to hide test-environment drift;
  and
- evaluate cost per accepted, coordinator-verified slice, not launcher exit code or
  nominal prompt size alone.

The Codex launcher should also expose a per-job reasoning-effort option. Routing a
mechanical slice to a mini model is only part of cost control if every launched
job still inherits the operator's interactive `high` reasoning default.

### Confirmed cost result

The final milestone-integration job confirmed that this is not a theoretical
concern. It owned three files, implemented one well-specified integration seam,
and used `gpt-5.4-mini`, yet consumed approximately **182,000 tokens**. The worker
did catch and repair its own type-only import error and finished with tests, lint,
typecheck, and diff validation passing, so the output was accepted; the cost was
nevertheless disproportionate to the mechanical scope.

For future fan-out, model tier, prompt size, and file count are insufficient cost
controls. The launcher should expose reasoning effort per job, with low or medium
effort for mechanical file-owned work and high effort reserved for ambiguous or
consequential judgment. Until that exists, treat local Codex job cost as uncertain,
keep measuring tokens per coordinator-accepted slice, and consider a cheaper
provider/model route before multiplying jobs.

## Gate B.2R acceptance and B.3 launch — 2026-07-14

The operator accepted Gate B.2R with the recommended defaults. The coordinator
promoted only the accepted decisions, evidence, roadmap, migration plan, checkpoint,
and experiment record into a new `redesign-b3-integration` lineage. The rejected
ledger information architecture and the local interaction prototype were not
silently promoted into the production baseline.

Parent issue #33 was decomposed before implementation into #35 (schema root), #36
(DTO/Zod/factories), #37 (Course Activity design), #38 (Term adoption/delivery),
#39 (calendar correction), and #40 (importer/demo). Only #35 was authorized to run;
later prompt comments remain unpublished until their exact schema/DTO inputs freeze.
This makes the gate mechanically visible instead of relying on coordinator memory.

The first local Codex launch exposed the already-observed host detachment problem:
the automatic systemd scope did not reach a trace or working diff, and a plain
`nohup` retry was reaped with the tool session. Both worktrees remained clean, so
no overlapping writer was started. The same `launch`-selected command was then run
inside a persistent tmux session, where its normal heartbeat, trace, and Telegram
watcher became visible. Future launches from this environment should go directly
through the persistent tmux wrapper and ordinary run log; do not spend cycles
retrying or monitoring the nonworking systemd path.

The schema root uses `gpt-5.4` because additive relational constraints and migration
compatibility require judgment. Lower-cost models remain the default for later
mechanical fixtures and scaffolds, while service packets receive one capable
mid-tier worker apiece. The unresolved launcher limitation is that local Codex still
inherits high reasoning effort; packet size and accepted-output cost continue to be
recorded rather than assumed.

### B.3.1a measured result

The schema worker consumed **178,565 tokens**. Coordinator review found issues that
were inexpensive to correct centrally but consequential enough to justify retaining
the review boundary: PostgreSQL identifier truncation caused migration/schema drift,
several new referential actions were invalid for their nullability, and the first
schema draft omitted Artifact ownership by reusable Activity versions and immutable
Term revisions. After correction, all four migrations applied from an empty
PostgreSQL schema, Prisma reported no drift, 14 focused tests passed, and TypeScript
passed. The reviewed checkpoint was pushed before B.3.1b began.

The durable-launch rule needs one operational precision: putting the launcher command
in tmux is not sufficient if its internal user-systemd reachability check returns a
false positive. In this host environment, invoke the launcher from a persistent tmux
shell with the user-systemd bus deliberately unavailable so its ordinary fallback
process remains in the tmux cgroup. Confirm both worker and watcher PIDs plus the
trace before treating a start banner as a real launch.

### B.3.1b model-routing result

The first B.3.1b prompt assigned DTOs, runtime schemas, fixtures, and their tests to
one mini worker. The coordinator stopped it before edits because the unit recreated
the broad-prompt/cost pattern the experiment was trying to correct. The replacement
used Sonnet for the frozen TypeScript contract and two parallel Haiku packets for
runtime validation and deterministic fixtures.

That routing reduced the judgment burden on the inexpensive workers, but did not
remove the coordinator-review requirement. Review and the cross-packet gate found:

- additive contract fields that initially broke existing M1 consumers;
- missing calendar-version and milestone request seams in the Sonnet contract;
- nondeterministic and unsound fixture helpers in the first Haiku draft;
- a Zod 4 runtime failure caused by calling `partial()` on a refined object;
- calendar-version and Artifact schemas that did not match the frozen TypeScript
  request shapes;
- a time regex that accepted impossible times; and
- UUID-looking fixture constants that passed TypeScript but failed runtime UUID
  validation.

After narrow corrections, the combined Node 22 gate passed 201 focused tests across
six files plus full typecheck. The useful lesson is not that one provider was
reliably better: Sonnet handled the cross-file contract efficiently, Haiku produced
substantial mechanical coverage, and provider/model diversity exposed different
failure modes. Small prompts, exact ownership, an independent cross-packet test, and
coordinator comparison to the frozen contract were all necessary parts of the cost
strategy.
