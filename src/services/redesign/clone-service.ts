import { DomainInvariantError } from "./errors";
import {
  type MeetingRolePattern,
  normalizeMeetingRolePatterns,
  previewCalendarMaterialization,
  resolveSessionMeetingRole,
} from "./calendar-materialization-service";
import type { RedesignDb, RedesignTx } from "./types";

type CloneLearningModuleVersionSelection = {
  termLearningModuleId: string;
  plannedLearningModuleVersionId: string;
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
  learningModuleVersionSelections?: CloneLearningModuleVersionSelection[];
};

type CloneLearningModuleChoice = {
  termLearningModuleId: string;
  learningModuleId: string;
  sourcePlannedLearningModuleVersionId: string;
  sourceDeliveredLearningModuleVersionId: string;
  defaultPlannedLearningModuleVersionId: string;
  options: Array<{
    learningModuleVersionId: string;
    label: "planned" | "delivered";
  }>;
};

type SessionCloneEvidence = {
  sourceSessionId: string;
  note: string;
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildSessionCloneEvidence(
  session: {
    id: string;
    date: Date | null;
    scheduleOverrideLabel?: string | null;
  },
  mappedDate: Date | null,
  unresolvedReason: string | null,
): SessionCloneEvidence {
  const details: string[] = [];
  if (session.date) {
    details.push(`Source date ${toDateKey(session.date)}.`);
  } else {
    details.push("Source Session was unscheduled.");
  }
  if (session.scheduleOverrideLabel) {
    details.push(`Source override: ${session.scheduleOverrideLabel}.`);
  }
  if (mappedDate) {
    details.push(`Cloned to ${toDateKey(mappedDate)}.`);
  } else if (unresolvedReason) {
    details.push(`Cloned without a target class-day slot: ${unresolvedReason}.`);
  }

  return {
    sourceSessionId: session.id,
    note: details.join(" "),
  };
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
      course: {
        select: {
          instructorId: true,
        },
      },
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

function buildLearningModuleChoices(
  sourceTerm: Awaited<ReturnType<typeof loadSourceTerm>>,
): CloneLearningModuleChoice[] {
  return sourceTerm.learningModules
    .filter(
      (offering: {
        deliveredLearningModuleVersionId: string | null;
        learningModuleVersionId: string;
      }) =>
        Boolean(offering.deliveredLearningModuleVersionId) &&
        offering.deliveredLearningModuleVersionId !== offering.learningModuleVersionId,
    )
    .map((offering: {
      id: string;
      learningModuleId: string;
      learningModuleVersionId: string;
      deliveredLearningModuleVersionId: string | null;
    }) => ({
      termLearningModuleId: offering.id,
      learningModuleId: offering.learningModuleId,
      sourcePlannedLearningModuleVersionId: offering.learningModuleVersionId,
      sourceDeliveredLearningModuleVersionId: offering.deliveredLearningModuleVersionId!,
      defaultPlannedLearningModuleVersionId: offering.deliveredLearningModuleVersionId!,
      options: [
        {
          learningModuleVersionId: offering.deliveredLearningModuleVersionId!,
          label: "delivered" as const,
        },
        {
          learningModuleVersionId: offering.learningModuleVersionId,
          label: "planned" as const,
        },
      ],
    }));
}

function mapSessionAndAssessmentDates(
  sourceTerm: Awaited<ReturnType<typeof loadSourceTerm>>,
  targetCalendar: Awaited<ReturnType<typeof previewCalendarMaterialization>>,
) {
  const unresolvedDates: Array<{ sourceDate: string; sourceSessionId?: string; reason: string }> = [];
  const mappedSessionDates = new Map<string, Date | null>();
  const unresolvedReasonBySessionId = new Map<string, string>();
  const roleOrdinalByKey = new Map<string, number>();
  const warnings: string[] = [];

  let sourceMeetingRoles: MeetingRolePattern[];
  try {
    sourceMeetingRoles = normalizeMeetingRolePatterns(sourceTerm.meetingPattern);
  } catch {
    sourceMeetingRoles = [];
    warnings.push("Source Term meeting pattern is not parseable for role-based clone mapping");
  }

  const sourceRoleCounts = new Map<string, number>();
  for (const session of sourceTerm.sessions) {
    if (!session.date) continue;
    const roleKey = resolveSessionMeetingRole(sourceMeetingRoles, session);
    if (!roleKey) continue;
    sourceRoleCounts.set(roleKey, (sourceRoleCounts.get(roleKey) ?? 0) + 1);
  }
  for (const [roleKey, sourceCount] of sourceRoleCounts.entries()) {
    const targetCount = targetCalendar.classDayDatesByRoleKey.get(roleKey)?.length ?? 0;
    if (targetCount < sourceCount) {
      warnings.push(`Target Term has fewer ${roleKey} meetings than the source Term`);
    }
  }

  for (const session of sourceTerm.sessions) {
    if (!session.date) {
      mappedSessionDates.set(session.id, null);
      continue;
    }

    const roleKey = resolveSessionMeetingRole(sourceMeetingRoles, session);
    if (!roleKey) {
      unresolvedDates.push({
        sourceDate: toDateKey(session.date),
        sourceSessionId: session.id,
        reason: "Source Session could not be mapped to a meeting role",
      });
      unresolvedReasonBySessionId.set(session.id, "Source Session could not be mapped to a meeting role");
      mappedSessionDates.set(session.id, null);
      continue;
    }

    const ordinal = roleOrdinalByKey.get(roleKey) ?? 0;
    const targetDate = targetCalendar.classDayDatesByRoleKey.get(roleKey)?.[ordinal] ?? null;
    roleOrdinalByKey.set(roleKey, ordinal + 1);

    if (!targetDate) {
      unresolvedDates.push({
        sourceDate: toDateKey(session.date),
        sourceSessionId: session.id,
        reason: `Target Term has fewer ${roleKey} meetings than the source Term`,
      });
      unresolvedReasonBySessionId.set(
        session.id,
        `Target Term has fewer ${roleKey} meetings than the source Term`,
      );
      mappedSessionDates.set(session.id, null);
      continue;
    }

    mappedSessionDates.set(session.id, targetDate);
  }

  const sourceClassDays = sourceTerm.calendarSlots
    .filter((slot: { slotType: string }) => slot.slotType === "class_day")
    .map((slot: { date: Date }) => slot.date);
  const targetClassDays = targetCalendar.candidates
    .filter((slot) => slot.slotType === "class_day")
    .map((slot) => slot.date);
  const sourceOrdinalByDate = new Map<string, number>(
    sourceClassDays.map((date: Date, index: number) => [toDateKey(date), index]),
  );

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

  return {
    unresolvedDates,
    warnings,
    mappedSessionDates,
    mappedAssessmentDates,
    unresolvedReasonBySessionId,
  };
}

async function previewClone(tx: RedesignTx, input: CloneRequest) {
  const sourceTerm = await loadSourceTerm(tx, input.sourceTermId);
  await assertCloneTarget(tx, sourceTerm, input);
  const targetCalendar = await previewCalendarMaterialization(tx, {
    instructorId: sourceTerm.course.instructorId,
    academicCalendarId: input.academicCalendarId,
    startDate: input.startDate,
    endDate: input.endDate,
    meetingPattern: input.meetingPattern,
  });
  const { unresolvedDates, warnings: mappingWarnings } = mapSessionAndAssessmentDates(
    sourceTerm,
    targetCalendar,
  );

  return {
    kind: "preview" as const,
    sourceTermId: sourceTerm.id,
    learningModuleCount: sourceTerm.learningModules.length,
    sessionCount: sourceTerm.sessions.length,
    assessmentCount: sourceTerm.assessments.length,
    calendarSlotCount: targetCalendar.candidates.length,
    unresolvedDates,
    warnings: [...targetCalendar.warnings, ...mappingWarnings],
    learningModuleChoices: buildLearningModuleChoices(sourceTerm),
  };
}

function resolvePlannedVersionId(
  offering: {
    id: string;
    learningModuleVersionId: string;
    deliveredLearningModuleVersionId: string | null;
  },
  selectionMap: Map<string, string>,
) {
  if (selectionMap.has(offering.id)) {
    return selectionMap.get(offering.id)!;
  }
  if (
    offering.deliveredLearningModuleVersionId &&
    offering.deliveredLearningModuleVersionId !== offering.learningModuleVersionId
  ) {
    return offering.deliveredLearningModuleVersionId;
  }
  return offering.learningModuleVersionId;
}

export async function previewTermClone(db: RedesignDb, input: CloneRequest) {
  return db.$transaction((tx) => previewClone(tx, input));
}

export async function applyTermClone(db: RedesignDb, input: CloneRequest) {
  return db.$transaction(async (tx) => {
    const sourceTerm = await loadSourceTerm(tx, input.sourceTermId);
    await assertCloneTarget(tx, sourceTerm, input);
    const targetCalendar = await previewCalendarMaterialization(tx, {
      instructorId: sourceTerm.course.instructorId,
      academicCalendarId: input.academicCalendarId,
      startDate: input.startDate,
      endDate: input.endDate,
      meetingPattern: input.meetingPattern,
    });
    if (targetCalendar.conflicts.length > 0) {
      throw new DomainInvariantError("Clone target preview contains materialization conflicts; resolve them before apply");
    }
    const { mappedSessionDates, mappedAssessmentDates, unresolvedReasonBySessionId } =
      mapSessionAndAssessmentDates(sourceTerm, targetCalendar);

    const selectionMap = new Map(
      (input.learningModuleVersionSelections ?? []).map((selection) => [
        selection.termLearningModuleId,
        selection.plannedLearningModuleVersionId,
      ]),
    );

    const allowedSelections = new Map(
      buildLearningModuleChoices(sourceTerm).map((choice) => [
        choice.termLearningModuleId,
        new Set(choice.options.map((option) => option.learningModuleVersionId)),
      ]),
    );
    for (const [termLearningModuleId, plannedLearningModuleVersionId] of selectionMap.entries()) {
      const allowed = allowedSelections.get(termLearningModuleId);
      if (!allowed || !allowed.has(plannedLearningModuleVersionId)) {
        throw new DomainInvariantError("Clone selection must choose the source planned or delivered Learning Module version");
      }
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

    const slotIdByDateKey = new Map<string, string>();
    for (const candidate of targetCalendar.candidates) {
      const slot = await tx.calendarSlot.create({
        data: {
          termId: term.id,
          academicCalendarEventId: candidate.academicCalendarEventId,
          date: candidate.date,
          slotType: candidate.slotType,
          label: candidate.label,
          source: candidate.source,
          instructionalCapacity: candidate.instructionalCapacity,
          capacitySource: candidate.capacitySource,
          capacityReason: candidate.capacityReason,
        },
      });
      slotIdByDateKey.set(toDateKey(slot.date), slot.id);
    }

    const offeringIdMap = new Map<string, string>();
    for (const offering of sourceTerm.learningModules) {
      const created = await tx.termLearningModule.create({
        data: {
          termId: term.id,
          learningModuleId: offering.learningModuleId,
          learningModuleVersionId: resolvePlannedVersionId(offering, selectionMap),
          deliveredLearningModuleVersionId: null,
          courseId: sourceTerm.courseId,
          sequence: offering.sequence,
          notes: offering.notes,
        },
      });
      offeringIdMap.set(offering.id, created.id);
    }

    const sessionIdMap = new Map<string, string>();
    for (const session of sourceTerm.sessions) {
      const mappedDate = mappedSessionDates.get(session.id) ?? null;
      const calendarSlotId = mappedDate ? slotIdByDateKey.get(toDateKey(mappedDate)) ?? null : null;
      if (mappedDate && !calendarSlotId) {
        throw new DomainInvariantError("Clone preview produced a Session date without a matching materialized class-day slot");
      }

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
          date: mappedDate,
          calendarSlotId,
          scheduleOverrideLabel: null,
          description: session.description,
          format: session.format,
          notes: session.notes,
          status: session.status,
          instructionalMode: session.instructionalMode,
          canceledAt: session.canceledAt,
          canceledReason: session.canceledReason,
          archivedAt: session.archivedAt,
        },
      });
      sessionIdMap.set(session.id, created.id);

      const sourceEvidence = buildSessionCloneEvidence(
        session,
        mappedDate,
        unresolvedReasonBySessionId.get(session.id) ?? null,
      );
      await tx.sessionPriorArt.create({
        data: {
          sessionId: created.id,
          sourceSessionId: sourceEvidence.sourceSessionId,
          note: sourceEvidence.note,
        },
      });

      for (const priorArt of session.priorArt) {
        if (priorArt.sourceSessionId === session.id) continue;
        await tx.sessionPriorArt.create({
          data: {
            sessionId: created.id,
            sourceSessionId: priorArt.sourceSessionId,
            note: priorArt.note ?? null,
          },
        });
      }

      for (const coverage of session.coverages) {
        await tx.coverage.create({
          data: {
            sessionId: created.id,
            topicVersionId: coverage.topicVersionId,
            level: coverage.level,
            notes: coverage.notes,
            redistributedFrom: coverage.redistributedFrom,
            redistributedAt: coverage.redistributedAt,
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
          archivedAt: assessment.archivedAt,
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
