import { describe, expect, it, vi } from "vitest";
import {
  listCourseEffort,
  createCourseEffort,
  updateCourseEffort,
  deleteCourseEffort,
  reorderCourseEffort,
  normalizeActivityEffort,
} from "./effort-service";
import type { RedesignDb, RedesignTx } from "./types";
const db = (tx: RedesignTx): RedesignDb => ({
  $transaction: async (fn) => fn(tx),
});
function fixture() {
  const delegate = {
    findMany: vi.fn(async () => [{ id: "s", label: "Small", sequence: 0 }]),
    findFirst: vi.fn(async () => ({ id: "s" })),
    create: vi.fn(async ({ data }) => data),
    update: vi.fn(async ({ data }) => data),
    delete: vi.fn(async () => ({})),
    count: vi.fn(async () => 1),
  };
  return {
    course: { findUnique: vi.fn(async () => ({ id: "c", instructorId: "i" })) },
    courseEffortSize: delegate,
    courseEffortPartKind: delegate,
  };
}
describe("Course effort vocabulary", () => {
  it.each(["sizes", "part-kinds"] as const)(
    "lists, trims, updates, deletes and reorders owned %s",
    async (kind) => {
      const tx = fixture();
      expect(await listCourseEffort(db(tx), "i", "c", kind)).toHaveLength(1);
      expect(
        await createCourseEffort(db(tx), "i", "c", kind, {
          label: " Small ",
          minMinutes: 30,
          maxMinutes: 45,
        }),
      ).toMatchObject({ label: "Small", sequence: 1 });
      await updateCourseEffort(db(tx), "i", "c", kind, "s", {
        label: " Tiny ",
        minMinutes: 1,
        maxMinutes: 1,
      });
      expect(tx.courseEffortSize.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ label: "Tiny" }),
        }),
      );
      await reorderCourseEffort(db(tx), "i", "c", kind, ["s"]);
      await deleteCourseEffort(db(tx), "i", "c", kind, "s");
      expect(tx.courseEffortSize.delete).toHaveBeenCalled();
    },
  );
  it.each(["sizes", "part-kinds"] as const)(
    "enforces ownership for all %s operations",
    async (kind) => {
      const tx = fixture();
      tx.course.findUnique.mockResolvedValue(null as never);
      for (const action of [
        () => listCourseEffort(db(tx), "i", "c", kind),
        () =>
          createCourseEffort(db(tx), "i", "c", kind, {
            label: "A",
            minMinutes: 1,
            maxMinutes: 1,
          }),
        () =>
          updateCourseEffort(db(tx), "i", "c", kind, "s", {
            label: "B",
            minMinutes: 1,
            maxMinutes: 1,
          }),
        () => deleteCourseEffort(db(tx), "i", "c", kind, "s"),
        () => reorderCourseEffort(db(tx), "i", "c", kind, ["s"]),
      ])
        await expect(action()).rejects.toThrow("Course not found");
    },
  );
  it("rejects missing rows, empty labels, bad ranges and incomplete/duplicate reorders", async () => {
    const tx = fixture();
    await expect(
      createCourseEffort(db(tx), "i", "c", "part-kinds", { label: " " }),
    ).rejects.toThrow();
    await expect(
      createCourseEffort(db(tx), "i", "c", "sizes", {
        label: "A",
        minMinutes: 0,
        maxMinutes: 1,
      }),
    ).rejects.toThrow();
    await expect(
      reorderCourseEffort(db(tx), "i", "c", "sizes", []),
    ).rejects.toThrow();
    await expect(
      reorderCourseEffort(db(tx), "i", "c", "sizes", ["s", "s"]),
    ).rejects.toThrow();
    tx.courseEffortSize.findFirst.mockResolvedValue(null as never);
    await expect(
      deleteCourseEffort(db(tx), "i", "c", "sizes", "foreign"),
    ).rejects.toThrow();
  });
});
describe("Activity effort validation", () => {
  it("computes the sum server-side and preserves labels", async () => {
    const result = await normalizeActivityEffort(
      {},
      "c",
      {
        behaviorFamily: "coursework",
        effortMinMinutes: 999,
        effortMaxMinutes: 999,
      },
      [{ sequence: 0, label: " Read ", minMinutes: 30, maxMinutes: 45 }],
    );
    expect(result.detail).toMatchObject({
      effortMinMinutes: 30,
      effortMaxMinutes: 45,
    });
    expect(result.parts[0].label).toBe("Read");
  });
  it("rejects effort on meetings and part kinds from another Course", async () => {
    await expect(
      normalizeActivityEffort(
        {},
        "c",
        {
          behaviorFamily: "meeting",
          effortMinMinutes: 1,
          effortMaxMinutes: 2,
        } as never,
        [],
      ),
    ).rejects.toThrow();
    await expect(
      normalizeActivityEffort(
        { courseEffortPartKind: { findFirst: async () => null } },
        "c",
        { behaviorFamily: "assessment" },
        [
          {
            sequence: 0,
            label: "Read",
            partKindId: "foreign",
            minMinutes: 1,
            maxMinutes: 2,
          },
        ],
      ),
    ).rejects.toThrow();
  });
  it("rejects duplicate sequences, empty part labels, and overflowing sums", async () => {
    const part = {
      sequence: 0,
      label: "Read",
      minMinutes: 30000,
      maxMinutes: 40000,
    };
    for (const parts of [
      [part, part],
      [{ ...part, label: " " }],
      [part, { ...part, sequence: 1 }],
    ])
      await expect(
        normalizeActivityEffort(
          {},
          "c",
          { behaviorFamily: "coursework" },
          parts,
        ),
      ).rejects.toThrow();
  });
});

describe("version effort snapshots", () => {
  it("copies estimates and parts when revising, and lets an explicit empty list clear parts", async () => {
    const { reviseActivity } = await import("./activity-service");
    const current = {
      id: "v1",
      activityId: "a",
      revision: 1,
      courseworkDetail: { effortMinMinutes: 10, effortMaxMinutes: 20 },
      effortParts: [
        {
          id: "p",
          activityVersionId: "v1",
          sequence: 0,
          label: "Read",
          minMinutes: 10,
          maxMinutes: 20,
        },
      ],
    };
    const create = vi.fn(async ({ data }) => data);
    const tx = {
      activity: {
        findUnique: async () => ({
          id: "a",
          courseId: "c",
          course: { instructorId: "i" },
          currentVersionId: "v1",
          currentVersion: current,
        }),
        updateMany: async () => ({ count: 1 }),
      },
      activityTypeVersion: {
        findUnique: async () => ({
          activityType: { instructorId: "i", behaviorFamily: "coursework" },
        }),
      },
      courseActivityTypeVersion: { findUnique: async () => ({}) },
      activityVersion: { create },
    };
    const input = {
      instructorId: "i",
      createdByInstructorId: "i",
      activityId: "a",
      expectedCurrentVersionId: "v1",
      draft: {
        title: "Revised",
        activityTypeVersionId: "type",
        detail: { behaviorFamily: "coursework" as const },
      },
    };
    await reviseActivity(db(tx), input);
    expect(create.mock.calls[0][0].data.courseworkDetail.create).toMatchObject({
      effortMinMinutes: 10,
      effortMaxMinutes: 20,
    });
    expect(create.mock.calls[0][0].data.effortParts.create).toEqual([
      expect.objectContaining({
        label: "Read",
        minMinutes: 10,
        maxMinutes: 20,
      }),
    ]);
    await reviseActivity(db(tx), {
      ...input,
      draft: {
        ...input.draft,
        detail: {
          behaviorFamily: "coursework",
          effortMinMinutes: null,
          effortMaxMinutes: null,
        },
        effortParts: [],
      },
    });
    expect(create.mock.calls[1][0].data.courseworkDetail.create).toMatchObject({
      effortMinMinutes: null,
      effortMaxMinutes: null,
    });
  });
});

describe("Term effort overrides", () => {
  it.each(["coursework", "assessment"] as const)(
    "previews/applies/clears a %s override",
    async (family) => {
      const { previewTermActivityRevision, applyTermActivityRevision } =
        await import("./term-activity-service");
      const writes: unknown[] = [];
      const activity = {
        id: "ta",
        termId: "t",
        plannedActivityVersionId: "v",
        plannedRevisionId: "r1",
        deliveredRevisionId: null,
        revisions: [{ revision: 1 }],
        term: {
          courseId: "c",
          status: "active",
          course: { instructorId: "i" },
        },
      };
      const tx = {
        termActivity: {
          findUnique: async () => activity,
          updateMany: async () => ({ count: 1 }),
        },
        termActivityRevision: {
          create: async ({ data }: { data: object }) => ({ id: "r2", ...data }),
          findUnique: async () => ({ id: "r2" }),
        },
        termCourseworkActivityRevision: {
          create: async ({ data }: { data: object }) => {
            writes.push(data);
          },
        },
        termAssessmentActivityRevision: {
          create: async ({ data }: { data: object }) => {
            writes.push(data);
          },
        },
      };
      for (const [low, high] of [
        [60, 90],
        [null, null],
      ]) {
        const draft = {
          title: "A",
          detail: {
            behaviorFamily: family,
            effortMinMinutes: low,
            effortMaxMinutes: high,
          },
        };
        const preview = await previewTermActivityRevision(db(tx), {
          instructorId: "i",
          termActivityId: "ta",
          draft,
        });
        expect(
          preview.proposedRevision[
            family === "coursework" ? "courseworkDetail" : "assessmentDetail"
          ],
        ).toMatchObject({ effortMinMinutes: low, effortMaxMinutes: high });
        await applyTermActivityRevision(db(tx), {
          instructorId: "i",
          termActivityId: "ta",
          draft,
          advancePointer: "delivered",
          previewToken: preview.previewToken,
          expectedCurrentRevisionId: null,
        });
        expect(writes.at(-1)).toMatchObject({
          effortMinMinutes: low,
          effortMaxMinutes: high,
        });
      }
      await expect(
        previewTermActivityRevision(db(tx), {
          instructorId: "i",
          termActivityId: "ta",
          draft: {
            title: "A",
            detail: {
              behaviorFamily: family,
              effortMinMinutes: 0,
              effortMaxMinutes: 1,
            },
          },
        }),
      ).rejects.toThrow();
    },
  );
});

it("preserves Topic actions and module scopes when saving a new effort version", async () => {
  const { reviseActivity } = await import("./activity-service");
  const create = vi.fn(async ({ data }) => data);
  const tx = {
    activity: {
      findUnique: async () => ({
        id: "a",
        courseId: "c",
        course: { instructorId: "i" },
        currentVersionId: "v",
        currentVersion: {
          id: "v",
          activityId: "a",
          revision: 1,
          courseworkDetail: {},
          topicActions: [
            {
              topicVersionId: "topic",
              action: "practiced",
              notes: "Keep",
              provenance: null,
            },
          ],
          learningModuleScopes: [
            { learningModuleId: "lm", emphasis: "Recap", notes: null },
          ],
        },
      }),
      updateMany: async () => ({ count: 1 }),
    },
    activityVersion: { create },
    activityTypeVersion: {
      findUnique: async () => ({
        activityType: { instructorId: "i", behaviorFamily: "coursework" },
      }),
    },
    courseActivityTypeVersion: { findUnique: async () => ({}) },
  };
  await reviseActivity(db(tx), {
    instructorId: "i",
    createdByInstructorId: "i",
    activityId: "a",
    expectedCurrentVersionId: "v",
    draft: {
      title: "A",
      activityTypeVersionId: "type",
      detail: {
        behaviorFamily: "coursework",
        effortMinMinutes: 1,
        effortMaxMinutes: 2,
      },
    },
  });
  expect(create.mock.calls[0][0].data.topicActions.create).toEqual([
    {
      topicVersionId: "topic",
      action: "practiced",
      notes: "Keep",
      provenance: undefined,
    },
  ]);
  expect(create.mock.calls[0][0].data.learningModuleScopes.create).toEqual([
    { learningModuleId: "lm", emphasis: "Recap", notes: null },
  ]);
});
