import { describe, it, expect } from "vitest";
import {
  simulateCancellation,
  compareScenarios,
  validateRedistribution,
  computeCoverageHealth,
  type TermData,
  type SessionInfo,
  type SkillInfo,
} from "./whatif";
import type { CoverageEntry } from "./coverage-rules";

// ─── Test Fixtures ──────────────────────────────────────

function makeSession(overrides: Partial<SessionInfo> & { id: string }): SessionInfo {
  return {
    code: `lec-${overrides.id.slice(0, 2)}`,
    title: `Session ${overrides.id}`,
    date: null,
    moduleId: "mod-1",
    moduleSequence: 1,
    sessionSequence: 1,
    status: "scheduled",
    ...overrides,
  };
}

function makeSkill(overrides: Partial<SkillInfo> & { id: string }): SkillInfo {
  return {
    code: `SK-${overrides.id.slice(0, 2)}`,
    description: `Skill ${overrides.id}`,
    category: "General",
    ...overrides,
  };
}

function makeCoverage(
  sessionId: string,
  skillId: string,
  level: "introduced" | "practiced" | "assessed",
  sessionInfo?: { date?: Date | null; moduleSequence?: number; sessionSequence?: number },
): CoverageEntry {
  return {
    sessionId,
    skillId,
    level,
    sessionDate: sessionInfo?.date ?? null,
    sessionSequence: sessionInfo?.sessionSequence ?? 0,
    moduleSequence: sessionInfo?.moduleSequence ?? 0,
  };
}

// ─── Scenario: unique coverage ──────────────────────────

function buildUniqueScenario(): TermData {
  // Session A introduces skill-1 (only place it's introduced)
  // Session B practices skill-1 and introduces skill-2
  // Session C assesses skill-1 and skill-2
  const sessions: SessionInfo[] = [
    makeSession({ id: "ses-a", code: "lec-01", sessionSequence: 1, moduleSequence: 1 }),
    makeSession({ id: "ses-b", code: "lec-02", sessionSequence: 2, moduleSequence: 1 }),
    makeSession({ id: "ses-c", code: "lec-03", sessionSequence: 3, moduleSequence: 1 }),
  ];

  const skills: SkillInfo[] = [
    makeSkill({ id: "sk-1", code: "SK-01" }),
    makeSkill({ id: "sk-2", code: "SK-02" }),
  ];

  const coverages: CoverageEntry[] = [
    makeCoverage("ses-a", "sk-1", "introduced", { sessionSequence: 1, moduleSequence: 1 }),
    makeCoverage("ses-b", "sk-1", "practiced", { sessionSequence: 2, moduleSequence: 1 }),
    makeCoverage("ses-b", "sk-2", "introduced", { sessionSequence: 2, moduleSequence: 1 }),
    makeCoverage("ses-c", "sk-1", "assessed", { sessionSequence: 3, moduleSequence: 1 }),
    makeCoverage("ses-c", "sk-2", "assessed", { sessionSequence: 3, moduleSequence: 1 }),
  ];

  return { sessions, coverages, skills };
}

// ─── Scenario: redundant coverage ───────────────────────

function buildRedundantScenario(): TermData {
  // Both session A and B introduce skill-1
  // Session B also practices skill-1
  // Session C assesses skill-1
  const sessions: SessionInfo[] = [
    makeSession({ id: "ses-a", code: "lec-01", sessionSequence: 1, moduleSequence: 1 }),
    makeSession({ id: "ses-b", code: "lec-02", sessionSequence: 2, moduleSequence: 1 }),
    makeSession({ id: "ses-c", code: "lec-03", sessionSequence: 3, moduleSequence: 1 }),
  ];

  const skills: SkillInfo[] = [
    makeSkill({ id: "sk-1", code: "SK-01" }),
  ];

  const coverages: CoverageEntry[] = [
    makeCoverage("ses-a", "sk-1", "introduced", { sessionSequence: 1, moduleSequence: 1 }),
    makeCoverage("ses-b", "sk-1", "introduced", { sessionSequence: 2, moduleSequence: 1 }),
    makeCoverage("ses-b", "sk-1", "practiced", { sessionSequence: 2, moduleSequence: 1 }),
    makeCoverage("ses-c", "sk-1", "assessed", { sessionSequence: 3, moduleSequence: 1 }),
  ];

  return { sessions, coverages, skills };
}

// ─── Tests ──────────────────────────────────────────────

describe("computeCoverageHealth", () => {
  it("computes correct health for fully covered skills", () => {
    const td = buildUniqueScenario();
    const health = computeCoverageHealth(
      td.coverages,
      td.skills.map((s) => s.id),
    );

    expect(health.totalSkills).toBe(2);
    expect(health.fullyIntroduced).toBe(2);
    expect(health.fullyPracticed).toBe(1); // only sk-1 is practiced
    expect(health.fullyAssessed).toBe(2);
    expect(health.fullyCovered).toBe(1); // sk-1 has I+P+A
    // sk-2 is assessed without being practiced → 1 pre-existing violation
    expect(health.orderingViolations).toBe(1);
  });

  it("excludes canceled sessions from health computation", () => {
    const td = buildUniqueScenario();
    const health = computeCoverageHealth(
      td.coverages,
      td.skills.map((s) => s.id),
      new Set(["ses-a"]),
    );

    // After canceling ses-a, sk-1 loses its introduction
    expect(health.fullyIntroduced).toBe(1); // only sk-2
    expect(health.fullyCovered).toBe(0);
  });
});

describe("simulateCancellation", () => {
  it("identifies unique coverage as at-risk when canceling a session", () => {
    const td = buildUniqueScenario();
    const impact = simulateCancellation(td, "ses-a");

    // ses-a has 1 coverage: sk-1 introduced
    expect(impact.affectedCoverages).toHaveLength(1);
    expect(impact.affectedCoverages[0].skillId).toBe("sk-1");

    // sk-1 introduction is unique to ses-a
    const atRisk = impact.atRiskSkills.find(
      (s) => s.skillId === "sk-1" && s.level === "introduced",
    );
    expect(atRisk).toBeDefined();
    expect(atRisk!.uniqueCoverage).toBe(true);
  });

  it("shows redundant coverage as NOT at-risk", () => {
    const td = buildRedundantScenario();
    const impact = simulateCancellation(td, "ses-a");

    // ses-a introduces sk-1, but ses-b also introduces it
    const atRisk = impact.atRiskSkills.find(
      (s) => s.skillId === "sk-1" && s.level === "introduced",
    );
    expect(atRisk).toBeDefined();
    expect(atRisk!.uniqueCoverage).toBe(false);
    expect(atRisk!.otherSessions.length).toBeGreaterThan(0);
  });

  it("computes health diff correctly", () => {
    const td = buildUniqueScenario();
    const impact = simulateCancellation(td, "ses-a");

    expect(impact.healthBefore.fullyIntroduced).toBe(2);
    expect(impact.healthAfter.fullyIntroduced).toBe(1);
    expect(impact.healthBefore.fullyCovered).toBe(1);
    expect(impact.healthAfter.fullyCovered).toBe(0);
  });

  it("detects new ordering violations from cancellation", () => {
    // If we cancel the session that introduces a skill,
    // and another session practices it, that's now practiced-before-introduced
    const td = buildUniqueScenario();
    const impact = simulateCancellation(td, "ses-a");

    // After canceling ses-a (introduces sk-1), ses-b practices sk-1
    // without any introduction — new violation
    const hasViolation = impact.newViolations.some(
      (v) => v.type === "practiced_before_introduced" && v.skillId === "sk-1",
    );
    expect(hasViolation).toBe(true);
  });

  it("handles canceling session with no coverages", () => {
    const td = buildUniqueScenario();
    // Add a session with no coverage
    td.sessions.push(
      makeSession({ id: "ses-empty", code: "lec-empty", sessionSequence: 4 }),
    );

    const impact = simulateCancellation(td, "ses-empty");
    expect(impact.affectedCoverages).toHaveLength(0);
    expect(impact.atRiskSkills).toHaveLength(0);
    expect(impact.healthBefore.fullyCovered).toBe(impact.healthAfter.fullyCovered);
  });

  it("respects already-canceled sessions", () => {
    const td = buildRedundantScenario();
    // Mark ses-b as already canceled
    td.sessions[1].status = "canceled";

    const impact = simulateCancellation(td, "ses-a");
    // Now canceling ses-a means sk-1 loses ALL introduction coverage
    // (ses-b was already canceled, so only ses-a's introduction counts)
    const atRisk = impact.atRiskSkills.find(
      (s) => s.skillId === "sk-1" && s.level === "introduced",
    );
    expect(atRisk).toBeDefined();
    expect(atRisk!.uniqueCoverage).toBe(true);
  });
});

describe("compareScenarios", () => {
  it("returns side-by-side comparison of two sessions", () => {
    const td = buildUniqueScenario();
    const comparison = compareScenarios(td, "ses-a", "ses-b");

    expect(comparison.scenarioA.canceledSessionId).toBe("ses-a");
    expect(comparison.scenarioB.canceledSessionId).toBe("ses-b");

    // ses-a has 1 affected coverage, ses-b has 2
    expect(comparison.scenarioA.affectedCoverages).toHaveLength(1);
    expect(comparison.scenarioB.affectedCoverages).toHaveLength(2);
  });

  it("shows different impact severity for different sessions", () => {
    const td = buildUniqueScenario();
    const comparison = compareScenarios(td, "ses-a", "ses-b");

    // Canceling ses-b is worse: it has more coverages and more at-risk skills
    const aRisk = comparison.scenarioA.atRiskSkills.filter((s) => s.uniqueCoverage).length;
    const bRisk = comparison.scenarioB.atRiskSkills.filter((s) => s.uniqueCoverage).length;
    expect(bRisk).toBeGreaterThanOrEqual(aRisk);
  });
});

describe("validateRedistribution", () => {
  // 4 sessions with full I→P→A coverage for a single skill
  function buildCleanScenario(): TermData {
    const sessions: SessionInfo[] = [
      makeSession({ id: "s1", code: "lec-01", sessionSequence: 1, moduleSequence: 1 }),
      makeSession({ id: "s2", code: "lec-02", sessionSequence: 2, moduleSequence: 1 }),
      makeSession({ id: "s3", code: "lec-03", sessionSequence: 3, moduleSequence: 1 }),
      makeSession({ id: "s4", code: "lec-04", sessionSequence: 4, moduleSequence: 1 }),
    ];
    const skills: SkillInfo[] = [
      makeSkill({ id: "sk-x", code: "SK-X" }),
    ];
    const coverages: CoverageEntry[] = [
      makeCoverage("s1", "sk-x", "introduced", { sessionSequence: 1, moduleSequence: 1 }),
      makeCoverage("s3", "sk-x", "practiced", { sessionSequence: 3, moduleSequence: 1 }),
      makeCoverage("s4", "sk-x", "assessed", { sessionSequence: 4, moduleSequence: 1 }),
    ];
    return { sessions, coverages, skills };
  }

  it("accepts valid redistribution that maintains ordering", () => {
    const td = buildCleanScenario();

    // Cancel s1 (introduces sk-x). Redistribute introduction to s2
    // (before s3 practiced and s4 assessed). Valid I→P→A ordering.
    const errors = validateRedistribution(td, "s1", [
      {
        skillId: "sk-x",
        level: "introduced",
        fromSessionId: "s1",
        toSessionId: "s2",
      },
    ]);

    expect(errors).toHaveLength(0);
  });

  it("rejects redistribution that breaks ordering", () => {
    const td = buildCleanScenario();

    // Cancel s1 (introduces sk-x). Redistribute introduction to s4
    // which is AFTER s3 (practiced). This breaks I→P ordering.
    const errors = validateRedistribution(td, "s1", [
      {
        skillId: "sk-x",
        level: "introduced",
        fromSessionId: "s1",
        toSessionId: "s4",
      },
    ]);

    const hasViolation = errors.some(
      (e) =>
        e.type === "practiced_before_introduced" && e.skillId === "sk-x",
    );
    expect(hasViolation).toBe(true);
  });

  it("accepts redistribution when coverage is redundant", () => {
    const td = buildRedundantScenario();

    // Cancel ses-a. sk-1 introduction also exists on ses-b.
    // No redistribution needed — ses-b introduces, ses-b practices, ses-c assesses.
    const errors = validateRedistribution(td, "ses-a", []);
    expect(errors).toHaveLength(0);
  });
});
