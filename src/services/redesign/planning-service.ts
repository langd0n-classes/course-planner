/* eslint-disable @typescript-eslint/no-explicit-any */
import { DomainInvariantError } from "./errors";
import {
  computeMoveImpact,
  findUnassessedSkills,
  type ValidationError,
  validateAllCoverageOrdering,
} from "@/domain/coverage-rules";
import {
  compareScenarios,
  computeCoverageHealth,
  simulateCancellation,
  validateRedistribution,
} from "@/domain/whatif";
import type { CoverageLevel, PlanningIssueDto, SessionWhatIfResponse } from "@/lib/redesign-contract";
import type { RedesignDb, RedesignTx } from "./types";

type SessionWithTerm = {
  id: string;
  termId: string;
  termLearningModuleId: string | null;
  sequence: number;
  sessionType: "lecture" | "lab";
  code: string;
  title: string;
  date: Date | null;
  description: string | null;
  format: string | null;
  notes: string | null;
  status: "scheduled" | "canceled" | "moved";
  instructionalMode: "standard" | "recovery" | "review" | "buffer" | "assessment" | "other";
  canceledAt: Date | null;
  canceledReason: string | null;
  archivedAt: Date | null;
  term: {
    id: string;
    courseId: string;
    status: "planned" | "active" | "closed";
  };
  termLearningModule?: {
    id: string;
    sequence: number;
    learningModuleId: string;
  } | null;
};

type TopicVersionWithTopic = {
  id: string;
  topicId: string;
  topic: {
    id: string;
    courseId: string;
    learningModuleId: string | null;
  };
};

type PlanningSnapshot = Awaited<ReturnType<typeof loadPlanningSnapshot>>;

const DETACHED_SEQUENCE = Number.MAX_SAFE_INTEGER;

export type CreateSessionInput = {
  termId: string;
  termLearningModuleId?: string | null;
  sequence: number;
  sessionType: "lecture" | "lab";
  code: string;
  title: string;
  date?: Date | null;
  description?: string | null;
  format?: string | null;
  notes?: string | null;
  instructionalMode?: "standard" | "recovery" | "review" | "buffer" | "assessment" | "other";
};

export type UpdateSessionInput = {
  termLearningModuleId?: string | null;
  sequence?: number;
  sessionType?: "lecture" | "lab";
  code?: string;
  title?: string;
  date?: Date | null;
  description?: string | null;
  format?: string | null;
  notes?: string | null;
  instructionalMode?: "standard" | "recovery" | "review" | "buffer" | "assessment" | "other";
  archivedAt?: Date | null;
};

export type MoveSessionInput = {
  date?: Date | null;
  termLearningModuleId?: string | null;
  sequence?: number;
};

export type CreateCoverageInput = {
  sessionId: string;
  topicVersionId: string;
  level: CoverageLevel;
  notes?: string | null;
};

export type UpdateCoverageInput = {
  level?: CoverageLevel;
  notes?: string | null;
};

export type CreateAssessmentInput = {
  termId: string;
  code: string;
  title: string;
  assessmentType: string;
  description?: string | null;
  studentInstructions?: string | null;
  sessionId?: string | null;
  dueDate?: Date | null;
  rubric?: unknown | null;
  progressionStage?: string | null;
  topicVersionIds?: string[];
};

export type UpdateAssessmentInput = Partial<CreateAssessmentInput>;

type CancelRedistributionInput = {
  topicVersionId: string;
  level: CoverageLevel;
  targetSessionId: string;
};

function assertWritableTerm(termStatus: "planned" | "active" | "closed") {
  if (termStatus === "closed") {
    throw new DomainInvariantError("Closed Terms are read-only");
  }
}

async function loadSessionOrThrow(tx: RedesignTx, sessionId: string): Promise<SessionWithTerm> {
  const session = await tx.session.findUnique({
    where: { id: sessionId },
    include: {
      term: { select: { id: true, courseId: true, status: true } },
      termLearningModule: { select: { id: true, sequence: true, learningModuleId: true } },
    },
  });
  if (!session) throw new DomainInvariantError("Session not found");
  return session as SessionWithTerm;
}

async function loadTermOrThrow(
  tx: RedesignTx,
  termId: string,
): Promise<{ id: string; courseId: string; status: "planned" | "active" | "closed" }> {
  const term = await tx.term.findUnique({
    where: { id: termId },
    select: { id: true, courseId: true, status: true },
  });
  if (!term) throw new DomainInvariantError("Term not found");
  return term;
}

async function loadTermLearningModuleForTerm(
  tx: RedesignTx,
  termId: string,
  termLearningModuleId: string,
) {
  const offering = await tx.termLearningModule.findUnique({
    where: { id_termId: { id: termLearningModuleId, termId } },
    select: { id: true, sequence: true, learningModuleId: true },
  });
  if (!offering) throw new DomainInvariantError("Term Learning Module not found");
  return offering;
}

async function loadTopicVersionForCourse(
  tx: RedesignTx,
  topicVersionId: string,
  courseId: string,
): Promise<TopicVersionWithTopic> {
  const topicVersion = await tx.topicVersion.findUnique({
    where: { id: topicVersionId },
    select: {
      id: true,
      topicId: true,
      topic: { select: { id: true, courseId: true, learningModuleId: true } },
    },
  });
  if (!topicVersion) throw new DomainInvariantError("Topic version not found");
  if (topicVersion.topic.courseId !== courseId) {
    throw new DomainInvariantError("Topic version cannot cross Course boundaries");
  }
  return topicVersion as TopicVersionWithTopic;
}

async function assertAssessmentSessionBelongsToTerm(
  tx: RedesignTx,
  sessionId: string,
  termId: string,
) {
  const session = await tx.session.findUnique({
    where: { id: sessionId },
    select: { id: true, termId: true, status: true, archivedAt: true },
  });
  if (!session) throw new DomainInvariantError("Session not found");
  if (session.termId !== termId) {
    throw new DomainInvariantError("Assessment Session must belong to the same Term");
  }
  if (session.archivedAt) {
    throw new DomainInvariantError("Archived Sessions cannot be linked to Assessments");
  }
}

function buildCoverageIssue(
  code: string,
  severity: "error" | "warning" | "info",
  message: string,
  extras: Partial<PlanningIssueDto> = {},
): PlanningIssueDto {
  return {
    code,
    severity,
    message,
    ...extras,
  };
}

function buildHealth(topicsById: Map<string, { activeLevels: Set<CoverageLevel> }>) {
  let fullyCovered = 0;
  let partiallyCovered = 0;
  let uncovered = 0;

  for (const { activeLevels } of topicsById.values()) {
    if (activeLevels.size === 0) {
      uncovered += 1;
      continue;
    }
    if (
      activeLevels.has("introduced") &&
      activeLevels.has("practiced") &&
      activeLevels.has("assessed")
    ) {
      fullyCovered += 1;
    } else {
      partiallyCovered += 1;
    }
  }

  return {
    totalTopics: topicsById.size,
    fullyCovered,
    partiallyCovered,
    uncovered,
  };
}

function buildHealthFromTermData(
  snapshot: PlanningSnapshot,
  canceledSessionIds: Set<string>,
) {
  const trackedTopics = new Map(
    [...snapshot.trackedTopics.entries()].map(([topicId, tracked]) => [
      topicId,
      { activeLevels: new Set<CoverageLevel>(), topicVersionId: tracked.topicVersionId },
    ]),
  );

  for (const session of snapshot.term.sessions as any[]) {
    if (session.archivedAt || canceledSessionIds.has(session.id)) continue;
    for (const coverage of session.coverages as any[]) {
      const tracked = trackedTopics.get(coverage.topicVersion.topicId);
      if (tracked) tracked.activeLevels.add(coverage.level);
    }
  }

  return buildHealth(trackedTopics);
}

function normalizeValidationIssues(
  errors: ValidationError[],
  topicVersionIdByTopicId: Map<string, string>,
): PlanningIssueDto[] {
  return errors.map((error) =>
    buildCoverageIssue(
      error.type,
      "error",
      error.message,
      {
        topicVersionId: error.skillId ? topicVersionIdByTopicId.get(error.skillId) : undefined,
        sessionId: error.sessionId,
      },
    ),
  );
}

async function loadPlanningSnapshot(tx: RedesignTx, termId: string) {
  const term = await tx.term.findUnique({
    where: { id: termId },
    select: {
      id: true,
      courseId: true,
      status: true,
      learningModules: {
        include: {
          learningModuleVersion: {
            include: {
              topics: {
                orderBy: { sequence: "asc" },
                include: {
                  topicVersion: {
                    select: {
                      id: true,
                      topicId: true,
                      topic: { select: { learningModuleId: true, courseId: true } },
                    },
                  },
                },
              },
            },
          },
          deliveredLearningModuleVersion: {
            include: {
              topics: {
                orderBy: { sequence: "asc" },
                include: {
                  topicVersion: {
                    select: {
                      id: true,
                      topicId: true,
                      topic: { select: { learningModuleId: true, courseId: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { sequence: "asc" },
      },
      sessions: {
        include: {
          termLearningModule: {
            select: {
              id: true,
              sequence: true,
              learningModuleId: true,
            },
          },
          coverages: {
            include: {
              topicVersion: {
                select: {
                  id: true,
                  topicId: true,
                  topic: { select: { learningModuleId: true, courseId: true } },
                },
              },
            },
          },
        },
        orderBy: [{ date: "asc" }, { sequence: "asc" }],
      },
      assessments: {
        include: {
          topics: {
            include: {
              topicVersion: {
                select: {
                  id: true,
                  topicId: true,
                  topic: { select: { learningModuleId: true, courseId: true } },
                },
              },
            },
          },
        },
      },
      calendarSlots: {
        where: {
          slotType: "class_day",
        },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!term) throw new DomainInvariantError("Term not found");

  const trackedTopics = new Map<
    string,
    {
      topicVersionId: string;
      activeLevels: Set<CoverageLevel>;
      assessed: boolean;
    }
  >();

  const upsertTrackedTopic = (topicId: string, topicVersionId: string) => {
    const existing = trackedTopics.get(topicId);
    if (existing) return existing;
    const created = {
      topicVersionId,
      activeLevels: new Set<CoverageLevel>(),
      assessed: false,
    };
    trackedTopics.set(topicId, created);
    return created;
  };

  for (const offering of term.learningModules) {
    for (const row of offering.learningModuleVersion.topics) {
      upsertTrackedTopic(row.topicVersion.topicId, row.topicVersionId);
    }
    for (const row of offering.deliveredLearningModuleVersion?.topics ?? []) {
      trackedTopics.set(row.topicVersion.topicId, {
        topicVersionId: row.topicVersionId,
        activeLevels: trackedTopics.get(row.topicVersion.topicId)?.activeLevels ?? new Set<CoverageLevel>(),
        assessed: trackedTopics.get(row.topicVersion.topicId)?.assessed ?? false,
      });
    }
  }

  for (const session of term.sessions as any[]) {
    if (session.archivedAt) continue;
    for (const coverage of session.coverages as any[]) {
      const tracked = upsertTrackedTopic(coverage.topicVersion.topicId, coverage.topicVersionId);
      if (session.status !== "canceled") {
        tracked.activeLevels.add(coverage.level);
      }
    }
  }

  for (const assessment of term.assessments as any[]) {
    if (assessment.archivedAt) continue;
    for (const topic of assessment.topics as any[]) {
      const tracked = upsertTrackedTopic(topic.topicVersion.topicId, topic.topicVersionId);
      tracked.assessed = true;
    }
  }

  const termData = {
    sessions: term.sessions
      .filter((session: any) => !session.archivedAt)
      .map((session: any) => ({
        id: session.id,
        code: session.code,
        title: session.title,
        date: session.date,
        moduleId: session.termLearningModuleId ?? `detached:${session.id}`,
        moduleSequence: session.termLearningModule?.sequence ?? DETACHED_SEQUENCE,
        sessionSequence: session.sequence,
        status: session.status,
      })),
    coverages: term.sessions.flatMap((session: any) =>
      session.coverages.map((coverage: any) => ({
        sessionId: session.id,
        skillId: coverage.topicVersion.topicId,
        level: coverage.level,
        sessionDate: session.date,
        sessionSequence: session.sequence,
        moduleSequence: session.termLearningModule?.sequence ?? DETACHED_SEQUENCE,
      })),
    ),
    skills: [...trackedTopics.entries()].map(([topicId, tracked]) => ({
      id: topicId,
      code: tracked.topicVersionId,
      description: tracked.topicVersionId,
      category: "topic",
    })),
  };

  const topicVersionIdByTopicId = new Map(
    [...trackedTopics.entries()].map(([topicId, tracked]) => [topicId, tracked.topicVersionId]),
  );

  return {
    term,
    trackedTopics,
    topicVersionIdByTopicId,
    termData,
  };
}

function findPlanningGaps(snapshot: PlanningSnapshot): PlanningIssueDto[] {
  const scheduledSessionDates = new Set(
    snapshot.term.sessions
      .filter((session: any) => !session.archivedAt && session.status !== "canceled" && session.date)
      .map((session: any) => session.date!.toISOString().slice(0, 10)),
  );

  return snapshot.term.calendarSlots
    .filter((slot: any) => !scheduledSessionDates.has(slot.date.toISOString().slice(0, 10)))
    .map((slot: any) =>
      buildCoverageIssue(
        "planning_gap",
        "warning",
        `No Session is assigned to class day ${slot.date.toISOString().slice(0, 10)}`,
        { calendarSlotId: slot.id },
      ),
    );
}

function findOutOfOfferingWarnings(snapshot: PlanningSnapshot): PlanningIssueDto[] {
  const warnings: PlanningIssueDto[] = [];
  for (const session of snapshot.term.sessions as any[]) {
    if (session.archivedAt || !session.termLearningModule) continue;
    for (const coverage of session.coverages as any[]) {
      const topicLearningModuleId = coverage.topicVersion.topic.learningModuleId;
      if (topicLearningModuleId && topicLearningModuleId !== session.termLearningModule.learningModuleId) {
        warnings.push(
          buildCoverageIssue(
            "coverage_out_of_offering",
            "warning",
            "Coverage is scheduled in a different Learning Module than the Topic belongs to",
            {
              topicVersionId: coverage.topicVersionId,
              sessionId: session.id,
            },
          ),
        );
      }
    }
  }
  return warnings;
}

function simulateWhatIfResponse(snapshot: PlanningSnapshot, sessionId: string): SessionWhatIfResponse {
  const impact = simulateCancellation(snapshot.termData, sessionId);
  const affectedCoverageRows = snapshot.term.sessions
    .flatMap((session: any) => session.coverages)
    .filter((coverage: any) => coverage.sessionId === sessionId);

  const uniqueByTopicVersion = new Map<
    string,
    { topicVersionId: string; lostLevels: CoverageLevel[]; alternativeSessionIds: string[] }
  >();

  for (const atRisk of impact.atRiskSkills.filter((entry) => entry.uniqueCoverage)) {
    const matchingRows = affectedCoverageRows.filter(
      (coverage: any) =>
        coverage.topicVersion.topicId === atRisk.skillId &&
        coverage.level === atRisk.level,
    );
    for (const coverage of matchingRows) {
      const existing =
        uniqueByTopicVersion.get(coverage.topicVersionId) ??
        {
          topicVersionId: coverage.topicVersionId,
          lostLevels: [] as CoverageLevel[],
          alternativeSessionIds: [] as string[],
        };
      if (!existing.lostLevels.includes(coverage.level)) {
        existing.lostLevels.push(coverage.level);
      }
      for (const other of atRisk.otherSessions) {
        if (!existing.alternativeSessionIds.includes(other.sessionId)) {
          existing.alternativeSessionIds.push(other.sessionId);
        }
      }
      uniqueByTopicVersion.set(coverage.topicVersionId, existing);
    }
  }

  const beforeHealth = computeCoverageHealth(
    snapshot.termData.coverages,
    snapshot.termData.skills.map((skill) => skill.id),
    new Set(snapshot.term.sessions.filter((s: any) => s.status === "canceled").map((s: any) => s.id)),
  );
  const afterHealth = computeCoverageHealth(
    snapshot.termData.coverages,
    snapshot.termData.skills.map((skill) => skill.id),
    new Set(
      snapshot.term.sessions
        .filter((s: any) => s.status === "canceled" || s.id === sessionId)
        .map((s: any) => s.id),
    ),
  );
  const healthBefore = buildHealthFromTermData(
    snapshot,
    new Set(snapshot.term.sessions.filter((s: any) => s.status === "canceled").map((s: any) => s.id)),
  );
  const healthAfter = buildHealthFromTermData(
    snapshot,
    new Set(
      snapshot.term.sessions
        .filter((s: any) => s.status === "canceled" || s.id === sessionId)
        .map((s: any) => s.id),
    ),
  );

  return {
    sessionId,
    affectedCoverages: affectedCoverageRows.map((coverage: any) => ({
      id: coverage.id,
      sessionId: coverage.sessionId,
      topicVersionId: coverage.topicVersionId,
      level: coverage.level,
      notes: coverage.notes,
      redistributedFrom: coverage.redistributedFrom,
      redistributedAt: coverage.redistributedAt?.toISOString() ?? null,
    })),
    atRiskTopics: [...uniqueByTopicVersion.values()],
    healthBefore: {
      totalTopics: beforeHealth.totalSkills,
      fullyCovered: beforeHealth.fullyCovered,
      partiallyCovered: healthBefore.partiallyCovered,
      uncovered: healthBefore.uncovered,
    },
    healthAfter: {
      totalTopics: afterHealth.totalSkills,
      fullyCovered: afterHealth.fullyCovered,
      partiallyCovered: healthAfter.partiallyCovered,
      uncovered: healthAfter.uncovered,
    },
    issues: normalizeValidationIssues(impact.newViolations, snapshot.topicVersionIdByTopicId),
  };
}

function validateCancelRequest(
  snapshot: PlanningSnapshot,
  sessionId: string,
  redistributions: CancelRedistributionInput[],
): PlanningIssueDto[] {
  const impact = simulateCancellation(snapshot.termData, sessionId);
  const redistributionErrors = validateRedistribution(
    snapshot.termData,
    sessionId,
    redistributions.map((redistribution) => {
      const topicVersion = snapshot.term.sessions
        .flatMap((session: any) => session.coverages)
        .find((coverage: any) => coverage.topicVersionId === redistribution.topicVersionId);
      return {
        skillId: topicVersion?.topicVersion.topicId ?? redistribution.topicVersionId,
        level: redistribution.level,
        fromSessionId: sessionId,
        toSessionId: redistribution.targetSessionId,
      };
    }),
  );

  const issues = normalizeValidationIssues(redistributionErrors, snapshot.topicVersionIdByTopicId);
  for (const atRisk of impact.atRiskSkills.filter((entry) => entry.uniqueCoverage)) {
    const redistributed = redistributions.some((entry) => {
      const coverage = snapshot.term.sessions
        .flatMap((session: any) => session.coverages)
        .find(
          (candidate: any) =>
            candidate.topicVersion.topicId === atRisk.skillId &&
            candidate.topicVersionId === entry.topicVersionId &&
            candidate.level === entry.level,
        );
      return Boolean(coverage);
    });
    if (!redistributed) {
      issues.push(
        buildCoverageIssue(
          "unique_coverage_lost",
          "warning",
          `Canceling this Session drops the only ${atRisk.level} coverage for Topic ${snapshot.topicVersionIdByTopicId.get(atRisk.skillId) ?? atRisk.skillId}`,
          {
            topicVersionId: snapshot.topicVersionIdByTopicId.get(atRisk.skillId),
            sessionId,
          },
        ),
      );
    }
  }

  return issues;
}

export async function listSessionsForTerm(db: RedesignDb, termId: string) {
  return db.$transaction(async (tx) => {
    await loadTermOrThrow(tx, termId);
    return tx.session.findMany({
      where: { termId },
      orderBy: [{ date: "asc" }, { sequence: "asc" }],
    });
  });
}

export async function createSession(db: RedesignDb, input: CreateSessionInput) {
  return db.$transaction(async (tx) => {
    const term = await loadTermOrThrow(tx, input.termId);
    assertWritableTerm(term.status);

    if (input.termLearningModuleId) {
      await loadTermLearningModuleForTerm(tx, term.id, input.termLearningModuleId);
    }

    return tx.session.create({
      data: {
        termId: term.id,
        termLearningModuleId: input.termLearningModuleId ?? null,
        sequence: input.sequence,
        sessionType: input.sessionType,
        code: input.code,
        title: input.title,
        date: input.date ?? null,
        description: input.description ?? null,
        format: input.format ?? null,
        notes: input.notes ?? null,
        instructionalMode: input.instructionalMode ?? "standard",
      },
    });
  });
}

export async function getSession(db: RedesignDb, sessionId: string) {
  return db.$transaction(async (tx) => loadSessionOrThrow(tx, sessionId));
}

async function updateSessionInternal(
  tx: RedesignTx,
  sessionId: string,
  input: UpdateSessionInput | MoveSessionInput,
  markMoved: boolean,
) {
  const session = await loadSessionOrThrow(tx, sessionId);
  assertWritableTerm(session.term.status);
  if (session.status === "canceled") {
    throw new DomainInvariantError("Canceled Sessions cannot be edited");
  }

  let nextTermLearningModuleId = session.termLearningModuleId;
  if ("termLearningModuleId" in input && input.termLearningModuleId !== undefined) {
    nextTermLearningModuleId = input.termLearningModuleId;
    if (input.termLearningModuleId) {
      await loadTermLearningModuleForTerm(tx, session.termId, input.termLearningModuleId);
    }
  }

  const moved =
    markMoved &&
    (("date" in input && input.date !== undefined && input.date?.getTime?.() !== session.date?.getTime?.()) ||
      ("termLearningModuleId" in input && input.termLearningModuleId !== undefined && input.termLearningModuleId !== session.termLearningModuleId) ||
      ("sequence" in input && input.sequence !== undefined && input.sequence !== session.sequence));

  return tx.session.update({
    where: { id: sessionId },
    data: {
      termLearningModuleId: nextTermLearningModuleId,
      sequence: "sequence" in input ? input.sequence : undefined,
      sessionType: "sessionType" in input ? input.sessionType : undefined,
      code: "code" in input ? input.code : undefined,
      title: "title" in input ? input.title : undefined,
      date: "date" in input ? input.date : undefined,
      description: "description" in input ? input.description : undefined,
      format: "format" in input ? input.format : undefined,
      notes: "notes" in input ? input.notes : undefined,
      instructionalMode: "instructionalMode" in input ? input.instructionalMode : undefined,
      archivedAt: "archivedAt" in input ? input.archivedAt : undefined,
      status: moved ? "moved" : undefined,
    },
  });
}

export async function updateSession(db: RedesignDb, sessionId: string, input: UpdateSessionInput) {
  return db.$transaction((tx) => updateSessionInternal(tx, sessionId, input, true));
}

export async function archiveSession(db: RedesignDb, sessionId: string) {
  return db.$transaction(async (tx) => {
    const session = await loadSessionOrThrow(tx, sessionId);
    assertWritableTerm(session.term.status);
    if (session.archivedAt) return session;
    return tx.session.update({
      where: { id: sessionId },
      data: { archivedAt: new Date() },
    });
  });
}

export async function moveSession(db: RedesignDb, sessionId: string, input: MoveSessionInput) {
  return db.$transaction((tx) => updateSessionInternal(tx, sessionId, input, true));
}

export async function listSessionCoverages(db: RedesignDb, sessionId: string) {
  return db.$transaction(async (tx) => {
    await loadSessionOrThrow(tx, sessionId);
    return tx.coverage.findMany({
      where: { sessionId },
      orderBy: [{ topicVersionId: "asc" }, { level: "asc" }],
    });
  });
}

export async function createCoverage(db: RedesignDb, input: CreateCoverageInput) {
  return db.$transaction(async (tx) => {
    const session = await loadSessionOrThrow(tx, input.sessionId);
    assertWritableTerm(session.term.status);
    if (session.status === "canceled") {
      throw new DomainInvariantError("Canceled Sessions cannot receive new Coverage");
    }

    await loadTopicVersionForCourse(tx, input.topicVersionId, session.term.courseId);

    return tx.coverage.create({
      data: {
        sessionId: session.id,
        topicVersionId: input.topicVersionId,
        level: input.level,
        notes: input.notes ?? null,
      },
    });
  });
}

export async function getCoverage(db: RedesignDb, coverageId: string) {
  return db.$transaction(async (tx) => {
    const coverage = await tx.coverage.findUnique({
      where: { id: coverageId },
      include: {
        session: {
          include: { term: { select: { status: true } } },
        },
      },
    });
    if (!coverage) throw new DomainInvariantError("Coverage not found");
    return coverage;
  });
}

export async function updateCoverage(db: RedesignDb, coverageId: string, input: UpdateCoverageInput) {
  return db.$transaction(async (tx) => {
    const coverage = await tx.coverage.findUnique({
      where: { id: coverageId },
      include: { session: { include: { term: { select: { status: true } } } } },
    });
    if (!coverage) throw new DomainInvariantError("Coverage not found");
    assertWritableTerm(coverage.session.term.status);
    if (coverage.session.status === "canceled") {
      throw new DomainInvariantError("Canceled Session Coverage cannot be edited");
    }

    return tx.coverage.update({
      where: { id: coverageId },
      data: {
        level: input.level,
        notes: input.notes,
      },
    });
  });
}

export async function deleteCoverage(db: RedesignDb, coverageId: string) {
  return db.$transaction(async (tx) => {
    const coverage = await tx.coverage.findUnique({
      where: { id: coverageId },
      include: { session: { include: { term: { select: { status: true } } } } },
    });
    if (!coverage) throw new DomainInvariantError("Coverage not found");
    assertWritableTerm(coverage.session.term.status);
    await tx.coverage.delete({ where: { id: coverageId } });
    return coverage;
  });
}

export async function listAssessmentsForTerm(db: RedesignDb, termId: string) {
  return db.$transaction(async (tx) => {
    await loadTermOrThrow(tx, termId);
    return tx.assessment.findMany({
      where: { termId },
      include: { topics: true },
      orderBy: [{ dueDate: "asc" }, { code: "asc" }],
    });
  });
}

async function validateAssessmentTopics(
  tx: RedesignTx,
  term: { courseId: string },
  topicVersionIds: string[],
) {
  for (const topicVersionId of topicVersionIds) {
    await loadTopicVersionForCourse(tx, topicVersionId, term.courseId);
  }
}

export async function createAssessment(db: RedesignDb, input: CreateAssessmentInput) {
  return db.$transaction(async (tx) => {
    const term = await loadTermOrThrow(tx, input.termId);
    assertWritableTerm(term.status);
    if (input.sessionId) await assertAssessmentSessionBelongsToTerm(tx, input.sessionId, term.id);
    await validateAssessmentTopics(tx, term, input.topicVersionIds ?? []);

    return tx.assessment.create({
      data: {
        termId: term.id,
        code: input.code,
        title: input.title,
        assessmentType: input.assessmentType,
        description: input.description ?? null,
        studentInstructions: input.studentInstructions ?? null,
        sessionId: input.sessionId ?? null,
        dueDate: input.dueDate ?? null,
        rubric: input.rubric ?? null,
        progressionStage: input.progressionStage ?? null,
        topics: {
          create: (input.topicVersionIds ?? []).map((topicVersionId) => ({ topicVersionId })),
        },
      },
      include: { topics: true },
    });
  });
}

export async function getAssessment(db: RedesignDb, assessmentId: string) {
  return db.$transaction(async (tx) => {
    const assessment = await tx.assessment.findUnique({
      where: { id: assessmentId },
      include: { topics: true, term: { select: { status: true, courseId: true, id: true } } },
    });
    if (!assessment) throw new DomainInvariantError("Assessment not found");
    return assessment;
  });
}

export async function updateAssessment(db: RedesignDb, assessmentId: string, input: UpdateAssessmentInput) {
  return db.$transaction(async (tx) => {
    const assessment = await tx.assessment.findUnique({
      where: { id: assessmentId },
      include: { term: { select: { status: true, courseId: true, id: true } } },
    });
    if (!assessment) throw new DomainInvariantError("Assessment not found");
    assertWritableTerm(assessment.term.status);
    if (input.sessionId) {
      await assertAssessmentSessionBelongsToTerm(tx, input.sessionId, assessment.term.id);
    }
    if (input.topicVersionIds) {
      await validateAssessmentTopics(tx, assessment.term, input.topicVersionIds);
    }

    return tx.assessment.update({
      where: { id: assessmentId },
      data: {
        code: input.code,
        title: input.title,
        assessmentType: input.assessmentType,
        description: input.description,
        studentInstructions: input.studentInstructions,
        sessionId: input.sessionId,
        dueDate: input.dueDate,
        rubric: input.rubric,
        progressionStage: input.progressionStage,
        ...(input.topicVersionIds
          ? {
              topics: {
                deleteMany: {},
                create: input.topicVersionIds.map((topicVersionId) => ({ topicVersionId })),
              },
            }
          : {}),
      },
      include: { topics: true },
    });
  });
}

export async function archiveAssessment(db: RedesignDb, assessmentId: string) {
  return db.$transaction(async (tx) => {
    const assessment = await tx.assessment.findUnique({
      where: { id: assessmentId },
      include: { term: { select: { status: true } }, topics: true },
    });
    if (!assessment) throw new DomainInvariantError("Assessment not found");
    assertWritableTerm(assessment.term.status);
    if (assessment.archivedAt) return assessment;
    return tx.assessment.update({
      where: { id: assessmentId },
      data: { archivedAt: new Date() },
      include: { topics: true },
    });
  });
}

export async function computeTermImpact(db: RedesignDb, termId: string) {
  return db.$transaction(async (tx) => {
    const snapshot = await loadPlanningSnapshot(tx, termId);
    const activeCoverages = snapshot.termData.coverages.filter((coverage: any) => {
      const session = snapshot.termData.sessions.find((candidate: any) => candidate.id === coverage.sessionId);
      return session?.status !== "canceled";
    });

    const issues: PlanningIssueDto[] = [];
    issues.push(...normalizeValidationIssues(
      validateAllCoverageOrdering(activeCoverages),
      snapshot.topicVersionIdByTopicId,
    ));
    issues.push(
      ...findUnassessedSkills(activeCoverages).map((error) =>
        buildCoverageIssue(
          error.type,
          "warning",
          error.message,
          {
            topicVersionId: error.skillId ? snapshot.topicVersionIdByTopicId.get(error.skillId) : undefined,
          },
        ),
      ),
    );
    for (const [topicId, tracked] of snapshot.trackedTopics.entries()) {
      if (tracked.activeLevels.size === 0) {
        issues.push(
          buildCoverageIssue(
            "topic_uncovered",
            "warning",
            `Topic ${tracked.topicVersionId} has no active Coverage in this Term`,
            { topicVersionId: tracked.topicVersionId },
          ),
        );
      }
      if (!tracked.assessed) {
        issues.push(
          buildCoverageIssue(
            "topic_not_assessed",
            "warning",
            `Topic ${snapshot.topicVersionIdByTopicId.get(topicId) ?? topicId} has no Assessment`,
            { topicVersionId: tracked.topicVersionId },
          ),
        );
      }
    }
    issues.push(...findOutOfOfferingWarnings(snapshot));
    issues.push(...findPlanningGaps(snapshot));

    return {
      termId,
      health: buildHealth(snapshot.trackedTopics),
      issues,
    };
  });
}

export async function getSessionWhatIf(db: RedesignDb, sessionId: string) {
  return db.$transaction(async (tx) => {
    const session = await loadSessionOrThrow(tx, sessionId);
    const snapshot = await loadPlanningSnapshot(tx, session.termId);
    return simulateWhatIfResponse(snapshot, sessionId);
  });
}

export async function compareTermWhatIfScenarios(
  db: RedesignDb,
  termId: string,
  sessionIdA: string,
  sessionIdB: string,
) {
  return db.$transaction(async (tx) => {
    const snapshot = await loadPlanningSnapshot(tx, termId);
    const sessionIds = new Set(snapshot.term.sessions.map((session: any) => session.id));
    if (!sessionIds.has(sessionIdA) || !sessionIds.has(sessionIdB)) {
      throw new DomainInvariantError("Session not found for this Term");
    }
    compareScenarios(snapshot.termData, sessionIdA, sessionIdB);
    return {
      scenarioA: simulateWhatIfResponse(snapshot, sessionIdA),
      scenarioB: simulateWhatIfResponse(snapshot, sessionIdB),
    };
  });
}

export async function cancelSession(
  db: RedesignDb,
  input: {
    sessionId: string;
    reason?: string | null;
    redistributions: CancelRedistributionInput[];
    dryRun?: boolean;
    force?: boolean;
  },
) {
  return db.$transaction(async (tx) => {
    const session = await loadSessionOrThrow(tx, input.sessionId);
    assertWritableTerm(session.term.status);
    if (session.status === "canceled") {
      return session;
    }

    const snapshot = await loadPlanningSnapshot(tx, session.termId);
    const issues = validateCancelRequest(snapshot, session.id, input.redistributions);
    const hasErrors = issues.some((issue) => issue.severity === "error");
    if (input.dryRun || hasErrors) {
      return { valid: !hasErrors, issues };
    }

    const targetSessions = new Map<string, SessionWithTerm>();
    for (const redistribution of input.redistributions) {
      const target = await loadSessionOrThrow(tx, redistribution.targetSessionId);
      if (target.termId !== session.termId) {
        throw new DomainInvariantError("Redistribution target Session must belong to the same Term");
      }
      if (target.status === "canceled") {
        throw new DomainInvariantError("Cannot redistribute Coverage to a canceled Session");
      }
      if (target.archivedAt) {
        throw new DomainInvariantError("Cannot redistribute Coverage to an archived Session");
      }
      await loadTopicVersionForCourse(tx, redistribution.topicVersionId, session.term.courseId);
      const existing = await tx.coverage.findUnique({
        where: {
          sessionId_topicVersionId_level: {
            sessionId: target.id,
            topicVersionId: redistribution.topicVersionId,
            level: redistribution.level,
          },
        },
      });
      if (existing) {
        throw new DomainInvariantError("Redistribution target already has that Topic coverage level");
      }
      targetSessions.set(target.id, target);
    }

    const updatedSession = await tx.session.update({
      where: { id: session.id },
      data: {
        status: "canceled",
        canceledAt: new Date(),
        canceledReason: input.reason ?? null,
      },
    });

    for (const redistribution of input.redistributions) {
      await tx.coverage.create({
        data: {
          sessionId: redistribution.targetSessionId,
          topicVersionId: redistribution.topicVersionId,
          level: redistribution.level,
          redistributedFrom: session.id,
          redistributedAt: new Date(),
        },
      });
    }

    return updatedSession;
  });
}

export async function computeSessionMoveImpact(
  db: RedesignDb,
  sessionId: string,
  input: MoveSessionInput,
) {
  return db.$transaction(async (tx) => {
    const session = await loadSessionOrThrow(tx, sessionId);
    const snapshot = await loadPlanningSnapshot(tx, session.termId);
    const targetOffering =
      input.termLearningModuleId === undefined
        ? session.termLearningModule
        : input.termLearningModuleId
          ? await loadTermLearningModuleForTerm(tx, session.termId, input.termLearningModuleId)
          : null;

    return computeMoveImpact(
      sessionId,
      input.date === undefined ? session.date : input.date ?? null,
      targetOffering?.sequence ?? DETACHED_SEQUENCE,
      input.sequence ?? session.sequence,
      snapshot.termData.coverages,
    );
  });
}
