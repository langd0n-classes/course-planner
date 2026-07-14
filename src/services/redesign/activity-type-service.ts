import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import { assertSameIdentityVersion } from "./invariants";
import { getOwnedCourseForInstructor } from "./ownership-service";
import type { ActivityTypeVersionDraft, RedesignDb, RedesignTx } from "./types";

type ActivityBehaviorFamily = "meeting" | "coursework" | "assessment";

export async function createActivityType(
  db: RedesignDb,
  input: {
    instructorId: string;
    behaviorFamily: ActivityBehaviorFamily;
    createdByInstructorId: string;
    draft: ActivityTypeVersionDraft;
    publish?: boolean;
  },
) {
  if (input.createdByInstructorId !== input.instructorId) {
    throw new DomainInvariantError("Activity Type creator must match its owning Instructor");
  }

  return db.$transaction(async (tx) => {
    const activityType = await tx.activityType.create({
      data: { instructorId: input.instructorId, behaviorFamily: input.behaviorFamily },
    });
    const version = await createActivityTypeVersion(tx, {
      activityType,
      revision: 1,
      createdByInstructorId: input.createdByInstructorId,
      draft: input.draft,
      publishedAt: input.publish ? new Date() : null,
    });
    await tx.activityType.update({
      where: { id: activityType.id },
      data: { currentVersionId: version.id },
    });
    return { ...activityType, currentVersionId: version.id, currentVersion: version };
  });
}

export async function reviseActivityType(
  db: RedesignDb,
  input: {
    activityTypeId: string;
    instructorId: string;
    expectedCurrentVersionId: string;
    createdByInstructorId: string;
    draft: ActivityTypeVersionDraft;
    publish?: boolean;
  },
) {
  if (input.createdByInstructorId !== input.instructorId) {
    throw new DomainInvariantError("Activity Type version creator must match its owning Instructor");
  }

  try {
    return await db.$transaction(async (tx) => {
      const activityType = await findOwnedActivityType(tx, input.instructorId, input.activityTypeId);
      if (!activityType.currentVersion) {
        throw new DomainInvariantError("Activity Type current version is missing");
      }
      if (activityType.currentVersionId !== input.expectedCurrentVersionId) {
        throw new ConcurrencyConflictError();
      }
      assertSameIdentityVersion(
        activityType.id,
        activityType.currentVersion.activityTypeId,
        "Activity Type",
      );

      const nextRevision = activityType.currentVersion.revision + 1;
      const version = await createActivityTypeVersion(tx, {
        activityType,
        revision: nextRevision,
        createdByInstructorId: input.createdByInstructorId,
        draft: input.draft,
        publishedAt: input.publish ? new Date() : null,
      });
      const advanced = await tx.activityType.updateMany({
        where: {
          id: activityType.id,
          currentVersionId: input.expectedCurrentVersionId,
        },
        data: { currentVersionId: version.id },
      });
      if (advanced.count !== 1) {
        throw new ConcurrencyConflictError();
      }
      return version;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConcurrencyConflictError();
    }
    throw error;
  }
}

export async function listActivityTypesForInstructor(db: RedesignDb, instructorId: string) {
  return db.$transaction(async (tx) => {
    return tx.activityType.findMany({
      where: { instructorId, archivedAt: null },
      orderBy: [{ createdAt: "asc" }],
    });
  });
}

export async function getActivityTypeForInstructor(
  db: RedesignDb,
  instructorId: string,
  activityTypeId: string,
) {
  return db.$transaction(async (tx) => {
    const activityType = await findOwnedActivityType(tx, instructorId, activityTypeId);
    return { activityType, currentVersion: activityType.currentVersion ?? null };
  });
}

export async function listActivityTypeVersionsForInstructor(
  db: RedesignDb,
  instructorId: string,
  activityTypeId: string,
) {
  return db.$transaction(async (tx) => {
    await findOwnedActivityType(tx, instructorId, activityTypeId);
    return tx.activityTypeVersion.findMany({
      where: { activityTypeId },
      orderBy: { revision: "asc" },
    });
  });
}

export async function updateActivityType(
  db: RedesignDb,
  instructorId: string,
  activityTypeId: string,
  input: { archivedAt: Date | null },
) {
  return db.$transaction(async (tx) => {
    const activityType = await findOwnedActivityType(tx, instructorId, activityTypeId);
    return tx.activityType.update({
      where: { id: activityType.id },
      data: { archivedAt: input.archivedAt },
    });
  });
}

export async function listCourseActivityTypeVersions(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
) {
  return db.$transaction(async (tx) => {
    await getOwnedCourseForInstructor(tx, instructorId, courseId);
    return tx.courseActivityTypeVersion.findMany({
      where: { courseId },
      orderBy: { activityTypeVersionId: "asc" },
    });
  });
}

export async function replaceCourseActivityTypeVersions(
  db: RedesignDb,
  input: { instructorId: string; courseId: string; activityTypeVersionIds: string[] },
) {
  return db.$transaction(async (tx) => {
    await getOwnedCourseForInstructor(tx, input.instructorId, input.courseId);

    const uniqueIds = [...new Set(input.activityTypeVersionIds)];
    if (uniqueIds.length !== input.activityTypeVersionIds.length) {
      throw new DomainInvariantError("Activity Type version IDs must be unique");
    }
    for (const activityTypeVersionId of uniqueIds) {
      const version = await tx.activityTypeVersion.findUnique({
        where: { id: activityTypeVersionId },
        include: { activityType: { select: { instructorId: true } } },
      });
      if (!version) {
        throw new DomainInvariantError("Activity Type version not found");
      }
      if (version.activityType.instructorId !== input.instructorId) {
        throw new DomainInvariantError(
          "Activity Type version must belong to the Instructor's vocabulary",
        );
      }
    }

    await tx.courseActivityTypeVersion.deleteMany({ where: { courseId: input.courseId } });
    if (uniqueIds.length > 0) {
      await tx.courseActivityTypeVersion.createMany({
        data: uniqueIds.map((activityTypeVersionId) => ({
          courseId: input.courseId,
          activityTypeVersionId,
        })),
      });
    }

    return tx.courseActivityTypeVersion.findMany({
      where: { courseId: input.courseId },
      orderBy: { activityTypeVersionId: "asc" },
    });
  });
}

function isUniqueConstraintError(error: unknown): error is { code: "P2002" } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function findOwnedActivityType(tx: RedesignTx, instructorId: string, activityTypeId: string) {
  const activityType = await tx.activityType.findUnique({
    where: { id_instructorId: { id: activityTypeId, instructorId } },
    include: { currentVersion: true },
  });
  if (!activityType) {
    throw new DomainInvariantError("Activity Type not found");
  }
  return activityType;
}

async function createActivityTypeVersion(
  tx: RedesignTx,
  input: {
    activityType: { id: string };
    revision: number;
    createdByInstructorId: string;
    draft: ActivityTypeVersionDraft;
    publishedAt: Date | null;
  },
) {
  return tx.activityTypeVersion.create({
    data: {
      activityTypeId: input.activityType.id,
      revision: input.revision,
      label: input.draft.label,
      description: input.draft.description ?? null,
      changeSummary: input.draft.changeSummary ?? null,
      createdByInstructorId: input.createdByInstructorId,
      publishedAt: input.publishedAt,
    },
  });
}
