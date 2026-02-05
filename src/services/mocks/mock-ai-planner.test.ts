import { describe, it, expect } from "vitest";
import { MockAiPlanner } from "./mock-ai-planner";

describe("MockAiPlanner", () => {
  const planner = new MockAiPlanner();

  it("returns redistribution suggestions", async () => {
    const suggestions = await planner.suggestRedistribution({
      canceledSessionId: "s1",
      affectedSkillIds: ["sk1", "sk2"],
      availableSessions: [
        { id: "s2", title: "Lecture 2", date: new Date() },
        { id: "s3", title: "Lecture 3", date: new Date() },
      ],
      termContext: "Spring 2026",
    });

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].skillId).toBe("sk1");
    expect(suggestions[0].confidence).toBeGreaterThan(0);
    expect(suggestions[0].rationale).toContain("[Mock]");
  });

  it("returns coverage analysis", async () => {
    const analysis = await planner.analyzeCoverage({
      coverageMatrix: "A01: I, P; A02: I",
      skills: [
        { id: "sk1", code: "A01", description: "Python expressions" },
        { id: "sk2", code: "A02", description: "Variables" },
      ],
      termContext: "Spring 2026",
    });

    expect(analysis.overallScore).toBeGreaterThan(0);
    expect(analysis.gaps).toHaveLength(2);
    expect(analysis.strengths.length).toBeGreaterThan(0);
  });

  it("returns chat response", async () => {
    const response = await planner.chat(
      [{ role: "user", content: "How should I assess skill B07?" }],
      "DS-100 Spring 2026",
    );

    expect(response.role).toBe("assistant");
    expect(response.content).toContain("[Mock AI]");
    expect(response.content).toContain("How should I assess skill B07?");
  });
});
