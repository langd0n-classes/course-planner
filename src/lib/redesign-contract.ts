// Frozen Phase A REST contract for redesign issue #18.
// Phase B lanes may implement these handlers, but route shapes and exported
// request/response names are the interface of record.
//
// Amended for the Phase A.1 refreeze (Gate 0, see docs/plans/course-lm-topic-redesign-v2.md
// amendment v2.2): AssessmentType is generic string data (not schema vocabulary),
// Term gains an explicit lifecycle state, CalendarSlot gains advisory-only
// instructional capacity, Session gains an advisory-only instructional mode, and
// the contract expands to cover the full Plan/Run collection surface.

export type Id = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type ApiErrorResponse = {
  error: string;
  details?: unknown;
};

export type NotImplementedResponse = {
  error: "not_implemented";
  route: CanonicalRoute;
};

export type RetiredResponse = {
  error: "legacy_route_retired";
  message: string;
};

export type MembershipStatus = "active" | "inactive";
export type CalendarEventType =
  | "term_start"
  | "term_end"
  | "holiday"
  | "break_day"
  | "reading_day"
  | "finals_start"
  | "finals_end"
  | "other";
export type SessionType = "lecture" | "lab";
export type SessionStatus = "scheduled" | "canceled" | "moved";
export type CoverageLevel = "introduced" | "practiced" | "assessed";
// Generic app rule: assessment type is instructor-authored data (e.g. "gaie",
// "assignment", "exam", "project"), not fixed schema vocabulary. GAIE remains
// valid seed/UI data, not a schema enum member.
export type AssessmentType = string;
export type SlotType = "class_day" | "holiday" | "finals" | "break_day";
export type ArtifactType =
  | "notebook"
  | "handout"
  | "slides"
  | "instructions"
  | "dataset"
  | "reading"
  | "video"
  | "link"
  | "ta_key"
  | "other";
export type ArtifactSourceType = "external_uri" | "uploaded_file" | "generated_file";
export type ArtifactParentType =
  | "learning_module_version"
  | "topic_version"
  | "session"
  | "assessment";

export type TermStatus = "planned" | "active" | "closed";

// Advisory-only signal for how a calendar day is expected to function
// instructionally. Separate from SlotType (what the day is on the calendar).
export type InstructionalCapacity =
  | "normal"
  | "reduced_engagement"
  | "recovery"
  | "assessment_period";
export type CapacitySource = "baseline" | "heuristic" | "instructor_override";

// Advisory-only signal for what kind of teaching a Session is, separate from
// the lecture/lab SessionType.
export type InstructionalMode = "standard" | "recovery" | "review" | "buffer" | "assessment" | "other";

export type InstitutionDto = {
  id: Id;
  name: string;
  shortName: string | null;
  canonicalUri: string | null;
  archivedAt: IsoDateTime | null;
};

export type CreateInstitutionRequest = {
  name: string;
  shortName?: string | null;
  canonicalUri?: string | null;
};
export type ListInstitutionsResponse = { institutions: InstitutionDto[] };
export type CreateInstitutionResponse = { institution: InstitutionDto };

export type AcademicCalendarDto = {
  id: Id;
  institutionId: Id;
  name: string;
  academicYear: string;
  version: number;
  sourceUri: string | null;
  publishedAt: IsoDateTime | null;
  archivedAt: IsoDateTime | null;
};
export type CreateAcademicCalendarRequest = {
  institutionId: Id;
  name: string;
  academicYear: string;
  sourceUri?: string | null;
};
export type ListAcademicCalendarsResponse = { academicCalendars: AcademicCalendarDto[] };
export type CreateAcademicCalendarResponse = { academicCalendar: AcademicCalendarDto };

export type CourseDto = {
  id: Id;
  instructorId: Id;
  shortId: string;
  title: string;
  titleIsPlaceholder: boolean;
  number: string;
  numberIsPlaceholder: boolean;
  description: string | null;
  archivedAt: IsoDateTime | null;
};
export type CreateCourseRequest = {
  instructorId: Id;
  title: string;
  titleIsPlaceholder?: boolean;
  number: string;
  numberIsPlaceholder?: boolean;
  description?: string | null;
  institutionIds?: Id[];
};
export type ListCoursesResponse = { courses: CourseDto[] };
export type CreateCourseResponse = { course: CourseDto };
export type GetCourseResponse = { course: CourseDto };
export type UpdateCourseRequest = Partial<
  Omit<CreateCourseRequest, "instructorId" | "institutionIds">
> & { archivedAt?: IsoDateTime | null };
export type UpdateCourseResponse = { course: CourseDto };
export type CourseInstitutionDto = { courseId: Id; institutionId: Id };
export type ListCourseInstitutionsResponse = { institutions: InstitutionDto[] };
export type ReplaceCourseInstitutionsRequest = { institutionIds: Id[] };
export type ReplaceCourseInstitutionsResponse = { courseInstitutions: CourseInstitutionDto[] };

export type LearningModuleDto = {
  id: Id;
  courseId: Id;
  stableCode: string;
  currentVersionId: Id | null;
  archivedAt: IsoDateTime | null;
};
export type LearningModuleVersionTopicDto = {
  topicVersionId: Id;
  sequence: number;
};
export type LearningModuleVersionDto = {
  id: Id;
  learningModuleId: Id;
  revision: number;
  title: string;
  description: string | null;
  studentDescription: string | null;
  learningObjectives: string[];
  notes: string | null;
  defaultSequence: number | null;
  changeSummary: string | null;
  publishedAt: IsoDateTime | null;
  topics: LearningModuleVersionTopicDto[];
};
export type UpsertLearningModuleVersionRequest = {
  expectedCurrentVersionId?: Id;
  title: string;
  description?: string | null;
  studentDescription?: string | null;
  learningObjectives?: string[];
  notes?: string | null;
  defaultSequence?: number | null;
  changeSummary?: string | null;
  topics?: LearningModuleVersionTopicDto[];
  publish?: boolean;
};
export type CreateLearningModuleRequest = {
  stableCode: string;
  createdByInstructorId: Id;
  version: UpsertLearningModuleVersionRequest;
};
export type ListLearningModulesResponse = { learningModules: LearningModuleDto[] };
export type CreateLearningModuleResponse = {
  learningModule: LearningModuleDto;
  currentVersion: LearningModuleVersionDto;
};
export type GetLearningModuleResponse = {
  learningModule: LearningModuleDto;
  currentVersion: LearningModuleVersionDto | null;
};
export type UpdateLearningModuleRequest = {
  stableCode?: string;
  archivedAt?: IsoDateTime | null;
};
export type UpdateLearningModuleResponse = {
  learningModule: LearningModuleDto;
  currentVersion: LearningModuleVersionDto | null;
};
export type ListLearningModuleVersionsResponse = { versions: LearningModuleVersionDto[] };
export type CreateLearningModuleVersionResponse = { version: LearningModuleVersionDto };

export type TopicDto = {
  id: Id;
  courseId: Id;
  learningModuleId: Id | null;
  stableCode: string;
  currentVersionId: Id | null;
  archivedAt: IsoDateTime | null;
};
export type TopicVersionDto = {
  id: Id;
  topicId: Id;
  revision: number;
  title: string;
  category: string | null;
  description: string | null;
  changeSummary: string | null;
  publishedAt: IsoDateTime | null;
};
export type UpsertTopicVersionRequest = {
  expectedCurrentVersionId?: Id;
  title: string;
  category?: string | null;
  description?: string | null;
  changeSummary?: string | null;
  publish?: boolean;
};
export type CreateTopicRequest = {
  stableCode: string;
  learningModuleId?: Id | null;
  createdByInstructorId: Id;
  version: UpsertTopicVersionRequest;
};
export type ListTopicsResponse = { topics: TopicDto[] };
export type CreateTopicResponse = { topic: TopicDto; currentVersion: TopicVersionDto };
export type GetTopicResponse = { topic: TopicDto; currentVersion: TopicVersionDto | null };
export type UpdateTopicRequest = {
  stableCode?: string;
  learningModuleId?: Id | null;
  archivedAt?: IsoDateTime | null;
};
export type UpdateTopicResponse = {
  topic: TopicDto;
  currentVersion: TopicVersionDto | null;
};
export type ListTopicVersionsResponse = { versions: TopicVersionDto[] };
export type CreateTopicVersionResponse = { version: TopicVersionDto };

// Topic prerequisites are a same-Course DAG edge: `topicId` depends on
// `prerequisiteTopicId`.
export type TopicPrerequisiteDto = {
  topicId: Id;
  prerequisiteTopicId: Id;
};
export type ListTopicPrerequisitesResponse = { prerequisites: TopicPrerequisiteDto[] };
export type ReplaceTopicPrerequisitesRequest = { prerequisiteTopicIds: Id[] };
export type ReplaceTopicPrerequisitesResponse = { prerequisites: TopicPrerequisiteDto[] };

export type TermDto = {
  id: Id;
  courseId: Id;
  institutionId: Id;
  academicCalendarId: Id;
  code: string;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  meetingPattern: unknown | null;
  status: TermStatus;
  closedAt: IsoDateTime | null;
  clonedFromId: Id | null;
  archivedAt: IsoDateTime | null;
};
export type CreateTermRequest = {
  courseId: Id;
  institutionId: Id;
  academicCalendarId: Id;
  code: string;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  meetingPattern?: unknown | null;
};
export type ListTermsResponse = { terms: TermDto[] };
export type CreateTermResponse = { term: TermDto };
export type GetTermResponse = { term: TermDto };
export type UpdateTermRequest = Partial<Omit<CreateTermRequest, "courseId" | "institutionId">>;
export type UpdateTermResponse = { term: TermDto };

// Term lifecycle is an explicit state machine (planned -> active -> closed,
// with closed reversible back to active) because closed terms are read-only
// and dates alone cannot represent an intentionally closed or reopened term.
export type TermLifecycleTransition = "activate" | "close" | "reopen";
export type TermLifecycleTransitionRequest = {
  transition: TermLifecycleTransition;
  expectedStatus: TermStatus;
  reason?: string | null;
};
export type TermLifecycleTransitionResponse = { term: TermDto };

export type CloneTermRequest = {
  mode: "preview" | "apply";
  code: string;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  institutionId: Id;
  academicCalendarId: Id;
  meetingPattern: unknown;
};
export type CloneTermPreviewResponse = {
  kind: "preview";
  sourceTermId: Id;
  learningModuleCount: number;
  sessionCount: number;
  assessmentCount: number;
  calendarSlotCount: number;
  unresolvedDates: Array<{
    sourceDate: IsoDate;
    sourceSessionId?: Id;
    reason: string;
  }>;
  warnings: string[];
};
export type CloneTermApplyResponse = { kind: "applied"; term: TermDto };
export type CloneTermResponse = CloneTermPreviewResponse | CloneTermApplyResponse;

export type CalendarSlotDto = {
  id: Id;
  termId: Id;
  academicCalendarEventId: Id | null;
  date: IsoDate;
  slotType: SlotType;
  label: string | null;
  source: string | null;
  instructionalCapacity: InstructionalCapacity;
  capacitySource: CapacitySource;
  capacityReason: string | null;
};
export type ListCalendarSlotsResponse = { calendarSlots: CalendarSlotDto[] };
export type UpdateCalendarSlotCapacityRequest = {
  instructionalCapacity: InstructionalCapacity;
  capacitySource: CapacitySource;
  capacityReason?: string | null;
};
export type UpdateCalendarSlotCapacityResponse = { calendarSlot: CalendarSlotDto };

export type TermLearningModuleDto = {
  id: Id;
  termId: Id;
  courseId: Id;
  learningModuleId: Id;
  learningModuleVersionId: Id;
  deliveredLearningModuleVersionId: Id | null;
  sequence: number;
  notes: string | null;
};
export type AdoptTermLearningModuleRequest = {
  learningModuleId: Id;
  learningModuleVersionId: Id;
  sequence: number;
  notes?: string | null;
};
export type ListTermLearningModulesResponse = { learningModules: TermLearningModuleDto[] };
export type AdoptTermLearningModuleResponse = { termLearningModule: TermLearningModuleDto };
// The delivered pointer is service-owned: it only advances via the
// create-delivered-revision command below, never by direct client mutation.
export type UpdateTermLearningModuleRequest = {
  sequence?: number;
  notes?: string | null;
};
export type GetTermLearningModuleResponse = { termLearningModule: TermLearningModuleDto };
export type UpdateTermLearningModuleResponse = { termLearningModule: TermLearningModuleDto };

// Creates a new immutable LearningModuleVersion revision from in-term edits
// and advances the TermLearningModule's delivered pointer to it. This
// records in-flight improvisation during delivery; it does not implement
// the "adopt a newer master version" upgrade path.
export type CreateDeliveredRevisionRequest = {
  expectedDeliveredLearningModuleVersionId: Id | null;
  title: string;
  description?: string | null;
  studentDescription?: string | null;
  learningObjectives?: string[];
  notes?: string | null;
  defaultSequence?: number | null;
  changeSummary?: string | null;
  topics?: LearningModuleVersionTopicDto[];
};
export type CreateDeliveredRevisionResponse = {
  termLearningModule: TermLearningModuleDto;
  deliveredVersion: LearningModuleVersionDto;
};

export type PlannedDeliveredTopicChange = {
  topicId: Id;
  kind: "added" | "removed" | "changed" | "reordered";
  plannedTopicVersionId: Id | null;
  deliveredTopicVersionId: Id | null;
  plannedSequence: number | null;
  deliveredSequence: number | null;
};
export type PlannedDeliveredDiffResponse = {
  termLearningModuleId: Id;
  plannedLearningModuleVersionId: Id;
  deliveredLearningModuleVersionId: Id | null;
  topicChanges: PlannedDeliveredTopicChange[];
};

export type SessionDto = {
  id: Id;
  termId: Id;
  termLearningModuleId: Id | null;
  sequence: number;
  sessionType: SessionType;
  code: string;
  title: string;
  date: IsoDate | null;
  description: string | null;
  format: string | null;
  notes: string | null;
  status: SessionStatus;
  instructionalMode: InstructionalMode;
  canceledAt: IsoDateTime | null;
  canceledReason: string | null;
  archivedAt: IsoDateTime | null;
};
export type CreateSessionRequest = {
  termLearningModuleId?: Id | null;
  sequence: number;
  sessionType: SessionType;
  code: string;
  title: string;
  date?: IsoDate | null;
  description?: string | null;
  format?: string | null;
  notes?: string | null;
  instructionalMode?: InstructionalMode;
};
export type ListTermSessionsResponse = { sessions: SessionDto[] };
export type CreateTermSessionResponse = { session: SessionDto };
export type GetSessionResponse = { session: SessionDto };
export type UpdateSessionRequest = Partial<
  Omit<SessionDto, "id" | "termId" | "status" | "canceledAt" | "canceledReason">
>;
export type UpdateSessionResponse = { session: SessionDto };

export type MoveSessionRequest = {
  date?: IsoDate | null;
  termLearningModuleId?: Id | null;
  sequence?: number;
};
export type MoveSessionResponse = { session: SessionDto };

export type PlanningIssueDto = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  topicVersionId?: Id;
  sessionId?: Id;
  calendarSlotId?: Id;
};

export type CoverageHealthDto = {
  totalTopics: number;
  fullyCovered: number;
  partiallyCovered: number;
  uncovered: number;
};

export type AtRiskTopicDto = {
  topicVersionId: Id;
  lostLevels: CoverageLevel[];
  alternativeSessionIds: Id[];
};

export type SessionWhatIfResponse = {
  sessionId: Id;
  affectedCoverages: CoverageDto[];
  atRiskTopics: AtRiskTopicDto[];
  healthBefore: CoverageHealthDto;
  healthAfter: CoverageHealthDto;
  issues: PlanningIssueDto[];
};

export type CancelSessionRedistribution = {
  topicVersionId: Id;
  level: CoverageLevel;
  targetSessionId: Id;
};
export type CancelSessionRequest = {
  reason?: string | null;
  redistributions?: CancelSessionRedistribution[];
  dryRun?: boolean;
  force?: boolean;
};
export type CancelSessionResponse =
  | { session: SessionDto }
  | { valid: boolean; issues: PlanningIssueDto[] };

export type TermWhatIfCompareResponse = {
  scenarioA: SessionWhatIfResponse;
  scenarioB: SessionWhatIfResponse;
};

export type TermImpactResponse = {
  termId: Id;
  health: CoverageHealthDto;
  issues: PlanningIssueDto[];
};

export type CoverageDto = {
  id: Id;
  sessionId: Id;
  topicVersionId: Id;
  level: CoverageLevel;
  notes: string | null;
  redistributedFrom: Id | null;
  redistributedAt: IsoDateTime | null;
};
export type CreateCoverageRequest = {
  topicVersionId: Id;
  level: CoverageLevel;
  notes?: string | null;
};
export type ListSessionCoveragesResponse = { coverages: CoverageDto[] };
export type CreateSessionCoverageResponse = { coverage: CoverageDto };
export type GetCoverageResponse = { coverage: CoverageDto };
export type UpdateCoverageRequest = Partial<Omit<CreateCoverageRequest, "topicVersionId">>;
export type UpdateCoverageResponse = { coverage: CoverageDto };

export type AssessmentDto = {
  id: Id;
  termId: Id;
  code: string;
  title: string;
  assessmentType: AssessmentType;
  description: string | null;
  studentInstructions: string | null;
  sessionId: Id | null;
  dueDate: IsoDate | null;
  rubric: unknown | null;
  progressionStage: string | null;
  topicVersionIds: Id[];
  archivedAt: IsoDateTime | null;
};
export type CreateAssessmentRequest = {
  code: string;
  title: string;
  assessmentType: AssessmentType;
  description?: string | null;
  studentInstructions?: string | null;
  sessionId?: Id | null;
  dueDate?: IsoDate | null;
  rubric?: unknown | null;
  progressionStage?: string | null;
  topicVersionIds?: Id[];
};
export type ListTermAssessmentsResponse = { assessments: AssessmentDto[] };
export type CreateTermAssessmentResponse = { assessment: AssessmentDto };
export type GetAssessmentResponse = { assessment: AssessmentDto };
export type UpdateAssessmentRequest = Partial<CreateAssessmentRequest>;
export type UpdateAssessmentResponse = { assessment: AssessmentDto };

export type ArtifactDto = {
  id: Id;
  parentType: ArtifactParentType;
  learningModuleVersionId: Id | null;
  topicVersionId: Id | null;
  sessionId: Id | null;
  assessmentId: Id | null;
  artifactType: ArtifactType;
  sourceType: ArtifactSourceType;
  title: string;
  uri: string;
  filename: string | null;
  mimeType: string | null;
  generatorKey: string | null;
  generatedAt: IsoDateTime | null;
  metadata: unknown | null;
  archivedAt: IsoDateTime | null;
};
export type CreateArtifactRequest = Omit<
  ArtifactDto,
  "id" | "archivedAt" | "generatorKey" | "generatedAt" | "metadata"
> & {
  generatorKey?: string | null;
  generatedAt?: IsoDateTime | null;
  metadata?: unknown | null;
};
export type ListArtifactsResponse = { artifacts: ArtifactDto[] };
export type CreateArtifactResponse = { artifact: ArtifactDto };
export type GetArtifactResponse = { artifact: ArtifactDto };
export type UpdateArtifactRequest = Partial<CreateArtifactRequest> & {
  archivedAt?: IsoDateTime | null;
};
export type UpdateArtifactResponse = { artifact: ArtifactDto };

// Array-first so tests can validate route stubs at runtime against the same
// source of truth the CanonicalRoute type is derived from.
export const CANONICAL_ROUTES = [
  "/api/institutions",
  "/api/academic-calendars",
  "/api/courses",
  "/api/courses/[id]",
  "/api/courses/[id]/institutions",
  "/api/courses/[id]/learning-modules",
  "/api/learning-modules/[id]",
  "/api/learning-modules/[id]/versions",
  "/api/courses/[id]/topics",
  "/api/topics/[id]",
  "/api/topics/[id]/versions",
  "/api/topics/[id]/prerequisites",
  "/api/terms",
  "/api/terms/[id]",
  "/api/terms/[id]/lifecycle",
  "/api/terms/[id]/clone",
  "/api/terms/[id]/calendar-slots",
  "/api/calendar-slots/[id]",
  "/api/terms/[id]/learning-modules",
  "/api/term-learning-modules/[id]",
  "/api/term-learning-modules/[id]/delivered-revisions",
  "/api/term-learning-modules/[id]/planned-delivered-diff",
  "/api/terms/[id]/sessions",
  "/api/sessions/[id]",
  "/api/sessions/[id]/move",
  "/api/sessions/[id]/whatif",
  "/api/sessions/[id]/cancel",
  "/api/terms/[id]/whatif-compare",
  "/api/terms/[id]/impact",
  "/api/sessions/[id]/coverages",
  "/api/coverages/[id]",
  "/api/terms/[id]/assessments",
  "/api/assessments/[id]",
  "/api/artifacts",
  "/api/artifacts/[id]",
] as const;

export type CanonicalRoute = (typeof CANONICAL_ROUTES)[number];
