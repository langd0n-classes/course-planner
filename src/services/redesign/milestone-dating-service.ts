import { effectiveRevision } from "@/lib/term-revision-rules";
import { createHash } from "node:crypto";
import { ConcurrencyConflictError, DomainInvariantError } from "./errors";
import {
  planMilestoneDating,
  type MilestoneDatingActivity,
} from "./milestone-dating";
import { getOwnedTermForInstructor } from "./ownership-service";
import {
  createRevisionSnapshot,
  revisionInclude,
} from "./term-activity-service";
import type {
  RedesignDb,
  RedesignTx,
  TermActivityRevisionDetailDraft,
  TermActivityRevisionTopicActionInput,
} from "./types";

type Input = { instructorId: string; termId: string };
type Revision = {
  baseActivityVersionId: string;
  title: string;
  summary: string | null;
  baseActivityVersion: {
    milestoneTemplates: MilestoneDatingActivity["templates"];
  };
  meetingDetail:
    | (Extract<
        TermActivityRevisionDetailDraft,
        { behaviorFamily: "meeting" }
      > & { startsAt: Date | null; calendarSlotId: string | null })
    | null;
  courseworkDetail: Extract<
    TermActivityRevisionDetailDraft,
    { behaviorFamily: "coursework" }
  > | null;
  assessmentDetail: Extract<
    TermActivityRevisionDetailDraft,
    { behaviorFamily: "assessment" }
  > | null;
  milestones: (MilestoneDatingActivity["milestones"][number] & {
    sourceTemplate?: MilestoneDatingActivity["templates"][number] | null;
  })[];
  topicActions: TermActivityRevisionTopicActionInput[];
};
type Row = {
  id: string;
  activityId: string;
  adoptedLabel: string;
  plannedRevisionId: string | null;
  plannedRevision: Revision | null;
  deliveredRevision?: Revision | null;
  archivedAt?: Date | null;
  activityTypeVersion?: { activityType: { behaviorFamily: string } };
  revisions: { revision: number }[];
};
const include = {
  ...revisionInclude,
  milestones: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: { sourceTemplate: true },
  },
  baseActivityVersion: {
    include: { milestoneTemplates: { orderBy: { sequence: "asc" as const } } },
  },
};
async function buildPreview(tx: RedesignTx, input: Input) {
  const term = await getOwnedTermForInstructor(
    tx,
    input.instructorId,
    input.termId,
  );
  if (term.status === "closed")
    throw new DomainInvariantError("Closed Terms are read-only");
  const [rows, slots]: [Row[], { id: string; date: Date }[]] =
    await Promise.all([
      tx.termActivity.findMany({
        where: { termId: input.termId },
        include: {
          revisions: {
            where: {
              milestones: { some: { sourceTemplateId: { not: null } } },
            },
            take: 1,
            select: { revision: true },
          },
          plannedRevision: { include },
          deliveredRevision: { include },
          activityTypeVersion: { include: { activityType: true } },
        },
        orderBy: { id: "asc" },
      }),
      tx.calendarSlot.findMany({
        where: { termId: input.termId },
        orderBy: { id: "asc" },
      }),
    ]);
  const activities: MilestoneDatingActivity[] = rows.map((row) => ({
    id: row.id,
    activityId: row.activityId,
    adoptedLabel: row.adoptedLabel,
    plannedRevisionId: row.plannedRevisionId,
    archivedAt: row.archivedAt ?? null,
    hasTemplateMilestoneHistory: (row.revisions?.length ?? 0) > 0,
    milestones: row.plannedRevision?.milestones ?? [],
    templates:
      row.plannedRevision?.baseActivityVersion.milestoneTemplates ?? [],
    sourceTemplates: (row.plannedRevision?.milestones ?? []).flatMap((m) =>
      m.sourceTemplate ? [m.sourceTemplate] : [],
    ),
    meeting:
      effectiveRevision({ planned: row.plannedRevision, delivered: row.deliveredRevision })?.meetingDetail ??
      row.plannedRevision?.meetingDetail ??
      (row.activityTypeVersion?.activityType.behaviorFamily === "meeting"
        ? { startsAt: null, calendarSlotId: null }
        : null),
  }));
  const plan = planMilestoneDating({
    activities,
    slots: slots.map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
    })),
  });
  // Hash every planned pointer and rule, including linked meetings and missing-template inputs.
  const previewToken = createHash("sha256")
    .update(JSON.stringify({ termId: input.termId, activities, slots }))
    .digest("hex")
    .slice(0, 16);
  return { kind: "preview" as const, previewToken, ...plan };
}
export async function previewMilestoneDating(db: RedesignDb, input: Input) {
  return db.$transaction((tx) => buildPreview(tx, input));
}
export async function applyMilestoneDating(
  db: RedesignDb,
  input: Input & { previewToken: string },
) {
  try {
    return await db.$transaction(
      async (tx) => {
        const preview = await buildPreview(tx, input);
        if (preview.previewToken !== input.previewToken)
          throw new ConcurrencyConflictError(
            "Milestone dating preview is stale",
          );
        const ids = new Set(
          [...preview.dates, ...preview.creates].map((m) => m.termActivityId),
        );
        for (const id of ids) {
          const change = [...preview.dates, ...preview.creates].find(
            (m) => m.termActivityId === id,
          )!;
          const row: Row | null = await tx.termActivity.findUnique({
            where: { id },
            include: {
              plannedRevision: { include },
              revisions: { orderBy: { revision: "desc" }, take: 1 },
            },
          });
          if (
            !row ||
            row.plannedRevisionId !== change.expectedPlannedRevisionId
          )
            throw new ConcurrencyConflictError();
          const current = row.plannedRevision!;
          const milestones = [
            ...current.milestones.map((m) => ({ ...m })),
            ...preview.creates
              .filter((m) => m.termActivityId === id)
              .map((m) => ({ ...m.milestone, id: null })),
          ];
          for (const date of preview.dates.filter(
            (m) => m.termActivityId === id,
          )) {
            const milestone = milestones.find((m) =>
              date.milestoneId
                ? m.id === date.milestoneId
                : m.sourceTemplateId === date.sourceTemplateId,
            )!;
            milestone.occursAt = date.occursAt;
            milestone.timeZone = date.timeZone;
          }
          const detail: TermActivityRevisionDetailDraft = current.meetingDetail
            ? { ...current.meetingDetail, behaviorFamily: "meeting" }
            : current.courseworkDetail
              ? { ...current.courseworkDetail, behaviorFamily: "coursework" }
              : { ...current.assessmentDetail!, behaviorFamily: "assessment" };
          const revision = await createRevisionSnapshot(tx, {
            termActivityId: id,
            baseActivityVersionId: current.baseActivityVersionId,
            revision: (row.revisions[0]?.revision ?? 0) + 1,
            title: current.title,
            summary: current.summary,
            changeReason: "Milestones dated from linked meetings",
            createdByInstructorId: input.instructorId,
            detail,
            topicActions: current.topicActions,
            milestones,
            inheritedMilestones: current.milestones,
          });
          const updated = await tx.termActivity.updateMany({
            where: { id, plannedRevisionId: change.expectedPlannedRevisionId },
            data: { plannedRevisionId: revision.id },
          });
          if (updated.count !== 1) throw new ConcurrencyConflictError();
        }
        return {
          kind: "applied" as const,
          datedCount: preview.dates.length,
          createdCount: preview.creates.length,
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
