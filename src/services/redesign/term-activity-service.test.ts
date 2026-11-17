/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma test doubles */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ConcurrencyConflictError } from "./errors";
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

// Captures the options a service passes to $transaction, so a test can assert
// the transaction is given room to finish against a remote database.
function createOptionCapturingDb(tx: Record<string, any>, captured: { options?: Record<string, number> }) {
  return {
    $transaction: async <T>(
      fn: (nestedTx: Record<string, any>) => Promise<T>,
      options?: Record<string, number>,
    ) => {
      captured.options = options;
      return fn(tx);
    },
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
  it.each(["same apply", "already adopted", "missing", "no link", "archived", "self"])("creates template milestones: %s", async (linkCase) => {
    const rows: any[] = ["already adopted", "archived"].includes(linkCase) ? [{ id: "ta-z-meeting", activityId: "z-meeting", adoptedLabel: "Existing meeting", archivedAt: linkCase === "archived" ? new Date() : null }] : [];
    const milestones: any[] = [];
    const effortDetails: any[] = [];
    const templates = [0, 1].map((sequence) => ({
      id: `template-${sequence}`, sequence, role: sequence ? "due" : "release",
      label: sequence ? "Submit work" : "Begin work", timeZone: "UTC", notes: "Keep this note",
      linkedActivityId: linkCase === "no link" ? null : linkCase === "self" ? "a-work" : "z-meeting",
    }));
    const tx = {
      term: { findUnique: async () => baseTerm() },
      activityVersion: { findUnique: async ({ where, include }: any) => {
        expect(include.milestoneTemplates).toEqual({ orderBy: { sequence: "asc" } });
        return baseActivityVersion({ id: where.id, activityId: where.id,
          milestoneTemplates: where.id === "a-work" ? templates : [],
          ...(where.id === "a-work" ? { meetingDetail: null, courseworkDetail: { effortMinMinutes: 60, effortMaxMinutes: 120 } } : {}) });
      } },
      courseActivityTypeVersion: { findUnique: async () => ({}) },
      termActivity: {
        count: async () => rows.length,
        findMany: async () => rows,
        create: async ({ data }: any) => { const row = { id: `ta-${data.activityId}`, ...data }; rows.push(row); return row; },
        update: async () => ({}),
      },
      termActivityRevision: { create: async ({ data }: any) => ({ id: `revision-${data.termActivityId}`, ...data }), findUnique: async () => ({ id: "revision" }) },
      termMeetingActivityRevision: { create: async () => ({}) },
      termCourseworkActivityRevision: { create: async ({ data }: any) => { effortDetails.push(data); return data; } },
      termActivityRevisionTopicAction: { create: async () => ({}) },
      termActivityMilestone: { create: async ({ data }: any) => { milestones.push(data); return data; } },
    };
    const input = { instructorId: "instructor-1", termId: "term-1", learningModuleVersionSelections: [],
      crossCuttingSelections: (["same apply", "already adopted", "archived"].includes(linkCase) ? ["a-work", "z-meeting"] : ["a-work"])
        .map((id) => ({ activityId: id, activityVersionId: id })) };
    const db = createTransactionalDb(tx);
    const preview = await previewTermActivityAdoption(db, input);
    // An undated milestone must follow a Term Activity. The database rejects an
    // undated standalone milestone, so a template with nothing to follow is not created.
    const followed = ["same apply", "already adopted"].includes(linkCase);
    expect(preview.candidates[0]).toMatchObject({ milestoneCount: followed ? 2 : 0,
      standaloneMilestones: followed ? [] : templates.map((t) => ({
        sourceTemplateId: t.id, label: t.label, reason: linkCase === "archived" ? "Linked Activity is archived in this Term" : linkCase === "self" ? "A milestone cannot follow its own Activity" : linkCase === "no link" ? "The template has no linked Activity to follow" : "Linked Activity is not adopted in this Term",
      })),
    });
    expect(preview.expectedCurrentActivityCount).toBe(rows.length);
    expect(preview.alreadyAdopted).toEqual(["already adopted", "archived"].includes(linkCase) ? [{ activityId: "z-meeting", adoptedLabel: "Existing meeting" }] : []);
    templates[0].label += " changed";
    expect((await previewTermActivityAdoption(db, input)).previewToken).not.toBe(preview.previewToken);
    templates[0].label = "Begin work";
    await applyTermActivityAdoption(db, { ...input, previewToken: preview.previewToken, expectedCurrentActivityCount: preview.expectedCurrentActivityCount });
    expect(milestones).toEqual(followed ? templates.map((t) => expect.objectContaining({
      sourceTemplateId: t.id, role: t.role, label: t.label, timeZone: t.timeZone, notes: t.notes, occursAt: null,
      linkedTermActivityId: "ta-z-meeting", anchorPolicy: "follow_activity",
    })) : []);
    expect(effortDetails).toEqual([expect.objectContaining({ effortMinMinutes: null, effortMaxMinutes: null })]);
    // The database check: follow_activity needs a link; fixed_instant and standalone need a date.
    for (const milestone of milestones)
      expect(milestone.anchorPolicy === "follow_activity" ? milestone.linkedTermActivityId : milestone.occursAt).toBeTruthy();
    const repeat = await previewTermActivityAdoption(db, input);
    expect(repeat.candidates).toEqual([]);
    const count = rows.length;
    expect(await applyTermActivityAdoption(db, { ...input, previewToken: repeat.previewToken, expectedCurrentActivityCount: repeat.expectedCurrentActivityCount })).toMatchObject({ kind: "applied" });
    expect(rows).toHaveLength(count);
    expect(milestones).toHaveLength(followed ? 2 : 0);
  });

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
      termActivity: { count: async () => 0, findMany: async () => [] },
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
        findMany: async () => termActivityCreates.length ? [{
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
        }] : [],
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
    const captured: { options?: Record<string, number> } = {};
    const applied = await applyTermActivityAdoption(createOptionCapturingDb(tx, captured), {
      instructorId: "instructor-1",
      termId: "term-1",
      learningModuleVersionSelections: [{ termLearningModuleId: "tlm-1", learningModuleVersionId: "lmv-1" }],
      crossCuttingSelections: [],
      previewToken: preview.previewToken,
      expectedCurrentActivityCount: preview.expectedCurrentActivityCount,
    });

    // Adoption writes one Term Activity and one revision per candidate, so the
    // transaction must outlive Prisma's 5s default against a remote database.
    expect(captured.options?.timeout).toBeGreaterThanOrEqual(60_000);
    expect(captured.options?.maxWait).toBeGreaterThanOrEqual(5_000);

    expect(termActivityCreates[0]).toEqual(expect.objectContaining({
      plannedActivityVersionId: "av-1",
      activityTypeVersionId: "atv-1",
      adoptedLabel: "Lecture",
    }));
    expect(termActivityUpdates[0]).toEqual({ plannedRevisionId: "tar-1" });
    expect(applied.termActivities[0].plannedActivityVersionId).toBe("av-1");
  });

  it("open question: adoption creates an undated planned snapshot rather than inferred delivery", async () => {
    // Adoption has no date input and reads neither the clock nor Term dates.
    const termActivityCreates: any[] = [];
    const termActivityUpdates: any[] = [];
    const meetingCreates: any[] = [];
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
        findMany: async () => termActivityCreates.length ? [{
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
        }] : [],
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
      termMeetingActivityRevision: { create: async ({ data }: any) => { meetingCreates.push(data); return data; } },
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
    const captured: { options?: Record<string, number> } = {};
    const applied = await applyTermActivityAdoption(createOptionCapturingDb(tx, captured), {
      instructorId: "instructor-1",
      termId: "term-1",
      learningModuleVersionSelections: [{ termLearningModuleId: "tlm-1", learningModuleVersionId: "lmv-1" }],
      crossCuttingSelections: [],
      previewToken: preview.previewToken,
      expectedCurrentActivityCount: preview.expectedCurrentActivityCount,
    });

    // Adoption writes one Term Activity and one revision per candidate, so the
    // transaction must outlive Prisma's 5s default against a remote database.
    expect(captured.options?.timeout).toBeGreaterThanOrEqual(60_000);
    expect(captured.options?.maxWait).toBeGreaterThanOrEqual(5_000);

    expect(termActivityCreates[0]).toEqual(expect.objectContaining({
      plannedActivityVersionId: "av-1",
      activityTypeVersionId: "atv-1",
      adoptedLabel: "Lecture",
    }));
    expect(termActivityUpdates[0]).toEqual({ plannedRevisionId: "tar-1" });
    expect(applied.termActivities[0].plannedActivityVersionId).toBe("av-1");
    expect(applied.termActivities[0].deliveredRevisionId).toBeNull();
    expect(applied.termActivities[0].lifecycleState).toBeNull();
    expect(meetingCreates).toEqual([expect.objectContaining({
      startsAt: null, endsAt: null, status: null, calendarSlotId: null,
    })]);
  });

  it("rejects closed-term adoption apply", async () => {
    const tx = {
      term: { findUnique: async () => ({ ...baseTerm(), status: "closed" }) },
      termLearningModule: { findUnique: async () => ({ id: "tlm-1", termId: "term-1", courseId: "course-1", learningModuleId: "lm-1" }) },
      learningModuleVersion: { findUnique: async () => ({ id: "lmv-1", learningModuleId: "lm-1", activities: [] }) },
      activityVersion: { findUnique: async () => baseActivityVersion() },
      courseActivityTypeVersion: { findUnique: async () => ({ courseId: "course-1" }) },
      termActivity: { count: async () => 0, findMany: async () => [] },
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
