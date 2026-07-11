import { describe, it, expect } from "vitest";
import {
  buildTermSummaryMarkdown,
  buildModuleOverviewDocx,
  buildModuleOverviewDocxDocument,
  buildSessionPromptText,
  OBJECTIVES_NUMBERING_REFERENCE,
  type TermSummaryInput,
  type ModuleOverviewInput,
  type SessionPromptInput,
} from "./exporters";
import { Paragraph, type File } from "docx";

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
      skillCoverages: [
        { skillCode: "A01", skillDescription: "Write expressions", level: "introduced" },
        { skillCode: "A02", skillDescription: "Use variables", level: "practiced" },
      ],
    },
    {
      code: "lab-01",
      title: "Setup lab",
      sessionType: "lab",
      date: null,
      description: null,
      status: "canceled",
      skillCoverages: [
        { skillCode: "A01", skillDescription: "Write expressions", level: "practiced" },
      ],
    },
  ],
  assessments: [
    { code: "GAIE-01", title: "First assignment", assessmentType: "gaie", dueDate: "2026-02-01" },
  ],
});

function getDocParagraphs(doc: File): Paragraph[] {
  const body = (doc as unknown as {
    documentWrapper: { document: { body: { root: unknown[] } } };
  }).documentWrapper.document.body;

  return body.root.filter(
    (child: unknown): child is Paragraph => child instanceof Paragraph,
  );
}

function getParagraphText(paragraph: Paragraph): string {
  const text = (
    paragraph as unknown as { root: unknown[] }
  ).root.flatMap((node) => {
    if (!node || typeof node !== "object" || !("root" in node)) return [];
    const childRoot = (node as { root?: unknown[] }).root;
    if (!Array.isArray(childRoot)) return [];
    return childRoot.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || !("rootKey" in entry)) return [];
      if ((entry as { rootKey?: string }).rootKey !== "w:t") return [];
      const parts = (entry as { root?: unknown[] }).root;
      return Array.isArray(parts) ? parts.filter((part): part is string => typeof part === "string") : [];
    });
  });

  return text.join("");
}

function getStyleValue(paragraph: Paragraph): string | null {
  for (const node of (paragraph as unknown as { root: unknown[] }).root) {
    if (!node || typeof node !== "object" || !("rootKey" in node)) continue;
    if ((node as { rootKey?: string }).rootKey !== "w:pPr") continue;
    const props = (node as { root?: unknown[] }).root;
    if (!Array.isArray(props)) continue;
    for (const prop of props) {
      if (!prop || typeof prop !== "object" || !("rootKey" in prop)) continue;
      if ((prop as { rootKey?: string }).rootKey !== "w:pStyle") continue;
      const attr = (prop as { root?: Array<{ root?: { val?: { value?: string } } }> }).root?.[0];
      return attr?.root?.val?.value ?? null;
    }
  }
  return null;
}

function hasNumPr(paragraph: Paragraph): boolean {
  return (paragraph as unknown as { root: unknown[] }).root.some((node) => {
    if (!node || typeof node !== "object" || !("rootKey" in node)) return false;
    if ((node as { rootKey?: string }).rootKey !== "w:pPr") return false;
    const props = (node as { root?: unknown[] }).root;
    return Array.isArray(props)
      ? props.some(
          (prop) =>
            !!prop &&
            typeof prop === "object" &&
            "rootKey" in prop &&
            (prop as { rootKey?: string }).rootKey === "w:numPr",
        )
      : false;
  });
}

/**
 * `w:numPr` alone doesn't distinguish a numbered list from a bulleted one --
 * both are "numbering" in OOXML. This checks the actual level format
 * (`w:numFmt`) registered on the document for the given abstract-numbering
 * reference, so a test can assert "numbered" and mean it.
 */
function hasDecimalNumbering(doc: File, reference: string): boolean {
  const abstractNum = (
    doc as unknown as {
      numbering: { abstractNumberingMap: Map<string, { root: unknown[] }> };
    }
  ).numbering.abstractNumberingMap.get(reference);
  if (!abstractNum) return false;

  const level = abstractNum.root.find(
    (node): node is { rootKey: string; root: unknown[] } =>
      !!node &&
      typeof node === "object" &&
      "rootKey" in node &&
      (node as { rootKey?: string }).rootKey === "w:lvl",
  );
  const numFmt = level?.root.find(
    (node): node is { rootKey: string; root: Array<{ root?: { val?: string } }> } =>
      !!node &&
      typeof node === "object" &&
      "rootKey" in node &&
      (node as { rootKey?: string }).rootKey === "w:numFmt",
  );
  return numFmt?.root[0]?.root?.val === "decimal";
}

describe("buildModuleOverviewDocxDocument", () => {
  it("builds headings, numbered objectives, and session blocks", () => {
    const doc = buildModuleOverviewDocxDocument(moduleOverviewInput());
    const paragraphs = getDocParagraphs(doc).filter((paragraph) => getParagraphText(paragraph));
    const texts = paragraphs.map(getParagraphText);

    expect(texts).toContain("LM-01: Foundations");
    expect(texts).toContain("Getting started with programming.");
    expect(texts).toContain("Learning Objectives");
    expect(texts).toContain("Understand variables");
    expect(texts).toContain("Run programs");
    expect(texts).toContain("Sessions");
    expect(texts).toContain("lec-01: Intro");
    expect(texts).toContain("lab-01: Setup lab [Canceled]");
    expect(texts).toContain("First session.");

    expect(getStyleValue(paragraphs[0])).toBe("Heading1");
    expect(texts.filter((text) => text === "Learning Objectives")).toHaveLength(1);

    const objectiveParagraphs = paragraphs.filter((paragraph) =>
      ["Understand variables", "Run programs"].includes(getParagraphText(paragraph)),
    );
    expect(objectiveParagraphs).toHaveLength(2);
    expect(objectiveParagraphs.every(hasNumPr)).toBe(true);
    // hasNumPr alone would also pass for a bulleted list -- assert the
    // actual registered format is decimal, not a bullet glyph.
    expect(hasDecimalNumbering(doc, OBJECTIVES_NUMBERING_REFERENCE)).toBe(true);
  });

  it("includes compact per-session skill coverage and linked assessments", () => {
    const doc = buildModuleOverviewDocxDocument(moduleOverviewInput());
    const texts = getDocParagraphs(doc)
      .map(getParagraphText)
      .filter(Boolean);

    expect(texts).toContain("Skill coverage: Introduced A01; Practiced A02");
    expect(texts).toContain("Skill coverage: Practiced A01");
    expect(texts).toContain("Linked Assessments");
    expect(texts).toContain("GAIE-01: First assignment (gaie, due 2026-02-01)");
  });

  it("handles a module with no sessions or objectives", () => {
    const doc = buildModuleOverviewDocxDocument({
      module: { code: "LM-09", title: "Empty", description: null, learningObjectives: [] },
      sessions: [],
      assessments: [],
    });
    const texts = getDocParagraphs(doc)
      .map(getParagraphText)
      .filter(Boolean);
    expect(texts).toContain("LM-09: Empty");
    expect(texts).toContain("No learning objectives recorded.");
    expect(texts).toContain("No sessions in this module.");
    expect(texts).toContain("No linked assessments.");
  });
});

describe("buildModuleOverviewDocx", () => {
  it("packs the module overview into a docx buffer", async () => {
    const buffer = await buildModuleOverviewDocx(moduleOverviewInput());

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
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
