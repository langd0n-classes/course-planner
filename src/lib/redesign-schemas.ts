// Zod request validators for the Lane A (domain + REST) redesign handlers.
// Shapes mirror the frozen types in `redesign-contract.ts`; this file only
// adds runtime validation, it does not redefine the contract.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)");
const isoDateTime = z.string().datetime();
const localTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Expected local time in 24-hour HH:MM format");

// ─── Institutions / calendars / courses ─────────────────

export const createInstitutionSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1).nullable().optional(),
  canonicalUri: z.string().url().nullable().optional(),
});

export const createAcademicCalendarSchema = z.object({
  institutionId: z.string().uuid(),
  name: z.string().min(1),
  academicYear: z.string().min(1),
  sourceUri: z.string().url().nullable().optional(),
});

export const createCourseSchema = z.object({
  instructorId: z.string().uuid(),
  title: z.string().min(1),
  titleIsPlaceholder: z.boolean().optional(),
  number: z.string().min(1),
  numberIsPlaceholder: z.boolean().optional(),
  description: z.string().nullable().optional(),
  institutionIds: z.array(z.string().uuid()).optional(),
});

export const updateCourseSchema = z
  .object({
    title: z.string().min(1),
    titleIsPlaceholder: z.boolean(),
    number: z.string().min(1),
    numberIsPlaceholder: z.boolean(),
    description: z.string().nullable(),
    archivedAt: isoDateTime.nullable(),
  })
  .partial();

export const replaceCourseInstitutionsSchema = z.object({
  institutionIds: z.array(z.string().uuid()),
});

// ─── Curriculum identities / versions ───────────────────

export const createLearningModuleSchema = z.object({
  stableCode: z.string().min(1),
  createdByInstructorId: z.string().uuid(),
  version: z.object({
    expectedCurrentVersionId: z.string().uuid().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    studentDescription: z.string().nullable().optional(),
    learningObjectives: z.array(z.string()).optional(),
    notes: z.string().nullable().optional(),
    defaultSequence: z.number().int().nullable().optional(),
    changeSummary: z.string().nullable().optional(),
    topics: z.array(z.object({ topicVersionId: z.string().uuid(), sequence: z.number().int().min(0) })).optional(),
    activities: z.array(z.object({
      activityVersionId: z.string().uuid(),
      sequence: z.number().int().min(0),
      notes: z.string().nullable().optional(),
    })).optional(),
    publish: z.boolean().optional(),
  }).refine(
    (data) => {
      if (!data.activities) return true;
      const seqs = data.activities.map(a => a.sequence);
      const actIds = data.activities.map(a => a.activityVersionId);
      return new Set(seqs).size === seqs.length && new Set(actIds).size === actIds.length;
    },
    { message: "duplicate activityVersionId or sequence in activities" }
  ),
});

export const updateLearningModuleSchema = z
  .object({
    stableCode: z.string().min(1),
    archivedAt: isoDateTime.nullable(),
  })
  .partial();

export const upsertLearningModuleVersionSchema = z.object({
  expectedCurrentVersionId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  studentDescription: z.string().nullable().optional(),
  learningObjectives: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  defaultSequence: z.number().int().nullable().optional(),
  changeSummary: z.string().nullable().optional(),
  topics: z.array(z.object({ topicVersionId: z.string().uuid(), sequence: z.number().int().min(0) })).optional(),
  activities: z.array(z.object({
    activityVersionId: z.string().uuid(),
    sequence: z.number().int().min(0),
    notes: z.string().nullable().optional(),
  })).optional(),
  publish: z.boolean().optional(),
}).refine(
  (data) => {
    if (!data.activities) return true;
    const seqs = data.activities.map(a => a.sequence);
    const actIds = data.activities.map(a => a.activityVersionId);
    return new Set(seqs).size === seqs.length && new Set(actIds).size === actIds.length;
  },
  { message: "duplicate activityVersionId or sequence in activities" }
);

export const createTopicSchema = z.object({
  stableCode: z.string().min(1),
  learningModuleId: z.string().uuid().nullable().optional(),
  createdByInstructorId: z.string().uuid(),
  version: z.object({
    expectedCurrentVersionId: z.string().uuid().optional(),
    title: z.string().min(1),
    category: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    changeSummary: z.string().nullable().optional(),
    publish: z.boolean().optional(),
  }),
});

export const updateTopicSchema = z
  .object({
    stableCode: z.string().min(1),
    learningModuleId: z.string().uuid().nullable(),
    archivedAt: isoDateTime.nullable(),
  })
  .partial();

export const upsertTopicVersionSchema = z.object({
  expectedCurrentVersionId: z.string().uuid().optional(),
  title: z.string().min(1),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  changeSummary: z.string().nullable().optional(),
  publish: z.boolean().optional(),
});

export const replaceTopicPrerequisitesSchema = z.object({
  prerequisiteTopicIds: z.array(z.string().uuid()),
});

const meetingRolePatternSchema = z.object({
  roleKey: z.string().min(1),
  label: z.string().min(1),
  sessionType: z.enum(["lecture", "lab"]),
  days: z.array(z.string().min(1)).min(1),
});

export const meetingPatternSchema = z.object({
  roles: z.array(meetingRolePatternSchema).min(1),
});

// ─── Terms ──────────────────────────────────────────────

export const createTermSchema = z.object({
  mode: z.enum(["preview", "apply"]),
  courseId: z.string().uuid(),
  institutionId: z.string().uuid(),
  academicCalendarId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  meetingPattern: meetingPatternSchema,
});

export const updateTermSchema = z
  .object({
    academicCalendarId: z.string().uuid(),
    code: z.string().min(1),
    name: z.string().min(1),
    startDate: isoDate,
    endDate: isoDate,
    meetingPattern: meetingPatternSchema,
  })
  .partial();

export const termLifecycleTransitionSchema = z.object({
  transition: z.enum(["activate", "close", "reopen"]),
  expectedStatus: z.enum(["planned", "active", "closed"]),
  reason: z.string().nullable().optional(),
});

export const cloneTermSchema = z.object({
  mode: z.enum(["preview", "apply"]),
  code: z.string().min(1),
  name: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  institutionId: z.string().uuid(),
  academicCalendarId: z.string().uuid(),
  meetingPattern: meetingPatternSchema,
  learningModuleVersionSelections: z
    .array(
      z.object({
        termLearningModuleId: z.string().uuid(),
        plannedLearningModuleVersionId: z.string().uuid(),
      }),
    )
    .optional(),
});

// ─── Calendar slots ─────────────────────────────────────

export const updateCalendarSlotCapacitySchema = z.object({
  instructionalCapacity: z.enum(["normal", "reduced_engagement", "recovery", "assessment_period"]),
  capacitySource: z.enum(["baseline", "heuristic", "instructor_override"]),
  capacityReason: z.string().nullable().optional(),
});

// ─── Term Learning Modules (offerings) ─────────────────

export const adoptTermLearningModuleSchema = z.object({
  learningModuleId: z.string().uuid(),
  learningModuleVersionId: z.string().uuid(),
  sequence: z.number().int().min(0),
  notes: z.string().nullable().optional(),
});

export const updateTermLearningModuleSchema = z.object({
  sequence: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

const topicSnapshotSchema = z.object({
  topicVersionId: z.string().uuid(),
  sequence: z.number().int().min(0),
});

export const createDeliveredRevisionSchema = z.object({
  expectedDeliveredLearningModuleVersionId: z.string().uuid().nullable(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  studentDescription: z.string().nullable().optional(),
  learningObjectives: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  defaultSequence: z.number().int().nullable().optional(),
  changeSummary: z.string().nullable().optional(),
  topics: z.array(topicSnapshotSchema).optional(),
});

// ─── Sessions ───────────────────────────────────────────

const instructionalModeEnum = z.enum(["standard", "recovery", "review", "buffer", "assessment", "other"]);

export const createSessionSchema = z.object({
  termLearningModuleId: z.string().uuid().nullable().optional(),
  sequence: z.number().int().min(0),
  sessionType: z.enum(["lecture", "lab"]),
  code: z.string().min(1),
  title: z.string().min(1),
  date: isoDate.nullable().optional(),
  scheduleOverrideLabel: z.string().min(1).nullable().optional(),
  description: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  instructionalMode: instructionalModeEnum.optional(),
});

export const updateSessionSchema = z
  .object({
    termLearningModuleId: z.string().uuid().nullable(),
    sequence: z.number().int().min(0),
    sessionType: z.enum(["lecture", "lab"]),
    code: z.string().min(1),
    title: z.string().min(1),
    date: isoDate.nullable(),
    scheduleOverrideLabel: z.string().min(1).nullable(),
    description: z.string().nullable(),
    format: z.string().nullable(),
    notes: z.string().nullable(),
    instructionalMode: instructionalModeEnum,
    archivedAt: z.string().nullable(),
  })
  .partial();

export const moveSessionSchema = z.object({
  date: isoDate.nullable().optional(),
  scheduleOverrideLabel: z.string().min(1).nullable().optional(),
  termLearningModuleId: z.string().uuid().nullable().optional(),
  sequence: z.number().int().min(0).optional(),
});

export const cancelSessionRedistributionSchema = z.object({
  topicVersionId: z.string().uuid(),
  level: z.enum(["introduced", "practiced", "assessed"]),
  targetSessionId: z.string().uuid(),
});

export const cancelSessionSchema = z.object({
  reason: z.string().nullable().optional(),
  redistributions: z.array(cancelSessionRedistributionSchema).optional().default([]),
  dryRun: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
});

// ─── Coverage ───────────────────────────────────────────

export const createCoverageSchema = z.object({
  topicVersionId: z.string().uuid(),
  level: z.enum(["introduced", "practiced", "assessed"]),
  notes: z.string().nullable().optional(),
});

export const updateCoverageSchema = z
  .object({
    level: z.enum(["introduced", "practiced", "assessed"]),
    notes: z.string().nullable(),
  })
  .partial();

// ─── Assessments ────────────────────────────────────────

export const createAssessmentSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  assessmentType: z.string().min(1),
  description: z.string().nullable().optional(),
  studentInstructions: z.string().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  rubric: z.unknown().nullable().optional(),
  progressionStage: z.string().nullable().optional(),
  topicVersionIds: z.array(z.string().uuid()).optional(),
});

export const updateAssessmentSchema = createAssessmentSchema.partial();

// ─── Academic Calendar Versions ─────────────────────────

export const createAcademicCalendarVersionEventSchema = z.object({
  eventType: z.enum([
    "term_start",
    "term_end",
    "holiday",
    "break_day",
    "reading_day",
    "finals_start",
    "finals_end",
    "other",
  ]),
  startsOn: isoDate,
  endsOn: isoDate,
  label: z.string().min(1),
  sourceUri: z.string().url().nullable().optional(),
}).refine(
  (data) => data.endsOn >= data.startsOn,
  { message: "endsOn must not precede startsOn" }
);

export const createAcademicCalendarVersionPeriodSchema = z.object({
  kind: z.enum(["instructional", "no_instruction", "special_schedule"]),
  label: z.string().min(1),
  startsOn: isoDate,
  endsOn: isoDate,
}).refine(
  (data) => data.endsOn >= data.startsOn,
  { message: "endsOn must not precede startsOn" }
);

export const createAcademicCalendarVersionSchema = z.object({
  name: z.string().min(1),
  academicYear: z.string().min(1),
  sourceUri: z.string().url().nullable().optional(),
  events: z.array(createAcademicCalendarVersionEventSchema).optional(),
  periods: z.array(createAcademicCalendarVersionPeriodSchema).optional(),
});

export const replaceCourseActivityTypeVersionsSchema = z.object({
  activityTypeVersionIds: z.array(z.string().uuid()),
}).refine(
  (data) => {
    return new Set(data.activityTypeVersionIds).size === data.activityTypeVersionIds.length;
  },
  { message: "duplicate activityTypeVersionId in replacements" }
);

// ─── B.3 Artifact ───────────────────────────────────────

export const createArtifactSchema = z.object({
  parentType: z.enum([
    "learning_module_version",
    "topic_version",
    "session",
    "assessment",
    "activity_version",
    "term_activity_revision",
  ]),
  learningModuleVersionId: z.string().uuid().nullable(),
  topicVersionId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  assessmentId: z.string().uuid().nullable(),
  activityVersionId: z.string().uuid().nullable(),
  termActivityRevisionId: z.string().uuid().nullable(),
  artifactType: z.enum([
    "notebook",
    "handout",
    "slides",
    "instructions",
    "dataset",
    "reading",
    "video",
    "link",
    "ta_key",
    "other",
  ]),
  sourceType: z.enum(["external_uri", "uploaded_file", "generated_file"]),
  title: z.string().min(1),
  uri: z.string().min(1),
  filename: z.string().nullable(),
  mimeType: z.string().nullable(),
  generatorKey: z.string().nullable().optional(),
  generatedAt: isoDateTime.nullable().optional(),
  metadata: z.unknown().nullable().optional(),
}).refine(
  (data) => {
    const parents = {
      learning_module_version: data.learningModuleVersionId,
      topic_version: data.topicVersionId,
      session: data.sessionId,
      assessment: data.assessmentId,
      activity_version: data.activityVersionId,
      term_activity_revision: data.termActivityRevisionId,
    };
    const populated = Object.values(parents).filter((id) => id !== null);
    return populated.length === 1 && parents[data.parentType] !== null;
  },
  { message: "exactly one parent pointer must be specified and match parentType" },
);

// ─── B.3 Activity types ─────────────────────────────────────

export const upsertActivityTypeVersionSchema = z.object({
  expectedCurrentVersionId: z.string().uuid().optional(),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  changeSummary: z.string().nullable().optional(),
  publish: z.boolean().optional(),
});

export const createActivityTypeSchema = z.object({
  behaviorFamily: z.enum(["meeting", "coursework", "assessment"]),
  createdByInstructorId: z.string().uuid(),
  version: upsertActivityTypeVersionSchema,
});

// archivedAt is required (not optional): PATCH may only change archivedAt,
// so an empty patch body must fail validation rather than silently no-op.
export const updateActivityTypeSchema = z.object({
  archivedAt: isoDateTime.nullable(),
});

// ─── B.3 Activities ─────────────────────────────────────

const meetingActivityDetailSchema = z.object({
  behaviorFamily: z.literal("meeting"),
  defaultDurationMinutes: z.number().int().min(0).nullable().optional(),
  modality: z.string().nullable().optional(),
  preparationNotes: z.string().nullable().optional(),
  authoringNotes: z.string().nullable().optional(),
}).strict();

const courseworkActivityDetailSchema = z.object({
  behaviorFamily: z.literal("coursework"),
  submissionPolicy: z.string().nullable().optional(),
  releasePolicy: z.string().nullable().optional(),
  authoringNotes: z.string().nullable().optional(),
}).strict();

const assessmentActivityDetailSchema = z.object({
  behaviorFamily: z.literal("assessment"),
  modality: z.string().nullable().optional(),
  authoringNotes: z.string().nullable().optional(),
}).strict();

export const activityDetailSchema = z.discriminatedUnion("behaviorFamily", [
  meetingActivityDetailSchema,
  courseworkActivityDetailSchema,
  assessmentActivityDetailSchema,
]);

export const upsertMilestoneTemplateSchema = z.object({
  sequence: z.number().int().min(0),
  role: z.enum(["release", "work", "phase_release", "review", "due"]),
  label: z.string().min(1),
  linkedActivityId: z.string().uuid().nullable().optional(),
  relativeDays: z.number().int().nullable().optional(),
  defaultTime: z.string().nullable().optional(),
  timeZone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  provenance: z.unknown().nullable().optional(),
});

export const upsertActivityVersionSchema = z.object({
  expectedCurrentVersionId: z.string().uuid().optional(),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  activityTypeVersionId: z.string().uuid(),
  changeSummary: z.string().nullable().optional(),
  publish: z.boolean().optional(),
  detail: activityDetailSchema,
  milestoneTemplates: z.array(upsertMilestoneTemplateSchema).optional(),
});

export const createActivitySchema = z.object({
  stableCode: z.string().min(1),
  createdByInstructorId: z.string().uuid(),
  version: upsertActivityVersionSchema,
});

export const updateActivitySchema = z.object({
  stableCode: z.string().min(1).optional(),
  archivedAt: isoDateTime.nullable().optional(),
});

export const replaceMilestoneTemplatesSchema = z.object({
  templates: z.array(upsertMilestoneTemplateSchema),
});

export const replaceActivityLmScopeSchema = z.object({
  scopes: z.array(
    z.object({
      learningModuleId: z.string().uuid(),
      emphasis: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
  ),
}).refine(
  (data) => {
    const ids = data.scopes.map(s => s.learningModuleId);
    return new Set(ids).size === ids.length;
  },
  { message: "duplicate learningModuleId in scopes" }
);

export const replaceActivityTopicActionsSchema = z.object({
  actions: z.array(
    z.object({
      topicVersionId: z.string().uuid(),
      action: z.enum(["introduced", "practiced", "assessed"]),
      notes: z.string().nullable().optional(),
      provenance: z.unknown().nullable().optional(),
    })
  ),
}).refine(
  (data) => {
    const pairs = data.actions.map(a => `${a.topicVersionId}:${a.action}`);
    return new Set(pairs).size === pairs.length;
  },
  { message: "duplicate topicVersionId/action pair in actions" }
);

export const replaceActivityTopicScopeSchema = z.object({
  scopes: z.array(
    z.object({
      topicId: z.string().uuid(),
      notes: z.string().nullable().optional(),
      provenance: z.unknown().nullable().optional(),
    })
  ),
}).refine(
  (data) => {
    const ids = data.scopes.map(s => s.topicId);
    return new Set(ids).size === ids.length;
  },
  { message: "duplicate topicId in scopes" }
);

// ─── B.3 Term activities ────────────────────────────────

export const termActivityAdoptionSelectionSchema = z.object({
  activityId: z.string().uuid(),
  activityVersionId: z.string().uuid(),
  termLearningModuleId: z.string().uuid().nullable().optional(),
});

export const termAdoptionPreviewRequestSchema = z.object({
  learningModuleVersionSelections: z.array(
    z.object({
      termLearningModuleId: z.string().uuid(),
      learningModuleVersionId: z.string().uuid(),
    })
  ),
  crossCuttingSelections: z.array(termActivityAdoptionSelectionSchema),
});

export const termAdoptionApplyRequestSchema = termAdoptionPreviewRequestSchema.extend({
  previewToken: z.string().min(1),
  expectedCurrentActivityCount: z.number().int().min(0),
});

const meetingRevisionDetailSchema = z.object({
  behaviorFamily: z.literal("meeting"),
  calendarSlotId: z.string().uuid().nullable().optional(),
  startsAt: isoDateTime.nullable().optional(),
  endsAt: isoDateTime.nullable().optional(),
  status: z.string().nullable().optional(),
  modality: z.string().nullable().optional(),
  overrideReason: z.string().nullable().optional(),
  overrideEvidence: z.unknown().nullable().optional(),
}).strict();

const courseworkRevisionDetailSchema = z.object({
  behaviorFamily: z.literal("coursework"),
  lifecycleState: z.string().nullable().optional(),
  deliveryNotes: z.string().nullable().optional(),
}).strict();

const assessmentRevisionDetailSchema = z.object({
  behaviorFamily: z.literal("assessment"),
  lifecycleState: z.string().nullable().optional(),
  modality: z.string().nullable().optional(),
  deliveryNotes: z.string().nullable().optional(),
}).strict();

export const termActivityRevisionDetailSchema = z.discriminatedUnion("behaviorFamily", [
  meetingRevisionDetailSchema,
  courseworkRevisionDetailSchema,
  assessmentRevisionDetailSchema,
]);

export const upsertTermActivityMilestoneSchema = z.object({
  sourceTemplateId: z.string().uuid().nullable().optional(),
  role: z.enum(["release", "work", "phase_release", "review", "due"]),
  label: z.string().min(1),
  linkedTermActivityId: z.string().uuid().nullable().optional(),
  occursAt: isoDateTime.nullable().optional(),
  timeZone: z.string().nullable().optional(),
  anchorPolicy: z.enum(["follow_activity", "fixed_instant", "standalone"]),
  notes: z.string().nullable().optional(),
  provenance: z.unknown().nullable().optional(),
}).refine(
  (data) => {
    if (data.anchorPolicy === "standalone") {
      return data.linkedTermActivityId === null || data.linkedTermActivityId === undefined;
    }
    return true;
  },
  { message: "standalone anchors must not have a linkedTermActivityId" }
).refine(
  (data) => {
    if (data.anchorPolicy === "follow_activity") {
      return data.linkedTermActivityId !== null && data.linkedTermActivityId !== undefined;
    }
    return true;
  },
  { message: "follow_activity anchors require a linkedTermActivityId" }
).refine(
  (data) => {
    if (data.anchorPolicy === "standalone") {
      return data.occursAt !== null && data.occursAt !== undefined;
    }
    return true;
  },
  { message: "standalone anchors require an occursAt instant" }
).refine(
  (data) => {
    if (data.anchorPolicy === "fixed_instant") {
      return data.occursAt !== null && data.occursAt !== undefined;
    }
    return true;
  },
  { message: "fixed_instant anchors require an occursAt instant" }
);

export const termActivityRevisionPreviewRequestSchema = z.object({
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  changeReason: z.string().nullable().optional(),
  detail: termActivityRevisionDetailSchema,
  topicActions: z.array(
    z.object({
      topicVersionId: z.string().uuid(),
      action: z.enum(["introduced", "practiced", "assessed"]),
      notes: z.string().nullable().optional(),
      provenance: z.unknown().nullable().optional(),
    })
  ).optional(),
  milestones: z.array(upsertTermActivityMilestoneSchema).optional(),
}).refine(
  (data) => {
    if (!data.topicActions) return true;
    const pairs = data.topicActions.map(a => `${a.topicVersionId}:${a.action}`);
    return new Set(pairs).size === pairs.length;
  },
  { message: "duplicate topicVersionId/action pair in topicActions" }
);

export const termActivityRevisionApplyRequestSchema = termActivityRevisionPreviewRequestSchema.extend({
  previewToken: z.string().min(1),
  expectedCurrentRevisionId: z.string().uuid().nullable().optional(),
  advancePointer: z.enum(["planned", "delivered"]),
});

export const promoteDeliveryPreviewRequestSchema = z.object({
  termActivityIds: z.array(z.string().uuid()),
});

export const promoteDeliveryApplyRequestSchema = z.object({
  previewToken: z.string().min(1),
  expectedCurrentActivityVersionIds: z.array(
    z.object({
      activityId: z.string().uuid(),
      activityVersionId: z.string().uuid(),
    })
  ),
  termActivityIds: z.array(z.string().uuid()),
});

// ─── Term calendar exceptions ───────────────────────────

const termCalendarExceptionFields = z.object({
  action: z.enum(["cancel", "add", "replace", "modify"]),
  activityTypeVersionId: z.string().uuid().nullable().optional(),
  calendarSlotId: z.string().uuid().nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  startsAt: isoDateTime.nullable().optional(),
  endsAt: isoDateTime.nullable().optional(),
  label: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  provenance: z.unknown().nullable().optional(),
});

export const createTermCalendarExceptionSchema = termCalendarExceptionFields.refine(
  (data) => {
    const hasTarget = data.calendarSlotId || data.targetDate || data.startsAt;
    return hasTarget;
  },
  { message: "must specify a target via calendarSlotId, targetDate, or startsAt" }
).refine(
  (data) => {
    if (data.action === "add") {
      return (data.startsAt !== null && data.startsAt !== undefined) &&
             (data.activityTypeVersionId !== null && data.activityTypeVersionId !== undefined);
    }
    return true;
  },
  { message: "add action requires startsAt and activityTypeVersionId" }
).refine(
  (data) => {
    if (data.action === "replace") {
      const hasSlot = data.calendarSlotId !== null && data.calendarSlotId !== undefined;
      const hasTiming = (data.targetDate !== null && data.targetDate !== undefined) ||
                        (data.startsAt !== null && data.startsAt !== undefined);
      return hasSlot && hasTiming;
    }
    return true;
  },
  { message: "replace action requires calendarSlotId and either targetDate or startsAt" }
);

export const updateTermCalendarExceptionSchema = termCalendarExceptionFields.partial().refine(
  (data) => {
    return Object.keys(data).length > 0;
  },
  { message: "update must include at least one field" }
);

// ─── Term meeting patterns and calendar ──────────────────

export const upsertTermMeetingPatternSchema = z.object({
  activityTypeVersionId: z.string().uuid(),
  label: z.string().nullable().optional(),
  daysOfWeek: z.array(z.string().min(1)).min(1),
  startTimeLocal: localTime,
  endTimeLocal: localTime.nullable().optional(),
  timeZone: z.string().min(1),
  startsOn: isoDate,
  endsOn: isoDate,
}).refine(
  (data) => {
    return data.endsOn >= data.startsOn;
  },
  { message: "endsOn date must not precede startsOn date" }
);

export const termCalendarPreviewRequestSchema = z.object({
  meetingPatterns: z.array(upsertTermMeetingPatternSchema),
});

export const termCalendarApplyRequestSchema = z.object({
  previewToken: z.string().min(1),
  expectedCurrentCalendarSlotCount: z.number().int().min(0),
  meetingPatterns: z.array(upsertTermMeetingPatternSchema),
});
