// Frozen Phase A REST contract for redesign issue #18.
// Phase B lanes may implement these handlers, but route shapes and exported
// request/response names are the interface of record.
//
// Amended for the Phase A.1 refreeze (Gate 0, see docs/plans/course-lm-topic-redesign-v2.md
// amendment v2.2): AssessmentType is generic string data (not schema vocabulary),
// Term gains an explicit lifecycle state, CalendarSlot gains advisory-only
// instructional capacity, Session gains an advisory-only instructional mode, and
// the contract expands to cover the full Plan/Run collection surface.
//
// Amended for the B.2R accepted contract (see
// docs/plans/course-planner-b2r-contract-proposal-2026-07-14.md), implemented
// against the B.3.1a schema root: adds the Activity-first identity/version
// graph (ActivityType, Activity, meeting/coursework/assessment detail),
// ordered LM Activity membership, Activity Topic actions/scope, milestone
// templates, Term adoption/delivery-revision/promotion preview-apply flows,
// and the Institution/Term calendar version/period/meeting-pattern/exception
// contract. LearningModuleVersionDto's legacy `topics` field is kept as
// deprecated compatibility data during the additive strangler stage.

export type Id = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type InstructorDto = { id: Id; name: string; email: string };
export type GetCurrentInstructorResponse = { instructor: InstructorDto };

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
  | "assessment"
  | "activity_version"
  | "term_activity_revision";

export type TermStatus = "planned" | "active" | "closed";

// ─── B.3.1a vocabulary: Activity identity, milestones, calendar periods ────
// Stable behavior families needed by lifecycle code; never the instructor-
// facing label for an Activity (that lives on ActivityTypeVersion.label).
export type ActivityBehaviorFamily = "meeting" | "coursework" | "assessment";
// Milestone roles are separate behavior from ActivityBehaviorFamily; the
// milestone's `label` remains free text.
export type MilestoneRole = "release" | "work" | "phase_release" | "review" | "due";
export type AcademicCalendarPeriodKind = "instructional" | "no_instruction" | "special_schedule";
export type TermMilestoneAnchorPolicy = "follow_activity" | "fixed_instant" | "standalone";
export type TermCalendarExceptionAction = "cancel" | "add" | "replace" | "modify";

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

export type MeetingRolePatternDto = {
  roleKey: string;
  label: string;
  sessionType: SessionType;
  days: string[];
};

export type MeetingPatternDto = {
  roles: MeetingRolePatternDto[];
};

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

export type AcademicCalendarVersionDto = {
  id: Id;
  academicCalendarId: Id;
  version: number;
  name: string;
  academicYear: string;
  sourceUri: string | null;
  publishedAt: IsoDateTime | null;
  archivedAt: IsoDateTime | null;
};
export type AcademicCalendarEventDto = {
  id: Id;
  academicCalendarId: Id;
  academicCalendarVersionId: Id | null;
  eventType: CalendarEventType;
  startsOn: IsoDate;
  endsOn: IsoDate;
  label: string;
  sourceUri: string | null;
};
export type UpsertAcademicCalendarEventRequest = {
  eventType: CalendarEventType;
  startsOn: IsoDate;
  endsOn: IsoDate;
  label: string;
  sourceUri?: string | null;
};
export type CreateAcademicCalendarVersionRequest = {
  name: string;
  academicYear: string;
  sourceUri?: string | null;
  events?: UpsertAcademicCalendarEventRequest[];
  periods?: CreateAcademicCalendarPeriodRequest[];
};
export type ListAcademicCalendarVersionsResponse = { versions: AcademicCalendarVersionDto[] };

export type AcademicCalendarPeriodDto = {
  id: Id;
  academicCalendarVersionId: Id;
  kind: AcademicCalendarPeriodKind;
  label: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
};
export type CreateAcademicCalendarPeriodRequest = {
  kind: AcademicCalendarPeriodKind;
  label: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
};
export type ListAcademicCalendarPeriodsResponse = { periods: AcademicCalendarPeriodDto[] };
export type CreateAcademicCalendarPeriodResponse = { period: AcademicCalendarPeriodDto };
export type GetAcademicCalendarVersionResponse = {
  version: AcademicCalendarVersionDto;
  events: AcademicCalendarEventDto[];
  periods: AcademicCalendarPeriodDto[];
};
export type CreateAcademicCalendarVersionResponse = GetAcademicCalendarVersionResponse;

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

// ─── Instructor vocabulary: ActivityType identity/version ──────────────────
// An Instructor owns an ActivityType identity holding the stable
// behaviorFamily; its immutable versions hold the instructor's custom label.
// Renaming ("Discussion" -> "Studio") is a new version, not a new identity.
export type ActivityTypeDto = {
  id: Id;
  instructorId: Id;
  behaviorFamily: ActivityBehaviorFamily;
  currentVersionId: Id | null;
  archivedAt: IsoDateTime | null;
};
export type ActivityTypeVersionDto = {
  id: Id;
  activityTypeId: Id;
  revision: number;
  label: string;
  description: string | null;
  changeSummary: string | null;
  publishedAt: IsoDateTime | null;
};
export type UpsertActivityTypeVersionRequest = {
  expectedCurrentVersionId?: Id;
  label: string;
  description?: string | null;
  changeSummary?: string | null;
  publish?: boolean;
};
export type CreateActivityTypeRequest = {
  behaviorFamily: ActivityBehaviorFamily;
  createdByInstructorId: Id;
  version: UpsertActivityTypeVersionRequest;
};
export type ListActivityTypesResponse = { activityTypes: ActivityTypeDto[] };
export type CreateActivityTypeResponse = {
  activityType: ActivityTypeDto;
  currentVersion: ActivityTypeVersionDto;
};
export type GetActivityTypeResponse = {
  activityType: ActivityTypeDto;
  currentVersion: ActivityTypeVersionDto | null;
};
// behaviorFamily is intentionally absent: an Activity Type's behavior family
// never changes after identity creation (a new behavior needs a new identity).
export type UpdateActivityTypeRequest = { archivedAt: IsoDateTime | null };
export type UpdateActivityTypeResponse = {
  activityType: ActivityTypeDto;
  currentVersion: ActivityTypeVersionDto | null;
};
export type ListActivityTypeVersionsResponse = { versions: ActivityTypeVersionDto[] };
export type CreateActivityTypeVersionResponse = { version: ActivityTypeVersionDto };

// A Course explicitly enables the ActivityTypeVersions it wants to offer.
export type CourseActivityTypeVersionDto = {
  courseId: Id;
  activityTypeVersionId: Id;
  enabledAt: IsoDateTime;
};
export type ReplaceCourseActivityTypeVersionsRequest = { activityTypeVersionIds: Id[] };
export type ListCourseActivityTypeVersionsResponse = {
  activityTypeVersions: CourseActivityTypeVersionDto[];
};
export type ReplaceCourseActivityTypeVersionsResponse = {
  activityTypeVersions: CourseActivityTypeVersionDto[];
};

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
// Ordered Activity-version membership: an LM version's real B.3 content.
// `LearningModuleVersionActivity` replaces `LearningModuleVersionTopic` as
// the source of "what's in this module" going forward.
export type LearningModuleVersionActivityDto = {
  activityVersionId: Id;
  sequence: number;
  notes: string | null;
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
  /**
   * @deprecated Legacy Topic membership, retained as read-only compatibility
   * data during the additive strangler stage. New membership is `activities`.
   */
  topics: LearningModuleVersionTopicDto[];
  activities?: LearningModuleVersionActivityDto[];
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
  /** @deprecated Compatibility input during the additive strangler stage; prefer `activities`. */
  topics?: LearningModuleVersionTopicDto[];
  activities?: LearningModuleVersionActivityDto[];
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
export type GetTopicVersionResponse = { version: TopicVersionDto };
export type CreateTopicVersionResponse = { version: TopicVersionDto };

// Topic prerequisites are a same-Course DAG edge: `topicId` depends on
// `prerequisiteTopicId`.
export type TopicPrerequisiteDto = {
  topicId: Id;
  prerequisiteTopicId: Id;
};
export type ListTopicPrerequisitesResponse = { prerequisites: TopicPrerequisiteDto[] };
export type ListCourseTopicPrerequisitesResponse = ListTopicPrerequisitesResponse;
export type ReplaceTopicPrerequisitesRequest = { prerequisiteTopicIds: Id[] };
export type ReplaceTopicPrerequisitesResponse = { prerequisites: TopicPrerequisiteDto[] };

// ─── Activity: Course-scoped shared planning identity ──────────────────────
// `Activity` is stable identity (id, courseId, stableCode, archive state).
// `ActivityVersion` carries shared reusable fields plus exactly one detail
// row matching its behaviorFamily. Projects normally use coursework behavior;
// exams normally use assessment behavior — the instructor's ActivityType
// decides the displayed noun, not the behaviorFamily.
export type ActivityDto = {
  id: Id;
  courseId: Id;
  stableCode: string;
  currentVersionId: Id | null;
  archivedAt: IsoDateTime | null;
};

export type MeetingActivityDetailDto = {
  behaviorFamily: "meeting";
  defaultDurationMinutes: number | null;
  modality: string | null;
  preparationNotes: string | null;
  authoringNotes: string | null;
};
export type CourseworkActivityDetailDto = {
  behaviorFamily: "coursework";
  submissionPolicy: string | null;
  releasePolicy: string | null;
  authoringNotes: string | null;
};
export type AssessmentActivityDetailDto = {
  behaviorFamily: "assessment";
  modality: string | null;
  authoringNotes: string | null;
};
// Discriminated on behaviorFamily so a caller can never confuse a meeting's
// modality with an assessment's, or attach coursework fields to a meeting.
export type ActivityDetailDto =
  | MeetingActivityDetailDto
  | CourseworkActivityDetailDto
  | AssessmentActivityDetailDto;

export type ActivityVersionDto = {
  id: Id;
  activityId: Id;
  revision: number;
  title: string;
  summary: string | null;
  activityTypeVersionId: Id;
  changeSummary: string | null;
  publishedAt: IsoDateTime | null;
  detail: ActivityDetailDto;
  milestoneTemplates: ActivityVersionMilestoneTemplateDto[];
};
export type UpsertActivityVersionRequest = {
  expectedCurrentVersionId?: Id;
  title: string;
  summary?: string | null;
  activityTypeVersionId: Id;
  changeSummary?: string | null;
  publish?: boolean;
  detail: ActivityDetailDto;
  milestoneTemplates?: UpsertMilestoneTemplateRequest[];
};
export type CreateActivityRequest = {
  stableCode: string;
  createdByInstructorId: Id;
  version: UpsertActivityVersionRequest;
};
export type ListActivitiesResponse = { activities: ActivityDto[] };
export type CreateActivityResponse = { activity: ActivityDto; currentVersion: ActivityVersionDto };
export type GetActivityResponse = { activity: ActivityDto; currentVersion: ActivityVersionDto | null };
export type UpdateActivityRequest = { stableCode?: string; archivedAt?: IsoDateTime | null };
export type UpdateActivityResponse = { activity: ActivityDto; currentVersion: ActivityVersionDto | null };
export type ListActivityVersionsResponse = { versions: ActivityVersionDto[] };
export type GetActivityVersionResponse = { version: ActivityVersionDto };
export type CreateActivityVersionResponse = { version: ActivityVersionDto };
export type PublishActivityVersionResponse = { version: ActivityVersionDto };

// `ActivityVersionLearningModuleScope`: an independent many-to-many link
// expressing e.g. "the final project recaps LM-01 through LM-06" without a
// primary placement. An Activity may have neither primary placement nor scope.
export type ActivityVersionLearningModuleScopeDto = {
  id: Id;
  activityVersionId: Id;
  learningModuleId: Id;
  emphasis: string | null;
  notes: string | null;
};
export type ReplaceActivityLmScopeRequest = {
  scopes: Array<{ learningModuleId: Id; emphasis?: string | null; notes?: string | null }>;
};
export type ListActivityLmScopeResponse = { scopes: ActivityVersionLearningModuleScopeDto[] };
export type ReplaceActivityLmScopeResponse = { scopes: ActivityVersionLearningModuleScopeDto[] };

// `ActivityVersionTopicAction`: the same Topic/action on different Activities
// is valid (repetition is intentional, e.g. reviewing a Topic again). Queries
// return sibling occurrences so the UI can warn and cross-link; the unique
// constraint only prevents an indistinguishable duplicate row on one version.
export type ActivityVersionTopicActionDto = {
  id: Id;
  activityVersionId: Id;
  topicVersionId: Id;
  action: CoverageLevel;
  notes: string | null;
  provenance: unknown | null;
};
export type ActivityTopicActionSiblingDto = {
  activityVersionId: Id;
  activityId: Id;
  activityStableCode: string;
  action: CoverageLevel;
};
export type ActivityVersionTopicActionWithSiblingsDto = ActivityVersionTopicActionDto & {
  siblings: ActivityTopicActionSiblingDto[];
};
export type ReplaceActivityTopicActionsRequest = {
  actions: Array<{
    topicVersionId: Id;
    action: CoverageLevel;
    notes?: string | null;
    provenance?: unknown;
  }>;
};
export type ListActivityTopicActionsResponse = {
  topicActions: ActivityVersionTopicActionWithSiblingsDto[];
};
export type ReplaceActivityTopicActionsResponse = {
  topicActions: ActivityVersionTopicActionWithSiblingsDto[];
};

// `ActivityTopicScope`: connects a project/exam to Topic identities without
// claiming a specific I/P/A occurrence (the future-compatible recap seam).
export type ActivityTopicScopeDto = {
  id: Id;
  activityId: Id;
  topicId: Id;
  notes: string | null;
  provenance: unknown | null;
};
export type ReplaceActivityTopicScopeRequest = {
  scopes: Array<{ topicId: Id; notes?: string | null; provenance?: unknown }>;
};
export type ListActivityTopicScopeResponse = { scopes: ActivityTopicScopeDto[] };
export type ReplaceActivityTopicScopeResponse = { scopes: ActivityTopicScopeDto[] };

// `ActivityVersionMilestoneTemplate`: ordered child of an Activity version.
// Templates never invent calendar dates before a Term exists; they are
// resolved during adoption and stay editable in the Term without rewriting
// the Course.
export type ActivityVersionMilestoneTemplateDto = {
  id: Id;
  activityVersionId: Id;
  sequence: number;
  role: MilestoneRole;
  label: string;
  linkedActivityId: Id | null;
  relativeDays: number | null;
  defaultTime: string | null;
  timeZone: string | null;
  notes: string | null;
  provenance: unknown | null;
};
export type UpsertMilestoneTemplateRequest = {
  sequence: number;
  role: MilestoneRole;
  label: string;
  linkedActivityId?: Id | null;
  relativeDays?: number | null;
  defaultTime?: string | null;
  timeZone?: string | null;
  notes?: string | null;
  provenance?: unknown;
};
export type ReplaceMilestoneTemplatesRequest = { templates: UpsertMilestoneTemplateRequest[] };
export type ListMilestoneTemplatesResponse = { templates: ActivityVersionMilestoneTemplateDto[] };
export type ReplaceMilestoneTemplatesResponse = { templates: ActivityVersionMilestoneTemplateDto[] };

export type TermDto = {
  id: Id;
  courseId: Id;
  institutionId: Id;
  academicCalendarId: Id;
  // Nullable migration pin: Prisma's `Term.academicCalendarVersionId` is
  // optional in M1 because requiring it here would force every existing
  // Term-reading consumer to handle a new required field before the B.3
  // Academic Calendar version identity/apply flow exists. Tighten to
  // required once Term creation always pins a version.
  academicCalendarVersionId?: Id | null;
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
  mode: "preview" | "apply";
  courseId: Id;
  institutionId: Id;
  academicCalendarId: Id;
  academicCalendarVersionId?: Id | null;
  code: string;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  meetingPattern: MeetingPatternDto;
};
export type ListTermsResponse = { terms: TermDto[] };
export type TermCalendarSlotProvenanceDto = {
  source: "academic_calendar_event" | "instructor_override" | "meeting_role_pattern";
  referenceId: Id | null;
  detail: string;
};
export type CalendarSlotCandidateDto = {
  date: IsoDate;
  slotType: SlotType;
  label: string | null;
  source: string;
  academicCalendarEventId: Id | null;
  meetingRoleKeys: string[];
  meetingRoleLabels: string[];
  instructionalCapacity: InstructionalCapacity;
  capacitySource: CapacitySource;
  capacityReason: string | null;
  provenance: TermCalendarSlotProvenanceDto[];
};
export type CalendarMaterializationConflictDto = {
  code: string;
  date: IsoDate | null;
  meetingRoleKey: string | null;
  message: string;
};
export type CreateTermPreviewResponse = {
  kind: "preview";
  calendarSlotCandidates: CalendarSlotCandidateDto[];
  conflicts: CalendarMaterializationConflictDto[];
  warnings: string[];
};
export type CreateTermApplyResponse = {
  kind: "applied";
  term: TermDto;
  calendarSlotCount: number;
  warnings: string[];
};
export type CreateTermResponse = CreateTermPreviewResponse | CreateTermApplyResponse;
export type GetTermResponse = { term: TermDto };
export type UpdateTermRequest = Partial<Omit<CreateTermRequest, "mode" | "courseId" | "institutionId">>;
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
  meetingPattern: MeetingPatternDto;
  learningModuleVersionSelections?: Array<{
    termLearningModuleId: Id;
    plannedLearningModuleVersionId: Id;
  }>;
};
export type CloneLearningModuleChoiceDto = {
  termLearningModuleId: Id;
  learningModuleId: Id;
  sourcePlannedLearningModuleVersionId: Id;
  sourceDeliveredLearningModuleVersionId: Id;
  defaultPlannedLearningModuleVersionId: Id;
  options: Array<{
    learningModuleVersionId: Id;
    label: "planned" | "delivered";
  }>;
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
  learningModuleChoices: CloneLearningModuleChoiceDto[];
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

// ─── Term Activity: shared occurrence identity + immutable delivery revisions ───

export type TermActivityDto = {
  id: Id;
  termId: Id;
  courseId: Id;
  activityId: Id;
  plannedActivityVersionId: Id;
  activityTypeVersionId: Id;
  adoptedLabel: string;
  termLearningModuleId: Id | null;
  ordinal: number | null;
  lifecycleState: string | null;
  plannedRevisionId: Id | null;
  deliveredRevisionId: Id | null;
  archivedAt: IsoDateTime | null;
};

// Detail rows discriminate on behaviorFamily, matching ActivityDetailDto.
// Meeting delivery detail stores calendar slot/timing/status/override
// evidence; coursework/assessment store their distinct lifecycle state.
// Release/due/review timing lives in milestones, not a single overloaded
// `date` column.
export type MeetingRevisionDetailDto = {
  behaviorFamily: "meeting";
  calendarSlotId: Id | null;
  startsAt: IsoDateTime | null;
  endsAt: IsoDateTime | null;
  status: string | null;
  modality: string | null;
  overrideReason: string | null;
  overrideEvidence: unknown | null;
};
export type CourseworkRevisionDetailDto = {
  behaviorFamily: "coursework";
  lifecycleState: string | null;
  deliveryNotes: string | null;
};
export type AssessmentRevisionDetailDto = {
  behaviorFamily: "assessment";
  lifecycleState: string | null;
  modality: string | null;
  deliveryNotes: string | null;
};
export type TermActivityRevisionDetailDto =
  | MeetingRevisionDetailDto
  | CourseworkRevisionDetailDto
  | AssessmentRevisionDetailDto;

export type TermActivityRevisionTopicActionDto = {
  id: Id;
  termActivityRevisionId: Id;
  topicVersionId: Id;
  action: CoverageLevel;
  notes: string | null;
  provenance: unknown | null;
};

// Anchoring policy: `follow_activity` recomputes the instant when the linked
// meeting moves; `fixed_instant` preserves the instant while retaining the
// linked Activity as context; `standalone` requires an exact instant with no
// Activity anchor. At least one of linkedTermActivityId/occursAt is required
// (a fixed milestone may have both, e.g. "P1 due 08:00 the morning of L19").
export type TermActivityMilestoneDto = {
  id: Id;
  termActivityRevisionId: Id;
  sourceTemplateId: Id | null;
  role: MilestoneRole;
  label: string;
  linkedTermActivityId: Id | null;
  occursAt: IsoDateTime | null;
  timeZone: string | null;
  anchorPolicy: TermMilestoneAnchorPolicy;
  notes: string | null;
  provenance: unknown | null;
};

// `TermActivityRevision` is an immutable Term-scoped snapshot. The first
// revision is materialized from the plan; active-Term changes create a
// candidate revision via preview/apply below, then atomically advance
// `TermActivity.deliveredRevisionId`.
export type TermActivityRevisionDto = {
  id: Id;
  termActivityId: Id;
  revision: number;
  baseActivityVersionId: Id;
  title: string;
  summary: string | null;
  changeReason: string | null;
  createdByInstructorId: Id | null;
  createdAt: IsoDateTime;
  detail: TermActivityRevisionDetailDto;
  topicActions: TermActivityRevisionTopicActionDto[];
  milestones: TermActivityMilestoneDto[];
};

// ─── Preview/apply impact shapes shared by adoption, revision, promotion, calendar ───
// Typed issues, sibling duplicate Topic/action links, and calendar conflicts,
// without becoming UI view models.

export type ActivityTopicActionConflictDto = {
  code: string;
  topicVersionId: Id;
  action: CoverageLevel;
  siblingActivityVersionId: Id;
  siblingActivityId: Id;
  siblingActivityStableCode: string;
  message: string;
};

export type PreviewImpactDto = {
  issues: PlanningIssueDto[];
  topicActionDuplicates: ActivityTopicActionConflictDto[];
  calendarConflicts: CalendarMaterializationConflictDto[];
};

// ─── Term adoption preview/apply ───────────────────────────────────────────
// Term creation previews adoption from selected LM versions plus explicitly
// selected cross-cutting Activity versions; apply validates version
// ownership, unique primary placement, type availability, and ordinal
// collisions. It does not schedule content merely because it belongs to an LM.

export type TermActivityAdoptionSelectionDto = {
  activityId: Id;
  activityVersionId: Id;
  termLearningModuleId?: Id | null;
};
export type TermAdoptionPreviewRequest = {
  learningModuleVersionSelections: Array<{ termLearningModuleId: Id; learningModuleVersionId: Id }>;
  crossCuttingSelections: TermActivityAdoptionSelectionDto[];
};
export type TermActivityAdoptionCandidateDto = {
  activityId: Id;
  activityVersionId: Id;
  adoptedLabel: string;
  ordinal: number | null;
  termLearningModuleId: Id | null;
};
export type TermAdoptionPreviewResponse = {
  kind: "preview";
  previewToken: string;
  // Pointer proving no concurrent adoption happened between preview and
  // apply: the number of TermActivity rows already adopted for this Term.
  expectedCurrentActivityCount: number;
  candidates: TermActivityAdoptionCandidateDto[];
  impact: PreviewImpactDto;
};
export type TermAdoptionApplyRequest = TermAdoptionPreviewRequest & {
  previewToken: string;
  expectedCurrentActivityCount: number;
};
export type TermAdoptionApplyResponse = {
  kind: "applied";
  termActivities: TermActivityDto[];
};

export type ListTermActivitiesResponse = { termActivities: TermActivityDto[] };
export type GetTermActivityResponse = { termActivity: TermActivityDto };

// ─── Term Activity revision preview/apply ──────────────────────────────────
// Term milestone additions/edits/removals are part of this payload; applied
// milestone history is never patched in place.

export type UpsertTermActivityMilestoneRequest = {
  sourceTemplateId?: Id | null;
  role: MilestoneRole;
  label: string;
  linkedTermActivityId?: Id | null;
  occursAt?: IsoDateTime | null;
  timeZone?: string | null;
  anchorPolicy: TermMilestoneAnchorPolicy;
  notes?: string | null;
  provenance?: unknown;
};
export type TermActivityRevisionPreviewRequest = {
  title: string;
  summary?: string | null;
  changeReason?: string | null;
  detail: TermActivityRevisionDetailDto;
  topicActions?: Array<{
    topicVersionId: Id;
    action: CoverageLevel;
    notes?: string | null;
    provenance?: unknown;
  }>;
  milestones?: UpsertTermActivityMilestoneRequest[];
};
export type TermActivityRevisionPreviewResponse = {
  kind: "preview";
  previewToken: string;
  expectedCurrentRevisionId: Id | null;
  proposedRevision: TermActivityRevisionDto;
  impact: PreviewImpactDto;
};
export type TermActivityRevisionApplyRequest = TermActivityRevisionPreviewRequest & {
  previewToken: string;
  expectedCurrentRevisionId: Id | null;
  // Which TermActivity pointer this revision becomes current for.
  advancePointer: "planned" | "delivered";
};
export type TermActivityRevisionApplyResponse = {
  kind: "applied";
  termActivity: TermActivityDto;
  revision: TermActivityRevisionDto;
};

// ─── Selective delivery promotion ──────────────────────────────────────────
// Promotion from a delivered revision creates a new Course Activity draft
// only after this separate preview/apply decision; it never happens
// automatically.

export type PromotedActivityDraftDto = {
  activityId: Id;
  fromTermActivityRevisionId: Id;
  proposedActivityVersion: {
    title: string;
    summary: string | null;
    detail: ActivityDetailDto;
    topicActions: Array<{ topicVersionId: Id; action: CoverageLevel }>;
  };
};
export type PromoteDeliveryPreviewRequest = { termActivityIds: Id[] };
export type PromoteDeliveryPreviewResponse = {
  kind: "preview";
  previewToken: string;
  // Pointer proving the Course Activity hasn't moved since preview: current
  // Activity.currentVersionId per activityId being promoted.
  expectedCurrentActivityVersionIds: Array<{ activityId: Id; activityVersionId: Id }>;
  drafts: PromotedActivityDraftDto[];
  impact: PreviewImpactDto;
};
export type PromoteDeliveryApplyRequest = {
  previewToken: string;
  expectedCurrentActivityVersionIds: Array<{ activityId: Id; activityVersionId: Id }>;
  termActivityIds: Id[];
};
export type PromoteDeliveryApplyResponse = {
  kind: "applied";
  createdVersions: ActivityVersionDto[];
};

// ─── Term meeting patterns and Term-only calendar exceptions ──────────────

export type TermMeetingPatternDto = {
  id: Id;
  termId: Id;
  activityTypeVersionId: Id;
  label: string | null;
  daysOfWeek: string[];
  startTimeLocal: string;
  endTimeLocal: string | null;
  timeZone: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
};
export type UpsertTermMeetingPatternRequest = {
  activityTypeVersionId: Id;
  label?: string | null;
  daysOfWeek: string[];
  startTimeLocal: string;
  endTimeLocal?: string | null;
  timeZone: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
};
export type ListTermMeetingPatternsResponse = { meetingPatterns: TermMeetingPatternDto[] };

// `TermCalendarException` overlays the materialized calendar with cancel/
// add/replace/modify plus reason and provenance. A meeting scheduled outside
// an available slot requires an explicit Term exception or meeting override
// reason.
export type TermCalendarExceptionDto = {
  id: Id;
  termId: Id;
  action: TermCalendarExceptionAction;
  activityTypeVersionId: Id | null;
  calendarSlotId: Id | null;
  targetDate: IsoDate | null;
  startsAt: IsoDateTime | null;
  endsAt: IsoDateTime | null;
  label: string | null;
  reason: string | null;
  provenance: unknown | null;
};
export type CreateTermCalendarExceptionRequest = {
  action: TermCalendarExceptionAction;
  activityTypeVersionId?: Id | null;
  calendarSlotId?: Id | null;
  targetDate?: IsoDate | null;
  startsAt?: IsoDateTime | null;
  endsAt?: IsoDateTime | null;
  label?: string | null;
  reason?: string | null;
  provenance?: unknown;
};
export type ListTermCalendarExceptionsResponse = { exceptions: TermCalendarExceptionDto[] };
export type CreateTermCalendarExceptionResponse = { exception: TermCalendarExceptionDto };
export type UpdateTermCalendarExceptionRequest = Partial<CreateTermCalendarExceptionRequest>;
export type UpdateTermCalendarExceptionResponse = { exception: TermCalendarExceptionDto };

// ─── Term calendar materialization preview/apply ───────────────────────────
// Calendar preview combines TermMeetingPattern rules with the pinned
// Institution events/periods; materialization creates CalendarSlot
// containers only and never moves a Term Activity without a separate apply.

export type TermCalendarPreviewRequest = {
  meetingPatterns: UpsertTermMeetingPatternRequest[];
};
export type TermCalendarPreviewResponse = {
  kind: "preview";
  previewToken: string;
  expectedCurrentCalendarSlotCount: number;
  calendarSlotCandidates: CalendarSlotCandidateDto[];
  conflicts: CalendarMaterializationConflictDto[];
  warnings: string[];
};
export type TermCalendarApplyRequest = {
  previewToken: string;
  expectedCurrentCalendarSlotCount: number;
  meetingPatterns: UpsertTermMeetingPatternRequest[];
};
export type TermCalendarApplyResponse = {
  kind: "applied";
  calendarSlotCount: number;
  warnings: string[];
};

export type SessionDto = {
  id: Id;
  termId: Id;
  termLearningModuleId: Id | null;
  calendarSlotId: Id | null;
  sequence: number;
  sessionType: SessionType;
  code: string;
  title: string;
  date: IsoDate | null;
  scheduleOverrideLabel: string | null;
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
  scheduleOverrideLabel?: string | null;
  description?: string | null;
  format?: string | null;
  notes?: string | null;
  instructionalMode?: InstructionalMode;
};
export type ListTermSessionsResponse = { sessions: SessionDto[] };
export type CreateTermSessionResponse = { session: SessionDto };
export type GetSessionResponse = { session: SessionDto };
export type UpdateSessionRequest = Partial<
  Omit<SessionDto, "id" | "termId" | "calendarSlotId" | "status" | "canceledAt" | "canceledReason">
>;
export type UpdateSessionResponse = { session: SessionDto };

export type MoveSessionRequest = {
  date?: IsoDate | null;
  scheduleOverrideLabel?: string | null;
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
  activityVersionId?: Id | null;
  termActivityRevisionId?: Id | null;
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
export type ArtifactHardRemovalPreviewResponse = {
  kind: "hard_removal_preview";
  artifactId: Id;
  canRemove: boolean;
  blockers: Array<{
    code: string;
    count: number;
    message: string;
  }>;
};
export type DeleteArtifactResponse =
  | { kind: "archived"; artifact: ArtifactDto }
  | ArtifactHardRemovalPreviewResponse
  | {
      kind: "hard_removed";
      artifactId: Id;
      audit: {
        removedAt: IsoDateTime;
        summary: string;
      };
    };

// Array-first so tests can validate route stubs at runtime against the same
// source of truth the CanonicalRoute type is derived from.
export const CANONICAL_ROUTES = [
  "/api/instructors/me",
  "/api/institutions",
  "/api/academic-calendars",
  "/api/academic-calendars/[id]",
  "/api/academic-calendars/[id]/versions",
  "/api/academic-calendar-versions/[id]",
  "/api/courses",
  "/api/courses/[id]",
  "/api/courses/[id]/institutions",
  "/api/courses/[id]/learning-modules",
  "/api/learning-modules/[id]",
  "/api/learning-modules/[id]/versions",
  "/api/courses/[id]/topics",
  "/api/courses/[id]/topic-prerequisites",
  "/api/topic-versions/[id]",
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

  // B.2R accepted contract: Instructor vocabulary and Course design
  "/api/instructors/me/activity-types",
  "/api/activity-types/[id]",
  "/api/activity-types/[id]/versions",
  "/api/courses/[id]/activity-types",
  "/api/courses/[id]/activities",
  "/api/activities/[id]",
  "/api/activities/[id]/versions",
  "/api/activity-versions/[id]",
  "/api/activity-versions/[id]/publish",
  "/api/activity-versions/[id]/topic-actions",
  "/api/activity-versions/[id]/lm-scope",
  "/api/activity-versions/[id]/topic-scope",

  // B.2R accepted contract: Term plan and run
  "/api/terms/[id]/adoption-preview",
  "/api/terms/[id]/adoption-apply",
  "/api/terms/[id]/activities",
  "/api/term-activities/[id]",
  "/api/term-activities/[id]/revision-preview",
  "/api/term-activities/[id]/revision-apply",
  "/api/terms/[id]/promote-delivery-preview",
  "/api/terms/[id]/promote-delivery-apply",

  // B.2R accepted contract: Calendar
  "/api/terms/[id]/calendar-preview",
  "/api/terms/[id]/calendar-apply",
  "/api/terms/[id]/calendar-exceptions",
  "/api/term-calendar-exceptions/[id]",
] as const;

export type CanonicalRoute = (typeof CANONICAL_ROUTES)[number];
