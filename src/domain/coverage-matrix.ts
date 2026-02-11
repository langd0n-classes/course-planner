/**
 * Domain logic for coverage matrix assembly and health summary.
 *
 * Pure functions — no DB access — designed for coverage matrix views.
 */

import type { CoverageLevel } from "./coverage-rules";

// ─── Types ──────────────────────────────────────────────

export interface MatrixSkill {
  id: string;
  code: string;
  category: string;
  description: string;
}

export interface MatrixSession {
  id: string;
  code: string;
  title: string;
  sessionType: "lecture" | "lab";
  date: string | null;
  status: "scheduled" | "canceled" | "moved";
  moduleId: string;
  moduleCode: string;
  moduleSequence: number;
  sequence: number;
}

export interface MatrixCoverage {
  id: string;
  sessionId: string;
  skillId: string;
  level: CoverageLevel;
  redistributedFrom?: string | null;
}

export interface MatrixRow {
  skill: MatrixSkill;
  /** Map from sessionId to coverage entries (can have multiple levels) */
  coverageBySession: Map<string, MatrixCoverage[]>;
  /** Set of levels this skill has across all sessions */
  levels: Set<CoverageLevel>;
  /** Whether this skill is fully covered (I + P + A) */
  fullyCovered: boolean;
  /** Whether this skill has any coverage at all */
  hasCoverage: boolean;
}

export type HealthStatus = "fully_covered" | "partially_covered" | "uncovered";

export interface CoverageHealthBar {
  fullyCovered: number;
  partiallyCovered: number;
  uncovered: number;
  total: number;
}

// ─── Functions ──────────────────────────────────────────

/**
 * Assemble the full coverage matrix from skills, sessions, and coverages.
 * Returns ALL skills as rows, including those with zero coverage.
 */
export function assembleCoverageMatrix(
  skills: MatrixSkill[],
  sessions: MatrixSession[],
  coverages: MatrixCoverage[],
): MatrixRow[] {
  // Build coverage lookup: skillId -> sessionId -> coverages[]
  const coverageMap = new Map<string, Map<string, MatrixCoverage[]>>();
  for (const cov of coverages) {
    if (!coverageMap.has(cov.skillId)) {
      coverageMap.set(cov.skillId, new Map());
    }
    const sessionMap = coverageMap.get(cov.skillId)!;
    if (!sessionMap.has(cov.sessionId)) {
      sessionMap.set(cov.sessionId, []);
    }
    sessionMap.get(cov.sessionId)!.push(cov);
  }

  // Only consider coverages on non-canceled sessions for level tracking
  const activeSessions = new Set(
    sessions.filter((s) => s.status !== "canceled").map((s) => s.id),
  );

  return skills.map((skill) => {
    const coverageBySession = coverageMap.get(skill.id) ?? new Map();
    const levels = new Set<CoverageLevel>();
    for (const [sessionId, covs] of coverageBySession) {
      if (activeSessions.has(sessionId)) {
        for (const c of covs) {
          levels.add(c.level);
        }
      }
    }
    return {
      skill,
      coverageBySession,
      levels,
      fullyCovered:
        levels.has("introduced") &&
        levels.has("practiced") &&
        levels.has("assessed"),
      hasCoverage: levels.size > 0,
    };
  });
}

/**
 * Compute the health bar counts from matrix rows.
 */
export function computeHealthBar(rows: MatrixRow[]): CoverageHealthBar {
  let fullyCovered = 0;
  let partiallyCovered = 0;
  let uncovered = 0;

  for (const row of rows) {
    if (row.fullyCovered) {
      fullyCovered++;
    } else if (row.hasCoverage) {
      partiallyCovered++;
    } else {
      uncovered++;
    }
  }

  return {
    fullyCovered,
    partiallyCovered,
    uncovered,
    total: rows.length,
  };
}

/**
 * Determine the health status for a single skill row.
 */
export function getSkillHealthStatus(row: MatrixRow): HealthStatus {
  if (row.fullyCovered) return "fully_covered";
  if (row.hasCoverage) return "partially_covered";
  return "uncovered";
}

/**
 * Filter matrix rows by health status.
 */
export function filterMatrixRows(
  rows: MatrixRow[],
  filter: "all" | "gaps" | "at_risk",
  atRiskSkillIds?: Set<string>,
): MatrixRow[] {
  switch (filter) {
    case "gaps":
      return rows.filter((r) => !r.fullyCovered);
    case "at_risk":
      return rows.filter((r) => atRiskSkillIds?.has(r.skill.id) ?? false);
    default:
      return rows;
  }
}
