/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import { DomainInvariantError } from "./errors";
import {
  listActivityLmScopeForInstructor,
  listActivityTopicActionsForInstructor,
  listActivityTopicScopeForInstructor,
  replaceActivityLmScopeForInstructor,
  replaceActivityTopicActionsForInstructor,
  replaceActivityTopicScopeForInstructor,
} from "./activity-relationship-service";

function createTransactionalDb(tx: Record<string, any>) {
  return {
    $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) => fn(tx),
  };
}

function ownedActivityVersion(courseId = "course-1", instructorId = "instructor-1") {
  return {
    id: "av-1",
    activityId: "activity-1",
    activity: { id: "activity-1", courseId, course: { instructorId } },
  };
}

function ownedActivity(courseId = "course-1", instructorId = "instructor-1") {
  return { id: "activity-1", courseId, course: { instructorId } };
}

describe("Activity Learning Module scope", () => {
  it("replaces the full set: adds, removes, and keeps rows", async () => {
    const deleted: any[] = [];
    const created: any[] = [];
    const tx = {
      activityVersion: { findUnique: async () => ownedActivityVersion() },
      learningModule: {
        findUnique: async ({ where }: any) =>
          where.id === "lm-keep" || where.id === "lm-new" ? { courseId: "course-1" } : null,
      },
      activityVersionLearningModuleScope: {
        deleteMany: async (args: any) => {
          deleted.push(args);
          return { count: 1 };
        },
        createMany: async (args: any) => {
          created.push(args);
          return { count: args.data.length };
        },
        findMany: async () => [
          { id: "s-1", activityVersionId: "av-1", learningModuleId: "lm-keep", emphasis: null, notes: null },
          { id: "s-2", activityVersionId: "av-1", learningModuleId: "lm-new", emphasis: "recap", notes: null },
        ],
      },
    };

    const result = await replaceActivityLmScopeForInstructor(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      activityVersionId: "av-1",
      scopes: [
        { learningModuleId: "lm-keep" },
        { learningModuleId: "lm-new", emphasis: "recap" },
      ],
    });

    expect(deleted).toEqual([{ where: { activityVersionId: "av-1" } }]);
    expect(created[0].data).toHaveLength(2);
    expect(result.map((s: any) => s.learningModuleId)).toEqual(["lm-keep", "lm-new"]);
  });

  it("rejects a Learning Module from a foreign Course", async () => {
    const tx = {
      activityVersion: { findUnique: async () => ownedActivityVersion() },
      learningModule: { findUnique: async () => ({ courseId: "course-2" }) },
    };

    await expect(
      replaceActivityLmScopeForInstructor(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        activityVersionId: "av-1",
        scopes: [{ learningModuleId: "lm-foreign" }],
      }),
    ).rejects.toThrow("cannot cross Course boundaries");
  });

  it("treats another Instructor's Activity version as not-found", async () => {
    const tx = {
      activityVersion: { findUnique: async () => ownedActivityVersion("course-1", "instructor-2") },
    };

    await expect(
      listActivityLmScopeForInstructor(createTransactionalDb(tx), "instructor-1", "av-1"),
    ).rejects.toThrow(DomainInvariantError);
  });
});

describe("Activity Topic actions", () => {
  it("replaces the full set: adds, removes, and keeps rows", async () => {
    let currentRows = [
      { id: "a-old", activityVersionId: "av-1", topicVersionId: "tv-old", action: "introduced" },
    ];
    const tx = {
      activityVersion: { findUnique: async () => ownedActivityVersion() },
      topicVersion: {
        findUnique: async ({ where }: any) =>
          where.id === "tv-keep" || where.id === "tv-new"
            ? { topic: { courseId: "course-1" } }
            : null,
      },
      activityVersionTopicAction: {
        deleteMany: async () => {
          currentRows = [];
          return { count: 1 };
        },
        createMany: async ({ data }: any) => {
          currentRows = data.map((d: any, i: number) => ({ id: `new-${i}`, ...d }));
          return { count: data.length };
        },
        findMany: async (args: any) => {
          if (args.where?.activityVersionId) {
            return currentRows.filter((r) => r.activityVersionId === args.where.activityVersionId);
          }
          // sibling lookup
          return currentRows.filter(
            (r) =>
              r.topicVersionId === args.where.topicVersionId &&
              r.action === args.where.action &&
              r.id !== args.where.id.not,
          );
        },
      },
    };

    const result = await replaceActivityTopicActionsForInstructor(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      activityVersionId: "av-1",
      actions: [
        { topicVersionId: "tv-keep", action: "introduced" },
        { topicVersionId: "tv-new", action: "practiced" },
      ],
    });

    expect(result.map((r: any) => r.topicVersionId)).toEqual(["tv-keep", "tv-new"]);
    expect(result.every((r: any) => Array.isArray(r.siblings))).toBe(true);
  });

  it("rejects a Topic version from a foreign Course", async () => {
    const tx = {
      activityVersion: { findUnique: async () => ownedActivityVersion() },
      topicVersion: { findUnique: async () => ({ topic: { courseId: "course-2" } }) },
    };

    await expect(
      replaceActivityTopicActionsForInstructor(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        activityVersionId: "av-1",
        actions: [{ topicVersionId: "tv-foreign", action: "introduced" }],
      }),
    ).rejects.toThrow("cannot cross Course boundaries");
  });

  it("treats another Instructor's Activity version as not-found when listing", async () => {
    const tx = {
      activityVersion: { findUnique: async () => ownedActivityVersion("course-1", "instructor-2") },
    };

    await expect(
      listActivityTopicActionsForInstructor(createTransactionalDb(tx), "instructor-1", "av-1"),
    ).rejects.toThrow(DomainInvariantError);
  });

  it("lists topic actions with siblings for an owned Activity version", async () => {
    const tx = {
      activityVersion: { findUnique: async () => ownedActivityVersion() },
      activityVersionTopicAction: {
        findMany: async (args: any) => {
          if (args.where?.activityVersionId) {
            return [
              { id: "row-1", activityVersionId: "av-1", topicVersionId: "tv-1", action: "introduced" },
            ];
          }
          return [];
        },
      },
    };

    const result = await listActivityTopicActionsForInstructor(createTransactionalDb(tx), "instructor-1", "av-1");
    expect(result).toEqual([
      {
        id: "row-1",
        activityVersionId: "av-1",
        topicVersionId: "tv-1",
        action: "introduced",
        siblings: [],
      },
    ]);
  });

  it("allows the same Topic/action pair on a different Activity version and reports it as a sibling", async () => {
    const rowsByVersion: Record<string, any[]> = {
      "av-1": [{ id: "row-1", activityVersionId: "av-1", topicVersionId: "tv-1", action: "introduced" }],
    };
    const tx = {
      activityVersion: { findUnique: async () => ownedActivityVersion() },
      topicVersion: { findUnique: async () => ({ topic: { courseId: "course-1" } }) },
      activityVersionTopicAction: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async ({ data }: any) => {
          rowsByVersion["av-1"] = data.map((d: any, i: number) => ({ id: `av1-${i}`, ...d }));
          return { count: data.length };
        },
        findMany: async (args: any) => {
          if (args.where?.activityVersionId) {
            return rowsByVersion[args.where.activityVersionId] ?? [];
          }
          // sibling lookup: another Activity version (av-2) already carries tv-1/introduced
          const all = [
            ...rowsByVersion["av-1"],
            { id: "row-sibling", activityVersionId: "av-2", topicVersionId: "tv-1", action: "introduced" },
          ];
          return all
            .filter((r) => r.topicVersionId === args.where.topicVersionId && r.action === args.where.action)
            .filter((r) => r.id !== args.where.id.not)
            .map((r) => ({
              ...r,
              activityVersion: { activity: { id: "activity-2", stableCode: "P02" } },
            }));
        },
      },
    };

    const result = await replaceActivityTopicActionsForInstructor(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      activityVersionId: "av-1",
      actions: [{ topicVersionId: "tv-1", action: "introduced" }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].siblings).toEqual([
      { activityVersionId: "av-2", activityId: "activity-2", activityStableCode: "P02", action: "introduced" },
    ]);
  });
});

describe("Activity Topic scope", () => {
  it("replaces the full set: adds, removes, and keeps rows", async () => {
    const tx = {
      activity: { findUnique: async () => ownedActivity() },
      topic: {
        findUnique: async ({ where }: any) =>
          where.id === "topic-keep" || where.id === "topic-new" ? { courseId: "course-1" } : null,
      },
      activityTopicScope: {
        deleteMany: async () => ({ count: 1 }),
        createMany: async ({ data }: any) => ({ count: data.length }),
        findMany: async () => [
          { id: "sc-1", activityId: "activity-1", topicId: "topic-keep", notes: null, provenance: null },
          { id: "sc-2", activityId: "activity-1", topicId: "topic-new", notes: null, provenance: null },
        ],
      },
    };

    const result = await replaceActivityTopicScopeForInstructor(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      activityId: "activity-1",
      scopes: [{ topicId: "topic-keep" }, { topicId: "topic-new" }],
    });

    expect(result.map((s: any) => s.topicId)).toEqual(["topic-keep", "topic-new"]);
  });

  it("rejects a Topic from a foreign Course", async () => {
    const tx = {
      activity: { findUnique: async () => ownedActivity() },
      topic: { findUnique: async () => ({ courseId: "course-2" }) },
    };

    await expect(
      replaceActivityTopicScopeForInstructor(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        activityId: "activity-1",
        scopes: [{ topicId: "topic-foreign" }],
      }),
    ).rejects.toThrow("cannot cross Course boundaries");
  });

  it("treats another Instructor's Activity as not-found", async () => {
    const tx = {
      activity: { findUnique: async () => ownedActivity("course-1", "instructor-2") },
    };

    await expect(
      listActivityTopicScopeForInstructor(createTransactionalDb(tx), "instructor-1", "activity-1"),
    ).rejects.toThrow(DomainInvariantError);
  });
});
