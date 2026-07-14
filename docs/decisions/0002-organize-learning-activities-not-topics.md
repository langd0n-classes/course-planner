# ADR-0002: Learning Modules organize activities, not Topics

- **Status:** accepted
- **Date:** 2026-07-13
- **Deciders:** Langdon White, course-planner coordinator (Mimir review)

## Context

The redesign currently treats a Topic's Learning Module as its primary ownership
relationship. Operator review of the B.2 workspace showed that this does not match
how a real course is designed or run. Topics are used in meetings and coursework:
a Topic may be introduced in a lecture, practiced in a lab and assignment, and
assessed more than once. Learning Modules organize those learning activities.

Projects and exams complicate direct Topic-to-Learning-Module ownership further.
They may recap several Learning Modules, remain intentionally cross-cutting, and
participate in several meetings through release, work, review, phase, and due
milestones. This is a **product** decision: the graph must support the operator's
actual DS100 planning and daily operation before more UI is built on it.

Institutions and courses also use different vocabulary for activities with similar
behavior. A recitation, discussion, and lab may all need meeting scheduling while
retaining the instructor's chosen label.

## Options considered

1. **Keep Topic ownership and add exceptions** — smallest schema change, but
   assignments, repeated I/P/A use, and cross-cutting projects become exceptions to
   the main model.
2. **Put Topics directly in many Learning Modules** — improves reuse but still
   skips the meeting or assignment where learning actually occurs.
3. **Make activities the organizing seam** — Learning Modules place activities;
   Topics attach to activities with I/P/A actions; cross-cutting scope and project
   milestones remain explicit.

For activity representation, one universal nullable table was considered against a
shared planning identity with explicit subtype details. The latter preserves a
uniform board without claiming that meetings, assignments, projects, and exams have
one lifecycle.

## Decision

Learning Modules organize course-level learning activities, not Topics directly.

- Meetings and coursework are first-class activities that may have one primary
  Learning Module for board placement, or none.
- A separate scope relationship may connect an activity to multiple Learning
  Modules or Topics without duplicating its board card.
- Topics attach to activities through an action: Introduced, Practiced, or Assessed
  (I/P/A).
- Repeated use of the same Topic and action is valid. The product warns and links to
  the other occurrence; it does not reject it.
- Projects and exams may remain outside a Learning Module. Their release, work,
  review, phase, and due milestones can be attached to meetings or exact times.
- Instructor-owned activity types retain a custom display label while mapping to a
  stable behavior family. Milestone roles are separate from activity types.
- A Term preserves the adopted type label/version so later renames do not rewrite
  history.

Use a common planning-item identity only where the UI and shared relationships need
one. Keep meeting, assignment, project, and exam lifecycle details explicit rather
than accumulating nullable fields in a universal activity record.

The exact Prisma table layout and version-pointer strategy must be proven in a
bounded contract spike using the DS100 exemplar before the schema is refrozen.

## Why

The activity seam corresponds to what an instructor can plan, schedule, deliver,
move, cancel, release, or make due. It therefore supports both course design and the
active-Term daily driver. Direct Topic ownership cannot explain where a Topic is
introduced or assessed and makes legitimate repetition appear to be duplication.

One primary Learning Module keeps drag/drop placement deterministic. Independent
scope links let a project recap several modules without rendering several copies of
the same project. Separating custom labels from behavior families makes the product
generic without asking every institution to adopt Course Planner's vocabulary.

Revisit the single-primary-Learning-Module rule if real course imports reveal
activities whose ordinary placement, not merely their scope, must be simultaneous
in several modules. Revisit the behavior families when two custom types mapped to
one family demonstrate materially different scheduling, authoring, or lifecycle
needs.

## Consequences

- `Topic.learningModuleId` and `LearningModuleVersionTopic` no longer describe the
  target architecture and must be superseded rather than extended.
- Coverage/gap analysis must traverse activity-topic I/P/A relationships and term
  delivery evidence.
- The curriculum board drags meeting and coursework cards into Learning Modules;
  Topics are edited inside those cards and in a Topic-centric flow view.
- Existing Session and Assessment concepts need migration into the shared planning
  seam while retaining their distinct behavior.
- Phase B.2 visual styling can be retained, but its information architecture cannot
  be treated as accepted until it is rebuilt against realistic activity scale.
