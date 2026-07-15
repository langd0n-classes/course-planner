// Prisma row -> frozen-contract DTO mappers for the Lane A (domain + REST)
// redesign handlers. Keeping these in one place means every route produces
// byte-identical shapes for the same underlying row.
import type {
  AcademicCalendarDto,
  AcademicCalendarEventDto,
  AcademicCalendarPeriodDto,
  AcademicCalendarVersionDto,
  ActivityBehaviorFamily,
  ActivityDetailDto,
  ActivityDto,
  ActivityTopicActionSiblingDto,
  ActivityTopicScopeDto,
  ActivityTypeDto,
  ActivityTypeVersionDto,
  ActivityVersionDto,
  ActivityVersionLearningModuleScopeDto,
  ActivityVersionMilestoneTemplateDto,
  ActivityVersionTopicActionDto,
  ActivityVersionTopicActionWithSiblingsDto,
  AssessmentDto,
  CalendarSlotDto,
  CalendarSlotCandidateDto,
  CalendarMaterializationConflictDto,
  CourseActivityTypeVersionDto,
  CoverageDto,
  CoverageLevel,
  CourseDto,
  InstitutionDto,
  LearningModuleDto,
  LearningModuleVersionDto,
  MilestoneRole,
  SessionDto,
  TermDto,
  TermCalendarExceptionDto,
  TermCalendarSlotProvenanceDto,
  TermMeetingPatternDto,
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

type AcademicCalendarVersionRow = {
  id: string;
  academicCalendarId: string;
  version: number;
  name: string;
  academicYear: string;
  sourceUri: string | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
};

type AcademicCalendarEventRow = {
  id: string;
  academicCalendarId: string;
  academicCalendarVersionId: string | null;
  eventType: "term_start" | "term_end" | "holiday" | "break_day" | "reading_day" | "finals_start" | "finals_end" | "other";
  startsOn: Date;
  endsOn: Date;
  label: string;
  sourceUri: string | null;
};

type AcademicCalendarPeriodRow = {
  id: string;
  academicCalendarVersionId: string;
  kind: "instructional" | "no_instruction" | "special_schedule";
  label: string;
  startsOn: Date;
  endsOn: Date;
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

type TermMeetingPatternRow = {
  id: string;
  termId: string;
  activityTypeVersionId: string;
  label: string | null;
  daysOfWeek: string[];
  startTimeLocal: string;
  endTimeLocal: string | null;
  timeZone: string;
  startsOn: Date;
  endsOn: Date;
};

type TermCalendarExceptionRow = {
  id: string;
  termId: string;
  action: "cancel" | "add" | "replace" | "modify";
  activityTypeVersionId: string | null;
  calendarSlotId: string | null;
  targetDate: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  label: string | null;
  reason: string | null;
  provenance: unknown | null;
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

type LearningModuleVersionActivityRow = {
  activityVersionId: string;
  sequence: number;
  notes: string | null;
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
  activities?: LearningModuleVersionActivityRow[];
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

type ActivityTypeRow = {
  id: string;
  instructorId: string;
  behaviorFamily: ActivityBehaviorFamily;
  currentVersionId: string | null;
  archivedAt: Date | null;
};

type ActivityTypeVersionRow = {
  id: string;
  activityTypeId: string;
  revision: number;
  label: string;
  description: string | null;
  changeSummary: string | null;
  publishedAt: Date | null;
};

type CourseActivityTypeVersionRow = {
  courseId: string;
  activityTypeVersionId: string;
  enabledAt: Date;
};

type ActivityRow = {
  id: string;
  courseId: string;
  stableCode: string;
  currentVersionId: string | null;
  archivedAt: Date | null;
};

type MeetingActivityDetailRow = {
  defaultDurationMinutes: number | null;
  modality: string | null;
  preparationNotes: string | null;
  authoringNotes: string | null;
};

type CourseworkActivityDetailRow = {
  submissionPolicy: string | null;
  releasePolicy: string | null;
  authoringNotes: string | null;
};

type AssessmentActivityDetailRow = {
  modality: string | null;
  authoringNotes: string | null;
};

type ActivityVersionMilestoneTemplateRow = {
  id: string;
  activityVersionId: string;
  sequence: number;
  role: MilestoneRole;
  label: string;
  linkedActivityId: string | null;
  relativeDays: number | null;
  defaultTime: string | null;
  timeZone: string | null;
  notes: string | null;
  provenance: unknown | null;
};

type ActivityVersionLearningModuleScopeRow = {
  id: string;
  activityVersionId: string;
  learningModuleId: string;
  emphasis: string | null;
  notes: string | null;
};

type ActivityVersionTopicActionSiblingRow = {
  activityVersionId: string;
  activityId: string;
  activityStableCode: string;
  action: CoverageLevel;
};

type ActivityVersionTopicActionRow = {
  id: string;
  activityVersionId: string;
  topicVersionId: string;
  action: CoverageLevel;
  notes: string | null;
  provenance: unknown;
};

type ActivityVersionTopicActionWithSiblingsRow = ActivityVersionTopicActionRow & {
  siblings: ActivityVersionTopicActionSiblingRow[];
};

type ActivityTopicScopeRow = {
  id: string;
  activityId: string;
  topicId: string;
  notes: string | null;
  provenance: unknown;
};

type ActivityVersionRow = {
  id: string;
  activityId: string;
  revision: number;
  title: string;
  summary: string | null;
  activityTypeVersionId: string;
  changeSummary: string | null;
  publishedAt: Date | null;
  meetingDetail?: MeetingActivityDetailRow | null;
  courseworkDetail?: CourseworkActivityDetailRow | null;
  assessmentDetail?: AssessmentActivityDetailRow | null;
  milestoneTemplates?: ActivityVersionMilestoneTemplateRow[];
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

export function toAcademicCalendarVersionDto(version: AcademicCalendarVersionRow): AcademicCalendarVersionDto {
  return {
    id: version.id,
    academicCalendarId: version.academicCalendarId,
    version: version.version,
    name: version.name,
    academicYear: version.academicYear,
    sourceUri: version.sourceUri,
    publishedAt: toIsoDateTimeNullable(version.publishedAt),
    archivedAt: toIsoDateTimeNullable(version.archivedAt),
  };
}

export function toAcademicCalendarEventDto(event: AcademicCalendarEventRow): AcademicCalendarEventDto {
  return {
    id: event.id,
    academicCalendarId: event.academicCalendarId,
    academicCalendarVersionId: event.academicCalendarVersionId,
    eventType: event.eventType,
    startsOn: toIsoDate(event.startsOn),
    endsOn: toIsoDate(event.endsOn),
    label: event.label,
    sourceUri: event.sourceUri,
  };
}

export function toAcademicCalendarPeriodDto(period: AcademicCalendarPeriodRow): AcademicCalendarPeriodDto {
  return {
    id: period.id,
    academicCalendarVersionId: period.academicCalendarVersionId,
    kind: period.kind,
    label: period.label,
    startsOn: toIsoDate(period.startsOn),
    endsOn: toIsoDate(period.endsOn),
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

export function toTermMeetingPatternDto(pattern: TermMeetingPatternRow): TermMeetingPatternDto {
  return {
    id: pattern.id,
    termId: pattern.termId,
    activityTypeVersionId: pattern.activityTypeVersionId,
    label: pattern.label,
    daysOfWeek: pattern.daysOfWeek,
    startTimeLocal: pattern.startTimeLocal,
    endTimeLocal: pattern.endTimeLocal,
    timeZone: pattern.timeZone,
    startsOn: toIsoDate(pattern.startsOn),
    endsOn: toIsoDate(pattern.endsOn),
  };
}

export function toTermCalendarExceptionDto(exception: TermCalendarExceptionRow): TermCalendarExceptionDto {
  return {
    id: exception.id,
    termId: exception.termId,
    action: exception.action,
    activityTypeVersionId: exception.activityTypeVersionId,
    calendarSlotId: exception.calendarSlotId,
    targetDate: toIsoDateNullable(exception.targetDate),
    startsAt: toIsoDateTimeNullable(exception.startsAt),
    endsAt: toIsoDateTimeNullable(exception.endsAt),
    label: exception.label,
    reason: exception.reason,
    provenance: exception.provenance,
  };
}

export function toTermCalendarSlotProvenanceDto(
  provenance: TermCalendarSlotProvenanceDto,
): TermCalendarSlotProvenanceDto {
  return provenance;
}

export function toCalendarSlotCandidateDto(candidate: CalendarSlotCandidateDto): CalendarSlotCandidateDto {
  return {
    ...candidate,
    provenance: candidate.provenance.map(toTermCalendarSlotProvenanceDto),
  };
}

export function toCalendarMaterializationConflictDto(
  conflict: CalendarMaterializationConflictDto,
): CalendarMaterializationConflictDto {
  return conflict;
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
    activities: (version.activities ?? []).map((activity) => ({
      activityVersionId: activity.activityVersionId,
      sequence: activity.sequence,
      notes: activity.notes,
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

export function toActivityTypeDto(activityType: ActivityTypeRow): ActivityTypeDto {
  return {
    id: activityType.id,
    instructorId: activityType.instructorId,
    behaviorFamily: activityType.behaviorFamily,
    currentVersionId: activityType.currentVersionId,
    archivedAt: toIsoDateTimeNullable(activityType.archivedAt),
  };
}

export function toActivityTypeVersionDto(version: ActivityTypeVersionRow): ActivityTypeVersionDto {
  return {
    id: version.id,
    activityTypeId: version.activityTypeId,
    revision: version.revision,
    label: version.label,
    description: version.description,
    changeSummary: version.changeSummary,
    publishedAt: toIsoDateTimeNullable(version.publishedAt),
  };
}

export function toCourseActivityTypeVersionDto(
  row: CourseActivityTypeVersionRow,
): CourseActivityTypeVersionDto {
  return {
    courseId: row.courseId,
    activityTypeVersionId: row.activityTypeVersionId,
    enabledAt: row.enabledAt.toISOString(),
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

export function toActivityDto(activity: ActivityRow): ActivityDto {
  return {
    id: activity.id,
    courseId: activity.courseId,
    stableCode: activity.stableCode,
    currentVersionId: activity.currentVersionId,
    archivedAt: toIsoDateTimeNullable(activity.archivedAt),
  };
}

function toActivityDetailDto(version: ActivityVersionRow): ActivityDetailDto {
  if (version.meetingDetail) {
    return {
      behaviorFamily: "meeting",
      defaultDurationMinutes: version.meetingDetail.defaultDurationMinutes,
      modality: version.meetingDetail.modality,
      preparationNotes: version.meetingDetail.preparationNotes,
      authoringNotes: version.meetingDetail.authoringNotes,
    };
  }
  if (version.courseworkDetail) {
    return {
      behaviorFamily: "coursework",
      submissionPolicy: version.courseworkDetail.submissionPolicy,
      releasePolicy: version.courseworkDetail.releasePolicy,
      authoringNotes: version.courseworkDetail.authoringNotes,
    };
  }
  if (version.assessmentDetail) {
    return {
      behaviorFamily: "assessment",
      modality: version.assessmentDetail.modality,
      authoringNotes: version.assessmentDetail.authoringNotes,
    };
  }
  throw new Error("Activity version is missing its behavior-family detail row");
}

function toMilestoneTemplateDto(
  template: ActivityVersionMilestoneTemplateRow,
): ActivityVersionMilestoneTemplateDto {
  return {
    id: template.id,
    activityVersionId: template.activityVersionId,
    sequence: template.sequence,
    role: template.role,
    label: template.label,
    linkedActivityId: template.linkedActivityId,
    relativeDays: template.relativeDays,
    defaultTime: template.defaultTime,
    timeZone: template.timeZone,
    notes: template.notes,
    provenance: template.provenance,
  };
}

export function toActivityVersionDto(version: ActivityVersionRow): ActivityVersionDto {
  return {
    id: version.id,
    activityId: version.activityId,
    revision: version.revision,
    title: version.title,
    summary: version.summary,
    activityTypeVersionId: version.activityTypeVersionId,
    changeSummary: version.changeSummary,
    publishedAt: toIsoDateTimeNullable(version.publishedAt),
    detail: toActivityDetailDto(version),
    milestoneTemplates: (version.milestoneTemplates ?? [])
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map(toMilestoneTemplateDto),
  };
}

export function toActivityVersionLearningModuleScopeDto(
  scope: ActivityVersionLearningModuleScopeRow,
): ActivityVersionLearningModuleScopeDto {
  return {
    id: scope.id,
    activityVersionId: scope.activityVersionId,
    learningModuleId: scope.learningModuleId,
    emphasis: scope.emphasis,
    notes: scope.notes,
  };
}

export function toActivityTopicActionSiblingDto(
  sibling: ActivityVersionTopicActionSiblingRow,
): ActivityTopicActionSiblingDto {
  return {
    activityVersionId: sibling.activityVersionId,
    activityId: sibling.activityId,
    activityStableCode: sibling.activityStableCode,
    action: sibling.action,
  };
}

export function toActivityVersionTopicActionDto(
  action: ActivityVersionTopicActionRow,
): ActivityVersionTopicActionDto {
  return {
    id: action.id,
    activityVersionId: action.activityVersionId,
    topicVersionId: action.topicVersionId,
    action: action.action,
    notes: action.notes,
    provenance: action.provenance ?? null,
  };
}

export function toActivityVersionTopicActionWithSiblingsDto(
  action: ActivityVersionTopicActionWithSiblingsRow,
): ActivityVersionTopicActionWithSiblingsDto {
  return {
    ...toActivityVersionTopicActionDto(action),
    siblings: action.siblings.map(toActivityTopicActionSiblingDto),
  };
}

export function toActivityTopicScopeDto(scope: ActivityTopicScopeRow): ActivityTopicScopeDto {
  return {
    id: scope.id,
    activityId: scope.activityId,
    topicId: scope.topicId,
    notes: scope.notes,
    provenance: scope.provenance ?? null,
  };
}
