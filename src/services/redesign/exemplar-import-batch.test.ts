/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma call-count double */
import { describe, expect, it } from "vitest";
import { ExemplarImportService } from "./exemplar-import-service";

function countImport(topicCount: number) {
  const calls: string[] = [];
  const topics: any[] = [];
  const versions: any[] = [];
  const delegate = (
    name: string,
    methods: Record<string, (args: any) => any>,
  ) =>
    Object.fromEntries(
      Object.entries(methods).map(([method, fn]) => [
        method,
        async (args: any) => {
          calls.push(`${name}.${method}`);
          return fn(args);
        },
      ]),
    );
  const tx: Record<string, any> = {
    course: delegate("course", {
      findUnique: () => ({ id: "course-1", instructorId: "instructor-1" }),
    }),
    activityType: delegate("activityType", { findMany: () => [] }),
    courseActivityTypeVersion: delegate("courseActivityTypeVersion", {
      createMany: () => ({ count: 0 }),
    }),
    learningModule: delegate("learningModule", { findMany: () => [] }),
    topic: delegate("topic", {
      findMany: () => topics,
      findUnique: ({ where }) =>
        topics.find(
          (row) => row.stableCode === where.courseId_stableCode.stableCode,
        ) ?? null,
      create: ({ data }) => {
        const row = { id: `topic-${topics.length}`, ...data };
        topics.push(row);
        return row;
      },
      update: ({ where, data }) => {
        const row = topics.find((row) => row.id === where.id);
        Object.assign(row, data);
        return row;
      },
      createMany: ({ data }) => {
        topics.push(...data);
        return { count: data.length };
      },
    }),
    topicVersion: delegate("topicVersion", {
      create: ({ data }) => {
        const row = { id: `version-${versions.length}`, ...data };
        versions.push(row);
        return row;
      },
      createMany: ({ data }) => {
        versions.push(...data);
        return { count: data.length };
      },
    }),
    activity: delegate("activity", { findMany: () => [] }),
    activityVersionTopicAction: delegate("activityVersionTopicAction", {
      findMany: () => [],
    }),
    activityTopicScope: delegate("activityTopicScope", { findMany: () => [] }),
    $executeRawUnsafe: async (...args: unknown[]) => {
      calls.push("$executeRawUnsafe");
      const ids = args.slice(1);
      for (let index = 0; index < ids.length; index += 2) {
        const topic = topics.find((row) => row.id === ids[index]);
        if (topic) topic.currentVersionId = ids[index + 1];
      }
      return ids.length / 2;
    },
  };
  const db = {
    $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) =>
      fn(tx),
  };
  const snapshot = {
    snapshotId: "batch-count",
    course: { title: "Example", number: "EX 1" },
    activityTypes: [],
    learningModules: [],
    activities: [],
    topics: Array.from({ length: topicCount }, (_, index) => ({
      stableCode: `T-${index}`,
      learningModuleCode: "LM",
      title: `Topic ${index}`,
    })),
  };
  return { calls, topics, versions, db, snapshot };
}

describe("exemplar import database calls", () => {
  it("uses a fixed number of calls as Topic rows increase", async () => {
    const service = new ExemplarImportService();
    const counts = [];
    for (const size of [1, 20, 130]) {
      const fixture = countImport(size);
      const result = await service.apply(fixture.db, {
        instructorId: "instructor-1",
        courseId: "course-1",
        snapshot: fixture.snapshot,
      });
      expect(result.createdOrReused.topic).toBe(size);
      expect(fixture.topics).toHaveLength(size);
      expect(fixture.versions).toHaveLength(size);
      counts.push(fixture.calls.length);
    }
    expect(counts).toEqual([11, 11, 11]);
  });
});
