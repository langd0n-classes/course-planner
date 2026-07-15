/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import {
  applyTermActivityAdoption,
  applyTermActivityRevision,
  previewTermActivityAdoption,
} from "./term-activity-service";

function createTransactionalDb(tx: Record<string, any>) {
  return {
    $transaction: async <T>(fn: (nestedTx: Record<string, any>) => Promise<T>) => fn(tx),
  };
}

function revisionPreviewToken(termActivityId: string, expectedCurrentRevisionId: string | null, draft: unknown) {
  return createHash("sha256")
    .update(JSON.stringify({ termActivityId, expectedCurrentRevisionId, draft }))
    .digest("hex")
    .slice(0, 16);
}

function baseTerm() {
  return {
    id: "term-1",
    courseId: "course-1",
    status: "active",
    course: { instructorId: "instructor-1" },
  };
}

function baseActivityVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "av-1",
    activityId: "activity-1",
    activity: { id: "activity-1", courseId: "course-1", course: { instructorId: "instructor-1" } },
    title: "Lecture 1",
    summary: "Overview",
    activityTypeVersionId: "atv-1",
    activityTypeVersion: {
      id: "atv-1",
      label: "Lecture",
      activityType: { instructorId: "instructor-1" },
    },
    meetingDetail: { modality: "in_person" },
    courseworkDetail: null,
    assessmentDetail: null,
    topicActions: [{ topicVersionId: "topicv-1", action: "introduced", notes: null, provenance: null }],
    ...overrides,
  };
}

describe("Term Activity adoption", () => {
  it("previews candidates from selected learning-module memberships and cross-cutting selections", async () => {
    const tx = {
      term: { findUnique: async () => baseTerm() },
      termLearningModule: {
        findUnique: async () => ({ id: "tlm-1", termId: "term-1", courseId: "course-1", learningModuleId: "lm-1" }),
      },
      learningModuleVersion: {
        findUnique: async () => ({
          id: "lmv-1",
          learningModuleId: "lm-1",
          activities: [{ activityVersionId: "av-1", sequence: 2 }],
        }),
      },
      activityVersion: {
        findUnique: async ({ where }: any) =>
          where.id === "av-1"
            ? baseActivityVersion()
            : baseActivityVersion({
                id: "av-2",
                activityId: "activity-2",
                activity: { id: "activity-2", courseId: "course-1", course: { instructorId: "instructor-1" } },
                title: "Project 1",
                activityTypeVersionId: "atv-2",
                activityTypeVersion: {
                  id: "atv-2",
                  label: "Project",
                  activityType: { instructorId: "instructor-1" },
                },
                meetingDetail: null,
                courseworkDetail: {},
              }),
      },
      courseActivityTypeVersion: {
        findUnique: async () => ({ courseId: "course-1" }),
      },
      termActivity: { count: async () => 0 },
    };

    const preview = await previewTermActivityAdoption(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      termId: "term-1",
      learningModuleVersionSelections: [{ termLearningModuleId: "tlm-1", learningModuleVersionId: "lmv-1" }],
      crossCuttingSelections: [{ activityId: "activity-2", activityVersionId: "av-2" }],
    });

    expect(preview.kind).toBe("preview");
    expect(preview.expectedCurrentActivityCount).toBe(0);
    expect(preview.candidates).toEqual([
      expect.objectContaining({
        activityId: "activity-2",
        activityVersionId: "av-2",
        adoptedLabel: "Project",
        ordinal: null,
        termLearningModuleId: null,
      }),
      expect.objectContaining({
        activityId: "activity-1",
        activityVersionId: "av-1",
        adoptedLabel: "Lecture",
        ordinal: 2,
        termLearningModuleId: "tlm-1",
      }),
    ]);
  });

  it("applies pinned adoption rows and materializes planned revision snapshots", async () => {
    const termActivityCreates: any[] = [];
    const termActivityUpdates: any[] = [];
    const tx = {
      term: { findUnique: async () => baseTerm() },
      termLearningModule: {
        findUnique: async () => ({ id: "tlm-1", termId: "term-1", courseId: "course-1", learningModuleId: "lm-1" }),
      },
      learningModuleVersion: {
        findUnique: async () => ({
          id: "lmv-1",
          learningModuleId: "lm-1",
          activities: [{ activityVersionId: "av-1", sequence: 0 }],
        }),
      },
      activityVersion: { findUnique: async () => baseActivityVersion() },
      courseActivityTypeVersion: { findUnique: async () => ({ courseId: "course-1" }) },
      termActivity: {
        count: async () => 0,
        create: async ({ data }: any) => {
          termActivityCreates.push(data);
          return { id: "ta-1", archivedAt: null, plannedRevisionId: null, deliveredRevisionId: null, ...data };
        },
        update: async ({ data }: any) => {
          termActivityUpdates.push(data);
          return data;
        },
        findMany: async () => [{
          id: "ta-1",
          termId: "term-1",
          courseId: "course-1",
          activityId: "activity-1",
          plannedActivityVersionId: "av-1",
          activityTypeVersionId: "atv-1",
          adoptedLabel: "Lecture",
          termLearningModuleId: "tlm-1",
          ordinal: 0,
          lifecycleState: null,
          plannedRevisionId: "tar-1",
          deliveredRevisionId: null,
          archivedAt: null,
        }],
      },
      termActivityRevision: {
        create: async ({ data }: any) => ({ id: "tar-1", createdAt: new Date("2026-07-15T00:00:00.000Z"), ...data }),
        findUnique: async () => ({
          id: "tar-1",
          termActivityId: "ta-1",
          revision: 1,
          baseActivityVersionId: "av-1",
          title: "Lecture 1",
          summary: "Overview",
          changeReason: null,
          createdByInstructorId: "instructor-1",
          createdAt: new Date("2026-07-15T00:00:00.000Z"),
          meetingDetail: {
            calendarSlotId: null,
            startsAt: null,
            endsAt: null,
            status: null,
            modality: "in_person",
            overrideReason: null,
            overrideEvidence: null,
          },
          courseworkDetail: null,
          assessmentDetail: null,
          topicActions: [],
          milestones: [],
        }),
      },
      termMeetingActivityRevision: { create: async () => ({}) },
      termCourseworkActivityRevision: { create: async () => ({}) },
      termAssessmentActivityRevision: { create: async () => ({}) },
      termActivityRevisionTopicAction: { create: async () => ({}) },
      termActivityMilestone: { create: async () => ({}) },
    };

    const preview = await previewTermActivityAdoption(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      termId: "term-1",
      learningModuleVersionSelections: [{ termLearningModuleId: "tlm-1", learningModuleVersionId: "lmv-1" }],
      crossCuttingSelections: [],
    });
    const applied = await applyTermActivityAdoption(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      termId: "term-1",
      learningModuleVersionSelections: [{ termLearningModuleId: "tlm-1", learningModuleVersionId: "lmv-1" }],
      crossCuttingSelections: [],
      previewToken: preview.previewToken,
      expectedCurrentActivityCount: preview.expectedCurrentActivityCount,
    });

    expect(termActivityCreates[0]).toEqual(expect.objectContaining({
      plannedActivityVersionId: "av-1",
      activityTypeVersionId: "atv-1",
      adoptedLabel: "Lecture",
    }));
    expect(termActivityUpdates[0]).toEqual({ plannedRevisionId: "tar-1" });
    expect(applied.termActivities[0].plannedActivityVersionId).toBe("av-1");
  });

  it("rejects closed-term adoption apply", async () => {
    const tx = {
      term: { findUnique: async () => ({ ...baseTerm(), status: "closed" }) },
      termLearningModule: { findUnique: async () => ({ id: "tlm-1", termId: "term-1", courseId: "course-1", learningModuleId: "lm-1" }) },
      learningModuleVersion: { findUnique: async () => ({ id: "lmv-1", learningModuleId: "lm-1", activities: [] }) },
      activityVersion: { findUnique: async () => baseActivityVersion() },
      courseActivityTypeVersion: { findUnique: async () => ({ courseId: "course-1" }) },
      termActivity: { count: async () => 0 },
    };
    const preview = await previewTermActivityAdoption(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      termId: "term-1",
      learningModuleVersionSelections: [],
      crossCuttingSelections: [],
    });

    await expect(
      applyTermActivityAdoption(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        termId: "term-1",
        learningModuleVersionSelections: [],
        crossCuttingSelections: [],
        previewToken: preview.previewToken,
        expectedCurrentActivityCount: 0,
      }),
    ).rejects.toThrow("Closed Terms are read-only");
  });
});

describe("Term Activity revisions", () => {
  it("creates immutable delivered revisions and preserves milestone times and anchor policies", async () => {
    const termActivityUpdates: any[] = [];
    const milestoneCreates: any[] = [];
    const tx = {
      termActivity: {
        findUnique: async () => ({
          id: "ta-1",
          termId: "term-1",
          courseId: "course-1",
          activityId: "activity-1",
          plannedActivityVersionId: "av-1",
          activityTypeVersionId: "atv-1",
          adoptedLabel: "Lecture",
          plannedRevisionId: "tar-1",
          deliveredRevisionId: null,
          term: { id: "term-1", courseId: "course-1", status: "active", course: { instructorId: "instructor-1" } },
          revisions: [{ revision: 1 }],
          archivedAt: null,
        }),
        updateMany: async ({ data }: any) => {
          termActivityUpdates.push(data);
          return { count: 1 };
        },
      },
      calendarSlot: {
        findUnique: async () => ({
          id: "slot-1",
          termId: "term-1",
          term: { course: { instructorId: "instructor-1" } },
        }),
      },
      topicVersion: {
        findUnique: async () => ({
          id: "topicv-1",
          topic: { courseId: "course-1", course: { instructorId: "instructor-1" } },
        }),
      },
      termActivityRevision: {
        create: async ({ data }: any) => ({ id: "tar-2", createdAt: new Date("2026-07-15T00:00:00.000Z"), ...data }),
        findUnique: async () => ({
          id: "tar-2",
          termActivityId: "ta-1",
          revision: 2,
          baseActivityVersionId: "av-1",
          title: "Lecture 1 corrected",
          summary: null,
          changeReason: "Correction",
          createdByInstructorId: "instructor-1",
          createdAt: new Date("2026-07-15T00:00:00.000Z"),
          meetingDetail: {
            calendarSlotId: "slot-1",
            startsAt: new Date("2026-09-01T14:00:00.000Z"),
            endsAt: new Date("2026-09-01T15:15:00.000Z"),
            status: "delivered",
            modality: "hybrid",
            overrideReason: null,
            overrideEvidence: null,
          },
          courseworkDetail: null,
          assessmentDetail: null,
          topicActions: [],
          milestones: [
            {
              id: "ms-1",
              termActivityRevisionId: "tar-2",
              sourceTemplateId: null,
              role: "due",
              label: "Due",
              linkedTermActivityId: "ta-1",
              occursAt: new Date("2026-09-02T08:00:00.000Z"),
              timeZone: "America/Los_Angeles",
              anchorPolicy: "fixed_instant",
              notes: null,
              provenance: null,
              createdAt: new Date("2026-07-15T00:00:00.000Z"),
            },
          ],
        }),
      },
      termMeetingActivityRevision: { create: async () => ({}) },
      termCourseworkActivityRevision: { create: async () => ({}) },
      termAssessmentActivityRevision: { create: async () => ({}) },
      termActivityRevisionTopicAction: { create: async () => ({}) },
      termActivityMilestone: {
        create: async ({ data }: any) => {
          milestoneCreates.push(data);
          return data;
        },
      },
    };

    const draft = {
      title: "Lecture 1 corrected",
      changeReason: "Correction",
      detail: {
        behaviorFamily: "meeting" as const,
        calendarSlotId: "slot-1",
        startsAt: new Date("2026-09-01T14:00:00.000Z"),
        endsAt: new Date("2026-09-01T15:15:00.000Z"),
        status: "delivered",
        modality: "hybrid",
      },
      topicActions: [],
      milestones: [
        {
          role: "due" as const,
          label: "Due",
          linkedTermActivityId: "ta-1",
          occursAt: new Date("2026-09-02T08:00:00.000Z"),
          timeZone: "America/Los_Angeles",
          anchorPolicy: "fixed_instant" as const,
        },
        {
          role: "review" as const,
          label: "Review",
          linkedTermActivityId: "ta-1",
          anchorPolicy: "follow_activity" as const,
        },
        {
          role: "release" as const,
          label: "Standalone",
          occursAt: new Date("2026-09-03T16:30:00.000Z"),
          timeZone: "America/Los_Angeles",
          anchorPolicy: "standalone" as const,
        },
      ],
    };
    const applied = await applyTermActivityRevision(createTransactionalDb(tx), {
      instructorId: "instructor-1",
      termActivityId: "ta-1",
      expectedCurrentRevisionId: null,
      previewToken: revisionPreviewToken("ta-1", null, draft),
      advancePointer: "delivered",
      draft,
    }).catch((error) => {
      if (error instanceof ConcurrencyConflictError) {
        return { kind: "conflict" as const };
      }
      throw error;
    });

    expect(applied.kind).not.toBe("conflict");
    expect(milestoneCreates).toEqual([
      expect.objectContaining({
        label: "Due",
        occursAt: new Date("2026-09-02T08:00:00.000Z"),
        anchorPolicy: "fixed_instant",
      }),
      expect.objectContaining({
        label: "Review",
        linkedTermActivityId: "ta-1",
        occursAt: null,
        anchorPolicy: "follow_activity",
      }),
      expect.objectContaining({
        label: "Standalone",
        occursAt: new Date("2026-09-03T16:30:00.000Z"),
        anchorPolicy: "standalone",
      }),
    ]);
    expect(termActivityUpdates[0]).toEqual(expect.objectContaining({
      deliveredRevisionId: "tar-2",
      lifecycleState: "delivered",
    }));
  });

  it("maps compare-and-swap pointer races to ConcurrencyConflictError", async () => {
    const tx = {
      termActivity: {
        findUnique: async () => ({
          id: "ta-1",
          termId: "term-1",
          courseId: "course-1",
          activityId: "activity-1",
          plannedActivityVersionId: "av-1",
          activityTypeVersionId: "atv-1",
          adoptedLabel: "Lecture",
          plannedRevisionId: "tar-1",
          deliveredRevisionId: null,
          term: { id: "term-1", courseId: "course-1", status: "active", course: { instructorId: "instructor-1" } },
          revisions: [{ revision: 1 }],
          archivedAt: null,
        }),
        updateMany: async () => ({ count: 0 }),
      },
      termActivityRevision: {
        create: async ({ data }: any) => ({ id: "tar-2", createdAt: new Date(), ...data }),
        findUnique: async () => ({
          id: "tar-2",
          termActivityId: "ta-1",
          revision: 2,
          baseActivityVersionId: "av-1",
          title: "Revision",
          summary: null,
          changeReason: null,
          createdByInstructorId: "instructor-1",
          createdAt: new Date(),
          meetingDetail: null,
          courseworkDetail: { lifecycleState: "submitted", deliveryNotes: null },
          assessmentDetail: null,
          topicActions: [],
          milestones: [],
        }),
      },
      termMeetingActivityRevision: { create: async () => ({}) },
      termCourseworkActivityRevision: { create: async () => ({}) },
      termAssessmentActivityRevision: { create: async () => ({}) },
      termActivityRevisionTopicAction: { create: async () => ({}) },
      termActivityMilestone: { create: async () => ({}) },
    };

    const draft = {
      title: "Revision",
      detail: { behaviorFamily: "coursework" as const, lifecycleState: "submitted" },
    };
    await expect(
      applyTermActivityRevision(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        termActivityId: "ta-1",
        expectedCurrentRevisionId: null,
        previewToken: revisionPreviewToken("ta-1", null, draft),
        advancePointer: "delivered",
        draft,
      }),
    ).rejects.toBeInstanceOf(ConcurrencyConflictError);
  });

  it("maps Prisma P2002 races to ConcurrencyConflictError", async () => {
    const tx = {
      termActivity: {
        findUnique: async () => ({
          id: "ta-1",
          termId: "term-1",
          courseId: "course-1",
          activityId: "activity-1",
          plannedActivityVersionId: "av-1",
          activityTypeVersionId: "atv-1",
          adoptedLabel: "Lecture",
          plannedRevisionId: "tar-1",
          deliveredRevisionId: null,
          term: { id: "term-1", courseId: "course-1", status: "active", course: { instructorId: "instructor-1" } },
          revisions: [{ revision: 1 }],
          archivedAt: null,
        }),
      },
      termActivityRevision: {
        create: async () => {
          const error = new Error("duplicate") as Error & { code: "P2002" };
          error.code = "P2002";
          throw error;
        },
      },
    };

    const draft = {
      title: "Revision",
      detail: { behaviorFamily: "coursework" as const, lifecycleState: "submitted" },
    };
    await expect(
      applyTermActivityRevision(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        termActivityId: "ta-1",
        expectedCurrentRevisionId: null,
        previewToken: revisionPreviewToken("ta-1", null, draft),
        advancePointer: "delivered",
        draft,
      }),
    ).rejects.toBeInstanceOf(ConcurrencyConflictError);
  });

  it("rejects closed-term planned revisions", async () => {
    const tx = {
      termActivity: {
        findUnique: async () => ({
          id: "ta-1",
          termId: "term-1",
          courseId: "course-1",
          activityId: "activity-1",
          plannedActivityVersionId: "av-1",
          activityTypeVersionId: "atv-1",
          adoptedLabel: "Lecture",
          plannedRevisionId: "tar-1",
          deliveredRevisionId: null,
          term: { id: "term-1", courseId: "course-1", status: "closed", course: { instructorId: "instructor-1" } },
          revisions: [{ revision: 1 }],
          archivedAt: null,
        }),
      },
    };

    const draft = {
      title: "Revision",
      detail: { behaviorFamily: "coursework" as const, lifecycleState: "submitted" },
    };
    await expect(
      applyTermActivityRevision(createTransactionalDb(tx), {
        instructorId: "instructor-1",
        termActivityId: "ta-1",
        expectedCurrentRevisionId: "tar-1",
        previewToken: revisionPreviewToken("ta-1", "tar-1", draft),
        advancePointer: "planned",
        draft,
      }),
    ).rejects.toThrow("Closed Terms are read-only");
  });
});
