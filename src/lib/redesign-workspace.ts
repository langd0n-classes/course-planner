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
