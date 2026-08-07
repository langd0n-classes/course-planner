/**
 * Export string assembly — pure functions, no DB access.
 *
 * Exports are a failure state (design principle #2): these exist only to
 * feed external systems the app cannot replace (LMS rich-text fields,
 * outside GenAI chats, the instructor's personal files). Keep this file
 * to exactly those three shapes; anything else should be an in-app view.
 */

import {
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
} from "docx";

export const OBJECTIVES_NUMBERING_REFERENCE = "module-overview-objectives";
import {
  assembleCoverageMatrix,
  computeHealthBar,
  getSkillHealthStatus,
  type MatrixSkill,
  type MatrixSession,
  type MatrixCoverage,
  type HealthStatus,
} from "@/domain/coverage-matrix";
import type { CoverageLevel } from "@/domain/coverage-rules";

// ─── Term summary (Markdown, instructor reference) ──────

export interface TermSummaryInput {
  term: {
    code: string;
    name: string;
    courseCode: string;
    startDate: string;
    endDate: string;
  };
  modules: Array<{
    code: string;
    title: string;
    description: string | null;
    learningObjectives: string[];
    sessionCount: number;
  }>;
  skills: MatrixSkill[];
  sessions: MatrixSession[];
  coverages: MatrixCoverage[];
  assessments: Array<{
    code: string;
    title: string;
    assessmentType: string;
    dueDate: string | null;
    skillCodes: string[];
  }>;
}

const STATUS_LABEL: Record<HealthStatus, string> = {
  fully_covered: "fully covered",
  partially_covered: "partial",
  uncovered: "uncovered",
};

const formatDate = (value: string | null): string =>
  value ? new Date(value).toISOString().slice(0, 10) : "undated";

export function buildTermSummaryMarkdown(input: TermSummaryInput): string {
  const { term, modules, skills, sessions, coverages, assessments } = input;
  const rows = assembleCoverageMatrix(skills, sessions, coverages);
  const health = computeHealthBar(rows);
  const statusBySkillId = new Map(
    rows.map((row) => [row.skill.id, getSkillHealthStatus(row)]),
  );

  const lines: string[] = [];
  lines.push(`# ${term.name} — ${term.courseCode} (${term.code})`);
  lines.push("");
  lines.push(`${formatDate(term.startDate)} to ${formatDate(term.endDate)}`);
  lines.push("");

  lines.push("## Coverage health");
  lines.push("");
  lines.push(`${health.total} skills`);
  lines.push("");
  lines.push(`- Fully covered: ${health.fullyCovered}`);
  lines.push(`- Partially covered: ${health.partiallyCovered}`);
  lines.push(`- Uncovered: ${health.uncovered}`);
  lines.push("");

  lines.push("## Modules");
  lines.push("");
  if (modules.length === 0) {
    lines.push("No modules defined.");
    lines.push("");
  }
  modules.forEach((module) => {
    lines.push(`### ${module.code}: ${module.title}`);
    lines.push("");
    if (module.description) {
      lines.push(module.description);
      lines.push("");
    }
    lines.push(
      `${module.sessionCount} session${module.sessionCount === 1 ? "" : "s"}`,
    );
    lines.push("");
    if (module.learningObjectives.length > 0) {
      lines.push("Learning objectives:");
      lines.push("");
      module.learningObjectives.forEach((objective) => {
        lines.push(`- ${objective}`);
      });
      lines.push("");
    }
  });

  lines.push("## Skills by category");
  lines.push("");
  if (skills.length === 0) {
    lines.push("No skills registered.");
    lines.push("");
  } else {
    const categories = [...new Set(skills.map((skill) => skill.category))].sort();
    categories.forEach((category) => {
      lines.push(`### ${category}`);
      lines.push("");
      skills
        .filter((skill) => skill.category === category)
        .sort((a, b) => a.code.localeCompare(b.code))
        .forEach((skill) => {
          const status = statusBySkillId.get(skill.id) ?? "uncovered";
          lines.push(
            `- ${skill.code}: ${skill.description} — ${STATUS_LABEL[status]}`,
          );
        });
      lines.push("");
    });
  }

  lines.push("## Assessments");
  lines.push("");
  if (assessments.length === 0) {
    lines.push("No assessments defined.");
    lines.push("");
  }
  assessments.forEach((assessment) => {
    const due = assessment.dueDate
      ? `due ${formatDate(assessment.dueDate)}`
      : "no due date";
    const skillList =
      assessment.skillCodes.length > 0
        ? `skills: ${assessment.skillCodes.join(", ")}`
        : "no linked skills";
    lines.push(
      `- ${assessment.code}: ${assessment.title} (${assessment.assessmentType}, ${due}) — ${skillList}`,
    );
  });
  lines.push("");

  return lines.join("\n");
}

// ─── Module overview (plain text, LMS copy-paste) ───────

export interface ModuleOverviewInput {
  module: {
    code: string;
    title: string;
    description: string | null;
    learningObjectives: string[];
  };
  sessions: Array<{
    code: string;
    title: string;
    sessionType: string;
    date: string | null;
    description: string | null;
    status: string;
    skillCoverages: Array<{
      skillCode: string;
      skillDescription: string;
      level: CoverageLevel;
    }>;
  }>;
  assessments: Array<{
    code: string;
    title: string;
    assessmentType: string;
    dueDate: string | null;
  }>;
}

const LEVEL_HEADINGS: Array<{ level: CoverageLevel; heading: string }> = [
  { level: "introduced", heading: "Introduced" },
  { level: "practiced", heading: "Practiced" },
  { level: "assessed", heading: "Assessed" },
];

function compactSkillCoverage(
  skillCoverages: ModuleOverviewInput["sessions"][number]["skillCoverages"],
): string {
  const byLevel = LEVEL_HEADINGS.map(({ level, heading }) => {
    const codes = [...new Set(
      skillCoverages
        .filter((entry) => entry.level === level)
        .map((entry) => entry.skillCode),
    )].sort();

    return codes.length > 0 ? `${heading} ${codes.join(", ")}` : null;
  }).filter((value): value is string => Boolean(value));

  return byLevel.length > 0 ? byLevel.join("; ") : "No skill coverage linked.";
}

export function buildModuleOverviewDocxDocument(
  input: ModuleOverviewInput,
): Document {
  const { module, sessions, assessments } = input;
  const children: Paragraph[] = [
    new Paragraph({
      text: `${module.code}: ${module.title}`,
      heading: HeadingLevel.HEADING_1,
    }),
  ];

  if (module.description) {
    children.push(new Paragraph({ text: module.description }));
  }

  children.push(
    new Paragraph({
      text: "Learning Objectives",
      heading: HeadingLevel.HEADING_2,
    }),
  );

  if (module.learningObjectives.length === 0) {
    children.push(new Paragraph({ text: "No learning objectives recorded." }));
  } else {
    module.learningObjectives.forEach((objective) => {
      children.push(
        new Paragraph({
          text: objective,
          numbering: { reference: OBJECTIVES_NUMBERING_REFERENCE, level: 0 },
        }),
      );
    });
  }

  children.push(
    new Paragraph({
      text: "Sessions",
      heading: HeadingLevel.HEADING_2,
    }),
  );

  if (sessions.length === 0) {
    children.push(new Paragraph({ text: "No sessions in this module." }));
  } else {
    sessions.forEach((session) => {
      const canceledLabel = session.status === "canceled" ? " [Canceled]" : "";

      children.push(
        new Paragraph({
          text: `${session.code}: ${session.title}${canceledLabel}`,
          heading: HeadingLevel.HEADING_3,
        }),
      );

      const details = [
        `Type: ${session.sessionType}`,
        `Date: ${session.date ? formatDate(session.date) : "undated"}`,
      ];
      children.push(new Paragraph({ text: details.join(" | ") }));

      if (session.description) {
        children.push(new Paragraph({ text: session.description }));
      }

      children.push(
        new Paragraph({
          text: `Skill coverage: ${compactSkillCoverage(session.skillCoverages)}`,
        }),
      );
    });
  }

  children.push(
    new Paragraph({
      text: "Linked Assessments",
      heading: HeadingLevel.HEADING_2,
    }),
  );

  if (assessments.length === 0) {
    children.push(new Paragraph({ text: "No linked assessments." }));
  } else {
    assessments.forEach((assessment) => {
      const due = assessment.dueDate
        ? `, due ${formatDate(assessment.dueDate)}`
        : "";
      children.push(
        new Paragraph({
          text: `${assessment.code}: ${assessment.title} (${assessment.assessmentType}${due})`,
        }),
      );
    });
  }

  return new Document({
    numbering: {
      config: [
        {
          reference: OBJECTIVES_NUMBERING_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: "start",
            },
          ],
        },
      ],
    },
    sections: [
      {
        children,
      },
    ],
  });
}

export async function buildModuleOverviewDocx(
  input: ModuleOverviewInput,
): Promise<Buffer> {
  return Packer.toBuffer(buildModuleOverviewDocxDocument(input));
}

// ─── Session prompt (plain text, outside GenAI chat) ────

export interface SessionPromptInput {
  course: { courseCode: string; termName: string };
  session: {
    code: string;
    title: string;
    sessionType: string;
    date: string | null;
    description: string | null;
  };
  module: { code: string; title: string };
  skills: Array<{
    code: string;
    description: string;
    level: CoverageLevel;
  }>;
  priorSessionTitles: string[];
  upcomingSessionTitles: string[];
  assessments: Array<{ title: string; assessmentType: string }>;
}

const LEVEL_INSTRUCTION: Record<CoverageLevel, string> = {
  introduced: "Introduce",
  practiced: "Practice",
  assessed: "Assess",
};

export function buildSessionPromptText(input: SessionPromptInput): string {
  const {
    course,
    session,
    module,
    skills,
    priorSessionTitles,
    upcomingSessionTitles,
    assessments,
  } = input;
  const lines: string[] = [];

  lines.push(
    `You are helping design content for "${session.title}" in ${course.courseCode} (${course.termName}).`,
  );
  lines.push("");

  lines.push("Session context:");
  lines.push(`- Code: ${session.code}`);
  lines.push(`- Type: ${session.sessionType}`);
  lines.push(`- Date: ${session.date ? formatDate(session.date) : "not scheduled yet"}`);
  lines.push(`- Module: ${module.code}: ${module.title}`);
  if (session.description) {
    lines.push(`- Description: ${session.description}`);
  }
  lines.push("");

  lines.push("Skills to cover in this session:");
  if (skills.length === 0) {
    lines.push("No skills are linked to this session yet.");
  }
  skills.forEach((skill) => {
    lines.push(
      `- ${LEVEL_INSTRUCTION[skill.level]}: ${skill.code} — ${skill.description}`,
    );
  });
  lines.push("");

  if (priorSessionTitles.length > 0) {
    lines.push("Earlier sessions in this module (for continuity):");
    priorSessionTitles.forEach((title) => lines.push(`- ${title}`));
    lines.push("");
  }

  if (upcomingSessionTitles.length > 0) {
    lines.push("Upcoming sessions in this module (for forward-planning):");
    upcomingSessionTitles.forEach((title) => lines.push(`- ${title}`));
    lines.push("");
  }

  if (assessments.length > 0) {
    lines.push("Linked assessments:");
    assessments.forEach((assessment) =>
      lines.push(`- ${assessment.title} (${assessment.assessmentType})`),
    );
    lines.push("");
  }

  lines.push(
    `Based on the above, suggest learning activities, discussion questions, and exercise ideas appropriate for a ${session.sessionType} session.`,
  );
  lines.push("");

  return lines.join("\n");
}

// ─── Filenames ──────────────────────────────────────────

/** Sanitized, descriptive filename for an export download. */
export function exportFilename(
  base: string,
  extension: "md" | "txt" | "docx",
): string {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "export"}.${extension}`;
}
