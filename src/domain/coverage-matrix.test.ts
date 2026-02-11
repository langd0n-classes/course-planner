import { describe, it, expect } from "vitest";
import {
  assembleCoverageMatrix,
  computeHealthBar,
  filterMatrixRows,
  getSkillHealthStatus,
  type MatrixSkill,
  type MatrixSession,
  type MatrixCoverage,
} from "./coverage-matrix";

// ─── Test Data ──────────────────────────────────────────

const skills: MatrixSkill[] = [
  { id: "s1", code: "A01", category: "Foundations", description: "Use variables" },
  { id: "s2", code: "A02", category: "Foundations", description: "Write loops" },
  { id: "s3", code: "B01", category: "Analysis", description: "Read CSV files" },
  { id: "s4", code: "B02", category: "Analysis", description: "Clean data" },
  { id: "s5", code: "C01", category: "Visualization", description: "Create plots" },
];

const sessions: MatrixSession[] = [
  { id: "se1", code: "lec-01", title: "Intro", sessionType: "lecture", date: "2026-01-20", status: "scheduled", moduleId: "m1", moduleCode: "LM-01", moduleSequence: 0, sequence: 0 },
  { id: "se2", code: "lec-02", title: "Variables", sessionType: "lecture", date: "2026-01-22", status: "scheduled", moduleId: "m1", moduleCode: "LM-01", moduleSequence: 0, sequence: 1 },
  { id: "se3", code: "lab-01", title: "Lab 1", sessionType: "lab", date: "2026-01-24", status: "scheduled", moduleId: "m1", moduleCode: "LM-01", moduleSequence: 0, sequence: 2 },
  { id: "se4", code: "lec-03", title: "Loops", sessionType: "lecture", date: "2026-01-27", status: "canceled", moduleId: "m2", moduleCode: "LM-02", moduleSequence: 1, sequence: 0 },
];

describe("assembleCoverageMatrix", () => {
  it("returns ALL skills including those with zero coverage", () => {
    const coverages: MatrixCoverage[] = [
      { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
    ];

    const rows = assembleCoverageMatrix(skills, sessions, coverages);

    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.skill.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("marks uncovered skills as having no coverage", () => {
    const coverages: MatrixCoverage[] = [
      { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
    ];

    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const uncovered = rows.filter((r) => !r.hasCoverage);

    expect(uncovered).toHaveLength(4);
    expect(uncovered.map((r) => r.skill.id)).toEqual(["s2", "s3", "s4", "s5"]);
  });

  it("marks a skill as fully covered when it has I + P + A", () => {
    const coverages: MatrixCoverage[] = [
      { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
      { id: "c2", sessionId: "se2", skillId: "s1", level: "practiced" },
      { id: "c3", sessionId: "se3", skillId: "s1", level: "assessed" },
    ];

    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const s1Row = rows.find((r) => r.skill.id === "s1")!;

    expect(s1Row.fullyCovered).toBe(true);
    expect(s1Row.hasCoverage).toBe(true);
    expect(s1Row.levels).toEqual(new Set(["introduced", "practiced", "assessed"]));
  });

  it("marks a skill as partially covered when missing levels", () => {
    const coverages: MatrixCoverage[] = [
      { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
      { id: "c2", sessionId: "se2", skillId: "s1", level: "practiced" },
    ];

    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const s1Row = rows.find((r) => r.skill.id === "s1")!;

    expect(s1Row.fullyCovered).toBe(false);
    expect(s1Row.hasCoverage).toBe(true);
    expect(s1Row.levels).toEqual(new Set(["introduced", "practiced"]));
  });

  it("excludes canceled sessions from level tracking", () => {
    const coverages: MatrixCoverage[] = [
      { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
      { id: "c2", sessionId: "se4", skillId: "s1", level: "practiced" }, // se4 is canceled
    ];

    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const s1Row = rows.find((r) => r.skill.id === "s1")!;

    // Only "introduced" counts (se4 is canceled)
    expect(s1Row.levels).toEqual(new Set(["introduced"]));
    expect(s1Row.fullyCovered).toBe(false);
  });

  it("populates coverageBySession correctly", () => {
    const coverages: MatrixCoverage[] = [
      { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
      { id: "c2", sessionId: "se1", skillId: "s1", level: "practiced" },
      { id: "c3", sessionId: "se2", skillId: "s1", level: "assessed" },
    ];

    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const s1Row = rows.find((r) => r.skill.id === "s1")!;

    expect(s1Row.coverageBySession.get("se1")).toHaveLength(2);
    expect(s1Row.coverageBySession.get("se2")).toHaveLength(1);
    expect(s1Row.coverageBySession.has("se3")).toBe(false);
  });
});

describe("computeHealthBar", () => {
  it("counts fully covered, partially covered, and uncovered", () => {
    const coverages: MatrixCoverage[] = [
      // s1: fully covered (I + P + A)
      { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
      { id: "c2", sessionId: "se2", skillId: "s1", level: "practiced" },
      { id: "c3", sessionId: "se3", skillId: "s1", level: "assessed" },
      // s2: partially covered (I only)
      { id: "c4", sessionId: "se1", skillId: "s2", level: "introduced" },
      // s3, s4, s5: uncovered
    ];

    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const health = computeHealthBar(rows);

    expect(health.fullyCovered).toBe(1);
    expect(health.partiallyCovered).toBe(1);
    expect(health.uncovered).toBe(3);
    expect(health.total).toBe(5);
  });

  it("returns all zeros for empty input", () => {
    const health = computeHealthBar([]);
    expect(health).toEqual({ fullyCovered: 0, partiallyCovered: 0, uncovered: 0, total: 0 });
  });
});

describe("getSkillHealthStatus", () => {
  it("returns correct status for each coverage state", () => {
    const coverages: MatrixCoverage[] = [
      { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
      { id: "c2", sessionId: "se2", skillId: "s1", level: "practiced" },
      { id: "c3", sessionId: "se3", skillId: "s1", level: "assessed" },
      { id: "c4", sessionId: "se1", skillId: "s2", level: "introduced" },
    ];

    const rows = assembleCoverageMatrix(skills, sessions, coverages);

    expect(getSkillHealthStatus(rows.find((r) => r.skill.id === "s1")!)).toBe("fully_covered");
    expect(getSkillHealthStatus(rows.find((r) => r.skill.id === "s2")!)).toBe("partially_covered");
    expect(getSkillHealthStatus(rows.find((r) => r.skill.id === "s3")!)).toBe("uncovered");
  });
});

describe("filterMatrixRows", () => {
  const coverages: MatrixCoverage[] = [
    { id: "c1", sessionId: "se1", skillId: "s1", level: "introduced" },
    { id: "c2", sessionId: "se2", skillId: "s1", level: "practiced" },
    { id: "c3", sessionId: "se3", skillId: "s1", level: "assessed" },
    { id: "c4", sessionId: "se1", skillId: "s2", level: "introduced" },
  ];

  it("returns all rows when filter is 'all'", () => {
    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const filtered = filterMatrixRows(rows, "all");
    expect(filtered).toHaveLength(5);
  });

  it("filters to only gaps (partial + uncovered) when filter is 'gaps'", () => {
    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const filtered = filterMatrixRows(rows, "gaps");

    // s1 is fully covered → excluded
    // s2 partially, s3/s4/s5 uncovered → included
    expect(filtered).toHaveLength(4);
    expect(filtered.map((r) => r.skill.id)).toEqual(["s2", "s3", "s4", "s5"]);
  });

  it("filters to only at-risk skills when filter is 'at_risk'", () => {
    const rows = assembleCoverageMatrix(skills, sessions, coverages);
    const atRiskIds = new Set(["s2", "s4"]);
    const filtered = filterMatrixRows(rows, "at_risk", atRiskIds);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.skill.id)).toEqual(["s2", "s4"]);
  });
});
