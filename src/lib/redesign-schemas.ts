// Zod request validators for the Lane A (domain + REST) redesign handlers.
// Shapes mirror the frozen types in `redesign-contract.ts`; this file only
// adds runtime validation, it does not redefine the contract.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)");
const isoDateTime = z.string().datetime();

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
    publish: z.boolean().optional(),
  }),
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
  publish: z.boolean().optional(),
});

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

// ─── Terms ──────────────────────────────────────────────

export const createTermSchema = z.object({
  courseId: z.string().uuid(),
  institutionId: z.string().uuid(),
  academicCalendarId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  meetingPattern: z.unknown().nullable().optional(),
});

export const updateTermSchema = z
  .object({
    academicCalendarId: z.string().uuid(),
    code: z.string().min(1),
    name: z.string().min(1),
    startDate: isoDate,
    endDate: isoDate,
    meetingPattern: z.unknown().nullable(),
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
  meetingPattern: z.unknown(),
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
    description: z.string().nullable(),
    format: z.string().nullable(),
    notes: z.string().nullable(),
    instructionalMode: instructionalModeEnum,
    archivedAt: z.string().nullable(),
  })
  .partial();

export const moveSessionSchema = z.object({
  date: isoDate.nullable().optional(),
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
