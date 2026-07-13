import { DomainInvariantError } from "./errors";
import type { RedesignDb, RedesignTx } from "./types";
import type { AcademicCalendar, Course, CourseInstitution, Institution } from "@prisma/client";

export type CreateInstitutionInput = {
  instructorId: string;
  name: string;
  shortName?: string | null;
  canonicalUri?: string | null;
};

export type CreateCourseInput = {
  instructorId: string;
  title: string;
  number: string;
  institutionIds?: string[];
  titleIsPlaceholder?: boolean;
  numberIsPlaceholder?: boolean;
  description?: string | null;
};

export type UpdateCourseInput = {
  title?: string;
  titleIsPlaceholder?: boolean;
  number?: string;
  numberIsPlaceholder?: boolean;
  description?: string | null;
  archivedAt?: Date | null;
};

export type CreateAcademicCalendarInput = {
  instructorId: string;
  institutionId: string;
  name: string;
  academicYear: string;
  sourceUri?: string | null;
};

export type ReplaceCourseInstitutionsInput = {
  instructorId: string;
  courseId: string;
  institutionIds: string[];
};

export async function createCourse(db: RedesignDb, input: CreateCourseInput) {
  assertNonblank(input.title, "Course title");
  assertNonblank(input.number, "Course number");

  return db.$transaction(async (tx) => {
    const instructor = await tx.instructor.update({
      where: { id: input.instructorId },
      data: { nextCourseSerial: { increment: 1 } },
      select: { nextCourseSerial: true },
    });
    const serial = instructor.nextCourseSerial - 1;
    const shortId = serial.toString().padStart(3, "0");

    const course = await tx.course.create({
      data: {
        instructorId: input.instructorId,
        shortId,
        title: input.title,
        titleIsPlaceholder: input.titleIsPlaceholder ?? false,
        number: input.number,
        numberIsPlaceholder: input.numberIsPlaceholder ?? false,
        description: input.description ?? null,
      },
    });

    for (const institutionId of input.institutionIds ?? []) {
      await assertInstructorInstitution(tx, input.instructorId, institutionId);
      await tx.courseInstitution.create({
        data: { courseId: course.id, institutionId },
      });
    }

    return course;
  });
}

export async function listCoursesForInstructor(
  db: RedesignDb,
  instructorId: string,
): Promise<Course[]> {
  return db.$transaction((tx) =>
    tx.course.findMany({
      where: { instructorId, archivedAt: null },
      orderBy: [{ createdAt: "asc" }, { shortId: "asc" }],
    }),
  );
}

export async function getOwnedCourse(db: RedesignDb, instructorId: string, courseId: string) {
  return db.$transaction(async (tx) => {
    return assertOwnedCourse(tx, instructorId, courseId);
  });
}

export async function updateCourse(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
  input: UpdateCourseInput,
) {
  return db.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id_instructorId: { id: courseId, instructorId } },
    });
    if (!course) throw new DomainInvariantError("Course not found");

    const data = withoutUndefined({
      title: input.title,
      titleIsPlaceholder: input.titleIsPlaceholder,
      number: input.number,
      numberIsPlaceholder: input.numberIsPlaceholder,
      description: input.description,
      archivedAt: input.archivedAt,
    });
    if (Object.keys(data).length === 0) {
      return course;
    }

    return tx.course.update({
      where: { id: courseId },
      data,
    });
  });
}

export async function createInstitution(db: RedesignDb, input: CreateInstitutionInput) {
  assertNonblank(input.name, "Institution name");

  return db.$transaction(async (tx) => {
    const institution = await tx.institution.create({
      data: {
        name: input.name,
        shortName: input.shortName ?? null,
        canonicalUri: input.canonicalUri ?? null,
      },
    });

    const existingMembershipCount = await tx.instructorInstitution.count({
      where: { instructorId: input.instructorId, status: "active" },
    });

    await tx.instructorInstitution.create({
      data: {
        instructorId: input.instructorId,
        institutionId: institution.id,
        status: "active",
        isDefault: existingMembershipCount === 0,
      },
    });

    return institution;
  });
}

export async function listInstitutionsForInstructor(
  db: RedesignDb,
  instructorId: string,
): Promise<Institution[]> {
  return db.$transaction((tx) =>
    tx.institution.findMany({
      where: {
        archivedAt: null,
        instructors: { some: { instructorId, status: "active" } },
      },
      orderBy: { name: "asc" },
    }),
  );
}

export async function createAcademicCalendar(
  db: RedesignDb,
  input: CreateAcademicCalendarInput,
) {
  return db.$transaction(async (tx) => {
    await assertInstructorInstitution(tx, input.instructorId, input.institutionId);
    return tx.academicCalendar.create({
      data: {
        institutionId: input.institutionId,
        name: input.name,
        academicYear: input.academicYear,
        sourceUri: input.sourceUri ?? null,
      },
    });
  });
}

export async function listAcademicCalendarsForInstructor(
  db: RedesignDb,
  instructorId: string,
  institutionId?: string | null,
): Promise<AcademicCalendar[]> {
  return db.$transaction(async (tx) => {
    const memberships: Array<{ institutionId: string }> = await tx.instructorInstitution.findMany({
      where: { instructorId, status: "active" },
      select: { institutionId: true },
    });
    const allowedInstitutionIds = new Set(memberships.map((membership) => membership.institutionId));
    const filterInstitutionIds = institutionId ? [institutionId] : [...allowedInstitutionIds];
    if (institutionId && !allowedInstitutionIds.has(institutionId)) {
      throw new DomainInvariantError("Institution not found");
    }
    return tx.academicCalendar.findMany({
      where: {
        archivedAt: null,
        institutionId: { in: filterInstitutionIds },
      },
      orderBy: [{ academicYear: "asc" }, { version: "asc" }, { name: "asc" }],
    });
  });
}

export async function assertInstructorInstitution(
  tx: RedesignTx,
  instructorId: string,
  institutionId: string,
) {
  const membership = await tx.instructorInstitution.findUnique({
    where: { instructorId_institutionId: { instructorId, institutionId } },
  });
  if (!membership || membership.status !== "active") {
    throw new DomainInvariantError("Term Institution must be valid for the Instructor");
  }
}

export async function listCourseInstitutionsForInstructor(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
): Promise<Institution[]> {
  return db.$transaction(async (tx) => {
    await assertOwnedCourse(tx, instructorId, courseId);
    return tx.institution.findMany({
      where: {
        archivedAt: null,
        courses: { some: { courseId } },
      },
      orderBy: { name: "asc" },
    });
  });
}

export async function replaceCourseInstitutions(
  db: RedesignDb,
  input: ReplaceCourseInstitutionsInput,
): Promise<CourseInstitution[]> {
  return db.$transaction(async (tx) => {
    await assertOwnedCourse(tx, input.instructorId, input.courseId);
    const uniqueInstitutionIds = [...new Set(input.institutionIds)];
    for (const institutionId of uniqueInstitutionIds) {
      await assertInstructorInstitution(tx, input.instructorId, institutionId);
    }

    await tx.courseInstitution.deleteMany({ where: { courseId: input.courseId } });
    if (uniqueInstitutionIds.length > 0) {
      await tx.courseInstitution.createMany({
        data: uniqueInstitutionIds.map((institutionId) => ({
          courseId: input.courseId,
          institutionId,
        })),
      });
    }

    return tx.courseInstitution.findMany({
      where: { courseId: input.courseId },
      orderBy: { institutionId: "asc" },
    });
  });
}

function assertNonblank(value: string, label: string) {
  if (value.trim().length === 0) {
    throw new DomainInvariantError(`${label} must be nonblank`);
  }
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

async function assertOwnedCourse(
  tx: RedesignTx,
  instructorId: string,
  courseId: string,
) {
  const course = await tx.course.findUnique({
    where: { id_instructorId: { id: courseId, instructorId } },
  });
  if (!course) {
    throw new DomainInvariantError("Course not found");
  }
  return course;
}
