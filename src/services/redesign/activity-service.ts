import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import { assertSameCourse, assertSameIdentityVersion } from "./invariants";
import { getOwnedCourseForInstructor } from "./ownership-service";
import type {
  ActivityDetailDraft,
  ActivityVersionDraft,
  MilestoneTemplateDraft,
  RedesignDb,
  RedesignTx,
} from "./types";

const versionHydration = {
  meetingDetail: true,
  courseworkDetail: true,
  assessmentDetail: true,
  milestoneTemplates: { orderBy: { sequence: "asc" as const } },
};

export async function createActivity(
  db: RedesignDb,
  input: {
    instructorId: string;
    courseId: string;
    stableCode: string;
    createdByInstructorId: string;
    draft: ActivityVersionDraft;
    publish?: boolean;
  },
) {
  if (input.createdByInstructorId !== input.instructorId) {
    throw new DomainInvariantError("Activity creator must match its owning Instructor");
  }

  return db.$transaction(async (tx) => {
    await getOwnedCourseForInstructor(tx, input.instructorId, input.courseId);

    const activity = await tx.activity.create({
      data: { courseId: input.courseId, stableCode: input.stableCode },
    });
    const version = await createActivityVersion(tx, {
      activity,
      instructorId: input.instructorId,
      revision: 1,
      createdByInstructorId: input.createdByInstructorId,
      draft: input.draft,
      publishedAt: input.publish ? new Date() : null,
    });
    await tx.activity.update({
      where: { id: activity.id },
      data: { currentVersionId: version.id },
    });
    return { ...activity, currentVersionId: version.id, currentVersion: version };
  });
}

export async function reviseActivity(
  db: RedesignDb,
  input: {
    activityId: string;
    instructorId: string;
    expectedCurrentVersionId: string;
    createdByInstructorId: string;
    draft: ActivityVersionDraft;
    publish?: boolean;
  },
) {
  if (input.createdByInstructorId !== input.instructorId) {
    throw new DomainInvariantError("Activity version creator must match its owning Instructor");
  }

  try {
    return await db.$transaction(async (tx) => {
      const activity = await findOwnedActivity(tx, input.instructorId, input.activityId);
      if (!activity.currentVersion) {
        throw new DomainInvariantError("Activity current version is missing");
      }
      if (activity.currentVersionId !== input.expectedCurrentVersionId) {
        throw new ConcurrencyConflictError();
      }
      assertSameIdentityVersion(activity.id, activity.currentVersion.activityId, "Activity");

      const nextRevision = activity.currentVersion.revision + 1;
      const version = await createActivityVersion(tx, {
        activity,
        instructorId: input.instructorId,
        revision: nextRevision,
        createdByInstructorId: input.createdByInstructorId,
        draft: input.draft,
        publishedAt: input.publish ? new Date() : null,
      });
      const advanced = await tx.activity.updateMany({
        where: { id: activity.id, currentVersionId: input.expectedCurrentVersionId },
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

export async function listActivitiesForCourse(db: RedesignDb, instructorId: string, courseId: string) {
  return db.$transaction(async (tx) => {
    await getOwnedCourseForInstructor(tx, instructorId, courseId);
    return tx.activity.findMany({
      where: { courseId, archivedAt: null },
      orderBy: [{ createdAt: "asc" }, { stableCode: "asc" }],
    });
  });
}

export async function getActivityForInstructor(
  db: RedesignDb,
  instructorId: string,
  activityId: string,
) {
  return db.$transaction(async (tx) => {
    const activity = await findOwnedActivity(tx, instructorId, activityId);
    return { activity, currentVersion: activity.currentVersion ?? null };
  });
}

export async function listActivityVersionsForInstructor(
  db: RedesignDb,
  instructorId: string,
  activityId: string,
) {
  return db.$transaction(async (tx) => {
    await findOwnedActivity(tx, instructorId, activityId);
    return tx.activityVersion.findMany({
      where: { activityId },
      include: versionHydration,
      orderBy: { revision: "asc" },
    });
  });
}

export async function getActivityVersionForInstructor(
  db: RedesignDb,
  instructorId: string,
  activityVersionId: string,
) {
  return db.$transaction(async (tx) => findOwnedActivityVersion(tx, instructorId, activityVersionId));
}

export async function updateActivity(
  db: RedesignDb,
  instructorId: string,
  activityId: string,
  input: { stableCode?: string; archivedAt?: Date | null },
) {
  return db.$transaction(async (tx) => {
    const activity = await findOwnedActivity(tx, instructorId, activityId);

    if (input.stableCode && input.stableCode !== activity.stableCode) {
      const duplicate = await tx.activity.findUnique({
        where: {
          courseId_stableCode: {
            courseId: activity.courseId,
            stableCode: input.stableCode,
          },
        },
      });
      if (duplicate && duplicate.id !== activityId) {
        throw new DomainInvariantError("Activity stableCode must be unique within the Course");
      }
    }

    const data = withoutUndefined({
      stableCode: input.stableCode,
      archivedAt: input.archivedAt,
    });
    if (Object.keys(data).length === 0) {
      return activity;
    }

    return tx.activity.update({
      where: { id: activityId },
      data,
    });
  });
}

export async function archiveActivity(db: RedesignDb, instructorId: string, activityId: string) {
  return updateActivity(db, instructorId, activityId, { archivedAt: new Date() });
}

export async function publishActivityVersion(
  db: RedesignDb,
  instructorId: string,
  activityVersionId: string,
) {
  return db.$transaction(async (tx) => {
    const version = await findOwnedActivityVersion(tx, instructorId, activityVersionId);
    if (version.publishedAt) {
      return version;
    }
    return tx.activityVersion.update({
      where: { id: version.id },
      data: { publishedAt: new Date() },
      include: versionHydration,
    });
  });
}

function isUniqueConstraintError(error: unknown): error is { code: "P2002" } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function findOwnedActivity(tx: RedesignTx, instructorId: string, activityId: string) {
  const activity = await tx.activity.findUnique({
    where: { id: activityId },
    include: {
      course: { select: { instructorId: true } },
      currentVersion: { include: versionHydration },
    },
  });
  if (!activity || activity.course?.instructorId !== instructorId) {
    throw new DomainInvariantError("Activity not found");
  }
  return activity;
}

async function findOwnedActivityVersion(
  tx: RedesignTx,
  instructorId: string,
  activityVersionId: string,
) {
  const version = await tx.activityVersion.findUnique({
    where: { id: activityVersionId },
    include: {
      ...versionHydration,
      activity: { include: { course: { select: { instructorId: true } } } },
    },
  });
  if (!version || version.activity?.course?.instructorId !== instructorId) {
    throw new DomainInvariantError("Activity version not found");
  }
  return version;
}

async function createActivityVersion(
  tx: RedesignTx,
  input: {
    activity: { id: string; courseId: string };
    instructorId: string;
    revision: number;
    createdByInstructorId: string;
    draft: ActivityVersionDraft;
    publishedAt: Date | null;
  },
) {
  const activityTypeVersion = await findEnabledActivityTypeVersion(
    tx,
    input.instructorId,
    input.activity.courseId,
    input.draft.activityTypeVersionId,
  );
  if (activityTypeVersion.activityType.behaviorFamily !== input.draft.detail.behaviorFamily) {
    throw new DomainInvariantError(
      "Activity detail behaviorFamily must match the selected Activity Type's behaviorFamily",
    );
  }

  const milestoneTemplates = input.draft.milestoneTemplates ?? [];
  assertValidMilestoneSequences(milestoneTemplates);
  await assertMilestoneAnchorsInCourse(tx, input.activity.courseId, milestoneTemplates);

  return tx.activityVersion.create({
    data: {
      activityId: input.activity.id,
      revision: input.revision,
      title: input.draft.title,
      summary: input.draft.summary ?? null,
      activityTypeVersionId: input.draft.activityTypeVersionId,
      changeSummary: input.draft.changeSummary ?? null,
      createdByInstructorId: input.createdByInstructorId,
      publishedAt: input.publishedAt,
      ...detailCreateData(input.draft.detail),
      milestoneTemplates: {
        create: milestoneTemplates.map((template) => ({
          sequence: template.sequence,
          role: template.role,
          label: template.label,
          linkedActivityId: template.linkedActivityId ?? null,
          relativeDays: template.relativeDays ?? null,
          defaultTime: template.defaultTime ?? null,
          timeZone: template.timeZone ?? null,
          notes: template.notes ?? null,
          provenance: template.provenance ?? undefined,
        })),
      },
    },
    include: versionHydration,
  });
}

function detailCreateData(detail: ActivityDetailDraft) {
  switch (detail.behaviorFamily) {
    case "meeting":
      return {
        meetingDetail: {
          create: {
            defaultDurationMinutes: detail.defaultDurationMinutes ?? null,
            modality: detail.modality ?? null,
            preparationNotes: detail.preparationNotes ?? null,
            authoringNotes: detail.authoringNotes ?? null,
          },
        },
      };
    case "coursework":
      return {
        courseworkDetail: {
          create: {
            submissionPolicy: detail.submissionPolicy ?? null,
            releasePolicy: detail.releasePolicy ?? null,
            authoringNotes: detail.authoringNotes ?? null,
          },
        },
      };
    case "assessment":
      return {
        assessmentDetail: {
          create: {
            modality: detail.modality ?? null,
            authoringNotes: detail.authoringNotes ?? null,
          },
        },
      };
  }
}

function assertValidMilestoneSequences(templates: MilestoneTemplateDraft[]) {
  const sequences = new Set<number>();
  for (const template of templates) {
    if (template.sequence < 0) {
      throw new DomainInvariantError("Milestone template sequence must be nonnegative");
    }
    if (sequences.has(template.sequence)) {
      throw new DomainInvariantError("Milestone template sequence must be unique within the version");
    }
    sequences.add(template.sequence);
  }
}

async function assertMilestoneAnchorsInCourse(
  tx: RedesignTx,
  courseId: string,
  templates: MilestoneTemplateDraft[],
) {
  for (const template of templates) {
    if (!template.linkedActivityId) continue;
    const linked = await tx.activity.findUnique({
      where: { id: template.linkedActivityId },
      select: { courseId: true },
    });
    if (!linked) {
      throw new DomainInvariantError("Milestone template linkedActivityId not found");
    }
    assertSameCourse(courseId, linked.courseId, "Milestone template anchor");
  }
}

async function findEnabledActivityTypeVersion(
  tx: RedesignTx,
  instructorId: string,
  courseId: string,
  activityTypeVersionId: string,
) {
  const activityTypeVersion = await tx.activityTypeVersion.findUnique({
    where: { id: activityTypeVersionId },
    include: { activityType: { select: { instructorId: true, behaviorFamily: true } } },
  });
  if (!activityTypeVersion) {
    throw new DomainInvariantError("Activity Type version not found");
  }
  if (activityTypeVersion.activityType.instructorId !== instructorId) {
    throw new DomainInvariantError("Activity Type version must belong to the Instructor's vocabulary");
  }

  const enabled = await tx.courseActivityTypeVersion.findUnique({
    where: { courseId_activityTypeVersionId: { courseId, activityTypeVersionId } },
  });
  if (!enabled) {
    throw new DomainInvariantError("Activity Type version must be enabled for the Activity's Course");
  }

  return activityTypeVersion;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
