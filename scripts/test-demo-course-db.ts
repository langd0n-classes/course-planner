import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { previewMeetingPlacement, applyMeetingPlacement } from "../src/services/redesign/meeting-placement-service";
import { previewMilestoneDating, applyMilestoneDating } from "../src/services/redesign/milestone-dating-service";
import { demoSemesters, loadDemoCourse } from "../src/services/redesign/demo-course-service";

async function main() {
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
    const versions = await db.activityVersion.findMany({ where: { activity: { courseId: course.id } }, include: { courseworkDetail: true, assessmentDetail: true, effortParts: true } });
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
    const placementInput = { ...datingInput, defaultMeetingTime: { startTimeLocal: "10:00", endTimeLocal: "10:50", timeZone: "UTC" } };
    const placement = await previewMeetingPlacement(db, placementInput);
    await applyMeetingPlacement(db, { ...placementInput, previewToken: placement.previewToken });
    const dating = await previewMilestoneDating(db, datingInput);
    assert.equal(dating.dates.length, 4);
    assert.equal(dating.creates.length, 0);
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
    assert.deepEqual(await db.activityVersion.findMany({ where: { activity: { courseId: course.id } }, include: { courseworkDetail: true, assessmentDetail: true, effortParts: true } }), effortBefore.versions);

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
