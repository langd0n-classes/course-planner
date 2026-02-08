import { describe, it, expect } from "vitest";
import {
  validateSkillCoverageOrder,
  validateAllCoverageOrdering,
  findOrphanSkills,
  findUnassessedSkills,
  validateGAIEProgression,
  computeMoveImpact,
  type CoverageEntry,
  type GAIEEntry,
} from "./coverage-rules";

// ─── Helpers ─────────────────────────────────────────────

function entry(
  overrides: Partial<CoverageEntry> & {
    skillId: string;
    level: CoverageEntry["level"];
  },
): CoverageEntry {
  return {
    sessionId: "s1",
    sessionDate: null,
    sessionSequence: 0,
    moduleSequence: 0,
    ...overrides,
  };
}

// ─── validateSkillCoverageOrder ─────────────────────────

describe("validateSkillCoverageOrder", () => {
  it("passes when order is introduced → practiced → assessed", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "introduced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
      entry({
        skillId: "A01",
        level: "practiced",
        moduleSequence: 0,
        sessionSequence: 1,
        sessionId: "s2",
      }),
      entry({
        skillId: "A01",
        level: "assessed",
        moduleSequence: 1,
        sessionSequence: 0,
        sessionId: "s3",
      }),
    ];
    const errors = validateSkillCoverageOrder("A01", entries);
    expect(errors).toHaveLength(0);
  });

  it("errors when practiced before introduced", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "practiced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
      entry({
        skillId: "A01",
        level: "introduced",
        moduleSequence: 0,
        sessionSequence: 1,
        sessionId: "s2",
      }),
    ];
    const errors = validateSkillCoverageOrder("A01", entries);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("practiced_before_introduced");
  });

  it("errors when assessed before introduced", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "assessed",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
    ];
    const errors = validateSkillCoverageOrder("A01", entries);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.type)).toContain("assessed_before_introduced");
    expect(errors.map((e) => e.type)).toContain("assessed_before_practiced");
  });

  it("errors when assessed before practiced", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "introduced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
      entry({
        skillId: "A01",
        level: "assessed",
        moduleSequence: 0,
        sessionSequence: 1,
        sessionId: "s2",
      }),
    ];
    const errors = validateSkillCoverageOrder("A01", entries);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("assessed_before_practiced");
  });

  it("allows introduced+practiced in same session (same sequence)", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "introduced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
      entry({
        skillId: "A01",
        level: "practiced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
    ];
    // Same session: introduced should come first when sorted by level within session
    // Since they have the same sequence, the introduced entry should still come first
    // because we're sorting by module then session sequence.
    // Both have moduleSequence=0, sessionSequence=0, so order depends on array order.
    // This is technically fine — both happen in the same session.
    const errors = validateSkillCoverageOrder("A01", entries);
    expect(errors).toHaveLength(0);
  });

  it("returns empty for no entries", () => {
    const errors = validateSkillCoverageOrder("A01", []);
    expect(errors).toHaveLength(0);
  });

  it("filters to only the specified skill", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "introduced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
      entry({
        skillId: "B01",
        level: "assessed",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
    ];
    const errors = validateSkillCoverageOrder("A01", entries);
    expect(errors).toHaveLength(0);
  });
});

// ─── validateAllCoverageOrdering ────────────────────────

describe("validateAllCoverageOrdering", () => {
  it("validates multiple skills at once", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "practiced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
      entry({
        skillId: "B01",
        level: "assessed",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
    ];
    const errors = validateAllCoverageOrdering(entries);
    // A01: practiced before introduced (1 error)
    // B01: assessed before introduced + assessed before practiced (2 errors)
    expect(errors).toHaveLength(3);
  });
});

// ─── findOrphanSkills ───────────────────────────────────

describe("findOrphanSkills", () => {
  it("finds skills with no coverage", () => {
    const entries: CoverageEntry[] = [
      entry({ skillId: "A01", level: "introduced" }),
    ];
    const errors = findOrphanSkills(["A01", "B01", "C01"], entries);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.skillId)).toEqual(["B01", "C01"]);
  });

  it("returns empty when all skills are covered", () => {
    const entries: CoverageEntry[] = [
      entry({ skillId: "A01", level: "introduced" }),
      entry({ skillId: "B01", level: "introduced" }),
    ];
    const errors = findOrphanSkills(["A01", "B01"], entries);
    expect(errors).toHaveLength(0);
  });
});

// ─── findUnassessedSkills ───────────────────────────────

describe("findUnassessedSkills", () => {
  it("finds skills never assessed", () => {
    const entries: CoverageEntry[] = [
      entry({ skillId: "A01", level: "introduced" }),
      entry({ skillId: "A01", level: "practiced" }),
      entry({ skillId: "B01", level: "introduced" }),
    ];
    const errors = findUnassessedSkills(entries);
    expect(errors).toHaveLength(2);
  });

  it("returns empty when all skills are assessed", () => {
    const entries: CoverageEntry[] = [
      entry({ skillId: "A01", level: "introduced" }),
      entry({ skillId: "A01", level: "practiced" }),
      entry({ skillId: "A01", level: "assessed" }),
    ];
    const errors = findUnassessedSkills(entries);
    expect(errors).toHaveLength(0);
  });
});

// ─── validateGAIEProgression ────────────────────────────

describe("validateGAIEProgression", () => {
  it("passes for correct progression", () => {
    const gaies: GAIEEntry[] = [
      {
        assessmentId: "g1",
        progressionStage: "copy-paste",
        date: null,
        sequence: 0,
      },
      {
        assessmentId: "g2",
        progressionStage: "modify",
        date: null,
        sequence: 1,
      },
      {
        assessmentId: "g3",
        progressionStage: "write-own",
        date: null,
        sequence: 2,
      },
    ];
    const errors = validateGAIEProgression(gaies);
    expect(errors).toHaveLength(0);
  });

  it("errors when progression goes backwards", () => {
    const gaies: GAIEEntry[] = [
      {
        assessmentId: "g1",
        progressionStage: "modify",
        date: null,
        sequence: 0,
      },
      {
        assessmentId: "g2",
        progressionStage: "copy-paste",
        date: null,
        sequence: 1,
      },
    ];
    const errors = validateGAIEProgression(gaies);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("gaie_progression_broken");
  });

  it("allows repeated stages", () => {
    const gaies: GAIEEntry[] = [
      {
        assessmentId: "g1",
        progressionStage: "copy-paste",
        date: null,
        sequence: 0,
      },
      {
        assessmentId: "g2",
        progressionStage: "copy-paste",
        date: null,
        sequence: 1,
      },
      {
        assessmentId: "g3",
        progressionStage: "modify",
        date: null,
        sequence: 2,
      },
    ];
    const errors = validateGAIEProgression(gaies);
    expect(errors).toHaveLength(0);
  });
});

// ─── computeMoveImpact ──────────────────────────────────

describe("computeMoveImpact", () => {
  it("identifies affected skills when a session moves", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "introduced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
      entry({
        skillId: "A01",
        level: "practiced",
        moduleSequence: 0,
        sessionSequence: 1,
        sessionId: "s2",
      }),
      entry({
        skillId: "B01",
        level: "introduced",
        moduleSequence: 0,
        sessionSequence: 1,
        sessionId: "s2",
      }),
    ];

    const impact = computeMoveImpact(
      "s2",
      new Date("2026-01-20"),
      0,
      1,
      entries,
    );

    expect(impact.movedSessionId).toBe("s2");
    expect(impact.affectedSkillIds).toContain("A01");
    expect(impact.affectedSkillIds).toContain("B01");
    expect(impact.coverageAtRisk).toHaveLength(2);
  });

  it("detects new violations when session moves before introduction", () => {
    const entries: CoverageEntry[] = [
      entry({
        skillId: "A01",
        level: "introduced",
        moduleSequence: 0,
        sessionSequence: 0,
        sessionId: "s1",
      }),
      entry({
        skillId: "A01",
        level: "practiced",
        moduleSequence: 0,
        sessionSequence: 1,
        sessionId: "s2",
      }),
    ];

    // Move practiced session BEFORE the introduced session
    const impact = computeMoveImpact(
      "s2",
      null,
      0,
      -1, // before s1's sequence of 0
      entries,
    );

    expect(impact.newViolations.length).toBeGreaterThan(0);
    expect(impact.newViolations[0].type).toBe("practiced_before_introduced");
  });
});
