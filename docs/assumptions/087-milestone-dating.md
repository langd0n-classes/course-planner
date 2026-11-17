# Milestone dating (#87)

## Decisions and reasons

- Date only undated `follow_activity` milestones whose linked Term Activity has a planned meeting with a date. Existing dates belong to the instructor and remain unchanged.
- Resolve existing milestones through `sourceTemplateId`, including templates from older Activity versions. The planned revision's base Activity version supplies the templates used to create missing milestones. These are distinct sources because a later base version must not silently replace an existing milestone's rule.
- Use the meeting's `startsAt` local date in the template zone, or its Calendar Slot date when there is no instant. Add `relativeDays` as calendar days (null means zero), then use the template's default time and time zone. Calendar-day addition preserves wall times across daylight-saving changes.
- Export and reuse meeting placement's `localInstant` and `localDate`. A nonexistent local time leaves only that milestone undated; an ambiguous local time resolves to its earlier instant.
- Report `linked_meeting_undated`, `linked_activity_not_a_meeting`, `no_template`, `no_default_time`, `no_time_zone`, and `local_time_does_not_exist` separately so the instructor can repair each missing input. A missing linked Term Activity uses `linked_meeting_undated`, since there is no additional missing-link reason in this contract.
- Create each missing base-version template milestone only if another unarchived Term Activity has its linked Activity identity. Match adoption's rule, including refusing self-links. A new milestone may remain undated when the link exists but its meeting or template has no usable date or time.
- Keep linked Term Activity identities in the planner even when they have no planned revision yet. A template can follow such an Activity; its date waits until a meeting revision has a date.
- Order milestones by creation time and id in the token input so equal transaction timestamps cannot reorder an otherwise unchanged preview.
- A fresh empty apply returns zero dated and created counts and writes no revisions. This supports repeat application without treating a completed plan as an error. Reusing an old token after a nonempty apply is still a conflict.
- Preview and apply both refuse a closed Term. Preview hashes all loaded planned pointers, milestone rules, meeting inputs, and slots, so a change to any input requires another preview. Apply compares each changed Activity's planned pointer again and uses a compare-and-swap update.
- Copy each changed Activity's complete planned snapshot into one new revision with reason `Milestones dated from linked meetings`. Copy effort fields verbatim so an instructor override remains an override. Keep Topic actions and every other milestone.
- Count unique milestones in the workspace notice: a newly created milestone that can also be dated counts once. The API reports separate dated and created counts because a milestone may participate in both operations.
- Extend Term GET with optional ordered `meetingPatterns`, using the first stored pattern's time zone for workspace dates and order checks. With no pattern, order checks receive no zone and the dating panel displays each template's zone. This avoids using the browser's time zone as a hidden default.
- Load prerequisite pairs independently. On failure, run other checks with no pairs and explain that prerequisite order was not checked. Resolve Activity revision Topic-version references as well as current Course Topics, because older snapshots still need stable Topic identities and labels.
- Load the dating preview with each workspace reload, including after meeting placement. A failed dating preview leaves the workspace usable and offers Retry.
- Preserve the existing workspace panel style. The dating panel previews on mount, has a labelled heading and a persistent polite live region, requires another preview after an apply error, and guards duplicate applies with a synchronous ref.
- Rename adoption's `standaloneMilestones` field to `notCreatedMilestones`, because these templates create no Term milestone. The concrete mock backend has no adoption preview implementation or old field; injected mock implementations derive their types from the client and use the renamed field in their fixtures.

## Known limit

Moving a linked meeting later does not change any dated milestone. Re-dating needs a separate design; the panel tells instructors to edit these dates by hand.

## Architecture notes

`milestone-dating.ts` is a pure planner with explicit Activity, template, planned-meeting and slot inputs. It returns date proposals, missing milestones to create, undatable milestones with reasons, and the already-dated count. Existing milestone ids identify date updates; a null milestone id plus a source template identifies a creation.

`milestone-dating-service.ts` owns authorization, preview hashing, immutable revision creation, and atomic planned-pointer updates. It reads source-template relations for existing milestones and ordered base-version templates for backfill. Apply runs in one transaction with meeting placement's timeout and max-wait settings; unique revision races map to a conflict. Empty apply performs no writes.

The preview and apply routes validate Zod request schemas. `toMilestoneDatingPreviewDto` serializes only contract fields and ISO instants. The typed redesign client supplies the new endpoints to `DateMilestonesPanel` and `TermWorkspacePage`. The workspace recomputes `checkTermOrder` from loaded revisions, slots, Topic identities, prerequisites and Term zone after every reload; `TermOrderFindingsPanel` supplies the existing findings UI.

No schema change, migration or dependency is required. The PostgreSQL demo check places meetings, dates the four adopted milestones, checks their expected instants and preview/apply counts, and confirms that a fresh second apply writes no revisions.
