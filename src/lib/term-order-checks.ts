import { effectiveRevision, localDate as day } from "./term-revision-rules";
import type {
  CalendarSlotDto,
  Id,
  TopicPrerequisiteDto,
  TopicVersionDto,
} from "./redesign-contract";
import type { buildTermDailyDriver } from "./redesign-workspace";

export type TermOrderFindingKind =
  | "assessed_before_introduced"
  | "practiced_before_introduced"
  | "never_introduced"
  | "prerequisite_after_dependent"
  | "due_before_linked_meeting";
export type TermOrderFinding = {
  kind: TermOrderFindingKind;
  /** Null for a linked milestone check, which need not involve a Topic. */
  topicId: Id | null;
  termActivityIds: [Id, Id | null];
  dates: [string, string | null];
  sentence: string;
};
export type UndatedTermOrderItem = {
  termActivityId: Id;
  milestoneId: Id | null;
};
export type TermOrderResult = {
  findings: TermOrderFinding[];
  unmappedActionCount: number;
  undated: { count: number; items: UndatedTermOrderItem[] };
};
export type CheckTermOrderArgs = Pick<
  Parameters<typeof buildTermDailyDriver>[0],
  "termActivities" | "revisionsByTermActivityId"
> & {
  topicVersions: Pick<TopicVersionDto, "id" | "topicId">[];
  calendarSlots: Pick<CalendarSlotDto, "id" | "date">[];
  prerequisites: TopicPrerequisiteDto[];
  /** Topic names for the sentences. A Topic with no entry is named "A Topic". */
  topicLabels?: Readonly<Record<Id, string>>;
  /**
   * IANA time zone of the Term. An instant is compared by its local date in
   * this zone. A milestone's own time zone takes priority. With no zone, the
   * UTC date of the instant is used.
   */
  timeZone?: string | null;
};
type Occurrence = { id: Id; date: string | null };

const compare = (a: string | null, b: string | null): number =>
  a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : 1;
const canceled = (value: string | null | undefined) =>
  /^(canceled|cancelled)$/i.test(value ?? "");
const byOccurrence = (a: Occurrence, b: Occurrence) =>
  compare(a.date, b.date) || compare(a.id, b.id);

/** Advisory checks over effective Term revisions; does not mutate input or block edits. */
export function checkTermOrder(args: CheckTermOrderArgs): TermOrderResult {
  const findings: TermOrderFinding[] = [];
  const items: UndatedTermOrderItem[] = [];
  let unmappedActionCount = 0;
  const topicIds = new Map(args.topicVersions.map((v) => [v.id, v.topicId]));
  const slots = new Map(args.calendarSlots.map((s) => [s.id, s.date]));
  const effective = args.termActivities.flatMap((activity) => {
    const revisions = args.revisionsByTermActivityId[activity.id];
    const revision = effectiveRevision(revisions);
    if (
      activity.archivedAt != null ||
      canceled(activity.lifecycleState) ||
      (revision?.detail.behaviorFamily === "meeting" &&
        canceled(revision.detail.status)) ||
      (revision?.detail.behaviorFamily !== "meeting" &&
        canceled(revision?.detail.lifecycleState))
    )
      return [];
    return [{ activity, revision }];
  });
  const meetings = new Map<Id, Occurrence>();
  const topics = new Map<Id, Map<string, Occurrence[]>>();
  for (const { activity, revision } of effective) {
    let date: string | null = null;
    if (revision?.detail.behaviorFamily === "meeting") {
      // Match the daily driver: a delivered revision may retain its old slot.
      date =
        revision.detail.startsAt != null
          ? day(revision.detail.startsAt, args.timeZone)
          : day(slots.get(revision.detail.calendarSlotId ?? ""));
      meetings.set(activity.id, { id: activity.id, date });
    } else if (revision) {
      const due = revision.milestones.filter((m) => m.role === "due");
      const dated = (due.length ? due : revision.milestones)
        .flatMap(
          (m) =>
            day(m.occursAt, m.timeZone ?? args.timeZone, args.timeZone) ?? [],
        )
        .sort();
      date = dated.at(-1) ?? null;
    }
    if (!date) items.push({ termActivityId: activity.id, milestoneId: null });
    for (const milestone of revision?.milestones ?? []) {
      if (
        !day(
          milestone.occursAt,
          milestone.timeZone ?? args.timeZone,
          args.timeZone,
        )
      )
        items.push({ termActivityId: activity.id, milestoneId: milestone.id });
    }
    for (const action of revision?.topicActions ?? []) {
      const topicId = topicIds.get(action.topicVersionId);
      // A version without its identity mapping cannot safely be compared as a stable Topic.
      if (!topicId) {
        unmappedActionCount++;
        continue;
      }
      const actions = topics.get(topicId) ?? new Map<string, Occurrence[]>();
      actions.set(action.action, [
        ...(actions.get(action.action) ?? []),
        { id: activity.id, date },
      ]);
      topics.set(topicId, actions);
    }
  }
  function add(
    kind: TermOrderFindingKind,
    topicId: Id | null,
    first: Occurrence,
    second: Occurrence | null,
    sentence: string,
  ) {
    findings.push({
      kind,
      topicId,
      termActivityIds: [first.id, second?.id ?? null],
      dates: [first.date!, second?.date ?? null],
      sentence,
    });
  }
  const name = (topicId: Id) => args.topicLabels?.[topicId] ?? "A Topic";
  function earliest(topicId: Id, action: string) {
    return topics
      .get(topicId)
      ?.get(action)
      ?.filter((o) => o.date)
      .sort(byOccurrence)[0];
  }
  const hasUndatedIntro = (topicId: Id) =>
    topics
      .get(topicId)
      ?.get("introduced")
      ?.some((o) => !o.date) ?? false;
  for (const [topicId, actions] of topics) {
    const intro = earliest(topicId, "introduced");
    if (!actions.has("introduced")) {
      const first = [
        ...(actions.get("practiced") ?? []),
        ...(actions.get("assessed") ?? []),
      ]
        .filter((o) => o.date)
        .sort(byOccurrence)[0];
      if (first)
        add(
          "never_introduced",
          topicId,
          first,
          null,
          `${name(topicId)} is practiced or assessed but is never introduced in this Term.`,
        );
    }
    for (const action of ["assessed", "practiced"] as const) {
      const first = earliest(topicId, action);
      if (
        !hasUndatedIntro(topicId) &&
        first?.date &&
        intro?.date &&
        first.date < intro.date
      )
        add(
          `${action}_before_introduced`,
          topicId,
          first,
          intro,
          `${name(topicId)} is ${action} before it is introduced.`,
        );
    }
  }
  for (const pair of args.prerequisites) {
    if (
      hasUndatedIntro(pair.topicId) ||
      hasUndatedIntro(pair.prerequisiteTopicId)
    )
      continue;
    const dependent = earliest(pair.topicId, "introduced");
    const prerequisite = earliest(pair.prerequisiteTopicId, "introduced");
    if (
      dependent?.date &&
      prerequisite?.date &&
      dependent.date < prerequisite.date
    )
      add(
        "prerequisite_after_dependent",
        pair.topicId,
        dependent,
        prerequisite,
        `${name(pair.topicId)} is introduced before its prerequisite, ${name(pair.prerequisiteTopicId)}.`,
      );
  }
  for (const { activity, revision } of effective) {
    for (const milestone of revision?.milestones ?? []) {
      const date = day(
        milestone.occursAt,
        milestone.timeZone ?? args.timeZone,
        args.timeZone,
      );
      const linked = meetings.get(milestone.linkedTermActivityId ?? "");
      if (
        milestone.role === "due" &&
        date &&
        linked?.date &&
        date < linked.date
      )
        add(
          "due_before_linked_meeting",
          null,
          { id: activity.id, date },
          linked,
          `${milestone.label} is due before its linked meeting.`,
        );
    }
  }
  findings.sort(
    (a, b) =>
      compare(a.dates[1] ?? a.dates[0], b.dates[1] ?? b.dates[0]) ||
      compare(a.topicId, b.topicId) ||
      compare(a.kind, b.kind) ||
      compare(a.termActivityIds[0], b.termActivityIds[0]) ||
      compare(a.termActivityIds[1], b.termActivityIds[1]),
  );
  items.sort(
    (a, b) =>
      compare(a.termActivityId, b.termActivityId) ||
      compare(a.milestoneId, b.milestoneId),
  );
  return {
    findings,
    unmappedActionCount,
    undated: { count: items.length, items },
  };
}
