import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notFound } from "@/lib/api-helpers";
import {
  buildTermSummaryMarkdown,
  exportFilename,
  type TermSummaryInput,
} from "@/lib/exporters";

/**
 * GET /api/terms/[id]/export/summary
 *
 * Term summary as a Markdown download — the instructor's personal
 * reference copy (design principle #2: exports only for what the app
 * can't replace).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const term = await prisma.term.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { sequence: "asc" },
        include: {
          sessions: {
            orderBy: { sequence: "asc" },
            include: { coverages: true },
          },
        },
      },
      assessments: {
        orderBy: { code: "asc" },
        include: { skills: { include: { skill: true } } },
      },
    },
  });

  if (!term) return notFound("Term not found");

  const skills = await prisma.skill.findMany({
    where: { OR: [{ isGlobal: true }, { termId: id }] },
    orderBy: { code: "asc" },
  });

  const sessions: TermSummaryInput["sessions"] = term.modules.flatMap(
    (module) =>
      module.sessions.map((session) => ({
        id: session.id,
        code: session.code,
        title: session.title,
        sessionType: session.sessionType,
        date: session.date ? session.date.toISOString() : null,
        status: session.status,
        moduleId: module.id,
        moduleCode: module.code,
        moduleSequence: module.sequence,
        sequence: session.sequence,
      })),
  );

  const coverages: TermSummaryInput["coverages"] = term.modules.flatMap(
    (module) =>
      module.sessions.flatMap((session) =>
        session.coverages.map((coverage) => ({
          id: coverage.id,
          sessionId: coverage.sessionId,
          skillId: coverage.skillId,
          level: coverage.level,
          redistributedFrom: coverage.redistributedFrom,
        })),
      ),
  );

  const markdown = buildTermSummaryMarkdown({
    term: {
      code: term.code,
      name: term.name,
      courseCode: term.courseCode,
      startDate: term.startDate.toISOString(),
      endDate: term.endDate.toISOString(),
    },
    modules: term.modules.map((module) => ({
      code: module.code,
      title: module.title,
      description: module.description,
      learningObjectives: module.learningObjectives,
      sessionCount: module.sessions.length,
    })),
    skills: skills.map((skill) => ({
      id: skill.id,
      code: skill.code,
      category: skill.category,
      description: skill.description,
    })),
    sessions,
    coverages,
    assessments: term.assessments.map((assessment) => ({
      code: assessment.code,
      title: assessment.title,
      assessmentType: assessment.assessmentType,
      dueDate: assessment.dueDate ? assessment.dueDate.toISOString() : null,
      skillCodes: assessment.skills.map((link) => link.skill.code),
    })),
  });

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(
        `${term.courseCode}-${term.code}-summary`,
        "md",
      )}"`,
    },
  });
}
