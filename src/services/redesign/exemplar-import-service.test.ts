/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import {
  ExemplarImportService,
  genericDemoExemplarSnapshot,
} from "./exemplar-import-service";

function transactionalDb(tx: Record<string, any>) {
  return {
    $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) =>
      fn(tx),
  };
}

function createMemoryTx() {
  const state: Record<string, any[]> = {
    activityTypes: [],
    activityTypeVersions: [],
    courseActivityTypeVersions: [],
    learningModules: [],
    learningModuleVersions: [],
    learningModuleVersionActivities: [],
    topics: [],
    topicVersions: [],
    activities: [],
    activityVersions: [],
    meetingActivityVersions: [],
    courseworkActivityVersions: [],
    assessmentActivityVersions: [],
    activityVersionTopicActions: [],
    activityTopicScopes: [],
  };
  const matches = (row: any, where: any) =>
    Object.entries(where ?? {}).every(([key, value]: any) =>
      value && typeof value === "object"
        ? value.in.includes(row[key])
        : row[key] === value,
    );
  let n = 1;
  const tx: Record<string, any> = {
    __state: state,
    course: {
      findUnique: async ({ where }: any) =>
        where.id_instructorId?.id === "course-1" &&
        where.id_instructorId?.instructorId === "instructor-1"
          ? { id: "course-1", instructorId: "instructor-1" }
          : null,
    },
  };
  for (const key of Object.keys(state)) {
    const model = key.endsWith("ies")
      ? key.slice(0, -3) + "y"
      : key.slice(0, -1);
    tx[model] = {
      findMany: async ({ where, include }: any) =>
        state[key]
          .filter((row) => matches(row, where))
          .map((row) => {
            if (!include?.currentVersion) return row;
            const version = state[model + "Versions"].find(
              (v) => v.id === row.currentVersionId,
            );
            return {
              ...row,
              currentVersion:
                key === "learningModules" && version
                  ? {
                      ...version,
                      topics: [],
                      activities: state.learningModuleVersionActivities.filter(
                        (v) => v.learningModuleVersionId === version.id,
                      ),
                    }
                  : version,
            };
          }),
      createMany: async ({ data, skipDuplicates }: any) => {
        const rows = data.filter(
          (row: any) =>
            !skipDuplicates ||
            !state[key].some((existing) => matches(existing, row)),
        );
        state[key].push(
          ...rows.map((row: any) => ({ id: `row-${n++}`, ...row })),
        );
        return { count: rows.length };
      },
      deleteMany: async ({ where }: any) => {
        const before = state[key].length;
        state[key] = state[key].filter((row) => !matches(row, where));
        return { count: before - state[key].length };
      },
    };
  }
  tx.$executeRawUnsafe = async (query: string, ...values: string[]) => {
    const table = query.match(/^UPDATE (\w+)/)![1];
    const key = {
      topics: "topics",
      activities: "activities",
      learning_modules: "learningModules",
      activity_types: "activityTypes",
    }[table]!;
    for (let i = 0; i < values.length; i += 2) {
      state[key].find((row) => row.id === values[i]).currentVersionId =
        values[i + 1];
    }
    return values.length / 2;
  };
  return tx;
}

describe("ExemplarImportService", () => {
  it("stages, previews deterministically, and carries provenance for generic content", () => {
    const service = new ExemplarImportService();
    const staged = service.stage(genericDemoExemplarSnapshot);
    const preview = service.preview(staged);
    expect(service.preview(service.stage(genericDemoExemplarSnapshot))).toEqual(
      preview,
    );
    expect(preview.creates.some((entry) => entry.kind === "activity")).toBe(
      true,
    );
    expect(
      preview.provenance.every(
        (entry) => entry.origin.snapshotId === "generic-intro-data-science-v1",
      ),
    ).toBe(true);
    expect(JSON.stringify(preview)).not.toMatch(
      /answerKey|solutionKey|studentScores/,
    );
  });

  it("excludes grading fields before preview or persistence", async () => {
    const service = new ExemplarImportService();
    const snapshot: any = structuredClone(genericDemoExemplarSnapshot);
    snapshot.activities[0].topicActions[0].answerKey = "excluded";
    snapshot.activities[0].topicActions[0].studentScores = [
      { name: "Student A", score: 10 },
    ];

    const staged = service.stage(snapshot);
    expect(staged.exclusions.map((entry) => entry.reason)).toEqual([
      "grading_artifact_excluded",
      "grading_artifact_excluded",
    ]);

    const tx = createMemoryTx();
    await service.apply(transactionalDb(tx), {
      instructorId: "instructor-1",
      courseId: "course-1",
      snapshot,
    });
    expect(JSON.stringify(tx.__state)).not.toMatch(
      /excluded|studentScores|answerKey|Student A/,
    );
  });

  it("uses a long enough interactive transaction timeout for remote imports", async () => {
    const service = new ExemplarImportService();
    const tx = createMemoryTx();
    let transactionOptions: any;
    const db = {
      $transaction: async <T>(
        fn: (innerTx: Record<string, any>) => Promise<T>,
        options?: any,
      ) => {
        transactionOptions = options;
        return fn(tx);
      },
    };

    await service.apply(db, {
      instructorId: "instructor-1",
      courseId: "course-1",
      snapshot: genericDemoExemplarSnapshot,
    });

    expect(transactionOptions).toEqual(
      expect.objectContaining({
        timeout: expect.any(Number),
        maxWait: expect.any(Number),
      }),
    );
    expect(transactionOptions.timeout).toBeGreaterThanOrEqual(60_000);
    expect(transactionOptions.maxWait).toBeGreaterThanOrEqual(5_000);
  });

  it("reports ambiguous references instead of guessing", () => {
    const service = new ExemplarImportService();
    const snapshot: any = structuredClone(genericDemoExemplarSnapshot);
    snapshot.topics.push({
      stableCode: "TOPIC-TABLES-ALT",
      learningModuleCode: "LM-DATA",
      title: "Tabular Data",
    });
    snapshot.activities[0].topicActions[0].topicRef = "Tabular Data";

    const preview = service.preview(service.stage(snapshot));
    expect(preview.ambiguities).toEqual([
      expect.objectContaining({
        reference: "Tabular Data",
        candidates: ["TOPIC-TABLES", "TOPIC-TABLES-ALT"],
      }),
    ]);
  });

  it("applies idempotently and attaches provenance to persisted topic actions", async () => {
    const service = new ExemplarImportService();
    const tx = createMemoryTx();
    await service.apply(transactionalDb(tx), {
      instructorId: "instructor-1",
      courseId: "course-1",
      snapshot: genericDemoExemplarSnapshot,
    });
    const firstGraph = JSON.stringify(tx.__state);

    await service.apply(transactionalDb(tx), {
      instructorId: "instructor-1",
      courseId: "course-1",
      snapshot: genericDemoExemplarSnapshot,
    });
    expect(JSON.stringify(tx.__state)).toEqual(firstGraph);
    expect(tx.__state.activityVersionTopicActions.length).toBeGreaterThan(0);
    expect(
      tx.__state.activityVersionTopicActions.every(
        (row: any) => row.provenance?.oneWay,
      ),
    ).toBe(true);
  });

  it("stores importer provenance as JSON without adding importer text to instructor-visible fields", async () => {
    const service = new ExemplarImportService();
    const tx = createMemoryTx();
    await service.apply(transactionalDb(tx), {
      instructorId: "instructor-1",
      courseId: "course-1",
      snapshot: genericDemoExemplarSnapshot,
    });

    expect(tx.__state.activityVersionTopicActions[0]).toMatchObject({
      provenance: expect.objectContaining({
        importer: "generic_exemplar_importer",
        oneWay: true,
      }),
      notes: null,
    });
    expect(JSON.stringify(tx.__state)).not.toContain("Importer provenance:");
  });

  it("batches identities, all detail families, relationships, and module memberships as the graph grows", async () => {
    const callCounts = [];
    for (const size of [1, 20, 130]) {
      const tx = createMemoryTx();
      let calls = 0;
      for (const [key, value] of Object.entries(tx)) {
        if (key === "__state") continue;
        if (typeof value === "function") {
          tx[key] = (...args: any[]) => {
            calls++;
            return value(...args);
          };
        } else {
          for (const [method, fn] of Object.entries(value)) {
            value[method] = (...args: any[]) => {
              calls++;
              return (fn as (...args: any[]) => any)(...args);
            };
          }
        }
      }
      const snapshot = {
        snapshotId: "all-families",
        course: { title: "Example", number: "EX 1" },
        activityTypes: ["meeting", "coursework", "assessment"].map(
          (family) => ({ key: family, label: family, behaviorFamily: family }),
        ),
        learningModules: Array.from({ length: size }, (_, i) => ({
          stableCode: `LM-${i}`,
          title: `Module ${i}`,
        })),
        topics: Array.from({ length: size }, (_, i) => ({
          stableCode: `T-${i}`,
          learningModuleCode: `LM-${i}`,
          title: `Topic ${i}`,
        })),
        activities: Array.from({ length: size }, (_, i) =>
          ["meeting", "coursework", "assessment"].map((family) => ({
            stableCode: `${family}-${i}`,
            typeKey: family,
            learningModuleCode: `LM-${i}`,
            title: `Activity ${i}`,
            topicActions: [{ topicRef: `T-${i}`, action: "introduced" }],
          })),
        ).flat(),
      };
      const result = await new ExemplarImportService().apply(
        transactionalDb(tx),
        {
          instructorId: "instructor-1",
          courseId: "course-1",
          snapshot,
        },
      );
      expect(result.createdOrReused).toMatchObject({
        learning_module: size,
        topic: size,
        activity: size * 3,
        topic_action: size * 3,
        activity_topic_scope: size * 3,
      });
      for (const family of ["meeting", "coursework", "assessment"]) {
        expect(tx.__state[family + "ActivityVersions"]).toHaveLength(size);
      }
      expect(tx.__state.learningModuleVersionActivities).toHaveLength(size * 3);
      expect(
        tx.__state.topics.every((row: any) => row.learningModuleId === null),
      ).toBe(true);
      callCounts.push(calls);
    }
    expect(callCounts).toEqual([callCounts[0], callCounts[0], callCounts[0]]);
    expect(callCounts[0]).toBeLessThanOrEqual(35);
  });

  it("replaces changed relationships and removes empty ones while retaining existing identities and versions", async () => {
    const tx = createMemoryTx();
    const service = new ExemplarImportService();
    const input = {
      instructorId: "instructor-1",
      courseId: "course-1",
      snapshot: structuredClone(genericDemoExemplarSnapshot),
    };
    await service.apply(transactionalDb(tx), input);
    const versions = structuredClone(tx.__state.activityVersions);
    const topics = structuredClone(tx.__state.topics);
    input.snapshot.activities[0].topicActions = [];
    input.snapshot.activities[1].topicActions = [
      { topicRef: "TOPIC-MODEL", action: "assessed" },
    ];
    const result = await service.apply(transactionalDb(tx), input);
    expect(result.createdOrReused.topic_action).toBe(3);
    expect(tx.__state.activityVersionTopicActions).toHaveLength(3);
    expect(tx.__state.activityTopicScopes).toHaveLength(2);
    expect(tx.__state.activityVersions).toEqual(versions);
    expect(tx.__state.topics).toEqual(topics);
    const graph = structuredClone(tx.__state);
    await service.apply(transactionalDb(tx), input);
    expect(tx.__state).toEqual(graph);
  });

  it("rejects another instructor's course before writing", async () => {
    const tx = createMemoryTx();
    await expect(
      new ExemplarImportService().apply(transactionalDb(tx), {
        instructorId: "other-instructor",
        courseId: "course-1",
        snapshot: genericDemoExemplarSnapshot,
      }),
    ).rejects.toThrow("Course not found");
    expect(
      Object.values(tx.__state).every((rows: any) => rows.length === 0),
    ).toBe(true);
  });

  it("leaves relationship rows unchanged when the database returns them in a different order", async () => {
    const tx = createMemoryTx();
    const service = new ExemplarImportService();
    const input = {
      instructorId: "instructor-1",
      courseId: "course-1",
      snapshot: genericDemoExemplarSnapshot,
    };
    await service.apply(transactionalDb(tx), input);
    tx.__state.activityVersionTopicActions.reverse();
    tx.__state.activityTopicScopes.reverse();
    const before = structuredClone(tx.__state);
    await service.apply(transactionalDb(tx), input);
    expect(tx.__state).toEqual(before);
  });
});
