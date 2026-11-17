import { effectiveRevision, localDate } from "@/lib/term-revision-rules";
import { keepEffortOverride } from "@/lib/effort";
import { assertEffort } from "./effort-service";
import { createHash } from "node:crypto";
import { ConcurrencyConflictError, DomainInvariantError, NotFoundError } from "./errors";
import { assertSameCourse } from "./invariants";
import {
  getOwnedCalendarSlotForInstructor,
  getOwnedTermActivityForInstructor,
  getOwnedTermForInstructor,
} from "./ownership-service";
import type {
  RedesignDb,
  RedesignTx,
  TermActivityMilestoneInput,
  TermActivityRevisionDraft,
  TermActivityRevisionDetailDraft,
  TermActivityRevisionTopicActionInput,
} from "./types";

function assertWritableTerm(status: "planned" | "active" | "closed") {
  if (status === "closed") {
    throw new DomainInvariantError("Closed Terms are read-only");
  }
}

function isUniqueConstraintError(error: unknown): error is { code: "P2002" } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function previewToken(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function emptyImpact() {
  return { issues: [], topicActionDuplicates: [], calendarConflicts: [] };
}

function lifecycleStateFromDetail(detail: TermActivityRevisionDetailDraft): string | null {
  switch (detail.behaviorFamily) {
    case "meeting":
      return detail.status ?? null;
    case "coursework":
      return detail.lifecycleState ?? null;
    case "assessment":
      return detail.lifecycleState ?? null;
  }
}

async function findOwnedActivityVersionForTerm(
  tx: RedesignTx,
  instructorId: string,
  termCourseId: string,
  activityId: string,
  activityVersionId: string,
) {
  const version = await tx.activityVersion.findUnique({
    where: { id: activityVersionId },
    include: {
      activity: { include: { course: { select: { instructorId: true } } } },
      activityTypeVersion: { include: { activityType: { select: { instructorId: true } } } },
      milestoneTemplates: { orderBy: { sequence: "asc" } },
      meetingDetail: true,
      courseworkDetail: true,
      assessmentDetail: true,
      topicActions: { orderBy: [{ topicVersionId: "asc" }, { action: "asc" }] },
    },
  });
  if (
    !version ||
    version.activityId !== activityId ||
    version.activity.course?.instructorId !== instructorId
  ) {
    throw new NotFoundError("Activity or version not found");
  }
  assertSameCourse(termCourseId, version.activity.courseId, "Term Activity adoption");
  const enabled = await tx.courseActivityTypeVersion.findUnique({
    where: {
      courseId_activityTypeVersionId: {
        courseId: termCourseId,
        activityTypeVersionId: version.activityTypeVersionId,
      },
    },
  });
  if (!enabled) {
    throw new DomainInvariantError("Activity Type version not enabled for the Term's Course");
  }
  if (version.activityTypeVersion.activityType.instructorId !== instructorId) {
    throw new NotFoundError("Activity Type version not found");
  }
  return version;
}

async function findOwnedTermLearningModuleForAdoption(
  tx: RedesignTx,
  termId: string,
  courseId: string,
  termLearningModuleId: string,
  learningModuleVersionId: string,
) {
  const offering = await tx.termLearningModule.findUnique({
    where: { id_termId: { id: termLearningModuleId, termId } },
  });
  if (!offering) {
    throw new NotFoundError("Term Learning Module not found");
  }
  assertSameCourse(courseId, offering.courseId, "Term Activity adoption");
  const version = await tx.learningModuleVersion.findUnique({
    where: {
      id_learningModuleId: {
        id: learningModuleVersionId,
        learningModuleId: offering.learningModuleId,
      },
    },
    include: {
      activities: {
        orderBy: { sequence: "asc" },
      },
    },
  });
  if (!version) {
    throw new NotFoundError("Learning Module version not found");
  }
  return { offering, version };
}

type AdoptionCandidate = {
  activityId: string;
  activityVersionId: string;
  adoptedLabel: string;
  ordinal: number | null;
  termLearningModuleId: string | null;
  activityTypeVersionId: string;
  milestoneTemplates: Array<{ id: string; sequence: number; role: TermActivityMilestoneInput["role"]; label: string; linkedActivityId: string | null; timeZone: string | null; notes: string | null }>;
  baseRevision: {
    title: string;
    summary: string | null;
    detail: TermActivityRevisionDetailDraft;
    topicActions: TermActivityRevisionTopicActionInput[];
  };
};

function snapshotDetailFromVersion(version: {
  meetingDetail?: { modality: string | null } | null;
  courseworkDetail?: { effortMinMinutes?: number | null; effortMaxMinutes?: number | null } | null;
  assessmentDetail?: { modality: string | null } | null;
}) {
  if (version.meetingDetail) {
    return {
      behaviorFamily: "meeting" as const,
      calendarSlotId: null,
      startsAt: null,
      endsAt: null,
      status: null,
      modality: version.meetingDetail.modality,
      overrideReason: null,
      overrideEvidence: null,
    };
  }
  if (version.courseworkDetail) {
    return {
      behaviorFamily: "coursework" as const,
      lifecycleState: null,
      deliveryNotes: null,
    };
  }
  return {
    behaviorFamily: "assessment" as const,
    lifecycleState: null,
    modality: version.assessmentDetail?.modality ?? null,
    deliveryNotes: null,
  };
}

async function buildAdoptionCandidates(
  tx: RedesignTx,
  input: {
    instructorId: string;
    termId: string;
    learningModuleVersionSelections: Array<{ termLearningModuleId: string; learningModuleVersionId: string }>;
    crossCuttingSelections: Array<{ activityId: string; activityVersionId: string; termLearningModuleId?: string | null }>;
  },
) {
  const term = await getOwnedTermForInstructor(tx, input.instructorId, input.termId);

  const candidates: AdoptionCandidate[] = [];
  const seenActivityIds = new Set<string>();

  for (const selection of input.learningModuleVersionSelections) {
    const { offering, version } = await findOwnedTermLearningModuleForAdoption(
      tx,
      term.id,
      term.courseId,
      selection.termLearningModuleId,
      selection.learningModuleVersionId,
    );
    for (const membership of version.activities) {
      const activityVersion = await findOwnedActivityVersionForTerm(
        tx,
        input.instructorId,
        term.courseId,
        (
          await tx.activityVersion.findUnique({
            where: { id: membership.activityVersionId },
            select: { activityId: true },
          })
        )?.activityId ?? "",
        membership.activityVersionId,
      );
      if (seenActivityIds.has(activityVersion.activityId)) {
        throw new DomainInvariantError("Each Activity may be adopted into a Term only once");
      }
      seenActivityIds.add(activityVersion.activityId);
      candidates.push({
        activityId: activityVersion.activityId,
        activityVersionId: activityVersion.id,
        adoptedLabel: activityVersion.activityTypeVersion.label,
        activityTypeVersionId: activityVersion.activityTypeVersionId,
        termLearningModuleId: offering.id,
        ordinal: membership.sequence,
        milestoneTemplates: activityVersion.milestoneTemplates ?? [],
        baseRevision: {
          title: activityVersion.title,
          summary: activityVersion.summary,
          detail: snapshotDetailFromVersion(activityVersion),
          topicActions: activityVersion.topicActions.map((action: {
            topicVersionId: string;
            action: "introduced" | "practiced" | "assessed";
            notes: string | null;
            provenance: unknown;
          }) => ({
            topicVersionId: action.topicVersionId,
            action: action.action,
            notes: action.notes,
            provenance: action.provenance,
          })),
        },
      });
    }
  }

  for (const selection of input.crossCuttingSelections) {
    if (selection.termLearningModuleId) {
      const ownedOffering = await tx.termLearningModule.findUnique({
        where: { id_termId: { id: selection.termLearningModuleId, termId: term.id } },
        select: { id: true, courseId: true },
      });
      if (!ownedOffering) {
        throw new NotFoundError("Term Learning Module not found");
      }
      assertSameCourse(term.courseId, ownedOffering.courseId, "Term Activity adoption");
    }
    const activityVersion = await findOwnedActivityVersionForTerm(
      tx,
      input.instructorId,
      term.courseId,
      selection.activityId,
      selection.activityVersionId,
    );
    if (seenActivityIds.has(activityVersion.activityId)) {
      throw new DomainInvariantError("Each Activity may be adopted into a Term only once");
    }
    seenActivityIds.add(activityVersion.activityId);
    candidates.push({
      activityId: activityVersion.activityId,
      activityVersionId: activityVersion.id,
      adoptedLabel: activityVersion.activityTypeVersion.label,
      activityTypeVersionId: activityVersion.activityTypeVersionId,
      termLearningModuleId: selection.termLearningModuleId ?? null,
      ordinal: null,
      milestoneTemplates: activityVersion.milestoneTemplates ?? [],
      baseRevision: {
        title: activityVersion.title,
        summary: activityVersion.summary,
        detail: snapshotDetailFromVersion(activityVersion),
        topicActions: activityVersion.topicActions.map((action: {
          topicVersionId: string;
          action: "introduced" | "practiced" | "assessed";
          notes: string | null;
          provenance: unknown;
        }) => ({
          topicVersionId: action.topicVersionId,
          action: action.action,
          notes: action.notes,
          provenance: action.provenance,
        })),
      },
    });
  }

  const existingActivities: Array<{ id: string; activityId: string; adoptedLabel: string; archivedAt: Date | null }> = await tx.termActivity.findMany({ where: { termId: term.id }, select: { id: true, activityId: true, adoptedLabel: true, archivedAt: true } });
  const existingIds = new Set(existingActivities.map((row: { activityId: string }) => row.activityId));
  return {
    term,
    existingActivities,
    alreadyAdopted: existingActivities.filter((row) => seenActivityIds.has(row.activityId))
      .map((row) => ({ activityId: row.activityId, adoptedLabel: row.adoptedLabel })),
    candidates: candidates.filter((candidate) => !existingIds.has(candidate.activityId)).sort((left, right) => {
      if ((left.termLearningModuleId ?? "") !== (right.termLearningModuleId ?? "")) {
        return (left.termLearningModuleId ?? "").localeCompare(right.termLearningModuleId ?? "");
      }
      if ((left.ordinal ?? Number.MAX_SAFE_INTEGER) !== (right.ordinal ?? Number.MAX_SAFE_INTEGER)) {
        return (left.ordinal ?? Number.MAX_SAFE_INTEGER) - (right.ordinal ?? Number.MAX_SAFE_INTEGER);
      }
      return left.activityId.localeCompare(right.activityId);
    }),
  };
}

async function validateSnapshotMilestones(
  tx: RedesignTx,
  input: { termActivityId: string; baseActivityVersionId: string; milestones: TermActivityMilestoneInput[]; inheritedMilestones?: TermActivityMilestoneInput[] },
) {
  for (const milestone of input.milestones) {
    const inherited = input.inheritedMilestones?.some(source => JSON.stringify(source) === JSON.stringify(milestone));
    if (milestone.linkedTermActivityId === input.termActivityId && !inherited) {
      throw new DomainInvariantError("A milestone cannot link to its own Term Activity");
    }
    if (milestone.anchorPolicy === "follow_activity" && !milestone.linkedTermActivityId) {
      throw new DomainInvariantError("A milestone that follows an Activity needs a linked Term Activity in the same Term");
    }
    if ((milestone.anchorPolicy === "fixed_instant" || milestone.anchorPolicy === "standalone") && !milestone.occursAt) {
      throw new DomainInvariantError("A fixed or standalone milestone needs a date");
    }
    if (milestone.linkedTermActivityId) {
      const [owner, linked] = await Promise.all([
        tx.termActivity.findUnique({ where: { id: input.termActivityId } }),
        tx.termActivity.findUnique({ where: { id: milestone.linkedTermActivityId } }),
      ]);
      if (!owner || !linked || linked.termId !== owner.termId) {
        if (milestone.anchorPolicy === "follow_activity") throw new DomainInvariantError("The linked Term Activity must be in the same Term");
        throw new NotFoundError("Term Activity not found");
      }
    }
    if (milestone.sourceTemplateId) {
      const template = await tx.activityVersionMilestoneTemplate.findUnique({ where: { id: milestone.sourceTemplateId } });
      if (!template || template.activityVersionId !== input.baseActivityVersionId) {
        throw new DomainInvariantError("The milestone template must belong to the base Activity version");
      }
    }
  }
}

export async function createRevisionSnapshot(
  tx: RedesignTx,
  input: {
    termActivityId: string;
    baseActivityVersionId: string;
    revision: number;
    title: string;
    summary: string | null;
    changeReason?: string | null;
    createdByInstructorId: string | null;
    detail: TermActivityRevisionDetailDraft;
    topicActions: TermActivityRevisionTopicActionInput[];
    milestones: TermActivityMilestoneInput[];
    inheritedMilestones?: TermActivityMilestoneInput[];
  },
) {
  await validateSnapshotMilestones(tx, input);
  const revision = await tx.termActivityRevision.create({
    data: {
      termActivityId: input.termActivityId,
      revision: input.revision,
      baseActivityVersionId: input.baseActivityVersionId,
      title: input.title,
      summary: input.summary,
      changeReason: input.changeReason ?? null,
      createdByInstructorId: input.createdByInstructorId,
    },
  });

  if (input.detail.behaviorFamily === "meeting") {
    await tx.termMeetingActivityRevision.create({
      data: {
        termActivityRevisionId: revision.id,
        calendarSlotId: input.detail.calendarSlotId ?? null,
        startsAt: input.detail.startsAt ?? null,
        endsAt: input.detail.endsAt ?? null,
        status: input.detail.status ?? null,
        modality: input.detail.modality ?? null,
        overrideReason: input.detail.overrideReason ?? null,
        overrideEvidence: input.detail.overrideEvidence ?? null,
      },
    });
  } else if (input.detail.behaviorFamily === "coursework") {
    await tx.termCourseworkActivityRevision.create({
      data: {
        termActivityRevisionId: revision.id,
        effortMinMinutes: input.detail.effortMinMinutes ?? null,
        effortMaxMinutes: input.detail.effortMaxMinutes ?? null,
        lifecycleState: input.detail.lifecycleState ?? null,
        deliveryNotes: input.detail.deliveryNotes ?? null,
      },
    });
  } else {
    await tx.termAssessmentActivityRevision.create({
      data: {
        termActivityRevisionId: revision.id,
        effortMinMinutes: input.detail.effortMinMinutes ?? null,
        effortMaxMinutes: input.detail.effortMaxMinutes ?? null,
        lifecycleState: input.detail.lifecycleState ?? null,
        modality: input.detail.modality ?? null,
        deliveryNotes: input.detail.deliveryNotes ?? null,
      },
    });
  }

  for (const action of input.topicActions) {
    await tx.termActivityRevisionTopicAction.create({
      data: {
        termActivityRevisionId: revision.id,
        topicVersionId: action.topicVersionId,
        action: action.action,
        notes: action.notes ?? null,
        provenance: action.provenance ?? null,
      },
    });
  }

  for (const milestone of input.milestones) {
    await tx.termActivityMilestone.create({
      data: {
        termActivityRevisionId: revision.id,
        sourceTemplateId: milestone.sourceTemplateId ?? null,
        role: milestone.role,
        label: milestone.label,
        linkedTermActivityId: milestone.linkedTermActivityId ?? null,
        occursAt: milestone.occursAt ?? null,
        timeZone: milestone.timeZone ?? null,
        anchorPolicy: milestone.anchorPolicy,
        notes: milestone.notes ?? null,
        provenance: milestone.provenance ?? null,
      },
    });
  }

  return tx.termActivityRevision.findUnique({
    where: { id: revision.id },
    include: revisionInclude,
  });
}

export const revisionInclude = {
  baseActivityVersion: { include: { courseworkDetail: true, assessmentDetail: true } },
  meetingDetail: true,
  courseworkDetail: true,
  assessmentDetail: true,
  topicActions: { orderBy: [{ topicVersionId: "asc" as const }, { action: "asc" as const }] },
  milestones: { orderBy: { createdAt: "asc" as const } },
};

async function validateTermActivityDraft(
  tx: RedesignTx,
  instructorId: string,
  termActivity: { activityTypeVersion?: { activityType: { behaviorFamily: string } }; plannedActivityVersion: { meetingDetail?: unknown; courseworkDetail?: unknown; assessmentDetail?: unknown }; termId: string; term: { courseId: string; status: "planned" | "active" | "closed" } },
  draft: TermActivityRevisionDraft,
) {
  const base = termActivity.plannedActivityVersion;
  const family = termActivity.activityTypeVersion?.activityType.behaviorFamily ?? (base?.meetingDetail ? "meeting" : base?.courseworkDetail ? "coursework" : base?.assessmentDetail ? "assessment" : null);
  if (family && family !== draft.detail.behaviorFamily) throw new DomainInvariantError("Revision detail family must match the Activity family");
  if (draft.detail.behaviorFamily !== "meeting") {
    assertEffort(draft.detail.effortMinMinutes, draft.detail.effortMaxMinutes);
  } else if ("effortMinMinutes" in draft.detail || "effortMaxMinutes" in draft.detail) {
    throw new DomainInvariantError("Meetings do not carry student effort");
  }
  if (draft.detail.behaviorFamily === "meeting" && draft.detail.calendarSlotId) {
    const slot = await getOwnedCalendarSlotForInstructor(tx, instructorId, draft.detail.calendarSlotId);
    if (slot.termId !== termActivity.termId) {
      throw new NotFoundError("Calendar slot not found");
    }
  }

  for (const action of draft.topicActions ?? []) {
    const topicVersion = await tx.topicVersion.findUnique({
      where: { id: action.topicVersionId },
      include: { topic: { select: { courseId: true, course: { select: { instructorId: true } } } } },
    });
    if (!topicVersion || topicVersion.topic.course?.instructorId !== instructorId) {
      throw new NotFoundError("Topic version not found");
    }
    assertSameCourse(termActivity.term.courseId, topicVersion.topic.courseId, "Term Activity topic action");
  }
}

async function buildRevisionPreview(
  tx: RedesignTx,
  input: {
    instructorId: string;
    termActivityId: string;
    draft: TermActivityRevisionDraft;
    advancePointer?: "planned" | "delivered";
  },
) {
  const termActivity = await getOwnedTermActivityForInstructor(tx, input.instructorId, input.termActivityId);
  const hydrated = await tx.termActivity.findUnique({
    where: { id: input.termActivityId },
    include: {
      term: true,
      plannedActivityVersion: { include: { courseworkDetail: true, assessmentDetail: true, meetingDetail: true } },
      activityTypeVersion: { include: { activityType: true } },
      plannedRevision: { include: revisionInclude },
      deliveredRevision: { include: revisionInclude },
      revisions: { orderBy: { revision: "desc" }, take: 1 },
    },
  });
  if (!hydrated) {
    throw new NotFoundError("Term Activity not found");
  }

  const current =
    input.advancePointer === "planned"
      ? hydrated.plannedRevision
      : effectiveRevision({ delivered: hydrated.deliveredRevision, planned: hydrated.plannedRevision });
  const topicActions: TermActivityRevisionTopicActionInput[] =
    input.draft.topicActions ?? current?.topicActions ?? [];
  const milestones: TermActivityMilestoneInput[] =
    input.draft.milestones ?? current?.milestones ?? [];
  const draft = {
    ...input.draft,
    topicActions,
    milestones,
    detail: keepEffortOverride(
      input.draft.detail,
      current?.courseworkDetail ?? current?.assessmentDetail,
    ),
  };
  if (draft.detail.behaviorFamily === "meeting" && draft.detail.startsAt &&
      new Date(draft.detail.startsAt).getTime() !== current?.meetingDetail?.startsAt?.getTime()) {
    const patterns = await tx.termMeetingPattern.findMany({ where: { termId: hydrated.termId }, orderBy: [{ startsOn: "asc" }, { id: "asc" }] });
    const zone = patterns[0]?.timeZone;
    const date = localDate(draft.detail.startsAt, zone)!;
    const slot = await tx.calendarSlot.findFirst({ where: { termId: hydrated.termId, date: new Date(`${date}T00:00:00Z`) } });
    draft.detail = { ...draft.detail, calendarSlotId: slot?.id ?? null };
  }
  await validateTermActivityDraft(tx, input.instructorId, hydrated, draft);
  await validateSnapshotMilestones(tx, { termActivityId: hydrated.id, baseActivityVersionId: hydrated.plannedActivityVersionId, milestones: draft.milestones, inheritedMilestones: input.draft.milestones === undefined ? current?.milestones : [] });

  const nextRevision = (hydrated.revisions[0]?.revision ?? 0) + 1;
  const expectedCurrentRevisionId =
    input.advancePointer === "planned"
      ? hydrated.plannedRevisionId
      : hydrated.deliveredRevisionId;
  const proposedRevision = {
    id: `preview-${hydrated.id}-${nextRevision}`,
    baseActivityVersion: hydrated.plannedActivityVersion,
    termActivityId: hydrated.id,
    revision: nextRevision,
    baseActivityVersionId: hydrated.plannedActivityVersionId,
    title: draft.title,
    summary: draft.summary ?? null,
    changeReason: draft.changeReason ?? null,
    createdByInstructorId: input.instructorId,
    createdAt: new Date(),
    meetingDetail:
      draft.detail.behaviorFamily === "meeting"
        ? {
            calendarSlotId: draft.detail.calendarSlotId ?? null,
            startsAt: draft.detail.startsAt ?? null,
            endsAt: draft.detail.endsAt ?? null,
            status: draft.detail.status ?? null,
            modality: draft.detail.modality ?? null,
            overrideReason: draft.detail.overrideReason ?? null,
            overrideEvidence: draft.detail.overrideEvidence ?? null,
          }
        : null,
    courseworkDetail:
      draft.detail.behaviorFamily === "coursework"
        ? {
            effortMinMinutes: draft.detail.effortMinMinutes ?? null,
            effortMaxMinutes: draft.detail.effortMaxMinutes ?? null,
            lifecycleState: draft.detail.lifecycleState ?? null,
            deliveryNotes: draft.detail.deliveryNotes ?? null,
          }
        : null,
    assessmentDetail:
      draft.detail.behaviorFamily === "assessment"
        ? {
            effortMinMinutes: draft.detail.effortMinMinutes ?? null,
            effortMaxMinutes: draft.detail.effortMaxMinutes ?? null,
            lifecycleState: draft.detail.lifecycleState ?? null,
            modality: draft.detail.modality ?? null,
            deliveryNotes: draft.detail.deliveryNotes ?? null,
          }
        : null,
    topicActions: (draft.topicActions ?? []).map((action, index) => ({
      id: `preview-topic-action-${index}`,
      termActivityRevisionId: `preview-${hydrated.id}-${nextRevision}`,
      topicVersionId: action.topicVersionId,
      action: action.action,
      notes: action.notes ?? null,
      provenance: action.provenance ?? null,
    })),
    milestones: (draft.milestones ?? []).map((milestone, index) => ({
      id: `preview-milestone-${index}`,
      termActivityRevisionId: `preview-${hydrated.id}-${nextRevision}`,
      sourceTemplateId: milestone.sourceTemplateId ?? null,
      role: milestone.role,
      label: milestone.label,
      linkedTermActivityId: milestone.linkedTermActivityId ?? null,
      occursAt: milestone.occursAt ?? null,
      timeZone: milestone.timeZone ?? null,
      anchorPolicy: milestone.anchorPolicy,
      notes: milestone.notes ?? null,
      provenance: milestone.provenance ?? null,
      createdAt: new Date(index),
    })),
  };

  return {
    termActivity,
    nextRevision,
    draft,
    inheritedMilestones: input.draft.milestones === undefined ? current?.milestones : [],
    expectedCurrentRevisionId,
    proposedRevision,
  };
}

export async function listTermActivitiesForTerm(
  db: RedesignDb,
  instructorId: string,
  termId: string,
) {
  return db.$transaction(async (tx) => {
    await getOwnedTermForInstructor(tx, instructorId, termId);
    return tx.termActivity.findMany({
      where: { termId },
      orderBy: [
        { termLearningModuleId: "asc" },
        { ordinal: "asc" },
        { createdAt: "asc" },
      ],
    });
  });
}

export async function listTermActivitiesForTermWithRevisions(
  db: RedesignDb,
  instructorId: string,
  termId: string,
) {
  return db.$transaction(async (tx) => {
    await getOwnedTermForInstructor(tx, instructorId, termId);
    const termActivities = await tx.termActivity.findMany({
      where: { termId },
      orderBy: [
        { termLearningModuleId: "asc" },
        { ordinal: "asc" },
        { createdAt: "asc" },
      ],
    });
    const revisionIds = termActivities.flatMap((activity: {
      plannedRevisionId: string | null;
      deliveredRevisionId: string | null;
    }) =>
      [activity.plannedRevisionId, activity.deliveredRevisionId].filter(
        (id): id is string => id !== null,
      ),
    );
    const revisions = await tx.termActivityRevision.findMany({
      where: { id: { in: revisionIds } },
      include: revisionInclude,
    });
    const revisionsById = new Map(revisions.map((revision: { id: string }) => [revision.id, revision]));

    return {
      termActivities,
      revisionsByTermActivityId: Object.fromEntries(
        termActivities.map((activity: {
          id: string;
          plannedRevisionId: string | null;
          deliveredRevisionId: string | null;
        }) => [
          activity.id,
          {
            planned: activity.plannedRevisionId
              ? revisionsById.get(activity.plannedRevisionId) ?? null
              : null,
            delivered: activity.deliveredRevisionId
              ? revisionsById.get(activity.deliveredRevisionId) ?? null
              : null,
          },
        ]),
      ),
    };
  });
}

export async function getTermActivityForInstructor(
  db: RedesignDb,
  instructorId: string,
  termActivityId: string,
) {
  return db.$transaction((tx) => getOwnedTermActivityForInstructor(tx, instructorId, termActivityId));
}

export async function previewTermActivityAdoption(
  db: RedesignDb,
  input: {
    instructorId: string;
    termId: string;
    learningModuleVersionSelections: Array<{ termLearningModuleId: string; learningModuleVersionId: string }>;
    crossCuttingSelections: Array<{ activityId: string; activityVersionId: string; termLearningModuleId?: string | null }>;
  },
) {
  return db.$transaction(async (tx) => {
    const { term, candidates, existingActivities, alreadyAdopted } = await buildAdoptionCandidates(tx, input);
    const adoptedIds = new Set([...existingActivities.filter((row) => !row.archivedAt).map((row) => row.activityId), ...candidates.map((row) => row.activityId)]);
    const expectedCurrentActivityCount = await tx.termActivity.count({ where: { termId: term.id } });
    return {
      kind: "preview" as const,
      previewToken: previewToken({
        termId: term.id,
        expectedCurrentActivityCount,
        candidates: candidates.map((candidate) => ({
          activityId: candidate.activityId,
          activityVersionId: candidate.activityVersionId,
          termLearningModuleId: candidate.termLearningModuleId,
          ordinal: candidate.ordinal,
          milestoneTemplates: candidate.milestoneTemplates,
        })),
      }),
      expectedCurrentActivityCount,
      alreadyAdopted,
      candidates: candidates.map((candidate) => {
        // A milestone with no date must follow a Term Activity: the database
        // rejects an undated standalone milestone. A template that has nothing
        // to follow is not created, and the preview lists it here.
        const notCreated = candidate.milestoneTemplates
          .flatMap((template) => {
            if (!template.linkedActivityId)
              return [{ sourceTemplateId: template.id, label: template.label, reason: "The template has no linked Activity to follow" }];
            const reason = template.linkedActivityId === candidate.activityId
              ? "A milestone cannot follow its own Activity"
              : existingActivities.some((row) => row.activityId === template.linkedActivityId && row.archivedAt)
                ? "Linked Activity is archived in this Term"
                : !adoptedIds.has(template.linkedActivityId) ? "Linked Activity is not adopted in this Term" : null;
            return reason ? [{ sourceTemplateId: template.id, label: template.label, reason }] : [];
          });
        return {
          activityId: candidate.activityId,
          activityVersionId: candidate.activityVersionId,
          adoptedLabel: candidate.adoptedLabel,
          milestoneCount: candidate.milestoneTemplates.length - notCreated.length,
          notCreatedMilestones: notCreated,
          ordinal: candidate.ordinal,
          termLearningModuleId: candidate.termLearningModuleId,
        };
      }),
      impact: emptyImpact(),
    };
  });
}

export async function applyTermActivityAdoption(
  db: RedesignDb,
  input: {
    instructorId: string;
    termId: string;
    learningModuleVersionSelections: Array<{ termLearningModuleId: string; learningModuleVersionId: string }>;
    crossCuttingSelections: Array<{ activityId: string; activityVersionId: string; termLearningModuleId?: string | null }>;
    previewToken: string;
    expectedCurrentActivityCount: number;
  },
) {
  try {
  return await db.$transaction(
    async (tx) => {
    const preview = await previewTermActivityAdoption(
      { $transaction: async <T>(fn: (nestedTx: RedesignTx) => Promise<T>) => fn(tx) },
      input,
    );
    const term = await getOwnedTermForInstructor(tx, input.instructorId, input.termId);
    assertWritableTerm(term.status);

    if (
      preview.previewToken !== input.previewToken ||
      preview.expectedCurrentActivityCount !== input.expectedCurrentActivityCount
    ) {
      throw new ConcurrencyConflictError("Term Activity adoption preview is stale");
    }

    const currentCount = await tx.termActivity.count({ where: { termId: term.id } });
    if (currentCount !== input.expectedCurrentActivityCount) {
      throw new ConcurrencyConflictError("Term Activity adoption changed while this edit was in progress");
    }

    const createdActivities: Array<{ id: string; activityId: string }> = [];
    const candidates = await buildAdoptionCandidates(tx, input);
    for (const candidate of candidates.candidates) {
      const row = await tx.termActivity.create({
        data: {
          termId: term.id,
          courseId: term.courseId,
          activityId: candidate.activityId,
          plannedActivityVersionId: candidate.activityVersionId,
          activityTypeVersionId: candidate.activityTypeVersionId,
          adoptedLabel: candidate.adoptedLabel,
          termLearningModuleId: candidate.termLearningModuleId,
          ordinal: candidate.ordinal,
          lifecycleState: null,
        },
      });
      createdActivities.push({ id: row.id, activityId: row.activityId });
    }

    const pointerRows = [];
    for (const candidate of candidates.candidates) {
      const termActivityId = createdActivities.find((row) => row.activityId === candidate.activityId)?.id;
      if (!termActivityId) continue;
      const revision = await createRevisionSnapshot(tx, {
        termActivityId,
        baseActivityVersionId: candidate.activityVersionId,
        revision: 1,
        title: candidate.baseRevision.title,
        summary: candidate.baseRevision.summary,
        createdByInstructorId: input.instructorId,
        detail: candidate.baseRevision.detail,
        topicActions: candidate.baseRevision.topicActions,
        milestones: candidate.milestoneTemplates.flatMap((template) => {
          const linkedTermActivityId = !template.linkedActivityId || template.linkedActivityId === candidate.activityId ? null : [...createdActivities, ...candidates.existingActivities.filter((row) => !row.archivedAt)]
            .find((row) => row.activityId === template.linkedActivityId)?.id ?? null;
          // An undated milestone with nothing to follow is not created; see the preview.
          if (!linkedTermActivityId) return [];
          return [{
            sourceTemplateId: template.id, role: template.role, label: template.label,
            timeZone: template.timeZone, notes: template.notes, occursAt: null,
            linkedTermActivityId, anchorPolicy: "follow_activity" as const,
          }];
        }),
      });
      pointerRows.push(
        tx.termActivity.update({
          where: { id: termActivityId },
          data: {
            plannedRevisionId: revision?.id ?? null,
          },
        }),
      );
    }
    await Promise.all(pointerRows);

    return {
      kind: "applied" as const,
      termActivities: await tx.termActivity.findMany({
        where: { termId: term.id },
        orderBy: [{ termLearningModuleId: "asc" }, { ordinal: "asc" }, { createdAt: "asc" }],
      }),
    };
    },
    // Adoption creates one Term Activity and one revision per candidate in a
    // sequential loop, so the transaction grows with the size of the Learning
    // Module. Prisma's default 5s interactive-transaction timeout is ample
    // against a local database and not against a remote one.
    { timeout: 300_000, maxWait: 30_000 },
  );
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ConcurrencyConflictError("Term Activity adoption changed while this edit was in progress");
    throw error;
  }
}

export async function previewTermActivityRevision(
  db: RedesignDb,
  input: {
    instructorId: string;
    termActivityId: string;
    draft: TermActivityRevisionDraft;
    advancePointer?: "planned" | "delivered";
  },
) {
  return db.$transaction(async (tx) => {
    const preview = await buildRevisionPreview(tx, input);
    return {
      kind: "preview" as const,
      previewToken: previewToken({
        termActivityId: input.termActivityId,
        expectedCurrentRevisionId: preview.expectedCurrentRevisionId,
        draft: preview.draft,
      }),
      expectedCurrentRevisionId: preview.expectedCurrentRevisionId,
      proposedRevision: preview.proposedRevision,
      impact: emptyImpact(),
    };
  });
}

export async function applyTermActivityRevision(
  db: RedesignDb,
  input: {
    instructorId: string;
    termActivityId: string;
    expectedCurrentRevisionId: string | null;
    previewToken: string;
    advancePointer: "planned" | "delivered";
    draft: TermActivityRevisionDraft;
  },
) {
  try {
    return await db.$transaction(async (tx) => {
      const preview = await buildRevisionPreview(tx, {
        instructorId: input.instructorId,
        termActivityId: input.termActivityId,
        draft: input.draft,
        advancePointer: input.advancePointer,
      });
      const termActivity = await tx.termActivity.findUnique({
        where: { id: input.termActivityId },
        include: { term: true, revisions: { orderBy: { revision: "desc" }, take: 1 } },
      });
      if (!termActivity) {
        throw new NotFoundError("Term Activity not found");
      }
      if (input.advancePointer === "delivered") {
        if (termActivity.term.status !== "active") {
          throw new DomainInvariantError("Delivered revisions may only be created for active Terms");
        }
      } else {
        assertWritableTerm(termActivity.term.status);
      }

      if (
        previewToken({
          termActivityId: input.termActivityId,
          expectedCurrentRevisionId: preview.expectedCurrentRevisionId,
          draft: preview.draft,
        }) !== input.previewToken
      ) {
        throw new ConcurrencyConflictError("Term Activity revision preview is stale");
      }
      if (preview.expectedCurrentRevisionId !== input.expectedCurrentRevisionId) {
        throw new ConcurrencyConflictError("The Term Activity changed while this edit was in progress");
      }

      const revision = await createRevisionSnapshot(tx, {
        termActivityId: termActivity.id,
        baseActivityVersionId: termActivity.plannedActivityVersionId,
        revision: (termActivity.revisions[0]?.revision ?? 0) + 1,
        title: input.draft.title,
        summary: input.draft.summary ?? null,
        changeReason: input.draft.changeReason ?? null,
        createdByInstructorId: input.instructorId,
        detail: preview.draft.detail,
        topicActions: preview.draft.topicActions,
        milestones: preview.draft.milestones,
        inheritedMilestones: preview.inheritedMilestones,
      });
      if (!revision) {
        throw new NotFoundError("Term Activity revision not found");
      }

      const pointerField =
        input.advancePointer === "planned" ? "plannedRevisionId" : "deliveredRevisionId";
      const advanced = await tx.termActivity.updateMany({
        where: {
          id: termActivity.id,
          [pointerField]: input.expectedCurrentRevisionId,
          ...(input.advancePointer === "planned" ? { deliveredRevisionId: termActivity.deliveredRevisionId } : {}),
        },
        data: {
          [pointerField]: revision.id,
          ...(input.advancePointer === "delivered" || !termActivity.deliveredRevisionId
            ? { lifecycleState: lifecycleStateFromDetail(input.draft.detail) }
            : {}),
        },
      });
      if (advanced.count !== 1) {
        throw new ConcurrencyConflictError("The Term Activity changed while this edit was in progress");
      }

      const updated = await tx.termActivity.findUnique({ where: { id: termActivity.id } });
      if (!updated) {
        throw new NotFoundError("Term Activity not found");
      }

      return {
        kind: "applied" as const,
        termActivity: updated,
        revision,
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConcurrencyConflictError("The Term Activity changed while this edit was in progress");
    }
    throw error;
  }
}
