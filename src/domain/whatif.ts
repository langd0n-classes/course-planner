/**
 * What-if simulation logic for session cancellation analysis.
 *
 * Pure functions — no DB access — designed for cancellation impact
 * analysis and redistribution validation.
 */

import {
  type CoverageEntry,
  type CoverageLevel,
  type ValidationError,
  validateAllCoverageOrdering,
} from "./coverage-rules";

// ─── Types ──────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  code: string;
  title: string;
  date: Date | null;
  moduleId: string;
  moduleSequence: number;
  sessionSequence: number;
  status: "scheduled" | "canceled" | "moved";
}

export interface SkillInfo {
  id: string;
  code: string;
  description: string;
  category: string;
}

export interface TermData {
  sessions: SessionInfo[];
  coverages: CoverageEntry[];
  skills: SkillInfo[];
}

export interface CoverageHealthSummary {
  totalSkills: number;
  fullyIntroduced: number;
  fullyPracticed: number;
  fullyAssessed: number;
  /** Skills covered at all three levels (I, P, A) */
  fullyCovered: number;
  orderingViolations: number;
}

export interface AtRiskSkill {
  skillId: string;
  skillCode: string;
  level: CoverageLevel;
  /** True if this is the ONLY coverage at this level for the skill */
  uniqueCoverage: boolean;
  /** Other sessions that cover this skill at any level */
  otherSessions: Array<{ sessionId: string; sessionCode: string; level: CoverageLevel }>;
}

export interface CancellationImpact {
  canceledSessionId: string;
  /** All coverage entries on the canceled session */
  affectedCoverages: CoverageEntry[];
  /** Skills that lose their only coverage at a given level */
  atRiskSkills: AtRiskSkill[];
  /** Coverage health before cancellation */
  healthBefore: CoverageHealthSummary;
  /** Coverage health after cancellation */
  healthAfter: CoverageHealthSummary;
  /** New ordering violations introduced by cancellation */
  newViolations: ValidationError[];
}

export interface ScenarioComparison {
  scenarioA: CancellationImpact;
  scenarioB: CancellationImpact;
}

export interface RedistributionEntry {
  skillId: string;
  level: CoverageLevel;
  fromSessionId: string;
  toSessionId: string;
}

// ─── Coverage Health ────────────────────────────────────

/**
 * Compute a coverage health summary from coverage entries.
 * Only considers coverages on scheduled (non-canceled) sessions.
 */
export function computeCoverageHealth(
  coverages: CoverageEntry[],
  allSkillIds: string[],
  canceledSessionIds: Set<string> = new Set(),
): CoverageHealthSummary {
  const activeCoverages = coverages.filter(
    (c) => !canceledSessionIds.has(c.sessionId),
  );

  const skillLevels = new Map<string, Set<CoverageLevel>>();
  for (const c of activeCoverages) {
    if (!skillLevels.has(c.skillId)) skillLevels.set(c.skillId, new Set());
    skillLevels.get(c.skillId)!.add(c.level);
  }

  let fullyIntroduced = 0;
  let fullyPracticed = 0;
  let fullyAssessed = 0;
  let fullyCovered = 0;

  for (const skillId of allSkillIds) {
    const levels = skillLevels.get(skillId);
    if (!levels) continue;
    if (levels.has("introduced")) fullyIntroduced++;
    if (levels.has("practiced")) fullyPracticed++;
    if (levels.has("assessed")) fullyAssessed++;
    if (
      levels.has("introduced") &&
      levels.has("practiced") &&
      levels.has("assessed")
    ) {
      fullyCovered++;
    }
  }

  const violations = validateAllCoverageOrdering(activeCoverages);

  return {
    totalSkills: allSkillIds.length,
    fullyIntroduced,
    fullyPracticed,
    fullyAssessed,
    fullyCovered,
    orderingViolations: violations.length,
  };
}

// ─── Cancellation Simulation ────────────────────────────

/**
 * Simulate canceling a session and compute the impact.
 * Pure function — does not mutate any data.
 */
export function simulateCancellation(
  termData: TermData,
  sessionId: string,
): CancellationImpact {
  const { sessions, coverages, skills } = termData;
  const allSkillIds = skills.map((s) => s.id);

  // Find coverages on the canceled session
  const affectedCoverages = coverages.filter(
    (c) => c.sessionId === sessionId,
  );

  // Build a map of all session codes for reference
  const sessionCodeMap = new Map(sessions.map((s) => [s.id, s.code]));

  // Find already-canceled sessions
  const existingCanceled = new Set(
    sessions.filter((s) => s.status === "canceled").map((s) => s.id),
  );

  // Compute health before (with existing cancellations)
  const healthBefore = computeCoverageHealth(
    coverages,
    allSkillIds,
    existingCanceled,
  );

  // Compute health after (adding this session to canceled set)
  const canceledAfter = new Set([...existingCanceled, sessionId]);
  const healthAfter = computeCoverageHealth(
    coverages,
    allSkillIds,
    canceledAfter,
  );

  // Find at-risk skills: those where this session has the ONLY coverage
  // at a specific level among non-canceled sessions
  const atRiskSkills: AtRiskSkill[] = [];

  for (const affected of affectedCoverages) {
    // Find other coverages for this skill at the same level on non-canceled sessions
    const otherSameLevel = coverages.filter(
      (c) =>
        c.skillId === affected.skillId &&
        c.level === affected.level &&
        c.sessionId !== sessionId &&
        !existingCanceled.has(c.sessionId),
    );

    // Find other sessions that cover this skill at any level
    const otherSessions = coverages
      .filter(
        (c) =>
          c.skillId === affected.skillId &&
          c.sessionId !== sessionId &&
          !existingCanceled.has(c.sessionId),
      )
      .map((c) => ({
        sessionId: c.sessionId,
        sessionCode: sessionCodeMap.get(c.sessionId) || c.sessionId,
        level: c.level,
      }));

    const skillInfo = skills.find((s) => s.id === affected.skillId);

    atRiskSkills.push({
      skillId: affected.skillId,
      skillCode: skillInfo?.code || affected.skillId,
      level: affected.level,
      uniqueCoverage: otherSameLevel.length === 0,
      otherSessions,
    });
  }

  // Find new ordering violations
  const activeCoveragesAfter = coverages.filter(
    (c) => !canceledAfter.has(c.sessionId),
  );
  const violationsBefore = validateAllCoverageOrdering(
    coverages.filter((c) => !existingCanceled.has(c.sessionId)),
  );
  const violationsAfter = validateAllCoverageOrdering(activeCoveragesAfter);

  // New violations = violations after that weren't there before
  const beforeSet = new Set(violationsBefore.map((v) => `${v.type}:${v.skillId}:${v.sessionId}`));
  const newViolations = violationsAfter.filter(
    (v) => !beforeSet.has(`${v.type}:${v.skillId}:${v.sessionId}`),
  );

  return {
    canceledSessionId: sessionId,
    affectedCoverages,
    atRiskSkills,
    healthBefore,
    healthAfter,
    newViolations,
  };
}

// ─── Scenario Comparison ────────────────────────────────

/**
 * Compare the impact of canceling two different sessions side by side.
 */
export function compareScenarios(
  termData: TermData,
  sessionIdA: string,
  sessionIdB: string,
): ScenarioComparison {
  return {
    scenarioA: simulateCancellation(termData, sessionIdA),
    scenarioB: simulateCancellation(termData, sessionIdB),
  };
}

// ─── Redistribution Validation ──────────────────────────

/**
 * Validate that a proposed redistribution maintains coverage ordering
 * (introduced before practiced before assessed).
 *
 * Takes the current term data and the proposed redistributions,
 * applies them to a copy of the coverage entries, and checks ordering.
 */
export function validateRedistribution(
  termData: TermData,
  canceledSessionId: string,
  redistributions: RedistributionEntry[],
): ValidationError[] {
  const { sessions, coverages } = termData;

  // Build session info map
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  // Start with existing coverages minus the canceled session's coverages
  const canceledSession = sessionMap.get(canceledSessionId);
  if (!canceledSession) return [];

  // Keep coverages from non-canceled sessions
  const baseCoverages = coverages.filter(
    (c) => c.sessionId !== canceledSessionId,
  );

  // Add redistribution entries as new coverages
  const newCoverages: CoverageEntry[] = redistributions.map((r) => {
    const targetSession = sessionMap.get(r.toSessionId);
    return {
      sessionId: r.toSessionId,
      skillId: r.skillId,
      level: r.level,
      sessionDate: targetSession?.date || null,
      sessionSequence: targetSession?.sessionSequence || 0,
      moduleSequence: targetSession?.moduleSequence || 0,
    };
  });

  const allCoverages = [...baseCoverages, ...newCoverages];

  return validateAllCoverageOrdering(allCoverages);
}
