import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { demoSemester, loadDemoCourse } from "../src/services/redesign/demo-course-service";

async function main() {
  const db = new PrismaClient();
  try {
    const runId = randomUUID();
    const other = await db.instructor.create({ data: { email: `other-${runId}@example.test`, name: "Other" } });
    const owner = await db.instructor.create({ data: { email: `owner-${runId}@example.test`, name: "Owner" } });
    await loadDemoCourse(db, other.id);
    const otherBefore = await db.instructor.findUniqueOrThrow({
      where: { id: other.id },
      include: { courses: { include: { terms: { include: { activities: true, calendarSlots: true, learningModules: true } }, activities: true, learningModules: true } } },
    });
    const otherTypesBefore = await db.activityType.count({ where: { instructorId: other.id } });

    const first = await loadDemoCourse(db, owner.id);
    assert.equal(first.created, true);
    const course = await db.course.findUniqueOrThrow({
      where: { id: first.courseId },
      include: { terms: { include: { activities: true, calendarSlots: true, meetingPatterns: true, learningModules: true } }, activities: true, learningModules: true },
    });
    assert.equal(course.terms.length, 1);
    const term = course.terms[0];
    const semester = demoSemester(new Date());
    assert.equal(term.name, semester.name);
    assert.equal(term.code, semester.code);
    assert.equal(term.startDate.toISOString().slice(0, 10), semester.startDate.toISOString().slice(0, 10));
    assert.equal(term.endDate.toISOString().slice(0, 10), semester.endDate.toISOString().slice(0, 10));
    assert.equal(term.status, semester.inProgress ? "active" : "planned");
    assert.ok(term.calendarSlots.length > 20);
    assert.equal(term.meetingPatterns.length, 1);
    assert.equal(term.learningModules.length, course.learningModules.length);
    assert.equal(term.activities.length, course.activities.length);
    assert.ok(term.activities.length > 0);

    const countsBefore = await Promise.all([
      db.course.count(), db.term.count(), db.institution.count(), db.academicCalendar.count(),
      db.calendarSlot.count(), db.termActivity.count(), db.instructorInstitution.count(),
    ]);
    const second = await loadDemoCourse(db, owner.id);
    assert.deepEqual(second, { courseId: first.courseId, created: false });
    const countsAfter = await Promise.all([
      db.course.count(), db.term.count(), db.institution.count(), db.academicCalendar.count(),
      db.calendarSlot.count(), db.termActivity.count(), db.instructorInstitution.count(),
    ]);
    assert.deepEqual(countsAfter, countsBefore);
    const otherAfter = await db.instructor.findUniqueOrThrow({
      where: { id: other.id },
      include: { courses: { include: { terms: { include: { activities: true, calendarSlots: true, learningModules: true } }, activities: true, learningModules: true } } },
    });
    assert.deepEqual(otherAfter, otherBefore);
    assert.equal(await db.activityType.count({ where: { instructorId: other.id } }), otherTypesBefore);

    const ambiguous = await db.instructor.create({ data: { email: `ambiguous-${runId}@example.test`, name: "Ambiguous" } });
    const coursesBefore = await db.course.count();
    await assert.rejects(
      loadDemoCourse(db, ambiguous.id, { apply: async () => ({ ambiguities: [{ path: "activities[0]" }] }) } as never),
      /ambiguities/,
    );
    assert.equal(await db.course.count(), coursesBefore);
    assert.equal((await db.instructor.findUniqueOrThrow({ where: { id: ambiguous.id } })).nextCourseSerial, 1);
    console.log("Postgres demo load: Term, calendar, adopted activities, repeat load, and instructor isolation passed");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
