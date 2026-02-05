/**
 * Domain rules for coverage ordering and validation.
 *
 * These are pure functions — no DB access — so they're easily testable.
 */

export type CoverageLevel = "introduced" | "practiced" | "assessed";

export interface CoverageEntry {
  sessionId: string;
  skillId: string;
  level: CoverageLevel;
  /** Session date (null if unscheduled) */
  sessionDate: Date | null;
  /** Session sequence for ordering when dates are equal or null */
  sessionSequence: number;
  /** Module sequence for ordering */
  moduleSequence: number;
}

const LEVEL_ORDER: Record<CoverageLevel, number> = {
  introduced: 0,
  practiced: 1,
  assessed: 2,
};

/**
 * Compare two coverage entries by temporal order:
 * moduleSequence first, then sessionSequence, then date as tiebreaker.
 */
function compareEntries(a: CoverageEntry, b: CoverageEntry): number {
  if (a.moduleSequence !== b.moduleSequence)
    return a.moduleSequence - b.moduleSequence;
  if (a.sessionSequence !== b.sessionSequence)
    return a.sessionSequence - b.sessionSequence;
  if (a.sessionDate && b.sessionDate)
    return a.sessionDate.getTime() - b.sessionDate.getTime();
  return 0;
}

export interface ValidationError {
  type:
    | "practiced_before_introduced"
    | "assessed_before_practiced"
    | "assessed_before_introduced"
    | "gaie_progression_broken"
    | "orphan_skill"
    | "module_no_skills"
    | "skill_not_assessed";
  message: string;
  skillId?: string;
  sessionId?: string;
  moduleId?: string;
}

/**
 * Validate that for a given skill, coverage levels follow the correct order:
 * introduced → practiced → assessed
 *
 * A skill must be introduced before it can be practiced.
 * A skill must be practiced before it can be assessed.
 */
export function validateSkillCoverageOrder(
  skillId: string,
  entries: CoverageEntry[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  const skillEntries = entries
    .filter((e) => e.skillId === skillId)
    .sort(compareEntries);

  if (skillEntries.length === 0) return errors;

  let hasBeenIntroduced = false;
  let hasBeenPracticed = false;

  for (const entry of skillEntries) {
    if (entry.level === "introduced") {
      hasBeenIntroduced = true;
    } else if (entry.level === "practiced") {
      if (!hasBeenIntroduced) {
        errors.push({
          type: "practiced_before_introduced",
          message: `Skill ${skillId} is practiced before being introduced`,
          skillId,
          sessionId: entry.sessionId,
        });
      }
      hasBeenPracticed = true;
    } else if (entry.level === "assessed") {
      if (!hasBeenIntroduced) {
        errors.push({
          type: "assessed_before_introduced",
          message: `Skill ${skillId} is assessed before being introduced`,
          skillId,
          sessionId: entry.sessionId,
        });
      }
      if (!hasBeenPracticed) {
        errors.push({
          type: "assessed_before_practiced",
          message: `Skill ${skillId} is assessed before being practiced`,
          skillId,
          sessionId: entry.sessionId,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate all coverage entries for a term at once.
 * Returns errors for every skill that violates ordering.
 */
export function validateAllCoverageOrdering(
  entries: CoverageEntry[],
): ValidationError[] {
  const skillIds = [...new Set(entries.map((e) => e.skillId))];
  return skillIds.flatMap((id) => validateSkillCoverageOrder(id, entries));
}

/**
 * Check for skills that have no coverage at all (orphans).
 */
export function findOrphanSkills(
  allSkillIds: string[],
  entries: CoverageEntry[],
): ValidationError[] {
  const coveredSkillIds = new Set(entries.map((e) => e.skillId));
  return allSkillIds
    .filter((id) => !coveredSkillIds.has(id))
    .map((id) => ({
      type: "orphan_skill" as const,
      message: `Skill ${id} has no coverage in any session`,
      skillId: id,
    }));
}

/**
 * Check for skills that are introduced/practiced but never assessed.
 */
export function findUnassessedSkills(
  entries: CoverageEntry[],
): ValidationError[] {
  const skillLevels = new Map<string, Set<CoverageLevel>>();
  for (const e of entries) {
    if (!skillLevels.has(e.skillId)) skillLevels.set(e.skillId, new Set());
    skillLevels.get(e.skillId)!.add(e.level);
  }

  const errors: ValidationError[] = [];
  for (const [skillId, levels] of skillLevels) {
    if (!levels.has("assessed")) {
      errors.push({
        type: "skill_not_assessed",
        message: `Skill ${skillId} has no assessment`,
        skillId,
      });
    }
  }
  return errors;
}

export type GAIEProgressionStage = "copy-paste" | "modify" | "write-own";

const GAIE_ORDER: Record<GAIEProgressionStage, number> = {
  "copy-paste": 0,
  modify: 1,
  "write-own": 2,
};

export interface GAIEEntry {
  assessmentId: string;
  progressionStage: GAIEProgressionStage;
  /** Due date or session date for ordering */
  date: Date | null;
  /** Sequence for ordering when dates are equal */
  sequence: number;
}

/**
 * Validate that GAIE assessments follow the correct progression:
 * copy-paste → modify → write-own
 */
export function validateGAIEProgression(
  gaies: GAIEEntry[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const sorted = [...gaies].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    if (a.date && b.date) return a.date.getTime() - b.date.getTime();
    return 0;
  });

  let maxStage = -1;
  for (const gaie of sorted) {
    const stageOrder = GAIE_ORDER[gaie.progressionStage];
    if (stageOrder < maxStage) {
      errors.push({
        type: "gaie_progression_broken",
        message: `GAIE ${gaie.assessmentId} has progression stage "${gaie.progressionStage}" which is out of order`,
      });
    }
    maxStage = Math.max(maxStage, stageOrder);
  }

  return errors;
}

/**
 * Given a session move, compute what skills/coverage entries are impacted.
 */
export interface ImpactResult {
  movedSessionId: string;
  affectedSkillIds: string[];
  coverageAtRisk: CoverageEntry[];
  newViolations: ValidationError[];
}

export function computeMoveImpact(
  sessionId: string,
  newDate: Date | null,
  newModuleSequence: number,
  newSessionSequence: number,
  allEntries: CoverageEntry[],
): ImpactResult {
  // Find all coverage for this session
  const sessionEntries = allEntries.filter((e) => e.sessionId === sessionId);
  const affectedSkillIds = [
    ...new Set(sessionEntries.map((e) => e.skillId)),
  ];

  // Create hypothetical entries with the new position
  const updatedEntries = allEntries.map((e) => {
    if (e.sessionId === sessionId) {
      return {
        ...e,
        sessionDate: newDate,
        moduleSequence: newModuleSequence,
        sessionSequence: newSessionSequence,
      };
    }
    return e;
  });

  // Check for new violations
  const newViolations = validateAllCoverageOrdering(updatedEntries);

  // Find coverage at risk (entries for this session)
  const coverageAtRisk = sessionEntries;

  return {
    movedSessionId: sessionId,
    affectedSkillIds,
    coverageAtRisk,
    newViolations,
  };
}
