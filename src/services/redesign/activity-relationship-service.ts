// Activity relationship graph: Activity Learning Module scope, Activity Topic
// actions (I/P/A), and Activity Topic scope. Ordered LM-version Activity
// membership lives in revision-service.ts (it is the LM-version write path's
// job, not a separate relation owned here).
import { DomainInvariantError } from "./errors";
import { assertSameCourse } from "./invariants";
import type { RedesignDb, RedesignTx } from "./types";
import type { CoverageLevel } from "@/lib/redesign-contract";

async function findOwnedActivityVersion(
  tx: RedesignTx,
  instructorId: string,
  activityVersionId: string,
) {
  const version = await tx.activityVersion.findUnique({
    where: { id: activityVersionId },
    include: { activity: { include: { course: { select: { instructorId: true } } } } },
  });
  if (!version || version.activity?.course?.instructorId !== instructorId) {
    throw new DomainInvariantError("Activity version not found");
  }
  return version;
}

async function findOwnedActivity(tx: RedesignTx, instructorId: string, activityId: string) {
  const activity = await tx.activity.findUnique({
    where: { id: activityId },
    include: { course: { select: { instructorId: true } } },
  });
  if (!activity || activity.course?.instructorId !== instructorId) {
    throw new DomainInvariantError("Activity not found");
  }
  return activity;
}

// ─── Activity Learning Module scope (ActivityVersionLearningModuleScope) ───
// An independent many-to-many link expressing e.g. "the final project recaps
// LM-01 through LM-06" without a primary placement. Attaches to the
// immutable ActivityVersion, per the frozen contract's `activityVersionId`
// field (`ActivityVersionLearningModuleScopeDto`).

export async function listActivityLmScopeForInstructor(
  db: RedesignDb,
  instructorId: string,
  activityVersionId: string,
) {
  return db.$transaction(async (tx) => {
    await findOwnedActivityVersion(tx, instructorId, activityVersionId);
    return tx.activityVersionLearningModuleScope.findMany({
      where: { activityVersionId },
      orderBy: { learningModuleId: "asc" },
    });
  });
}

export async function replaceActivityLmScopeForInstructor(
  db: RedesignDb,
  input: {
    instructorId: string;
    activityVersionId: string;
    scopes: Array<{ learningModuleId: string; emphasis?: string | null; notes?: string | null }>;
  },
) {
  return db.$transaction(async (tx) => {
    const version = await findOwnedActivityVersion(tx, input.instructorId, input.activityVersionId);

    for (const scope of input.scopes) {
      const learningModule = await tx.learningModule.findUnique({
        where: { id: scope.learningModuleId },
        select: { courseId: true },
      });
      if (!learningModule) throw new DomainInvariantError("Learning Module not found");
      assertSameCourse(version.activity.courseId, learningModule.courseId, "Activity Learning Module scope");
    }

    await tx.activityVersionLearningModuleScope.deleteMany({
      where: { activityVersionId: input.activityVersionId },
    });
    if (input.scopes.length > 0) {
      await tx.activityVersionLearningModuleScope.createMany({
        data: input.scopes.map((scope) => ({
          activityVersionId: input.activityVersionId,
          learningModuleId: scope.learningModuleId,
          emphasis: scope.emphasis ?? null,
          notes: scope.notes ?? null,
        })),
      });
    }

    return tx.activityVersionLearningModuleScope.findMany({
      where: { activityVersionId: input.activityVersionId },
      orderBy: { learningModuleId: "asc" },
    });
  });
}

// ─── Activity Topic actions (ActivityVersionTopicAction) ───────────────────
// Attaches to the immutable ActivityVersion (`topicVersionId`, versioned).
// The same Topic/action on a *different* Activity version is valid and
// intentional (e.g. revisiting a Topic) — the unique constraint only blocks
// an indistinguishable duplicate row on the same version, which the frozen
// Zod schema's dedupe refine already rejects before this service runs. List
// and replace both return `siblings`: the other Activity versions in the
// Course carrying the same (topicVersionId, action) pair, so the UI can warn
// and cross-link.

type TopicActionRow = {
  id: string;
  activityVersionId: string;
  topicVersionId: string;
  action: CoverageLevel;
  notes: string | null;
  provenance: unknown;
};

async function withTopicActionSiblings(tx: RedesignTx, rows: TopicActionRow[]) {
  const result = [];
  for (const row of rows) {
    const siblingRows = await tx.activityVersionTopicAction.findMany({
      where: {
        topicVersionId: row.topicVersionId,
        action: row.action,
        id: { not: row.id },
      },
      include: { activityVersion: { include: { activity: { select: { id: true, stableCode: true } } } } },
    });
    result.push({
      ...row,
      siblings: siblingRows.map(
        (sibling: {
          activityVersionId: string;
          action: CoverageLevel;
          activityVersion: { activity: { id: string; stableCode: string } };
        }) => ({
          activityVersionId: sibling.activityVersionId,
          activityId: sibling.activityVersion.activity.id,
          activityStableCode: sibling.activityVersion.activity.stableCode,
          action: sibling.action,
        }),
      ),
    });
  }
  return result;
}

export async function listActivityTopicActionsForInstructor(
  db: RedesignDb,
  instructorId: string,
  activityVersionId: string,
) {
  return db.$transaction(async (tx) => {
    await findOwnedActivityVersion(tx, instructorId, activityVersionId);
    const rows = await tx.activityVersionTopicAction.findMany({
      where: { activityVersionId },
      orderBy: { createdAt: "asc" },
    });
    return withTopicActionSiblings(tx, rows);
  });
}

export async function replaceActivityTopicActionsForInstructor(
  db: RedesignDb,
  input: {
    instructorId: string;
    activityVersionId: string;
    actions: Array<{
      topicVersionId: string;
      action: CoverageLevel;
      notes?: string | null;
      provenance?: unknown;
    }>;
  },
) {
  return db.$transaction(async (tx) => {
    const version = await findOwnedActivityVersion(tx, input.instructorId, input.activityVersionId);

    for (const action of input.actions) {
      const topicVersion = await tx.topicVersion.findUnique({
        where: { id: action.topicVersionId },
        include: { topic: { select: { courseId: true } } },
      });
      if (!topicVersion) throw new DomainInvariantError("Topic version not found");
      assertSameCourse(version.activity.courseId, topicVersion.topic.courseId, "Activity Topic action");
    }

    await tx.activityVersionTopicAction.deleteMany({
      where: { activityVersionId: input.activityVersionId },
    });
    if (input.actions.length > 0) {
      await tx.activityVersionTopicAction.createMany({
        data: input.actions.map((action) => ({
          activityVersionId: input.activityVersionId,
          topicVersionId: action.topicVersionId,
          action: action.action,
          notes: action.notes ?? null,
          provenance: action.provenance ?? undefined,
        })),
      });
    }

    const rows = await tx.activityVersionTopicAction.findMany({
      where: { activityVersionId: input.activityVersionId },
      orderBy: { createdAt: "asc" },
    });
    return withTopicActionSiblings(tx, rows);
  });
}

// ─── Activity Topic scope (ActivityTopicScope) ─────────────────────────────
// Connects a project/exam to Topic identities without claiming a specific
// I/P/A occurrence (the future-compatible recap seam). Attaches to the
// stable Activity identity, per the frozen contract's `activityId` field
// (`ActivityTopicScopeDto`) — the mirror image of Topic actions' version
// attachment.

export async function listActivityTopicScopeForInstructor(
  db: RedesignDb,
  instructorId: string,
  activityId: string,
) {
  return db.$transaction(async (tx) => {
    await findOwnedActivity(tx, instructorId, activityId);
    return tx.activityTopicScope.findMany({
      where: { activityId },
      orderBy: { topicId: "asc" },
    });
  });
}

export async function replaceActivityTopicScopeForInstructor(
  db: RedesignDb,
  input: {
    instructorId: string;
    activityId: string;
    scopes: Array<{ topicId: string; notes?: string | null; provenance?: unknown }>;
  },
) {
  return db.$transaction(async (tx) => {
    const activity = await findOwnedActivity(tx, input.instructorId, input.activityId);

    for (const scope of input.scopes) {
      const topic = await tx.topic.findUnique({
        where: { id: scope.topicId },
        select: { courseId: true },
      });
      if (!topic) throw new DomainInvariantError("Topic not found");
      assertSameCourse(activity.courseId, topic.courseId, "Activity Topic scope");
    }

    await tx.activityTopicScope.deleteMany({ where: { activityId: input.activityId } });
    if (input.scopes.length > 0) {
      await tx.activityTopicScope.createMany({
        data: input.scopes.map((scope) => ({
          activityId: input.activityId,
          topicId: scope.topicId,
          notes: scope.notes ?? null,
          provenance: scope.provenance ?? undefined,
        })),
      });
    }

    return tx.activityTopicScope.findMany({
      where: { activityId: input.activityId },
      orderBy: { topicId: "asc" },
    });
  });
}
