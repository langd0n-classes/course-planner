/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import {
  createActivityType,
  getActivityTypeForInstructor,
  listActivityTypesForInstructor,
  listCourseActivityTypeVersions,
  replaceCourseActivityTypeVersions,
  reviseActivityType,
  updateActivityType,
} from "./activity-type-service";

function createTransactionalDb(tx: Record<string, any>) {
  return {
    $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) => fn(tx),
  };
}

describe("createActivityType", () => {
  it("creates revision 1 and atomically advances currentVersionId", async () => {
    const updates: any[] = [];
    const tx = {
      activityType: {
        create: async ({ data }: any) => ({
          id: "at-1",
          currentVersionId: null,
          archivedAt: null,
          ...data,
        }),
        update: async ({ data }: any) => {
          updates.push(data);
          return data;
        },
      },
      activityTypeVersion: {
        create: async ({ data }: any) => ({ id: "atv-1", ...data }),
      },
    };

    const result = await createActivityType(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      behaviorFamily: "meeting",
      createdByInstructorId: "instructor-1",
      draft: { label: "Discussion" },
    });

    expect(result.currentVersionId).toBe("atv-1");
    expect(result.currentVersion.revision).toBe(1);
    expect(result.currentVersion.publishedAt).toBeNull();
    expect(updates).toEqual([{ currentVersionId: "atv-1" }]);
  });

  it("sets publishedAt when publish is requested", async () => {
    const tx = {
      activityType: {
        create: async ({ data }: any) => ({ id: "at-1", currentVersionId: null, ...data }),
        update: async ({ data }: any) => data,
      },
      activityTypeVersion: {
        create: async ({ data }: any) => ({ id: "atv-1", ...data }),
      },
    };

    const result = await createActivityType(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      behaviorFamily: "coursework",
      createdByInstructorId: "instructor-1",
      publish: true,
      draft: { label: "Problem Set" },
    });

    expect(result.currentVersion.publishedAt).toBeInstanceOf(Date);
  });

  it("rejects a creator who is not the owning Instructor", async () => {
    await expect(
      createActivityType(createTransactionalDb({}), {
        instructorId: "instructor-1",
        behaviorFamily: "meeting",
        createdByInstructorId: "instructor-2",
        draft: { label: "Discussion" },
      }),
    ).rejects.toThrow("creator must match its owning Instructor");
  });
});

describe("Activity Type ownership", () => {
  it("does not find another instructor's Activity Type", async () => {
    const tx = {
      activityType: {
        findUnique: async ({ where }: any) => {
          if (
            where.id_instructorId?.id === "at-1" &&
            where.id_instructorId?.instructorId === "instructor-1"
          ) {
            return { id: "at-1", instructorId: "instructor-1", currentVersion: null };
          }
          return null;
        },
      },
    };

    await expect(
      getActivityTypeForInstructor(createTransactionalDb(tx), "instructor-2", "at-1"),
    ).rejects.toThrow(DomainInvariantError);
  });

  it("finds an owned Activity Type even when archived", async () => {
    const tx = {
      activityType: {
        findUnique: async () => ({
          id: "at-1",
          instructorId: "instructor-1",
          archivedAt: new Date("2026-01-01T00:00:00.000Z"),
          currentVersion: { id: "atv-1", activityTypeId: "at-1", revision: 1 },
        }),
      },
    };

    const detail = await getActivityTypeForInstructor(createTransactionalDb(tx), "instructor-1", "at-1");
    expect(detail.activityType.archivedAt).toBeInstanceOf(Date);
    expect(detail.currentVersion?.id).toBe("atv-1");
  });
});

describe("listActivityTypesForInstructor", () => {
  it("excludes archived identities by default", async () => {
    let where: any = null;
    const tx = {
      activityType: {
        findMany: async (args: any) => {
          where = args.where;
          return [];
        },
      },
    };

    await listActivityTypesForInstructor(createTransactionalDb(tx), "instructor-1");
    expect(where).toEqual({ instructorId: "instructor-1", archivedAt: null });
  });
});

describe("reviseActivityType", () => {
  it("creates a new version and atomically advances currentVersionId", async () => {
    const updates: any[] = [];
    const tx = {
      activityType: {
        findUnique: async () => ({
          id: "at-1",
          instructorId: "instructor-1",
          currentVersionId: "atv-1",
          currentVersion: { id: "atv-1", activityTypeId: "at-1", revision: 1, publishedAt: new Date() },
        }),
        updateMany: async ({ data }: any) => {
          updates.push(data);
          return { count: 1 };
        },
      },
      activityTypeVersion: {
        create: async ({ data }: any) => ({ id: "atv-2", ...data }),
      },
    };

    const version = await reviseActivityType(createTransactionalDb(tx), {
      activityTypeId: "at-1",
      instructorId: "instructor-1",
      expectedCurrentVersionId: "atv-1",
      createdByInstructorId: "instructor-1",
      draft: { label: "Studio" },
    });

    expect(version.revision).toBe(2);
    expect(updates).toEqual([{ currentVersionId: "atv-2" }]);
  });

  it("loses a race against a concurrent revision with ConcurrencyConflictError", async () => {
    const tx = {
      activityType: {
        findUnique: async () => ({
          id: "at-1",
          instructorId: "instructor-1",
          currentVersionId: "atv-2",
          currentVersion: { id: "atv-2", activityTypeId: "at-1", revision: 2, publishedAt: null },
        }),
      },
    };

    await expect(
      reviseActivityType(createTransactionalDb(tx), {
        activityTypeId: "at-1",
        instructorId: "instructor-1",
        expectedCurrentVersionId: "atv-1",
        createdByInstructorId: "instructor-1",
        draft: { label: "Studio" },
      }),
    ).rejects.toThrow(ConcurrencyConflictError);
  });

  it("loses a race when the current pointer changes after the version read", async () => {
    const tx = {
      activityType: {
        findUnique: async () => ({
          id: "at-1",
          instructorId: "instructor-1",
          currentVersionId: "atv-1",
          currentVersion: { id: "atv-1", activityTypeId: "at-1", revision: 1 },
        }),
        updateMany: async () => ({ count: 0 }),
      },
      activityTypeVersion: {
        create: async ({ data }: any) => ({ id: "atv-2", ...data }),
      },
    };

    await expect(
      reviseActivityType(createTransactionalDb(tx), {
        activityTypeId: "at-1",
        instructorId: "instructor-1",
        expectedCurrentVersionId: "atv-1",
        createdByInstructorId: "instructor-1",
        draft: { label: "Studio" },
      }),
    ).rejects.toThrow(ConcurrencyConflictError);
  });

  it("maps a concurrent duplicate revision to ConcurrencyConflictError", async () => {
    const tx = {
      activityType: {
        findUnique: async () => ({
          id: "at-1",
          instructorId: "instructor-1",
          currentVersionId: "atv-1",
          currentVersion: { id: "atv-1", activityTypeId: "at-1", revision: 1 },
        }),
      },
      activityTypeVersion: {
        create: async () => {
          throw { code: "P2002" };
        },
      },
    };

    await expect(
      reviseActivityType(createTransactionalDb(tx), {
        activityTypeId: "at-1",
        instructorId: "instructor-1",
        expectedCurrentVersionId: "atv-1",
        createdByInstructorId: "instructor-1",
        draft: { label: "Studio" },
      }),
    ).rejects.toThrow(ConcurrencyConflictError);
  });

  it("rejects a version creator who is not the owning Instructor", async () => {
    await expect(
      reviseActivityType(createTransactionalDb({}), {
        activityTypeId: "at-1",
        instructorId: "instructor-1",
        expectedCurrentVersionId: "atv-1",
        createdByInstructorId: "instructor-2",
        draft: { label: "Studio" },
      }),
    ).rejects.toThrow("version creator must match its owning Instructor");
  });

  it("does not mutate an older version when publishing the new one", async () => {
    const versionCreates: any[] = [];
    const tx = {
      activityType: {
        findUnique: async () => ({
          id: "at-1",
          instructorId: "instructor-1",
          currentVersionId: "atv-1",
          currentVersion: { id: "atv-1", activityTypeId: "at-1", revision: 1, publishedAt: new Date() },
        }),
        updateMany: async () => ({ count: 1 }),
      },
      activityTypeVersion: {
        create: async ({ data }: any) => {
          versionCreates.push(data);
          return { id: "atv-2", ...data };
        },
      },
    };

    const version = await reviseActivityType(createTransactionalDb(tx), {
      activityTypeId: "at-1",
      instructorId: "instructor-1",
      expectedCurrentVersionId: "atv-1",
      createdByInstructorId: "instructor-1",
      publish: true,
      draft: { label: "Studio" },
    });

    expect(version.publishedAt).toBeInstanceOf(Date);
    expect(versionCreates).toHaveLength(1);
    expect(versionCreates[0].revision).toBe(2);
  });
});

describe("updateActivityType", () => {
  it("archives an owned Activity Type", async () => {
    const tx = {
      activityType: {
        findUnique: async () => ({ id: "at-1", instructorId: "instructor-1", currentVersion: null }),
        update: async ({ data }: any) => ({ id: "at-1", ...data }),
      },
    };

    const archivedAt = new Date("2026-07-14T00:00:00.000Z");
    const result = await updateActivityType(createTransactionalDb(tx), "instructor-1", "at-1", {
      archivedAt,
    });

    expect(result.archivedAt).toBe(archivedAt);
  });

  it("rejects patches for another instructor's Activity Type", async () => {
    const tx = {
      activityType: {
        findUnique: async () => null,
      },
    };

    await expect(
      updateActivityType(createTransactionalDb(tx), "instructor-2", "at-1", { archivedAt: new Date() }),
    ).rejects.toThrow(DomainInvariantError);
  });
});

describe("Course Activity Type enablement", () => {
  it("replaces course-enabled versions transactionally with only same-instructor versions", async () => {
    const deletedWhere: any[] = [];
    const created: any[] = [];
    const tx = {
      course: {
        findUnique: async ({ where }: any) => {
          if (where.id_instructorId?.id === "course-1" && where.id_instructorId?.instructorId === "instructor-1") {
            return { id: "course-1", instructorId: "instructor-1" };
          }
          return null;
        },
      },
      activityTypeVersion: {
        findUnique: async ({ where }: any) => {
          if (where.id === "atv-1") {
            return { id: "atv-1", activityType: { instructorId: "instructor-1" } };
          }
          return null;
        },
      },
      courseActivityTypeVersion: {
        deleteMany: async ({ where }: any) => {
          deletedWhere.push(where);
          return { count: 1 };
        },
        createMany: async ({ data }: any) => {
          created.push(...data);
          return { count: data.length };
        },
        findMany: async () => [
          { courseId: "course-1", activityTypeVersionId: "atv-1", enabledAt: new Date("2026-07-14T00:00:00.000Z") },
        ],
      },
    };

    const result = await replaceCourseActivityTypeVersions(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      courseId: "course-1",
      activityTypeVersionIds: ["atv-1"],
    });

    expect(deletedWhere).toEqual([{ courseId: "course-1" }]);
    expect(created).toEqual([{ courseId: "course-1", activityTypeVersionId: "atv-1" }]);
    expect(result).toHaveLength(1);
  });

  it("rejects enabling an Activity Type version from another instructor's vocabulary", async () => {
    const tx = {
      course: {
        findUnique: async () => ({ id: "course-1", instructorId: "instructor-1" }),
      },
      activityTypeVersion: {
        findUnique: async () => ({ id: "atv-1", activityType: { instructorId: "instructor-2" } }),
      },
    };

    await expect(
      replaceCourseActivityTypeVersions(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        activityTypeVersionIds: ["atv-1"],
      }),
    ).rejects.toThrow("must belong to the Instructor's vocabulary");
  });

  it("rejects duplicate Activity Type version IDs at the service boundary", async () => {
    const tx = {
      course: {
        findUnique: async () => ({ id: "course-1", instructorId: "instructor-1" }),
      },
    };

    await expect(
      replaceCourseActivityTypeVersions(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        activityTypeVersionIds: ["atv-1", "atv-1"],
      }),
    ).rejects.toThrow("must be unique");
  });

  it("rejects enabling versions for a Course owned by another instructor", async () => {
    const tx = {
      course: {
        findUnique: async () => null,
      },
    };

    await expect(
      replaceCourseActivityTypeVersions(createTransactionalDb(tx), {
        instructorId: "instructor-2",
        courseId: "course-1",
        activityTypeVersionIds: [],
      }),
    ).rejects.toThrow("Course not found");
  });

  it("lists course-enabled versions scoped to the owning instructor", async () => {
    const tx = {
      course: {
        findUnique: async () => ({ id: "course-1", instructorId: "instructor-1" }),
      },
      courseActivityTypeVersion: {
        findMany: async () => [],
      },
    };

    const result = await listCourseActivityTypeVersions(createTransactionalDb(tx), "instructor-1", "course-1");
    expect(result).toEqual([]);
  });
});
