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

export type TermActivityRevisionDetailDraft =
  | {
      behaviorFamily: "meeting";
      calendarSlotId?: string | null;
      startsAt?: Date | null;
      endsAt?: Date | null;
      status?: string | null;
      modality?: string | null;
      overrideReason?: string | null;
      overrideEvidence?: unknown | null;
    }
  | {
      behaviorFamily: "coursework";
      lifecycleState?: string | null;
      deliveryNotes?: string | null;
    }
  | {
      behaviorFamily: "assessment";
      lifecycleState?: string | null;
      modality?: string | null;
      deliveryNotes?: string | null;
    };

export type TermActivityRevisionTopicActionInput = {
  topicVersionId: string;
  action: "introduced" | "practiced" | "assessed";
  notes?: string | null;
  provenance?: unknown;
};

export type TermMilestoneAnchorPolicy = "follow_activity" | "fixed_instant" | "standalone";

export type TermActivityMilestoneInput = {
  sourceTemplateId?: string | null;
  role: MilestoneRole;
  label: string;
  linkedTermActivityId?: string | null;
  occursAt?: Date | null;
  timeZone?: string | null;
  anchorPolicy: TermMilestoneAnchorPolicy;
  notes?: string | null;
  provenance?: unknown;
};

export type TermActivityRevisionDraft = {
  title: string;
  summary?: string | null;
  changeReason?: string | null;
  detail: TermActivityRevisionDetailDraft;
  topicActions?: TermActivityRevisionTopicActionInput[];
  milestones?: TermActivityMilestoneInput[];
};
