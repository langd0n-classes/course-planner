# ADR-0004 Addendum 1: Outcome tier decisions

- **Status:** proposed 2026-11-16
- **Amends:** ADR-0004 (accepted 2026-08-14). The decision in ADR-0004 stands.
- **Deciders:** Langdon White (pending)
- **Issue:** #72

ADR-0004 chose a coarse Outcome tier that Topics roll up into, and left five
questions open. Issue #72 lists six questions, three of which ADR-0004 already
answered. This addendum gives a recommendation and a reason for each question
that is still open, so that the Outcome tier can be split into build issues.

Each section is marked **settled** (ADR-0004 decided it; restated here only to
close the issue's question) or **recommended** (new in this addendum; it needs
the operator's acceptance).

## 1. One concept or two — settled

Keep `Topic` as it is and add `Outcome` as a coarser tier. ADR-0004 chose this
as option 2.

The revisit trigger for a single leveled entity (option 3) is a need to ingest
a recursive external framework as data. That trigger has not fired. A course
that must demonstrate institutional outcomes carries a handful of statements,
which an instructor enters once. Section 3 covers how those statements keep
their source without a recursive model.

**Recommended addition:** an Outcome has no parent and no level. The tier is
flat, at course altitude. The program level is above this application's scope.
The module level is covered in section 4.

## 2. Cardinality — settled, with one recommended detail

Topic to Outcome is many-to-many. ADR-0004 decided this.

**Recommended:** the edge belongs to the Outcome version, and it points at the
Topic identity, not at a Topic version.

- A change to which Topics serve an Outcome is a design change. It gets a
  revision and a change summary, like every other design change under ADR-0003.
  An edge on the bare identities would rewrite the report of a closed Term
  when the instructor remaps Topics for the next one.
- The edge points at the Topic identity because rewording a Topic must not
  force a new Outcome revision. The Term already pins Topic versions through
  its Activities.

The edge carries an optional note and a provenance field (#73).

## 3. Ownership and scope — recommended

**An Outcome belongs to one Course. It can record an external source. There is
no institution-owned Outcome shared across Courses.**

An Outcome version holds:

| Field | Meaning |
|---|---|
| `statement` | The outcome text. For an external outcome, the source's exact words. |
| `articulation` | The instructor's account of how this Course realizes the outcome. Optional. |
| `sourceName` | The framework or body the statement comes from. Empty for the instructor's own outcome. |
| `sourceCode` | The source's identifier for the statement. |
| `sourceVersion` | The source's version or approval date, as free text. |
| `sourceUri` | Where the source publishes it. |

Reasons:

- ADR-0004 says ownership is not the defining property of an Outcome.
  Granularity is. A model that splits on ownership would contradict that.
- An `Institution` row here is created by an instructor. It is not an
  authority that publishes outcomes, so an "institution-owned" Outcome would
  be instructor-entered text with a misleading owner.
- An instructor cannot author or change an institutional framework. The only
  thing the instructor controls is how the Course answers it. Separating
  `statement` from `articulation` models exactly that: the exact text stays
  exact, and the Course's interpretation is visibly a different thing.
- A course carries under ten outcomes. Entering them once per Course costs
  minutes. Keeping copies in step across Courses is a real cost only for an
  instructor with several Courses under one framework, and nobody has that
  need yet.
- The generic-app rule holds: no framework is built in.

**Revisit trigger:** an instructor has two Courses that must track the same
external statements, and a wording change has to be applied twice. That is
also the point to look at option 3 again, because a shared framework is the
recursive data ADR-0004 named.

## 4. `LearningModuleVersion.learningObjectives` — recommended

**Leave it as prose on the Learning Module version. Do not promote it to a
tier. Do not migrate it into Outcomes. Do not link it to Topics.**

- ADR-0004 makes the Learning Module the student's navigation view. Its
  objectives are what the module tells a student it will do for them. That is
  presentation text on the delivery axis, and it is already versioned with
  the module.
- A middle tier would make a path Outcome → objective → Topic. That path runs
  through the Learning Module, which is the Topic-to-Module ownership ADR-0002
  removed.
- A tree with a middle tier also contradicts the many-to-many decision in
  section 2.

What the instructor can still check, with no new data: for each Learning
Module, the Outcomes that its Activities' Topics serve. That is a derived
read. It lets the instructor compare the module's stated objectives with what
the module's Activities really cover.

**Revisit trigger:** instructors ask for the module objectives themselves to
be checked or reported, not just read.

## 5. Coverage roll-up — recommended

ADR-0004 requires the roll-up to separate taught from assessed. This section
fixes the rule.

**An Outcome never gets a single "covered" value.** For one Outcome in one
Term, the roll-up reports counts over the Outcome's Topics:

| Count | Source |
|---|---|
| Topics mapped | Outcome version's Topic set |
| Taught, planned | Topic has an introduced or practiced action on a planned revision |
| Assessed, planned | Topic has an assessed action on a planned revision |
| Taught, delivered | The same, on delivered revisions |
| Assessed, delivered | The same, on delivered revisions |
| Complete | Topic's Term-scoped completion judgment (ADR-0004) |

From the counts it derives named gaps, in this order:

1. **No Topics** — the Outcome is an orphan.
2. **Not taught** — no mapped Topic has an introduced or practiced action.
3. **Taught, never assessed** — at least one Topic is taught and none is
   assessed. This is the gap constructive alignment exists to catch.
4. **Partly assessed** — some Topics are assessed. The report lists the Topics
   that are not.

Rules:

- No percentage threshold turns the counts into "met". Whether seven of twelve
  assessed Topics is enough is the instructor's judgment.
- The wording is about Topics: "7 of 12 Topics assessed". It is never
  "outcome achieved". A link between an Activity and a Topic shows intent. It
  does not show that the teaching or the assessment was adequate.
- There is no completion judgment on the Outcome itself in the first build.
  Topic completion rolls up as a count. A second judgment at a second altitude
  would let the two disagree with nothing to reconcile them.
- A Term adopted part-way through (#75) has meetings with no recorded
  coverage. The roll-up reports those as "not recorded", separate from a gap.
  A blank first half must not read as "taught, never assessed".
- Gaps are reported. Nothing blocks on them (ADR-0004, "Report, do not
  enforce").

**No direct Activity-to-Outcome edge.** Coverage reaches an Outcome only
through a Topic. A course designed at a coarse grain, for example a practicum
where one required presentation is the main evidence for an outcome, writes a
coarse Topic for it. One Topic may restate one Outcome. A second path would
give the roll-up two sources that can disagree, and it would let an Outcome
read as assessed with no statement of what was assessed.

## 6. Versioning — recommended

**One mechanism for every Outcome: `Outcome` plus `OutcomeVersion`, the same
shape as `Topic` plus `TopicVersion`. A Term pins the Outcome versions it
adopts.**

- Course-owned and externally sourced outcomes differ in who causes a change.
  They do not differ in how a change is stored. When a framework changes, the
  instructor enters a new revision and sets `sourceVersion`.
- The pin follows ADR-0003. A closed Term reports against the statements and
  the Topic sets it ran with.
- A second version mechanism for external outcomes would need an owner for
  the external schedule. Section 3 already says there is none.

## ADR-0004's remaining open questions

### Topic codes — recommended

**Treat `stableCode` as an opaque string. Do not regenerate the DS-100
snapshot with new codes.**

- `LM01-C14` is the identifier the source course uses. Changing it breaks the
  trace from an imported Topic back to its source material.
- The generic-app rule already forbids the model from reading structure out
  of one course's identifiers.

`ExemplarSnapshot.topics[].learningModuleCode` becomes optional. The importer
accepts a Topic without it.

### `Topic.learningModuleId` — recommended

**Remove it, in two steps.**

1. Remove every reader and writer. The Course workspace already ignores it for
   grouping (#71). The importer stops setting it.
2. Drop the column, in a migration of its own.

A column that nothing reads and that still looks like ownership will be read
again. ADR-0004 offered "demote to a hint" as the alternative; no reader wants
the hint once Activity-derived grouping exists.

### What a reteach action is — recommended, lower confidence

Marking a Topic incomplete lists it in the active-Term view with its remaining
planned Activities. The view offers two actions, both through the existing
what-if preview:

- add a practiced or assessed action for the Topic to an upcoming Activity;
- create a Term Activity in a planning gap.

No new action type. This belongs to the completion build, which ADR-0004
orders first, and it should be confirmed there against real use.

## Related issues

- **#17, the long-term Skill entity.** A competency taught across many Topics,
  such as debugging or written communication, is an Outcome under this model.
  The many-to-many edge is what makes a cross-cutting statement expressible.
  A separate Skill entity would be a second coarse tier with the same edge.
  Recommended: do not build it; close that half of #17 when this addendum is
  accepted.
- **#73, provenance.** `Outcome`, `OutcomeVersion`, and the Topic edge each
  carry provenance from their first migration.
- **#75, part-way Terms.** See the "not recorded" rule in section 5.

## Not decided here

- **Variable pathways.** A course where students take different Activities,
  for example by project, needs a check that every pathway still covers each
  Outcome. The model above has one pathway. This needs its own design once a
  real course requires it.
- **A student-facing outcomes view.** ADR-0004 lists it as a surface question.
  Nothing here depends on it.

## Build order

ADR-0004's sequencing holds: completion and the reteach signal ship before the
Outcome tier.

| Order | Issue to open | Depends on |
|---|---|---|
| Any time | Remove `Topic.learningModuleId` readers and writers; make `learningModuleCode` optional | — |
| 1 | Term-scoped Topic completion, revocable, with informal and assertion evidence; reteach list | — |
| 2 | `Outcome` and `OutcomeVersion` with the Topic set; Course workspace editing; orphans reported | — |
| 3 | Term pin of Outcome versions; roll-up report | 1, 2 |
| 4 | Outcomes in the generic demo exemplar | 2 |
| Later | Drop the `Topic.learningModuleId` column | first row |

## Sources

- Issue #72 and its 2026-11-16 research comment.
- ADR-0002, ADR-0003, ADR-0004.
- A concept note from a practicum syllabus project (2026-09-12) on external
  outcomes, course-specific articulation, and evidence. It is the source of
  the `statement` and `articulation` split, the wording rule in section 5,
  and the pathways item.
- `docs/ds100-exemplar/ds100_syllabus_student.md`: the exemplar's syllabus
  outcomes are institutional outcomes, each followed by the course's own
  account of how it meets them.
