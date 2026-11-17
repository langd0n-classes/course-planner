import { previewTermCalendar, applyTermCalendar } from "../src/services/redesign/academic-calendar-service";
import { assertSeedForceAllowed } from "../prisma/seed-guard";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { previewMeetingPlacement, applyMeetingPlacement } from "../src/services/redesign/meeting-placement-service";
import { previewMilestoneDating, applyMilestoneDating } from "../src/services/redesign/milestone-dating-service";
import { demoSemesters, loadDemoCourse } from "../src/services/redesign/demo-course-service";

async function main() {
  assertSeedForceAllowed(process.env.DATABASE_URL, process.env.SEED_FORCE_DATABASE);
  const db = new PrismaClient();
  try {
    const runId = randomUUID();
    // One fixed date for every load and assertion, so a semester boundary
    // between two calls cannot change the expected Terms.
    const today = new Date("2026-11-16T12:00:00Z");
    const other = await db.instructor.create({ data: { email: `other-${runId}@example.test`, name: "Other" } });
    const owner = await db.instructor.create({ data: { email: `owner-${runId}@example.test`, name: "Owner" } });
    await loadDemoCourse(db, other.id, undefined, today);
    const otherBefore = await db.instructor.findUniqueOrThrow({
      where: { id: other.id },
      include: { courses: { include: { terms: { include: { activities: true, calendarSlots: true, learningModules: true } }, activities: true, learningModules: true } } },
    });
    const otherTypesBefore = await db.activityType.count({ where: { instructorId: other.id } });

    const first = await loadDemoCourse(db, owner.id, undefined, today);
    assert.equal(first.created, true);
    const course = await db.course.findUniqueOrThrow({
      where: { id: first.courseId },
      include: { terms: { include: { activities: true, calendarSlots: true, meetingPatterns: true, learningModules: true } }, activities: true, learningModules: true },
    });
    const sizes = await db.courseEffortSize.findMany({ where: { courseId: course.id }, orderBy: { sequence: "asc" } });
    assert.deepEqual(sizes.map(({ label, scale, minMinutes, maxMinutes }) => ({ label, scale, minMinutes, maxMinutes })), [
      { label: "Small", scale: "student", minMinutes: 30, maxMinutes: 45 },
      { label: "Medium", scale: "student", minMinutes: 60, maxMinutes: 120 },
      { label: "Large", scale: "student", minMinutes: 180, maxMinutes: 300 },
    ]);
    assert.equal(await db.courseEffortPartKind.count({ where: { courseId: course.id } }), 2);
    const versions = await db.activityVersion.findMany({ where: { activity: { courseId: course.id } }, include: { meetingDetail: true, courseworkDetail: true, assessmentDetail: true, effortParts: true } });
    let partsFound = false;
    for (const version of versions) {
      const detail = version.courseworkDetail ?? version.assessmentDetail;
      if (!detail) continue;
      assert.ok(detail.effortMinMinutes && detail.effortMaxMinutes);
      assert.ok(detail.effortMaxMinutes >= detail.effortMinMinutes);
      if (version.effortParts.length) {
        partsFound = true;
        assert.equal(detail.effortMinMinutes, version.effortParts.reduce((sum, part) => sum + part.minMinutes, 0));
        assert.equal(detail.effortMaxMinutes, version.effortParts.reduce((sum, part) => sum + part.maxMinutes, 0));
      }
    }
    assert.ok(partsFound);
    const effortBefore = { sizes, versions };
    assert.equal(course.terms.length, 2);
    const [current, next] = demoSemesters(today);
    const termFor = (code: string) => {
      const term = course.terms.find((candidate) => candidate.code === code);
      assert.ok(term, `Term ${code} is missing`);
      return term;
    };
    for (const semester of [current, next]) {
      const term = termFor(semester.code);
      assert.equal(term.name, semester.name);
      assert.equal(term.startDate.toISOString().slice(0, 10), semester.startDate.toISOString().slice(0, 10));
      assert.equal(term.endDate.toISOString().slice(0, 10), semester.endDate.toISOString().slice(0, 10));
      assert.equal(term.status, semester.inProgress ? "active" : "planned");
      assert.ok(term.calendarSlots.length > 20);
      assert.equal(term.meetingPatterns.length, 1);
    }
    // The current Term is populated. The next Term has its calendar only.
    const currentTerm = termFor(current.code);
    assert.equal(currentTerm.learningModules.length, course.learningModules.length);
    assert.equal(currentTerm.activities.length, course.activities.length);
    assert.ok(currentTerm.activities.length > 0);
    const milestones = await db.termActivityMilestone.findMany({
      where: { termActivityRevision: { termActivity: { termId: currentTerm.id } } },
    });
    assert.equal(milestones.length, 4);
    assert.equal(milestones.filter((row) => row.anchorPolicy === "follow_activity" && row.linkedTermActivityId).length, 4);
    // The unlinked demo template has nothing to follow, so adoption creates no milestone for it.
    assert.equal(milestones.filter((row) => row.anchorPolicy === "standalone").length, 0);
    assert.ok(milestones.every((row) => row.occursAt === null && row.sourceTemplateId && row.timeZone === "UTC"));
    const datingInput = { instructorId: owner.id, termId: currentTerm.id };
    const placementInput = { ...datingInput, now: () => currentTerm.startDate, defaultMeetingTime: { startTimeLocal: "10:00", endTimeLocal: "10:50", timeZone: "UTC" } };
    const placement = await previewMeetingPlacement(db, placementInput);
    await applyMeetingPlacement(db, { ...placementInput, previewToken: placement.previewToken });
    const placedActivityId = placement.placements[0].termActivityId;
    const readPlaced = () => db.termActivity.findUniqueOrThrow({
      where: { id: placedActivityId },
      include: { plannedRevision: { include: { meetingDetail: true } } },
    });
    const placedBeforeCalendar = await readPlaced();
    const patternsBefore = await db.termMeetingPattern.findMany({ where: { termId: currentTerm.id } });
    const courseworkType = versions.find(version => version.courseworkDetail)!.activityTypeVersionId;
    const storedOutsideInput = await db.termMeetingPattern.create({ data: {
      termId: currentTerm.id, activityTypeVersionId: courseworkType,
      daysOfWeek: ["monday"], startTimeLocal: "12:00", timeZone: "UTC",
      startsOn: currentTerm.startDate, endsOn: currentTerm.endDate,
    } });
    const calendarInput = { ...datingInput, meetingPatterns: patternsBefore.map(pattern => ({
      activityTypeVersionId: pattern.activityTypeVersionId, label: pattern.label,
      daysOfWeek: pattern.daysOfWeek, startTimeLocal: pattern.startTimeLocal,
      endTimeLocal: pattern.endTimeLocal, timeZone: pattern.timeZone,
      startsOn: pattern.startsOn.toISOString().slice(0, 10),
      endsOn: pattern.endsOn.toISOString().slice(0, 10),
    })) };
    const calendar = await previewTermCalendar(db, calendarInput);
    await applyTermCalendar(db, { ...calendarInput, previewToken: calendar.previewToken,
      expectedCurrentCalendarSlotCount: calendar.expectedCurrentCalendarSlotCount });
    const placedAfterCalendar = await readPlaced();
    assert.equal(placedAfterCalendar.plannedRevision?.meetingDetail?.calendarSlotId,
      placedBeforeCalendar.plannedRevision?.meetingDetail?.calendarSlotId);
    assert.ok(placedAfterCalendar.plannedRevision?.meetingDetail?.calendarSlotId);
    assert.ok(await db.termMeetingPattern.findUnique({ where: { id: storedOutsideInput.id } }));
    console.log("Postgres calendar apply: retained meeting slot pointer and unrelated stored pattern passed");
    // Roll back this isolated regression fixture after checking real FK behavior.
    const calendarRegressionDone = new Error("calendar regression complete");
    try {
      await db.$transaction(async tx => {
        const testTerm = await tx.term.create({ data: {
          courseId: currentTerm.courseId, institutionId: currentTerm.institutionId,
          academicCalendarId: currentTerm.academicCalendarId,
          academicCalendarVersionId: currentTerm.academicCalendarVersionId,
          code: `review-${runId}`, name: "Calendar regression", status: "active",
          startDate: new Date("2027-03-01"), endDate: new Date("2027-03-05"),
        } });
        const lectureVersion = versions.find(version => version.meetingDetail)!;
        const labType = await tx.activityType.create({ data: { instructorId: owner.id, behaviorFamily: "meeting" } });
        const labTypeVersion = await tx.activityTypeVersion.create({ data: { activityTypeId: labType.id, revision: 1, label: "Lab", createdByInstructorId: owner.id } });
        const testDb = { $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx) };
        const pattern = (activityTypeVersionId: string, label: string, daysOfWeek: string[]) => ({
          activityTypeVersionId, label, daysOfWeek, startTimeLocal: "09:00", endTimeLocal: "10:00",
          timeZone: "America/New_York", startsOn: "2027-03-01", endsOn: "2027-03-05",
        });
        const lecturePattern = pattern(lectureVersion.activityTypeVersionId, "Lecture", ["monday", "wednesday"]);
        const labPattern = pattern(labTypeVersion.id, "Lab", ["friday"]);
        const request = { instructorId: owner.id, termId: testTerm.id, meetingPatterns: [lecturePattern, labPattern] };
        const initial = await previewTermCalendar(testDb, request);
        await applyTermCalendar(testDb, { ...request, previewToken: initial.previewToken, expectedCurrentCalendarSlotCount: initial.expectedCurrentCalendarSlotCount });
        const slots = await tx.calendarSlot.findMany({ where: { termId: testTerm.id }, orderBy: { date: "asc" } });
        assert.equal(slots.length, 3);
        // Distinct master Activities are required by the Term adoption key.
        const meetingVersions = versions.filter(version => version.meetingDetail);
        assert.ok(meetingVersions.length >= 2);
        for (const [index, typeVersion] of [lectureVersion.activityTypeVersionId, labTypeVersion.id].entries()) {
          const version = meetingVersions[index];
          const activity = await tx.termActivity.create({ data: {
            termId: testTerm.id, courseId: testTerm.courseId, activityId: version.activityId,
            plannedActivityVersionId: version.id, activityTypeVersionId: typeVersion, adoptedLabel: index ? "Lab" : "Lecture",
          } });
          const slot = slots[index ? 2 : 0];
          const revision = await tx.termActivityRevision.create({ data: {
            termActivityId: activity.id, baseActivityVersionId: version.id, revision: 1, title: activity.adoptedLabel,
            meetingDetail: { create: { calendarSlotId: slot.id, startsAt: new Date(`${slot.date.toISOString().slice(0, 10)}T14:00:00Z`), status: "scheduled" } },
          } });
          await tx.termActivity.update({ where: { id: activity.id }, data: { plannedRevisionId: revision.id } });
        }
        const state = async () => ({
          slots: await tx.calendarSlot.findMany({ where: { termId: testTerm.id }, orderBy: { id: "asc" } }),
          patterns: await tx.termMeetingPattern.findMany({ where: { termId: testTerm.id }, orderBy: { id: "asc" } }),
          meetings: await tx.termMeetingActivityRevision.findMany({ where: { termActivityRevision: { termActivity: { termId: testTerm.id } } }, orderBy: { termActivityRevisionId: "asc" } }),
        });
        const beforePartial = await state();
        const partialRequest = { ...request, meetingPatterns: [labPattern] };
        const partial = await previewTermCalendar(testDb, partialRequest);
        await applyTermCalendar(testDb, { ...partialRequest, previewToken: partial.previewToken, expectedCurrentCalendarSlotCount: partial.expectedCurrentCalendarSlotCount });
        const afterPartial = await state();
        assert.deepEqual(afterPartial.slots.map(slot => slot.id), beforePartial.slots.map(slot => slot.id));
        assert.deepEqual(afterPartial.meetings, beforePartial.meetings);
        const removeRequest = { ...request, meetingPatterns: [{ ...lecturePattern, daysOfWeek: ["wednesday"] }] };
        const removal = await previewTermCalendar(testDb, removeRequest);
        assert.equal(removal.affectedMeetingCount, 1);
        const beforeRefusal = await state();
        await assert.rejects(applyTermCalendar(testDb, { ...removeRequest, previewToken: removal.previewToken, expectedCurrentCalendarSlotCount: removal.expectedCurrentCalendarSlotCount }), { name: "ConcurrencyConflictError" });
        assert.deepEqual(await state(), beforeRefusal);
        throw calendarRegressionDone;
      }, { timeout: 30_000 });
    } catch (error) { if (error !== calendarRegressionDone) throw error; }
    console.log("Postgres calendar regression: Lab-only reapply preserves Lecture slots and both meeting links; referenced-date removal conflicts (HTTP 409) without writes passed");

    const dating = await previewMilestoneDating(db, datingInput);
    assert.equal(dating.dates.length, 4);
    assert.equal(dating.creates.length, 0);
    const datingState = () => db.termActivity.findMany({
      where: { termId: currentTerm.id }, orderBy: { id: "asc" },
      include: { revisions: { orderBy: { revision: "asc" }, include: {
        milestones: { orderBy: { id: "asc" } }, topicActions: { orderBy: { id: "asc" } },
        meetingDetail: true, courseworkDetail: true, assessmentDetail: true,
      } } },
    });
    const beforeStale = await datingState();
    await assert.rejects(applyMilestoneDating(db, { ...datingInput, previewToken: "stale" }), { name: "ConcurrencyConflictError" });
    assert.deepEqual(await datingState(), beforeStale);
    const changedActivity = beforeStale.find(row => row.plannedRevisionId && row.revisions.some(revision => revision.milestones.length))!;
    await db.termActivity.update({ where: { id: changedActivity.id }, data: { plannedRevisionId: null } });
    const afterConcurrentChange = await datingState();
    await assert.rejects(applyMilestoneDating(db, { ...datingInput, previewToken: dating.previewToken }), { name: "ConcurrencyConflictError" });
    assert.deepEqual(await datingState(), afterConcurrentChange);
    await db.termActivity.update({ where: { id: changedActivity.id }, data: { plannedRevisionId: changedActivity.plannedRevisionId } });
    const previousRevision = changedActivity.revisions.find(revision => revision.id === changedActivity.plannedRevisionId)!;
    const withoutMilestones = await db.termActivityRevision.create({ data: {
      termActivityId: changedActivity.id,
      baseActivityVersionId: previousRevision.baseActivityVersionId,
      revision: Math.max(...changedActivity.revisions.map(revision => revision.revision)) + 1,
      title: previousRevision.title,
      courseworkDetail: previousRevision.courseworkDetail ? { create: {} } : undefined,
      assessmentDetail: previousRevision.assessmentDetail ? { create: {} } : undefined,
    } });
    await db.termActivity.update({ where: { id: changedActivity.id }, data: { plannedRevisionId: withoutMilestones.id } });
    const removedPreview = await previewMilestoneDating(db, datingInput);
    assert.equal(removedPreview.creates.filter(item => item.termActivityId === changedActivity.id).length, 0);
    await db.termActivity.update({ where: { id: changedActivity.id }, data: { plannedRevisionId: changedActivity.plannedRevisionId } });
    await db.termActivityRevision.delete({ where: { id: withoutMilestones.id } });
    console.log("Postgres milestone dating: earlier template milestones prevent restoring instructor removals passed");
    console.log("Postgres milestone dating: stale token and concurrent Activity change conflict without persisted writes passed");
    const dated = await applyMilestoneDating(db, { ...datingInput, previewToken: dating.previewToken });
    assert.equal(dated.datedCount, dating.dates.length);
    assert.equal(dated.createdCount, dating.creates.length);
    const datedRows = await db.termActivity.findMany({ where: { termId: currentTerm.id }, include: { plannedRevision: { include: { milestones: true } } } });
    // Fall starts on Wednesday September 2; the two meetings use Wednesday and Friday.
    const expectedInstants = {
      "Practice opens": "2026-09-02T10:00:00.000Z",
      "Practice due": "2026-09-09T17:00:00.000Z",
      "Model check opens": "2026-09-04T10:00:00.000Z",
      "Model check due": "2026-09-11T17:00:00.000Z",
    };
    assert.deepEqual(Object.fromEntries(datedRows.flatMap(row => row.plannedRevision?.milestones ?? []).map(m => [m.label, m.occursAt?.toISOString()])), expectedInstants);
    const repeatedDating = await previewMilestoneDating(db, datingInput);
    assert.equal(repeatedDating.alreadyDatedCount, 4);
    const revisionCount = await db.termActivityRevision.count({ where: { termActivity: { termId: currentTerm.id } } });
    assert.deepEqual(await applyMilestoneDating(db, { ...datingInput, previewToken: repeatedDating.previewToken }), { kind: "applied", datedCount: 0, createdCount: 0 });
    assert.equal(await db.termActivityRevision.count({ where: { termActivity: { termId: currentTerm.id } } }), revisionCount);
    console.log("Postgres milestone dating: four expected instants, matching preview/apply counts, repeat apply without writes passed");
    const nextTerm = termFor(next.code);
    assert.equal(nextTerm.learningModules.length, 0);
    assert.equal(nextTerm.activities.length, 0);
    const calendarCount = await db.academicCalendar.count({ where: { institutionId: currentTerm.institutionId } });
    assert.equal(calendarCount, current.academicYear === next.academicYear ? 1 : 2);

    const countsBefore = await Promise.all([
      db.course.count(), db.term.count(), db.institution.count(), db.academicCalendar.count(),
      db.calendarSlot.count(), db.termActivity.count(), db.instructorInstitution.count(), db.termActivityMilestone.count(),
    ]);
    const second = await loadDemoCourse(db, owner.id, undefined, today);
    assert.deepEqual(second, { courseId: first.courseId, created: false });
    const countsAfter = await Promise.all([
      db.course.count(), db.term.count(), db.institution.count(), db.academicCalendar.count(),
      db.calendarSlot.count(), db.termActivity.count(), db.instructorInstitution.count(), db.termActivityMilestone.count(),
    ]);
    assert.deepEqual(countsAfter, countsBefore);
    assert.deepEqual(await db.courseEffortSize.findMany({ where: { courseId: course.id }, orderBy: { sequence: "asc" } }), effortBefore.sizes);
    assert.deepEqual(await db.activityVersion.findMany({ where: { activity: { courseId: course.id } }, include: { meetingDetail: true, courseworkDetail: true, assessmentDetail: true, effortParts: true } }), effortBefore.versions);

    // A load at a later date adds the Terms that are then current and next,
    // and leaves the earlier Terms in place.
    const later = new Date(next.endDate.getTime() + 86_400_000);
    const [laterCurrent, laterNext] = demoSemesters(later);
    const third = await loadDemoCourse(db, owner.id, undefined, later);
    assert.deepEqual(third, { courseId: first.courseId, created: false });
    const laterTerms = await db.term.findMany({ where: { courseId: first.courseId }, include: { activities: true } });
    assert.deepEqual(
      laterTerms.map((term) => term.code).sort(),
      [...new Set([current.code, next.code, laterCurrent.code, laterNext.code])].sort(),
    );
    assert.ok(laterTerms.find((term) => term.code === laterCurrent.code)!.activities.length > 0);
    assert.equal(await db.course.count({ where: { instructorId: owner.id } }), 1);
    const otherAfter = await db.instructor.findUniqueOrThrow({
      where: { id: other.id },
      include: { courses: { include: { terms: { include: { activities: true, calendarSlots: true, learningModules: true } }, activities: true, learningModules: true } } },
    });
    assert.deepEqual(otherAfter, otherBefore);
    assert.equal(await db.activityType.count({ where: { instructorId: other.id } }), otherTypesBefore);

    const ambiguous = await db.instructor.create({ data: { email: `ambiguous-${runId}@example.test`, name: "Ambiguous" } });
    const coursesBefore = await db.course.count();
    await assert.rejects(
      loadDemoCourse(db, ambiguous.id, { apply: async () => ({ ambiguities: [{ path: "activities[0]" }] }) } as never, today),
      /ambiguities/,
    );
    assert.equal(await db.course.count(), coursesBefore);
    assert.equal((await db.instructor.findUniqueOrThrow({ where: { id: ambiguous.id } })).nextCourseSerial, 1);
    console.log("Postgres demo load: current and next Term, calendars, adopted activities, repeat load, later top-up, and instructor isolation passed");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
