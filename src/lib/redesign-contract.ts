// Frozen Phase A REST contract for redesign issue #18.
// Phase B lanes may implement these handlers, but route shapes and exported
// request/response names are the interface of record.

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
export type AssessmentType = "gaie" | "assignment" | "exam" | "project";
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
export type ListTopicVersionsResponse = { versions: TopicVersionDto[] };
export type CreateTopicVersionResponse = { version: TopicVersionDto };

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
export type UpdateTermLearningModuleRequest = {
  sequence?: number;
  notes?: string | null;
  deliveredLearningModuleVersionId?: Id | null;
};
export type GetTermLearningModuleResponse = { termLearningModule: TermLearningModuleDto };
export type UpdateTermLearningModuleResponse = { termLearningModule: TermLearningModuleDto };

export type SessionDto = {
  id: Id;
  termId: Id;
  termLearningModuleId: Id | null;
  sequence: number;
  sessionType: SessionType;
  code: string;
  title: string;
  date: IsoDate | null;
  status: SessionStatus;
};
export type GetSessionResponse = { session: SessionDto };
export type UpdateSessionRequest = Partial<Omit<SessionDto, "id" | "termId">>;
export type UpdateSessionResponse = { session: SessionDto };

export type CoverageDto = {
  id: Id;
  sessionId: Id;
  topicVersionId: Id;
  level: CoverageLevel;
  notes: string | null;
};
export type CreateCoverageRequest = Omit<CoverageDto, "id">;
export type GetCoverageResponse = { coverage: CoverageDto };
export type CreateCoverageResponse = { coverage: CoverageDto };
export type UpdateCoverageRequest = Partial<CreateCoverageRequest>;
export type UpdateCoverageResponse = { coverage: CoverageDto };

export type AssessmentDto = {
  id: Id;
  termId: Id;
  code: string;
  title: string;
  assessmentType: AssessmentType;
  sessionId: Id | null;
  dueDate: IsoDate | null;
  topicVersionIds: Id[];
};
export type GetAssessmentResponse = { assessment: AssessmentDto };
export type CreateAssessmentRequest = Omit<AssessmentDto, "id">;
export type CreateAssessmentResponse = { assessment: AssessmentDto };
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
  archivedAt: IsoDateTime | null;
};
export type GetArtifactResponse = { artifact: ArtifactDto };
export type CreateArtifactRequest = Omit<ArtifactDto, "id" | "archivedAt">;
export type CreateArtifactResponse = { artifact: ArtifactDto };
export type UpdateArtifactRequest = Partial<CreateArtifactRequest> & {
  archivedAt?: IsoDateTime | null;
};
export type UpdateArtifactResponse = { artifact: ArtifactDto };

export type CanonicalRoute =
  | "/api/institutions"
  | "/api/academic-calendars"
  | "/api/courses"
  | "/api/courses/[id]/institutions"
  | "/api/courses/[id]/learning-modules"
  | "/api/learning-modules/[id]"
  | "/api/learning-modules/[id]/versions"
  | "/api/courses/[id]/topics"
  | "/api/topics/[id]"
  | "/api/topics/[id]/versions"
  | "/api/terms/[id]/learning-modules"
  | "/api/term-learning-modules/[id]"
  | "/api/sessions/[id]"
  | "/api/coverages/[id]"
  | "/api/assessments/[id]"
  | "/api/artifacts/[id]";
