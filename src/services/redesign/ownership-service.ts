import { DomainInvariantError } from "./errors";
import type { RedesignTx } from "./types";

export function assertOwnedByInstructor(
  instructorId: string,
  ownerInstructorId: string | null | undefined,
  notFoundMessage: string,
) {
  if (!ownerInstructorId || ownerInstructorId !== instructorId) {
    throw new DomainInvariantError(notFoundMessage);
  }
}

export async function getOwnedCourseForInstructor(
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

export async function getOwnedTermForInstructor(
  tx: RedesignTx,
  instructorId: string,
  termId: string,
) {
  const term = await tx.term.findUnique({
    where: { id: termId },
    include: {
      course: {
        select: { instructorId: true },
      },
    },
  });
  if (!term) {
    throw new DomainInvariantError("Term not found");
  }
  assertOwnedByInstructor(instructorId, term.course?.instructorId, "Term not found");
  return term;
}

export async function getOwnedTermLearningModuleForInstructor(
  tx: RedesignTx,
  instructorId: string,
  termLearningModuleId: string,
) {
  const termLearningModule = await tx.termLearningModule.findUnique({
    where: { id: termLearningModuleId },
    include: {
      term: {
        include: {
          course: {
            select: { instructorId: true },
          },
        },
      },
    },
  });
  if (!termLearningModule) {
    throw new DomainInvariantError("Term Learning Module not found");
  }
  assertOwnedByInstructor(
    instructorId,
    termLearningModule.term?.course?.instructorId,
    "Term Learning Module not found",
  );
  return termLearningModule;
}

export async function getOwnedSessionForInstructor(
  tx: RedesignTx,
  instructorId: string,
  sessionId: string,
) {
  const session = await tx.session.findUnique({
    where: { id: sessionId },
    include: {
      term: {
        include: {
          course: {
            select: { instructorId: true },
          },
        },
      },
      termLearningModule: {
        select: { id: true, sequence: true, learningModuleId: true },
      },
    },
  });
  if (!session) {
    throw new DomainInvariantError("Session not found");
  }
  assertOwnedByInstructor(instructorId, session.term?.course?.instructorId, "Session not found");
  return session;
}

export async function getOwnedCoverageForInstructor(
  tx: RedesignTx,
  instructorId: string,
  coverageId: string,
) {
  const coverage = await tx.coverage.findUnique({
    where: { id: coverageId },
    include: {
      session: {
        include: {
          term: {
            include: {
              course: {
                select: { instructorId: true },
              },
            },
          },
        },
      },
    },
  });
  if (!coverage) {
    throw new DomainInvariantError("Coverage not found");
  }
  assertOwnedByInstructor(
    instructorId,
    coverage.session?.term?.course?.instructorId,
    "Coverage not found",
  );
  return coverage;
}

export async function getOwnedAssessmentForInstructor(
  tx: RedesignTx,
  instructorId: string,
  assessmentId: string,
) {
  const assessment = await tx.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      term: {
        include: {
          course: {
            select: { instructorId: true },
          },
        },
      },
      topics: true,
    },
  });
  if (!assessment) {
    throw new DomainInvariantError("Assessment not found");
  }
  assertOwnedByInstructor(
    instructorId,
    assessment.term?.course?.instructorId,
    "Assessment not found",
  );
  return assessment;
}

export async function getOwnedCalendarSlotForInstructor(
  tx: RedesignTx,
  instructorId: string,
  calendarSlotId: string,
) {
  const calendarSlot = await tx.calendarSlot.findUnique({
    where: { id: calendarSlotId },
    include: {
      term: {
        include: {
          course: {
            select: { instructorId: true },
          },
        },
      },
    },
  });
  if (!calendarSlot) {
    throw new DomainInvariantError("Calendar slot not found");
  }
  assertOwnedByInstructor(
    instructorId,
    calendarSlot.term?.course?.instructorId,
    "Calendar slot not found",
  );
  return calendarSlot;
}

export async function getOwnedArtifactForInstructor(
  tx: RedesignTx,
  instructorId: string,
  artifactId: string,
) {
  const artifact = await tx.artifact.findUnique({
    where: { id: artifactId },
    include: {
      session: {
        include: {
          term: {
            include: {
              course: {
                select: { instructorId: true },
              },
            },
          },
        },
      },
      assessment: {
        include: {
          term: {
            include: {
              course: {
                select: { instructorId: true },
              },
            },
          },
        },
      },
      learningModuleVersion: {
        include: {
          learningModule: {
            include: {
              course: {
                select: { instructorId: true },
              },
            },
          },
        },
      },
      topicVersion: {
        include: {
          topic: {
            include: {
              course: {
                select: { instructorId: true },
              },
            },
          },
        },
      },
    },
  });
  if (!artifact) {
    throw new DomainInvariantError("Artifact not found");
  }

  const ownerInstructorId =
    artifact.session?.term?.course?.instructorId ??
    artifact.assessment?.term?.course?.instructorId ??
    artifact.learningModuleVersion?.learningModule?.course?.instructorId ??
    artifact.topicVersion?.topic?.course?.instructorId;
  assertOwnedByInstructor(instructorId, ownerInstructorId, "Artifact not found");

  return artifact;
}
