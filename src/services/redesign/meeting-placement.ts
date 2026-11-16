import { DomainInvariantError } from "./errors";

export type DefaultMeetingTime = {
  startTimeLocal: string;
  endTimeLocal: string | null;
  timeZone: string;
};
type Meeting = {
  termActivityId: string;
  activityTypeVersionId: string;
  termLearningModuleSequence: number | null;
  ordinal: number | null;
  createdAt: Date | string;
  plannedRevisionId: string | null;
  calendarSlotId: string | null;
  startsAt: Date | string | null;
  status: string | null;
  defaultDurationMinutes: number | null;
};
export type MeetingPlacementInput = {
  meetings: Meeting[];
  slots: { id: string; date: string; slotType: string }[];
  patterns: (DefaultMeetingTime & {
    activityTypeVersionId: string;
    daysOfWeek: string[];
    startsOn: Date | string;
    endsOn: Date | string;
  })[];
  cancelExceptions: { date: string; activityTypeVersionId: string | null }[];
  defaultMeetingTime: DefaultMeetingTime | null;
};
const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const dateOnly = (date: Date | string) =>
  typeof date === "string"
    ? date.slice(0, 10)
    : date.toISOString().slice(0, 10);

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  try {
    const created = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, created);
    return created;
  } catch {
    throw new DomainInvariantError(`Invalid time zone: ${timeZone}`);
  }
}
function localParts(instant: Date, timeZone: string) {
  return Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
}
function localDate(instant: Date | string, timeZone: string) {
  const p = localParts(new Date(instant), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}
function validateTime(time: DefaultMeetingTime) {
  formatter(time.timeZone);
  for (const value of [time.startTimeLocal, time.endTimeLocal]) {
    if (value !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new DomainInvariantError(
        `Invalid local time: ${value}; expected HH:MM`,
      );
    }
  }
  if (time.endTimeLocal !== null && time.endTimeLocal <= time.startTimeLocal) {
    throw new DomainInvariantError(
      `The end time ${time.endTimeLocal} must be after the start time ${time.startTimeLocal}`,
    );
  }
}
function renderedAsUtc(instant: number, timeZone: string) {
  const p = localParts(new Date(instant), timeZone);
  return Date.parse(
    `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
  );
}
/**
 * Resolves a local wall time with the zone offsets in force one day before
 * and one day after it, so the offset is the one for that date. A local time
 * that occurs twice (the clock goes back) resolves to the earlier instant. A
 * local time that does not occur (the clock goes forward) is rejected.
 */
function localInstant(date: string, time: string, timeZone: string) {
  const target = Date.parse(`${date}T${time}:00Z`);
  const day = 86_400_000;
  const candidates = [target - day, target + day]
    .map((probe) => target - (renderedAsUtc(probe, timeZone) - probe))
    .filter((candidate) => renderedAsUtc(candidate, timeZone) === target);
  if (candidates.length === 0) {
    throw new DomainInvariantError(
      `Local time does not exist: ${date} ${time} in ${timeZone}`,
    );
  }
  return new Date(Math.min(...candidates));
}

export function planMeetingPlacement(input: MeetingPlacementInput) {
  input.patterns.forEach(validateTime);
  if (input.defaultMeetingTime) validateTime(input.defaultMeetingTime);
  const placements: {
    termActivityId: string;
    expectedPlannedRevisionId: string | null;
    calendarSlotId: string;
    date: string;
    startsAt: Date;
    endsAt: Date | null;
    timeZone: string;
  }[] = [];
  const unplacedMeetings: {
    termActivityId: string;
    reason: "no_learning_module" | "no_slot_left";
  }[] = [];
  const meetings = input.meetings.filter((m) => m.status !== "canceled");
  const dated = meetings.filter((m) => m.startsAt || m.calendarSlotId);
  const slots = input.slots
    .filter((s) => s.slotType === "class_day")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const canceled = (date: string, type: string | null) =>
    input.cancelExceptions.some(
      (e) =>
        e.date === date &&
        (e.activityTypeVersionId === null ||
          (type !== null && e.activityTypeVersionId === type)),
    );
  const patternsFor = (type: string) =>
    input.patterns.filter((p) => p.activityTypeVersionId === type);
  const timeFor = (type: string, date: string) => {
    const patterns = patternsFor(type);
    return patterns.length
      ? (patterns.find(
          (p) =>
            date >= dateOnly(p.startsOn) &&
            date <= dateOnly(p.endsOn) &&
            p.daysOfWeek.includes(
              DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()],
            ),
        ) ?? null)
      : input.defaultMeetingTime;
  };
  const holds = (meeting: Meeting, slot: (typeof slots)[number]) => {
    if (meeting.calendarSlotId === slot.id) return true;
    const time = timeFor(meeting.activityTypeVersionId, slot.date);
    // A dated meeting outside its current pattern still occupies its local date.
    const zones = time
      ? [time.timeZone]
      : patternsFor(meeting.activityTypeVersionId).map((p) => p.timeZone);
    return Boolean(
      meeting.startsAt &&
      zones.some((zone) => localDate(meeting.startsAt!, zone) === slot.date),
    );
  };
  const occupied = new Set(
    slots.filter((s) => dated.some((m) => holds(m, s))).map((s) => s.id),
  );
  const groups = new Map<string, Meeting[]>();
  for (const meeting of meetings.filter(
    (m) => !m.startsAt && !m.calendarSlotId,
  )) {
    if (meeting.termLearningModuleSequence === null) {
      unplacedMeetings.push({
        termActivityId: meeting.termActivityId,
        reason: "no_learning_module",
      });
    } else {
      const group = groups.get(meeting.activityTypeVersionId) ?? [];
      group.push(meeting);
      groups.set(meeting.activityTypeVersionId, group);
    }
  }
  let missingMeetingTime = false;
  for (const [type, group] of [...groups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    group.sort(
      (a, b) =>
        a.termLearningModuleSequence! - b.termLearningModuleSequence! ||
        (a.ordinal ?? Infinity) - (b.ordinal ?? Infinity) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.termActivityId.localeCompare(b.termActivityId),
    );
    if (!patternsFor(type).length && !input.defaultMeetingTime) {
      missingMeetingTime = true;
      continue;
    }
    const eligible = slots.filter(
      (s) =>
        timeFor(type, s.date) &&
        !canceled(s.date, type) &&
        !dated.some((m) => m.activityTypeVersionId === type && holds(m, s)),
    );
    group.forEach((meeting, index) => {
      const slot = eligible[index];
      if (!slot) {
        unplacedMeetings.push({
          termActivityId: meeting.termActivityId,
          reason: "no_slot_left",
        });
        return;
      }
      const time = timeFor(type, slot.date)!;
      const startsAt = localInstant(
        slot.date,
        time.startTimeLocal,
        time.timeZone,
      );
      const endsAt = time.endTimeLocal
        ? localInstant(slot.date, time.endTimeLocal, time.timeZone)
        : meeting.defaultDurationMinutes === null
          ? null
          : new Date(
              startsAt.getTime() + meeting.defaultDurationMinutes * 60_000,
            );
      placements.push({
        termActivityId: meeting.termActivityId,
        expectedPlannedRevisionId: meeting.plannedRevisionId,
        calendarSlotId: slot.id,
        date: slot.date,
        startsAt,
        endsAt,
        timeZone: time.timeZone,
      });
      occupied.add(slot.id);
    });
  }
  placements.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startsAt.getTime() - b.startsAt.getTime() ||
      a.termActivityId.localeCompare(b.termActivityId),
  );
  return {
    placements,
    unplacedMeetings,
    emptySlots: slots
      .filter((s) => !occupied.has(s.id) && !canceled(s.date, null))
      .map((s) => ({ calendarSlotId: s.id, date: s.date })),
    alreadyDatedCount: dated.length,
    missingMeetingTime,
  };
}
