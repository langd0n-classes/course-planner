import { describe, it, expect } from "vitest";
import {
  buildTermSummaryMarkdown,
  buildModuleOverviewText,
  buildSessionPromptText,
  type TermSummaryInput,
  type ModuleOverviewInput,
  type SessionPromptInput,
} from "./exporters";

const termSummaryInput = (): TermSummaryInput => ({
  term: {
    code: "S26",
    name: "Spring 2026",
    courseCode: "TEST-100",
    startDate: "2026-01-20",
    endDate: "2026-05-15",
  },
  modules: [
    {
      code: "LM-01",
      title: "Foundations",
      description: "Getting started",
      learningObjectives: ["Understand variables", "Run programs"],
      sessionCount: 3,
    },
  ],
  skills: [
    { id: "sk1", code: "A01", category: "Foundations", description: "Write expressions" },
    { id: "sk2", code: "A02", category: "Foundations", description: "Use variables" },
    { id: "sk3", code: "B01", category: "Analysis", description: "Interpret plots" },
  ],
  sessions: [
    {
      id: "s1",
      code: "lec-01",
      title: "Intro",
      sessionType: "lecture",
      date: "2026-01-20",
      status: "scheduled",
      moduleId: "m1",
      moduleCode: "LM-01",
      moduleSequence: 0,
      sequence: 0,
    },
  ],
  coverages: [
    { id: "c1", sessionId: "s1", skillId: "sk1", level: "introduced" },
    { id: "c2", sessionId: "s1", skillId: "sk2", level: "introduced" },
    { id: "c3", sessionId: "s1", skillId: "sk2", level: "practiced" },
  ],
  assessments: [
    {
      code: "GAIE-01",
      title: "First assignment",
      assessmentType: "gaie",
      dueDate: "2026-02-01",
      skillCodes: ["A01", "A02"],
    },
  ],
});

describe("buildTermSummaryMarkdown", () => {
  it("contains term title, modules, and health counts", () => {
    const md = buildTermSummaryMarkdown(termSummaryInput());

    expect(md).toContain("Spring 2026");
    expect(md).toContain("TEST-100");
    expect(md).toContain("LM-01");
    expect(md).toContain("Foundations");
    // health: 0 fully covered, 2 partial (sk1 intro-only counts partial,
    // sk2 intro+practiced partial), 1 uncovered
    expect(md).toMatch(/Fully covered:\s*0/);
    expect(md).toMatch(/Partially covered:\s*2/);
    expect(md).toMatch(/Uncovered:\s*1/);
    expect(md).toContain("3 skills");
  });

  it("groups skills by category with coverage status", () => {
    const md = buildTermSummaryMarkdown(termSummaryInput());
    expect(md).toContain("### Analysis");
    expect(md).toContain("### Foundations");
    expect(md).toMatch(/B01.*uncovered/);
    expect(md).toMatch(/A02.*partial/);
  });

  it("lists assessments with linked skills", () => {
    const md = buildTermSummaryMarkdown(termSummaryInput());
    expect(md).toContain("GAIE-01");
    expect(md).toContain("First assignment");
    expect(md).toContain("A01, A02");
  });

  it("handles an empty term gracefully", () => {
    const md = buildTermSummaryMarkdown({
      term: {
        code: "E1",
        name: "Empty Term",
        courseCode: "NONE-0",
        startDate: "2026-01-01",
        endDate: "2026-05-01",
      },
      modules: [],
      skills: [],
      sessions: [],
      coverages: [],
      assessments: [],
    });
    expect(md).toContain("Empty Term");
    expect(md).toContain("No modules");
    expect(md).toContain("No skills");
    expect(md).toContain("No assessments");
  });
});

const moduleOverviewInput = (): ModuleOverviewInput => ({
  module: {
    code: "LM-01",
    title: "Foundations",
    description: "Getting started with programming.",
    learningObjectives: ["Understand variables", "Run programs"],
  },
  sessions: [
    {
      code: "lec-01",
      title: "Intro",
      sessionType: "lecture",
      date: "2026-01-20",
      description: "First session.",
      status: "scheduled",
    },
    {
      code: "lab-01",
      title: "Setup lab",
      sessionType: "lab",
      date: null,
      description: null,
      status: "canceled",
    },
  ],
  skillCoverages: [
    { skillCode: "A01", skillDescription: "Write expressions", level: "introduced" },
    { skillCode: "A01", skillDescription: "Write expressions", level: "practiced" },
    { skillCode: "A02", skillDescription: "Use variables", level: "practiced" },
  ],
  assessments: [
    { code: "GAIE-01", title: "First assignment", assessmentType: "gaie", dueDate: "2026-02-01" },
  ],
});

describe("buildModuleOverviewText", () => {
  it("contains numbered learning objectives and the session list", () => {
    const text = buildModuleOverviewText(moduleOverviewInput());

    expect(text).toContain("LM-01");
    expect(text).toContain("1. Understand variables");
    expect(text).toContain("2. Run programs");
    expect(text).toContain("lec-01");
    expect(text).toContain("(lecture");
    expect(text).toContain("Setup lab");
    expect(text).toMatch(/canceled/i);
  });

  it("groups skills by coverage level", () => {
    const text = buildModuleOverviewText(moduleOverviewInput());
    expect(text).toContain("Introduced:");
    expect(text).toContain("Practiced:");
    // A01 appears under both introduced and practiced
    const practicedSection = text.slice(text.indexOf("Practiced:"));
    expect(practicedSection).toContain("A01");
    expect(practicedSection).toContain("A02");
  });

  it("contains no markdown heading/emphasis syntax", () => {
    const text = buildModuleOverviewText(moduleOverviewInput());
    expect(text).not.toMatch(/^#/m);
    expect(text).not.toContain("**");
  });

  it("handles a module with no sessions or skills", () => {
    const text = buildModuleOverviewText({
      module: { code: "LM-09", title: "Empty", description: null, learningObjectives: [] },
      sessions: [],
      skillCoverages: [],
      assessments: [],
    });
    expect(text).toContain("LM-09");
    expect(text).toContain("No sessions");
    expect(text).toContain("No skills");
  });
});

const sessionPromptInput = (): SessionPromptInput => ({
  course: { courseCode: "TEST-100", termName: "Spring 2026" },
  session: {
    code: "lec-05",
    title: "Programming Basics",
    sessionType: "lecture",
    date: "2026-01-28",
    description: "Variables, expressions, and calling functions.",
  },
  module: { code: "LM-01", title: "Foundations" },
  skills: [
    { code: "A01", description: "Write expressions", level: "introduced" },
    { code: "A02", description: "Use variables", level: "practiced" },
    { code: "A03", description: "Call functions", level: "assessed" },
  ],
  priorSessionTitles: ["Welcome", "Tools setup"],
  upcomingSessionTitles: ["Data types"],
  assessments: [{ title: "First assignment", assessmentType: "gaie" }],
});

describe("buildSessionPromptText", () => {
  it("frames the prompt around the session and course", () => {
    const text = buildSessionPromptText(sessionPromptInput());
    expect(text).toContain("Programming Basics");
    expect(text).toContain("TEST-100");
    expect(text).toContain("Spring 2026");
    expect(text).toContain("LM-01");
  });

  it("labels skills with Introduce / Practice / Assess", () => {
    const text = buildSessionPromptText(sessionPromptInput());
    expect(text).toMatch(/Introduce:.*A01/);
    expect(text).toMatch(/Practice:.*A02/);
    expect(text).toMatch(/Assess:.*A03/);
  });

  it("includes prior and upcoming session titles and closing instruction", () => {
    const text = buildSessionPromptText(sessionPromptInput());
    expect(text).toContain("Welcome");
    expect(text).toContain("Tools setup");
    expect(text).toContain("Data types");
    expect(text).toMatch(/suggest .*lecture session/i);
  });

  it("handles a bare session gracefully", () => {
    const text = buildSessionPromptText({
      course: { courseCode: "X", termName: "T" },
      session: { code: "lab-01", title: "Solo", sessionType: "lab", date: null, description: null },
      module: { code: "M", title: "Mod" },
      skills: [],
      priorSessionTitles: [],
      upcomingSessionTitles: [],
      assessments: [],
    });
    expect(text).toContain("Solo");
    expect(text).toContain("No skills are linked");
    expect(text).toMatch(/lab session/i);
  });
});
