import { DomainInvariantError } from "./errors";
import type { RedesignTx } from "./types";

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

export type MeetingRolePattern = {
  roleKey: string;
  label: string;
  sessionType: "lecture" | "lab";
  days: number[];
};

export type SlotProvenance = {
  source: "academic_calendar_event" | "instructor_override" | "meeting_role_pattern";
  referenceId: string | null;
  detail: string;
};

export type MaterializedSlotCandidate = {
  date: Date;
  slotType: "class_day" | "holiday" | "break_day" | "finals";
  label: string | null;
  source: string;
  academicCalendarEventId: string | null;
  meetingRoleKeys: string[];
  meetingRoleLabels: string[];
  instructionalCapacity: "normal" | "reduced_engagement" | "recovery" | "assessment_period";
  capacitySource: "baseline" | "heuristic" | "instructor_override";
  capacityReason: string | null;
  provenance: SlotProvenance[];
};

export type CalendarMaterializationConflict = {
  code: string;
  date: string | null;
  meetingRoleKey: string | null;
  message: string;
};

export type CalendarMaterializationPreview = {
  meetingRoles: MeetingRolePattern[];
  candidates: MaterializedSlotCandidate[];
  conflicts: CalendarMaterializationConflict[];
  warnings: string[];
  classDayDatesByRoleKey: Map<string, Date[]>;
};

type PreviewInput = {
  instructorId: string;
  academicCalendarId: string;
  startDate: Date;
  endDate: Date;
  meetingPattern: unknown;
};

type AcademicCalendarEventRow = {
  id: string;
  eventType: string;
  startsOn: Date;
  endsOn: Date;
  label: string;
};

type InstructorOverrideRow = {
  id: string;
  action: "add" | "replace" | "suppress";
  eventType: string | null;
  startsOn: Date | null;
  endsOn: Date | null;
  label: string | null;
  reason: string | null;
  academicCalendarEventId: string | null;
};

type DayCandidate = MaterializedSlotCandidate;
type CapacityHint = Pick<
  MaterializedSlotCandidate,
  "instructionalCapacity" | "capacitySource" | "capacityReason"
>;

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function eachDateInclusive(start: Date, end: Date) {
  const dates: Date[] = [];
  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    dates.push(new Date(current));
  }
  return dates;
}

function normalizeDays(days: unknown[]): number[] {
  const normalized = days
    .filter((day): day is string => typeof day === "string")
    .map((day) => DAY_INDEX[day.trim().toLowerCase()])
    .filter((value): value is number => value !== undefined);

  return [...new Set(normalized)];
}

function slugifyRoleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeMeetingRolePatterns(meetingPattern: unknown): MeetingRolePattern[] {
  if (!meetingPattern || typeof meetingPattern !== "object") {
    throw new DomainInvariantError("Term creation requires one or more meeting role patterns");
  }

  const rawRoles = Array.isArray((meetingPattern as { roles?: unknown[] }).roles)
    ? (meetingPattern as { roles: unknown[] }).roles
    : Array.isArray((meetingPattern as { days?: unknown[] }).days)
      ? [
          {
            roleKey: "lecture",
            label: "Lecture",
            sessionType: "lecture",
            days: (meetingPattern as { days: unknown[] }).days,
          },
        ]
      : [];

  const roles = rawRoles
    .map((role, index): MeetingRolePattern | null => {
      if (!role || typeof role !== "object") return null;
      const rawDays = Array.isArray((role as { days?: unknown[] }).days)
        ? (role as { days: unknown[] }).days
        : [];
      const days = normalizeDays(rawDays);
      if (days.length === 0) return null;

      const sessionType =
        (role as { sessionType?: unknown }).sessionType === "lab" ? "lab" : "lecture";
      const label =
        typeof (role as { label?: unknown }).label === "string" &&
        (role as { label: string }).label.trim().length > 0
          ? (role as { label: string }).label.trim()
          : sessionType === "lab"
            ? "Lab"
            : "Lecture";
      const roleKeySource =
        typeof (role as { roleKey?: unknown }).roleKey === "string" &&
        (role as { roleKey: string }).roleKey.trim().length > 0
          ? (role as { roleKey: string }).roleKey
          : `${sessionType}-${index + 1}`;
      const roleKey = slugifyRoleKey(roleKeySource);
      if (!roleKey) return null;

      return { roleKey, label, sessionType, days };
    })
    .filter((role): role is MeetingRolePattern => role !== null);

  if (roles.length === 0) {
    throw new DomainInvariantError("Term creation requires one or more meeting role patterns");
  }

  return roles;
}

function mapEventTypeToSlotType(eventType: string | null | undefined) {
  switch (eventType) {
    case "holiday":
      return "holiday" as const;
    case "break_day":
    case "reading_day":
      return "break_day" as const;
    case "finals_start":
    case "finals_end":
      return "finals" as const;
    default:
      return null;
  }
}

function upsertCandidate(
  dayMap: Map<string, DayCandidate>,
  candidate: MaterializedSlotCandidate,
  conflicts: CalendarMaterializationConflict[],
) {
  const key = toDateKey(candidate.date);
  const existing = dayMap.get(key);
  if (!existing) {
    dayMap.set(key, candidate);
    return;
  }

  if (existing.slotType !== candidate.slotType) {
    conflicts.push({
      code: "slot_type_conflict",
      date: key,
      meetingRoleKey: null,
      message: `Calendar materialization produced conflicting slot types (${existing.slotType} vs ${candidate.slotType}) on ${key}`,
    });
  }

  const meetingRoleKeys = [...new Set([...existing.meetingRoleKeys, ...candidate.meetingRoleKeys])];
  const meetingRoleLabels = [...new Set([...existing.meetingRoleLabels, ...candidate.meetingRoleLabels])];
  const provenance = [...existing.provenance, ...candidate.provenance];
  dayMap.set(key, {
    ...candidate,
    slotType: candidate.slotType,
    label: candidate.label ?? existing.label,
    academicCalendarEventId: candidate.academicCalendarEventId ?? existing.academicCalendarEventId,
    meetingRoleKeys,
    meetingRoleLabels,
    provenance,
  });
}

function assertDateOrdering(startDate: Date, endDate: Date) {
  if (startDate.getTime() > endDate.getTime()) {
    throw new DomainInvariantError("Term startDate must be on or before endDate");
  }
}

function assertCalendarFit(boundaries: AcademicCalendarEventRow[], startDate: Date, endDate: Date) {
  const termStarts = boundaries
    .filter((event) => event.eventType === "term_start")
    .map((event) => event.startsOn.getTime());
  const termEnds = boundaries
    .filter((event) => event.eventType === "term_end")
    .map((event) => event.endsOn.getTime());

  if (termStarts.length > 0 && startDate.getTime() < Math.min(...termStarts)) {
    throw new DomainInvariantError("Term startDate does not fit within the selected Academic Calendar");
  }
  if (termEnds.length > 0 && endDate.getTime() > Math.max(...termEnds)) {
    throw new DomainInvariantError("Term endDate does not fit within the selected Academic Calendar");
  }
}

function buildOverrideCandidate(
  date: Date,
  slotType: "holiday" | "break_day" | "finals",
  override: InstructorOverrideRow,
): MaterializedSlotCandidate {
  return {
    date,
    slotType,
    label: override.label,
    source: "instructor_override",
    academicCalendarEventId: override.academicCalendarEventId ?? null,
    meetingRoleKeys: [],
    meetingRoleLabels: [],
    instructionalCapacity: "normal",
    capacitySource: "instructor_override",
    capacityReason: override.reason ?? override.label ?? override.action,
    provenance: [
      {
        source: "instructor_override",
        referenceId: override.id,
        detail: override.reason ?? override.label ?? override.action,
      },
    ],
  };
}

function buildEventCandidate(date: Date, event: AcademicCalendarEventRow): MaterializedSlotCandidate | null {
  const slotType = mapEventTypeToSlotType(event.eventType);
  if (!slotType) return null;
  return {
    date,
    slotType,
    label: event.label,
    source: "academic_calendar_event",
    academicCalendarEventId: event.id,
    meetingRoleKeys: [],
    meetingRoleLabels: [],
    instructionalCapacity: "normal",
    capacitySource: "baseline",
    capacityReason: null,
    provenance: [
      {
        source: "academic_calendar_event",
        referenceId: event.id,
        detail: `${event.eventType}:${event.label}`,
      },
    ],
  };
}

function resolveOverrideRange(
  override: InstructorOverrideRow,
  eventsById: Map<string, AcademicCalendarEventRow>,
): { start: Date; end: Date } | null {
  if (override.academicCalendarEventId) {
    const referenced = eventsById.get(override.academicCalendarEventId);
    if (referenced) {
      return { start: referenced.startsOn, end: referenced.endsOn };
    }
  }
  if (override.startsOn && override.endsOn) {
    return { start: override.startsOn, end: override.endsOn };
  }
  return null;
}

function daysBetween(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / (24 * 60 * 60 * 1000));
}

function baselineCapacityHint(): CapacityHint {
  return {
    instructionalCapacity: "normal",
    capacitySource: "baseline",
    capacityReason: "No explicit break-proximity signal in the calendar.",
  };
}

function applyCapacityHint(candidate: MaterializedSlotCandidate, hint: CapacityHint): MaterializedSlotCandidate {
  return {
    ...candidate,
    instructionalCapacity: hint.instructionalCapacity,
    capacitySource: hint.capacitySource,
    capacityReason: hint.capacityReason,
  };
}

function annotateClassDayCapacityHints(candidates: MaterializedSlotCandidate[]) {
  const sorted = [...candidates].sort((left, right) => left.date.getTime() - right.date.getTime());
  const hintsByDateKey = new Map<string, CapacityHint>();

  for (const candidate of sorted) {
    if (candidate.slotType === "class_day") {
      hintsByDateKey.set(toDateKey(candidate.date), baselineCapacityHint());
    }
  }

  const breakCandidates = sorted.filter((candidate) => candidate.slotType === "break_day");
  let index = 0;
  while (index < breakCandidates.length) {
    const start = breakCandidates[index]!;
    let end = start;
    let cursor = index + 1;
    while (
      cursor < breakCandidates.length &&
      daysBetween(end.date, breakCandidates[cursor]!.date) === 1
    ) {
      end = breakCandidates[cursor]!;
      cursor += 1;
    }

    const previousClassDay = [...sorted]
      .reverse()
      .find(
        (candidate) =>
          candidate.slotType === "class_day" &&
          candidate.date.getTime() < start.date.getTime() &&
          daysBetween(candidate.date, start.date) <= 4,
      );
    if (previousClassDay) {
      hintsByDateKey.set(toDateKey(previousClassDay.date), {
        instructionalCapacity: "reduced_engagement",
        capacitySource: "heuristic",
        capacityReason: `Last class day before explicit break starting ${toDateKey(start.date)}.`,
      });
    }

    const nextClassDay = sorted.find(
      (candidate) =>
        candidate.slotType === "class_day" &&
        candidate.date.getTime() > end.date.getTime() &&
        daysBetween(end.date, candidate.date) <= 4,
    );
    if (nextClassDay && !hintsByDateKey.has(toDateKey(nextClassDay.date))) {
      hintsByDateKey.set(toDateKey(nextClassDay.date), {
        instructionalCapacity: "recovery",
        capacitySource: "heuristic",
        capacityReason: `First class day after explicit break ending ${toDateKey(end.date)}.`,
      });
    } else if (nextClassDay) {
      const existingHint = hintsByDateKey.get(toDateKey(nextClassDay.date));
      if (existingHint?.capacitySource === "baseline") {
        hintsByDateKey.set(toDateKey(nextClassDay.date), {
          instructionalCapacity: "recovery",
          capacitySource: "heuristic",
          capacityReason: `First class day after explicit break ending ${toDateKey(end.date)}.`,
        });
      }
    }

    index = cursor;
  }

  return sorted.map((candidate) => {
    if (candidate.slotType !== "class_day") return candidate;
    return applyCapacityHint(
      candidate,
      hintsByDateKey.get(toDateKey(candidate.date)) ?? baselineCapacityHint(),
    );
  });
}

export function resolveSessionMeetingRole(
  meetingRoles: MeetingRolePattern[],
  session: {
    sessionType: "lecture" | "lab";
    date: Date | null;
  },
) {
  if (!session.date) return null;

  const exactMatches = meetingRoles.filter(
    (role) =>
      role.sessionType === session.sessionType &&
      role.days.includes(session.date?.getUTCDay() ?? -1),
  );
  if (exactMatches.length > 0) return exactMatches[0]!.roleKey;

  const typeMatches = meetingRoles.filter((role) => role.sessionType === session.sessionType);
  if (typeMatches.length > 0) return typeMatches[0]!.roleKey;

  const dayMatches = meetingRoles.filter((role) => role.days.includes(session.date?.getUTCDay() ?? -1));
  if (dayMatches.length > 0) return dayMatches[0]!.roleKey;

  return null;
}

export async function previewCalendarMaterialization(
  tx: RedesignTx,
  input: PreviewInput,
): Promise<CalendarMaterializationPreview> {
  assertDateOrdering(input.startDate, input.endDate);
  const meetingRoles = normalizeMeetingRolePatterns(input.meetingPattern);

  const [events, boundaries, overrides] = await Promise.all([
    tx.academicCalendarEvent.findMany({
      where: {
        academicCalendarId: input.academicCalendarId,
        startsOn: { lte: input.endDate },
        endsOn: { gte: input.startDate },
      },
      orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }],
    }) as Promise<AcademicCalendarEventRow[]>,
    tx.academicCalendarEvent.findMany({
      where: {
        academicCalendarId: input.academicCalendarId,
        eventType: { in: ["term_start", "term_end"] },
      },
      orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }],
    }) as Promise<AcademicCalendarEventRow[]>,
    tx.instructorCalendarOverride.findMany({
      where: {
        instructorId: input.instructorId,
        academicCalendarId: input.academicCalendarId,
        archivedAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }) as Promise<InstructorOverrideRow[]>,
  ]);

  assertCalendarFit(boundaries, input.startDate, input.endDate);

  const eventsById = new Map(events.map((event) => [event.id, event]));
  const warnings: string[] = [];
  const conflicts: CalendarMaterializationConflict[] = [];
  const dayMap = new Map<string, DayCandidate>();

  for (const event of events) {
    const start = event.startsOn > input.startDate ? event.startsOn : input.startDate;
    const end = event.endsOn < input.endDate ? event.endsOn : input.endDate;
    for (const date of eachDateInclusive(start, end)) {
      const candidate = buildEventCandidate(date, event);
      if (!candidate) continue;
      upsertCandidate(dayMap, candidate, conflicts);
    }
  }

  for (const override of overrides) {
    const range = resolveOverrideRange(override, eventsById);
    if (!range) {
      warnings.push(`Instructor override ${override.id} could not be applied because it has no date range.`);
      continue;
    }

    const start = range.start > input.startDate ? range.start : input.startDate;
    const end = range.end < input.endDate ? range.end : input.endDate;
    if (start.getTime() > end.getTime()) continue;

    const slotType = mapEventTypeToSlotType(override.eventType);
    let matchedAny = false;

    for (const date of eachDateInclusive(start, end)) {
      const key = toDateKey(date);
      const existing = dayMap.get(key) ?? null;

      if (override.action === "suppress") {
        if (existing) {
          matchedAny = true;
          dayMap.delete(key);
        }
        continue;
      }

      if (!slotType) {
        warnings.push(`Instructor override ${override.id} could not materialize a supported slot type.`);
        continue;
      }

      const candidate = buildOverrideCandidate(date, slotType, override);
      if (existing?.slotType === "class_day") {
        conflicts.push({
          code: "meeting_day_overridden",
          date: key,
          meetingRoleKey: null,
          message: `Instructor override ${override.id} replaces a meeting day on ${key}`,
        });
      }

      if (override.action === "replace") {
        matchedAny = matchedAny || Boolean(existing);
      }

      dayMap.set(key, candidate);
      matchedAny = true;
    }

    if (!matchedAny) {
      warnings.push(`Instructor override ${override.id} did not match any in-range calendar dates.`);
    }
  }

  const classDayDatesByRoleKey = new Map<string, Date[]>();
  for (const role of meetingRoles) {
    classDayDatesByRoleKey.set(role.roleKey, []);
  }

  for (const date of eachDateInclusive(input.startDate, input.endDate)) {
    const key = toDateKey(date);
    const matchingRoles = meetingRoles.filter((role) => role.days.includes(date.getUTCDay()));
    if (matchingRoles.length === 0) continue;

    const existing = dayMap.get(key);
    if (existing && existing.slotType !== "class_day") {
      for (const role of matchingRoles) {
        conflicts.push({
          code: "meeting_day_blocked",
          date: key,
          meetingRoleKey: role.roleKey,
          message: `${role.label} on ${key} is blocked by ${existing.slotType}`,
        });
      }
      continue;
    }

    const candidate: MaterializedSlotCandidate = {
      date,
      slotType: "class_day",
      label:
        matchingRoles.length === 1
          ? `${matchingRoles[0]!.label} class day`
          : `${matchingRoles.map((role) => role.label).join(" / ")} class day`,
      source: `meeting_roles:${matchingRoles.map((role) => role.roleKey).join(",")}`,
      academicCalendarEventId: null,
      meetingRoleKeys: matchingRoles.map((role) => role.roleKey),
      meetingRoleLabels: matchingRoles.map((role) => role.label),
      instructionalCapacity: "normal",
      capacitySource: "baseline",
      capacityReason: "No explicit break-proximity signal in the calendar.",
      provenance: matchingRoles.map((role) => ({
        source: "meeting_role_pattern",
        referenceId: role.roleKey,
        detail: `${role.label}:${role.days.join(",")}`,
      })),
    };
    upsertCandidate(dayMap, candidate, conflicts);
  }

  const candidates = annotateClassDayCapacityHints([...dayMap.values()]);
  for (const candidate of candidates) {
    if (candidate.slotType !== "class_day") continue;
    for (const roleKey of candidate.meetingRoleKeys) {
      classDayDatesByRoleKey.get(roleKey)?.push(candidate.date);
    }
  }

  return {
    meetingRoles,
    candidates,
    conflicts,
    warnings,
    classDayDatesByRoleKey,
  };
}
