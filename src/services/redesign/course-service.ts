import { DomainInvariantError } from "./errors";
import type { RedesignDb, RedesignTx } from "./types";

export type CreateCourseInput = {
  instructorId: string;
  title: string;
  number: string;
  institutionIds?: string[];
  titleIsPlaceholder?: boolean;
  numberIsPlaceholder?: boolean;
  description?: string | null;
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

function assertNonblank(value: string, label: string) {
  if (value.trim().length === 0) {
    throw new DomainInvariantError(`${label} must be nonblank`);
  }
}
