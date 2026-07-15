/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import { ExemplarImportService, genericDemoExemplarSnapshot } from "./exemplar-import-service";

function transactionalDb(tx: Record<string, any>) {
  return { $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) => fn(tx) };
}

function createMemoryTx() {
  const state: Record<string, any[]> = {
    activityTypes: [],
    activityTypeVersions: [],
    courseActivityTypeVersions: [],
    learningModules: [],
    learningModuleVersions: [],
    topics: [],
    topicVersions: [],
    activities: [],
    activityVersions: [],
    activityVersionTopicActions: [],
    activityTopicScopes: [],
  };
  let n = 1;
  const id = (prefix: string) => `${prefix}-${n++}`;
  const course = { id: "course-1", instructorId: "instructor-1" };

  const tx = {
    __state: state,
    course: {
      findUnique: async ({ where }: any) =>
        where.id_instructorId?.id === course.id && where.id_instructorId?.instructorId === course.instructorId
          ? course
          : null,
    },
    activityType: {
      findFirst: async ({ where }: any) =>
        state.activityTypes.find(
          (row) =>
            row.instructorId === where.instructorId &&
            row.behaviorFamily === where.behaviorFamily &&
            row.currentVersion?.label === where.currentVersion.label,
        ) ?? null,
      create: async ({ data }: any) => {
        const row = { id: id("at"), currentVersionId: null, archivedAt: null, createdAt: new Date(), ...data };
        state.activityTypes.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = state.activityTypes.find((entry) => entry.id === where.id);
        Object.assign(row, data);
        row.currentVersion = state.activityTypeVersions.find((version) => version.id === data.currentVersionId);
        return row;
      },
    },
    activityTypeVersion: {
      create: async ({ data }: any) => {
        const row = { id: id("atv"), ...data };
        state.activityTypeVersions.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        const row = state.activityTypeVersions.find((entry) => entry.id === where.id);
        if (!row) return null;
        const activityType = state.activityTypes.find((entry) => entry.id === row.activityTypeId);
        return { ...row, activityType };
      },
    },
    courseActivityTypeVersion: {
      upsert: async ({ where, create }: any) => {
        const key = where.courseId_activityTypeVersionId;
        const existing = state.courseActivityTypeVersions.find(
          (row) => row.courseId === key.courseId && row.activityTypeVersionId === key.activityTypeVersionId,
        );
        if (existing) return existing;
        state.courseActivityTypeVersions.push(create);
        return create;
      },
      findUnique: async ({ where }: any) =>
        state.courseActivityTypeVersions.find(
          (row) =>
            row.courseId === where.courseId_activityTypeVersionId.courseId &&
            row.activityTypeVersionId === where.courseId_activityTypeVersionId.activityTypeVersionId,
        ) ?? null,
    },
    learningModule: {
      findUnique: async ({ where, include }: any) => {
        const row = state.learningModules.find(
          (entry) =>
            entry.id === where.id ||
            (entry.courseId === where.courseId_stableCode?.courseId &&
              entry.stableCode === where.courseId_stableCode?.stableCode),
        );
        if (!row) return null;
        return include?.currentVersion
          ? { ...row, currentVersion: state.learningModuleVersions.find((v) => v.id === row.currentVersionId) }
          : row;
      },
      create: async ({ data }: any) => {
        const row = { id: id("lm"), currentVersionId: null, ...data };
        state.learningModules.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = state.learningModules.find((entry) => entry.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    learningModuleVersion: {
      create: async ({ data }: any) => {
        const row = {
          id: id("lmv"),
          ...data,
          topics: (data.topics?.create ?? []).map((topic: any) => ({ ...topic })),
          activities: (data.activities?.create ?? []).map((activity: any) => ({ ...activity })),
        };
        state.learningModuleVersions.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = state.learningModuleVersions.find(
          (entry) => entry.id === where.id || (entry.id === where.id_learningModuleId?.id && entry.learningModuleId === where.id_learningModuleId?.learningModuleId),
        );
        if (!row) return null;
        return include ? { ...row, topics: row.topics ?? [], activities: row.activities ?? [] } : row;
      },
    },
    topic: {
      findUnique: async ({ where }: any) =>
        state.topics.find(
          (entry) =>
            entry.id === where.id ||
            (entry.courseId === where.courseId_stableCode?.courseId &&
              entry.stableCode === where.courseId_stableCode?.stableCode),
        ) ?? null,
      create: async ({ data }: any) => {
        const row = { id: id("topic"), currentVersionId: null, ...data };
        state.topics.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = state.topics.find((entry) => entry.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    topicVersion: {
      create: async ({ data }: any) => {
        const row = { id: id("tv"), ...data };
        state.topicVersions.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = state.topicVersions.find((entry) => entry.id === where.id);
        if (!row) return null;
        const topic = state.topics.find((entry) => entry.id === row.topicId);
        return include?.topic ? { ...row, topic } : row;
      },
    },
    activity: {
      findUnique: async ({ where, include }: any) => {
        const row = state.activities.find(
          (entry) =>
            (where.id && entry.id === where.id) ||
            (entry.courseId === where.courseId_stableCode?.courseId &&
              entry.stableCode === where.courseId_stableCode?.stableCode),
        );
        if (!row) return null;
        if (include?.course) return { ...row, course };
        return include?.currentVersion
          ? { ...row, currentVersion: state.activityVersions.find((v) => v.id === row.currentVersionId) }
          : row;
      },
      create: async ({ data }: any) => {
        const row = { id: id("act"), currentVersionId: null, archivedAt: null, ...data };
        state.activities.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = state.activities.find((entry) => entry.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    activityVersion: {
      create: async ({ data }: any) => {
        const row = { id: id("av"), ...data, milestoneTemplates: [] };
        state.activityVersions.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = state.activityVersions.find((entry) => entry.id === where.id);
        if (!row) return null;
        const activity = state.activities.find((entry) => entry.id === row.activityId);
        if (include?.activity?.include?.course) return { ...row, activity: { ...activity, course } };
        if (include?.activity) return { ...row, activity };
        return row;
      },
    },
    activityVersionTopicAction: {
      deleteMany: async ({ where }: any) => {
        state.activityVersionTopicActions = state.activityVersionTopicActions.filter(
          (row) => row.activityVersionId !== where.activityVersionId,
        );
        return { count: 1 };
      },
      createMany: async ({ data }: any) => {
        state.activityVersionTopicActions.push(...data.map((row: any) => ({ id: id("ata"), ...row })));
        return { count: data.length };
      },
      findMany: async ({ where }: any) => {
        if (where.activityVersionId) {
          return state.activityVersionTopicActions.filter((row) => row.activityVersionId === where.activityVersionId);
        }
        return [];
      },
    },
    activityTopicScope: {
      deleteMany: async ({ where }: any) => {
        state.activityTopicScopes = state.activityTopicScopes.filter((row) => row.activityId !== where.activityId);
        return { count: 1 };
      },
      createMany: async ({ data }: any) => {
        state.activityTopicScopes.push(...data.map((row: any) => ({ id: id("scope"), ...row })));
        return { count: data.length };
      },
      findMany: async ({ where }: any) => state.activityTopicScopes.filter((row) => row.activityId === where.activityId),
    },
  };
  return tx;
}

describe("ExemplarImportService", () => {
  it("stages, previews deterministically, and carries provenance for generic content", () => {
    const service = new ExemplarImportService();
    const staged = service.stage(genericDemoExemplarSnapshot);
    const preview = service.preview(staged);
    expect(service.preview(service.stage(genericDemoExemplarSnapshot))).toEqual(preview);
    expect(preview.creates.some((entry) => entry.kind === "activity")).toBe(true);
    expect(preview.provenance.every((entry) => entry.origin.snapshotId === "generic-intro-data-science-v1")).toBe(true);
    expect(JSON.stringify(preview)).not.toMatch(/answerKey|solutionKey|studentScores/);
  });

  it("excludes grading fields before preview or persistence", async () => {
    const service = new ExemplarImportService();
    const snapshot: any = structuredClone(genericDemoExemplarSnapshot);
    snapshot.activities[0].topicActions[0].answerKey = "excluded";
    snapshot.activities[0].topicActions[0].studentScores = [{ name: "Student A", score: 10 }];

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
    expect(JSON.stringify(tx.__state)).not.toMatch(/excluded|studentScores|answerKey|Student A/);
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
    expect(tx.__state.activityVersionTopicActions.every((row: any) => row.provenance?.oneWay)).toBe(true);
  });
});
