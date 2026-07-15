/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { describe, expect, it } from "vitest";
import { toActivityVersionDto } from "../../lib/redesign-serializers";
import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import {
  archiveActivity,
  createActivity,
  getActivityForInstructor,
  listActivitiesForCourse,
  listActivityVersionsForInstructor,
  publishActivityVersion,
  reviseActivity,
  updateActivity,
} from "./activity-service";

function createTransactionalDb(tx: Record<string, any>) {
  return {
    $transaction: async <T>(fn: (tx: Record<string, any>) => Promise<T>) => fn(tx),
  };
}

const enabledMeetingActivityType = {
  course: {
    findUnique: async () => ({ id: "course-1", instructorId: "instructor-1" }),
  },
  activityTypeVersion: {
    findUnique: async () => ({
      id: "atv-1",
      activityType: { instructorId: "instructor-1", behaviorFamily: "meeting" },
    }),
  },
  courseActivityTypeVersion: {
    findUnique: async () => ({ courseId: "course-1", activityTypeVersionId: "atv-1" }),
  },
};

function baseMeetingDraft() {
  return {
    title: "Lecture 1",
    activityTypeVersionId: "atv-1",
    detail: { behaviorFamily: "meeting" as const, modality: "in_person" },
  };
}

describe("createActivity", () => {
  it("creates each behavior family with a matching detail row and advances currentVersionId", async () => {
    const scenarios: Array<{ behaviorFamily: "meeting" | "coursework" | "assessment"; detail: any }> = [
      { behaviorFamily: "meeting", detail: { behaviorFamily: "meeting", modality: "in_person" } },
      { behaviorFamily: "coursework", detail: { behaviorFamily: "coursework", submissionPolicy: "late_ok" } },
      { behaviorFamily: "assessment", detail: { behaviorFamily: "assessment", modality: "in_person" } },
    ];

    for (const scenario of scenarios) {
      const versionCreates: any[] = [];
      const activityUpdates: any[] = [];
      const tx = {
        ...enabledMeetingActivityType,
        activityTypeVersion: {
          findUnique: async () => ({
            id: "atv-1",
            activityType: { instructorId: "instructor-1", behaviorFamily: scenario.behaviorFamily },
          }),
        },
        activity: {
          create: async ({ data }: any) => ({ id: "activity-1", currentVersionId: null, archivedAt: null, ...data }),
          update: async ({ data }: any) => {
            activityUpdates.push(data);
            return data;
          },
        },
        activityVersion: {
          create: async ({ data }: any) => {
            versionCreates.push(data);
            return { id: "av-1", ...data, milestoneTemplates: [] };
          },
        },
      };

      const result = await createActivity(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        stableCode: "L01",
        createdByInstructorId: "instructor-1",
        draft: {
          title: "Activity",
          activityTypeVersionId: "atv-1",
          detail: scenario.detail,
        },
      });

      expect(result.currentVersionId).toBe("av-1");
      expect(activityUpdates).toEqual([{ currentVersionId: "av-1" }]);
      expect(versionCreates[0].revision).toBe(1);
    }
  });

  it("rejects a creator who is not the owning Instructor", async () => {
    await expect(
      createActivity(createTransactionalDb({}), {
        instructorId: "instructor-1",
        courseId: "course-1",
        stableCode: "L01",
        createdByInstructorId: "instructor-2",
        draft: baseMeetingDraft(),
      }),
    ).rejects.toThrow("creator must match its owning Instructor");
  });

  it("rejects a detail behaviorFamily that mismatches the selected Activity Type", async () => {
    const tx = {
      ...enabledMeetingActivityType,
      activity: {
        create: async ({ data }: any) => ({ id: "activity-1", currentVersionId: null, ...data }),
      },
    };

    await expect(
      createActivity(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        stableCode: "L01",
        createdByInstructorId: "instructor-1",
        draft: {
          title: "Activity",
          activityTypeVersionId: "atv-1",
          detail: { behaviorFamily: "coursework", submissionPolicy: null },
        },
      }),
    ).rejects.toThrow("behaviorFamily must match");
  });

  it("rejects an Activity Type version disabled for the Course", async () => {
    const tx = {
      course: { findUnique: async () => ({ id: "course-1", instructorId: "instructor-1" }) },
      activityTypeVersion: {
        findUnique: async () => ({
          id: "atv-1",
          activityType: { instructorId: "instructor-1", behaviorFamily: "meeting" },
        }),
      },
      courseActivityTypeVersion: { findUnique: async () => null },
      activity: {
        create: async ({ data }: any) => ({ id: "activity-1", currentVersionId: null, ...data }),
      },
    };

    await expect(
      createActivity(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        stableCode: "L01",
        createdByInstructorId: "instructor-1",
        draft: baseMeetingDraft(),
      }),
    ).rejects.toThrow("must be enabled for the Activity's Course");
  });

  it("rejects an Activity Type version from a foreign Instructor vocabulary", async () => {
    const tx = {
      course: { findUnique: async () => ({ id: "course-1", instructorId: "instructor-1" }) },
      activityTypeVersion: {
        findUnique: async () => ({
          id: "atv-1",
          activityType: { instructorId: "instructor-2", behaviorFamily: "meeting" },
        }),
      },
      activity: {
        create: async ({ data }: any) => ({ id: "activity-1", currentVersionId: null, ...data }),
      },
    };

    await expect(
      createActivity(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        stableCode: "L01",
        createdByInstructorId: "instructor-1",
        draft: baseMeetingDraft(),
      }),
    ).rejects.toThrow("must belong to the Instructor's vocabulary");
  });

  it("rejects nonnegative-violating and duplicate milestone template sequences", async () => {
    const tx = {
      ...enabledMeetingActivityType,
      activity: {
        create: async ({ data }: any) => ({ id: "activity-1", currentVersionId: null, ...data }),
      },
    };

    await expect(
      createActivity(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        stableCode: "L01",
        createdByInstructorId: "instructor-1",
        draft: {
          ...baseMeetingDraft(),
          milestoneTemplates: [
            { sequence: -1, role: "due", label: "Bad" },
          ],
        },
      }),
    ).rejects.toThrow("nonnegative");

    await expect(
      createActivity(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        stableCode: "L01",
        createdByInstructorId: "instructor-1",
        draft: {
          ...baseMeetingDraft(),
          milestoneTemplates: [
            { sequence: 0, role: "release", label: "A" },
            { sequence: 0, role: "due", label: "B" },
          ],
        },
      }),
    ).rejects.toThrow("unique");
  });

  it("rejects a milestone template linkedActivityId from a foreign Course", async () => {
    const tx = {
      ...enabledMeetingActivityType,
      activity: {
        create: async ({ data }: any) => ({ id: "activity-1", currentVersionId: null, ...data }),
        findUnique: async () => ({ courseId: "course-2" }),
      },
    };

    await expect(
      createActivity(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        courseId: "course-1",
        stableCode: "L01",
        createdByInstructorId: "instructor-1",
        draft: {
          ...baseMeetingDraft(),
          milestoneTemplates: [
            { sequence: 0, role: "due", label: "Final", linkedActivityId: "activity-foreign" },
          ],
        },
      }),
    ).rejects.toThrow("cannot cross Course boundaries");
  });

  it("serializes milestone templates in ascending sequence order", async () => {
    const tx = {
      ...enabledMeetingActivityType,
      activity: {
        create: async ({ data }: any) => ({ id: "activity-1", currentVersionId: null, ...data }),
        findUnique: async () => ({ courseId: "course-1" }),
        update: async ({ data }: any) => data,
      },
      activityVersion: {
        // Mirrors Prisma's `include: { milestoneTemplates: { orderBy: { sequence: "asc" } } }`
        // behavior on a create-with-nested-create call.
        create: async ({ data }: any) => ({
          id: "av-1",
          ...data,
          milestoneTemplates: [...data.milestoneTemplates.create]
            .sort((a: any, b: any) => a.sequence - b.sequence)
            .map((t: any, i: number) => ({ id: `mt-${i}`, activityVersionId: "av-1", ...t })),
        }),
      },
    };

    const result = await createActivity(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      courseId: "course-1",
      stableCode: "L01",
      createdByInstructorId: "instructor-1",
      draft: {
        ...baseMeetingDraft(),
        milestoneTemplates: [
          { sequence: 2, role: "due", label: "Due" },
          { sequence: 0, role: "release", label: "Release" },
          { sequence: 1, role: "work", label: "Work" },
        ],
      },
    });

    expect(result.currentVersion.milestoneTemplates.map((t: any) => t.sequence)).toEqual([0, 1, 2]);
  });
});

describe("toActivityVersionDto milestone ordering", () => {
  it("serializes milestone templates sorted by sequence regardless of input order", () => {
    const dto = toActivityVersionDto({
      id: "av-1",
      activityId: "activity-1",
      revision: 1,
      title: "Project",
      summary: null,
      activityTypeVersionId: "atv-1",
      changeSummary: null,
      publishedAt: null,
      meetingDetail: null,
      courseworkDetail: { submissionPolicy: null, releasePolicy: null, authoringNotes: null },
      assessmentDetail: null,
      milestoneTemplates: [
        {
          id: "mt-due",
          activityVersionId: "av-1",
          sequence: 2,
          role: "due",
          label: "Due",
          linkedActivityId: null,
          relativeDays: null,
          defaultTime: null,
          timeZone: null,
          notes: null,
          provenance: null,
        },
        {
          id: "mt-release",
          activityVersionId: "av-1",
          sequence: 0,
          role: "release",
          label: "Release",
          linkedActivityId: null,
          relativeDays: null,
          defaultTime: null,
          timeZone: null,
          notes: null,
          provenance: null,
        },
        {
          id: "mt-work",
          activityVersionId: "av-1",
          sequence: 1,
          role: "work",
          label: "Work",
          linkedActivityId: null,
          relativeDays: null,
          defaultTime: null,
          timeZone: null,
          notes: null,
          provenance: null,
        },
      ],
    });

    expect(dto.milestoneTemplates.map((t) => t.id)).toEqual(["mt-release", "mt-work", "mt-due"]);
  });
});

describe("reviseActivity", () => {
  const currentVersion = { id: "av-1", activityId: "activity-1", revision: 1 };

  it("creates a new version and atomically advances currentVersionId", async () => {
    const updates: any[] = [];
    const tx = {
      ...enabledMeetingActivityType,
      activity: {
        findUnique: async () => ({
          id: "activity-1",
          courseId: "course-1",
          course: { instructorId: "instructor-1" },
          currentVersionId: "av-1",
          currentVersion,
        }),
        updateMany: async ({ data }: any) => {
          updates.push(data);
          return { count: 1 };
        },
      },
      activityVersion: {
        create: async ({ data }: any) => ({ id: "av-2", ...data, milestoneTemplates: [] }),
      },
    };

    const version = await reviseActivity(createTransactionalDb(tx), {
      activityId: "activity-1",
      instructorId: "instructor-1",
      expectedCurrentVersionId: "av-1",
      createdByInstructorId: "instructor-1",
      draft: baseMeetingDraft(),
    });

    expect(version.revision).toBe(2);
    expect(updates).toEqual([{ currentVersionId: "av-2" }]);
  });

  it("loses a race against a concurrent revision with ConcurrencyConflictError (stale expected pointer)", async () => {
    const tx = {
      activity: {
        findUnique: async () => ({
          id: "activity-1",
          courseId: "course-1",
          course: { instructorId: "instructor-1" },
          currentVersionId: "av-2",
          currentVersion: { id: "av-2", activityId: "activity-1", revision: 2 },
        }),
      },
    };

    await expect(
      reviseActivity(createTransactionalDb(tx), {
        activityId: "activity-1",
        instructorId: "instructor-1",
        expectedCurrentVersionId: "av-1",
        createdByInstructorId: "instructor-1",
        draft: baseMeetingDraft(),
      }),
    ).rejects.toThrow(ConcurrencyConflictError);
  });

  it("loses a race when the CAS updateMany matches zero rows", async () => {
    const tx = {
      ...enabledMeetingActivityType,
      activity: {
        findUnique: async () => ({
          id: "activity-1",
          courseId: "course-1",
          course: { instructorId: "instructor-1" },
          currentVersionId: "av-1",
          currentVersion,
        }),
        updateMany: async () => ({ count: 0 }),
      },
      activityVersion: {
        create: async ({ data }: any) => ({ id: "av-2", ...data, milestoneTemplates: [] }),
      },
    };

    await expect(
      reviseActivity(createTransactionalDb(tx), {
        activityId: "activity-1",
        instructorId: "instructor-1",
        expectedCurrentVersionId: "av-1",
        createdByInstructorId: "instructor-1",
        draft: baseMeetingDraft(),
      }),
    ).rejects.toThrow(ConcurrencyConflictError);
  });

  it("maps a concurrent duplicate revision P2002 to ConcurrencyConflictError", async () => {
    const tx = {
      ...enabledMeetingActivityType,
      activity: {
        findUnique: async () => ({
          id: "activity-1",
          courseId: "course-1",
          course: { instructorId: "instructor-1" },
          currentVersionId: "av-1",
          currentVersion,
        }),
      },
      activityVersion: {
        create: async () => {
          throw { code: "P2002" };
        },
      },
    };

    await expect(
      reviseActivity(createTransactionalDb(tx), {
        activityId: "activity-1",
        instructorId: "instructor-1",
        expectedCurrentVersionId: "av-1",
        createdByInstructorId: "instructor-1",
        draft: baseMeetingDraft(),
      }),
    ).rejects.toThrow(ConcurrencyConflictError);
  });

  it("rejects a version creator who is not the owning Instructor", async () => {
    await expect(
      reviseActivity(createTransactionalDb({}), {
        activityId: "activity-1",
        instructorId: "instructor-1",
        expectedCurrentVersionId: "av-1",
        createdByInstructorId: "instructor-2",
        draft: baseMeetingDraft(),
      }),
    ).rejects.toThrow("version creator must match its owning Instructor");
  });
});

describe("Activity ownership", () => {
  it("does not find another instructor's Activity", async () => {
    const tx = {
      activity: {
        findUnique: async () => ({
          id: "activity-1",
          course: { instructorId: "instructor-1" },
          currentVersion: null,
        }),
      },
    };

    await expect(
      getActivityForInstructor(createTransactionalDb(tx), "instructor-2", "activity-1"),
    ).rejects.toThrow(DomainInvariantError);
  });

  it("finds an owned archived Activity directly", async () => {
    const tx = {
      activity: {
        findUnique: async () => ({
          id: "activity-1",
          course: { instructorId: "instructor-1" },
          archivedAt: new Date("2026-01-01T00:00:00.000Z"),
          currentVersion: { id: "av-1", activityId: "activity-1", revision: 1 },
        }),
      },
    };

    const detail = await getActivityForInstructor(createTransactionalDb(tx), "instructor-1", "activity-1");
    expect(detail.activity.archivedAt).toBeInstanceOf(Date);
    expect(detail.currentVersion?.id).toBe("av-1");
  });
});

describe("listActivitiesForCourse", () => {
  it("excludes archived identities by default", async () => {
    let where: any = null;
    const tx = {
      course: { findUnique: async () => ({ id: "course-1", instructorId: "instructor-1" }) },
      activity: {
        findMany: async (args: any) => {
          where = args.where;
          return [];
        },
      },
    };

    await listActivitiesForCourse(createTransactionalDb(tx), "instructor-1", "course-1");
    expect(where).toEqual({ courseId: "course-1", archivedAt: null });
  });
});

describe("listActivityVersionsForInstructor", () => {
  it("lists all revisions for an owned Activity", async () => {
    const tx = {
      activity: {
        findUnique: async () => ({
          id: "activity-1",
          course: { instructorId: "instructor-1" },
          currentVersion: null,
        }),
      },
      activityVersion: {
        findMany: async () => [{ id: "av-1", revision: 1 }, { id: "av-2", revision: 2 }],
      },
    };

    const versions = await listActivityVersionsForInstructor(
      createTransactionalDb(tx),
      "instructor-1",
      "activity-1",
    );
    expect(versions).toHaveLength(2);
  });
});

describe("updateActivity / archiveActivity", () => {
  it("updates stableCode when unique within the Course", async () => {
    const tx = {
      activity: {
        findUnique: async ({ where }: any) => {
          if (where.id === "activity-1") {
            return { id: "activity-1", courseId: "course-1", stableCode: "L01", course: { instructorId: "instructor-1" }, currentVersion: null };
          }
          return null;
        },
        update: async ({ data }: any) => ({ id: "activity-1", ...data }),
      },
    };

    const result = await updateActivity(createTransactionalDb(tx), "instructor-1", "activity-1", {
      stableCode: "L02",
    });
    expect(result.stableCode).toBe("L02");
  });

  it("rejects a duplicate stableCode within the same Course", async () => {
    const tx = {
      activity: {
        findUnique: async ({ where }: any) => {
          if (where.id === "activity-1") {
            return { id: "activity-1", courseId: "course-1", stableCode: "L01", course: { instructorId: "instructor-1" }, currentVersion: null };
          }
          if (where.courseId_stableCode) {
            return { id: "activity-2" };
          }
          return null;
        },
      },
    };

    await expect(
      updateActivity(createTransactionalDb(tx), "instructor-1", "activity-1", { stableCode: "L02" }),
    ).rejects.toThrow("must be unique within the Course");
  });

  it("archives an owned Activity", async () => {
    const tx = {
      activity: {
        findUnique: async () => ({
          id: "activity-1",
          courseId: "course-1",
          stableCode: "L01",
          course: { instructorId: "instructor-1" },
          currentVersion: null,
        }),
        update: async ({ data }: any) => ({ id: "activity-1", ...data }),
      },
    };

    const result = await archiveActivity(createTransactionalDb(tx), "instructor-1", "activity-1");
    expect(result.archivedAt).toBeInstanceOf(Date);
  });
});

describe("publishActivityVersion", () => {
  it("sets publishedAt when unpublished", async () => {
    const tx = {
      activityVersion: {
        findUnique: async () => ({
          id: "av-1",
          publishedAt: null,
          activity: { course: { instructorId: "instructor-1" } },
        }),
        update: async ({ data }: any) => ({ id: "av-1", ...data }),
      },
    };

    const result = await publishActivityVersion(createTransactionalDb(tx), "instructor-1", "av-1");
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it("is idempotent when already published", async () => {
    const publishedAt = new Date("2026-01-01T00:00:00.000Z");
    let updateCalled = false;
    const tx = {
      activityVersion: {
        findUnique: async () => ({
          id: "av-1",
          publishedAt,
          activity: { course: { instructorId: "instructor-1" } },
        }),
        update: async () => {
          updateCalled = true;
          throw new Error("should not update an already-published version");
        },
      },
    };

    const result = await publishActivityVersion(createTransactionalDb(tx), "instructor-1", "av-1");
    expect(result.publishedAt).toBe(publishedAt);
    expect(updateCalled).toBe(false);
  });

  it("rejects publishing another instructor's Activity version", async () => {
    const tx = {
      activityVersion: {
        findUnique: async () => ({
          id: "av-1",
          publishedAt: null,
          activity: { course: { instructorId: "instructor-2" } },
        }),
      },
    };

    await expect(
      publishActivityVersion(createTransactionalDb(tx), "instructor-1", "av-1"),
    ).rejects.toThrow(DomainInvariantError);
  });
});
