export type RedesignDb = {
  $transaction<T>(fn: (tx: RedesignTx) => Promise<T>, options?: unknown): Promise<T>;
};

// Service functions intentionally accept structural transaction doubles so the
// domain invariants can be tested without a database. Prisma's delegates do not
// expose a useful common structural type for that boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RedesignTx = Record<string, any>;

export type VersionState = {
  id: string;
  revision: number;
  publishedAt: Date | null;
};

export type TopicSnapshotInput = {
  topicVersionId: string;
  sequence: number;
};

export type ActivitySnapshotInput = {
  activityVersionId: string;
  sequence: number;
  notes?: string | null;
};

export type LearningModuleVersionDraft = {
  title: string;
  description?: string | null;
  studentDescription?: string | null;
  learningObjectives?: string[];
  notes?: string | null;
  defaultSequence?: number | null;
  changeSummary?: string | null;
  topics?: TopicSnapshotInput[];
  activities?: ActivitySnapshotInput[];
};

export type TopicVersionDraft = {
  title: string;
  category?: string | null;
  description?: string | null;
  changeSummary?: string | null;
};

export type ActivityTypeVersionDraft = {
  label: string;
  description?: string | null;
  changeSummary?: string | null;
};

export type ActivityBehaviorFamily = "meeting" | "coursework" | "assessment";

export type MeetingActivityDetailDraft = {
  behaviorFamily: "meeting";
  defaultDurationMinutes?: number | null;
  modality?: string | null;
  preparationNotes?: string | null;
  authoringNotes?: string | null;
};

export type CourseworkActivityDetailDraft = {
  behaviorFamily: "coursework";
  submissionPolicy?: string | null;
  releasePolicy?: string | null;
  authoringNotes?: string | null;
};

export type AssessmentActivityDetailDraft = {
  behaviorFamily: "assessment";
  modality?: string | null;
  authoringNotes?: string | null;
};

export type ActivityDetailDraft =
  | MeetingActivityDetailDraft
  | CourseworkActivityDetailDraft
  | AssessmentActivityDetailDraft;

export type MilestoneRole = "release" | "work" | "phase_release" | "review" | "due";

export type MilestoneTemplateDraft = {
  sequence: number;
  role: MilestoneRole;
  label: string;
  linkedActivityId?: string | null;
  relativeDays?: number | null;
  defaultTime?: string | null;
  timeZone?: string | null;
  notes?: string | null;
  provenance?: unknown;
};

export type ActivityVersionDraft = {
  title: string;
  summary?: string | null;
  activityTypeVersionId: string;
  changeSummary?: string | null;
  detail: ActivityDetailDraft;
  milestoneTemplates?: MilestoneTemplateDraft[];
};

export type AcademicCalendarVersionDraft = {
  name: string;
  academicYear: string;
  sourceUri?: string | null;
  events?: Array<{
    eventType: "term_start" | "term_end" | "holiday" | "break_day" | "reading_day" | "finals_start" | "finals_end" | "other";
    startsOn: Date;
    endsOn: Date;
    label: string;
    sourceUri?: string | null;
  }>;
  periods?: Array<{
    kind: "instructional" | "no_instruction" | "special_schedule";
    label: string;
    startsOn: Date;
    endsOn: Date;
  }>;
};

export type TermMeetingPatternDraft = {
  activityTypeVersionId: string;
  label?: string | null;
  daysOfWeek: string[];
  startTimeLocal: string;
  endTimeLocal?: string | null;
  timeZone: string;
  startsOn: string;
  endsOn: string;
};

export type TermCalendarExceptionDraft = {
  action: "cancel" | "add" | "replace" | "modify";
  activityTypeVersionId?: string | null;
  calendarSlotId?: string | null;
  targetDate?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  label?: string | null;
  reason?: string | null;
  provenance?: unknown;
};
