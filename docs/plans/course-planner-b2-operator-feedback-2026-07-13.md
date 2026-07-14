# Course Planner B.2 operator feedback and roadmap correction

Date: 2026-07-13

Status: requirements accepted; B.2R ready for operator checkpoint (evidence,
contract, migration, prototype, and validation checkpoints pushed)

## Gate outcome

The B.2 ledger spike is useful visual prior art, but its information architecture is
not accepted as the production daily driver. Operator review found a more important
domain correction: Learning Modules should organize meetings and coursework, while
Topics attach to those activities with I/P/A actions. Continuing to polish the
current Topic-to-Learning-Module workspace would harden the wrong graph.

The next step is therefore a bounded **B.2R domain and interaction refreeze**, not a
broad UI implementation run. It ends with an operator checkpoint before code fans
out again.

## Accepted requirements

### Course creation and workspace flow

- Creating a Course goes directly to its design workspace, not back to the Course
  index and not immediately into first-Term scheduling.
- The instructor can build Topics, Learning Modules, meetings, and coursework before
  creating a Term.
- Empty states include direct actions or links to create the missing prerequisite.
- Suggested values are keyboard-acceptible. Tab accepts the visible suggestion when
  doing so does not conflict with ordinary focus navigation.
- Topic code is presented after title as a human-facing **Topic code**, suggested
  from the title, and always overridable.

### Activity-first curriculum graph

- Learning Modules contain or order learning activities: meetings such as lectures,
  labs, discussions, and recitations, plus assignments and other coursework.
- Each activity has at most one primary Learning Module for board placement, or is
  unassigned/cross-cutting. Independent scope links may span multiple Learning
  Modules or Topics.
- Topics attach to meetings, assignments, projects, or exams with an I/P/A action.
- A Topic may appear repeatedly with the same action. Show a warning and links to
  the other occurrences; do not block the plan.
- Projects and exams need not belong to an LM. A single project can have milestone
  links such as release during L11, work time during Lab 4, phase release during
  L14, and due before L19.
- Future recap modeling may let projects/exams explicitly scope or assess an LM or
  Topic set. Do not force that future behavior into initial ownership semantics.

### Instructor vocabulary over stable behavior

- Activity types are reusable per Instructor.
- Each type has an instructor-facing label and a canonical behavior family. For
  example, Recitation, Discussion, and Lab may map to meeting behavior while
  retaining distinct labels.
- Type creation asks both what the Instructor calls it and what kind of thing it is.
- Courses enable the Instructor types they use; Terms preserve adopted labels so
  history does not change after a catalog rename.
- Milestone roles such as released, work time, phase released, review, and due are
  separate from activity types.

### Institution and Term calendars

- The Institution owns a shared, versioned Academic Calendar.
- A Term selects and materializes from that calendar, inheriting dates, holidays,
  breaks, reading days, and special periods.
- A Term may add offering-specific exceptions. Instructor-wide calendar exceptions
  are deferred from the initial launch.
- Finals week is modeled explicitly as a special period with potentially different
  meeting rules; it is not assumed to be either an ordinary instructional week or
  outside the Term.
- Calendar container and scheduled content remain separate. Planning gaps remain
  visible.

### Dense design workspace and daily driver

- Design for realistic scale: approximately 150 DS100 Topics plus long meeting and
  assignment lists.
- Prefer inline editing, compact rows, keyboard operation, and focused detail panes
  over repeated full-page forms and large decorative cards.
- Informational/statistical panels must not look clickable. When a notice describes
  work the user can resolve, it links directly to that work.
- The Course design board uses LM columns plus Unassigned/Cross-cutting and drags
  meeting/coursework cards, not Topics, between them. Selecting a card edits its
  Topic I/P/A actions.
- A separate Topic-flow view shows where each Topic is introduced, practiced, and
  assessed across both meetings and coursework.
- The active-Term first viewport prioritizes the next meeting, next due/release
  event, current LM, lecture/lab ordinal, active Topics, and immediate preparation
  work. Coverage summaries and full calendar analysis are secondary or contextual.
- Planned-versus-delivered mutation remains preview-before-apply and inline where
  practical.

### Realistic exemplar

Build a one-way DS100 importer plus a committed, sanitized demo snapshot from:

- `/home/lwhite/loc-areas/courses/ds100/current-term/202602/`, excluding every
  `grading/` subtree;
- `/home/lwhite/loc-areas/courses/ds100/terms/202504-ds100/`, excluding grading;
  and
- `/home/lwhite/loc-areas/courses/ds100/terms/202601-ds100/`, excluding grading.

The current-Term `course-info` and `lms` directories provide the initial mapping;
the two historical Terms are comparison evidence for reusable-course versus
offering-specific boundaries. Nothing DS100-specific may be hardcoded into the
generic application.

## B.2R refreeze deliverables

1. **Evidence map:** inventory the allowed DS100 material and map representative
   files to Course, Term, Academic Calendar, Topic, LM, activity, milestone,
   Artifact, and planned/delivered concepts. Record ambiguous or missing concepts.
2. **Contract proposal:** supersede direct Topic-to-LM ownership with the smallest
   versioned activity graph that supports the accepted requirements. Preserve
   distinct meeting/coursework lifecycles behind a shared planning identity.
3. **Calendar proposal:** specify Institution inheritance, Term exceptions, special
   periods/finals, and meeting-role materialization. Remove Instructor-wide
   exceptions from launch scope.
4. **Interaction prototype:** build a coded, dense board and active-Term first
   viewport against a realistic DS100-sized fixture. Include keyboard interaction,
   inline editing, duplicate I/P/A warnings with navigation, cross-cutting items,
   and project milestones.
5. **Migration-impact report:** identify existing schema, REST contract, services,
   imports, tests, and B.2 components that can be retained, adapted, or retired.
6. **Updated roadmap and build prompts:** split implementation only after the
   contract and task flows pass the checkpoint.

## B.2R acceptance checkpoint

The operator reviews working tasks rather than screenshots alone:

1. Create a Course and arrive in its design workspace.
2. Create/edit Topics quickly at DS100 scale, including suggested Topic codes.
3. Create custom activity types and distinguish label from behavior family.
4. Put meetings and assignments into LMs by drag/drop; leave a project
   cross-cutting.
5. Attach Topics with I/P/A, intentionally repeat one action, and navigate the
   warning to the other occurrence.
6. Model a multi-milestone project across meetings and a due time.
7. Create a Term from an Institution calendar, inspect finals/special periods, and
   add a Term-only exception.
8. Use the active-Term first viewport to answer: what is next, what must be
   prepared, what is being covered, and what changed from plan?

Only after acceptance should implementation branches be launched.

## Roadmap after B.2R

Every stage ends in a human checkpoint and may be revised, branched, superseded, or
stopped.

Implementation prompts are published but gate-blocked on GitHub: B.3 is issue #33;
B.4 is issue #34.

| Stage | Outcome | Checkpoint |
|---|---|---|
| B.2R | Activity/calendar contract, DS100 evidence map, dense coded task prototype | Accept the graph, vocabulary, and task hierarchy |
| B.3 | Schema/REST/domain implementation and one-way DS100 importer | Validate clean migration, import fidelity, and curriculum invariants |
| B.4 | Course design studio and Term daily driver on real handlers | Run representative Plan and Run tasks |
| D | Integrated redesign, full validation, and reviewed cutover to `main` | Go/no-go for cutover |
| Review | Term closeout, retrospective, and next-Term feedback loop | Confirm history changes later planning decisions |
| AI | Provider adapters and evidence-backed Course Operations Fellow | Reconfirm advisory/approval boundary |
| Authoring | Assignment, project, and meeting-plan authoring from demonstrated use | Scope from actual workspace use |
| Platform | History/search, collaboration, multi-section/team teaching, broader institutions | Reassess from adoption evidence |
| Blackboard | Ultra interoperability | Begin only with a real sandbox and compatibility fixtures |

## Model routing and experiment record

- Use a low-cost model for the bounded DS100 file inventory, type/reference
  inventories, fixture construction, and mechanical test scaffolds.
- Use a Sonnet-class model for the coded interaction prototype once given the
  accepted task list and fixture manifest.
- Use a frontier model only for the activity/versioning contract, cross-lifecycle
  schema review, and checkpoint synthesis.
- Give every worker a coordinator-produced evidence bundle and exact file manifest;
  do not pay multiple workers to rediscover the repository.
- Record prompts, launcher/model choice, token/turn use, failures, coordinator
  corrections, operator feedback, and which design decisions changed. This record
  is source material for the experiment retrospective and future blog posts.
