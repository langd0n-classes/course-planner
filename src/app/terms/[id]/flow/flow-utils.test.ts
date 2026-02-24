import { describe, it, expect } from "vitest";
import { buildFlowData } from "./flow-utils";
import type { Module, Session, Skill, Coverage } from "@/lib/api-client";

describe("buildFlowData", () => {
  it("maps skills to rows, honors canceled sessions, and summarizes coverage", () => {
    const modules: Module[] = [
      {
        id: "m1",
        termId: "t1",
        sequence: 1,
        code: "MOD-1",
        title: "Module One",
        description: null,
        learningObjectives: [],
      },
      {
        id: "m2",
        termId: "t1",
        sequence: 2,
        code: "MOD-2",
        title: "Module Two",
        description: null,
        learningObjectives: [],
      },
    ];

    const sessions: Session[] = [
      {
        id: "s1",
        moduleId: "m1",
        sequence: 1,
        sessionType: "lecture",
        code: "L-01",
        title: "Intro",
        date: "2025-01-10",
        description: null,
        format: null,
        notes: null,
        status: "scheduled",
        canceledAt: null,
        canceledReason: null,
      },
      {
        id: "s2",
        moduleId: "m1",
        sequence: 2,
        sessionType: "lab",
        code: "LB-02",
        title: "Lab",
        date: "2025-01-17",
        description: null,
        format: null,
        notes: null,
        status: "canceled",
        canceledAt: "2025-01-12T10:00:00.000Z",
        canceledReason: "Instructor sick",
      },
      {
        id: "s3",
        moduleId: "m2",
        sequence: 1,
        sessionType: "lecture",
        code: "L-03",
        title: "Advanced",
        date: "2025-01-24",
        description: null,
        format: null,
        notes: null,
        status: "scheduled",
        canceledAt: null,
        canceledReason: null,
      },
    ];

    const skills: Skill[] = [
      {
        id: "sk1",
        code: "SK1",
        category: "Cat A",
        description: "",
        isGlobal: false,
        termId: "t1",
      },
      {
        id: "sk2",
        code: "SK2",
        category: "Cat B",
        description: "",
        isGlobal: false,
        termId: "t1",
      },
      {
        id: "sk3",
        code: "SK3",
        category: "Cat B",
        description: "",
        isGlobal: true,
        termId: null,
      },
    ];

    const coverages: Coverage[] = [
      {
        id: "c1",
        sessionId: "s1",
        skillId: "sk1",
        level: "introduced",
        notes: null,
      },
      {
        id: "c2",
        sessionId: "s2",
        skillId: "sk1",
        level: "practiced",
        notes: null,
      },
      {
        id: "c3",
        sessionId: "s3",
        skillId: "sk1",
        level: "assessed",
        notes: null,
      },
      {
        id: "c4",
        sessionId: "s2",
        skillId: "sk2",
        level: "introduced",
        notes: null,
      },
    ];

    const flow = buildFlowData({ modules, sessions, skills, coverages });

    expect(flow.rows).toHaveLength(3);
    expect(flow.modules.map((group) => group.module.id)).toEqual(["m1", "m2"]);
    expect(flow.sessions.find((session) => session.sessionId === "s2")?.isCanceled).toBe(true);

    const skillOneRow = flow.rows.find((row) => row.skill.id === "sk1");
    const skillTwoRow = flow.rows.find((row) => row.skill.id === "sk2");
    const skillThreeRow = flow.rows.find((row) => row.skill.id === "sk3");

    expect(skillOneRow?.coverageStatus).toBe("partial");
    expect(skillTwoRow?.coverageStatus).toBe("none");
    expect(skillThreeRow?.coverageStatus).toBe("none");
    expect(flow.summary.totalSkills).toBe(3);
    expect(flow.summary.fullyCovered).toBe(0);
    expect(flow.summary.partiallyCovered).toBe(1);
    expect(flow.summary.uncovered).toBe(2);
    expect(flow.summary.canceledSessions).toBe(1);
    expect(flow.summary.skillsAtRiskFromCancellations).toBe(2);
    expect(flow.categories).toEqual(["Cat A", "Cat B"]);
  });
});
