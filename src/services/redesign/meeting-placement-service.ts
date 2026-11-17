import { createHash } from "node:crypto";
import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import {
  planMeetingPlacement,
  type DefaultMeetingTime,
  type MeetingPlacementInput,
} from "./meeting-placement";
import { getOwnedTermForInstructor } from "./ownership-service";
import {
  createRevisionSnapshot,
  revisionInclude,
} from "./term-activity-service";
import type { RedesignDb, RedesignTx } from "./types";

type Input = {
  instructorId: string;
  termId: string;
  defaultMeetingTime: DefaultMeetingTime | null;
};
const dateOnly = (date: Date | string) =>
  new Date(date).toISOString().slice(0, 10);
async function buildPreview(tx: RedesignTx, input: Input) {
  await getOwnedTermForInstructor(tx, input.instructorId, input.termId);
  const [rows, slots, patterns, exceptions] = await Promise.all([
    tx.termActivity.findMany({
      where: {
        termId: input.termId,
        archivedAt: null,
        activityTypeVersion: { activityType: { behaviorFamily: "meeting" } },
      },
      include: {
        termLearningModule: true,
        plannedRevision: { include: revisionInclude },
        plannedActivityVersion: { include: { meetingDetail: true } },
      },
      orderBy: { id: "asc" },
    }),
    tx.calendarSlot.findMany({
      where: { termId: input.termId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    tx.termMeetingPattern.findMany({
      where: { termId: input.termId },
      orderBy: [{ startsOn: "asc" }, { id: "asc" }],
    }),
    tx.termCalendarException.findMany({
      where: { termId: input.termId, action: "cancel" },
      include: { calendarSlot: true },
    }),
  ]);
  // The service's structural transaction boundary also supports database-free tests.
  type Row = {
    id: string;
    adoptedLabel: string;
    activityTypeVersionId: string;
    ordinal: number | null;
    createdAt: Date;
    plannedRevisionId: string | null;
    termLearningModule: { sequence: number } | null;
    plannedRevision: {
      meetingDetail: {
        calendarSlotId: string | null;
        startsAt: Date | null;
        status: string | null;
      } | null;
    } | null;
    plannedActivityVersion: {
      meetingDetail: { defaultDurationMinutes: number | null } | null;
    };
  };
  // A meeting with no planned revision has nothing to copy into a new revision.
  const meetings: MeetingPlacementInput["meetings"] = (rows as Row[])
    .filter((row) => row.plannedRevision?.meetingDetail)
    .map(
    (row) => ({
      termActivityId: row.id,
      activityTypeVersionId: row.activityTypeVersionId,
      termLearningModuleSequence: row.termLearningModule?.sequence ?? null,
      ordinal: row.ordinal,
      createdAt: row.createdAt,
      plannedRevisionId: row.plannedRevisionId,
      calendarSlotId:
        row.plannedRevision?.meetingDetail?.calendarSlotId ?? null,
      startsAt: row.plannedRevision?.meetingDetail?.startsAt ?? null,
      status: row.plannedRevision?.meetingDetail?.status ?? null,
      defaultDurationMinutes:
        row.plannedActivityVersion.meetingDetail?.defaultDurationMinutes ??
        null,
    }),
  );
  const plan = planMeetingPlacement({
    meetings,
    slots: (slots as { id: string; date: Date; slotType: string }[]).map(
      (s) => ({ ...s, date: dateOnly(s.date) }),
    ),
    patterns,
    cancelExceptions: (
      exceptions as {
        targetDate: Date | null;
        calendarSlot: { date: Date } | null;
        startsAt: Date | null;
        activityTypeVersionId: string | null;
      }[]
    ).flatMap((e) => {
      // Same order as computeTermCalendarPreview in academic-calendar-service.
      const date = e.targetDate ?? e.startsAt ?? e.calendarSlot?.date;
      return date
        ? [
            {
              date: dateOnly(date),
              activityTypeVersionId: e.activityTypeVersionId,
            },
          ]
        : [];
    }),
    defaultMeetingTime: input.defaultMeetingTime,
  });
  const labels = new Map((rows as Row[]).map((r) => [r.id, r.adoptedLabel]));
  return {
    ...plan,
    kind: "preview" as const,
    previewToken: createHash("sha256")
      .update(
        JSON.stringify({
          termId: input.termId,
          placements: plan.placements.map((p) => ({
            termActivityId: p.termActivityId,
            expectedPlannedRevisionId: p.expectedPlannedRevisionId,
            calendarSlotId: p.calendarSlotId,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
          })),
          defaultMeetingTime: input.defaultMeetingTime,
        }),
      )
      .digest("hex")
      .slice(0, 16),
    placements: plan.placements.map((p) => ({
      ...p,
      adoptedLabel: labels.get(p.termActivityId)!,
    })),
    unplacedMeetings: plan.unplacedMeetings.map((m) => ({
      ...m,
      adoptedLabel: labels.get(m.termActivityId)!,
    })),
  };
}
export async function previewMeetingPlacement(db: RedesignDb, input: Input) {
  return db.$transaction((tx) => buildPreview(tx, input));
}
export async function applyMeetingPlacement(
  db: RedesignDb,
  input: Input & { previewToken: string },
) {
  try {
    return await db.$transaction(
      async (tx) => {
        const term = await getOwnedTermForInstructor(
          tx,
          input.instructorId,
          input.termId,
        );
        if (term.status === "closed")
          throw new DomainInvariantError("Closed Terms are read-only");
        const preview = await buildPreview(tx, input);
        if (preview.previewToken !== input.previewToken)
          throw new ConcurrencyConflictError(
            "Meeting placement preview is stale",
          );
        if (preview.missingMeetingTime)
          throw new DomainInvariantError(
            "Supply a meeting time before placing meetings",
          );
        if (!preview.placements.length)
          throw new DomainInvariantError("No meetings can be placed");
        const placedTypes = new Set<string>();
        for (const placement of preview.placements) {
          const row = await tx.termActivity.findUnique({
            where: { id: placement.termActivityId },
            include: {
              plannedRevision: { include: revisionInclude },
              revisions: { orderBy: { revision: "desc" }, take: 1 },
            },
          });
          if (
            !row ||
            row.plannedRevisionId !== placement.expectedPlannedRevisionId
          )
            throw new ConcurrencyConflictError();
          placedTypes.add(row.activityTypeVersionId);
          const current = row.plannedRevision;
          if (!current?.meetingDetail)
            throw new DomainInvariantError("Meeting has no planned revision");
          const revision = await createRevisionSnapshot(tx, {
            termActivityId: row.id,
            baseActivityVersionId: current.baseActivityVersionId,
            revision: (row.revisions[0]?.revision ?? 0) + 1,
            title: current.title,
            summary: current.summary,
            changeReason: "Placed on the Term calendar",
            createdByInstructorId: input.instructorId,
            detail: {
              ...current.meetingDetail,
              behaviorFamily: "meeting",
              calendarSlotId: placement.calendarSlotId,
              startsAt: placement.startsAt,
              endsAt: placement.endsAt,
            },
            topicActions: current.topicActions,
            milestones: current.milestones,
          });
          const updated = await tx.termActivity.updateMany({
            where: {
              id: row.id,
              plannedRevisionId: placement.expectedPlannedRevisionId,
            },
            data: { plannedRevisionId: revision.id },
          });
          if (updated.count !== 1) throw new ConcurrencyConflictError();
        }
        let storedMeetingPatternCount = 0;
        if (input.defaultMeetingTime) {
          const patterns = await tx.termMeetingPattern.findMany({
            where: { termId: input.termId },
          });
          const existingTypes = new Set(
            patterns.map((pattern: { activityTypeVersionId: string }) => pattern.activityTypeVersionId),
          );
          const slots = await tx.calendarSlot.findMany({
            where: { termId: input.termId, slotType: "class_day" },
          });
          const weekdays = new Set(
            slots.filter((slot: { slotType: string }) => slot.slotType === "class_day")
              .map((slot: { date: Date }) => new Date(slot.date).getUTCDay()),
          );
          // Names and order match academic-calendar-service's DAY_INDEX.
          const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
            .filter((_, index) => weekdays.has(index));
          for (const activityTypeVersionId of placedTypes) {
            if (existingTypes.has(activityTypeVersionId)) continue;
            await tx.termMeetingPattern.create({
              data: {
                termId: input.termId,
                activityTypeVersionId,
                label: null,
                daysOfWeek,
                ...input.defaultMeetingTime,
                startsOn: term.startDate,
                endsOn: term.endDate,
              },
            });
            storedMeetingPatternCount += 1;
          }
        }
        return {
          storedMeetingPatternCount,
          kind: "applied" as const,
          placedCount: preview.placements.length,
        };
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new ConcurrencyConflictError();
    throw error;
  }
}
