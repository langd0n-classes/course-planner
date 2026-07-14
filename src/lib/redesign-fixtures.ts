// Deterministic, data-only test fixtures for B.3 Activity-first types.
// All factories return fresh nested objects/arrays; no Prisma, database, or network imports.

import type {
  ActivityDto,
  ActivityVersionDto,
  ActivityTypeDto,
  ActivityTypeVersionDto,
  MeetingActivityDetailDto,
  CourseworkActivityDetailDto,
  ActivityVersionMilestoneTemplateDto,
  TermActivityDto,
  TermActivityRevisionDto,
  TermCalendarExceptionDto,
  AcademicCalendarVersionDto,
  AcademicCalendarPeriodDto,
  MeetingRevisionDetailDto,
  CourseworkRevisionDetailDto,
  TermActivityMilestoneDto,
  TermActivityRevisionTopicActionDto,
  UpsertActivityVersionRequest,
  TermActivityRevisionPreviewRequest,
  CreateTermCalendarExceptionRequest,
  CreateAcademicCalendarVersionRequest,
  UpsertTermMeetingPatternRequest,
  UpsertAcademicCalendarEventRequest,
  CreateAcademicCalendarPeriodRequest,
} from "./redesign-contract";

// Fixed UUIDs for deterministic testing
const INSTRUCTOR_ID = "00000000-0000-4000-8000-000000000001";
const COURSE_ID = "00000000-0000-4000-8000-000000000002";
const INSTITUTION_ID = "00000000-0000-4000-8000-000000000003";
const CALENDAR_ID = "00000000-0000-4000-8000-000000000004";
const CALENDAR_VERSION_ID = "00000000-0000-4000-8000-000000000005";

const MEETING_TYPE_ID = "00000000-0000-4000-8000-000000000010";
const MEETING_TYPE_VERSION_ID = "00000000-0000-4000-8000-000000000011";
const COURSEWORK_TYPE_ID = "00000000-0000-4000-8000-000000000012";
const COURSEWORK_TYPE_VERSION_ID = "00000000-0000-4000-8000-000000000013";

const MEETING_ACTIVITY_ID = "00000000-0000-4000-8000-000000000020";
const MEETING_ACTIVITY_VERSION_ID = "00000000-0000-4000-8000-000000000021";
const COURSEWORK_ACTIVITY_ID = "00000000-0000-4000-8000-000000000022";
const COURSEWORK_ACTIVITY_VERSION_ID = "00000000-0000-4000-8000-000000000023";

const TERM_ID = "00000000-0000-4000-8000-000000000030";
const TERM_ACTIVITY_ID = "00000000-0000-4000-8000-000000000031";
const TERM_ACTIVITY_REVISION_ID = "00000000-0000-4000-8000-000000000032";

const MILESTONE_TEMPLATE_ID_1 = "00000000-0000-4000-8000-000000000100";
const MILESTONE_TEMPLATE_ID_2 = "00000000-0000-4000-8000-000000000101";
const MILESTONE_TEMPLATE_ID_3 = "00000000-0000-4000-8000-000000000102";
const MILESTONE_TEMPLATE_ID_4 = "00000000-0000-4000-8000-000000000103";

const TERM_ACTIVITY_MILESTONE_ID = "00000000-0000-4000-8000-000000000104";
const TERM_ACTIVITY_TOPIC_ACTION_ID = "00000000-0000-4000-8000-000000000105";
const TERM_CALENDAR_EXCEPTION_ID = "00000000-0000-4000-8000-000000000106";
const ACADEMIC_CALENDAR_PERIOD_ID = "00000000-0000-4000-8000-000000000107";
const CALENDAR_EVENT_ID = "00000000-0000-4000-8000-000000000108";

// Fixed dates for deterministic testing
const TERM_START = "2025-01-13";
const TERM_END = "2025-05-16";
const CALENDAR_VERSION_PUBLISHED = "2024-11-01T12:00:00Z";
const TERM_CREATED = "2024-12-15T10:30:00Z";

/** Factory for an instructor-labeled meeting ActivityType and its version */
export function createMeetingActivityType(
  overrides?: Partial<ActivityTypeDto>
): ActivityTypeDto {
  return {
    id: MEETING_TYPE_ID,
    instructorId: INSTRUCTOR_ID,
    behaviorFamily: "meeting",
    currentVersionId: MEETING_TYPE_VERSION_ID,
    archivedAt: null,
    ...overrides,
  } satisfies ActivityTypeDto;
}

/** Factory for a meeting ActivityTypeVersion with instructor's custom label */
export function createMeetingActivityTypeVersion(
  overrides?: Partial<ActivityTypeVersionDto>
): ActivityTypeVersionDto {
  return {
    id: MEETING_TYPE_VERSION_ID,
    activityTypeId: MEETING_TYPE_ID,
    revision: 1,
    label: "Lecture",
    description: "Synchronous classroom meeting",
    changeSummary: null,
    publishedAt: CALENDAR_VERSION_PUBLISHED,
    ...overrides,
  } satisfies ActivityTypeVersionDto;
}

/** Factory for a coursework ActivityType */
export function createCourseworkActivityType(
  overrides?: Partial<ActivityTypeDto>
): ActivityTypeDto {
  return {
    id: COURSEWORK_TYPE_ID,
    instructorId: INSTRUCTOR_ID,
    behaviorFamily: "coursework",
    currentVersionId: COURSEWORK_TYPE_VERSION_ID,
    archivedAt: null,
    ...overrides,
  } satisfies ActivityTypeDto;
}

/** Factory for a coursework ActivityTypeVersion */
export function createCourseworkActivityTypeVersion(
  overrides?: Partial<ActivityTypeVersionDto>
): ActivityTypeVersionDto {
  return {
    id: COURSEWORK_TYPE_VERSION_ID,
    activityTypeId: COURSEWORK_TYPE_ID,
    revision: 1,
    label: "Project",
    description: "Multi-week applied project",
    changeSummary: null,
    publishedAt: CALENDAR_VERSION_PUBLISHED,
    ...overrides,
  } satisfies ActivityTypeVersionDto;
}

/** Factory for meeting Activity detail */
export function createMeetingActivityDetail(
  overrides?: Partial<MeetingActivityDetailDto>
): MeetingActivityDetailDto {
  return {
    behaviorFamily: "meeting",
    defaultDurationMinutes: 75,
    modality: "in-person",
    preparationNotes: "Read chapters 3-5",
    authoringNotes: "Interactive slides prepared",
    ...overrides,
  } satisfies MeetingActivityDetailDto;
}

/** Factory for coursework Activity detail */
export function createCourseworkActivityDetail(
  overrides?: Partial<CourseworkActivityDetailDto>
): CourseworkActivityDetailDto {
  return {
    behaviorFamily: "coursework",
    submissionPolicy: "Electronic submission via portal",
    releasePolicy: "Released one week before due date",
    authoringNotes: "Scaffold approach in stages",
    ...overrides,
  } satisfies CourseworkActivityDetailDto;
}

/** Factory for meeting Activity with reusable meeting type */
export function createMeetingActivity(
  overrides?: Partial<ActivityDto>
): ActivityDto {
  return {
    id: MEETING_ACTIVITY_ID,
    courseId: COURSE_ID,
    stableCode: "lecture-01",
    currentVersionId: MEETING_ACTIVITY_VERSION_ID,
    archivedAt: null,
    ...overrides,
  } satisfies ActivityDto;
}

/** Factory for meeting ActivityVersion */
export function createMeetingActivityVersion(
  overrides?: Partial<ActivityVersionDto>
): ActivityVersionDto {
  return {
    id: MEETING_ACTIVITY_VERSION_ID,
    activityId: MEETING_ACTIVITY_ID,
    revision: 1,
    title: "Lecture 01: Introduction to Designing",
    summary: "Overview of design principles and methodology",
    activityTypeVersionId: MEETING_TYPE_VERSION_ID,
    changeSummary: null,
    publishedAt: CALENDAR_VERSION_PUBLISHED,
    detail: createMeetingActivityDetail(),
    milestoneTemplates: [
      createMilestoneTemplate({
        sequence: 1,
        role: "release",
        label: "Slides published",
      }),
    ],
    ...overrides,
  } satisfies ActivityVersionDto;
}

/** Factory for coursework Activity with multiple milestone templates */
export function createCourseworkActivity(
  overrides?: Partial<ActivityDto>
): ActivityDto {
  return {
    id: COURSEWORK_ACTIVITY_ID,
    courseId: COURSE_ID,
    stableCode: "project-01",
    currentVersionId: COURSEWORK_ACTIVITY_VERSION_ID,
    archivedAt: null,
    ...overrides,
  } satisfies ActivityDto;
}

/** Factory for coursework ActivityVersion with cross-cutting milestones */
export function createCourseworkActivityVersion(
  overrides?: Partial<ActivityVersionDto>
): ActivityVersionDto {
  return {
    id: COURSEWORK_ACTIVITY_VERSION_ID,
    activityId: COURSEWORK_ACTIVITY_ID,
    revision: 1,
    title: "Project 1: Data Visualization",
    summary: "Build an interactive visualization with real dataset",
    activityTypeVersionId: COURSEWORK_TYPE_VERSION_ID,
    changeSummary: null,
    publishedAt: CALENDAR_VERSION_PUBLISHED,
    detail: createCourseworkActivityDetail(),
    milestoneTemplates: [
      createMilestoneTemplate({
        sequence: 1,
        role: "release",
        label: "Project released",
      }),
      createMilestoneTemplate({
        sequence: 2,
        role: "phase_release",
        label: "Phase 1: Prototype due",
        relativeDays: 7,
      }),
      createMilestoneTemplate({
        sequence: 3,
        role: "phase_release",
        label: "Phase 2: Peer review due",
        relativeDays: 14,
      }),
      createMilestoneTemplate({
        sequence: 4,
        role: "due",
        label: "Final submission due",
        relativeDays: 21,
      }),
    ],
    ...overrides,
  } satisfies ActivityVersionDto;
}

/** Factory for milestone template */
export function createMilestoneTemplate(
  overrides?: Partial<ActivityVersionMilestoneTemplateDto>
): ActivityVersionMilestoneTemplateDto {
  return {
    id: MILESTONE_TEMPLATE_ID_1,
    activityVersionId: COURSEWORK_ACTIVITY_VERSION_ID,
    sequence: 1,
    role: "due",
    label: "Default milestone",
    linkedActivityId: null,
    relativeDays: null,
    defaultTime: "23:59",
    timeZone: "America/New_York",
    notes: null,
    provenance: null,
    ...overrides,
  } satisfies ActivityVersionMilestoneTemplateDto;
}

/** Factory for meeting revision detail in Term context */
export function createMeetingRevisionDetail(
  overrides?: Partial<MeetingRevisionDetailDto>
): MeetingRevisionDetailDto {
  return {
    behaviorFamily: "meeting",
    calendarSlotId: null,
    startsAt: "2025-01-20T10:00:00Z",
    endsAt: "2025-01-20T11:15:00Z",
    status: "scheduled",
    modality: "in-person",
    overrideReason: null,
    overrideEvidence: null,
    ...overrides,
  } satisfies MeetingRevisionDetailDto;
}

/** Factory for coursework revision detail in Term context */
export function createCourseworkRevisionDetail(
  overrides?: Partial<CourseworkRevisionDetailDto>
): CourseworkRevisionDetailDto {
  return {
    behaviorFamily: "coursework",
    lifecycleState: "assigned",
    deliveryNotes: "Submission accepted via portal",
    ...overrides,
  } satisfies CourseworkRevisionDetailDto;
}

/** Factory for Term Activity milestone */
export function createTermActivityMilestone(
  overrides?: Partial<TermActivityMilestoneDto>
): TermActivityMilestoneDto {
  return {
    id: TERM_ACTIVITY_MILESTONE_ID,
    termActivityRevisionId: TERM_ACTIVITY_REVISION_ID,
    sourceTemplateId: null,
    role: "due",
    label: "Due date",
    linkedTermActivityId: null,
    occursAt: "2025-02-10T23:59:00Z",
    timeZone: "America/New_York",
    anchorPolicy: "fixed_instant",
    notes: null,
    provenance: null,
    ...overrides,
  } satisfies TermActivityMilestoneDto;
}

/** Factory for Topic action in Term Activity revision */
export function createTermActivityRevisionTopicAction(
  overrides?: Partial<TermActivityRevisionTopicActionDto>
): TermActivityRevisionTopicActionDto {
  return {
    id: TERM_ACTIVITY_TOPIC_ACTION_ID,
    termActivityRevisionId: TERM_ACTIVITY_REVISION_ID,
    topicVersionId: "00000000-0000-4000-8000-000000000050",
    action: "practiced",
    notes: null,
    provenance: null,
    ...overrides,
  } satisfies TermActivityRevisionTopicActionDto;
}

/** Factory for Term Activity revision */
export function createTermActivityRevision(
  overrides?: Partial<TermActivityRevisionDto>
): TermActivityRevisionDto {
  return {
    id: TERM_ACTIVITY_REVISION_ID,
    termActivityId: TERM_ACTIVITY_ID,
    revision: 1,
    baseActivityVersionId: COURSEWORK_ACTIVITY_VERSION_ID,
    title: "Project 1: Data Visualization (Delivered)",
    summary: "Completed with peer feedback incorporated",
    changeReason: "Initial adoption",
    createdByInstructorId: INSTRUCTOR_ID,
    createdAt: TERM_CREATED,
    detail: createCourseworkRevisionDetail(),
    topicActions: [createTermActivityRevisionTopicAction()],
    milestones: [createTermActivityMilestone()],
    ...overrides,
  } satisfies TermActivityRevisionDto;
}

/** Factory for adopted Term Activity with immutable delivery revision */
export function createTermActivity(
  overrides?: Partial<TermActivityDto>
): TermActivityDto {
  return {
    id: TERM_ACTIVITY_ID,
    termId: TERM_ID,
    courseId: COURSE_ID,
    activityId: COURSEWORK_ACTIVITY_ID,
    plannedActivityVersionId: COURSEWORK_ACTIVITY_VERSION_ID,
    activityTypeVersionId: COURSEWORK_TYPE_VERSION_ID,
    adoptedLabel: "Project 1: Data Visualization",
    termLearningModuleId: null,
    ordinal: 1,
    lifecycleState: "active",
    plannedRevisionId: TERM_ACTIVITY_REVISION_ID,
    deliveredRevisionId: TERM_ACTIVITY_REVISION_ID,
    archivedAt: null,
    ...overrides,
  } satisfies TermActivityDto;
}

/** Factory for Term calendar exception */
export function createTermCalendarException(
  overrides?: Partial<TermCalendarExceptionDto>
): TermCalendarExceptionDto {
  return {
    id: TERM_CALENDAR_EXCEPTION_ID,
    termId: TERM_ID,
    action: "cancel",
    activityTypeVersionId: MEETING_TYPE_VERSION_ID,
    calendarSlotId: null,
    targetDate: "2025-03-17",
    startsAt: null,
    endsAt: null,
    label: "Spring Break",
    reason: "University holiday",
    provenance: null,
    ...overrides,
  } satisfies TermCalendarExceptionDto;
}

/** Factory for Academic Calendar period */
export function createAcademicCalendarPeriod(
  overrides?: Partial<AcademicCalendarPeriodDto>
): AcademicCalendarPeriodDto {
  return {
    id: ACADEMIC_CALENDAR_PERIOD_ID,
    academicCalendarVersionId: CALENDAR_VERSION_ID,
    kind: "instructional",
    label: "Spring Instructional Period",
    startsOn: "2025-01-13",
    endsOn: "2025-05-02",
    ...overrides,
  } satisfies AcademicCalendarPeriodDto;
}

/** Factory for Academic Calendar version */
export function createAcademicCalendarVersion(
  overrides?: Partial<AcademicCalendarVersionDto>
): AcademicCalendarVersionDto {
  return {
    id: CALENDAR_VERSION_ID,
    academicCalendarId: CALENDAR_ID,
    version: 1,
    name: "Academic Year 2024-2025",
    academicYear: "2024-2025",
    sourceUri: null,
    publishedAt: CALENDAR_VERSION_PUBLISHED,
    archivedAt: null,
    ...overrides,
  } satisfies AcademicCalendarVersionDto;
}

/** Factory for meeting UpsertActivityVersionRequest */
export function createMeetingActivityVersionRequest(
  overrides?: Partial<UpsertActivityVersionRequest>
): UpsertActivityVersionRequest {
  return {
    title: "Lecture 01: Introduction to Designing",
    summary: "Overview of design principles and methodology",
    activityTypeVersionId: MEETING_TYPE_VERSION_ID,
    detail: createMeetingActivityDetail(),
    milestoneTemplates: [
      {
        sequence: 1,
        role: "release",
        label: "Slides published",
        defaultTime: "23:59",
        timeZone: "America/New_York",
      },
    ],
    ...overrides,
  };
}

/** Factory for coursework UpsertActivityVersionRequest with multiple milestone templates */
export function createCourseworkActivityVersionRequest(
  overrides?: Partial<UpsertActivityVersionRequest>
): UpsertActivityVersionRequest {
  return {
    title: "Project 1: Data Visualization",
    summary: "Build an interactive visualization with real dataset",
    activityTypeVersionId: COURSEWORK_TYPE_VERSION_ID,
    detail: createCourseworkActivityDetail(),
    milestoneTemplates: [
      {
        sequence: 1,
        role: "release",
        label: "Project released",
        defaultTime: "23:59",
        timeZone: "America/New_York",
      },
      {
        sequence: 2,
        role: "phase_release",
        label: "Phase 1: Prototype due",
        relativeDays: 7,
        defaultTime: "23:59",
        timeZone: "America/New_York",
      },
      {
        sequence: 3,
        role: "phase_release",
        label: "Phase 2: Peer review due",
        relativeDays: 14,
        defaultTime: "23:59",
        timeZone: "America/New_York",
      },
      {
        sequence: 4,
        role: "due",
        label: "Final submission due",
        relativeDays: 21,
        defaultTime: "23:59",
        timeZone: "America/New_York",
      },
    ],
    ...overrides,
  };
}

/** Factory for TermActivityRevisionPreviewRequest */
export function createTermActivityRevisionPreviewRequest(
  overrides?: Partial<TermActivityRevisionPreviewRequest>
): TermActivityRevisionPreviewRequest {
  return {
    title: "Project 1: Data Visualization (Delivered)",
    summary: "Completed with peer feedback incorporated",
    changeReason: "Initial adoption",
    detail: createCourseworkRevisionDetail(),
    topicActions: [
      {
        topicVersionId: "00000000-0000-4000-8000-000000000050",
        action: "practiced",
      },
    ],
    milestones: [
      {
        role: "due",
        label: "Due date",
        anchorPolicy: "fixed_instant",
        occursAt: "2025-02-10T23:59:00Z",
        timeZone: "America/New_York",
      },
    ],
    ...overrides,
  };
}

/** Factory for CreateTermCalendarExceptionRequest */
export function createTermCalendarExceptionRequest(
  overrides?: Partial<CreateTermCalendarExceptionRequest>
): CreateTermCalendarExceptionRequest {
  return {
    action: "cancel",
    activityTypeVersionId: MEETING_TYPE_VERSION_ID,
    targetDate: "2025-03-12",
    label: "Spring Break",
    reason: "University holiday",
    ...overrides,
  };
}

/** Factory for CreateAcademicCalendarVersionRequest with event and special-schedule period */
export function createAcademicCalendarVersionRequest(
  overrides?: Partial<CreateAcademicCalendarVersionRequest>
): CreateAcademicCalendarVersionRequest {
  return {
    name: "Academic Year 2024-2025",
    academicYear: "2024-2025",
    events: [
      {
        eventType: "term_start",
        startsOn: "2025-01-13",
        endsOn: "2025-01-13",
        label: "Term starts",
      },
    ],
    periods: [
      {
        kind: "instructional",
        label: "Spring Instructional Period",
        startsOn: "2025-01-13",
        endsOn: "2025-05-02",
      },
      {
        kind: "no_instruction",
        label: "Spring Break",
        startsOn: "2025-03-10",
        endsOn: "2025-03-16",
      },
      {
        kind: "special_schedule",
        label: "Finals",
        startsOn: "2025-05-05",
        endsOn: "2025-05-09",
      },
    ],
    ...overrides,
  };
}

/** Factory for B.3 UpsertTermMeetingPatternRequest */
export function createUpsertTermMeetingPatternRequest(
  overrides?: Partial<UpsertTermMeetingPatternRequest>
): UpsertTermMeetingPatternRequest {
  return {
    activityTypeVersionId: MEETING_TYPE_VERSION_ID,
    daysOfWeek: ["monday", "wednesday", "friday"],
    startTimeLocal: "09:00",
    endTimeLocal: "10:15",
    timeZone: "America/New_York",
    startsOn: TERM_START,
    endsOn: TERM_END,
    ...overrides,
  };
}
