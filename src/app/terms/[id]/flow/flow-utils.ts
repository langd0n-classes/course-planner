import { computeCoverageHealth } from "@/domain/whatif";
import type { CoverageEntry } from "@/domain/coverage-rules";
import {
  assembleCoverageMatrix,
  getSkillHealthStatus,
  type HealthStatus,
} from "@/domain/coverage-matrix";
import { Module, Session, Skill, Coverage } from "@/lib/api-client";

export type FlowCoverageLevel = Coverage["level"];

export interface FlowCoverageEntry {
  id: string;
  level: FlowCoverageLevel;
}

export interface FlowCell {
  sessionId: string;
  moduleId: string;
  levels: FlowCoverageLevel[];
  entries: FlowCoverageEntry[];
  isCanceled: boolean;
}

export type FlowCoverageStatus = "complete" | "partial" | "none";

export interface FlowRow {
  skill: Skill;
  category: string;
  cells: FlowCell[];
  coverageStatus: FlowCoverageStatus;
  healthStatus: HealthStatus;
}

export interface FlowSessionInfo {
  session: Session;
  sessionId: string;
  code: string;
  title: string;
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  sessionType: Session["sessionType"];
  date: string | null;
  isCanceled: boolean;
  status: Session["status"];
}

export interface FlowModuleGroup {
  module: Module;
  sessions: FlowSessionInfo[];
}

export interface FlowSummary {
  totalSkills: number;
  fullyCovered: number;
  partiallyCovered: number;
  uncovered: number;
  totalSessions: number;
  scheduledSessions: number;
  canceledSessions: number;
  skillsAtRiskFromCancellations: number;
  coverageHealth: ReturnType<typeof computeCoverageHealth>;
}

export interface FlowData {
  modules: FlowModuleGroup[];
  sessions: FlowSessionInfo[];
  rows: FlowRow[];
  summary: FlowSummary;
  categories: string[];
}

export interface FlowDataInput {
  modules: Module[];
  sessions: Session[];
  skills: Skill[];
  coverages: Coverage[];
}

const LEVEL_ORDER: FlowCoverageLevel[] = [
  "introduced",
  "practiced",
  "assessed",
];

const sortSessions = (a: Session, b: Session) => {
  const sequenceDiff = a.sequence - b.sequence;
  if (sequenceDiff !== 0) return sequenceDiff;
  if (a.date && b.date) {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
  }
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.code.localeCompare(b.code);
};

const sortModules = (a: Module, b: Module) => {
  const sequenceDiff = a.sequence - b.sequence;
  if (sequenceDiff !== 0) return sequenceDiff;
  return a.code.localeCompare(b.code);
};

const buildFlowSessionInfo = (
  session: Session,
  module: Module,
): FlowSessionInfo => ({
  session,
  sessionId: session.id,
  code: session.code,
  title: session.title,
  moduleId: module.id,
  moduleCode: module.code,
  moduleTitle: module.title,
  sessionType: session.sessionType,
  date: session.date,
  isCanceled: session.status === "canceled",
  status: session.status,
});

const orderLevels = (levels: FlowCoverageLevel[]) => {
  return [...new Set(levels)].sort(
    (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
  );
};

const buildModulePlaceholder = (session: Session): Module => ({
  id: session.moduleId,
  termId: session.module?.termId ?? "",
  sequence: session.module?.sequence ?? Number.MAX_SAFE_INTEGER,
  code: session.module?.code ?? session.moduleId,
  title: session.module?.title ?? session.moduleId,
  description: session.module?.description ?? null,
  learningObjectives: session.module?.learningObjectives ?? [],
  notes: session.module?.notes ?? null,
});

/**
 * The span of session columns a skill's thread runs through: from its
 * first coverage to its last. Null when the skill has no coverage at all.
 * Used to draw the horizontal "skill flow" line (design principle #5).
 */
export function computeThreadSpan(
  cells: FlowCell[],
): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  cells.forEach((cell, index) => {
    if (cell.entries.length === 0) return;
    if (start === -1) start = index;
    end = index;
  });
  return start === -1 ? null : { start, end };
}

/**
 * A cancellation breaks a thread only when it removes a level the skill
 * needs, not merely because an unrelated session falls between two badges.
 */
export function doesThreadBreakAtCell(
  cells: FlowCell[],
  cellIndex: number,
  simulatedSessionId: string | null,
): boolean {
  const cell = cells[cellIndex];
  if (!cell || (!cell.isCanceled && cell.sessionId !== simulatedSessionId)) return false;

  return cell.entries.some((entry) =>
    !cells.some(
      (other) =>
        other.sessionId !== cell.sessionId &&
        !other.isCanceled &&
        other.sessionId !== simulatedSessionId &&
        other.entries.some((candidate) => candidate.level === entry.level),
    ),
  );
}

/** Returns only cancellation impacts that lose a skill's sole level coverage. */
export function uniqueAtRiskSkillIds(
  atRiskSkills: Array<{ skillId: string; uniqueCoverage: boolean }>,
): Set<string> {
  return new Set(
    atRiskSkills.filter((skill) => skill.uniqueCoverage).map((skill) => skill.skillId),
  );
}

/**
 * Rebuild the skill-health portion of the summary from the currently-visible
 * (filtered) rows. Each row's `healthStatus` was already computed against
 * the full, unfiltered term in `buildFlowData` -- filtering only changes
 * which rows/cells are *displayed*, not a skill's actual coverage state --
 * so we simply re-tally it rather than recomputing coverage from scratch.
 *
 * Session-scope numbers (canceledSessions, skillsAtRiskFromCancellations,
 * etc.) are intentionally taken from `fullSummary` unchanged: those describe
 * facts about the term, not the display filters. Toggling "hide canceled
 * sessions" is a display preference, not a claim that the term has fewer
 * cancellations -- deriving these from the filtered session list previously
 * zeroed them out whenever canceled sessions were hidden.
 */
export function summarizeFilteredFlowData(
  data: Pick<FlowData, "rows">,
  fullSummary: FlowSummary,
): FlowSummary {
  let fullyCovered = 0;
  let partiallyCovered = 0;
  let uncovered = 0;
  data.rows.forEach((row) => {
    if (row.healthStatus === "fully_covered") fullyCovered++;
    else if (row.healthStatus === "partially_covered") partiallyCovered++;
    else uncovered++;
  });

  return {
    ...fullSummary,
    totalSkills: data.rows.length,
    fullyCovered,
    partiallyCovered,
    uncovered,
  };
}

export function buildFlowData(input: FlowDataInput): FlowData {
  const { modules, sessions, skills, coverages } = input;

  const rawGroups = new Map<string, { module: Module; sessions: Session[] }>();

  modules.forEach((module) => {
    rawGroups.set(module.id, { module, sessions: [] });
  });

  sessions.forEach((session) => {
    let group = rawGroups.get(session.moduleId);
    if (!group) {
      const placeholder = buildModulePlaceholder(session);
      group = { module: placeholder, sessions: [] };
      rawGroups.set(session.moduleId, group);
    }
    group.sessions.push(session);
  });

  const sortedModuleGroups: FlowModuleGroup[] = Array.from(rawGroups.values())
    .sort((a, b) => sortModules(a.module, b.module))
    .map((group) => ({
      module: group.module,
      sessions: [...group.sessions]
        .sort(sortSessions)
        .map((session) => buildFlowSessionInfo(session, group.module)),
    }));

  const orderedSessionInfos: FlowSessionInfo[] = sortedModuleGroups.flatMap(
    (group) => group.sessions,
  );

  const canceledSessionIds = new Set(
    sessions.filter((session) => session.status === "canceled").map((session) => session.id),
  );

  const coverageMap = new Map<string, Coverage[]>();
  coverages.forEach((coverage) => {
    const key = `${coverage.skillId}:${coverage.sessionId}`;
    if (!coverageMap.has(key)) coverageMap.set(key, []);
    coverageMap.get(key)!.push(coverage);
  });

  // Rows are grouped by category (then code) so the grid can render
  // category section labels.
  const sortedSkills = [...skills].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.code.localeCompare(b.code),
  );

  const rows: FlowRow[] = sortedSkills.map((skill) => {
    const cells: FlowCell[] = orderedSessionInfos.map((sessionInfo) => {
      const key = `${skill.id}:${sessionInfo.sessionId}`;
      const entries = coverageMap.get(key) ?? [];
      const levels = orderLevels(entries.map((entry) => entry.level));
      return {
        sessionId: sessionInfo.sessionId,
        moduleId: sessionInfo.moduleId,
        levels,
        entries: entries.map((entry) => ({ id: entry.id, level: entry.level })),
        isCanceled: sessionInfo.isCanceled,
      };
    });

    const scheduledLevels = new Set<FlowCoverageLevel>();
    coverages.forEach((coverage) => {
      if (coverage.skillId !== skill.id) return;
      if (canceledSessionIds.has(coverage.sessionId)) return;
      scheduledLevels.add(coverage.level);
    });

    const hasIntroduced = scheduledLevels.has("introduced");
    const hasPracticed = scheduledLevels.has("practiced");
    const hasAssessed = scheduledLevels.has("assessed");

    const coverageStatus: FlowCoverageStatus = hasIntroduced && hasPracticed && hasAssessed
      ? "complete"
      : scheduledLevels.size > 0
        ? "partial"
        : "none";

    const matrixRow = assembleCoverageMatrix(
      [{ id: skill.id, code: skill.code, category: skill.category, description: skill.description }],
      orderedSessionInfos.map((session) => ({
        id: session.sessionId, code: session.code, title: session.title,
        sessionType: session.sessionType, date: session.date, status: session.status,
        moduleId: session.moduleId, moduleCode: session.moduleCode,
        moduleSequence: session.session.module?.sequence ?? 0, sequence: session.session.sequence,
      })),
      cells.flatMap((cell) => cell.entries.map((entry) => ({
        id: entry.id, sessionId: cell.sessionId, skillId: skill.id, level: entry.level,
      }))),
    )[0];

    return {
      skill,
      category: skill.category,
      cells,
      coverageStatus,
      healthStatus: getSkillHealthStatus(matrixRow),
    };
  });

  const totalSkills = skills.length;
  const fullyCovered = rows.filter((row) => row.coverageStatus === "complete").length;
  const partiallyCovered = rows.filter((row) => row.coverageStatus === "partial").length;
  const uncovered = rows.filter((row) => row.coverageStatus === "none").length;

  const totalSessions = sessions.length;
  const canceledSessions = canceledSessionIds.size;
  const scheduledSessions = totalSessions - canceledSessions;

  const skillsAtRisk = new Set<string>();
  coverages.forEach((coverage) => {
    if (!canceledSessionIds.has(coverage.sessionId)) return;
    if (skillsAtRisk.has(coverage.skillId)) return;
    const hasOtherScheduled = coverages.some(
      (other) =>
        other.skillId === coverage.skillId &&
        other.level === coverage.level &&
        other.sessionId !== coverage.sessionId &&
        !canceledSessionIds.has(other.sessionId),
    );
    if (!hasOtherScheduled) {
      skillsAtRisk.add(coverage.skillId);
    }
  });

  // computeCoverageHealth wants domain CoverageEntry objects (with ordering
  // metadata); enrich the API coverages with their session's position.
  const sessionMetaById = new Map<
    string,
    { sessionDate: Date | null; sessionSequence: number; moduleSequence: number }
  >();
  sortedModuleGroups.forEach((group) => {
    group.sessions.forEach((info) => {
      sessionMetaById.set(info.sessionId, {
        sessionDate: info.date ? new Date(info.date) : null,
        sessionSequence: info.session.sequence,
        moduleSequence: group.module.sequence,
      });
    });
  });

  const coverageEntries: CoverageEntry[] = coverages.map((coverage) => {
    const meta = sessionMetaById.get(coverage.sessionId);
    return {
      sessionId: coverage.sessionId,
      skillId: coverage.skillId,
      level: coverage.level,
      sessionDate: meta?.sessionDate ?? null,
      sessionSequence: meta?.sessionSequence ?? 0,
      moduleSequence: meta?.moduleSequence ?? 0,
    };
  });

  const coverageHealth = computeCoverageHealth(
    coverageEntries,
    skills.map((skill) => skill.id),
    canceledSessionIds,
  );

  const categories = Array.from(new Set(skills.map((skill) => skill.category))).sort();

  return {
    modules: sortedModuleGroups,
    sessions: orderedSessionInfos,
    rows,
    categories,
    summary: {
      totalSkills,
      fullyCovered,
      partiallyCovered,
      uncovered,
      totalSessions,
      scheduledSessions,
      canceledSessions,
      skillsAtRiskFromCancellations: skillsAtRisk.size,
      coverageHealth,
    },
  };
}
