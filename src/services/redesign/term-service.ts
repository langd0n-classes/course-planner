import { DomainInvariantError } from "./errors";
import { assertInstructorInstitution } from "./course-service";
import { assertSameCourse } from "./invariants";
import type { RedesignDb, RedesignTx } from "./types";

export type CreateTermInput = {
  courseId: string;
  institutionId?: string;
  academicCalendarId: string;
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  meetingPattern?: unknown;
  clonedFromId?: string | null;
};

export async function createTerm(db: RedesignDb, input: CreateTermInput) {
  return db.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: input.courseId },
      include: { institutions: true },
    });
    if (!course) throw new DomainInvariantError("Course not found");

    const institutionId = await resolveTermInstitution(tx, course, input.institutionId);
    await assertInstructorInstitution(tx, course.instructorId, institutionId);
    await assertCourseInstitution(tx, input.courseId, institutionId);
    await assertCalendarInstitution(tx, input.academicCalendarId, institutionId);

    if (input.clonedFromId) {
      const source = await tx.term.findUnique({
        where: { id: input.clonedFromId },
        select: { courseId: true },
      });
      if (!source) throw new DomainInvariantError("Source Term not found");
      assertSameCourse(input.courseId, source.courseId, "Term cloning");
    }

    return tx.term.create({
      data: {
        courseId: input.courseId,
        institutionId,
        academicCalendarId: input.academicCalendarId,
        code: input.code,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        meetingPattern: input.meetingPattern,
        clonedFromId: input.clonedFromId ?? null,
      },
    });
  });
}

async function resolveTermInstitution(
  tx: RedesignTx,
  course: { id: string; institutions: Array<{ institutionId: string }> },
  requestedInstitutionId?: string,
) {
  if (requestedInstitutionId) return requestedInstitutionId;

  const links =
    course.institutions ??
    (await tx.courseInstitution.findMany({ where: { courseId: course.id } }));
  if (links.length === 1) return links[0].institutionId;

  throw new DomainInvariantError("Term creation requires an explicit Institution for multi-Institution Courses");
}

async function assertCourseInstitution(
  tx: RedesignTx,
  courseId: string,
  institutionId: string,
) {
  const link = await tx.courseInstitution.findUnique({
    where: { courseId_institutionId: { courseId, institutionId } },
  });
  if (!link) {
    throw new DomainInvariantError("Term Institution must be valid for the Course");
  }
}

async function assertCalendarInstitution(
  tx: RedesignTx,
  academicCalendarId: string,
  institutionId: string,
) {
  const calendar = await tx.academicCalendar.findUnique({
    where: { id_institutionId: { id: academicCalendarId, institutionId } },
  });
  if (!calendar) {
    throw new DomainInvariantError("Term Academic Calendar must belong to the selected Institution");
  }
}

export type UpdateTermInput = {
  academicCalendarId?: string;
  code?: string;
  name?: string;
  startDate?: Date;
  endDate?: Date;
  meetingPattern?: unknown;
};

export async function updateTerm(db: RedesignDb, termId: string, input: UpdateTermInput) {
  return db.$transaction(async (tx) => {
    const term = await tx.term.findUnique({ where: { id: termId } });
    if (!term) throw new DomainInvariantError("Term not found");
    if (term.status === "closed") {
      throw new DomainInvariantError("Closed Terms are read-only");
    }

    if (input.academicCalendarId) {
      await assertCalendarInstitution(tx, input.academicCalendarId, term.institutionId);
    }

    return tx.term.update({
      where: { id: termId },
      data: {
        academicCalendarId: input.academicCalendarId,
        code: input.code,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        meetingPattern: input.meetingPattern,
      },
    });
  });
}

// Term deletion is the ordinary archive lifecycle action (design §2 "Archive
// versus hard removal"): the frozen contract exposes no separate guarded
// hard-removal command for Term, so DELETE sets archivedAt rather than
// physically removing rows that historical Sessions/Coverage may reference.
export async function archiveTerm(db: RedesignDb, termId: string) {
  return db.$transaction(async (tx) => {
    const term = await tx.term.findUnique({ where: { id: termId } });
    if (!term) throw new DomainInvariantError("Term not found");
    if (term.archivedAt) return term;
    return tx.term.update({ where: { id: termId }, data: { archivedAt: new Date() } });
  });
}
