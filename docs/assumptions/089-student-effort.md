# Course sizes and student effort (#89)

- Effort uses an integer low and high in minutes; the interface uses hours and
  minutes. Named sizes alone cannot be summed. Both bounds are absent or set;
  a set range runs from at least 1 minute to at most 60000 minutes, with high
  at least low. Services, request schemas, and database checks enforce this.
- Each Course defines its own named sizes and part kinds. There is no built-in
  scale, because the app serves any course. Labels are trimmed and nonempty.
  Labels are unique within the Course (and scale for sizes).
- An Activity stores the minute range rather than a size reference. A size label
  appears only for an exact range match. Editing a size cannot resize earlier
  Activities. Matching follows the instructor's size order when ranges coincide.
- Estimates describe the whole item, not each day in its work window. Meetings
  have no effort estimate; coursework and assessments do.
- Optional parts contain a label snapshot, range, note, and optional Course part
  kind link. The service sums both bounds when parts exist, because substantial
  steps must remain visible. Renaming or deleting a kind preserves the snapshot
  label; deletion clears its link. Part sequences are unique and nonnegative.
- New Activity versions copy the estimate and parts. Omitting these inputs
  preserves the source snapshot; an explicit empty parts list removes the parts,
  and explicit null bounds clear the estimate. Effort saves also preserve Topic
  actions, module scopes, and milestone templates, so editing effort does not
  discard other version content. Existing module and Term version pins remain.
- Term revision bounds are an optional override; null uses the base Activity
  version. Adoption sets no override, and Term revisions do not override parts.
  The effective revision is delivered when present, otherwise planned.
- The size table reserves `student` and `grading` scales. Only student sizes are
  exposed in this build; grading effort, workload views, and feeds are deferred.
- No coursework or assessment detail editor existed. The estimate group is in
  ActivityBoard's selected Activity form, with draft-save and publish controls.
  Course settings changes refresh the size choices and card labels.
- The existing Term revision preview accepts an optional pointer target, defaulting
  to delivered. Planned Terms use the planned target; active Terms use delivered.
  This makes the preview's expected pointer agree with the apply operation.
- Inputs use separate whole hours and minutes; minutes run from 0 to 59. One
  blank component means zero, both blank bounds mean no estimate, and a partially
  entered range is invalid. This avoids ambiguous decimal-hour input.
- Demo sizes are Small (30–45 minutes), Medium (60–120), and Large (180–300).
  Reading and Practice are demo part kinds. New demo loads and default seeds add
  estimates before adoption; repeat loads preserve instructor edits. The demo
  Model Check uses assessment behavior so both eligible families are represented.
- A pre-existing mock seed tried to close an already active Term with expected
  status planned. It now uses active, so the mock can initialize and exercise
  the effort controls.

## Architecture notes

`CourseEffortSize` stores ordered Course-local labels and minute ranges, unique
by Course, `EffortScale`, and label. `CourseEffortPartKind` stores ordered Course
part vocabulary. `ActivityVersionEffortPart` stores ordered immutable labels,
ranges, optional notes, and optional kind links. Course deletion cascades the
vocabulary; version deletion cascades parts; kind deletion nulls the link.
Coursework and assessment version details store nullable effort bounds, and their
Term revision details store nullable overrides. The handwritten migration adds
paired-null, range, and nonempty-label constraints.

`effort-service.ts` owns student vocabulary CRUD/reorder, Course ownership, part
kind scoping, and estimate normalization. `activity-service.ts` reads and writes
estimates and parts through immutable draft/publish versions, copying omitted
snapshot content from the source. `term-activity-service.ts` validates and writes
overrides through revision preview/apply. Revision hydration and serializers
include the base and effective estimates. `src/lib/effort.ts` provides formatting,
hours/minutes parsing, exact size matching, part sums, and override fallback.

`/api/courses/[id]/effort-sizes` and `/effort-part-kinds` provide GET lists, POST
creation, and PUT reordering with every entry ID. Their `[entryId]` routes provide
PATCH replacement and DELETE. Shared handlers use authenticated ownership, Zod
schemas, serializers, and the typed redesign API client. Activity version and
Term revision endpoints carry the new fields; revision previews can specify the
planned or delivered pointer. The mock backend supports vocabulary, version
estimates/parts, effective Term estimates, and override preview/apply.

`CourseEffortSettings` edits vocabulary in the Course workspace.
`ActivityEffortEditor` adds the estimated student effort group to ActivityBoard;
`EffortRangeInput` supplies labeled whole-hour/minute fields and linked errors.
`EffortSummary` shows an exact size label plus range, or “Not sized.”
`TermActivityEffortList` presents coursework and assessment estimates in the Term
workspace, with `TermEffortEditor` for override preview/apply and clearing. The
Term workspace page only mounts this component. `seedDemoEffort` supplies new demo
Course vocabulary and estimates before adoption; the default seed uses it too.
