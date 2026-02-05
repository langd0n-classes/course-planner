import { z } from "zod";

// ─── Instructors ────────────────────────────────────────

export const createInstructorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// ─── Terms ──────────────────────────────────────────────

export const createTermSchema = z.object({
  instructorId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  startDate: z.string(), // ISO date
  endDate: z.string(),
  courseCode: z.string().min(1),
  meetingPattern: z.any().optional(),
  holidays: z.any().optional(),
});

export const updateTermSchema = createTermSchema.partial();

// ─── Modules ────────────────────────────────────────────

export const createModuleSchema = z.object({
  termId: z.string().uuid(),
  sequence: z.number().int().min(0),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  learningObjectives: z.array(z.string()).optional().default([]),
});

export const updateModuleSchema = createModuleSchema.partial();

// ─── Skills ─────────────────────────────────────────────

export const createSkillSchema = z.object({
  code: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  prerequisites: z.array(z.string().uuid()).optional().default([]),
  isGlobal: z.boolean().optional().default(true),
  termId: z.string().uuid().nullable().optional(),
});

export const updateSkillSchema = createSkillSchema.partial();

// ─── Sessions ───────────────────────────────────────────

export const createSessionSchema = z.object({
  moduleId: z.string().uuid(),
  sequence: z.number().int().min(0),
  sessionType: z.enum(["lecture", "lab"]),
  code: z.string().min(1),
  title: z.string().min(1),
  date: z.string().nullable().optional(),
  description: z.string().optional(),
  format: z.string().optional(),
  priorArt: z.array(z.string().uuid()).optional().default([]),
  notes: z.string().optional(),
});

export const updateSessionSchema = createSessionSchema.partial();

export const moveSessionSchema = z.object({
  date: z.string().nullable().optional(),
  moduleId: z.string().uuid().optional(),
  sequence: z.number().int().min(0).optional(),
});

// ─── Coverage ───────────────────────────────────────────

export const createCoverageSchema = z.object({
  sessionId: z.string().uuid(),
  skillId: z.string().uuid(),
  level: z.enum(["introduced", "practiced", "assessed"]),
  notes: z.string().optional(),
});

export const updateCoverageSchema = z.object({
  level: z.enum(["introduced", "practiced", "assessed"]).optional(),
  notes: z.string().optional(),
});

// ─── Assessments ────────────────────────────────────────

export const createAssessmentSchema = z.object({
  termId: z.string().uuid(),
  code: z.string().min(1),
  title: z.string().min(1),
  assessmentType: z.enum(["gaie", "assignment", "exam", "project"]),
  description: z.string().optional(),
  skillIds: z.array(z.string().uuid()).optional().default([]),
  sessionId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  rubric: z.any().optional(),
  progressionStage: z.string().nullable().optional(),
});

export const updateAssessmentSchema = createAssessmentSchema.partial();

// ─── Artifacts ──────────────────────────────────────────

export const createArtifactSchema = z.object({
  parentType: z.enum(["session", "assessment", "module"]),
  sessionId: z.string().uuid().nullable().optional(),
  assessmentId: z.string().uuid().nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  artifactType: z.enum(["notebook", "handout", "slides", "ta_key", "other"]),
  filename: z.string().min(1),
  template: z.string().optional(),
  metadata: z.any().optional(),
});

export const updateArtifactSchema = createArtifactSchema.partial();
