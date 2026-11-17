# Term date-order checks (#98)

- The checker requires `topicVersions`, `calendarSlots`, and `prerequisites`
  alongside the daily driver's Activity/revision DTO inputs. Topic versions
  resolve actions to stable Topic IDs so different revisions compare together;
  slots supply meeting-date fallbacks. Prerequisites already reach the client
  through `redesignApi.listTopicPrerequisites(courseId)`; no route is added.
- A date-only value is compared as written. An instant is compared by its
  local date: a milestone's valid time zone first, else the valid `timeZone`
  argument (the Term's zone), else UTC. Valid instants without a valid zone use
  `new Date(value).toISOString().slice(0, 10)`; invalid instants use their first
  ten characters. Values of ten characters or fewer are returned as written.
  Zoned dates use `formatToParts` year, month, and day to build `YYYY-MM-DD`.
  The host time zone is never used. A meeting uses the local date of `startsAt`
  when present and its Calendar Slot date only when `startsAt` is absent,
  matching `buildTermDailyDriver` even when a delivered revision keeps an old slot.
- Sentences name a Topic from the optional `topicLabels` argument. A Topic with
  no label is "A Topic", never an id.
- Known limit: a coursework item's Introduce and Practice actions are dated by
  its due date, the same as its Assess actions. Work that students start before
  the Topic is introduced is not reported when the due date is after the
  introduction.
- `never_introduced` produces one finding per Topic using its earliest dated
  Practice or Assess action. Its absent introduction Activity and date are null.
  An undated introduction still exists, so it prevents a false absence finding.
  Any undated Introduce also suppresses Practice/Assess-before-Introduce findings
  for that Topic and prerequisite comparisons involving that Topic.
- A linked-due finding has a null Topic ID because a milestone need not have a
  Topic action. Findings sort by later date (`dates[1] ?? dates[0]`), then Topic ID (null
  first), kind, first Activity ID, and second Activity ID. String comparisons
  use `<`, independent of locale and input array order.
- Each undated Activity and each undated milestone is a separate undated item;
  an Activity without an effective revision is also undated. This makes the
  incomplete-check count explicit even when one Activity has several gaps.
  The panel uses singular wording for one item and lists each undated Activity
  once by label (else ID), with its number of undated milestones.
- For coursework and assessment actions, use the due milestone date, or the
  latest dated milestone when no due milestone exists. If there are several due
  milestones, use the latest dated due milestone; an undated due milestone does
  not fall back to another role because the due date is unknown. This same
  Activity date applies to Introduce and Practice actions as well as Assess.
- Cancellation is recognized on the Term Activity lifecycle state and effective
  detail status/lifecycle state, so canceled coursework is ignored as well as
  canceled meetings. Both `canceled` and `cancelled` are recognized without
  regard to letter case. Archived Term Activities are ignored entirely.
  Actions with an unknown Topic-version identity are skipped and each is counted
  in `unmappedActionCount`; the panel reports a positive count in a sentence.
  Equal-date occurrences break ties by Activity ID for stable results independent
  of input order.
- The panel receives Activity labels as a record and falls back to Activity IDs
  when a label is absent. `never_introduced` shows only its existing Activity.
  The panel remains separate from the workspace
  until the later integration step. Lists have `role="list"`; the finding count
  has `role="status"`.

## Architecture notes

- `src/lib/term-order-checks.ts` exports the pure advisory `checkTermOrder`
  function and input/result types. It uses the daily driver's Term Activity and
  planned/delivered revision DTOs, stable Topic-version identity mappings,
  Calendar Slots, and prerequisite pairs. Optional `timeZone` supplies the Term's
  local date zone; optional `topicLabels` supplies names for finding sentences.
  It reports five order findings and counts undated Activities/milestones and
  unmapped Topic actions without mutating data. The existing
  `redesignApi.listTopicPrerequisites(courseId)` call supplies prerequisite data;
  no new service route is needed.
- `src/components/redesign/TermOrderFindingsPanel.tsx` renders a labelled section
  and list with finding sentences, Activity labels, dates, finding count, and
  undated count. Its result and labels are props; loading and Term workspace
  integration belong to a later step.
