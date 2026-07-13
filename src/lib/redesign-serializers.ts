// Prisma row -> frozen-contract DTO mappers for the Lane A (domain + REST)
// redesign handlers. Keeping these in one place means every route produces
// byte-identical shapes for the same underlying row.
import type {
  AcademicCalendarDto,
  AssessmentDto,
  CalendarSlotDto,
  CoverageDto,
  CourseDto,
  InstitutionDto,
  LearningModuleDto,
  LearningModuleVersionDto,
  SessionDto,
  TermDto,
  TermLearningModuleDto,
  TopicDto,
  TopicPrerequisiteDto,
  TopicVersionDto,
} from "./redesign-contract";

type InstitutionRow = {
  id: string;
  name: string;
  shortName: string | null;
  canonicalUri: string | null;
  archivedAt: Date | null;
};

type AcademicCalendarRow = {
  id: string;
  institutionId: string;
  name: string;
  academicYear: string;
  version: number;
  sourceUri: string | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
};

type CourseRow = {
  id: string;
  instructorId: string;
  shortId: string;
  title: string;
  titleIsPlaceholder: boolean;
  number: string;
  numberIsPlaceholder: boolean;
  description: string | null;
  archivedAt: Date | null;
};

type LearningModuleRow = {
  id: string;
  courseId: string;
  stableCode: string;
  currentVersionId: string | null;
  archivedAt: Date | null;
};

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

type TopicRow = {
  id: string;
  courseId: string;
  learningModuleId: string | null;
  stableCode: string;
  currentVersionId: string | null;
  archivedAt: Date | null;
};

type TopicVersionRow = {
  id: string;
  topicId: string;
  revision: number;
  title: string;
  category: string | null;
  description: string | null;
  changeSummary: string | null;
  publishedAt: Date | null;
};

type TopicPrerequisiteRow = {
  topicId: string;
  prerequisiteTopicId: string;
};

type SessionRow = {
  id: string;
  termId: string;
  termLearningModuleId: string | null;
  calendarSlotId: string | null;
  sequence: number;
  sessionType: "lecture" | "lab";
  code: string;
  title: string;
  date: Date | null;
  scheduleOverrideLabel: string | null;
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

export function toInstitutionDto(institution: InstitutionRow): InstitutionDto {
  return {
    id: institution.id,
    name: institution.name,
    shortName: institution.shortName,
    canonicalUri: institution.canonicalUri,
    archivedAt: toIsoDateTimeNullable(institution.archivedAt),
  };
}

export function toAcademicCalendarDto(calendar: AcademicCalendarRow): AcademicCalendarDto {
  return {
    id: calendar.id,
    institutionId: calendar.institutionId,
    name: calendar.name,
    academicYear: calendar.academicYear,
    version: calendar.version,
    sourceUri: calendar.sourceUri,
    publishedAt: toIsoDateTimeNullable(calendar.publishedAt),
    archivedAt: toIsoDateTimeNullable(calendar.archivedAt),
  };
}

export function toCourseDto(course: CourseRow): CourseDto {
  return {
    id: course.id,
    instructorId: course.instructorId,
    shortId: course.shortId,
    title: course.title,
    titleIsPlaceholder: course.titleIsPlaceholder,
    number: course.number,
    numberIsPlaceholder: course.numberIsPlaceholder,
    description: course.description,
    archivedAt: toIsoDateTimeNullable(course.archivedAt),
  };
}

export function toLearningModuleDto(module: LearningModuleRow) {
  return {
    id: module.id,
    courseId: module.courseId,
    stableCode: module.stableCode,
    currentVersionId: module.currentVersionId,
    archivedAt: toIsoDateTimeNullable(module.archivedAt),
  } satisfies LearningModuleDto;
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

export function toTopicDto(topic: TopicRow): TopicDto {
  return {
    id: topic.id,
    courseId: topic.courseId,
    learningModuleId: topic.learningModuleId,
    stableCode: topic.stableCode,
    currentVersionId: topic.currentVersionId,
    archivedAt: toIsoDateTimeNullable(topic.archivedAt),
  };
}

export function toTopicVersionDto(version: TopicVersionRow): TopicVersionDto {
  return {
    id: version.id,
    topicId: version.topicId,
    revision: version.revision,
    title: version.title,
    category: version.category,
    description: version.description,
    changeSummary: version.changeSummary,
    publishedAt: toIsoDateTimeNullable(version.publishedAt),
  };
}

export function toTopicPrerequisiteDto(prerequisite: TopicPrerequisiteRow): TopicPrerequisiteDto {
  return {
    topicId: prerequisite.topicId,
    prerequisiteTopicId: prerequisite.prerequisiteTopicId,
  };
}

export function toSessionDto(session: SessionRow): SessionDto {
  return {
    id: session.id,
    termId: session.termId,
    termLearningModuleId: session.termLearningModuleId,
    calendarSlotId: session.calendarSlotId,
    sequence: session.sequence,
    sessionType: session.sessionType,
    code: session.code,
    title: session.title,
    date: toIsoDateNullable(session.date),
    scheduleOverrideLabel: session.scheduleOverrideLabel,
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
