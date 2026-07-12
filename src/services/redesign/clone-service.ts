import { DomainInvariantError } from "./errors";
import type { RedesignDb, RedesignTx } from "./types";

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

type CloneRequest = {
  sourceTermId: string;
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  institutionId: string;
  academicCalendarId: string;
  meetingPattern: unknown;
};

type GeneratedCalendarSlot = {
  date: Date;
  slotType: "class_day" | "holiday" | "break_day" | "finals";
  label: string | null;
  source: string;
  academicCalendarEventId: string | null;
};

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

function parseMeetingDays(meetingPattern: unknown): number[] {
  if (
    !meetingPattern ||
    typeof meetingPattern !== "object" ||
    !("days" in meetingPattern) ||
    !Array.isArray((meetingPattern as { days?: unknown[] }).days)
  ) {
    return [];
  }

  return ((meetingPattern as { days: unknown[] }).days ?? [])
    .filter((day): day is string => typeof day === "string")
    .map((day) => DAY_INDEX[day.toLowerCase()])
    .filter((value): value is number => value !== undefined);
}

function mapEventTypeToSlotType(eventType: string) {
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

async function assertCloneTarget(tx: RedesignTx, sourceTerm: { courseId: string }, input: CloneRequest) {
  const [courseInstitution, calendar] = await Promise.all([
    tx.courseInstitution.findUnique({
      where: { courseId_institutionId: { courseId: sourceTerm.courseId, institutionId: input.institutionId } },
    }),
    tx.academicCalendar.findUnique({
      where: { id_institutionId: { id: input.academicCalendarId, institutionId: input.institutionId } },
    }),
  ]);

  if (!courseInstitution) {
    throw new DomainInvariantError("Clone target Institution must be valid for the Course");
  }
  if (!calendar) {
    throw new DomainInvariantError("Clone target Academic Calendar must belong to the selected Institution");
  }
}

async function loadSourceTerm(tx: RedesignTx, termId: string) {
  const term = await tx.term.findUnique({
    where: { id: termId },
    include: {
      learningModules: {
        orderBy: { sequence: "asc" },
      },
      sessions: {
        include: {
          coverages: true,
          priorArt: true,
        },
        orderBy: [{ date: "asc" }, { sequence: "asc" }],
      },
      assessments: {
        include: {
          topics: true,
        },
        orderBy: [{ dueDate: "asc" }, { code: "asc" }],
      },
      calendarSlots: {
        orderBy: { date: "asc" },
      },
    },
  });
  if (!term) throw new DomainInvariantError("Source Term not found");
  return term;
}

async function generateCalendarSlots(
  tx: RedesignTx,
  input: Pick<CloneRequest, "academicCalendarId" | "startDate" | "endDate" | "meetingPattern">,
) {
  const events = await tx.academicCalendarEvent.findMany({
    where: {
      academicCalendarId: input.academicCalendarId,
      startsOn: { lte: input.endDate },
      endsOn: { gte: input.startDate },
    },
    orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }],
  });

  const nonClassSlots = new Map<string, GeneratedCalendarSlot>();

  for (const event of events) {
    const slotType = mapEventTypeToSlotType(event.eventType);
    if (!slotType) continue;
    const start = event.startsOn > input.startDate ? event.startsOn : input.startDate;
    const end = event.endsOn < input.endDate ? event.endsOn : input.endDate;
    for (const date of eachDateInclusive(start, end)) {
      nonClassSlots.set(toDateKey(date), {
        date,
        slotType,
        label: event.label,
        source: "academic_calendar",
        academicCalendarEventId: event.id,
      });
    }
  }

  const classDays = parseMeetingDays(input.meetingPattern);
  const slots: GeneratedCalendarSlot[] = [...nonClassSlots.values()];
  for (const date of eachDateInclusive(input.startDate, input.endDate)) {
    if (nonClassSlots.has(toDateKey(date))) continue;
    if (!classDays.includes(date.getUTCDay())) continue;
    slots.push({
      date,
      slotType: "class_day",
      label: null,
      source: "meeting_pattern",
      academicCalendarEventId: null,
    });
  }

  return slots.sort((left, right) => left.date.getTime() - right.date.getTime());
}

function mapSessionAndAssessmentDates(
  sourceTerm: Awaited<ReturnType<typeof loadSourceTerm>>,
  targetCalendarSlots: Awaited<ReturnType<typeof generateCalendarSlots>>,
) {
  const unresolvedDates: Array<{ sourceDate: string; sourceSessionId?: string; reason: string }> = [];
  const sourceClassDays = sourceTerm.calendarSlots
    .filter((slot: { slotType: string }) => slot.slotType === "class_day")
    .map((slot: { date: Date }) => slot.date);
  const targetClassDays = targetCalendarSlots
    .filter((slot: GeneratedCalendarSlot) => slot.slotType === "class_day")
    .map((slot: GeneratedCalendarSlot) => slot.date);
  const sourceOrdinalByDate = new Map<string, number>(
    sourceClassDays.map((date: Date, index: number) => [toDateKey(date), index]),
  );
  const mappedSessionDates = new Map<string, Date | null>();

  for (const session of sourceTerm.sessions) {
    if (!session.date) {
      mappedSessionDates.set(session.id, null);
      continue;
    }
    const ordinal = sourceOrdinalByDate.get(toDateKey(session.date));
    if (ordinal === undefined) {
      unresolvedDates.push({
        sourceDate: toDateKey(session.date),
        sourceSessionId: session.id,
        reason: "Source Session date is not a source class-day slot",
      });
      mappedSessionDates.set(session.id, null);
      continue;
    }
    const targetDate = targetClassDays[ordinal];
    if (!targetDate) {
      unresolvedDates.push({
        sourceDate: toDateKey(session.date),
        sourceSessionId: session.id,
        reason: "Target Term has fewer class meetings than the source Term",
      });
      mappedSessionDates.set(session.id, null);
      continue;
    }
    mappedSessionDates.set(session.id, targetDate);
  }

  const mappedAssessmentDates = new Map<string, Date | null>();
  for (const assessment of sourceTerm.assessments) {
    if (!assessment.dueDate) {
      mappedAssessmentDates.set(assessment.id, null);
      continue;
    }

    if (assessment.sessionId) {
      const sourceSession = sourceTerm.sessions.find(
        (session: { id: string }) => session.id === assessment.sessionId,
      );
      const mappedSessionDate = mappedSessionDates.get(assessment.sessionId) ?? null;
      if (sourceSession?.date && mappedSessionDate) {
        const deltaDays =
          (assessment.dueDate.getTime() - sourceSession.date.getTime()) / (24 * 60 * 60 * 1000);
        mappedAssessmentDates.set(assessment.id, addDays(mappedSessionDate, deltaDays));
        continue;
      }
    }

    const ordinal = sourceOrdinalByDate.get(toDateKey(assessment.dueDate));
    if (ordinal === undefined) {
      unresolvedDates.push({
        sourceDate: toDateKey(assessment.dueDate),
        reason: "Assessment due date does not align to a source class-day slot",
      });
      mappedAssessmentDates.set(assessment.id, null);
      continue;
    }
    const targetDate = targetClassDays[ordinal];
    if (!targetDate) {
      unresolvedDates.push({
        sourceDate: toDateKey(assessment.dueDate),
        reason: "Target Term has fewer class meetings than the source Term",
      });
      mappedAssessmentDates.set(assessment.id, null);
      continue;
    }
    mappedAssessmentDates.set(assessment.id, targetDate);
  }

  return { unresolvedDates, mappedSessionDates, mappedAssessmentDates };
}

async function previewClone(tx: RedesignTx, input: CloneRequest) {
  const sourceTerm = await loadSourceTerm(tx, input.sourceTermId);
  await assertCloneTarget(tx, sourceTerm, input);
  const targetCalendarSlots = await generateCalendarSlots(tx, input);
  const { unresolvedDates } = mapSessionAndAssessmentDates(sourceTerm, targetCalendarSlots);

  const warnings: string[] = [];
  const sourceClassDayCount = sourceTerm.calendarSlots.filter(
    (slot: { slotType: string }) => slot.slotType === "class_day",
  ).length;
  const targetClassDayCount = targetCalendarSlots.filter(
    (slot: GeneratedCalendarSlot) => slot.slotType === "class_day",
  ).length;
  if (targetClassDayCount < sourceClassDayCount) {
    warnings.push("Target Term has fewer class meetings than the source Term");
  }
  if (parseMeetingDays(input.meetingPattern).length === 0) {
    warnings.push("Target meetingPattern has no parseable meeting days");
  }

  return {
    kind: "preview" as const,
    sourceTermId: sourceTerm.id,
    learningModuleCount: sourceTerm.learningModules.length,
    sessionCount: sourceTerm.sessions.length,
    assessmentCount: sourceTerm.assessments.length,
    calendarSlotCount: targetCalendarSlots.length,
    unresolvedDates,
    warnings,
  };
}

export async function previewTermClone(db: RedesignDb, input: CloneRequest) {
  return db.$transaction((tx) => previewClone(tx, input));
}

export async function applyTermClone(db: RedesignDb, input: CloneRequest) {
  return db.$transaction(async (tx) => {
    const sourceTerm = await loadSourceTerm(tx, input.sourceTermId);
    await assertCloneTarget(tx, sourceTerm, input);
    const targetCalendarSlots = await generateCalendarSlots(tx, input);
    const { unresolvedDates, mappedSessionDates, mappedAssessmentDates } = mapSessionAndAssessmentDates(
      sourceTerm,
      targetCalendarSlots,
    );
    if (unresolvedDates.length > 0) {
      throw new DomainInvariantError("Clone preview has unresolved dates; apply requires a conflict-free preview");
    }

    const term = await tx.term.create({
      data: {
        courseId: sourceTerm.courseId,
        institutionId: input.institutionId,
        academicCalendarId: input.academicCalendarId,
        code: input.code,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        meetingPattern: input.meetingPattern,
        clonedFromId: sourceTerm.id,
      },
    });

    for (const slot of targetCalendarSlots) {
      await tx.calendarSlot.create({
        data: {
          termId: term.id,
          academicCalendarEventId: slot.academicCalendarEventId,
          date: slot.date,
          slotType: slot.slotType,
          label: slot.label,
          source: slot.source,
        },
      });
    }

    const offeringIdMap = new Map<string, string>();
    for (const offering of sourceTerm.learningModules) {
      const created = await tx.termLearningModule.create({
        data: {
          termId: term.id,
          learningModuleId: offering.learningModuleId,
          learningModuleVersionId: offering.learningModuleVersionId,
          deliveredLearningModuleVersionId: offering.deliveredLearningModuleVersionId,
          courseId: sourceTerm.courseId,
          sequence: offering.sequence,
          notes: offering.notes,
        },
      });
      offeringIdMap.set(offering.id, created.id);
    }

    const sessionIdMap = new Map<string, string>();
    for (const session of sourceTerm.sessions) {
      const created = await tx.session.create({
        data: {
          termId: term.id,
          termLearningModuleId: session.termLearningModuleId
            ? offeringIdMap.get(session.termLearningModuleId) ?? null
            : null,
          sequence: session.sequence,
          sessionType: session.sessionType,
          code: session.code,
          title: session.title,
          date: mappedSessionDates.get(session.id) ?? null,
          description: session.description,
          format: session.format,
          notes: session.notes,
          instructionalMode: session.instructionalMode,
        },
      });
      sessionIdMap.set(session.id, created.id);

      await tx.sessionPriorArt.create({
        data: {
          sessionId: created.id,
          sourceSessionId: session.id,
          note: "Cloned from prior Term",
        },
      });
    }

    for (const session of sourceTerm.sessions) {
      const newSessionId = sessionIdMap.get(session.id);
      if (!newSessionId) continue;
      for (const coverage of session.coverages) {
        await tx.coverage.create({
          data: {
            sessionId: newSessionId,
            topicVersionId: coverage.topicVersionId,
            level: coverage.level,
            notes: coverage.notes,
          },
        });
      }
    }

    for (const assessment of sourceTerm.assessments) {
      await tx.assessment.create({
        data: {
          termId: term.id,
          code: assessment.code,
          title: assessment.title,
          assessmentType: assessment.assessmentType,
          description: assessment.description,
          studentInstructions: assessment.studentInstructions,
          sessionId: assessment.sessionId ? sessionIdMap.get(assessment.sessionId) ?? null : null,
          dueDate: mappedAssessmentDates.get(assessment.id) ?? null,
          rubric: assessment.rubric,
          progressionStage: assessment.progressionStage,
          topics: {
            create: assessment.topics.map((topic: { topicVersionId: string }) => ({
              topicVersionId: topic.topicVersionId,
            })),
          },
        },
      });
    }

    return { kind: "applied" as const, term };
  });
}
