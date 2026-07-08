import { computeCoverageHealth } from "@/domain/whatif";
import type { CoverageEntry } from "@/domain/coverage-rules";
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

    return {
      skill,
      category: skill.category,
      cells,
      coverageStatus,
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
