# Course Planner B.2R activity, versioning, REST, and calendar contract

Date: 2026-07-14

Status: accepted at the B.2R operator checkpoint on 2026-07-14

Supersedes the activity/Topic ownership and instructor-calendar-override portions
of the Phase A.1 contract. It preserves the accepted authentication, ownership,
artifact provenance, lifecycle, and preview-before-apply boundaries.

## Contract goals

The smallest coherent correction must let an instructor:

1. design Topics, Learning Modules, meetings, and coursework before a Term exists;
2. order Activities in an LM while leaving projects/exams cross-cutting;
3. attach Topics to any Activity with I/P/A, including intentional repetition;
4. preserve instructor labels over stable behavior families;
5. pin reusable Course design into a Term without later Course edits changing it;
6. record delivery corrections without erasing either the plan or history; and
7. inherit an Institution calendar, overlay Term exceptions, and schedule special
   periods such as finals explicitly.

## Vocabulary and identity

### Stable behavior, custom labels

`ActivityBehaviorFamily` is the small stable set required by different lifecycle
code: `meeting`, `coursework`, and `assessment`. It is not displayed as the
instructor's name for an Activity.

An Instructor owns an `ActivityType` identity containing the stable
`behaviorFamily`. Its immutable `ActivityTypeVersion` contains `label`, optional
description, and version metadata. Changing behavior family requires a new identity;
renaming or refining the label creates a new version. A Course explicitly enables
type versions. A Term adoption pins the selected type version and stores its display
label, so renaming "Discussion" to "Studio" does not rewrite history.

Milestone roles are separate behavior: `release`, `work`, `phase_release`, `review`,
and `due`. The milestone `label` remains free text.

### Shared planning identity, explicit lifecycles

`Activity` is a Course-scoped stable identity (`id`, `courseId`, human-facing
`stableCode`, archive state). `ActivityVersion` contains shared reusable fields such
as title, summary, type version, and publication metadata.

Exactly one detail row matches its behavior family:

- `MeetingActivityVersion`: default duration, modality, preparation notes, and
  meeting-specific authoring data;
- `CourseworkActivityVersion`: submission/release policy and coursework-specific
  authoring data; and
- `AssessmentActivityVersion`: assessment modality and assessment-specific
  authoring data.

Projects normally use coursework behavior; exams normally use assessment behavior.
The instructor's custom type decides the displayed noun. The shared identity gives
the board and Topic flow one seam without the traditional "one table, forty nullable
columns" souvenir mug.

## Versioned Course design graph

### Learning Module placement

`LearningModuleVersionActivity` replaces `LearningModuleVersionTopic`:

| Field | Contract |
|---|---|
| `learningModuleVersionId` | immutable LM version |
| `activityVersionId` | exact reusable Activity version placed in that LM version |
| `sequence` | dense ordering within the LM version |
| `notes` | optional placement-specific planning notes |

Within one Course design selection, an Activity identity has at most one primary LM
placement. The service rejects simultaneous primary placement in two selected LM
versions, but old versions may of course show historical placements.

`ActivityVersionLearningModuleScope` is an independent many-to-many relationship
between an Activity version and LM identities, with optional emphasis/notes. It expresses
"the final project recaps LM-01 through LM-06" without rendering six project cards.
An Activity may have neither primary placement nor LM scope.

### Topic actions

`ActivityVersionTopicAction` contains:

- `activityVersionId`;
- `topicVersionId`;
- `action`: `introduced`, `practiced`, or `assessed`;
- optional planning notes and provenance; and
- a unique constraint on `(activityVersionId, topicVersionId, action)`.

The same Topic/action on different Activities is valid. Queries return sibling
occurrences so the UI can warn and link to them. Repetition is never a write error.
The unique constraint only prevents an indistinguishable duplicate row inside one
Activity version.

`ActivityTopicScope` may additionally connect a project/exam to Topic identities
without claiming a specific I/P/A occurrence. This is the future-compatible recap
seam; it does not imply assessment by itself.

### Milestone templates

`ActivityVersionMilestoneTemplate` is an ordered child of an Activity version:

- role and free-text label;
- optional `linkedActivityId` for a Course-design anchor such as "release during
  Lecture 11";
- optional relative timing/default time; and
- provenance/notes.

Templates do not invent calendar dates before a Term exists. They are resolved
during adoption and remain editable in the Term without rewriting the Course.

## Term adoption and delivery

### Planned adoption

`TermActivity` is the shared occurrence identity. It contains:

- `termId`, `activityId`, and `plannedActivityVersionId`;
- pinned `activityTypeVersionId` and adopted display label;
- optional `termLearningModuleId` for its one primary Term placement;
- ordinal within the adopted type (Lecture 11, Lab 4);
- lifecycle state; and
- pointers to the current planned baseline and delivered revision.

Term creation previews adoption from selected LM versions plus explicitly selected
cross-cutting Activity versions. Apply validates version ownership, unique primary
placement, type availability, and ordinal collisions. It does not schedule content
merely because it belongs to an LM.

### Immutable delivery revisions

`TermActivityRevision` is an immutable Term-scoped snapshot with revision number,
base Activity version, title/notes, change reason, author, and timestamp. Its child
Topic-action and subtype-detail rows describe delivered use. The first revision is
materialized from the plan. Active-Term changes create a candidate revision,
preview impact, then atomically advance `TermActivity.deliveredRevisionId` on apply.

Meeting delivery detail stores calendar slot, starts/ends, status, modality, and
override evidence. Coursework/assessment delivery detail stores its distinct
lifecycle state; release/due/review timing lives in milestones rather than a single
overloaded `date` column.

Term closeout freezes delivered pointers. Reopening is an explicit lifecycle command.
Promotion from a delivered revision creates a new Course Activity draft only after
a separate preview/apply decision.

### Term milestones

`TermActivityMilestone` contains role, label, optional source template, optional
linked `TermActivity`, optional `occursAt`, timezone, and anchoring policy:

- `follow_activity`: recompute the instant when the linked meeting moves;
- `fixed_instant`: preserve the instant while retaining the linked Activity as
  context; or
- `standalone`: require an exact instant with no Activity anchor.

At least one of `linkedTermActivityId` or `occursAt` is required. A fixed milestone
may have both, which models "P1 due at 08:00 on the morning of L19." Moves use the
same preview-before-apply impact workflow as meetings.

## Institution and Term calendar contract

### Versioned Institution source

An Institution owns `AcademicCalendar`; immutable `AcademicCalendarVersion` rows
contain:

- dated/ranged `AcademicCalendarEvent` records (holiday, closure, substitute day,
  deadline, or free-label event); and
- `AcademicCalendarPeriod` records with free label and stable behavior:
  `instructional`, `no_instruction`, or `special_schedule`.

Spring recess is `no_instruction`; finals and study periods are explicit special
periods. The label "Finals" is data, not an enum assumption.

A Term pins exactly one Academic Calendar version. New Institution versions never
rewrite existing Term slots.

### Meeting-role materialization

`TermMeetingPattern` references an adopted meeting Activity Type version and defines
weekday/time/timezone rules over a date range. Calendar preview combines those
rules with the pinned Institution events/periods and emits candidates with source
provenance and capacity:

- `available` for ordinary candidate slots;
- `unavailable` for closures/no-instruction periods; and
- `special` when manual or alternate rules are required.

Materialization creates `CalendarSlot` containers only. It never creates or moves a
Term Activity without a separate apply decision. Empty available slots remain
visible planning gaps.

### Term-only exceptions

`TermCalendarException` overlays the materialized calendar with `cancel`, `add`,
`replace`, or `modify`, plus reason, date/time/role target, and provenance. A meeting
scheduled outside an available slot requires an explicit Term exception or meeting
override reason.

`InstructorCalendarOverride` is removed from the launch UI and canonical launch
contract. Existing rows may be retained temporarily for migration/audit, but
materialization does not consume them after cutover.

## REST surface

Every mutation is authenticated, Course/Term-owned, Zod-validated, and uses the
typed API client. Published versions and historical revisions are immutable.

### Instructor vocabulary and Course design

- `GET/POST /api/instructors/me/activity-types`
- `GET/PATCH /api/activity-types/:id`
- `GET/POST /api/activity-types/:id/versions`
- `GET/PUT /api/courses/:id/activity-types` — enable/pin Course vocabulary
- `GET/POST /api/courses/:id/activities`
- `GET/PATCH /api/activities/:id` — identity/archive fields only
- `GET/POST /api/activities/:id/versions`
- `GET /api/activity-versions/:id`
- `POST /api/activity-versions/:id/publish`
- `GET/PUT /api/activity-versions/:id/topic-actions`
- `GET/PUT /api/activity-versions/:id/lm-scope`
- `GET/PUT /api/activity-versions/:id/topic-scope`

Existing Course Topic and LM identity/version routes remain, but LM version payloads
replace Topic membership with ordered Activity-version membership.

### Term plan and run

- `POST /api/terms/:id/adoption-preview`
- `POST /api/terms/:id/adoption-apply`
- `GET /api/terms/:id/activities`
- `GET /api/term-activities/:id`
- `POST /api/term-activities/:id/revision-preview`
- `POST /api/term-activities/:id/revision-apply`
- `POST /api/terms/:id/promote-delivery-preview`
- `POST /api/terms/:id/promote-delivery-apply`

Preview responses include impact, sibling duplicate I/P/A links, calendar conflicts,
expected current revision, and a short-lived preview token/hash. Apply requires that
token/hash plus the expected current revision, preventing a stale inline edit from
overwriting newer delivery evidence. Term milestone additions, edits, and removals
are part of the Term Activity revision preview/apply payload; applied milestone
history is never patched in place.

### Calendar

- existing Institution/Academic Calendar identity and version routes remain;
- `POST /api/terms/:id/calendar-preview`
- `POST /api/terms/:id/calendar-apply`
- `GET/POST /api/terms/:id/calendar-exceptions`
- `PATCH/DELETE /api/term-calendar-exceptions/:id`

There is no launch route for Instructor-wide exceptions.

## Invariants and warnings

Hard invariants:

- immutable published versions and applied delivery revisions;
- cross-Instructor/Course/Term references are rejected;
- one primary LM placement per selected Activity identity;
- one subtype family per Activity version/revision;
- an Activity Type's behavior family never changes after identity creation;
- one indistinguishable Topic/action row per Activity version/revision;
- a Term pins exact Course and Activity Type versions;
- closed Terms reject delivery mutation unless explicitly reopened; and
- calendar apply is deterministic from pinned version + meeting patterns + Term
  exceptions.

Advisory warnings, not blockers:

- repeated Topic/action elsewhere, with links;
- unassigned or cross-cutting Activities;
- Topics planned but not delivered;
- Activities without dates and available slots without Activities;
- milestones whose anchors conflict or cross special periods;
- inferred importer matches/actions; and
- capacity/re-entry concerns around breaks and finals.

## Deliberate deferrals

- instructor-wide calendar exceptions;
- automatic promotion of delivered changes into reusable Course design;
- a whole-Course aggregate publication manifest;
- custom lifecycle code per Activity Type;
- real AI provider integration;
- multi-section/team-teaching conflict resolution; and
- Blackboard-specific semantics.

These remain possible through the identity, provenance, subtype, and adoption seams;
none belongs in the B.3 contract refreeze.
