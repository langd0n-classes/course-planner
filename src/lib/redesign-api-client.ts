// Typed client for the workspace UI. Every method calls a canonical API route
// so call sites in pages/components stay stable when routes are extended.
//
// Do not import `src/lib/api-client.ts` from new redesign UI code: it is the
// legacy Module/Skill-era client, kept only so the branch compiles.
//
// Mock injection: pass a mock implementation via `setMockBackend()` in tests
// or Storybook fixtures. Production always uses real HTTP.

import type {
  AcademicCalendarDto,
  ArtifactDto,
  AssessmentDto,
  CalendarSlotDto,
  CloneTermApplyResponse,
  CloneTermPreviewResponse,
  CourseDto,
  CoverageHealthDto,
  CreateAcademicCalendarRequest,
  CreateDeliveredRevisionRequest,
  CreateDeliveredRevisionResponse,
  CreateInstitutionRequest,
  CreateTermApplyResponse,
  CreateTermPreviewResponse,
  Id,
  InstructorDto,
  InstitutionDto,
  LearningModuleDto,
  LearningModuleVersionDto,
  ListArtifactsResponse,
  ListTermsResponse,
  PlannedDeliveredDiffResponse,
  ReplaceCourseInstitutionsResponse,
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
  MeetingPatternDto,
} from "./redesign-contract";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (responseBody as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (responseBody as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (responseBody as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Mock injection for tests / Storybook
// ---------------------------------------------------------------------------

export type RedesignApiMock = Partial<typeof redesignApi>;

let activeMock: RedesignApiMock | null = null;

export function setMockBackend(mock: RedesignApiMock | null) {
  activeMock = mock;
}

// ---------------------------------------------------------------------------
// Real API client
// ---------------------------------------------------------------------------

const _api = {
  // Authenticated instructor --------------------------------------------------
  getCurrentInstructor: (): Promise<InstructorDto> =>
    get<{ instructor: InstructorDto }>("/api/instructors/me").then((d) => d.instructor),

  // Institutions / academic calendars -----------------------------------------
  listInstitutions: (): Promise<InstitutionDto[]> =>
    get<{ institutions: InstitutionDto[] }>("/api/institutions").then((d) => d.institutions),

  createInstitution: (input: CreateInstitutionRequest): Promise<InstitutionDto> =>
    post<{ institution: InstitutionDto }>("/api/institutions", input).then((d) => d.institution),

  listAcademicCalendars: (institutionId?: Id): Promise<AcademicCalendarDto[]> => {
    const qs = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : "";
    return get<{ academicCalendars: AcademicCalendarDto[] }>(`/api/academic-calendars${qs}`).then(
      (d) => d.academicCalendars,
    );
  },

  createAcademicCalendar: (input: CreateAcademicCalendarRequest): Promise<AcademicCalendarDto> =>
    post<{ academicCalendar: AcademicCalendarDto }>("/api/academic-calendars", input).then(
      (d) => d.academicCalendar,
    ),

  // Courses -------------------------------------------------------------------
  listCourses: (): Promise<CourseDto[]> =>
    get<{ courses: CourseDto[] }>("/api/courses").then((d) => d.courses),

  getCourse: (id: Id): Promise<CourseDto> =>
    get<{ course: CourseDto }>(`/api/courses/${id}`).then((d) => d.course),

  createCourse: async (input: {
    title: string;
    titleIsPlaceholder?: boolean;
    number: string;
    numberIsPlaceholder?: boolean;
    description?: string | null;
    institutionIds?: Id[];
  }): Promise<CourseDto> => {
    const instructor = await _api.getCurrentInstructor();
    return post<{ course: CourseDto }>("/api/courses", {
      ...input,
      instructorId: instructor.id,
    }).then((d) => d.course);
  },

  listCourseInstitutions: (courseId: Id): Promise<InstitutionDto[]> =>
    get<{ institutions: InstitutionDto[] }>(`/api/courses/${courseId}/institutions`).then(
      (d) => d.institutions,
    ),

  replaceCourseInstitutions: (courseId: Id, institutionIds: Id[]): Promise<ReplaceCourseInstitutionsResponse> =>
    put<ReplaceCourseInstitutionsResponse>(`/api/courses/${courseId}/institutions`, { institutionIds }),

  // Learning modules ----------------------------------------------------------
  listLearningModules: (courseId: Id): Promise<LearningModuleDto[]> =>
    get<{ learningModules: LearningModuleDto[] }>(`/api/courses/${courseId}/learning-modules`).then(
      (d) => d.learningModules,
    ),

  getLearningModule: (
    id: Id,
  ): Promise<{ learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto | null }> =>
    get<{ learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto | null }>(
      `/api/learning-modules/${id}`,
    ),

  listLearningModuleVersions: (learningModuleId: Id): Promise<LearningModuleVersionDto[]> =>
    get<{ versions: LearningModuleVersionDto[] }>(
      `/api/learning-modules/${learningModuleId}/versions`,
    ).then((d) => d.versions),

  createLearningModule: async (
    courseId: Id,
    stableCode: string,
    version: UpsertLearningModuleVersionRequest,
  ): Promise<{ learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto }> => {
    const instructor = await _api.getCurrentInstructor();
    return post<{ learningModule: LearningModuleDto; currentVersion: LearningModuleVersionDto }>(
      `/api/courses/${courseId}/learning-modules`,
      { stableCode, createdByInstructorId: instructor.id, version },
    );
  },

  createLearningModuleVersion: (
    learningModuleId: Id,
    version: UpsertLearningModuleVersionRequest,
  ): Promise<LearningModuleVersionDto> =>
    post<{ version: LearningModuleVersionDto }>(
      `/api/learning-modules/${learningModuleId}/versions`,
      version,
    ).then((d) => d.version),

  restoreLearningModuleVersion: async (
    learningModuleId: Id,
    versionId: Id,
    changeSummary?: string,
  ): Promise<LearningModuleVersionDto> => {
    const versions = await _api.listLearningModuleVersions(learningModuleId);
    const source = versions.find((v) => v.id === versionId);
    if (!source) throw new Error(`Version ${versionId} not found`);
    return _api.createLearningModuleVersion(learningModuleId, {
      title: source.title,
      description: source.description,
      studentDescription: source.studentDescription,
      learningObjectives: source.learningObjectives,
      notes: source.notes,
      defaultSequence: source.defaultSequence,
      changeSummary: changeSummary ?? `Restored from revision ${source.revision}`,
      topics: source.topics,
    });
  },

  // Topics -------------------------------------------------------------------
  listTopics: (courseId: Id): Promise<TopicDto[]> =>
    get<{ topics: TopicDto[] }>(`/api/courses/${courseId}/topics`).then((d) => d.topics),

  getTopic: (id: Id): Promise<{ topic: TopicDto; currentVersion: TopicVersionDto | null }> =>
    get<{ topic: TopicDto; currentVersion: TopicVersionDto | null }>(`/api/topics/${id}`),

  getTopicVersion: (id: Id): Promise<TopicVersionDto> =>
    get<{ version: TopicVersionDto }>(`/api/topic-versions/${id}`).then((d) => d.version),

  listTopicVersions: (topicId: Id): Promise<TopicVersionDto[]> =>
    get<{ versions: TopicVersionDto[] }>(`/api/topics/${topicId}/versions`).then((d) => d.versions),

  createTopic: async (
    courseId: Id,
    stableCode: string,
    learningModuleId: Id | null,
    version: UpsertTopicVersionRequest,
  ): Promise<{ topic: TopicDto; currentVersion: TopicVersionDto | null }> => {
    const instructor = await _api.getCurrentInstructor();
    return post<{ topic: TopicDto; currentVersion: TopicVersionDto }>(
      `/api/courses/${courseId}/topics`,
      { stableCode, learningModuleId, createdByInstructorId: instructor.id, version },
    );
  },

  assignTopicLearningModule: (topicId: Id, learningModuleId: Id | null): Promise<TopicDto> =>
    patch<{ topic: TopicDto; currentVersion: TopicVersionDto | null }>(`/api/topics/${topicId}`, {
      learningModuleId,
    }).then((d) => d.topic),

  listTopicPrerequisites: (courseId: Id): Promise<TopicPrerequisiteDto[]> =>
    get<{ prerequisites: TopicPrerequisiteDto[] }>(
      `/api/courses/${courseId}/topic-prerequisites`,
    ).then((d) => d.prerequisites),

  replaceTopicPrerequisites: (topicId: Id, prerequisiteTopicIds: Id[]): Promise<TopicPrerequisiteDto[]> =>
    put<{ prerequisites: TopicPrerequisiteDto[] }>(`/api/topics/${topicId}/prerequisites`, {
      prerequisiteTopicIds,
    }).then((d) => d.prerequisites),

  // Terms -------------------------------------------------------------------
  listTerms: (courseId?: Id): Promise<TermDto[]> => {
    const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
    return get<ListTermsResponse>(`/api/terms${qs}`).then((d) => d.terms);
  },

  getTerm: (id: Id): Promise<TermDto> =>
    get<{ term: TermDto }>(`/api/terms/${id}`).then((d) => d.term),

  previewTermCreation: (input: {
    courseId: Id;
    institutionId: Id;
    academicCalendarId: Id;
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    meetingPattern: MeetingPatternDto;
  }): Promise<CreateTermPreviewResponse> =>
    post<CreateTermPreviewResponse>("/api/terms", { ...input, mode: "preview" }),

  applyTermCreation: (input: {
    courseId: Id;
    institutionId: Id;
    academicCalendarId: Id;
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    meetingPattern: MeetingPatternDto;
  }): Promise<CreateTermApplyResponse> =>
    post<CreateTermApplyResponse>("/api/terms", { ...input, mode: "apply" }),

  transitionTerm: (id: Id, transition: TermLifecycleTransition, expectedStatus: TermStatus): Promise<TermDto> =>
    post<{ term: TermDto }>(`/api/terms/${id}/lifecycle`, { transition, expectedStatus }).then(
      (d) => d.term,
    ),

  previewCloneTerm: (
    sourceTermId: Id,
    input: {
      code: string;
      name: string;
      startDate: string;
      endDate: string;
      institutionId: Id;
      academicCalendarId: Id;
      meetingPattern: MeetingPatternDto;
      learningModuleVersionSelections?: Array<{
        termLearningModuleId: Id;
        plannedLearningModuleVersionId: Id;
      }>;
    },
  ): Promise<CloneTermPreviewResponse> =>
    post<CloneTermPreviewResponse>(`/api/terms/${sourceTermId}/clone`, { ...input, mode: "preview" }),

  applyCloneTerm: (
    sourceTermId: Id,
    input: {
      code: string;
      name: string;
      startDate: string;
      endDate: string;
      institutionId: Id;
      academicCalendarId: Id;
      meetingPattern: MeetingPatternDto;
      learningModuleVersionSelections?: Array<{
        termLearningModuleId: Id;
        plannedLearningModuleVersionId: Id;
      }>;
    },
  ): Promise<CloneTermApplyResponse> =>
    post<CloneTermApplyResponse>(`/api/terms/${sourceTermId}/clone`, { ...input, mode: "apply" }),

  // Calendar slots -----------------------------------------------------------
  listCalendarSlots: (termId: Id): Promise<CalendarSlotDto[]> =>
    get<{ calendarSlots: CalendarSlotDto[] }>(`/api/terms/${termId}/calendar-slots`).then(
      (d) => d.calendarSlots,
    ),

  // Term learning modules (planned + delivered) -----------------------------
  listTermLearningModules: (termId: Id): Promise<TermLearningModuleDto[]> =>
    get<{ learningModules: TermLearningModuleDto[] }>(`/api/terms/${termId}/learning-modules`).then(
      (d) => d.learningModules,
    ),

  getTermLearningModule: (id: Id): Promise<TermLearningModuleDto> =>
    get<{ termLearningModule: TermLearningModuleDto }>(`/api/term-learning-modules/${id}`).then(
      (d) => d.termLearningModule,
    ),

  adoptTermLearningModule: (
    termId: Id,
    input: { learningModuleId: Id; learningModuleVersionId: Id; sequence: number; notes?: string | null },
  ): Promise<TermLearningModuleDto> =>
    post<{ termLearningModule: TermLearningModuleDto }>(
      `/api/terms/${termId}/learning-modules`,
      input,
    ).then((d) => d.termLearningModule),

  updateTermLearningModule: (id: Id, patch_: { sequence?: number; notes?: string | null }): Promise<TermLearningModuleDto> =>
    patch<{ termLearningModule: TermLearningModuleDto }>(`/api/term-learning-modules/${id}`, patch_).then(
      (d) => d.termLearningModule,
    ),

  createDeliveredRevision: (
    termLearningModuleId: Id,
    request: CreateDeliveredRevisionRequest,
  ): Promise<CreateDeliveredRevisionResponse> =>
    post<CreateDeliveredRevisionResponse>(
      `/api/term-learning-modules/${termLearningModuleId}/delivered-revisions`,
      request,
    ),

  getPlannedDeliveredDiff: (termLearningModuleId: Id): Promise<PlannedDeliveredDiffResponse> =>
    get<PlannedDeliveredDiffResponse>(
      `/api/term-learning-modules/${termLearningModuleId}/planned-delivered-diff`,
    ),

  // Sessions ----------------------------------------------------------------
  listTermSessions: (termId: Id): Promise<SessionDto[]> =>
    get<{ sessions: SessionDto[] }>(`/api/terms/${termId}/sessions`).then((d) => d.sessions),

  getSession: (id: Id): Promise<SessionDto> =>
    get<{ session: SessionDto }>(`/api/sessions/${id}`).then((d) => d.session),

  // Coverage health / assessments / artifacts -------------------------------
  computeCoverageHealth: (termId: Id): Promise<CoverageHealthDto> =>
    get<{ termId: Id; health: CoverageHealthDto; issues: unknown[] }>(`/api/terms/${termId}/impact`).then(
      (d) => d.health,
    ),

  listTermAssessments: (termId: Id): Promise<AssessmentDto[]> =>
    get<{ assessments: AssessmentDto[] }>(`/api/terms/${termId}/assessments`).then(
      (d) => d.assessments,
    ),

  listArtifactsForTopicVersion: (topicVersionId: Id): Promise<ArtifactDto[]> =>
    get<ListArtifactsResponse>(
      `/api/artifacts?parentType=topic_version&topicVersionId=${encodeURIComponent(topicVersionId)}`,
    ).then((d) => d.artifacts),
};

// Proxy every method through the mock-injection layer so tests can override
// individual methods without replacing the entire client.
export const redesignApi: typeof _api = new Proxy(_api, {
  get(target, prop) {
    const key = prop as keyof typeof _api;
    const m = activeMock?.[key];
    return m ?? target[key];
  },
}) as typeof _api;
