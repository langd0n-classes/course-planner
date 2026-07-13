import { ConcurrencyConflictError, DomainInvariantError, ImmutablePublishedVersionError } from "./errors";
import { assertSameCourse, assertSameIdentityVersion } from "./invariants";
import type {
  LearningModuleVersionDraft,
  RedesignDb,
  RedesignTx,
  TopicSnapshotInput,
  TopicVersionDraft,
} from "./types";

export async function createLearningModule(
  db: RedesignDb,
  input: {
    courseId: string;
    stableCode: string;
    createdByInstructorId: string;
    draft: LearningModuleVersionDraft;
  },
) {
  return db.$transaction(async (tx) => {
    const learningModule = await tx.learningModule.create({
      data: { courseId: input.courseId, stableCode: input.stableCode },
    });
    const version = await createLearningModuleVersion(tx, {
      learningModule,
      revision: 1,
      createdByInstructorId: input.createdByInstructorId,
      draft: input.draft,
      publishedAt: null,
    });
    await tx.learningModule.update({
      where: { id: learningModule.id },
      data: { currentVersionId: version.id },
    });
    return { ...learningModule, currentVersionId: version.id, currentVersion: version };
  });
}

export async function reviseLearningModule(
  db: RedesignDb,
  input: {
    learningModuleId: string;
    expectedCurrentVersionId: string;
    createdByInstructorId: string;
    draft: LearningModuleVersionDraft;
    publish?: boolean;
  },
) {
  return db.$transaction(async (tx) => {
    const learningModule = await tx.learningModule.findUnique({
      where: { id: input.learningModuleId },
      include: { currentVersion: true },
    });
    if (!learningModule?.currentVersion) {
      throw new DomainInvariantError("Learning Module current version is missing");
    }
    if (learningModule.currentVersionId !== input.expectedCurrentVersionId) {
      throw new ConcurrencyConflictError();
    }

    assertSameIdentityVersion(
      learningModule.id,
      learningModule.currentVersion.learningModuleId,
      "Learning Module",
    );

    const nextRevision = learningModule.currentVersion.revision + 1;
    const version = await createLearningModuleVersion(tx, {
      learningModule,
      revision: nextRevision,
      createdByInstructorId: input.createdByInstructorId,
      draft: input.draft,
      publishedAt: input.publish ? new Date() : null,
    });

    await tx.learningModule.update({
      where: { id: learningModule.id },
      data: { currentVersionId: version.id },
    });
    return version;
  });
}

export async function publishLearningModuleVersion(
  db: RedesignDb,
  input: { learningModuleVersionId: string },
) {
  return db.$transaction(async (tx) => {
    const version = await tx.learningModuleVersion.findUnique({
      where: { id: input.learningModuleVersionId },
    });
    if (!version) throw new DomainInvariantError("Learning Module version not found");
    if (version.publishedAt) return version;
    return tx.learningModuleVersion.update({
      where: { id: version.id },
      data: { publishedAt: new Date() },
    });
  });
}

export async function createTopic(
  db: RedesignDb,
  input: {
    courseId: string;
    learningModuleId?: string | null;
    stableCode: string;
    createdByInstructorId: string;
    draft: TopicVersionDraft;
  },
) {
  return db.$transaction(async (tx) => {
    if (input.learningModuleId) {
      const learningModule = await tx.learningModule.findUnique({
        where: { id: input.learningModuleId },
        select: { courseId: true },
      });
      if (!learningModule) throw new DomainInvariantError("Learning Module not found");
      assertSameCourse(input.courseId, learningModule.courseId, "Topic assignment");
    }

    const topic = await tx.topic.create({
      data: {
        courseId: input.courseId,
        learningModuleId: input.learningModuleId ?? null,
        stableCode: input.stableCode,
      },
    });
    const version = await createTopicVersion(tx, {
      topic,
      revision: 1,
      createdByInstructorId: input.createdByInstructorId,
      draft: input.draft,
      publishedAt: null,
    });
    await tx.topic.update({
      where: { id: topic.id },
      data: { currentVersionId: version.id },
    });
    return { ...topic, currentVersionId: version.id, currentVersion: version };
  });
}

export async function listLearningModulesForCourse(
  db: RedesignDb,
  instructorId: string,
  courseId: string,
) {
  return db.$transaction(async (tx) => {
    await assertOwnedCourse(tx, instructorId, courseId);
    return tx.learningModule.findMany({
      where: { courseId, archivedAt: null },
      orderBy: [{ createdAt: "asc" }, { stableCode: "asc" }],
    });
  });
}

export async function getLearningModuleForInstructor(
  db: RedesignDb,
  instructorId: string,
  learningModuleId: string,
) {
  return db.$transaction(async (tx) => {
    const learningModule = await tx.learningModule.findUnique({
      where: { id: learningModuleId },
      include: { currentVersion: { include: { topics: { orderBy: { sequence: "asc" } } } } },
    });
    if (!learningModule) {
      throw new DomainInvariantError("Learning Module not found");
    }
    await assertOwnedCourse(tx, instructorId, learningModule.courseId);
    return {
      learningModule,
      currentVersion: learningModule.currentVersion ?? null,
    };
  });
}

export async function listLearningModuleVersionsForInstructor(
  db: RedesignDb,
  instructorId: string,
  learningModuleId: string,
) {
  return db.$transaction(async (tx) => {
    const learningModule = await tx.learningModule.findUnique({
      where: { id: learningModuleId },
      select: { courseId: true },
    });
    if (!learningModule) {
      throw new DomainInvariantError("Learning Module not found");
    }
    await assertOwnedCourse(tx, instructorId, learningModule.courseId);
    return tx.learningModuleVersion.findMany({
      where: { learningModuleId },
      include: { topics: { orderBy: { sequence: "asc" } } },
      orderBy: { revision: "asc" },
    });
  });
}

export async function updateLearningModule(
  db: RedesignDb,
  instructorId: string,
  learningModuleId: string,
  input: { stableCode?: string; archivedAt?: Date | null },
) {
  return db.$transaction(async (tx) => {
    const learningModule = await tx.learningModule.findUnique({
      where: { id: learningModuleId },
      select: { id: true, courseId: true, stableCode: true },
    });
    if (!learningModule) {
      throw new DomainInvariantError("Learning Module not found");
    }
    await assertOwnedCourse(tx, instructorId, learningModule.courseId);

    if (input.stableCode && input.stableCode !== learningModule.stableCode) {
      const duplicate = await tx.learningModule.findUnique({
        where: {
          courseId_stableCode: {
            courseId: learningModule.courseId,
            stableCode: input.stableCode,
          },
        },
      });
      if (duplicate && duplicate.id !== learningModuleId) {
        throw new DomainInvariantError("Learning Module stableCode must be unique within the Course");
      }
    }

    const data = withoutUndefined({
      stableCode: input.stableCode,
      archivedAt: input.archivedAt,
    });
    if (Object.keys(data).length === 0) {
      return learningModule;
    }

    return tx.learningModule.update({
      where: { id: learningModuleId },
      data,
    });
  });
}

export async function archiveLearningModule(
  db: RedesignDb,
  instructorId: string,
  learningModuleId: string,
) {
  return updateLearningModule(db, instructorId, learningModuleId, { archivedAt: new Date() });
}

export async function listTopicsForCourse(db: RedesignDb, instructorId: string, courseId: string) {
  return db.$transaction(async (tx) => {
    await assertOwnedCourse(tx, instructorId, courseId);
    return tx.topic.findMany({
      where: { courseId, archivedAt: null },
      orderBy: [{ createdAt: "asc" }, { stableCode: "asc" }],
    });
  });
}

export async function getTopicForInstructor(
  db: RedesignDb,
  instructorId: string,
  topicId: string,
) {
  return db.$transaction(async (tx) => {
    const topic = await tx.topic.findUnique({
      where: { id: topicId },
      include: { currentVersion: true },
    });
    if (!topic) {
      throw new DomainInvariantError("Topic not found");
    }
    await assertOwnedCourse(tx, instructorId, topic.courseId);
    return {
      topic,
      currentVersion: topic.currentVersion ?? null,
    };
  });
}

export async function listTopicVersionsForInstructor(
  db: RedesignDb,
  instructorId: string,
  topicId: string,
) {
  return db.$transaction(async (tx) => {
    const topic = await tx.topic.findUnique({
      where: { id: topicId },
      select: { courseId: true },
    });
    if (!topic) {
      throw new DomainInvariantError("Topic not found");
    }
    await assertOwnedCourse(tx, instructorId, topic.courseId);
    return tx.topicVersion.findMany({
      where: { topicId },
      orderBy: { revision: "asc" },
    });
  });
}

export async function updateTopic(
  db: RedesignDb,
  instructorId: string,
  topicId: string,
  input: { stableCode?: string; learningModuleId?: string | null; archivedAt?: Date | null },
) {
  return db.$transaction(async (tx) => {
    const topic = await tx.topic.findUnique({
      where: { id: topicId },
      select: { id: true, courseId: true, stableCode: true, learningModuleId: true },
    });
    if (!topic) {
      throw new DomainInvariantError("Topic not found");
    }
    await assertOwnedCourse(tx, instructorId, topic.courseId);

    if (input.learningModuleId !== undefined && input.learningModuleId !== null) {
      const learningModule = await tx.learningModule.findUnique({
        where: { id: input.learningModuleId },
        select: { courseId: true },
      });
      if (!learningModule) {
        throw new DomainInvariantError("Learning Module not found");
      }
      assertSameCourse(topic.courseId, learningModule.courseId, "Topic assignment");
    }

    if (input.stableCode && input.stableCode !== topic.stableCode) {
      const duplicate = await tx.topic.findUnique({
        where: {
          courseId_stableCode: {
            courseId: topic.courseId,
            stableCode: input.stableCode,
          },
        },
      });
      if (duplicate && duplicate.id !== topicId) {
        throw new DomainInvariantError("Topic stableCode must be unique within the Course");
      }
    }

    const data = withoutUndefined({
      stableCode: input.stableCode,
      learningModuleId: input.learningModuleId,
      archivedAt: input.archivedAt,
    });
    if (Object.keys(data).length === 0) {
      return topic;
    }

    return tx.topic.update({
      where: { id: topicId },
      data,
    });
  });
}

export async function archiveTopic(db: RedesignDb, instructorId: string, topicId: string) {
  return updateTopic(db, instructorId, topicId, { archivedAt: new Date() });
}

export async function reviseTopic(
  db: RedesignDb,
  input: {
    topicId: string;
    expectedCurrentVersionId: string;
    createdByInstructorId: string;
    draft: TopicVersionDraft;
    publish?: boolean;
  },
) {
  return db.$transaction(async (tx) => {
    const topic = await tx.topic.findUnique({
      where: { id: input.topicId },
      include: { currentVersion: true },
    });
    if (!topic?.currentVersion) {
      throw new DomainInvariantError("Topic current version is missing");
    }
    if (topic.currentVersionId !== input.expectedCurrentVersionId) {
      throw new ConcurrencyConflictError();
    }
    assertSameIdentityVersion(topic.id, topic.currentVersion.topicId, "Topic");

    const version = await createTopicVersion(tx, {
      topic,
      revision: topic.currentVersion.revision + 1,
      createdByInstructorId: input.createdByInstructorId,
      draft: input.draft,
      publishedAt: input.publish ? new Date() : null,
    });
    await tx.topic.update({
      where: { id: topic.id },
      data: { currentVersionId: version.id },
    });
    return version;
  });
}

export async function assertPublishedLearningModuleVersionImmutable(
  tx: RedesignTx,
  versionId: string,
) {
  const version = await tx.learningModuleVersion.findUnique({ where: { id: versionId } });
  if (version?.publishedAt) throw new ImmutablePublishedVersionError();
}

export async function assertPublishedTopicVersionImmutable(tx: RedesignTx, versionId: string) {
  const version = await tx.topicVersion.findUnique({ where: { id: versionId } });
  if (version?.publishedAt) throw new ImmutablePublishedVersionError();
}

// Exported so offering-service can create delivered-revision versions with
// the same topic-snapshot validation, without duplicating it.
export async function createLearningModuleVersion(
  tx: RedesignTx,
  input: {
    learningModule: { id: string; courseId: string };
    revision: number;
    createdByInstructorId: string;
    draft: LearningModuleVersionDraft;
    publishedAt: Date | null;
  },
) {
  await assertTopicSnapshotsBelongToLearningModuleCourse(
    tx,
    input.learningModule,
    input.draft.topics ?? [],
  );

  return tx.learningModuleVersion.create({
    data: {
      learningModuleId: input.learningModule.id,
      revision: input.revision,
      title: input.draft.title,
      description: input.draft.description ?? null,
      studentDescription: input.draft.studentDescription ?? null,
      learningObjectives: input.draft.learningObjectives ?? [],
      notes: input.draft.notes ?? null,
      defaultSequence: input.draft.defaultSequence ?? null,
      changeSummary: input.draft.changeSummary ?? null,
      createdByInstructorId: input.createdByInstructorId,
      publishedAt: input.publishedAt,
      topics: {
        create: (input.draft.topics ?? []).map((topic) => ({
          topicVersionId: topic.topicVersionId,
          sequence: topic.sequence,
        })),
      },
    },
    include: { topics: { orderBy: { sequence: "asc" } } },
  });
}

async function createTopicVersion(
  tx: RedesignTx,
  input: {
    topic: { id: string };
    revision: number;
    createdByInstructorId: string;
    draft: TopicVersionDraft;
    publishedAt: Date | null;
  },
) {
  return tx.topicVersion.create({
    data: {
      topicId: input.topic.id,
      revision: input.revision,
      title: input.draft.title,
      category: input.draft.category ?? null,
      description: input.draft.description ?? null,
      changeSummary: input.draft.changeSummary ?? null,
      createdByInstructorId: input.createdByInstructorId,
      publishedAt: input.publishedAt,
    },
  });
}

async function assertTopicSnapshotsBelongToLearningModuleCourse(
  tx: RedesignTx,
  learningModule: { id: string; courseId: string },
  topics: TopicSnapshotInput[],
) {
  for (const snapshot of topics) {
    const topicVersion = await tx.topicVersion.findUnique({
      where: { id: snapshot.topicVersionId },
      include: { topic: true },
    });
    if (!topicVersion) throw new DomainInvariantError("Topic version not found");
    assertSameCourse(learningModule.courseId, topicVersion.topic.courseId, "Learning Module snapshot");
    if (topicVersion.topic.learningModuleId !== learningModule.id) {
      throw new DomainInvariantError(
        "Learning Module version snapshots may only contain Topic versions assigned to that Learning Module",
      );
    }
  }
}

async function assertOwnedCourse(tx: RedesignTx, instructorId: string, courseId: string) {
  const course = await tx.course.findUnique({
    where: { id_instructorId: { id: courseId, instructorId } },
  });
  if (!course) {
    throw new DomainInvariantError("Course not found");
  }
  return course;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
