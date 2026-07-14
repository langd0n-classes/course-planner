import { describe, it, expect } from "vitest";
import {
  createActivityTypeSchema,
  upsertActivityTypeVersionSchema,
  createActivitySchema,
  upsertActivityVersionSchema,
  activityDetailSchema,
  upsertMilestoneTemplateSchema,
  replaceMilestoneTemplatesSchema,
  replaceActivityLmScopeSchema,
  replaceActivityTopicActionsSchema,
  replaceActivityTopicScopeSchema,
  termActivityAdoptionSelectionSchema,
  termAdoptionPreviewRequestSchema,
  termAdoptionApplyRequestSchema,
  termActivityRevisionDetailSchema,
  upsertTermActivityMilestoneSchema,
  termActivityRevisionPreviewRequestSchema,
  termActivityRevisionApplyRequestSchema,
  promoteDeliveryPreviewRequestSchema,
  promoteDeliveryApplyRequestSchema,
  createTermCalendarExceptionSchema,
  updateTermCalendarExceptionSchema,
  upsertTermMeetingPatternSchema,
  termCalendarPreviewRequestSchema,
  termCalendarApplyRequestSchema,
  createAcademicCalendarVersionSchema,
  replaceCourseActivityTypeVersionsSchema,
  createArtifactSchema,
  upsertLearningModuleVersionSchema,
  createLearningModuleSchema,
} from "./redesign-schemas";

const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validUUID2 = "660e8400-e29b-41d4-a716-446655440001";
const validUUID3 = "770e8400-e29b-41d4-a716-446655440002";
const validIsoDate = "2026-07-14";
const validIsoDateTime = "2026-07-14T12:00:00Z";
const artifactParents = {
  learningModuleVersionId: null,
  topicVersionId: null,
  sessionId: null,
  assessmentId: null,
  activityVersionId: null,
  termActivityRevisionId: null,
};
const artifactFields = {
  ...artifactParents,
  artifactType: "handout" as const,
  sourceType: "uploaded_file" as const,
  title: "Study Guide",
  uri: "/artifacts/study-guide.pdf",
  filename: "study-guide.pdf",
  mimeType: "application/pdf",
};

describe("Activity Type Schemas", () => {
  describe("upsertActivityTypeVersionSchema", () => {
    it("accepts valid version update", () => {
      const result = upsertActivityTypeVersionSchema.safeParse({
        label: "Lecture",
        description: "Traditional lecture format",
        publish: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts version with expectedCurrentVersionId", () => {
      const result = upsertActivityTypeVersionSchema.safeParse({
        expectedCurrentVersionId: validUUID,
        label: "Studio",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty label", () => {
      const result = upsertActivityTypeVersionSchema.safeParse({
        label: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid UUID in expectedCurrentVersionId", () => {
      const result = upsertActivityTypeVersionSchema.safeParse({
        expectedCurrentVersionId: "not-a-uuid",
        label: "Lecture",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createActivityTypeSchema", () => {
    it("accepts valid activity type creation", () => {
      const result = createActivityTypeSchema.safeParse({
        behaviorFamily: "meeting",
        createdByInstructorId: validUUID,
        version: {
          label: "Lecture",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid behavior family", () => {
      const result = createActivityTypeSchema.safeParse({
        behaviorFamily: "discussion",
        createdByInstructorId: validUUID,
        version: { label: "Lecture" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing label in version", () => {
      const result = createActivityTypeSchema.safeParse({
        behaviorFamily: "coursework",
        createdByInstructorId: validUUID,
        version: {},
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Activity Detail Discriminant", () => {
  it("accepts valid meeting detail", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "meeting",
      defaultDurationMinutes: 75,
      modality: "in-person",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid coursework detail", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "coursework",
      submissionPolicy: "online",
      releasePolicy: "upon_completion",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid assessment detail", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "assessment",
      modality: "written",
    });
    expect(result.success).toBe(true);
  });

  it("rejects coursework fields in meeting detail", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "meeting",
      submissionPolicy: "invalid field",
    });
    expect(result.success).toBe(false);
  });

  it("rejects meeting fields in assessment detail", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "assessment",
      defaultDurationMinutes: 60,
    });
    expect(result.success).toBe(false);
  });
});

describe("Milestone Template Schemas", () => {
  it("accepts valid milestone template", () => {
    const result = upsertMilestoneTemplateSchema.safeParse({
      sequence: 0,
      role: "release",
      label: "Project Release",
      relativeDays: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts milestone with linked activity", () => {
    const result = upsertMilestoneTemplateSchema.safeParse({
      sequence: 1,
      role: "due",
      label: "Project Due",
      linkedActivityId: validUUID,
      occursAt: validIsoDateTime,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative sequence", () => {
    const result = upsertMilestoneTemplateSchema.safeParse({
      sequence: -1,
      role: "release",
      label: "Release",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = upsertMilestoneTemplateSchema.safeParse({
      sequence: 0,
      role: "release",
      label: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = upsertMilestoneTemplateSchema.safeParse({
      sequence: 0,
      role: "invalid",
      label: "Release",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID in linkedActivityId", () => {
    const result = upsertMilestoneTemplateSchema.safeParse({
      sequence: 0,
      role: "release",
      label: "Release",
      linkedActivityId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("Replace Milestone Templates", () => {
  it("accepts valid milestone template array", () => {
    const result = replaceMilestoneTemplatesSchema.safeParse({
      templates: [
        {
          sequence: 0,
          role: "release",
          label: "Release",
        },
        {
          sequence: 1,
          role: "due",
          label: "Due",
          linkedActivityId: validUUID,
          occursAt: validIsoDateTime,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty template array", () => {
    const result = replaceMilestoneTemplatesSchema.safeParse({
      templates: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("Activity Creation Schema", () => {
  it("accepts full valid activity with meeting detail", () => {
    const result = createActivitySchema.safeParse({
      stableCode: "project-01",
      createdByInstructorId: validUUID,
      version: {
        title: "Final Project",
        summary: "Capstone project",
        activityTypeVersionId: validUUID2,
        detail: {
          behaviorFamily: "meeting",
          defaultDurationMinutes: 120,
          modality: "hybrid",
        },
        milestoneTemplates: [
          {
            sequence: 0,
            role: "release",
            label: "Release",
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects activity with empty stable code", () => {
    const result = createActivitySchema.safeParse({
      stableCode: "",
      createdByInstructorId: validUUID,
      version: {
        title: "Activity",
        activityTypeVersionId: validUUID2,
        detail: {
          behaviorFamily: "coursework",
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects activity with invalid detail", () => {
    const result = createActivitySchema.safeParse({
      stableCode: "valid-code",
      createdByInstructorId: validUUID,
      version: {
        title: "Activity",
        activityTypeVersionId: validUUID2,
        detail: {
          behaviorFamily: "unknown",
        },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("Activity Topic Actions", () => {
  it("accepts valid topic actions", () => {
    const result = replaceActivityTopicActionsSchema.safeParse({
      actions: [
        {
          topicVersionId: validUUID,
          action: "introduced",
        },
        {
          topicVersionId: validUUID2,
          action: "practiced",
          notes: "Extended practice",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty actions array", () => {
    const result = replaceActivityTopicActionsSchema.safeParse({
      actions: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid coverage level", () => {
    const result = replaceActivityTopicActionsSchema.safeParse({
      actions: [
        {
          topicVersionId: validUUID,
          action: "explored",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid topic UUID", () => {
    const result = replaceActivityTopicActionsSchema.safeParse({
      actions: [
        {
          topicVersionId: "not-a-uuid",
          action: "assessed",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate topicVersionId/action pair", () => {
    const result = replaceActivityTopicActionsSchema.safeParse({
      actions: [
        {
          topicVersionId: validUUID,
          action: "introduced",
        },
        {
          topicVersionId: validUUID,
          action: "introduced",
          notes: "duplicate",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("allows same topic with different actions", () => {
    const result = replaceActivityTopicActionsSchema.safeParse({
      actions: [
        {
          topicVersionId: validUUID,
          action: "introduced",
        },
        {
          topicVersionId: validUUID,
          action: "practiced",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("Activity LM Scope", () => {
  it("accepts valid learning module scopes", () => {
    const result = replaceActivityLmScopeSchema.safeParse({
      scopes: [
        {
          learningModuleId: validUUID,
          emphasis: "primary",
        },
        {
          learningModuleId: validUUID2,
          notes: "Recap material",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty scopes", () => {
    const result = replaceActivityLmScopeSchema.safeParse({
      scopes: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid learning module UUID", () => {
    const result = replaceActivityLmScopeSchema.safeParse({
      scopes: [
        {
          learningModuleId: "invalid-uuid",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate learningModuleId", () => {
    const result = replaceActivityLmScopeSchema.safeParse({
      scopes: [
        {
          learningModuleId: validUUID,
          emphasis: "primary",
        },
        {
          learningModuleId: validUUID,
          notes: "Duplicate",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("Activity Topic Scope", () => {
  it("accepts valid topic scope", () => {
    const result = replaceActivityTopicScopeSchema.safeParse({
      scopes: [
        {
          topicId: validUUID,
          notes: "Main topic",
        },
        {
          topicId: validUUID2,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid topic ID", () => {
    const result = replaceActivityTopicScopeSchema.safeParse({
      scopes: [
        {
          topicId: "bad-id",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate topicId", () => {
    const result = replaceActivityTopicScopeSchema.safeParse({
      scopes: [
        {
          topicId: validUUID,
          notes: "Main topic",
        },
        {
          topicId: validUUID,
          notes: "Duplicate",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("Term Activity Adoption", () => {
  it("accepts valid adoption preview request", () => {
    const result = termAdoptionPreviewRequestSchema.safeParse({
      learningModuleVersionSelections: [
        {
          termLearningModuleId: validUUID,
          learningModuleVersionId: validUUID2,
        },
      ],
      crossCuttingSelections: [
        {
          activityId: validUUID3,
          activityVersionId: validUUID,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts adoption preview with optional termLearningModuleId", () => {
    const result = termAdoptionPreviewRequestSchema.safeParse({
      learningModuleVersionSelections: [],
      crossCuttingSelections: [
        {
          activityId: validUUID,
          activityVersionId: validUUID2,
          termLearningModuleId: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts adoption apply request with token", () => {
    const result = termAdoptionApplyRequestSchema.safeParse({
      previewToken: "token-123",
      expectedCurrentActivityCount: 5,
      learningModuleVersionSelections: [],
      crossCuttingSelections: [
        {
          activityId: validUUID,
          activityVersionId: validUUID2,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects adoption apply with empty token", () => {
    const result = termAdoptionApplyRequestSchema.safeParse({
      previewToken: "",
      expectedCurrentActivityCount: 0,
      learningModuleVersionSelections: [],
      crossCuttingSelections: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects adoption apply with negative activity count", () => {
    const result = termAdoptionApplyRequestSchema.safeParse({
      previewToken: "valid-token",
      expectedCurrentActivityCount: -1,
      learningModuleVersionSelections: [],
      crossCuttingSelections: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Term Activity Revision Detail Discriminant", () => {
  it("accepts valid meeting revision detail", () => {
    const result = termActivityRevisionDetailSchema.safeParse({
      behaviorFamily: "meeting",
      calendarSlotId: validUUID,
      startsAt: validIsoDateTime,
      endsAt: validIsoDateTime,
      status: "scheduled",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid coursework revision detail", () => {
    const result = termActivityRevisionDetailSchema.safeParse({
      behaviorFamily: "coursework",
      lifecycleState: "released",
      deliveryNotes: "Submit online",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid assessment revision detail", () => {
    const result = termActivityRevisionDetailSchema.safeParse({
      behaviorFamily: "assessment",
      lifecycleState: "administered",
      modality: "written",
    });
    expect(result.success).toBe(true);
  });

  it("rejects coursework fields in meeting detail", () => {
    const result = termActivityRevisionDetailSchema.safeParse({
      behaviorFamily: "meeting",
      lifecycleState: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("Term Activity Milestone Anchor Policies", () => {
  it("accepts standalone anchor with occursAt", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "due",
      label: "Due Date",
      anchorPolicy: "standalone",
      occursAt: validIsoDateTime,
    });
    expect(result.success).toBe(true);
  });

  it("rejects standalone anchor with linkedTermActivityId", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "due",
      label: "Due Date",
      anchorPolicy: "standalone",
      occursAt: validIsoDateTime,
      linkedTermActivityId: validUUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects standalone anchor without occursAt", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "due",
      label: "Due Date",
      anchorPolicy: "standalone",
    });
    expect(result.success).toBe(false);
  });

  it("accepts follow_activity anchor with linkedTermActivityId", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "release",
      label: "Release",
      anchorPolicy: "follow_activity",
      linkedTermActivityId: validUUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects follow_activity anchor without linkedTermActivityId", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "release",
      label: "Release",
      anchorPolicy: "follow_activity",
    });
    expect(result.success).toBe(false);
  });

  it("accepts fixed_instant anchor with occursAt and optional linkedTermActivityId", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "due",
      label: "Due",
      anchorPolicy: "fixed_instant",
      occursAt: validIsoDateTime,
      linkedTermActivityId: validUUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts fixed_instant with only occursAt", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "due",
      label: "Due",
      anchorPolicy: "fixed_instant",
      occursAt: validIsoDateTime,
    });
    expect(result.success).toBe(true);
  });
});

describe("Term Activity Revision Preview/Apply", () => {
  it("accepts valid revision preview", () => {
    const result = termActivityRevisionPreviewRequestSchema.safeParse({
      title: "Discussion Section",
      summary: "Small group discussion",
      detail: {
        behaviorFamily: "meeting",
        startsAt: validIsoDateTime,
        status: "scheduled",
      },
      milestones: [
        {
          role: "release",
          label: "Session Release",
          anchorPolicy: "standalone",
          occursAt: validIsoDateTime,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts revision with topic actions", () => {
    const result = termActivityRevisionPreviewRequestSchema.safeParse({
      title: "Review Session",
      detail: {
        behaviorFamily: "meeting",
      },
      topicActions: [
        {
          topicVersionId: validUUID,
          action: "practiced",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts revision apply with pointer", () => {
    const result = termActivityRevisionApplyRequestSchema.safeParse({
      title: "Updated Activity",
      detail: {
        behaviorFamily: "coursework",
      },
      previewToken: "token-xyz",
      advancePointer: "delivered",
    });
    expect(result.success).toBe(true);
  });

  it("rejects revision apply without advancePointer", () => {
    const result = termActivityRevisionApplyRequestSchema.safeParse({
      title: "Activity",
      detail: {
        behaviorFamily: "assessment",
      },
      previewToken: "token",
    });
    expect(result.success).toBe(false);
  });
});

describe("Promotion Flows", () => {
  it("accepts valid promote delivery preview", () => {
    const result = promoteDeliveryPreviewRequestSchema.safeParse({
      termActivityIds: [validUUID, validUUID2],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty term activity list", () => {
    const result = promoteDeliveryPreviewRequestSchema.safeParse({
      termActivityIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts promote delivery apply", () => {
    const result = promoteDeliveryApplyRequestSchema.safeParse({
      previewToken: "token-promo",
      expectedCurrentActivityVersionIds: [
        {
          activityId: validUUID,
          activityVersionId: validUUID2,
        },
      ],
      termActivityIds: [validUUID3],
    });
    expect(result.success).toBe(true);
  });

  it("rejects promote apply with empty token", () => {
    const result = promoteDeliveryApplyRequestSchema.safeParse({
      previewToken: "",
      expectedCurrentActivityVersionIds: [],
      termActivityIds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Term Calendar Exceptions", () => {
  it("accepts cancel exception", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "cancel",
      calendarSlotId: validUUID,
      reason: "Holiday",
    });
    expect(result.success).toBe(true);
  });

  it("accepts add exception", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "add",
      activityTypeVersionId: validUUID,
      targetDate: validIsoDate,
      startsAt: validIsoDateTime,
      label: "Extra session",
    });
    expect(result.success).toBe(true);
  });

  it("accepts replace exception", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "replace",
      calendarSlotId: validUUID,
      targetDate: validIsoDate,
      startsAt: validIsoDateTime,
    });
    expect(result.success).toBe(true);
  });

  it("accepts modify exception", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "modify",
      calendarSlotId: validUUID,
      startsAt: validIsoDateTime,
      reason: "Room change",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid action", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "defer",
      calendarSlotId: validUUID,
    });
    expect(result.success).toBe(false);
  });

  it("accepts partial update", () => {
    const result = updateTermCalendarExceptionSchema.safeParse({
      reason: "Updated reason",
    });
    expect(result.success).toBe(true);
  });
});

describe("Term Meeting Patterns", () => {
  it("accepts valid meeting pattern", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday", "Wednesday", "Friday"],
      startTimeLocal: "09:00",
      endTimeLocal: "10:15",
      timeZone: "America/New_York",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(true);
  });

  it("accepts pattern without end time", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Tuesday"],
      startTimeLocal: "14:00",
      timeZone: "UTC",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty days of week", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: [],
      startTimeLocal: "09:00",
      timeZone: "UTC",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty start time", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday"],
      startTimeLocal: "",
      timeZone: "UTC",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty timezone", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday"],
      startTimeLocal: "09:00",
      timeZone: "",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(false);
  });
});

describe("Term Calendar Preview/Apply", () => {
  it("accepts valid calendar preview", () => {
    const result = termCalendarPreviewRequestSchema.safeParse({
      meetingPatterns: [
        {
          activityTypeVersionId: validUUID,
          daysOfWeek: ["Monday", "Wednesday"],
          startTimeLocal: "10:00",
          timeZone: "America/New_York",
          startsOn: validIsoDate,
          endsOn: validIsoDate,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty patterns in preview", () => {
    const result = termCalendarPreviewRequestSchema.safeParse({
      meetingPatterns: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid calendar apply", () => {
    const result = termCalendarApplyRequestSchema.safeParse({
      previewToken: "cal-token",
      expectedCurrentCalendarSlotCount: 28,
      meetingPatterns: [
        {
          activityTypeVersionId: validUUID,
          daysOfWeek: ["Tuesday"],
          startTimeLocal: "13:00",
          timeZone: "UTC",
          startsOn: validIsoDate,
          endsOn: validIsoDate,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects calendar apply with empty token", () => {
    const result = termCalendarApplyRequestSchema.safeParse({
      previewToken: "",
      expectedCurrentCalendarSlotCount: 10,
      meetingPatterns: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects calendar apply with negative slot count", () => {
    const result = termCalendarApplyRequestSchema.safeParse({
      previewToken: "token",
      expectedCurrentCalendarSlotCount: -5,
      meetingPatterns: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Activity Detail Strictness", () => {
  it("rejects coursework fields in meeting detail", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "meeting",
      defaultDurationMinutes: 60,
      submissionPolicy: "online",
    });
    expect(result.success).toBe(false);
  });

  it("rejects meeting fields in coursework detail", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "coursework",
      defaultDurationMinutes: 75,
    });
    expect(result.success).toBe(false);
  });

  it("accepts meeting with nonnegative duration", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "meeting",
      defaultDurationMinutes: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects meeting with negative duration", () => {
    const result = activityDetailSchema.safeParse({
      behaviorFamily: "meeting",
      defaultDurationMinutes: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("Term Activity Revision Detail Strictness", () => {
  it("rejects coursework fields in meeting revision detail", () => {
    const result = termActivityRevisionDetailSchema.safeParse({
      behaviorFamily: "meeting",
      lifecycleState: "released",
    });
    expect(result.success).toBe(false);
  });

  it("rejects meeting fields in assessment revision detail", () => {
    const result = termActivityRevisionDetailSchema.safeParse({
      behaviorFamily: "assessment",
      calendarSlotId: validUUID,
    });
    expect(result.success).toBe(false);
  });
});

describe("Fixed Instant Anchor Validation", () => {
  it("rejects fixed_instant anchor without occursAt", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "due",
      label: "Due Date",
      anchorPolicy: "fixed_instant",
    });
    expect(result.success).toBe(false);
  });

  it("accepts fixed_instant with occursAt and optional link", () => {
    const result = upsertTermActivityMilestoneSchema.safeParse({
      role: "due",
      label: "Due",
      anchorPolicy: "fixed_instant",
      occursAt: validIsoDateTime,
      linkedTermActivityId: validUUID,
    });
    expect(result.success).toBe(true);
  });
});

describe("Term Activity Revision Duplicate Topic Actions", () => {
  it("rejects duplicate topicVersionId/action pair in topicActions", () => {
    const result = termActivityRevisionPreviewRequestSchema.safeParse({
      title: "Activity",
      detail: {
        behaviorFamily: "coursework",
      },
      topicActions: [
        {
          topicVersionId: validUUID,
          action: "introduced",
        },
        {
          topicVersionId: validUUID,
          action: "introduced",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts same topic with different actions", () => {
    const result = termActivityRevisionPreviewRequestSchema.safeParse({
      title: "Activity",
      detail: {
        behaviorFamily: "coursework",
      },
      topicActions: [
        {
          topicVersionId: validUUID,
          action: "introduced",
        },
        {
          topicVersionId: validUUID,
          action: "practiced",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("Term Calendar Exception Validation", () => {
  it("rejects exception without target", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "modify",
    });
    expect(result.success).toBe(false);
  });

  it("rejects add without activityTypeVersionId", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "add",
      startsAt: validIsoDateTime,
    });
    expect(result.success).toBe(false);
  });

  it("accepts add with required fields", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "add",
      activityTypeVersionId: validUUID,
      startsAt: validIsoDateTime,
    });
    expect(result.success).toBe(true);
  });

  it("rejects replace without timing", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "replace",
      calendarSlotId: validUUID,
    });
    expect(result.success).toBe(false);
  });

  it("accepts replace with calendarSlotId and timing", () => {
    const result = createTermCalendarExceptionSchema.safeParse({
      action: "replace",
      calendarSlotId: validUUID,
      startsAt: validIsoDateTime,
    });
    expect(result.success).toBe(true);
  });

  it("rejects update with empty object", () => {
    const result = updateTermCalendarExceptionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts update with at least one field", () => {
    const result = updateTermCalendarExceptionSchema.safeParse({
      reason: "Updated",
    });
    expect(result.success).toBe(true);
  });
});

describe("Term Meeting Pattern Time and Date Validation", () => {
  it("rejects invalid start time format", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday"],
      startTimeLocal: "9:00",
      timeZone: "UTC",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid end time format", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday"],
      startTimeLocal: "09:00",
      endTimeLocal: "1:30 PM",
      timeZone: "UTC",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range 24-hour times", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday"],
      startTimeLocal: "24:00",
      timeZone: "UTC",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid HH:MM times", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday"],
      startTimeLocal: "09:00",
      endTimeLocal: "10:30",
      timeZone: "UTC",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(true);
  });

  it("rejects end date before start date", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday"],
      startTimeLocal: "09:00",
      timeZone: "UTC",
      startsOn: "2026-07-20",
      endsOn: "2026-07-14",
    });
    expect(result.success).toBe(false);
  });

  it("accepts end date equal to start date", () => {
    const result = upsertTermMeetingPatternSchema.safeParse({
      activityTypeVersionId: validUUID,
      daysOfWeek: ["Monday"],
      startTimeLocal: "09:00",
      timeZone: "UTC",
      startsOn: validIsoDate,
      endsOn: validIsoDate,
    });
    expect(result.success).toBe(true);
  });
});

describe("Academic Calendar Version Schema", () => {
  it("accepts valid calendar version", () => {
    const result = createAcademicCalendarVersionSchema.safeParse({
      name: "Fall 2026",
      academicYear: "2026",
      sourceUri: "https://example.edu/calendar/2026",
    });
    expect(result.success).toBe(true);
  });

  it("accepts version with events and periods", () => {
    const result = createAcademicCalendarVersionSchema.safeParse({
      name: "Spring 2027",
      academicYear: "2027",
      events: [
        {
          label: "Classes Begin",
          startsOn: "2027-01-10",
          endsOn: "2027-01-10",
          eventType: "term_start",
        },
      ],
      periods: [
        {
          kind: "instructional",
          label: "Session 1",
          startsOn: "2027-01-10",
          endsOn: "2027-03-15",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects event with end date before start", () => {
    const result = createAcademicCalendarVersionSchema.safeParse({
      name: "Calendar",
      academicYear: "2026",
      events: [
        {
          label: "Event",
          startsOn: "2026-07-20",
          endsOn: "2026-07-14",
          eventType: "break_day",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported event type", () => {
    const result = createAcademicCalendarVersionSchema.safeParse({
      name: "Calendar",
      academicYear: "2026",
      events: [{
        label: "Made-up event",
        startsOn: validIsoDate,
        endsOn: validIsoDate,
        eventType: "semester_start",
      }],
    });
    expect(result.success).toBe(false);
  });
});

describe("Course Activity Type Versions Replacement", () => {
  it("accepts valid activity type version IDs", () => {
    const result = replaceCourseActivityTypeVersionsSchema.safeParse({
      activityTypeVersionIds: [validUUID, validUUID2],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate activity type version IDs", () => {
    const result = replaceCourseActivityTypeVersionsSchema.safeParse({
      activityTypeVersionIds: [validUUID, validUUID],
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty activity type version array", () => {
    const result = replaceCourseActivityTypeVersionsSchema.safeParse({
      activityTypeVersionIds: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("B.3 Artifact Creation", () => {
  it("accepts artifact with Activity version parent", () => {
    const result = createArtifactSchema.safeParse({
      ...artifactFields,
      parentType: "activity_version",
      activityVersionId: validUUID2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts artifact with Term Activity revision parent", () => {
    const result = createArtifactSchema.safeParse({
      ...artifactFields,
      parentType: "term_activity_revision",
      termActivityRevisionId: validUUID2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects artifact with mismatched parent type", () => {
    const result = createArtifactSchema.safeParse({
      ...artifactFields,
      parentType: "activity_version",
      learningModuleVersionId: validUUID2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects artifact with two parents", () => {
    const result = createArtifactSchema.safeParse({
      ...artifactFields,
      parentType: "activity_version",
      activityVersionId: validUUID2,
      termActivityRevisionId: validUUID3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects artifact with no parent", () => {
    const result = createArtifactSchema.safeParse({
      ...artifactFields,
      parentType: "activity_version",
    });
    expect(result.success).toBe(false);
  });

  it("rejects artifact without a parentType", () => {
    const result = createArtifactSchema.safeParse({
      ...artifactFields,
      activityVersionId: validUUID2,
    });
    expect(result.success).toBe(false);
  });
});

describe("Learning Module Activities Membership", () => {
  it("accepts valid activities in upsertLearningModuleVersionSchema", () => {
    const result = upsertLearningModuleVersionSchema.safeParse({
      title: "Module",
      activities: [
        {
          activityVersionId: validUUID,
          sequence: 0,
        },
        {
          activityVersionId: validUUID2,
          sequence: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate activity sequences", () => {
    const result = upsertLearningModuleVersionSchema.safeParse({
      title: "Module",
      activities: [
        {
          activityVersionId: validUUID,
          sequence: 0,
        },
        {
          activityVersionId: validUUID2,
          sequence: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate activity version IDs", () => {
    const result = upsertLearningModuleVersionSchema.safeParse({
      title: "Module",
      activities: [
        {
          activityVersionId: validUUID,
          sequence: 0,
        },
        {
          activityVersionId: validUUID,
          sequence: 1,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative activity sequence", () => {
    const result = upsertLearningModuleVersionSchema.safeParse({
      title: "Module",
      activities: [
        {
          activityVersionId: validUUID,
          sequence: -1,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts activities in createLearningModuleSchema", () => {
    const result = createLearningModuleSchema.safeParse({
      stableCode: "mod-01",
      createdByInstructorId: validUUID,
      version: {
        title: "New Module",
        activities: [
          {
            activityVersionId: validUUID2,
            sequence: 0,
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate activities in createLearningModuleSchema", () => {
    const result = createLearningModuleSchema.safeParse({
      stableCode: "mod-02",
      createdByInstructorId: validUUID,
      version: {
        title: "Module",
        activities: [
          {
            activityVersionId: validUUID2,
            sequence: 0,
          },
          {
            activityVersionId: validUUID2,
            sequence: 1,
          },
        ],
      },
    });
    expect(result.success).toBe(false);
  });
});
