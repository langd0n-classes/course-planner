// Typed client for Lane C's workspace UI. Every export here is named after
// the contract operation it fulfills so that swapping the mock backend for
// real `fetch()` calls against CANONICAL_ROUTES (once Lane A ships handlers)
// is a body-only change — call sites in pages/components do not change.
//
// Do not import `src/lib/api-client.ts` from any new redesign UI code: it is
// the legacy Module/Skill-era client, kept only so the branch compiles (see
// ARCHITECTURE.md "Redesign branch: legacy quarantine").

import * as mock from "./redesign-mock-backend";
import type {
  AcademicCalendarDto,
  ArtifactDto,
  AssessmentDto,
  CalendarSlotDto,
  CloneTermResponse,
  CourseDto,
  CoverageHealthDto,
  CreateDeliveredRevisionRequest,
  CreateDeliveredRevisionResponse,
  Id,
  InstitutionDto,
  LearningModuleDto,
  LearningModuleVersionDto,
  PlannedDeliveredDiffResponse,
  SessionDto,
  TermDto,
  TermLearningModuleDto,
  TermLifecycleTransition,
  TermStatus,
  TopicDto,
  TopicPrerequisiteDto,
  TopicVersionDto,
  UpsertLearningModuleVersionRequest,
  UpsertTopicVersionRequest,
} from "./redesign-contract";

// Mirrors real network latency so loading states are actually exercised
// during development instead of always resolving synchronously.
const MOCK_LATENCY_MS = 120;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

async function call<T>(fn: () => T): Promise<T> {
  return delay(fn());
}

export const redesignApi = {
  // Institutions / academic calendars ---------------------------------
  listInstitutions: (): Promise<InstitutionDto[]> => call(() => mock.listInstitutions()),
  listAcademicCalendars: (institutionId?: Id): Promise<AcademicCalendarDto[]> =>
    call(() => mock.listAcademicCalendars(institutionId)),

  // Courses -------------------------------------------------------------
  listCourses: (): Promise<CourseDto[]> => call(() => mock.listCourses()),
  getCourse: (id: Id): Promise<CourseDto> => call(() => mock.getCourse(id)),
  createCourse: (input: {
    instructorId: Id;
    title: string;
    titleIsPlaceholder?: boolean;
    number: string;
    numberIsPlaceholder?: boolean;
    description?: string | null;
    institutionIds?: Id[];
  }): Promise<CourseDto> => call(() => mock.createCourse(input)),
  listCourseInstitutions: (courseId: Id): Promise<InstitutionDto[]> =>
    call(() => mock.listCourseInstitutions(courseId)),

  // Learning modules ------------------------------------------------------
  listLearningModules: (courseId: Id): Promise<LearningModuleDto[]> => call(() => mock.listLearningModules(courseId)),
  getLearningModule: (
    id: Id,
  ): Promise<{ learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto | null }> =>
    call(() => mock.getLearningModule(id)),
  listLearningModuleVersions: (learningModuleId: Id): Promise<LearningModuleVersionDto[]> =>
    call(() => mock.listLearningModuleVersions(learningModuleId)),
  createLearningModule: (
    courseId: Id,
    stableCode: string,
    version: UpsertLearningModuleVersionRequest,
  ): Promise<{ learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto }> =>
    call(() => mock.createLearningModule(courseId, stableCode, version)),
  createLearningModuleVersion: (
    learningModuleId: Id,
    version: UpsertLearningModuleVersionRequest,
  ): Promise<LearningModuleVersionDto> => call(() => mock.createLearningModuleVersion(learningModuleId, version)),
  restoreLearningModuleVersion: (learningModuleId: Id, versionId: Id, changeSummary?: string): Promise<LearningModuleVersionDto> =>
    call(() => mock.restoreLearningModuleVersion(learningModuleId, versionId, changeSummary)),

  // Topics ----------------------------------------------------------------
  listTopics: (courseId: Id): Promise<TopicDto[]> => call(() => mock.listTopics(courseId)),
  getTopic: (id: Id): Promise<{ topic: TopicDto; currentVersion: TopicVersionDto | null }> =>
    call(() => mock.getTopic(id)),
  getTopicVersion: (id: Id): Promise<TopicVersionDto> => call(() => mock.getTopicVersion(id)),
  listTopicVersions: (topicId: Id): Promise<TopicVersionDto[]> => call(() => mock.listTopicVersions(topicId)),
  createTopic: (
    courseId: Id,
    stableCode: string,
    learningModuleId: Id | null,
    version: UpsertTopicVersionRequest,
  ): Promise<{ topic: TopicDto; currentVersion: TopicVersionDto | null }> =>
    call(() => mock.createTopic(courseId, stableCode, learningModuleId, version)),
  assignTopicLearningModule: (topicId: Id, learningModuleId: Id | null): Promise<TopicDto> =>
    call(() => mock.assignTopicLearningModule(topicId, learningModuleId)),
  listTopicPrerequisites: (courseId: Id): Promise<TopicPrerequisiteDto[]> =>
    call(() => mock.listTopicPrerequisites(courseId)),
  replaceTopicPrerequisites: (topicId: Id, prerequisiteTopicIds: Id[]): Promise<TopicPrerequisiteDto[]> =>
    call(() => mock.replaceTopicPrerequisites(topicId, prerequisiteTopicIds)),

  // Terms -------------------------------------------------------------------
  listTerms: (courseId?: Id): Promise<TermDto[]> => call(() => mock.listTerms(courseId)),
  getTerm: (id: Id): Promise<TermDto> => call(() => mock.getTerm(id)),
  createTerm: (input: {
    courseId: Id;
    institutionId: Id;
    academicCalendarId: Id;
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    meetingPattern?: unknown;
  }): Promise<TermDto> => call(() => mock.createTerm(input)),
  transitionTerm: (id: Id, transition: TermLifecycleTransition, expectedStatus: TermStatus): Promise<TermDto> =>
    call(() => mock.transitionTerm(id, transition, expectedStatus)),
  previewCloneTerm: (sourceTermId: Id) => call(() => mock.previewCloneTerm(sourceTermId)),
  applyCloneTerm: (
    sourceTermId: Id,
    input: {
      code: string;
      name: string;
      startDate: string;
      endDate: string;
      institutionId: Id;
      academicCalendarId: Id;
      meetingPattern?: unknown;
    },
  ): Promise<CloneTermResponse> => call(() => mock.applyCloneTerm(sourceTermId, input)),

  // Calendar slots ------------------------------------------------------------
  listCalendarSlots: (termId: Id): Promise<CalendarSlotDto[]> => call(() => mock.listCalendarSlots(termId)),

  // Term learning modules (planned + delivered) --------------------------------
  listTermLearningModules: (termId: Id): Promise<TermLearningModuleDto[]> =>
    call(() => mock.listTermLearningModules(termId)),
  getTermLearningModule: (id: Id): Promise<TermLearningModuleDto> => call(() => mock.getTermLearningModule(id)),
  adoptTermLearningModule: (
    termId: Id,
    input: { learningModuleId: Id; learningModuleVersionId: Id; sequence: number; notes?: string | null },
  ): Promise<TermLearningModuleDto> => call(() => mock.adoptTermLearningModule(termId, input)),
  updateTermLearningModule: (id: Id, patch: { sequence?: number; notes?: string | null }): Promise<TermLearningModuleDto> =>
    call(() => mock.updateTermLearningModule(id, patch)),
  createDeliveredRevision: (
    termLearningModuleId: Id,
    request: CreateDeliveredRevisionRequest,
  ): Promise<CreateDeliveredRevisionResponse> => call(() => mock.createDeliveredRevision(termLearningModuleId, request)),
  getPlannedDeliveredDiff: (termLearningModuleId: Id): Promise<PlannedDeliveredDiffResponse> =>
    call(() => mock.getPlannedDeliveredDiff(termLearningModuleId)),

  // Sessions --------------------------------------------------------------------
  listTermSessions: (termId: Id): Promise<SessionDto[]> => call(() => mock.listTermSessions(termId)),
  getSession: (id: Id): Promise<SessionDto> => call(() => mock.getSession(id)),

  // Coverage health / assessments / artifacts --------------------------------------
  computeCoverageHealth: (termId: Id): Promise<CoverageHealthDto> => call(() => mock.computeCoverageHealth(termId)),
  listTermAssessments: (termId: Id): Promise<AssessmentDto[]> => call(() => mock.listTermAssessments(termId)),
  listArtifactsForTopicVersion: (topicVersionId: Id): Promise<ArtifactDto[]> =>
    call(() => mock.listArtifactsForTopicVersion(topicVersionId)),
};
