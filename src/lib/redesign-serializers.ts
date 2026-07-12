// Prisma row -> frozen-contract DTO mappers for the Lane A (domain + REST)
// redesign handlers. Keeping these in one place means every route produces
// byte-identical shapes for the same underlying row.
import type {
  AssessmentDto,
  CalendarSlotDto,
  CoverageDto,
  LearningModuleVersionDto,
  SessionDto,
  TermDto,
  TermLearningModuleDto,
} from "./redesign-contract";

type TermRow = {
  id: string;
  courseId: string;
  institutionId: string;
  academicCalendarId: string;
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  meetingPattern: unknown | null;
  status: "planned" | "active" | "closed";
  closedAt: Date | null;
  clonedFromId: string | null;
  archivedAt: Date | null;
};

type CalendarSlotRow = {
  id: string;
  termId: string;
  academicCalendarEventId: string | null;
  date: Date;
  slotType: "class_day" | "holiday" | "finals" | "break_day";
  label: string | null;
  source: string | null;
  instructionalCapacity: "normal" | "reduced_engagement" | "recovery" | "assessment_period";
  capacitySource: "baseline" | "heuristic" | "instructor_override";
  capacityReason: string | null;
};

type TermLearningModuleRow = {
  id: string;
  termId: string;
  courseId: string;
  learningModuleId: string;
  learningModuleVersionId: string;
  deliveredLearningModuleVersionId: string | null;
  sequence: number;
  notes: string | null;
};

type LearningModuleVersionTopicRow = {
  topicVersionId: string;
  sequence: number;
};

type LearningModuleVersionRow = {
  id: string;
  learningModuleId: string;
  revision: number;
  title: string;
  description: string | null;
  studentDescription: string | null;
  learningObjectives: string[];
  notes: string | null;
  defaultSequence: number | null;
  changeSummary: string | null;
  publishedAt: Date | null;
  topics?: LearningModuleVersionTopicRow[];
};

type SessionRow = {
  id: string;
  termId: string;
  termLearningModuleId: string | null;
  sequence: number;
  sessionType: "lecture" | "lab";
  code: string;
  title: string;
  date: Date | null;
  description: string | null;
  format: string | null;
  notes: string | null;
  status: "scheduled" | "canceled" | "moved";
  instructionalMode: "standard" | "recovery" | "review" | "buffer" | "assessment" | "other";
  canceledAt: Date | null;
  canceledReason: string | null;
  archivedAt: Date | null;
};

type CoverageRow = {
  id: string;
  sessionId: string;
  topicVersionId: string;
  level: "introduced" | "practiced" | "assessed";
  notes: string | null;
  redistributedFrom: string | null;
  redistributedAt: Date | null;
};

type AssessmentTopicRow = {
  topicVersionId: string;
};

type AssessmentRow = {
  id: string;
  termId: string;
  code: string;
  title: string;
  assessmentType: string;
  description: string | null;
  studentInstructions: string | null;
  sessionId: string | null;
  dueDate: Date | null;
  rubric: unknown | null;
  progressionStage: string | null;
  archivedAt: Date | null;
  topics?: AssessmentTopicRow[];
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toIsoDateNullable(value: Date | null): string | null {
  return value ? toIsoDate(value) : null;
}

function toIsoDateTimeNullable(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toTermDto(term: TermRow): TermDto {
  return {
    id: term.id,
    courseId: term.courseId,
    institutionId: term.institutionId,
    academicCalendarId: term.academicCalendarId,
    code: term.code,
    name: term.name,
    startDate: toIsoDate(term.startDate),
    endDate: toIsoDate(term.endDate),
    meetingPattern: term.meetingPattern,
    status: term.status,
    closedAt: toIsoDateTimeNullable(term.closedAt),
    clonedFromId: term.clonedFromId,
    archivedAt: toIsoDateTimeNullable(term.archivedAt),
  };
}

export function toCalendarSlotDto(slot: CalendarSlotRow): CalendarSlotDto {
  return {
    id: slot.id,
    termId: slot.termId,
    academicCalendarEventId: slot.academicCalendarEventId,
    date: toIsoDate(slot.date),
    slotType: slot.slotType,
    label: slot.label,
    source: slot.source,
    instructionalCapacity: slot.instructionalCapacity,
    capacitySource: slot.capacitySource,
    capacityReason: slot.capacityReason,
  };
}

export function toTermLearningModuleDto(tlm: TermLearningModuleRow): TermLearningModuleDto {
  return {
    id: tlm.id,
    termId: tlm.termId,
    courseId: tlm.courseId,
    learningModuleId: tlm.learningModuleId,
    learningModuleVersionId: tlm.learningModuleVersionId,
    deliveredLearningModuleVersionId: tlm.deliveredLearningModuleVersionId,
    sequence: tlm.sequence,
    notes: tlm.notes,
  };
}

export function toLearningModuleVersionDto(
  version: LearningModuleVersionRow,
): LearningModuleVersionDto {
  return {
    id: version.id,
    learningModuleId: version.learningModuleId,
    revision: version.revision,
    title: version.title,
    description: version.description,
    studentDescription: version.studentDescription,
    learningObjectives: version.learningObjectives,
    notes: version.notes,
    defaultSequence: version.defaultSequence,
    changeSummary: version.changeSummary,
    publishedAt: toIsoDateTimeNullable(version.publishedAt),
    topics: (version.topics ?? []).map((topic) => ({
      topicVersionId: topic.topicVersionId,
      sequence: topic.sequence,
    })),
  };
}

export function toSessionDto(session: SessionRow): SessionDto {
  return {
    id: session.id,
    termId: session.termId,
    termLearningModuleId: session.termLearningModuleId,
    sequence: session.sequence,
    sessionType: session.sessionType,
    code: session.code,
    title: session.title,
    date: toIsoDateNullable(session.date),
    description: session.description,
    format: session.format,
    notes: session.notes,
    status: session.status,
    instructionalMode: session.instructionalMode,
    canceledAt: toIsoDateTimeNullable(session.canceledAt),
    canceledReason: session.canceledReason,
    archivedAt: toIsoDateTimeNullable(session.archivedAt),
  };
}

export function toCoverageDto(coverage: CoverageRow): CoverageDto {
  return {
    id: coverage.id,
    sessionId: coverage.sessionId,
    topicVersionId: coverage.topicVersionId,
    level: coverage.level,
    notes: coverage.notes,
    redistributedFrom: coverage.redistributedFrom,
    redistributedAt: toIsoDateTimeNullable(coverage.redistributedAt),
  };
}

export function toAssessmentDto(
  assessment: AssessmentRow,
): AssessmentDto {
  return {
    id: assessment.id,
    termId: assessment.termId,
    code: assessment.code,
    title: assessment.title,
    assessmentType: assessment.assessmentType,
    description: assessment.description,
    studentInstructions: assessment.studentInstructions,
    sessionId: assessment.sessionId,
    dueDate: toIsoDateNullable(assessment.dueDate),
    rubric: assessment.rubric,
    progressionStage: assessment.progressionStage,
    topicVersionIds: (assessment.topics ?? []).map((t) => t.topicVersionId),
    archivedAt: toIsoDateTimeNullable(assessment.archivedAt),
  };
}
