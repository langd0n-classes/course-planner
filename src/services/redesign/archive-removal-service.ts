import { DomainInvariantError } from "./errors";
import type { RedesignDb, RedesignTx } from "./types";

export type ArchiveableEntityType = "course" | "learning_module" | "topic" | "artifact";

export type HardRemovalBlocker = {
  code: string;
  count: number;
  message: string;
};

export type HardRemovalPreview = {
  entityType: ArchiveableEntityType;
  entityId: string;
  canRemove: boolean;
  blockers: HardRemovalBlocker[];
  cascadeDeletes: string[];
};

export async function setArchivedState(
  db: RedesignDb,
  entityType: ArchiveableEntityType,
  entityId: string,
  archivedAt: Date | null,
) {
  return db.$transaction(async (tx) => {
    const delegate = getDelegate(tx, entityType);
    const existing = await delegate.findUnique({ where: { id: entityId } });
    if (!existing) {
      throw new DomainInvariantError(`${labelFor(entityType)} not found`);
    }

    return delegate.update({
      where: { id: entityId },
      data: { archivedAt },
    });
  });
}

export async function previewHardRemoval(
  db: RedesignDb,
  entityType: Exclude<ArchiveableEntityType, "artifact">,
  entityId: string,
) {
  return db.$transaction((tx) => previewHardRemovalTx(tx, entityType, entityId));
}

export async function hardRemoveTopic(db: RedesignDb, topicId: string) {
  return db.$transaction(async (tx) => {
    const preview = await previewHardRemovalTx(tx, "topic", topicId);
    if (!preview.canRemove) {
      throw new DomainInvariantError(
        `Topic cannot be hard-removed while references exist: ${preview.blockers
          .map((blocker) => blocker.code)
          .join(", ")}`,
      );
    }

    await tx.topicPrerequisite.deleteMany({
      where: {
        OR: [{ topicId }, { prerequisiteTopicId: topicId }],
      },
    });
    await tx.topicVersion.deleteMany({ where: { topicId } });
    return tx.topic.delete({ where: { id: topicId } });
  });
}

async function previewHardRemovalTx(
  tx: RedesignTx,
  entityType: Exclude<ArchiveableEntityType, "artifact">,
  entityId: string,
): Promise<HardRemovalPreview> {
  switch (entityType) {
    case "course":
      return previewCourseHardRemoval(tx, entityId);
    case "learning_module":
      return previewLearningModuleHardRemoval(tx, entityId);
    case "topic":
      return previewTopicHardRemoval(tx, entityId);
  }
}

async function previewCourseHardRemoval(
  tx: RedesignTx,
  courseId: string,
): Promise<HardRemovalPreview> {
  const course = await tx.course.findUnique({ where: { id: courseId } });
  if (!course) throw new DomainInvariantError("Course not found");

  const [termCount, learningModuleCount, topicCount] = await Promise.all([
    tx.term.count({ where: { courseId } }),
    tx.learningModule.count({ where: { courseId } }),
    tx.topic.count({ where: { courseId } }),
  ]);

  return finalizePreview("course", courseId, [
    blocker("terms_exist", termCount, "Hard removal cannot erase delivered Term history."),
    blocker(
      "learning_modules_exist",
      learningModuleCount,
      "Hard removal requires removing unused Learning Modules explicitly.",
    ),
    blocker(
      "topics_exist",
      topicCount,
      "Hard removal requires removing unused Topics explicitly.",
    ),
  ]);
}

async function previewLearningModuleHardRemoval(
  tx: RedesignTx,
  learningModuleId: string,
): Promise<HardRemovalPreview> {
  const learningModule = await tx.learningModule.findUnique({ where: { id: learningModuleId } });
  if (!learningModule) throw new DomainInvariantError("Learning Module not found");

  const [topicCount, termOfferingCount, versionArtifactCount] = await Promise.all([
    tx.topic.count({ where: { learningModuleId } }),
    tx.termLearningModule.count({ where: { learningModuleId } }),
    tx.artifact.count({
      where: { learningModuleVersion: { learningModuleId } },
    }),
  ]);

  return finalizePreview("learning_module", learningModuleId, [
    blocker(
      "topics_assigned",
      topicCount,
      "Assigned Topics must be detached or removed explicitly before hard removal.",
    ),
    blocker(
      "term_adoptions_exist",
      termOfferingCount,
      "Hard removal cannot erase adopted Learning Module history.",
    ),
    blocker(
      "artifacts_attached",
      versionArtifactCount,
      "Learning Module Artifacts must be removed explicitly before hard removal.",
    ),
  ]);
}

async function previewTopicHardRemoval(
  tx: RedesignTx,
  topicId: string,
): Promise<HardRemovalPreview> {
  const topic = await tx.topic.findUnique({ where: { id: topicId } });
  if (!topic) throw new DomainInvariantError("Topic not found");

  const [snapshotCount, coverageCount, assessmentCount, artifactCount] = await Promise.all([
    tx.learningModuleVersionTopic.count({
      where: { topicVersion: { topicId } },
    }),
    tx.coverage.count({
      where: { topicVersion: { topicId } },
    }),
    tx.assessmentTopic.count({
      where: { topicVersion: { topicId } },
    }),
    tx.artifact.count({
      where: { topicVersion: { topicId } },
    }),
  ]);

  return finalizePreview(
    "topic",
    topicId,
    [
      blocker(
        "learning_module_snapshots_exist",
        snapshotCount,
        "Hard removal cannot erase Topic version history used in curriculum snapshots.",
      ),
      blocker(
        "coverages_exist",
        coverageCount,
        "Hard removal cannot erase delivered Topic coverage history.",
      ),
      blocker(
        "assessment_links_exist",
        assessmentCount,
        "Hard removal cannot erase Topic assessment alignment history.",
      ),
      blocker(
        "artifacts_attached",
        artifactCount,
        "Topic Artifacts must be removed explicitly before hard removal.",
      ),
    ],
    ["topic_prerequisites", "topic_versions", "topic"],
  );
}

function finalizePreview(
  entityType: ArchiveableEntityType,
  entityId: string,
  blockers: HardRemovalBlocker[],
  cascadeDeletes: string[] = [],
): HardRemovalPreview {
  const activeBlockers = blockers.filter((blocker) => blocker.count > 0);
  return {
    entityType,
    entityId,
    canRemove: activeBlockers.length === 0,
    blockers: activeBlockers,
    cascadeDeletes: activeBlockers.length === 0 ? cascadeDeletes : [],
  };
}

function blocker(code: string, count: number, message: string): HardRemovalBlocker {
  return { code, count, message };
}

function getDelegate(tx: RedesignTx, entityType: ArchiveableEntityType) {
  switch (entityType) {
    case "course":
      return tx.course;
    case "learning_module":
      return tx.learningModule;
    case "topic":
      return tx.topic;
    case "artifact":
      return tx.artifact;
  }
}

function labelFor(entityType: ArchiveableEntityType) {
  switch (entityType) {
    case "course":
      return "Course";
    case "learning_module":
      return "Learning Module";
    case "topic":
      return "Topic";
    case "artifact":
      return "Artifact";
  }
}
