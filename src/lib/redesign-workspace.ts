import type {
  CalendarSlotDto,
  Id,
  LearningModuleDto,
  LearningModuleVersionDto,
  SessionDto,
  TopicDto,
  TopicPrerequisiteDto,
  TopicVersionDto,
} from "./redesign-contract";

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
  canceledSessions: SessionDto[];
};

export type CalendarTimelineRow = {
  slot: CalendarSlotDto;
  session: SessionDto | null;
  isClassDay: boolean;
  isGap: boolean;
  isToday: boolean;
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
}): TermPlanningGaps {
  const activeSessionDates = new Set(
    args.sessions
      .filter((session) => session.status !== "canceled" && session.date)
      .map((session) => session.date as string),
  );

  return {
    unscheduledSessions: args.sessions.filter((session) => session.date === null && session.status !== "canceled"),
    unplannedClassDays: args.calendarSlots.filter(
      (slot) => slot.slotType === "class_day" && !activeSessionDates.has(slot.date),
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
}): TermCalendarTimeline {
  const orderedSlots = [...args.calendarSlots].sort((left, right) => left.date.localeCompare(right.date));
  const sessionsBySlotId = new Map<string, SessionDto>();
  const sessionsByDate = new Map<string, SessionDto>();

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
    return {
      slot,
      session,
      isClassDay,
      isGap,
      isToday: slot.date === args.today,
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
