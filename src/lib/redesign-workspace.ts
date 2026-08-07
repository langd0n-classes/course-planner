import type {
  ActivityDto,
  ActivityVersionDto,
  ActivityVersionTopicActionWithSiblingsDto,
  CalendarSlotDto,
  Id,
  LearningModuleDto,
  LearningModuleVersionDto,
  SessionDto,
  TermCalendarExceptionDto,
  TermActivityDto,
  TermActivityRevisionDto,
  TopicDto,
  TopicPrerequisiteDto,
  TopicVersionDto,
} from "./redesign-contract";

export type ActivityBoardColumn = {
  key: Id | "unassigned" | "cross-cutting";
  label: string;
  activityVersionIds: Id[];
};

export type TopicFlowOccurrence = {
  activityVersionId: Id;
  activityTitle: string;
  activityStableCode: string;
  columnKey: Id | "unassigned" | "cross-cutting";
  action: "introduced" | "practiced" | "assessed";
};

/** The one placement action used by both pointer drop and keyboard move. */
export function moveActivityBoardCard(args: {
  columns: ActivityBoardColumn[];
  activityVersionId: Id;
  destinationKey: ActivityBoardColumn["key"];
}): ActivityBoardColumn[] {
  return args.columns.map((column) => {
    const withoutCard = column.activityVersionIds.filter((id) => id !== args.activityVersionId);
    return column.key === args.destinationKey
      ? { ...column, activityVersionIds: [...withoutCard, args.activityVersionId] }
      : { ...column, activityVersionIds: withoutCard };
  });
}

export type TermDailyDriver = {
  nextMeeting: {
    activity: TermActivityDto;
    revision: TermActivityRevisionDto;
    meetingOrdinal: number;
  } | null;
  nextMilestone: {
    activity: TermActivityDto;
    revision: TermActivityRevisionDto;
    label: string;
    occursAt: string;
    milestoneIndex: number;
  } | null;
  currentLearningModuleId: Id | null;
  activeTopicVersionIds: Id[];
  changedActivityIds: Id[];
  totalMeetings: number;
};

function calendarDate(value: string) {
  // today arrives as a local date; a value near UTC midnight can fall on a different UTC date.
  return value.slice(0, 10);
}

/** Builds the small, time-oriented active-Term view from immutable revisions. */
export function buildTermDailyDriver(args: {
  termActivities: TermActivityDto[];
  revisionsByTermActivityId: Record<
    Id,
    {
      planned: TermActivityRevisionDto | null;
      delivered: TermActivityRevisionDto | null;
    }
  >;
  today: string;
}): TermDailyDriver {
  const effective = args.termActivities.flatMap((activity) => {
    const revisions = args.revisionsByTermActivityId[activity.id];
    const revision = revisions?.delivered ?? revisions?.planned;
    return revision
      ? [{ activity, revision, planned: revisions?.planned ?? null }]
      : [];
  });
  const meetings = effective
    .filter(({ revision }) => revision.detail.behaviorFamily === "meeting")
    .sort((left, right) => {
      if (
        left.revision.detail.behaviorFamily !== "meeting" ||
        right.revision.detail.behaviorFamily !== "meeting"
      )
        return 0;
      return (left.revision.detail.startsAt ?? "").localeCompare(
        right.revision.detail.startsAt ?? "",
      );
    });
  const futureMeetings = meetings
    .filter(({ revision }) => {
      if (revision.detail.behaviorFamily !== "meeting") return false;
      return (
        Boolean(revision.detail.startsAt) &&
        calendarDate(revision.detail.startsAt!) >= args.today &&
        revision.detail.status !== "canceled"
      );
    })
    .map((meeting) => ({
      ...meeting,
      meetingOrdinal: meetings.indexOf(meeting) + 1,
    }));
  const milestones = effective
    .flatMap(({ activity, revision }) =>
      revision.milestones
        .map((milestone, milestoneIndex) => ({ milestone, milestoneIndex }))
        .filter(
          ({ milestone }) =>
            milestone.occursAt && milestone.occursAt.slice(0, 10) >= args.today,
        )
        .map(({ milestone, milestoneIndex }) => ({
          activity,
          revision,
          label: milestone.label,
          occursAt: milestone.occursAt!,
          milestoneIndex,
        })),
    )
    .sort((left, right) => left.occursAt.localeCompare(right.occursAt));
  const current = futureMeetings[0] ?? null;
  const activeTopicVersionIds =
    current?.revision.topicActions.map((action) => action.topicVersionId) ?? [];
  return {
    nextMeeting: current,
    nextMilestone: milestones[0] ?? null,
    currentLearningModuleId: current?.activity.termLearningModuleId ?? null,
    activeTopicVersionIds,
    changedActivityIds: effective
      .filter(({ revision, planned }) => planned && planned.id !== revision.id)
      .map(({ activity }) => activity.id),
    totalMeetings: meetings.length,
  };
}

export type ActivityMovePlanStep = {
  learningModuleId: Id;
  expectedCurrentVersionId: Id;
  activities: Array<{ activityVersionId: Id; sequence: number; notes: string | null }>;
};

/**
 * Orders the per-LM revisions for a board move so a mid-move failure can only
 * duplicate the card across columns (visible and self-healing on retry), never
 * lose it: the destination append is always the first step, source removals
 * follow. Cross-LM moves are not atomic server-side, so ordering is the safety.
 */
export function planActivityMove(args: {
  learningModules: LearningModuleDto[];
  currentVersionsByLearningModuleId: Map<Id, LearningModuleVersionDto | null>;
  activityVersionId: Id;
  destinationLearningModuleId: Id | null;
}): ActivityMovePlanStep[] {
  const steps: ActivityMovePlanStep[] = [];
  for (const learningModule of args.learningModules) {
    const current = args.currentVersionsByLearningModuleId.get(learningModule.id);
    if (!current) continue;
    const memberships = [...(current.activities ?? [])].sort((left, right) => left.sequence - right.sequence);
    const hasCard = memberships.some((membership) => membership.activityVersionId === args.activityVersionId);
    const isDestination = learningModule.id === args.destinationLearningModuleId;
    if (isDestination && !hasCard) {
      steps.unshift({
        learningModuleId: learningModule.id,
        expectedCurrentVersionId: current.id,
        activities: [
          ...memberships.map((membership, index) => ({
            activityVersionId: membership.activityVersionId,
            sequence: index + 1,
            notes: membership.notes ?? null,
          })),
          { activityVersionId: args.activityVersionId, sequence: memberships.length + 1, notes: null },
        ],
      });
    } else if (!isDestination && hasCard) {
      steps.push({
        learningModuleId: learningModule.id,
        expectedCurrentVersionId: current.id,
        activities: memberships
          .filter((membership) => membership.activityVersionId !== args.activityVersionId)
          .map((membership, index) => ({
            activityVersionId: membership.activityVersionId,
            sequence: index + 1,
            notes: membership.notes ?? null,
          })),
      });
    }
  }
  return steps;
}

export function buildActivityBoardColumns(args: {
  learningModules: LearningModuleDto[];
  currentVersionsByLearningModuleId: Map<Id, LearningModuleVersionDto | null>;
  activities: ActivityDto[];
  currentVersionsByActivityId: Map<Id, ActivityVersionDto | null>;
}): ActivityBoardColumn[] {
  const columns: ActivityBoardColumn[] = [
    { key: "unassigned", label: "Unassigned", activityVersionIds: [] },
    ...[...args.learningModules]
      .sort((left, right) => (args.currentVersionsByLearningModuleId.get(left.id)?.defaultSequence ?? Number.MAX_SAFE_INTEGER) - (args.currentVersionsByLearningModuleId.get(right.id)?.defaultSequence ?? Number.MAX_SAFE_INTEGER))
      .map((learningModule) => ({
        key: learningModule.id,
        label: args.currentVersionsByLearningModuleId.get(learningModule.id)?.title ?? learningModule.stableCode,
        activityVersionIds: [...(args.currentVersionsByLearningModuleId.get(learningModule.id)?.activities ?? [])]
          .sort((left, right) => left.sequence - right.sequence)
          .map((membership) => membership.activityVersionId),
      })),
    { key: "cross-cutting", label: "Cross-cutting", activityVersionIds: [] },
  ];
  const placed = new Set(columns.flatMap((column) => column.activityVersionIds));
  for (const activity of args.activities) {
    const version = args.currentVersionsByActivityId.get(activity.id);
    if (version && !placed.has(version.id)) columns[0]!.activityVersionIds.push(version.id);
  }
  return columns;
}

export function buildTopicFlow(args: {
  columns: ActivityBoardColumn[];
  activities: ActivityDto[];
  versionsByActivityId: Map<Id, ActivityVersionDto | null>;
  actionsByActivityVersionId: Map<Id, ActivityVersionTopicActionWithSiblingsDto[]>;
}): Map<Id, TopicFlowOccurrence[]> {
  const columnByVersion = new Map(args.columns.flatMap((column) => column.activityVersionIds.map((id) => [id, column.key] as const)));
  const activityById = new Map(args.activities.map((activity) => [activity.id, activity]));
  const flow = new Map<Id, TopicFlowOccurrence[]>();
  for (const [activityId, version] of args.versionsByActivityId) {
    if (!version) continue;
    const activity = activityById.get(activityId);
    for (const action of args.actionsByActivityVersionId.get(version.id) ?? []) {
      const occurrence: TopicFlowOccurrence = {
        activityVersionId: version.id,
        activityTitle: version.title,
        activityStableCode: activity?.stableCode ?? activityId,
        columnKey: columnByVersion.get(version.id) ?? "unassigned",
        action: action.action,
      };
      flow.set(action.topicVersionId, [...(flow.get(action.topicVersionId) ?? []), occurrence]);
    }
  }
  return flow;
}

export type TopicBrowserEntry = {
  topic: TopicDto;
  currentVersion: TopicVersionDto | null;
  prerequisiteTopicIds: Id[];
};

export type TopicBrowserBucket = {
  key: string;
  label: string;
  learningModuleId: Id | null;
  isUnassigned: boolean;
  topics: TopicBrowserEntry[];
};

export type ComparedTopicChange = {
  kind: "added" | "removed" | "reordered";
  title: string;
  baseSequence: number | null;
  compareSequence: number | null;
};

export type LearningModuleVersionComparison = {
  summary: string[];
  topicChanges: ComparedTopicChange[];
};

export type TermPlanningGaps = {
  unscheduledSessions: SessionDto[];
  unplannedClassDays: CalendarSlotDto[];
  unplannedSpecialScheduleSlots: CalendarSlotDto[];
  canceledSessions: SessionDto[];
};

export type CalendarTimelineRow = {
  slot: CalendarSlotDto;
  session: SessionDto | null;
  isClassDay: boolean;
  isGap: boolean;
  isToday: boolean;
  provenance: "calendar_inherited" | "term_specific";
};

export type TermCalendarTimeline = {
  allRows: CalendarTimelineRow[];
  windowRows: CalendarTimelineRow[];
  hiddenBeforeCount: number;
  hiddenAfterCount: number;
  progressPercent: number;
  completedClassDays: number;
  totalClassDays: number;
  todaySignal:
    | "no_class_days"
    | "before_term"
    | "today_class_day"
    | "between_class_days"
    | "after_term";
};

function sortText(value: string | null | undefined): string {
  return (value ?? "").toLocaleLowerCase();
}

export function suggestTopicStableCode(title: string): string {
  const slug = title
    .toLocaleLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug ? `topic-${slug}` : "";
}

export function buildTopicBrowserBuckets(args: {
  learningModules: LearningModuleDto[];
  currentVersionsByLearningModuleId: Map<Id, LearningModuleVersionDto | null>;
  topics: TopicDto[];
  currentVersionsByTopicId: Map<Id, TopicVersionDto | null>;
  prerequisites: TopicPrerequisiteDto[];
}): TopicBrowserBucket[] {
  const prerequisiteMap = new Map<Id, Id[]>();
  for (const prerequisite of args.prerequisites) {
    prerequisiteMap.set(prerequisite.topicId, [
      ...(prerequisiteMap.get(prerequisite.topicId) ?? []),
      prerequisite.prerequisiteTopicId,
    ]);
  }

  const topicsByLearningModuleId = new Map<Id | null, TopicBrowserEntry[]>();
  for (const topic of args.topics) {
    const entry: TopicBrowserEntry = {
      topic,
      currentVersion: args.currentVersionsByTopicId.get(topic.id) ?? null,
      prerequisiteTopicIds: prerequisiteMap.get(topic.id) ?? [],
    };
    const key = topic.learningModuleId;
    topicsByLearningModuleId.set(key, [...(topicsByLearningModuleId.get(key) ?? []), entry]);
  }

  const sortEntries = (entries: TopicBrowserEntry[]) =>
    [...entries].sort((left, right) => {
      const categoryCompare = sortText(left.currentVersion?.category).localeCompare(
        sortText(right.currentVersion?.category),
      );
      if (categoryCompare !== 0) return categoryCompare;
      const titleCompare = sortText(left.currentVersion?.title).localeCompare(
        sortText(right.currentVersion?.title),
      );
      if (titleCompare !== 0) return titleCompare;
      return left.topic.stableCode.localeCompare(right.topic.stableCode);
    });

  const buckets: TopicBrowserBucket[] = [];
  const unassigned = sortEntries(topicsByLearningModuleId.get(null) ?? []);
  buckets.push({
    key: "unassigned",
    label: "Unassigned Topics",
    learningModuleId: null,
    isUnassigned: true,
    topics: unassigned,
  });

  const orderedModules = [...args.learningModules].sort((left, right) => {
    const leftVersion = args.currentVersionsByLearningModuleId.get(left.id) ?? null;
    const rightVersion = args.currentVersionsByLearningModuleId.get(right.id) ?? null;
    const sequenceCompare = (leftVersion?.defaultSequence ?? Number.MAX_SAFE_INTEGER) - (rightVersion?.defaultSequence ?? Number.MAX_SAFE_INTEGER);
    if (sequenceCompare !== 0) return sequenceCompare;
    const titleCompare = sortText(leftVersion?.title).localeCompare(sortText(rightVersion?.title));
    if (titleCompare !== 0) return titleCompare;
    return left.stableCode.localeCompare(right.stableCode);
  });

  for (const learningModule of orderedModules) {
    const currentVersion = args.currentVersionsByLearningModuleId.get(learningModule.id) ?? null;
    buckets.push({
      key: learningModule.id,
      label: currentVersion?.title ?? learningModule.stableCode,
      learningModuleId: learningModule.id,
      isUnassigned: false,
      topics: sortEntries(topicsByLearningModuleId.get(learningModule.id) ?? []),
    });
  }

  return buckets;
}

export function compareLearningModuleVersions(args: {
  base: LearningModuleVersionDto;
  compare: LearningModuleVersionDto;
  topicVersionsById: Map<Id, TopicVersionDto>;
}): LearningModuleVersionComparison {
  const summary: string[] = [];
  if ((args.base.title ?? "") !== (args.compare.title ?? "")) {
    summary.push(`Title changed from "${args.base.title}" to "${args.compare.title}".`);
  }
  if ((args.base.description ?? "") !== (args.compare.description ?? "")) {
    summary.push("Description changed.");
  }
  if ((args.base.notes ?? "") !== (args.compare.notes ?? "")) {
    summary.push("Planning notes changed.");
  }
  if (args.base.learningObjectives.join("\n") !== args.compare.learningObjectives.join("\n")) {
    summary.push("Learning objectives changed.");
  }

  const baseByTopic = new Map(args.base.topics.map((topic) => [topic.topicVersionId, topic.sequence]));
  const compareByTopic = new Map(args.compare.topics.map((topic) => [topic.topicVersionId, topic.sequence]));
  const allTopicVersionIds = new Set([...baseByTopic.keys(), ...compareByTopic.keys()]);
  const topicChanges: ComparedTopicChange[] = [];

  for (const topicVersionId of allTopicVersionIds) {
    const title = args.topicVersionsById.get(topicVersionId)?.title ?? topicVersionId;
    const baseSequence = baseByTopic.get(topicVersionId) ?? null;
    const compareSequence = compareByTopic.get(topicVersionId) ?? null;
    if (baseSequence === null && compareSequence !== null) {
      topicChanges.push({ kind: "added", title, baseSequence, compareSequence });
    } else if (baseSequence !== null && compareSequence === null) {
      topicChanges.push({ kind: "removed", title, baseSequence, compareSequence });
    } else if (baseSequence !== compareSequence) {
      topicChanges.push({ kind: "reordered", title, baseSequence, compareSequence });
    }
  }

  topicChanges.sort((left, right) => left.title.localeCompare(right.title));

  return { summary, topicChanges };
}

export function deriveTermPlanningGaps(args: {
  calendarSlots: CalendarSlotDto[];
  sessions: SessionDto[];
  exceptions?: TermCalendarExceptionDto[];
}): TermPlanningGaps {
  const activeSessionDates = new Set(
    args.sessions
      .filter((session) => session.status !== "canceled" && session.date)
      .map((session) => session.date as string),
  );

  const resolvedSlotIds = new Set(
    (args.exceptions ?? [])
      .filter((exception) => exception.action === "modify" || exception.action === "replace")
      .map((exception) => exception.calendarSlotId)
      .filter((slotId): slotId is string => slotId !== null),
  );
  const resolvedDates = new Set(
    (args.exceptions ?? [])
      .filter((exception) => exception.action === "modify" || exception.action === "replace")
      .map((exception) => exception.targetDate)
      .filter((date): date is string => date !== null),
  );

  return {
    unscheduledSessions: args.sessions.filter((session) => session.date === null && session.status !== "canceled"),
    unplannedClassDays: args.calendarSlots.filter(
      (slot) => slot.slotType === "class_day" && !activeSessionDates.has(slot.date),
    ),
    // Finals and other special slots are deliberately not regular meeting-pattern
    // gaps. They need an explicit alternate/manual decision, so keep them in a
    // separate signal rather than folding them into ordinary class-day coverage.
    unplannedSpecialScheduleSlots: args.calendarSlots.filter(
      (slot) =>
        slot.slotType === "finals" &&
        !activeSessionDates.has(slot.date) &&
        !resolvedSlotIds.has(slot.id) &&
        !resolvedDates.has(slot.date),
    ),
    canceledSessions: args.sessions.filter((session) => session.status === "canceled"),
  };
}

const DEFAULT_WINDOW_RADIUS = 7;

function clamp(value: number, lower: number, upper: number) {
  return Math.min(upper, Math.max(lower, value));
}

export function buildTermCalendarTimeline(args: {
  calendarSlots: CalendarSlotDto[];
  sessions: SessionDto[];
  today: string;
  windowRadius?: number;
  exceptions?: TermCalendarExceptionDto[];
}): TermCalendarTimeline {
  const orderedSlots = [...args.calendarSlots].sort((left, right) => left.date.localeCompare(right.date));
  const sessionsBySlotId = new Map<string, SessionDto>();
  const sessionsByDate = new Map<string, SessionDto>();
  // Mirrors deriveTermPlanningGaps: a targeted modify/replace exception is a
  // Term-specific decision about that slot/date, whatever the slot inherited.
  const overridingExceptions = (args.exceptions ?? []).filter(
    (exception) => exception.action === "modify" || exception.action === "replace",
  );
  const exceptionSlotIds = new Set(
    overridingExceptions.map((exception) => exception.calendarSlotId).filter((slotId): slotId is string => slotId !== null),
  );
  const exceptionDates = new Set(
    overridingExceptions.map((exception) => exception.targetDate).filter((date): date is string => date !== null),
  );

  for (const session of args.sessions) {
    if (session.calendarSlotId && !sessionsBySlotId.has(session.calendarSlotId)) {
      sessionsBySlotId.set(session.calendarSlotId, session);
    }
    if (session.date && !sessionsByDate.has(session.date)) {
      sessionsByDate.set(session.date, session);
    }
  }

  const allRows = orderedSlots.map((slot) => {
    const session = sessionsBySlotId.get(slot.id) ?? sessionsByDate.get(slot.date) ?? null;
    const isClassDay = slot.slotType === "class_day";
    const isGap = isClassDay && (!session || session.status === "canceled");
    const provenance: CalendarTimelineRow["provenance"] =
      session?.scheduleOverrideLabel ||
      slot.capacitySource === "instructor_override" ||
      !slot.academicCalendarEventId ||
      exceptionSlotIds.has(slot.id) ||
      exceptionDates.has(slot.date)
        ? "term_specific"
        : "calendar_inherited";
    return {
      slot,
      session,
      isClassDay,
      isGap,
      isToday: calendarDate(slot.date) === calendarDate(args.today),
      provenance,
    };
  });

  const totalClassDays = allRows.filter((row) => row.isClassDay).length;
  const completedClassDays = allRows.filter((row) => row.isClassDay && row.slot.date <= args.today).length;
  const progressPercent =
    totalClassDays === 0 ? 0 : Math.round((completedClassDays / totalClassDays) * 100);

  const classDayDates = allRows.filter((row) => row.isClassDay).map((row) => row.slot.date);
  let todaySignal: TermCalendarTimeline["todaySignal"] = "no_class_days";
  if (classDayDates.length > 0) {
    const firstClassDay = classDayDates[0]!;
    const lastClassDay = classDayDates[classDayDates.length - 1]!;
    if (args.today < firstClassDay) {
      todaySignal = "before_term";
    } else if (args.today > lastClassDay) {
      todaySignal = "after_term";
    } else if (classDayDates.includes(args.today)) {
      todaySignal = "today_class_day";
    } else {
      todaySignal = "between_class_days";
    }
  }

  if (allRows.length === 0) {
    return {
      allRows,
      windowRows: [],
      hiddenBeforeCount: 0,
      hiddenAfterCount: 0,
      progressPercent,
      completedClassDays,
      totalClassDays,
      todaySignal,
    };
  }

  const radius = args.windowRadius ?? DEFAULT_WINDOW_RADIUS;
  const exactIndex = allRows.findIndex((row) => row.slot.date === args.today);
  const insertionIndex = allRows.findIndex((row) => row.slot.date > args.today);
  const anchorIndex =
    exactIndex >= 0
      ? exactIndex
      : insertionIndex >= 0
        ? insertionIndex
        : allRows.length - 1;

  let startIndex = clamp(anchorIndex - radius, 0, allRows.length - 1);
  let endIndex = clamp(anchorIndex + radius, 0, allRows.length - 1);

  const targetSize = Math.min(allRows.length, radius * 2 + 1);
  while (endIndex - startIndex + 1 < targetSize && (startIndex > 0 || endIndex < allRows.length - 1)) {
    if (startIndex > 0) startIndex -= 1;
    if (endIndex - startIndex + 1 >= targetSize) break;
    if (endIndex < allRows.length - 1) endIndex += 1;
  }

  return {
    allRows,
    windowRows: allRows.slice(startIndex, endIndex + 1),
    hiddenBeforeCount: startIndex,
    hiddenAfterCount: allRows.length - endIndex - 1,
    progressPercent,
    completedClassDays,
    totalClassDays,
    todaySignal,
  };
}
