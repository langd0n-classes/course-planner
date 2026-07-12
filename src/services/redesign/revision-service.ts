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

async function createLearningModuleVersion(
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
