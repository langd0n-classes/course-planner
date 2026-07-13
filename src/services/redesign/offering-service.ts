import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import {
  getOwnedTermForInstructor,
  getOwnedTermLearningModuleForInstructor,
} from "./ownership-service";
import { assertSameCourse } from "./invariants";
import { createLearningModuleVersion } from "./revision-service";
import type { LearningModuleVersionDraft, RedesignDb, RedesignTx, TopicSnapshotInput } from "./types";

function assertWritableTerm(status: "planned" | "active" | "closed") {
  if (status === "closed") {
    throw new DomainInvariantError("Closed Terms are read-only");
  }
}

export async function adoptLearningModuleForTerm(
  db: RedesignDb,
  input: {
    instructorId: string;
    termId: string;
    learningModuleId: string;
    learningModuleVersionId: string;
    sequence: number;
    notes?: string | null;
  },
) {
  return db.$transaction(async (tx) => {
    const [term, learningModule, version] = await Promise.all([
      getOwnedTermForInstructor(tx, input.instructorId, input.termId),
      tx.learningModule.findUnique({ where: { id: input.learningModuleId } }),
      tx.learningModuleVersion.findUnique({
        where: { id_learningModuleId: {
          id: input.learningModuleVersionId,
          learningModuleId: input.learningModuleId,
        } },
      }),
    ]);

    if (!term || !learningModule || !version) {
      throw new DomainInvariantError("Term, Learning Module, or version not found");
    }
    assertWritableTerm(term.status);
    assertSameCourse(term.courseId, learningModule.courseId, "Term Learning Module adoption");

    return tx.termLearningModule.create({
      data: {
        termId: term.id,
        learningModuleId: learningModule.id,
        learningModuleVersionId: version.id,
        courseId: term.courseId,
        sequence: input.sequence,
        notes: input.notes ?? null,
      },
    });
  });
}

export async function reviseDeliveredLearningModuleForTerm(
  db: RedesignDb,
  input: {
    termLearningModuleId: string;
    deliveredLearningModuleVersionId: string;
  },
) {
  return db.$transaction(async (tx) => {
    const offering = await tx.termLearningModule.findUnique({
      where: { id: input.termLearningModuleId },
    });
    if (!offering) throw new DomainInvariantError("Term Learning Module not found");

    const delivered = await tx.learningModuleVersion.findUnique({
      where: { id_learningModuleId: {
        id: input.deliveredLearningModuleVersionId,
        learningModuleId: offering.learningModuleId,
      } },
    });
    if (!delivered) {
      throw new DomainInvariantError(
        "Delivered Learning Module version must belong to the adopted Learning Module",
      );
    }

    return tx.termLearningModule.update({
      where: { id: offering.id },
      data: { deliveredLearningModuleVersionId: delivered.id },
    });
  });
}

export async function listTermLearningModulesForTerm(
  db: RedesignDb,
  instructorId: string,
  termId: string,
) {
  return db.$transaction(async (tx) => {
    await getOwnedTermForInstructor(tx, instructorId, termId);
    return tx.termLearningModule.findMany({ where: { termId }, orderBy: { sequence: "asc" } });
  });
}

export type UpdateTermLearningModuleInput = {
  sequence?: number;
  notes?: string | null;
};

export async function updateTermLearningModule(
  db: RedesignDb,
  instructorId: string,
  termLearningModuleId: string,
  input: UpdateTermLearningModuleInput,
) {
  return db.$transaction(async (tx) => {
    const offering = await getOwnedTermLearningModuleForInstructor(tx, instructorId, termLearningModuleId);
    assertWritableTerm(offering.term.status);

    return tx.termLearningModule.update({
      where: { id: termLearningModuleId },
      data: { sequence: input.sequence, notes: input.notes },
    });
  });
}

// Removing an adopted Learning Module while Sessions still reference it would
// silently orphan those Sessions' delivery record; the design's guarded
// "detach Sessions, then remove adoption" two-step flow is Lane B/Chunk 5
// scope, so for now removal simply fails while Sessions remain attached.
export async function removeTermLearningModule(
  db: RedesignDb,
  instructorId: string,
  termLearningModuleId: string,
) {
  return db.$transaction(async (tx) => {
    const offering = await getOwnedTermLearningModuleForInstructor(tx, instructorId, termLearningModuleId);
    assertWritableTerm(offering.term.status);
    const attachedSessions = await tx.session.findMany({
      where: { termLearningModuleId },
      select: { id: true },
      take: 1,
    });
    if (attachedSessions.length > 0) {
      throw new DomainInvariantError(
        "Cannot remove a Term Learning Module while Sessions are attached to it",
      );
    }
    await tx.termLearningModule.delete({ where: { id: termLearningModuleId } });
    return offering;
  });
}

// Creates a new immutable LearningModuleVersion revision from in-term edits
// and advances the TermLearningModule's delivered pointer to it (v2.1 §9.2 /
// v2.2 §10.5). The master design pointer (LearningModule.currentVersionId) is
// never touched by this path — that is the separate "adopt a newer master
// version" upgrade path, not in-flight delivery improvisation.
export async function createDeliveredRevision(
  db: RedesignDb,
  input: {
    instructorId: string;
    termLearningModuleId: string;
    expectedDeliveredLearningModuleVersionId: string | null;
    draft: LearningModuleVersionDraft;
  },
) {
  return db.$transaction(async (tx) => {
    const offering = await getOwnedTermLearningModuleForInstructor(
      tx,
      input.instructorId,
      input.termLearningModuleId,
    );
    if (offering.term.status !== "active") {
      throw new DomainInvariantError("Delivered revisions may only be created for active Terms");
    }
    if (offering.deliveredLearningModuleVersionId !== input.expectedDeliveredLearningModuleVersionId) {
      throw new ConcurrencyConflictError(
        "The delivered Learning Module version changed while this edit was in progress",
      );
    }

    const [learningModule, course, latestVersion] = await Promise.all([
      tx.learningModule.findUnique({ where: { id: offering.learningModuleId } }),
      tx.course.findUnique({ where: { id: offering.courseId } }),
      tx.learningModuleVersion.findFirst({
        where: { learningModuleId: offering.learningModuleId },
        orderBy: { revision: "desc" },
      }),
    ]);
    if (!learningModule || !course || !latestVersion) {
      throw new DomainInvariantError("Learning Module or Course not found");
    }

    const deliveredVersion = await createLearningModuleVersion(tx, {
      learningModule: { id: learningModule.id, courseId: learningModule.courseId },
      revision: latestVersion.revision + 1,
      createdByInstructorId: course.instructorId,
      draft: input.draft,
      publishedAt: new Date(),
    });

    const termLearningModule = await tx.termLearningModule.update({
      where: { id: offering.id },
      data: { deliveredLearningModuleVersionId: deliveredVersion.id },
    });

    return { termLearningModule, deliveredVersion };
  });
}

type TopicSnapshotWithTopicId = TopicSnapshotInput & { topicId: string };

async function loadSnapshot(
  tx: RedesignTx,
  learningModuleVersionId: string | null,
): Promise<TopicSnapshotWithTopicId[]> {
  if (!learningModuleVersionId) return [];
  const rows = await tx.learningModuleVersionTopic.findMany({
    where: { learningModuleVersionId },
    include: { topicVersion: { select: { topicId: true } } },
  });
  return rows.map((row: { topicVersionId: string; sequence: number; topicVersion: { topicId: string } }) => ({
    topicVersionId: row.topicVersionId,
    sequence: row.sequence,
    topicId: row.topicVersion.topicId,
  }));
}

export type PlannedDeliveredTopicChange = {
  topicId: string;
  kind: "added" | "removed" | "changed" | "reordered";
  plannedTopicVersionId: string | null;
  deliveredTopicVersionId: string | null;
  plannedSequence: number | null;
  deliveredSequence: number | null;
};

// Derives the planned-vs-delivered Topic diff directly from the two
// LearningModuleVersionTopic snapshots (v2.1 §9.2: "needs no new table").
export async function computePlannedDeliveredDiff(
  db: RedesignDb,
  instructorId: string,
  termLearningModuleId: string,
) {
  return db.$transaction(async (tx) => {
    const offering = await getOwnedTermLearningModuleForInstructor(tx, instructorId, termLearningModuleId);

    const [planned, delivered] = await Promise.all([
      loadSnapshot(tx, offering.learningModuleVersionId),
      loadSnapshot(tx, offering.deliveredLearningModuleVersionId),
    ]);

    const plannedMap = new Map(planned.map((entry) => [entry.topicId, entry]));
    const deliveredMap = new Map(delivered.map((entry) => [entry.topicId, entry]));
    const topicIds = new Set([...plannedMap.keys(), ...deliveredMap.keys()]);

    const changes: PlannedDeliveredTopicChange[] = [];
    for (const topicId of topicIds) {
      const plannedEntry = plannedMap.get(topicId) ?? null;
      const deliveredEntry = deliveredMap.get(topicId) ?? null;

      if (plannedEntry && !deliveredEntry && offering.deliveredLearningModuleVersionId) {
        changes.push({
          topicId,
          kind: "removed",
          plannedTopicVersionId: plannedEntry.topicVersionId,
          deliveredTopicVersionId: null,
          plannedSequence: plannedEntry.sequence,
          deliveredSequence: null,
        });
      } else if (!plannedEntry && deliveredEntry) {
        changes.push({
          topicId,
          kind: "added",
          plannedTopicVersionId: null,
          deliveredTopicVersionId: deliveredEntry.topicVersionId,
          plannedSequence: null,
          deliveredSequence: deliveredEntry.sequence,
        });
      } else if (plannedEntry && deliveredEntry) {
        if (plannedEntry.topicVersionId !== deliveredEntry.topicVersionId) {
          changes.push({
            topicId,
            kind: "changed",
            plannedTopicVersionId: plannedEntry.topicVersionId,
            deliveredTopicVersionId: deliveredEntry.topicVersionId,
            plannedSequence: plannedEntry.sequence,
            deliveredSequence: deliveredEntry.sequence,
          });
        } else if (plannedEntry.sequence !== deliveredEntry.sequence) {
          changes.push({
            topicId,
            kind: "reordered",
            plannedTopicVersionId: plannedEntry.topicVersionId,
            deliveredTopicVersionId: deliveredEntry.topicVersionId,
            plannedSequence: plannedEntry.sequence,
            deliveredSequence: deliveredEntry.sequence,
          });
        }
      }
    }

    const topicChanges = [...changes].sort((left, right) => {
      const leftSequence = left.deliveredSequence ?? left.plannedSequence ?? Number.MAX_SAFE_INTEGER;
      const rightSequence = right.deliveredSequence ?? right.plannedSequence ?? Number.MAX_SAFE_INTEGER;
      if (leftSequence !== rightSequence) return leftSequence - rightSequence;
      return left.topicId.localeCompare(right.topicId);
    });

    return {
      termLearningModuleId: offering.id,
      plannedLearningModuleVersionId: offering.learningModuleVersionId,
      deliveredLearningModuleVersionId: offering.deliveredLearningModuleVersionId,
      topicChanges,
    };
  });
}
