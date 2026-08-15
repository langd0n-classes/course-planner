# ADR-0004: Learning Outcomes are the design axis; Learning Modules are the student view

- **Status:** accepted 2026-08-14
- **Date:** 2026-08-14
- **Deciders:** Langdon White, course-planner coordinator (Mimir review)

## Context

Operator review of the Phase B.4 workspace, against a dense real course (DS-100: 9 modules,
130 Topics, 37 meetings), surfaced a question the model has no answer to: *how do I assign a
Topic to a Learning Module?*

ADR-0002 removed that write path deliberately. Learning Modules organize activities; Topics
attach to activities through introduced/practiced/assessed actions. The UI still presented
Topics as though a Learning Module owned them, so the question kept arising.

Working through why the question felt natural exposed a conflation in the earlier design:
**Learning Outcome and Learning Module were treated as one concept.** They are not. The
relationship a Topic actually has is to an Outcome. The relationship it appeared to have — to
a Module — was the conflation showing through.

`Topic.learningModuleId` exists because of that conflation. So does the required
`learningModuleCode` on every Topic in the exemplar snapshot type, which currently makes it
impossible to import a Topic that has no module home.

### What a Learning Outcome is

A Learning Outcome is what the instructor, through the syllabus, promises students will walk
away able to do. Ownership varies and is not the defining property: an outcome may be
institutional (a BU Hub outcome a course must demonstrate) or purely the instructor's own.

The defining property is **granularity**. Learning outcomes nest — program, course, module,
lesson — and become more specific and more measurable as the level narrows. Course-level
statements often use verbs that are not directly observable; finer levels are where assessment
attaches.

**Topics are the fine-grained end of that same spectrum**: the detailed outcomes too numerous
to put in a syllabus. DS-100 has 130 Topics and a syllabus carrying under ten outcomes. An
Outcome and a Topic are not different kinds of thing. They are the same kind of statement at
different altitude, and what was missing is the roll-up between them.

### Prior art

This model is not novel, and that is reassuring rather than disqualifying.

- **Curriculum mapping** has used an I/R/M notation — Introduced, Reinforced, Mastery — plus a
  separate mark for assessment evidence, for decades. Our introduced/practiced/assessed is the
  same convention. Established tools in that space already do gap analysis for outcomes with
  insufficient coverage, and explicitly distinguish taught from assessed to catch outcomes that
  are taught but never evaluated.
- **1EdTech CASE** models competency frameworks as recursive hierarchies of items with typed
  associations, each with a GUID, for exchanging standards frameworks between systems.

What is *not* well served by existing tools is running a course while it is moving. Learning
management systems attach measurement to delivery; Blackboard Ultra does not even let an
instructor author a goal, only align to institution-provided ones. Curriculum mapping tools
carry the right domain model at the wrong tempo, aimed at annual program review. Coursetune
launched in 2017 selling course design to professors and redirected into curriculum mapping
because institutions, not instructors, were the buyers.

That gap — **live-fire course running** — is what this application is for, and it is the test
every feature should be held to.

## Options considered

1. **Keep one grouping concept and let Learning Modules carry outcome duty.** Smallest change,
   but it preserves exactly the conflation that produced the problem, and it forces a single
   grouping to serve two unrelated audiences.
2. **Model Outcomes as a coarse tier that Topics roll up into, leaving Topic otherwise as-is.**
   Smaller change to a working graph; keeps `Topic` stable; slightly dishonest that the two are
   the same kind of statement at different altitude.
3. **Model a single learning-statement entity with a level, Topics being the finest.** Most
   honest to the pedagogy, and the shape CASE standardized; redefines `Topic`, which ADR-0002
   and ADR-0003 were careful about, and invites a generic hierarchy that is harder to constrain
   in a UI.

## Decision

**Adopt option 2, with `Topic.learningModuleId` removed as a required relationship.**

Three distinct edges replace one overloaded one:

- **Topic → Learning Outcome** — the design axis. Many-to-many: a Topic serves more than one
  Outcome, an Outcome draws on many Topics. This is not speculative; the DS-100 Hub outcomes
  are cross-cutting by construction, and a single visualization Topic serves several.
- **Activity → Learning Module** — the student-facing delivery axis. Unchanged from ADR-0002.
- **Activity → Topic**, with introduced / practiced / assessed — the coverage axis. Unchanged.

**Revisit trigger for option 3:** if this application ever needs to ingest an external
competency framework — BU Hub as machine-readable data, or anything CASE-shaped — that data
arrives recursive, and the coarse-tier model becomes an impedance mismatch.

### Two views over one graph

- **Instructor view (design):** Outcome → Topics → coverage attempts through whatever tools fit
  — lectures, labs, assignments, projects, in-class polls, exams.
- **Student view (navigation):** Learning Modules group those tools into a dated, logical
  progression, so a student who did not understand probability can find the probability tools.

This is why ADR-0002 is right, stated better than ADR-0002 stated it: a Learning Module groups
activities because a Module is the student's navigation axis, not the instructor's design axis.

### Coverage: two mechanical states and one human verdict

An activity that claims to practice a Topic is asserting intent. Whether it landed is a
separate fact.

- **planned** — the Topic action exists on the planned revision. Derived.
- **delivered** — the activity happened and its delivered revision still carries the action.
  Derived. Both already exist through ADR-0003's planned/delivered revisions.
- **complete** — a Term-scoped **instructor judgment**, not a derived value.

An earlier draft proposed "evidenced" as a third derived state. That was wrong: it would
require per-student assessment results, which this application deliberately does not hold. A
state that cannot be computed from available data must not be modeled as though it can.

`complete` defaults to unmet whenever the assessed action has not been delivered, because a
Topic whose assessed action has not been met has not done its part toward its Outcome. An
activity running is not the same as a Topic landing.

### Completion is revocable, and carries an evidence log

The instructor can move completion **in either direction**, with a reason:

> Office hours were full of students asking probability questions they should already know.
> Probability goes back to incomplete.

That is knowledge about one delivery, not about the course design, so completion state belongs
to the Term, consistent with ADR-0003's seam.

Evidence is a typed log attached to the judgment, never a substitute for it:

| Type | Source | Example |
|---|---|---|
| formal | aggregate from an instructor-supplied export | 87 responses, 41% below threshold |
| informal | instructor observation | office hours revealed gaps |
| assertion | none | the instructor is satisfied |

Each entry carries a timestamp and a note. Six weeks later nobody remembers why a Topic was
reopened.

### Invariant: never store a row that identifies a student

This application holds no per-student data. Ever.

Formal evidence enters by the instructor supplying an export they already have — a Gradescope
or gradebook CSV — which is computed into an aggregate. **The aggregate is retained; the rows
are discarded.** No names, no per-student scores, no identifiers.

This is a product boundary, not only a privacy measure. It is what keeps this a planning tool
rather than a second-rate gradebook, and it removes any need for institutional LMS API
integration, which is a procurement exercise an instructor cannot perform.

### Design artifacts are not student data

`GRADING_EXCLUDED_KEYS` in the exemplar importer currently strips `answerKey`, `solutionKey`,
`rubricSolution`, `scores`, `studentScores`, and `perStudentScores` as one category. They are
two categories:

- **Instructor design artifacts** — rubrics, solution keys, answer keys. A rubric is a written
  statement of what mastery looks like, which is outcome-adjacent content a design tool should
  be able to hold.
- **Student data** — scores and anything per student. Excluded by the invariant above.

The reason both are stripped today is that the exemplar snapshot is committed to a public
repository, where solution keys must not appear. That is a **publishing** rule being enforced
as a **modeling** rule. Separate them: the model may hold design artifacts; the exported
exemplar strips them.

### Report, do not enforce

Constructive alignment says outcomes come first and everything is designed backwards from them.
That is sound advice to an instructor. **It must not become an invariant in the software.**

Real authoring is not linear. An instructor should define Outcomes first, but will discover
Topics while building tools or modules, and may also sit down and write 100 of 130 Topics in one
pass. Course design and Term design both work this way.

Therefore:

- No required creation order among Outcomes, Topics, Activities, and Modules.
- Orphans are first-class: a Topic with no Outcome, an Outcome with no Topics, an Activity
  covering nothing.
- The system **surfaces** incompleteness and never blocks on it.

This generalizes what the workspace already does — planning gaps, coverage health, and empty
states that name the missing prerequisite are all reporting rather than gate-keeping.

## Implementation sequencing

The parts of this ADR do not pay back at the same rate, and must not ship as one lump.

- **First — completion and the reteach signal.** Term-scoped completion, revocable, with
  informal and assertion evidence. Surface Topics needing another pass in the active-Term
  viewport. This is weekly value during a live term, and it is the part with no competition.
- **Second — the Outcome tier and roll-up.** Outcome entities, Topic-to-Outcome edges, and
  coverage roll-up distinguishing taught from assessed. This is review-time value, needed once
  a cycle, and it is where existing tools already compete.
- **Second — formal evidence ingestion.** Instructor-supplied export, aggregate retained, rows
  discarded. Only after the first item proves it is reached for.
- **Never — LMS API integration.** A vendor and procurement exercise that would also make this
  a system of record, which is the opposite of its value.

## Consequences

- `Topic.learningModuleId` stops being the Topic's home. It is removed, or demoted to an
  optional student-view hint with no semantic weight. Read-side grouping that depends on it
  moves to activity-derived grouping.
- `ExemplarSnapshot.topics[].learningModuleCode` stops being required. The current DS-100
  snapshot asserts a module home for all 130 Topics and would be regenerated.
- Coverage health gains an outcome tier, and must distinguish taught from assessed. An Outcome
  reported as covered because it was talked about would defeat the purpose.
- The daily driver gains its most useful mid-term signal: Topics that need another pass because
  their assessed action has not been met.
- A student-facing view or export becomes a real surface question. Everything today is
  instructor-facing. Modules may need presentation fields they do not currently have.

## Open questions

1. **Outcome scope and ownership.** Institution-owned outcomes are shared across courses;
   course-owned ones are not. Both are representable — `Institution` already owns courses — but
   the distinction must be deliberate.
2. **`LearningModuleVersion.learningObjectives`.** A `String[]` of instructor prose at module
   altitude, sitting between course Outcomes and Topics. Possibly an unmodeled middle tier,
   possibly redundant once tiers exist. Do not assume it is superseded.
3. **Outcome versioning.** Course outcomes change between terms; institutional ones change on
   the institution's schedule. These may need different version behavior.
4. **The DS-100 topic codes.** Topics are named `LM01-C14`, encoding module membership in the
   identifier. Under this ADR those codes reflect the conflation, not the model. Whether to
   regenerate the snapshot with different codes, or treat the codes as opaque strings whose
   internal structure the model ignores, is unresolved.
5. **What a reteach action is.** Marking a Topic incomplete is only useful if it leads to a
   planning action — schedule a meeting, add a lab, change an assessment. Which of those the
   viewport offers is undecided.

## References

- ADR-0002 — Learning Modules organize activities, not Topics
- ADR-0003 — Pin Course design and revise Term delivery separately
- Learning outcomes nest by granularity and become more measurable at finer levels:
  <https://resources.depaul.edu/teaching-commons/teaching-guides/course-design/Pages/course-objectives-learning-outcomes.aspx>
- Constructive alignment (Biggs, 1996): <https://en.wikipedia.org/wiki/Constructive_alignment>
- Curriculum mapping, including the I/R/M convention and taught-versus-assessed gap analysis:
  <https://manoa.hawaii.edu/assessment/resources/curriculum-mapping-curriculum-matrix/>
- 1EdTech CASE competency framework model: <https://www.1edtech.org/standards/case>
- Coursetune's redirection from course design to curriculum mapping:
  <https://www.edsurge.com/news/2021-09-02-is-curriculum-mapping-becoming-a-priority-for-online-college-programs>
