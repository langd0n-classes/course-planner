import { createHash } from "node:crypto";
import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import { assertInstructorInstitution } from "./course-service";
import { getOwnedCalendarSlotForInstructor, getOwnedTermForInstructor } from "./ownership-service";
import type { RedesignDb, RedesignTx } from "./types";

type AcademicCalendarVersionEventInput = {
  eventType: "term_start" | "term_end" | "holiday" | "break_day" | "reading_day" | "finals_start" | "finals_end" | "other";
  startsOn: Date;
  endsOn: Date;
  label: string;
  sourceUri?: string | null;
};

type AcademicCalendarVersionPeriodInput = {
  kind: "instructional" | "no_instruction" | "special_schedule";
  label: string;
  startsOn: Date;
  endsOn: Date;
};

type CreateAcademicCalendarVersionInput = {
  instructorId: string;
  academicCalendarId: string;
  name: string;
  academicYear: string;
  sourceUri?: string | null;
  events?: AcademicCalendarVersionEventInput[];
  periods?: AcademicCalendarVersionPeriodInput[];
};

type UpsertTermMeetingPatternInput = {
  activityTypeVersionId: string;
  label?: string | null;
  daysOfWeek: string[];
  startTimeLocal: string;
  endTimeLocal?: string | null;
  timeZone: string;
  startsOn: string;
  endsOn: string;
};

type PreviewTermCalendarInput = {
  instructorId: string;
  termId: string;
  meetingPatterns: UpsertTermMeetingPatternInput[];
};

type ApplyTermCalendarInput = PreviewTermCalendarInput & {
  previewToken: string;
  expectedCurrentCalendarSlotCount: number;
};

type TermCalendarExceptionInput = {
  instructorId: string;
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

type UpdateTermCalendarExceptionInput = Partial<Omit<TermCalendarExceptionInput, "instructorId">>;

type CalendarSlotCandidate = {
  date: string;
  slotType: "class_day" | "holiday" | "finals" | "break_day";
  label: string | null;
  source: string;
  academicCalendarEventId: string | null;
  meetingRoleKeys: string[];
  meetingRoleLabels: string[];
  instructionalCapacity: "normal" | "reduced_engagement" | "recovery" | "assessment_period";
  capacitySource: "baseline" | "heuristic" | "instructor_override";
  capacityReason: string | null;
  provenance: Array<{
    source: "academic_calendar_event" | "instructor_override" | "meeting_role_pattern";
    referenceId: string | null;
    detail: string;
  }>;
};

type CalendarConflict = {
  code: string;
  date: string | null;
  meetingRoleKey: string | null;
  message: string;
};

type PreviewResult = {
  kind: "preview";
  previewToken: string;
  expectedCurrentCalendarSlotCount: number;
  calendarSlotCandidates: CalendarSlotCandidate[];
  conflicts: CalendarConflict[];
  warnings: string[];
};

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function fromIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
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

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeMeetingPatterns(patterns: UpsertTermMeetingPatternInput[]) {
  return patterns
    .map((pattern) => ({
      ...pattern,
      label: pattern.label ?? "Meeting",
      daysOfWeek: [...new Set(pattern.daysOfWeek.map((day) => day.trim().toLowerCase()))].sort(),
    }))
    .sort((left, right) =>
      stableKey(left).localeCompare(stableKey(right)),
    );
}

function stableKey(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableKey(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${key}:${stableKey(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPreview(payload: unknown) {
  return createHash("sha256").update(stableKey(payload)).digest("hex");
}

async function getOwnedAcademicCalendarForInstructor(
  tx: RedesignTx,
  instructorId: string,
  academicCalendarId: string,
) {
  const calendar = await tx.academicCalendar.findUnique({ where: { id: academicCalendarId } });
  if (!calendar) throw new DomainInvariantError("Academic Calendar not found");
  await assertInstructorInstitution(tx, instructorId, calendar.institutionId);
  return calendar;
}

async function assertActivityTypeVersionOwnedByInstructor(
  tx: RedesignTx,
  instructorId: string,
  activityTypeVersionId: string,
) {
  if (!tx.activityTypeVersion?.findUnique) {
    return { id: activityTypeVersionId };
  }
  const version = await tx.activityTypeVersion.findUnique({
    where: { id: activityTypeVersionId },
    include: { activityType: { select: { instructorId: true } } },
  });
  if (!version || version.activityType?.instructorId !== instructorId) {
    throw new DomainInvariantError("Activity Type version not found");
  }
  return version;
}

function mapEventTypeToSlotType(
  eventType: string,
): "holiday" | "break_day" | "finals" | null {
  switch (eventType) {
    case "holiday":
      return "holiday";
    case "break_day":
    case "reading_day":
      return "break_day";
    case "finals_start":
    case "finals_end":
      return "finals";
    default:
      return null;
  }
}

function mapPeriodToSlotType(
  period: { kind: "instructional" | "no_instruction" | "special_schedule"; label: string },
): "break_day" | "finals" | null {
  if (period.kind === "instructional") return null;
  if (period.kind === "special_schedule") return "finals";
  return "break_day";
}

function sortCandidates(candidates: CalendarSlotCandidate[]) {
  return [...candidates].sort((left, right) =>
    left.date.localeCompare(right.date) ||
    left.slotType.localeCompare(right.slotType) ||
    (left.label ?? "").localeCompare(right.label ?? "") ||
    left.source.localeCompare(right.source),
  );
}

function sortConflicts(conflicts: CalendarConflict[]) {
  return [...conflicts].sort((left, right) =>
    (left.date ?? "").localeCompare(right.date ?? "") ||
    left.code.localeCompare(right.code) ||
    (left.meetingRoleKey ?? "").localeCompare(right.meetingRoleKey ?? "") ||
    left.message.localeCompare(right.message),
  );
}

function sortWarnings(warnings: string[]) {
  return [...warnings].sort((left, right) => left.localeCompare(right));
}

async function computeTermCalendarPreview(tx: RedesignTx, input: PreviewTermCalendarInput): Promise<PreviewResult> {
  const term = await getOwnedTermForInstructor(tx, input.instructorId, input.termId);
  if (!term.academicCalendarVersionId) {
    throw new DomainInvariantError("Term adopted Academic Calendar version is missing");
  }

  const version = await tx.academicCalendarVersion.findUnique({
    where: { id_academicCalendarId: { id: term.academicCalendarVersionId, academicCalendarId: term.academicCalendarId } },
  });
  if (!version) {
    throw new DomainInvariantError("Academic Calendar version not found");
  }

  const normalizedPatterns = normalizeMeetingPatterns(input.meetingPatterns);
  for (const pattern of normalizedPatterns) {
    await assertActivityTypeVersionOwnedByInstructor(tx, input.instructorId, pattern.activityTypeVersionId);
  }

  const [events, periods, exceptions, existingSlots] = await Promise.all([
    tx.academicCalendarEvent.findMany({
      where: {
        academicCalendarId: term.academicCalendarId,
        academicCalendarVersionId: term.academicCalendarVersionId,
        startsOn: { lte: term.endDate },
        endsOn: { gte: term.startDate },
      },
      orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }, { id: "asc" }],
    }),
    tx.academicCalendarPeriod.findMany({
      where: {
        academicCalendarVersionId: term.academicCalendarVersionId,
        startsOn: { lte: term.endDate },
        endsOn: { gte: term.startDate },
      },
      orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }, { id: "asc" }],
    }),
    tx.termCalendarException.findMany({
      where: { termId: term.id },
      orderBy: [{ targetDate: "asc" }, { startsAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    tx.calendarSlot.findMany({
      where: { termId: term.id },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);

  const dayMap = new Map<string, CalendarSlotCandidate>();
  const conflicts: CalendarConflict[] = [];
  const warnings: string[] = [];
  const slotIdByDate = new Map<string, string>();
  for (const slot of existingSlots) {
    slotIdByDate.set(toIsoDate(slot.date), slot.id);
  }

  for (const event of events) {
    const slotType = mapEventTypeToSlotType(event.eventType);
    if (!slotType) continue;
    for (const date of eachDateInclusive(
      event.startsOn > term.startDate ? event.startsOn : term.startDate,
      event.endsOn < term.endDate ? event.endsOn : term.endDate,
    )) {
      const key = toIsoDate(date);
      dayMap.set(key, {
        date: key,
        slotType,
        label: event.label,
        source: `academic_calendar_event:${event.eventType}`,
        academicCalendarEventId: event.id,
        meetingRoleKeys: [],
        meetingRoleLabels: [],
        instructionalCapacity: slotType === "finals" ? "assessment_period" : "normal",
        capacitySource: "baseline",
        capacityReason: null,
        provenance: [{ source: "academic_calendar_event", referenceId: event.id, detail: `${event.eventType}:${event.label}` }],
      });
    }
  }

  for (const period of periods) {
    const slotType = mapPeriodToSlotType(period);
    if (!slotType) continue;
    for (const date of eachDateInclusive(
      period.startsOn > term.startDate ? period.startsOn : term.startDate,
      period.endsOn < term.endDate ? period.endsOn : term.endDate,
    )) {
      const key = toIsoDate(date);
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          date: key,
          slotType,
          label: period.label,
          source: `academic_calendar_period:${period.kind}`,
          academicCalendarEventId: null,
          meetingRoleKeys: [],
          meetingRoleLabels: [],
          instructionalCapacity: slotType === "finals" ? "assessment_period" : "normal",
          capacitySource: "baseline",
          capacityReason: null,
          provenance: [],
        });
      }
    }
  }

  const start = term.startDate;
  const end = term.endDate;
  for (const date of eachDateInclusive(start, end)) {
    const key = toIsoDate(date);
    const matchingPatterns = normalizedPatterns.filter((pattern) => {
      const startOn = fromIsoDate(pattern.startsOn);
      const endOn = fromIsoDate(pattern.endsOn);
      return date >= startOn && date <= endOn && pattern.daysOfWeek.some((day) => DAY_INDEX[day] === date.getUTCDay());
    });
    if (matchingPatterns.length === 0) continue;
    const existing = dayMap.get(key);
    if (existing && existing.slotType !== "class_day") {
      conflicts.push({
        code: "meeting_day_blocked",
        date: key,
        meetingRoleKey: matchingPatterns[0]?.activityTypeVersionId ?? null,
        message: `Meeting pattern on ${key} is blocked by ${existing.slotType}`,
      });
      continue;
    }
    const meetingRoleKeys = matchingPatterns.map((pattern) => pattern.activityTypeVersionId);
    const meetingRoleLabels = matchingPatterns.map((pattern) => pattern.label ?? "Meeting");
    dayMap.set(key, {
      date: key,
      slotType: "class_day",
      label: meetingRoleLabels.length === 1 ? `${meetingRoleLabels[0]} class day` : `${meetingRoleLabels.join(" / ")} class day`,
      source: `meeting_patterns:${meetingRoleKeys.join(",")}`,
      academicCalendarEventId: existing?.academicCalendarEventId ?? null,
      meetingRoleKeys,
      meetingRoleLabels,
      instructionalCapacity: "normal",
      capacitySource: "baseline",
      capacityReason: null,
      provenance: meetingRoleKeys.map((referenceId, index) => ({
        source: "meeting_role_pattern" as const,
        referenceId,
        detail: `${meetingRoleLabels[index]}:${referenceId}`,
      })),
    });
  }

  for (const exception of exceptions) {
    const targetKey = exception.targetDate
      ? toIsoDate(exception.targetDate)
      : exception.startsAt
        ? toIsoDate(exception.startsAt)
        : exception.calendarSlotId
          ? [...slotIdByDate.entries()].find(([, slotId]) => slotId === exception.calendarSlotId)?.[0] ?? null
          : null;
    if (!targetKey) {
      warnings.push(`Term calendar exception ${exception.id} has no resolvable target.`);
      continue;
    }

    if (exception.action === "cancel") {
      dayMap.set(targetKey, {
        ...(dayMap.get(targetKey) ?? {
          date: targetKey,
          academicCalendarEventId: null,
          meetingRoleKeys: [],
          meetingRoleLabels: [],
          instructionalCapacity: "normal" as const,
          capacitySource: "baseline" as const,
          capacityReason: null,
          provenance: [],
        }),
        date: targetKey,
        slotType: "break_day",
        label: exception.label ?? exception.reason ?? "Canceled",
        source: `term_calendar_exception:cancel:${exception.id}`,
      });
      continue;
    }

    if (exception.action === "add") {
      dayMap.set(targetKey, {
        date: targetKey,
        slotType: "class_day",
        label: exception.label ?? "Added meeting",
        source: `term_calendar_exception:add:${exception.id}`,
        academicCalendarEventId: null,
        meetingRoleKeys: exception.activityTypeVersionId ? [exception.activityTypeVersionId] : [],
        meetingRoleLabels: [exception.label ?? "Added meeting"],
        instructionalCapacity: "normal",
        capacitySource: "baseline",
        capacityReason: null,
        provenance: [],
      });
      continue;
    }

    if (exception.action === "replace") {
      if (exception.calendarSlotId) {
        const priorDate = [...slotIdByDate.entries()].find(([, slotId]) => slotId === exception.calendarSlotId)?.[0] ?? null;
        if (priorDate && priorDate !== targetKey) {
          dayMap.delete(priorDate);
        }
      }
      dayMap.set(targetKey, {
        ...(dayMap.get(targetKey) ?? {
          date: targetKey,
          academicCalendarEventId: null,
          meetingRoleKeys: [],
          meetingRoleLabels: [],
          instructionalCapacity: "normal" as const,
          capacitySource: "baseline" as const,
          capacityReason: null,
          provenance: [],
        }),
        date: targetKey,
        slotType: "class_day",
        label: exception.label ?? "Replaced meeting",
        source: `term_calendar_exception:replace:${exception.id}`,
      });
      continue;
    }

    if (exception.action === "modify") {
      const current = dayMap.get(targetKey);
      if (!current) {
        warnings.push(`Term calendar exception ${exception.id} could not modify a missing slot.`);
        continue;
      }
      dayMap.set(targetKey, {
        ...current,
        label: exception.label ?? current.label,
        source: `term_calendar_exception:modify:${exception.id}`,
      });
    }
  }

  const calendarSlotCandidates = sortCandidates([...dayMap.values()]);
  const sortedConflicts = sortConflicts(conflicts);
  const sortedWarnings = sortWarnings(warnings);
  return {
    kind: "preview",
    previewToken: hashPreview({
      termId: term.id,
      academicCalendarVersionId: term.academicCalendarVersionId,
      meetingPatterns: normalizedPatterns,
      calendarSlotCandidates,
      conflicts: sortedConflicts,
      warnings: sortedWarnings,
      expectedCurrentCalendarSlotCount: existingSlots.length,
    }),
    expectedCurrentCalendarSlotCount: existingSlots.length,
    calendarSlotCandidates,
    conflicts: sortedConflicts,
    warnings: sortedWarnings,
  };
}

export async function createAcademicCalendarVersion(
  db: RedesignDb,
  input: CreateAcademicCalendarVersionInput,
) {
  return db.$transaction(async (tx) => {
    const calendar = await getOwnedAcademicCalendarForInstructor(tx, input.instructorId, input.academicCalendarId);
    const existingVersions = await tx.academicCalendarVersion.findMany({
      where: { academicCalendarId: input.academicCalendarId },
      orderBy: [{ version: "asc" }],
    });
    const nextVersionNumber = (existingVersions.at(-1)?.version ?? 0) + 1;
    const version = await tx.academicCalendarVersion.create({
      data: {
        academicCalendarId: input.academicCalendarId,
        version: nextVersionNumber,
        name: input.name,
        academicYear: input.academicYear,
        sourceUri: input.sourceUri ?? null,
        publishedAt: new Date(),
      },
    });

    const events = [...(input.events ?? [])].sort((left, right) =>
      left.startsOn.getTime() - right.startsOn.getTime() ||
      left.endsOn.getTime() - right.endsOn.getTime() ||
      left.eventType.localeCompare(right.eventType) ||
      left.label.localeCompare(right.label),
    );
    if (events.length > 0) {
      await tx.academicCalendarEvent.createMany({
        data: events.map((event) => ({
          academicCalendarId: input.academicCalendarId,
          academicCalendarVersionId: version.id,
          eventType: event.eventType,
          startsOn: event.startsOn,
          endsOn: event.endsOn,
          label: event.label,
          sourceUri: event.sourceUri ?? null,
        })),
      });
    }

    const periods = [...(input.periods ?? [])].sort((left, right) =>
      left.startsOn.getTime() - right.startsOn.getTime() ||
      left.endsOn.getTime() - right.endsOn.getTime() ||
      left.kind.localeCompare(right.kind) ||
      left.label.localeCompare(right.label),
    );
    if (periods.length > 0) {
      await tx.academicCalendarPeriod.createMany({
        data: periods.map((period) => ({
          academicCalendarVersionId: version.id,
          kind: period.kind,
          label: period.label,
          startsOn: period.startsOn,
          endsOn: period.endsOn,
        })),
      });
    }

    await tx.academicCalendar.update({
      where: { id: calendar.id },
      data: {
        currentVersionId: version.id,
        version: nextVersionNumber,
        name: input.name,
        academicYear: input.academicYear,
        sourceUri: input.sourceUri ?? null,
        publishedAt: version.publishedAt,
      },
    });

    return {
      version,
      events: events.map((event, index) => ({
        id: `created-event-${index}`,
        academicCalendarId: input.academicCalendarId,
        academicCalendarVersionId: version.id,
        ...event,
        sourceUri: event.sourceUri ?? null,
      })),
      periods: periods.map((period, index) => ({
        id: `created-period-${index}`,
        academicCalendarVersionId: version.id,
        ...period,
      })),
    };
  });
}

export async function listAcademicCalendarVersionsForInstructor(
  db: RedesignDb,
  instructorId: string,
  academicCalendarId: string,
) {
  return db.$transaction(async (tx) => {
    await getOwnedAcademicCalendarForInstructor(tx, instructorId, academicCalendarId);
    return tx.academicCalendarVersion.findMany({
      where: { academicCalendarId },
      orderBy: [{ version: "asc" }, { createdAt: "asc" }],
    });
  });
}

export async function getAcademicCalendarVersionForInstructor(
  db: RedesignDb,
  instructorId: string,
  academicCalendarVersionId: string,
) {
  return db.$transaction(async (tx) => {
    const version = await tx.academicCalendarVersion.findUnique({
      where: { id: academicCalendarVersionId },
      include: { academicCalendar: true },
    });
    if (!version) throw new DomainInvariantError("Academic Calendar version not found");
    await assertInstructorInstitution(tx, instructorId, version.academicCalendar.institutionId);
    const [events, periods] = await Promise.all([
      tx.academicCalendarEvent.findMany({
        where: { academicCalendarVersionId },
        orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }, { id: "asc" }],
      }),
      tx.academicCalendarPeriod.findMany({
        where: { academicCalendarVersionId },
        orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }, { id: "asc" }],
      }),
    ]);
    return { version, events, periods };
  });
}

export async function listTermCalendarExceptions(db: RedesignDb, instructorId: string, termId: string) {
  return db.$transaction(async (tx) => {
    await getOwnedTermForInstructor(tx, instructorId, termId);
    return tx.termCalendarException.findMany({
      where: { termId },
      orderBy: [{ targetDate: "asc" }, { startsAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  });
}

export async function createTermCalendarException(
  db: RedesignDb,
  termId: string,
  input: TermCalendarExceptionInput,
) {
  return db.$transaction(async (tx) => {
    await getOwnedTermForInstructor(tx, input.instructorId, termId);
    if (input.calendarSlotId) {
      const slot = await getOwnedCalendarSlotForInstructor(tx, input.instructorId, input.calendarSlotId);
      if (slot.termId !== termId) throw new DomainInvariantError("Calendar slot not found");
    }
    if (input.activityTypeVersionId) {
      await assertActivityTypeVersionOwnedByInstructor(tx, input.instructorId, input.activityTypeVersionId);
    }
    return tx.termCalendarException.create({
      data: {
        termId,
        action: input.action,
        activityTypeVersionId: input.activityTypeVersionId ?? null,
        calendarSlotId: input.calendarSlotId ?? null,
        targetDate: input.targetDate ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        label: input.label ?? null,
        reason: input.reason ?? null,
        provenance: input.provenance ?? null,
      },
    });
  });
}

export async function updateTermCalendarException(
  db: RedesignDb,
  exceptionId: string,
  instructorId: string,
  input: UpdateTermCalendarExceptionInput,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.termCalendarException.findUnique({
      where: { id: exceptionId },
      include: { term: { include: { course: { select: { instructorId: true } } } } },
    });
    if (!existing || existing.term?.course?.instructorId !== instructorId) {
      throw new DomainInvariantError("Term calendar exception not found");
    }
    if (input.calendarSlotId) {
      const slot = await getOwnedCalendarSlotForInstructor(tx, instructorId, input.calendarSlotId);
      if (slot.termId !== existing.termId) throw new DomainInvariantError("Calendar slot not found");
    }
    if (input.activityTypeVersionId) {
      await assertActivityTypeVersionOwnedByInstructor(tx, instructorId, input.activityTypeVersionId);
    }
    return tx.termCalendarException.update({
      where: { id: exceptionId },
      data: {
        action: input.action,
        activityTypeVersionId: input.activityTypeVersionId,
        calendarSlotId: input.calendarSlotId,
        targetDate: input.targetDate,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        label: input.label,
        reason: input.reason,
        provenance: input.provenance,
      },
    });
  });
}

export async function deleteTermCalendarException(
  db: RedesignDb,
  exceptionId: string,
  instructorId: string,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.termCalendarException.findUnique({
      where: { id: exceptionId },
      include: { term: { include: { course: { select: { instructorId: true } } } } },
    });
    if (!existing || existing.term?.course?.instructorId !== instructorId) {
      throw new DomainInvariantError("Term calendar exception not found");
    }
    await tx.termCalendarException.delete({ where: { id: exceptionId } });
  });
}

export async function previewTermCalendar(
  db: RedesignDb,
  input: PreviewTermCalendarInput,
) {
  return db.$transaction((tx) => computeTermCalendarPreview(tx, input));
}

export async function applyTermCalendar(
  db: RedesignDb,
  input: ApplyTermCalendarInput,
) {
  return db.$transaction(async (tx) => {
    const preview = await computeTermCalendarPreview(tx, input);
    if (preview.previewToken !== input.previewToken) {
      throw new ConcurrencyConflictError("Preview token mismatch");
    }
    if (preview.expectedCurrentCalendarSlotCount !== input.expectedCurrentCalendarSlotCount) {
      throw new ConcurrencyConflictError("Calendar slot count changed during preview");
    }

    await tx.termMeetingPattern.deleteMany({ where: { termId: input.termId } });
    if (input.meetingPatterns.length > 0) {
      await tx.termMeetingPattern.createMany({
        data: normalizeMeetingPatterns(input.meetingPatterns).map((pattern) => ({
          termId: input.termId,
          activityTypeVersionId: pattern.activityTypeVersionId,
          label: pattern.label ?? null,
          daysOfWeek: pattern.daysOfWeek,
          startTimeLocal: pattern.startTimeLocal,
          endTimeLocal: pattern.endTimeLocal ?? null,
          timeZone: pattern.timeZone,
          startsOn: fromIsoDate(pattern.startsOn),
          endsOn: fromIsoDate(pattern.endsOn),
        })),
      });
    }

    await tx.calendarSlot.deleteMany({ where: { termId: input.termId } });
    if (preview.calendarSlotCandidates.length > 0) {
      await tx.calendarSlot.createMany({
        data: preview.calendarSlotCandidates.map((candidate) => ({
          termId: input.termId,
          academicCalendarEventId: candidate.academicCalendarEventId,
          date: fromIsoDate(candidate.date),
          slotType: candidate.slotType,
          label: candidate.label,
          source: candidate.source,
          instructionalCapacity: candidate.instructionalCapacity,
          capacitySource: candidate.capacitySource,
          capacityReason: candidate.capacityReason,
        })),
      });
    }

    return {
      kind: "applied" as const,
      calendarSlotCount: preview.calendarSlotCandidates.length,
      warnings: preview.warnings,
    };
  });
}
